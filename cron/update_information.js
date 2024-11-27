'use strict';

module.exports = {
    exec: f,
    span: 1
}

const adds = [
    'character_id', 
    'corporation_id', 
    'alliance_id', 
    'group_id', 
    'category_id',
    'location_id',
    'constellation_id', 
    'region_id', 
    'creator_corporation_id', 
    'executor_corporation_id', 
    'creator_id',
    'ceo_id', 
    'types', 
    'groups', 
    'systems', 
    'constellations', 
    'star_id',
    'stargates'
];

const maps = {
    'creator_corporation_id': 'corporation_id',
    'executor_corporation_id': 'corporation_id',
    'creator_id': 'character_id',
    'ceo_id': 'character_id',
    'types': 'item_id',
    'groups': 'group_id',
    'systems': 'solar_system_id',
    'constellations': 'constellation_id',
    'stargates': 'stargate_id'
};


const urls = {
    'item_id': '/v3/universe/types/:id/',
    'group_id': '/v1/universe/groups/:id/',
    'category_id': '/v1/universe/categories/:id/',
    'market_id': '/v1/markets/groups/:id/',
    'character_id': '/v5/characters/:id/',
    'corporation_id': '/v4/corporations/:id/',
    'alliance_id': '/v4/alliances/:id/',
    'location_id': '/latest/universe/stations/:id/',
    'solar_system_id': '/v4/universe/systems/:id/',
    'constellation_id': '/v1/universe/constellations/:id/',
    'region_id': '/v1/universe/regions/:id/',
    // 'star_id': '/v1/universe/stars/:id/',
    // 'stargate_id': '/v2/universe/stargates/:id/'
};
const types = Object.keys(urls);

const types_dependant_on_server_version = ['item_id', 'group_id', 'category_id', 'solar_system_id', 'constellation_id', 'region_id'];

/*
 Meta 1-4 is tech 1, meta 5 is tech 2, meta 6-7 is storyline, meta 8 is faction, meta 10 is abyss, meta 11 to 14 is officer
 Zifrian — Today at 4:40 PM
@Squizz Caphinator moving to this channel - on using an attributeID, 1692 seems to give the new metaGroupID
However, T1 and T2 that value is null in the SDE
null - T1-T2
3 - Storyline
4 - Faction/Navy (Green)
5 - Officer (purple)
6 - Deadsace (Blue)
Squizz Caphinator — Today at 4:41 PM
hrm, so maybe use 1692 if present, and otherwise 633
*/

let concurrent = 0;
let firstRun = true;

async function f(app) {
    if (firstRun) {
        while (app.indexes_complete !== true) { await app.sleep(1000); }
        
        firstRun = false;
        for (const typeValue of types) populateSet(app, typeValue);
    }
}

async function populateSet(app, typeValue) {
    let fetched = 0;
    try {
        if (app.no_api == true) return;
        const dayAgo = app.now() - 86400;

        fetched += await iterate(app, await app.db.information.find({type: typeValue, waiting: true}).limit(10));
        if (fetched > 0) await app.sleep(1000); // allow things to wait to maybe add more for us to wait on... 
        else fetched += await iterate(app, await app.db.information.find({type: typeValue, last_updated: {$lt: dayAgo}}).sort({last_updated: 1}).limit(10));
    } catch (e) {
        console.log(e, 'dropped on ' + typeValue);
    } finally {
        if (fetched == 0) await app.sleep(15000);
        populateSet(app, typeValue);
    }
}

async function iterate(app, iterator) {
    let fetched = 0;
    let promises = [];
    
    while (await iterator.hasNext()) {
        if (app.bailout == true || app.no_api == true) break;
        const row = await iterator.next();

        if (row.waiting == true) console.log('Fetching entity:', row.type, row.id);

        if (row.type == 'war_id') await app.sleep(15000); // war calls limited to 4 per minute as too many could affect the cluster

        while (concurrent >= app.rate_limit) await app.sleep(10);

        concurrent++;
        promises.push(fetch(app, row));
        fetched++;
    }
    await iterator.close();

    // Wait for all calls to finish and return
    await app.waitfor(promises);
    return fetched;
}
 
async function fetch(app, row) {
    try {
        const orow = row;
        let now = Math.floor(Date.now() / 1000);

        if (row.no_fetch === true) {
            await app.db.information.updateOne(row, {$set: {last_updated: now}});
            return;
        }

        let url;
        if (row.type == 'location_id' && row.id > 69999999) {
            await app.sleep(30000); // long pause here
            url = process.env.esi_url + '/latest/universe/structures/:id/'.replace(':id', row.id);
        } else url = process.env.esi_url + urls[row.type].replace(':id', row.id);
        let res = await app.phin({url: url, timeout: 15000});

        switch (res.statusCode) {
        case 200:
            let body = JSON.parse(res.body);
            body.inactive = false;
            body.last_updated = now;
            //body.etag = ''; // res.headers.etag;
            body.waiting = false;

            if (row.type == 'war_id') {
                // Special case for wars, something with this war changed
                let total_kills = (body.aggressor.ships_killed || 0) + (body.defender.ships_killed || 0);
                if ((row.total_kills || 0) != total_kills) {
                    body.total_kills = total_kills;
                    body.check_wars = true;
                }
            } else {
                body.update_search = true; // update autocomplete name
            }

            if (row.type == 'location_id' && row.id > 69999999) console.log(body);

            // Characters, corporations, and alliances don't always have alliance or faction id set
            if (row.type == 'character_id' || row.type == 'corporation_id' || row.type == 'alliance_id') {
                body.alliance_id = body.alliance_id || 0;
                body.faction_id = body.faction_id || 0;
            }

            // Just to prevent any accidental cross contamination
            body.type = row.type;
            body.id = row.id; 

            if (row.type == 'location_id' && body.name == null && row.name != null && row.name != undefined) delete body.name; // Don't overwrite existing names

            await app.db.information.updateOne(row, {$set: body});

            let keys = Object.keys(body);
            for (let key of keys) {
                let value = body[key];

                if (adds.includes(key)) {
                    let type = maps[key] || key;
                    if (type == null) {
                        console.log('Unmapped type: ' + type);
                        continue;
                    }
                    if (Array.isArray(value)) {
                        for (let v of value) {
                            await app.util.entity.add(app, type, v, false);
                        }
                    } else {
                        await app.util.entity.add(app, type, value, false);
                    }
                }
            }

            // TODO broadcast information update

            break;
        case 304: // ETAG match
            await app.db.information.updateOne(row, {$set: {last_updated: now}});
            break;            
        case 404:
            if (row.type == 'character_id') {
                await app.db.information.updateOne(row, {$set: {no_fetch: true, update_name: true, last_updated: app.now(), corporation_id: 1000001}, $unset: {alliance_id: 1, faction_id: 1}});
            } else {
                await app.db.information.updateOne(row, {$set: {no_fetch: true, update_name: true, last_updated: now}});
            }
            break;
        // all of these codes are handled with a wait in the esi error handler
        case 400:
            console.log(row, '400 error code')
            break;
        case 401:
        case 420:
        case 500:
        case 502:
        case 503:
        case 504:
        case undefined:
            if (row.type == 'location_id') {
                let system = await app.db.information.findOne({type: 'solar_system_id', id: row.solar_system_id});
                let name = (system && system.name ? system.name : row.solar_system_id) + ' Structure';                
                await app.db.information.updateOne(row, {$set: {name: name, last_updated: app.now()}}); // Try again later                
            } else {
                await app.db.information.updateOne(row, {$set: {last_updated: (app.now() - 86100)}}); // Try again later
            }
            break;
        default:
            console.log(row, 'Unhandled error code ' + res.statusCode);
        }
    } catch (e) {
        await app.db.information.updateOne(row, {$set: {last_updated: (app.now() - 86100)}});
        console.log(e);
    } finally {
        concurrent--;
    }
}