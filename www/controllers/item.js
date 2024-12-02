'use strict';

module.exports = {
   paths: ['/item/:id'],
   get: get
}

async function get(req, res, app) {
    const id = parseInt(req.params.id);
    if (id <= 0 || isNaN(id)) return {status_code: 404};

    let item = await app.db.information.findOne({type: 'item_id', id: id});

    return {
        package: {title: item.name},
        view: 'item.pug'
    };

}