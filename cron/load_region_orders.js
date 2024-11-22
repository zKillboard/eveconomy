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
	}

	// Create the new temporary collection and ensure it is empty
	app.db['orders_new'] = await app.db.collection('orders_new');
	app.db.orders_new.deleteMany({});
	await app.db.collection('orders_old').drop();
	
	let epoch = await app.now();
	let s = {complete: false};

	let promises = [];
	for (const regionID of regions) {
		promises.push(await loadRegion(app, regionID, epoch));
	}
	await Promise.allSettled(promises);

	await app.util.indexes(app);

	await app.db.orders.rename('orders_old');
	await app.db.orders_new.rename('orders');
	app.db['orders'] = await app.db.collection('orders');

	await app.db.collection('orders_old').drop();

	let done = app.now();
	console.log('Fetching orders completed: ', (done - epoch), 'seconds');
}

async function loadRegion(app, regionID, epoch) {
	try {
		let res = await loadRegionPage(app, regionID, 1, epoch);

		if (res.statusCode != 200) {
			console.log(regionID, "ERROR", res.statusCode);
		} else {
			let pages = res.headers['x-pages'] | 1;
			let promises = [];
			for (let i = 2; i <= pages; i++) promises.push(loadRegionPage(app, regionID, i, epoch));
			await Promise.allSettled(promises);

			//console.log(`Region ${regionID}: loaded ${pages} pages`);
		}
	} catch (e) {
		console.error(e);
	}
}

async function loadRegionPage(app, regionID, page, epoch) {
	try {
		if (app.bail) return;
		let res;
		do {
			let url = `https://esi.evetech.net/latest/markets/${regionID}/orders/?datasource=tranquility&page=${page}`;
			res = await app.util.assist.doGet(app, url);

			if (res.statusCode == 200) {
				let orders = JSON.parse(res.body);				
				for (const order of orders) {
					let cur_order = await app.db.orders.findOne({order_id: order.order_id});
					order.epoch = epoch;
					order.region_id = regionID;
					if (order.range == 'solarsystem') order.range = 'system';

					if (locations_added[order.location_id] != true) {
							await app.util.entity.add(app, 'solar_system_id', order.system_id, true);
							await app.util.entity.add(app, 'location_id', order.location_id);
							await app.db.information.updateMany({type: 'location_id', id: order.location_id}, {$set: {solar_system_id: order.system_id}});
							locations_added[order.location_id] = true; 
					}
				}
				if (orders.length > 0) {					
					try {
						while (await app.redis.set('evec:lock:orderinsert', 'true', 'NX', 'EX', 60) === false) await app.sleep(10);
						await app.db.orders_new.insertMany(orders);
						console.log(url, orders.length);
					} finally {
						await app.redis.del('evec:lock:orderinsert');
					}
				}
			} else if (res.statusCode >= 500 && res.statusCode <= 599) {
				console.log('error', res.statusCode, url);			
				await app.sleep(1000);
			}
		} while (res.statusCode >= 500);

		return res;
	} catch (e) { console.error(e); process.exit(); }
}