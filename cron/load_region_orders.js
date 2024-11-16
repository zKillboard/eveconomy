'use strict';

module.exports = {
    exec: f,
    span: 900
}

const locations_added = {};

async function f(app) {
	let regionF = await app.phin('https://esi.evetech.net/latest/universe/regions/?datasource=tranquility');
	let regions = JSON.parse(regionF.body);
	let epoch = await app.now();
	for (const regionID of regions) {
		let page = 1;
		let res;
		let inserts = [];
		console.log('Fetching orders for region', regionID);
		do {
			if (app.bailout == true) return;
			res = await app.phin(`https://esi.evetech.net/latest/markets/${regionID}/orders/?datasource=tranquility&page=${page}`)
			if (res.statusCode == 200) {
				let json = JSON.parse(res.body);
				for (const order of json) {
					order.epoch = epoch;
					order.regionID = regionID;
					inserts.push(order);
					if (locations_added[order.location_id] === undefined) {
						await app.util.entity.add(app, 'solar_system_id', order.system_id, true);
						await app.util.entity.add(app, 'location_id', order.location_id);
						await app.db.information.updateMany({type: 'location_id', id: order.location_id}, {$set: {solar_system_id: order.system_id}});
						locations_added[order.location_id] = true;
					}
				}
			} else if (res.statusCode >= 500 && res.statusCode <= 599) {
				page--;
				await app.sleep(1000);
			}
			page++;
		} while (res.statusCode == 200);
		if (inserts.length > 0) await app.db.orders.insertMany(inserts);
		await app.db.orders.removeMany({regionID: regionID, epoch : {'$ne' : epoch}});
	}
	let done = app.now();
	console.log('Fetching orders completed: ', (done - epoch), 'seconds');
}