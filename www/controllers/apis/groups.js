'use strict';

module.exports = {
   paths: ['/api/groups'],
   get: get,
   priority: 1,
}

async function get(req, res, app) {
	try {
		let raw = await app.redis.get('evec:groups');
		if (raw == null) {
			await init(app);
			raw = await app.redis.get('evec:groups');
		}
		let json = JSON.parse(raw);
	    
	   return {json: json};
	} catch (e) {
		console.log(e);
	}
}

async function init(app) {
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