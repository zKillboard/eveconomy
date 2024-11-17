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
			let o = {type: 'market_id', id: id};
			if (await app.db.information.countDocuments(o) == 0) {
				await app.db.information.insertOne(o);
			}
		}
	}
	while (await app.db.information.countDocuments({type: 'market_id', last_updated: 0}) > 0) {
		console.log('awaiting market groups names to be updated');
		await app.sleep(1000);
	}

	// build the market group menu
	let groups = await addGroups(app, await app.db.information.find({type: 'market_id', parent_group_id: {$exists: false}}))	
	await app.redis.set("evec:groups", JSON.stringify(groups));
	console.log('Market groups updated');
}

async function addGroups(app, result) {
	let ret = {};
	while (await result.hasNext()) {
		let row = await result.next();
		let subgroups = await addGroups(app, await app.db.information.find({type: 'market_id', parent_group_id: row.id}));
		let items = {};
		for (let item_id of row.types) {
			let item = await app.db.information.findOne({type: 'item_id', id: item_id});
			if (item && item.name) {
				items[item.name] = {item_id: item_id, name: item.name};
			}
		}

		ret[row.name] = {id: row.id, name: row.name, subgroups: subgroups, items: items};
	}
	return ret;
}