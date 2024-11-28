'use strict';

module.exports = {
    exec: f,
    span: 15
}

async function f(app) {
	if (app.regions == null) {
		let regions = await app.phin('https://esi.evetech.net/latest/universe/regions/?datasource=tranquility');
		if (regions.statusCode == 200) {
			app.regions = shuffle(JSON.parse(regions.body));
		}
	}
}

function shuffle(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}