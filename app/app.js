// basics to make the application work
const express = require('express')
const app = express()
const port = 3000

// static imports
const rssgen = require('./rssgen.js');

// CONSTANTS
const GOOD = true;
const BAD = false;

function logError(err) {
    // debug errors
	console.log(error);
    console.log(`[ERR] errorcode: ${err.code}`);
}

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
			res.send(rssgen.formatXml(msg));
		} else {
			let showexample = `\n\nPlease read the examples in README.md (in the git repo) to ensure the request is valid.`;
			res.setHeader('Content-Type', 'text/plain');
			res.send(msg + showexample);
		}

	} catch (error) { // global error handling
		console.log(error);
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

	// get the items by crawling the site formatted as:
	// rss: {
	// 		channel: {
	//	 		title:
	//	 		link:
	//			description:
	//			language:
	//		}
	//		items: [
	//			{
	//				title:
	//				link:
	//				pubDate:
	//				description:
	//			},
	//			...	
	//		]
	// }
	let rss;
	try {
		let handlerFunction = require(`./handlers/${handle}.js`);
		rss = await handlerFunction(arg);
		
		if (rss == null || rss.channel == null) {
			responseStr = `Insufficient response from handler. Aborting. Bye.`;
			return [BAD, responseStr];
		}

	} catch (error) {
		if (error.code === 'MODULE_NOT_FOUND') {
			responseStr = `Request not supported - No handler. Aborting. Bye.`;
		} else if (error.code === 'ERR_BAD_REQUEST') {
			responseStr = `Request failed. Please ensure the requested channel name exists. Aborting. Bye.`;
		} else {
			logError(error);
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
app.listen(port, () => {
	console.log(`rssgen app listening on port ${port}`);
});

