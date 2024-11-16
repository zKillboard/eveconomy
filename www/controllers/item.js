'use strict';

module.exports = {
   paths: ['/item/:id'],
   get: get,
   priority: 1,
   ttl: 1
}

async function get(req, res, app) {
    const id = parseInt(req.params.id);
    if (id <= 0 || isNaN(id)) return {status_code: 404};

    let item = app.db.information.findOne({type: 'item_id', id: id});
    if (item == null) item = {};
    if (item.name == null || item.name.length == 0) item.name = `Item ${id}`;

    return {
        package: {title: item.name},
        ttl: 900,
        view: 'item.pug'
    };

}