'use strict';

const authorization = 'Basic ' + Buffer.from(`${process.env.EVE_Client_ID}:${process.env.EVE_Secret_Key}`).toString('base64');
const randomStringSource = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";

module.exports = {
	createState: function() {
		let state = '';
		while (state.length < 128) state += randomStringSource.charAt(Math.floor(Math.random() * 128));
  		return state;
	},

	getLoginURL: function(state, scopes = []) {
	  	let fields = [
	    	'response_type=code',
	    	'client_id=' + process.env.EVE_Client_ID,
	    	'redirect_uri=' + process.env.EVE_Callback_URL,
	    	'scope=' + scopes.join(' '),
	    	'state=' + state
	  	];
	  	return process.env.EVE_Login_URL + fields.join('&');
	},

	doHandleCallback: async function(app, code, state, expectedState) {
		if (state != expectedState) throw new Error('Invalid state');

		let opts = {
			url: process.env.EVE_Token_URL,
			followRedirects: true,
			form: {grant_type: 'authorization_code', code},
			method: 'POST',
			headers: {
	        	'Authorization': authorization,
	        	'Content-Type': 'application/x-www-form-urlencoded',
	        	'User-Agent': process.env.USER_AGENT
	      	}
		};

		let res = await app.phin(opts);
		if (res.statusCode == 200) {
			let json = JSON.parse(res.body);
			let decoded = parseJwt(json.access_token);

			let character_id = Number(decoded.sub.split(':')[2]);
			await app.util.entity.add(app, 'character_id', character_id);
			await app.db.scopes.updateOne({'character_id': character_id}, {$set: {
				name: decoded.name,
				scopes: decoded.scp, 
				refresh_token: json.refresh_token
			}}, {upsert: true});
			return {character_id: character_id, character_name: decoded.name, scopes: decoded.scp};
		}

		throw 'Received http code ' + res.statusCode;
	},

	getAccessToken: async function(app, refresh_token) {
		let access_token = await app.redis.get(`evesso:access_token:${refresh_token}`);
		if (access_token) return access_token;

		let opts = {
			url: process.env.EVE_Token_URL,
			followRedirects: true,
			form: {grant_type: 'refresh_token', 'refresh_token': refresh_token},
			method: 'POST',
			headers: {
	        	'Authorization': authorization,
	        	'Content-Type': 'application/x-www-form-urlencoded',
	        	'User-Agent': process.env.USER_AGENT
	      	}
		};

		let res = await app.phin(opts);
		if (res.statusCode == 200) {
			let json = JSON.parse(res.body);
			let access_token = json.access_token;

			await app.redis.setex(`evesso:access_token:${refresh_token}`, json.expires_in - 1, access_token);

			return access_token;
		}

		throw 'Received http code ' + res.statusCode;
	},

	getEsiCall: async function(app, url, access_token, etag, method = 'GET') {
		let opts = {
			url: url,
			followRedirects: true,
			method: method,
			headers: {
	        	'Authorization': 'Bearer ' + access_token,
	        	'User-Agent': process.env.USER_AGENT
	      	}
		};

		let res = await app.phin(opts);
		if (res.statusCode == 200) return JSON.parse(res.body);

		throw 'Received http code ' + res.statusCode;
	}
}

function b64DecodeUnicode(str) {
 	return decodeURIComponent(Array.prototype.map.call(atob(str),(c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)).join(''));
 }

function parseJwt(jwt) {   
  try {
    return JSON.parse(b64DecodeUnicode(jwt.split('.')[1].replace('-', '+').replace('_', '/')));
  } catch (e) {
    return null;
  }
};