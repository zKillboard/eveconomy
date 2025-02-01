'use strict';

const limit_object = {};
function clean_limit_object() {
	const now = Math.floor(Date.now() / 1000);
	for (const key of Object.keys(limit_object)) {
		if (key < now) delete limit_object[key];
	}
}
setInterval(clean_limit_object, 5000);

// Per CCP Explorer, respect these rate limits
const esi_rate_intervals = {
	0    : 20, 	// 00:00am UTC
	//800  : 10, 	// 08:00am UTC
	1059 : 0, 	// 10:59am UTC
	1110 : 20, 	// 11:10am UTC
	//1800 : 5 	// 06:00pm UTC
}
let rate_limit = -1;
let rate_limit_override = parseInt(process.env.rate_limit_override);
async function doSetRateLimit(app) {
	let d = new Date();
	let current_time = (d.getUTCHours() * 100) + d.getUTCMinutes();
	let calc_rate_limit = esi_rate_intervals[Object.keys(esi_rate_intervals)[0]]; // initial default
	for (const [time, timed_rate_limit] of Object.entries(esi_rate_intervals)) {
		if (current_time >= time) calc_rate_limit = timed_rate_limit;
	}
	if (rate_limit_override > 0) calc_rate_limit = rate_limit_override;
	if (rate_limit !== calc_rate_limit) console.log(`Setting ESI rate limit per second to ${calc_rate_limit}/s`);
	rate_limit = calc_rate_limit;

	let s = Date.now();
	s = 60000 - (s % 60000);
	setTimeout(() => doSetRateLimit(app), s);
}
let initialized = false;
async function init(app) {
	if (!initialized) {
		setTimeout(() => doSetRateLimit(app), 1);
		initialized = true;
	}
}

let lastESICallEpoch = 0;

const assist = { 
	doGet: async function (app, url, headers= [], attempts = 3) { 
		await init(app);
		
		while (rate_limit <= 0) await app.sleep(100);

		let minWaitTime = (1 / rate_limit) * 1000;
		while ((Date.now() - minWaitTime) <= lastESICallEpoch) await app.sleep(10);
		lastESICallEpoch = Date.now();

		let res = await app.phin({url: url, headers: headers});
		if (res.statusCode >= 500 && attempts > 0) {
			await app.sleep(2000);
			return await this.doGet(app, url, headers, attempts - 1);
		}
		return res;
	},

	getRateLimit: function() {
		return rate_limit;
	}
}

module.exports = assist;
