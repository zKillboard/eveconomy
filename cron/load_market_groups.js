'use strict';

module.exports = {
    exec: f,
    span: 14400
}

const market_groups = '/latest/markets/groups/';

async function f(app) {
	if (app.bailout == true) return;
	const url = 'https://esi.evetech.net/latest/markets/groups/';
	let res = await app.phin(url)
	if (res.statusCode == 200) {
		let json = JSON.parse(res.body);
		for (const id of json) {
			await app.util.entity.add(app, 'market_id', id, false);
		}
	}
}
