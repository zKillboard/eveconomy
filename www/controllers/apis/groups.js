'use strict';

module.exports = {
   paths: ['/api/groups'],
   get: get,
   priority: 1,
   ttl: 3600
}

async function get(req, res, app) {
	try {
		let raw = await app.redis.get('evec:groups');
		let json = JSON.parse(raw);
	    
	   return {json: json, ttl: 3600};
	} catch (e) {
		console.log(e);
	}
}
