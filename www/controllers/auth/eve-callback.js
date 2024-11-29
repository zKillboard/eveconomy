'use strict';

module.exports = {
   paths: '/auth/eve-callback',
   get: get
}

async function get(req, res, app) {  
   let user = await app.util.evesso.doHandleCallback(app, req.query.code, req.query.state, req.session.state);

   req.session.user = user;

   return {redirect: '/api/user'};
}