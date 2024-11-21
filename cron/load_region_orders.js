'use strict';

module.exports = {
    exec: f,
    span: 900
}

const locations_added = {};
var regions = undefined;
let orderGroups = [];

let orders = {};
let inserts_pending = [];
let updates_pending = [];
let epochs_pending = [];
let global_epoch = 0;

async function f(app) {
	if (regions == undefined) {
		let regionF = await app.phin('https://esi.evetech.net/latest/universe/regions/?datasource=tranquility');
		regions = JSON.parse(regionF.body);
		doInserts(app);
		doUpdates(app);
		doEpochs(app);
	}

	let epoch = await app.now();
	global_epoch = epoch;
	let promises = [];
	for (const regionID of regions) {
		promises.push(loadRegion(app, regionID, epoch));
	}
	await Promise.allSettled(promises);

	await app.redis.set("evec:orders_epoch", epoch);
	while ((inserts_pending.length + updates_pending.length + epochs_pending.length) > 0) await app.sleep(1000);
	await app.sleep(1000);
	await app.db.orders.removeMany({epoch : {'$ne' : epoch}});

	let done = app.now();
	console.log('Fetching orders completed: ', (done - epoch), 'seconds');
}

async function doInserts(app) {
	let inserts = inserts_pending;
	inserts_pending = [];

	if (inserts.length > 0) {
		await app.db.orders.insertMany(inserts);
	}

	setTimeout(() => doInserts(app), 1000);
}

async function doUpdates(app) {
	let updates = updates_pending;
	updates_pending = [];

	for (let order of updates) {
		await app.db.orders.updateOne({order_id: order.order_id}, {$set: {price: order.price, volume_remain: order.volume_remain, epoch: global_epoch}})
	}

	setTimeout(() => doUpdates(app), 1000);
}

async function doEpochs(app) {
	let update;
	do {
		update = [];
		while (update.length <= 100 && epochs_pending.length > 0) update.push(epochs_pending.pop());
		await app.db.orders.updateMany({order_id: {'$in': update}}, {$set: {epoch: global_epoch}});
	} while (update.length > 0);

	setTimeout(() => doEpochs(app), 1000);
}

async function loadRegion(app, regionID, epoch) {
	try {
		let res = await loadRegionPage(app, regionID, 1, epoch);

		let pages = res.headers['x-pages'] | 1;
		let promises = [];
		for (let i = 2; i <= pages; i++) promises.push(loadRegionPage(app, regionID, i, epoch));
		await Promise.allSettled(promises);

		console.log(`Region ${regionID}: loaded ${pages} pages`);
	} catch (e) {
		console.error(e);
	}
}

async function loadRegionPage(app, regionID, page, epoch) {
	try {
		let res;
		do {
			let url = `https://esi.evetech.net/latest/markets/${regionID}/orders/?datasource=tranquility&page=${page}`;
			res = await app.util.assist.doGet(app, url);

			let orderGroup = [];

			if (res.statusCode == 200) {
				let json = JSON.parse(res.body);
				for (const order of json) {
					let cur_order = await app.db.orders.findOne({order_id: order.order_id});

					if (cur_order == null) {
						order.epoch = epoch;
						order.region_id = regionID;
						if (order.range == 'solarsystem') order.range = 'system';
						inserts_pending.push(order);

						if (locations_added[order.location_id] === undefined) {
							await app.util.entity.add(app, 'solar_system_id', order.system_id, true);
							await app.util.entity.add(app, 'location_id', order.location_id);
							await app.db.information.updateMany({type: 'location_id', id: order.location_id}, {$set: {solar_system_id: order.system_id}});
							locations_added[order.location_id] = true;
						}
					} else if (cur_order.price != order.price || cur_order.volume_remain != order.volume_remain) {
						updates_pending.push(order);
					} else {
						epochs_pending.push(order.order_id);
					}
				}
				orderGroups.push(orderGroup);
			} else if (res.statusCode >= 500 && res.statusCode <= 599) {
				console.log('error', res.statusCode, url);			
				await app.sleep(1000);
			}
		} while (res.statusCode >= 500);

		return res;
	} catch (e) { console.error(e); }
}