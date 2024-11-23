'use strict';

module.exports = {
   paths: ['/api/info'],
   get: get,
   ttl: 3600
}

async function get(req, res, app) {
	try {

		let valid = {
       		required: ['type', 'id'],
       		id: 'integer',
       		type: 'string'
    	}
    	valid = valid = req.verify_query_params(req, valid);
    	if (valid !== true) return {redirect: valid};

    	let id = Number(req.query.id);
    	let type = req.query.type;

    	let item = await app.db.information.findOne({type: type, id: id});
		if (!item) return {redirect: '/api/info?id=44992&type=item_id'};

		return {json: {name: item.name, dscr: item.description}, ttl: 3600};
    } catch (e) {
    	console.error(e);
    }
} 