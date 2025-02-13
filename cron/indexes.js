'use strict';

module.exports = {
    init: f
}

let initialized = true;

async function f(app) {
    let success = false;
    console.log('Ensuring all indexes exist.')

    app.indexes_complete = false;
    app.regions = null;

    do {
        try {
            await applyIndexes(app);
            success = true;
        } catch (e) {
            console.log(e);
            await app.sleep(1000);
            success = false;
        }
    } while (success == false);

    await applyIndexes(app);
    initialized = false;
    app.indexes_complete = true;
}

async function applyIndexes(app) {
    await createCollection(app, 'orders');
    await createIndex(app, app.db.orders, { order_id: 1 }, { unique: true });
    await createIndex(app, app.db.orders, { type_id: 1 });
    await createIndex(app, app.db.orders, { type_id: 1, is_buy_order: 1 });
    await createIndex(app, app.db.orders, { type_id: 1, is_buy_oder: 1, price: 1 });
    await createIndex(app, app.db.orders, { type_id: 1, region_id: 1 });
    await createIndex(app, app.db.orders, { type_id: 1, region_id: 1, is_buy_order: 1 });
    await createIndex(app, app.db.orders, { type_id: 1, region_id: 1, is_buy_order: 1, price: 1 });

    await createCollection(app, 'information');
    await createIndex(app, app.db.information, { type: 1, id: 1 }, { unique: true });
    await createIndex(app, app.db.information, {type: 1});
    await createIndex(app, app.db.information, {id: 1});
    await createIndex(app, app.db.information, {type: 1, waiting: 1});
    await createIndex(app, app.db.information, {type: 1, last_updated: 1});
    await createIndex(app, app.db.information, {type: 1, last_price_update: 1}, {sparse: true});

    await createCollection(app, 'scopes');
    await createIndex(app, app.db.scopes, { character_id: 1 }, { unique: true });
    await createIndex(app, app.db.scopes, { scopes: 1 });
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

async function createIndex(app, collection, index, options = {}) {
    let previous_index_count = Object.keys(await collection.indexInformation()).length;
    let creation = app.wrap_promise(collection.createIndex(index, options));
    let timeout = app.sleep(1000);
    await Promise.race([creation, timeout]);
    if (!creation.isFinished()) {
        console.log('Index creating', index, options);
    }
    await creation;
    let new_index_count = Object.keys(await collection.indexInformation()).length
    if (new_index_count != previous_index_count) {
        console.log('Created index:', index, 'with options', options);
    }
}
