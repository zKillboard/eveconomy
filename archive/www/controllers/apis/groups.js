'use strict';

module.exports = {
   paths: ['/api/groups'],
   get: get
}

async function get(req, res, app) {
	try {
		//if (initialized == false) await init(app);
		let epoch = app.server_started;

		let valid = {
			required: ['epoch'],
			epoch: epoch
    	}
    	valid = valid = req.verify_query_params(req, valid);
    	if (valid !== true) return {redirect: valid};

		let doc;
		do {
			doc = await app.db.keyvalues.findOne({key: 'groups'});
			if (doc == null) await app.sleep(2500);
		} while (doc == null);
	    
	   return {json: doc.value};
	} catch (e) {
		console.log(e);
	}
}

