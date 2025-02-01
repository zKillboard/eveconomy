'use strict';

module.exports = {
    exec: f,
    span: 10
}

async function f(app) {

    while (app.indexes_complete != true) await app.sleep(100);
    while (app.universe_loaded != true) await app.sleep(100);

    await app.db.information.updateMany({type: 'location_id', id: {$gt: 69999999}, structure_named: {$exists: false}}, {$set: {structure_named: false}});

    let characters = [];
    let scopes = [];
    let cursor = await app.db.scopes.find();
    while (await cursor.hasNext()) scopes.push(await cursor.next());

    for (let scope of scopes) {
        characters.push(scope.character_id);

        let structure = await app.db.information.findOne({
            type: 'location_id',
            id: {$gt: 69999999},
            structure_named: false,
            failed_character_ids: {$nin: characters}
        });
        if (!structure) continue;

        let access_token;

        try {
            access_token = await app.util.evesso.getAccessToken(app, scope.refresh_token, app.redis);
        } catch (e) {
            console.error('Error with access token on scope', e);
            // Something wrong with this access token...
            await app.db.scopes.removeOne({_id: scope._id});
            continue;
        }

        if (structure.structure_named == true) continue;
        let failed_char_ids = structure.failed_character_ids || [];
        if (failed_char_ids.indexOf(scope.character_id) >= 0) continue;

        try {
            let s = await app.util.evesso.getEsiCall(app, process.env.esi_url + `/v2/universe/structures/${structure.id}`, access_token);
            await app.db.information.updateOne({type: 'location_id', id: structure.id}, {$set: {name: s.name, structure_named: true}});

            console.log('Retrieved structure name:', structure.id, s.name);
        } catch (e) {
            console.log('Failed to get structure name:', structure.id);
            await app.db.information.updateOne({type: 'location_id', id: structure.id}, {$addToSet: {failed_character_ids: scope.character_id}});
        }
        break;
    }
}