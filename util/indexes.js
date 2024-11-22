'use strict';


async function applyIndexes(app) {
    let hasNew = false;

    let o = ['orders', 'orders_new'];
    for (let c of o) {
	    await createCollection(app, c);
	    await createIndex(app, app.db[c], { epoch: 1, type_id: 1, is_buy_order: 1 });
	    await createIndex(app, app.db[c], { type_id: 1, is_buy_oder: 1, price: 1 });
	    await createIndex(app, app.db[c], { region_id: 1, epoch: 1 });
	    await createIndex(app, app.db[c], { type_id: 1, epoch: 1, is_buy_order: 1 });
    }

    await createCollection(app, 'information');
    await createIndex(app, app.db.information, { type: 1, id: 1 }, { unique: true })
    await createIndex(app, app.db.information, {type: 1})
    await createIndex(app, app.db.information, {id: 1})
    await createIndex(app, app.db.information, {type: 1, last_updated: 1})
    await createIndex(app, app.db.information, {type: 1, waiting: 1})
    await createIndex(app, app.db.information, {type: 1, last_price_update: 1}, {sparse: true});
}

async function createCollection(app, name) {
    try {
        if (typeof app.db[name] !== 'undefined') return false;
        await app.db.createCollection(name);
        app.db[name] = await app.db.collection(name);
        return true;
    } catch (e) {
        if (e.code == 48) return false; // all good, collection already exists and we want that anyway
        throw e;
    }
}

let informed = false;
async function createIndex(app, collection, index, options = {}) {
    let previous_index_count = Object.keys(await collection.indexInformation()).length;
    let creation = app.wrap_promise(collection.createIndex(index, options));
    let timeout = app.sleep(10);
    await Promise.race([creation, timeout]);
    if (!creation.isFinished()) {
        if (!informed) {
            console.log('Ensuring all indexes exist.')
            informed = true;
        }
    }
    await creation;
    let new_index_count = Object.keys(await collection.indexInformation()).length
    if (new_index_count != previous_index_count) {
        console.log('Created index:', index, 'with options', options);
        informed = true;
    }
}

module.exports = applyIndexes;