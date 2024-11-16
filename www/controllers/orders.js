'use strict';

module.exports = {
   paths: ['/api/orders/:id'],
   get: get,
   priority: 1,
   ttl: 1
}

async function get(req, res, app) {
	try {
		 const id = parseInt(req.params.id);
	    if (id <= 0 || isNaN(id)) return {status_code: 404};

	    let buyorders = toArray(app.db.orders.find({type_id: id, is_buy_order: true}, {_id: -1}).sort({price: -1, issued: 1}).limit(100));
	    let sellorders = toArray(app.db.orders.find({type_id: id, is_buy_order: false}, {_id: -1}).sort({price: 1, issued: 1}).limit(100));

	    let item = await app.db.information.findOne({type: 'item_id', id: id});
	    if (!item) item = {name: `Item {$id}`, desc: ''};

		buyorders = addLocations(app, buyorders);
		sellorders = addLocations(app, sellorders);
	    
	    return {json: {name: item.name, desc: item.description, buy: await buyorders, sell: await sellorders}}
	} catch (e) {
		console.log(e);
	}
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