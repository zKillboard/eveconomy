'use strict';

module.exports = {
   paths: '/auth/eve-login',
   get: get
}

async function get(req, res, app) {
  req.session.user = {}
  req.session.state = app.util.evesso.createState();

  console.log('eve-login', req.session);

  let url = app.util.evesso.getLoginURL(req.session.state, ['esi-universe.read_structures.v1', 'esi-markets.read_character_orders.v1', 'esi-markets.read_corporation_orders.v1']);
  return {
        redirect: url
  };
}
