// imports
const express = require('express');

const dotenv = require('dotenv');
const environment = process.env.NODE_ENV || 'development';
dotenv.config({path: `.env.${environment}`});

// rssgen import
const rssgen = require('./rssgen.js');

// result of the user-query
const GOOD = true;
const BAD = false;

function logError(err) {
    // debug errors
	console.log(err);
    console.log(`[ERR] errorcode: ${err.code}`);
}

// create the server
const app = express();
// main process
app.get('*', async (req, res) => {
	try {
		// split the request url into pieces
		// filter out empty strings
		// and take the first element of ['rssgen', ...] out
		let reqspl = req.originalUrl.split('/').filter(Boolean).slice(1);

		const [ok, msg] = await handle_request(reqspl);

		if (ok) {
			//res.setHeader('Content-Type', 'application/rss+xml');
			res.setHeader('Content-Type', 'text/xml');
			res.send(rssgen.prettify_xml(msg));
		} else {
			let showexample = `\n\nPlease read the examples in README.md (in the git repo) to ensure the request is valid.`;
			res.setHeader('Content-Type', 'text/plain');
			res.send(msg + showexample);
		}

	} catch (error) { // global error handling
		logError(error);
		res.setHeader('Content-Type', 'text/plain');
		res.send(`Oops. Something went wrong.  (・_・)`);
	}
});

// process requests
async function handle_request(reqspl) {
	let responseStr = '(^-^)';

	// [handle, arg....]
	if (reqspl.length < 2) {
		responseStr = `Empty request. Nothing to do. Bye.`;
		return [BAD, responseStr];
	}

	// define work variables
	let handle = reqspl[0];
	let arg = reqspl.slice(1).join('/');

	// get the items by crawling the site formatted as specified in rssgen_format.txt
	let rss;
	try {
		let handlerFunction = require(`./handlers/${handle}.js`);
		rss = await handlerFunction(arg);
		
		if (rss == null || rss.channel == null) {
			responseStr = `Insufficient response from handler. Aborting. Bye.`;
			return [BAD, responseStr];
		}

	} catch (error) {
		if (process.env.DEBUG === 'on') { // this is error logging for development
			logError(error);
		}

		if (error.code === 'MODULE_NOT_FOUND') {
			responseStr = `Request not supported - No handler. Aborting. Bye.`;
		} else if (error.code === 'ERR_BAD_REQUEST') {
			responseStr = `Request failed. Please ensure the requested channel name exists. Aborting. Bye.`;
		} else {
			if (process.env.DEBUG === 'off') { // this is error logging for production
				logError(error)
			}
			responseStr = `Unknown Error. Aborting. Bye.`;
		}
		// finalize
		return [BAD, responseStr];
	}

	// check the validity of the rss
	if (rss == null || rss == '') {
		responseStr = `Handler failed. 'rss' comes empty. Aborting. Bye.`;
		return [BAD, responseStr];
	}

	// format the data into RSS-xml format and serve to the user
	let rss_xml = rssgen.rss_to_xml(rss);
	return [GOOD, rss_xml];
	
} // end of the main process

// start the app
app.listen(process.env.PORT, () => {
	console.log(`rssgen app listening on port ${process.env.PORT}`);
	process.stdout.write(`operational mode: `);
	const c_red = '\x1b[31m%s\x1b[0m';
	if (environment === 'development') {
		console.log(c_red, `${environment}`);
	} else {
		console.log(`${environment}`);
	}
});

