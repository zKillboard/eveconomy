'use strict';

module.exports = {
   paths: '/',
   get: get,
   priority: 1
}

async function get(req, res, app) {
	return {redirect: '/item/44992'};
}