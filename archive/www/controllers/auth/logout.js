'use strict';

module.exports = {
   paths: '/auth/logout',
   get: get
}

async function get(req, res, app) {  
   req.session.destroy();

   return {redirect: '/'};
}