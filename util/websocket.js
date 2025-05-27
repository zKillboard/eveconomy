'use strict';

let app;
module.exports = function (_app) {
	app = _app;
	setTimeout(initialize, 1);
}

function initialize() {
	return;
	if (process.env.WEBSOCKET_LOAD != 'true') return;

	if (typeof app.express == 'undefined' || typeof app.websocket == 'undefined') return setTimeout(initialize, 1000);

	const redis = app.createRedisClient();
	const redis2 = app.createRedisClient();

	redis.on("pmessage", (pattern, channel, message) => {
		let count = 0;
		app.websocket.connections.forEach( (connection) => {
			let broadcasted = false;
			if (connection.subscriptions instanceof Array) {
				if (broadcasted === false && connection.subscriptions.indexOf(channel) !== -1) {
					connection.send(message);
					count++;
					broadcasted = true;
				}
			}
		});
	});
	redis.psubscribe("*");

	app.websocket.on('connect', (connection) => {
		connection.send(JSON.stringify({action: 'started', started: app.server_started}));
		connection.on('message', function(message) {
			if (message.type === 'utf8') {
				try {
					let data = JSON.parse(message.utf8Data);
					if (connection.subscriptions === undefined) connection.subscriptions = new Array();
					if (data.action === 'sub') {
						let index = connection.subscriptions.indexOf(data.channel);
						if (index == -1) {
							connection.subscriptions.push(data.channel);
						}
					}
					else if (data.action === 'unsub') {
						let index = connection.subscriptions.indexOf(data.channel);
						if (index > -1) {
							connection.subscriptions.splice(index, 1);
						}
					}
				} catch (e) {
				};
			}
		});    
	});
}