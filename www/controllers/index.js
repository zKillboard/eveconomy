'use strict';

module.exports = {
   paths: '/',
   get: get,
   priority: 1,
   ttl: 3600
}

async function get(req, res, app) {
	return {redirect: '/item/44992'};
}