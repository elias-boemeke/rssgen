// imports
const axios = require('axios');
const puppeteer = require('puppeteer');
const fs = require('fs');
const random_useragent = require('random-useragent');
const puppeteer_extra = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

puppeteer_extra.use(StealthPlugin());

// exports
module.exports = {
    crawl_url: crawl_url,
	get_puppeteer_browser: get_puppeteer_browser,
	get_puppeteer_stealth_browser: get_puppeteer_stealth_browser,
    match_cache: match_cache,
    write_cache: write_cache,
};

// constants
const c_gray = '\x1b[90m%s\x1b[0m';

async function sleep(ms) {
    await new Promise(resolve => { return setTimeout(resolve, ms); });
}

// takes url
// return html associated with the url
async function crawl_url(url, options) {
	if (process.env.DEBUG) {
		console.log(`URL crawling ${url}`);
	}

    const funs = [
        ['axios', crawl_axios],
		['puppeteer_default', crawl_puppeteer_default],
		['puppeteer_useragent', crawl_puppeteer_useragent],
		['puppeteer_stealth', crawl_puppeteer_stealth],
    ];
    
    if (options && options.method) {
		for (let element of funs) {
			if (options.method === element[0]) {
				if (element[0].includes('puppeteer')) {
					// execute crawl function
					return await element[1](url, options.browser);
				} else {
					if (options.delay) { await sleep(options.delay); }
					// execute crawl function
					return await element[1](url);
				}
			}
		}
    }
	let customError = new Error('crawl_url() called without an approved options.method.');
	// customError.code = 'CUSTOM_ERROR_CODE';
    throw customError;
}

// simple axios get
async function crawl_axios(url) {
    const response = await axios.get(url);
	return response.data;
}

// #############################
// #####     puppeteer     #####
// #############################

async function get_puppeteer_browser() {
	let browser = await puppeteer.launch({args: ['--no-sandbox', '--disable-setuid-sandbox'], headless: 'new'});
	return browser;
}

async function get_puppeteer_stealth_browser() {
	// https://stackoverflow.com/questions/55678095/bypassing-captchas-with-headless-chrome-using-puppeteer?rq=4
	let browser = await puppeteer_extra.launch({
		headless: 'new',
		devtools: false,
		ignoreHTTPSErrors: true,
		slowMo: 0,
		args: ['--disable-gpu','--no-sandbox','--no-zygote','--disable-setuid-sandbox','--disable-accelerated-2d-canvas','--disable-dev-shm-usage', "--proxy-server='direct://'", "--proxy-bypass-list=*"],
	});

	return browser;
}

// puppeteer do most trivial crawl
async function crawl_puppeteer_default(url, external_browser) {
	let browser = external_browser || await get_puppeteer_browser();
	let page = await browser.newPage();
	await page.goto(url, {waitUntil: 'networkidle2'});
	const html = await page.content();
	if (!external_browser) {
		await browser.close();
	}
	return html;
}

// puppeteer asign a random useragent
async function crawl_puppeteer_useragent(url, external_browser) {
	let browser = external_browser || await get_puppeteer_browser();
	let page = await browser.newPage();
	const user_agent = random_useragent.getRandom();
	await page.setUserAgent(user_agent);
	await page.goto(url, {waitUntil: 'networkidle2'});
	const html = await page.content();
	if (!external_browser) {
		await browser.close();
	}
	return html;
}

// puppeteer use full arsenal of stealthing options
async function crawl_puppeteer_stealth(url, external_browser) {
	let browser = external_browser || await get_puppeteer_stealth_browser();
	const user_agent = random_useragent.getRandom();
    let page = await browser.newPage();

	// https://stackoverflow.com/questions/55678095/bypassing-captchas-with-headless-chrome-using-puppeteer?rq=4

    // Randomize viewport size
    await page.setViewport({
        width: 1920 + Math.floor(Math.random() * 100),
        height: 3000 + Math.floor(Math.random() * 100),
        deviceScaleFactor: 1,
        hasTouch: false,
        isLandscape: false,
        isMobile: false,
    });

    await page.setUserAgent(user_agent);
    await page.setJavaScriptEnabled(true);
    await page.setDefaultNavigationTimeout(0);

    // Skip images/styles/fonts loading for performance
    await page.setRequestInterception(true);
    page.on('request', (req) => {
        if (req.resourceType() == 'stylesheet' || req.resourceType() == 'font' || req.resourceType() == 'image') {
            req.abort();
        } else {
            req.continue();
        }
    });

    await page.evaluateOnNewDocument(() => {
        // Pass webdriver check
        Object.defineProperty(navigator, 'webdriver', {
            get: () => false,
        });
    });

    await page.evaluateOnNewDocument(() => {
        // Pass chrome check
        window.chrome = {
            runtime: {},
            // etc.
        };
    });

    await page.evaluateOnNewDocument(() => {
        //Pass notifications check
        const originalQuery = window.navigator.permissions.query;
        return window.navigator.permissions.query = (parameters) => (
            parameters.name === 'notifications' ?
                Promise.resolve({ state: Notification.permission }) :
                originalQuery(parameters)
        );
    });

    await page.evaluateOnNewDocument(() => {
        // Overwrite the `plugins` property to use a custom getter.
        Object.defineProperty(navigator, 'plugins', {
            // This just needs to have `length > 0` for the current test,
            // but we could mock the plugins too if necessary.
            get: () => [1, 2, 3, 4, 5],
        });
    });

    await page.evaluateOnNewDocument(() => {
        // Overwrite the `languages` property to use a custom getter.
        Object.defineProperty(navigator, 'languages', {
            get: () => ['en-US', 'en'],
        });
    });

    await page.goto(url, {waitUntil: 'networkidle2', timeout: 0});
	const html = await page.content();
	if (!external_browser) {
		await browser.close();
	}
	return html;
}

// #############################
// ######     caching     ######
// #############################

// checks if item was cached and if yes -> return cached item
// match item using the keys in props
// unmatching items do not count as cached -> is_cached = false
// returns Boolean is_cached, Object cached_item
function match_cache(cachedir, url, item, props) {
	log_on_debug(`CACHE reading ${url}`);
	const filename = url.replace(/[:/]/g, '');
	const filepath = `${cachedir}/${filename}`;
	if (!fs.existsSync(filepath)) {
		log_on_debug(`CACHE item not found ${url}`);
		return [false, null];
	}
	const file_content = fs.readFileSync(filepath, 'utf8');
	const ci = JSON.parse(file_content);
	if (props.every(prop => item[prop] === ci[prop])) {
		return [true, ci];
	}
	log_on_debug(`CACHE item found but mismatched ${url}`);
	return [false, null];
}

// write item to cache in JSON format
function write_cache(cachedir, url, item) {
	log_on_debug(`CACHE writing ${url}`);
	const filename = url.replace(/[:/]/g, '');
	const dirpath = cachedir;
	const filepath = `${dirpath}/${filename}`;
	if (!fs.existsSync(dirpath)) {
		fs.mkdirSync(dirpath, { recursive: true });
	}
	fs.writeFileSync(filepath, JSON.stringify(item));
}

function log_on_debug(msg) {
	if (process.env.DEBUG === 'on') {
		console.log(c_gray, msg);
	}
}
