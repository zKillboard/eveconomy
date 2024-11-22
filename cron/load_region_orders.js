'use strict';

module.exports = {
    exec: f,
    span: 15
}

const locations_added = {};
var regions = undefined;

function shuffle(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

async function f(app) {
	if (regions == undefined) {
		let regionF = await app.phin('https://esi.evetech.net/latest/universe/regions/?datasource=tranquility');
		regions = JSON.parse(regionF.body);

		for (const regionID of shuffle(regions)) {
			if (app.bailout) return;
			loadRegion(app, regionID);
			await app.sleep(5000);
		}
	}
}

let region_calls = 0;
async function loadRegion(app, regionID) {
	while (region_calls > 5) await app.sleep(10);
	try {
		region_calls++;
		let order_ids = {};
		let cursor = await app.db.orders.find({region_id: regionID}).project({_id: 0, order_id: 1});
		while (await cursor.hasNext()) {
			let order = await cursor.next();
			order_ids[order.order_id] = order.order_id;
		}
		let updates = {inserts: 0, updates: 0, removed: 0, untouched: 0};

		let res = await loadRegionPage(app, regionID, 1, order_ids, updates);

		if (res != null && res.statusCode != 200) {
			console.log(regionID, "ERROR", res.statusCode); 
		} else if (res != null) {
			let pages = res.headers['x-pages'] | 1;
			
			let promises = [];
			for (let i = 2; i <= pages; i++) {
				promises.push(loadRegionPage(app, regionID, i, order_ids, updates));
				await app.sleep(100);
			}
			await Promise.allSettled(promises);

			let remaining = Object.values(order_ids);
			if (remaining.length > 0) {
				if (app.bailout) return;
				await app.db.orders.deleteMany({region_id: regionID, order_id: {$in: remaining}});
				updates.removed = remaining.length;
			}
			console.log('Region', regionID, ' Inserts', updates.inserts, ', Modified:', updates.updates, ', Removed:', updates.removed, ', Same:', updates.untouched);
		}
	} catch (e) {
		console.error(e);
	} finally {
		region_calls--;
		setTimeout(() => loadRegion(app, regionID), 900000);
	}
}

let region_page_calls = 0;
async function loadRegionPage(app, regionID, page, order_ids, updates) {
	while (region_page_calls > (process.env.max_regions_page_calls || 5)) await app.sleep(10);
	try {
		region_page_calls++;
		if (app.bailout) return null;

		let url = `https://esi.evetech.net/latest/markets/${regionID}/orders/?datasource=tranquility&page=${page}`;
		let res = await app.util.assist.doGet(app, url);

		let bulk = [];

		if (res.statusCode == 200) {
			let orders = JSON.parse(res.body);		
			while (orders.length > 0) {
				let order = orders.pop();
				
				let cur_order = await app.db.orders.findOne({order_id: order.order_id});

				if (cur_order == null) {
					order.region_id = regionID;
					if (order.range == 'solarsystem') order.range = 'system';

					bulk.push({
						insertOne: order
					});
					updates.inserts++;

					if (locations_added[order.location_id] != true) {
							await app.util.entity.add(app, 'solar_system_id', order.system_id, true);
							await app.util.entity.add(app, 'location_id', order.location_id);
							await app.db.information.updateMany({type: 'location_id', id: order.location_id}, {$set: {solar_system_id: order.system_id}});
							locations_added[order.location_id] = true; 
					}
				} else {
					delete order_ids[order.order_id];
					if (cur_order.price != order.price || cur_order.volume_remain != order.volume_remain) {
						let set = {};

						if (cur_order.price != order.price) set.price = order.price;
						if (cur_order.volume_remain != order.volume_remain) set.volume_remain = order.volume_remain;
						delete order.price;
						delete order.volume_remain;

						bulk.push({
							updateOne: {
								filter: {order_id: order.order_id},
								update: {$set: set}
							}
						});
						updates.updates++;
					} else updates.untouched++;
				}
			}
			if (bulk.length > 0) {					
				try {
					while (await app.redis.set('evec:lock:orderinsert', 'true', 'NX', 'EX', 60) === false) { console.log('awaiting'); await app.sleep(10); }
					if (bulk.length > 0) await app.db.orders.bulkWrite(bulk);
				} finally {
					await app.redis.del('evec:lock:orderinsert');
				}
			}
		} else if (res.statusCode >= 500 && res.statusCode <= 599) {
			console.log('error', res.statusCode, url);			
			await app.sleep(1000);
		}

		return res;
	} catch (e) {
		console.error(e);
	} finally {
		region_page_calls--;
	}
}