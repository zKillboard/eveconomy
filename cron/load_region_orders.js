'use strict';

var Mutex = require('async-mutex').Mutex;
const crud_mutex = new Mutex();
const region_mutex = new Mutex();

module.exports = {
    init: f
}

const url_etags = new Map();
const url_orderIds = new Map();
const locations_added = new Set();
var regions = undefined;
let line_count = 0;

function shuffle(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

async function f(app) {
	while (app.indexes_complete != true) await app.sleep(100);
	while (app.universe_loaded != true) await app.sleep(100);

	console.log('Initiating market region polls...');
	let regionF = await app.phin('https://esi.evetech.net/latest/universe/regions/?datasource=tranquility');
	regions = JSON.parse(regionF.body);

	for (const regionID of shuffle(regions)) {
		if (regionID >= 12000000 && regionID <= 12999999) continue;
		if (app.bailout) return;
		loadRegion(app, regionID);
		await app.sleep(100);
	}
}

async function loadRegion(app, regionID) {
	const redisKey = `evec:region_expires:${regionID}`;
	let expires = 301;
	let start = app.now(), took = 0;
	let num_pages = 1;

	let release;
	try {
		let ttl = await app.redis.ttl(redisKey);
		while (ttl >= 0) { await app.sleep(1000); ttl--; }

		let existing_orders = new Map();
		let cursor = await app.db.orders.find({region_id: regionID}).project({_id: 0});
		while (await cursor.hasNext()) {
			let order = await cursor.next();
			existing_orders.set(order.order_id, order);
		}
		start = app.now();

		let updates = {inserts: 0, updates: 0, removed: 0, total: 0};

		let res = await loadRegionPage(app, regionID, 1, existing_orders, updates);

			if (res != null && res.statusCode != 200 && res.statusCode != 304) {
				console.log(regionID, "ERROR", res.statusCode); 
			} else if (res != null) {
				let pages = res.headers['x-pages'] || 1;
				let num_pages = pages;

				if (res?.headers?.expires) expires = expiresToUnixtime(res.headers.expires) - app.now() + 1;

				if (pages > 1) {
					release = await region_mutex.acquire();
					start = app.now();
				}
				
				let promises = [];
				for (let i = pages; i > 1; i--) {
					promises.push(loadRegionPage(app, regionID, i, existing_orders, updates));
				}
				await Promise.allSettled(promises);

				for (let i = pages + 1; i <= 999; i++) url_orderIds.delete(`${regionID}:${i}`);

				if (app.bailout) return;

				let remaining = Array.from(existing_orders.keys());
				if (remaining.length > 0) {
					// get the orders first so we can publish their change
					let removing = await app.db.orders.find({region_id: regionID, order_id: {$in: remaining}}).toArray();				

					let types_touched = new Set();	
					let publish = [];
					for (let order of removing) {
						redisPublishPush(publish, 'remove', order);
						types_touched.add(order.type_id);
					}
					let crud = await app.db.orders.deleteMany({region_id: regionID, order_id: {$in: remaining}});
					updates.removed = crud.result.nRemoved;

					await redisPublish(app, publish);
					await app.db.information.updateMany({type: 'item_id', 'id': {'$in': Array.from(types_touched)}}, {$set: {last_price_update: app.now()}});
				}

				took = app.now() - start;
				if (updates.inserts + updates.updates + updates.removed + updates.total > 0) {
					if (line_count++ % (process.stdout.rows - 1) == 0) logit('Region', 'Pages', 'Inserts', 'Updates', 'Removed', 'Total', 'Duration', 'Expires');
					logit(regionID, num_pages, updates.inserts, updates.updates, updates.removed, updates.total, took, expires);
				}
			}
		} catch (e) {
		console.error(e);
		} finally {
			if (release) release();
			if (app.bailout) return;

			expires = Math.max(expires - took + 1, 15);
			await app.redis.setex(redisKey,  expires, expires);
			setTimeout(loadRegion.bind(null, app, regionID), (1 + expires) * 1000);
		}
}

async function loadRegionPage(app, regionID, page, existing_orders, updates) {
	try {
		if (app.bailout) return null;

		let url = `https://esi.evetech.net/latest/markets/${regionID}/orders/?datasource=tranquility&page=${page}`;
		let prev_etag = url_etags.get(url) || 'TBD';
		let headers = {'If-None-Match': prev_etag}; 
		let res = await app.util.assist.doGet(app, url, headers);
 
		let bulk = [];
		let publish = [];
		let types_touched = new Set();

		const url_orderIds_key = `${regionID}:${page}`

		if (res.statusCode == 404) {
			url_orderIds.delete(url_orderIds_key);
		} else if (res.statusCode == 304) {
			const url_orderIds_set = url_orderIds.get(url_orderIds_key);
			updates.total += url_orderIds_set.size;
			if (url_orderIds_set) for (let order_id of url_orderIds_set) existing_orders.delete(order_id);
		} else if (res.statusCode == 200) { 
			if (res?.headers?.etag) url_etags.set(url, res.headers.etag);
			
			const url_orderIds_set = new Set();

			let orders = JSON.parse(await res.body);
			updates.total += orders.length;
			while (orders.length > 0) {
				let order = orders.pop();

				// Completely ignore orders that are already fulfilled. 
				if (order.volume_remain == 0) continue;

				url_orderIds_set.add(order.order_id);
				let cur_order = existing_orders.get(order.order_id);
				existing_orders.delete(order.order_id);
				let now = app.now();

				if (typeof cur_order === 'undefined') {
					order.region_id = regionID;
					if (order.range == 'solarsystem') order.range = 'system';
					const new_order = Object.assign({}, order);
					delete new_order.order_id;
					new_order.epoch = now;

					bulk.push({
						updateOne: {
							filter: {order_id: order.order_id},
							update: {
								$setOnInsert: new_order	
							},
							upsert: true
						}
					});

					if (!locations_added.has(order.location_id)) {
							await app.util.entity.add(app, 'solar_system_id', order.system_id, true);
							let system = await app.db.information.findOne({type: 'solar_system_id', id: order.system_id,});
							let system_name = system.name;
							await app.db.information.updateMany({type: 'location_id', id: order.location_id}, {$set: {solar_system_id: order.system_id}});

							// If it is a structure we will wait for the name
							await app.util.entity.add(app, 'location_id', order.location_id, true, ( order.location_id > 69999999 ? system_name + ' Structure' : null));
							locations_added.add(order.location_id);
					}
					let location = await app.db.information.findOne({type: 'location_id', id: order.location_id});
					order.location_name = location && location.name ? location.name : '???';

					redisPublishPush(publish, 'upsert', order);
					types_touched.add(order.type_id);
				} else {
					if (cur_order.price != order.price || cur_order.volume_remain != order.volume_remain) {

						let set = {};

						if (cur_order.price != order.price) {
							set.price = order.price;
							set.price_epoch = now;
						}
						if (cur_order.volume_remain != order.volume_remain) {
							set.volume_remain = order.volume_remain;
							set.volume_remain_epoch = now;
						}

						bulk.push({
							updateOne: {
								filter: {order_id: order.order_id},
								update: {$set: set}
							}
						});

						redisPublishPush(publish, 'upsert', order) ;
						types_touched.add(order.type_id);						
					}
				}
			}
			if (bulk.length > 0) {
				let release = await crud_mutex.acquire();
				try {
					let crud = await app.db.orders.bulkWrite(bulk);
					updates.inserts += crud.result.nInserted + crud.result.nUpserted;
					updates.updates += crud.result.nModified;
				} finally {
					release();
				}
				redisPublish(app, publish);

				await app.db.information.updateMany({type: 'item_id', 'id': {'$in': Array.from(types_touched)}}, {$set: {last_price_update: app.now()}});
			}
			url_orderIds.set(url_orderIds_key, url_orderIds_set);
		} else if (res.statusCode >= 500 && res.statusCode <= 599) {
			console.log('error', res.statusCode, url);			
			await app.sleep(1000);
		}

		return res;
	} catch (e) {
		console.error(e);
	} 
}

function expiresToUnixtime(expires) {
  const date = new Date(expires);
  return Math.floor(date.getTime() / 1000);
}

async function redisPublishPush(publish, action, order) {
	let msg = {action: action};
	if (action == 'remove') msg.order_id = order.order_id;
	else msg.order = order;

	msg = JSON.stringify(msg);

	publish.push({channel: `market:item:${order.type_id}`, message: msg});
	publish.push({channel: `market:region:${order.region_id}`, message: msg});
	publish.push({channel: `market:item:${order.type_id}:region:${order.region_id}`, message: msg});
	publish.push({channel: 'market:all', message: msg});
}

async function redisPublish(app, publish) {
	for (let p of publish) await app.redis.publish(p.channel, p.message);
}

async function logit(regionID, inserts, updates, removes, same, time, expires) {
	let line = '';
	[...arguments].map((a) => line += (a || '0').toString().padStart(10));
	console.log(line);
}
