'use strict';

module.exports = {
    exec: f,
    span: 14400
}

const regions = [
	10000002, // The Forge (Jita)
	10000030, // Heimatar (Rens)
	10000032, // Sinq Laison (Dodixie)
	10000042, // Metropolis (Hek)
	10000043, // Domain (Amarr)
	];

async function f(app) {
	return;
	while (app.indexes_complete !== true) { await app.sleep(1000); }

	let epoch = app.now();
	for (const regionID of regions) {
		let page = 1;
		let res;
		console.log('Fetching types for region', regionID);
		do {
			if (app.bailout == true) return;
			const url = `https://esi.evetech.net/latest/markets/${regionID}/types/?datasource=tranquility&page=${page}`;
			res = await app.util.assist.doGet(app, url);
			if (res.statusCode == 200) {
				let json = JSON.parse(res.body);		
				for (const id of json) {
					await app.util.entity.add(app, 'item_id', id, false);
					await app.db.information.updateOne({type: 'item_id', id: id, last_price_update: {$exists: false}}, {$set: {last_price_update: 0}});
				}
			}
			page++;
			await app.sleep(1000);
		} while (res.statusCode == 200);
	}
	let done = app.now();
	console.log('Fetching types completed: ', (done - epoch), 'seconds');
}
