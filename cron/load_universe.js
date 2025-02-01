'use strict';

module.exports = {
    init: f
}

async function f(app) {
	while (app.indexes_complete !== true) await app.sleep(100);

	console.log('Universe loading...');

    await Promise.allSettled([
        addStations(app),
	    addSystems(app),
	    addRegions(app),
        addTypes(app),
    ]);

	console.log('Universe loaded...');
	app.universe_loaded = true;
}

async function addStations(app) {
	await addRows(app, 'location_id', 'stationID', 'stationName', 'https://sde.zzeve.com/staStations.json');
}

async function addSystems(app) {
	await addRows(app, 'solar_system_id', 'solarSystemID', 'solarSystemName', 'https://sde.zzeve.com/mapSolarSystems.json');	
}

async function addRegions(app) {
	await addRows(app, 'region_id', 'regionID', 'regionName', 'https://sde.zzeve.com/mapRegions.json');	
}

async function addTypes(app) {
	await addRows(app, 'item_id', 'typeID', 'typeName', 'https://sde.zzeve.com/invTypes.json');	
}

async function addRows(app, row_type, row_id, row_name, url) {
	let raw = await app.phin(url);
	let rows = JSON.parse(raw.body);
	for (let row of rows) {
		await app.util.entity.add(app, row_type, row[row_id], false, row[row_name]);
	}
    console.log(url, 'loaded', rows.length);
}
