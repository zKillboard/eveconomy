'use strict';

module.exports = {
   paths: ['/api/orders'],
   get: get,
   priority: 1
}

async function get(req, res, app) {
	try {
		let epoch = app.now();
		epoch = epoch - (epoch % 900);

		let valid = {
       	required: ['item', 'epoch'],
       	item: 'integer',
       	region: 'integer',
       	epoch: epoch
    	}
    	valid = valid = req.verify_query_params(req, valid);
    	if (valid !== true) return {redirect: valid};
		
		const id = parseInt(req.query.item);
		const region_id = req.query.region ? parseInt(req.query.region) : null;

		let buyorders = search(app, id, true, -1, region_id);
		let sellorders = search(app, id, false, 1, region_id);

	   return {json: {id: id, buy: await buyorders, sell: await sellorders}, ttl: 3600}
	} catch (e) {
		console.log(e);
	}
}

async function search(app, type_id, is_buy_order, sort, region_id = null) {
	let filter = {type_id: type_id, is_buy_order: is_buy_order};
	if (region_id != null) filter.region_id = region_id;

	let res = await addLocations(app, toArray(await app.db.orders.find(filter).project({_id: 0}).sort({price: sort, issued: 1}).limit(100)));
	return res;
}

async function toArray(promise) {
	promise = await promise;
	let arr = [];
	while (await promise.hasNext()) arr.push(await promise.next());
	return arr;
}

async function addLocations(app, arr) {
	arr = await arr;
	let ret = [];
	for (let ar of arr) {
		let location = await app.db.information.findOne({type: 'location_id', id: ar.location_id});
		if (location && location.name && location.name.length > 0) {
			ar.location_name = location.name;
		} else ar.location_name = `Location ${ar.location_id}`;
		
		ret.push(ar);
	}
	return ret;
}