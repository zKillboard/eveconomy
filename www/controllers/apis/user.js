'use strict';

module.exports = {
   paths: ['/api/user'],
   get: get,
   priority: 1 
}

async function get(req, res, app) {
   let user = req.session.user || {};

   return {json: user};
}