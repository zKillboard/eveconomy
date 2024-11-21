'use strict';

module.exports = {
    exec: f,
    span: 900
}

const locations_added = {};
var regions = undefined;
let orderGroups = [];

async function f(app) {
	if (regions == undefined) {
		let regionF = await app.phin('https://esi.evetech.net/latest/universe/regions/?datasource=tranquility');
		regions = JSON.parse(regionF.body);
		updateOrders(app);
	}

	let epoch = await app.now();
	let promises = [];
	for (const regionID of regions) {
		promises.push(loadRegion(app, regionID, epoch));
	}
	await Promise.allSettled(promises);

	while (orderGroups.length > 0) await app.sleep(1000);
	await app.redis.set("evec:orders_epoch", epoch);
	await app.db.orders.removeMany({epoch : {'$ne' : epoch}});

	let done = app.now();
	console.log('Fetching orders completed: ', (done - epoch), 'seconds');
}

async function updateOrders(app) {
	while (orderGroups.length > 0) {
		let orderGroup = orderGroups.pop();
		if (orderGroup.length > 0) await app.db.orders.insertMany(orderGroup);
	}
	setTimeout(() => updateOrders(app), 100);
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
					order.epoch = epoch;
					order.regionID = regionID;
					if (order.range == 'solarsystem') order.range = 'system';
					orderGroup.push(order);	

					if (locations_added[order.location_id] === undefined) {
						await app.util.entity.add(app, 'solar_system_id', order.system_id, true);
						await app.util.entity.add(app, 'location_id', order.location_id);
						await app.db.information.updateMany({type: 'location_id', id: order.location_id}, {$set: {solar_system_id: order.system_id}});
						locations_added[order.location_id] = true;
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