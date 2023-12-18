// imports
const cheerio = require('cheerio');
const moment = require('moment');

const crawl = require('../crawl.js');

// export
module.exports = async function(target) {
	return await compose(target);
};

// CONSTANTS
const cache_dir = '.cache/banned-video';

// package rss object
async function compose(target) {
	// put in invariant properties
	let rss = {
		channel: {
			language: 'en-us',
		},
	};

	const url = `https://banned.video/channel/${target}`;

	const html = await crawl.crawl_url(url, {method: 'puppeteer_stealth'});
	const info = extract_channel(html);

	rss.channel.title = info.title;
	rss.channel.link = url;
	rss.channel.description = info.description;
	const video_listing_entrys = info.video_listing_entrys;

	// now extract info about the videos / synchronous
	let items = [];
	for (let element of video_listing_entrys) {
		let r = await compose_item(element); // actually wait for the result to arrive
		items.push(r);
	}
	// sort items
	items.sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate));
	// put items into rss
	rss.items = items;
	
	return rss;
}

async function compose_item(video_listing_entry) {
	const url = video_listing_entry.link;
	let item = {
		'title': video_listing_entry.title,
		'link': url,
		'pubDate': video_listing_entry.pubDate,
	};

	// check for item in cache
	if (['readwrite', 'readonly'].includes(process.env.CACHING)) {
		const props = ['title', 'link'];
		const [is_cached, ci] = crawl.match_cache(cache_dir, url, item, props);
		if (is_cached) {
			return ci;
		}
	}

	const html = await crawl.crawl_url(url, {method: 'puppeteer_stealth'});
	const info = extract_videopage(html);
	const description_header = `Duration: ${video_listing_entry.duration}`;
	item.description = `${description_header}<br><br>${info.description}`;

	// provided caching/write is on -> write to cache
	// if the video is upcoming/live, then don't write to cache
	if (process.env.CACHING === 'readwrite') {
		crawl.write_cache(cache_dir, url, item);
	}

	return item;
}

// #####################################
// ###   html extraction functions   ###
// #####################################

function extract_channel(html) {
	let info = {
		title: '',
		description: '',
		video_listing_entrys: [],
	};
	let $ = cheerio.load(html);
	// [channel] title
	info.title = $('.css-hpai52').text();
	// [channel] description
	const boxclone = $('.css-hpai52').parent().clone();
	boxclone.find('.css-hpai52').remove();
	info.description = boxclone.text().replace(/\s+/g, ' ');
	// [items] link, *duration, title, pubDate
	// const vles = $('.css-3nvfyc').map((_, element) => { // for puppeteer_useragent
	const vles = $('.css-19uxrib').map((_, element) => {
		let vle = {
			'link': `https://banned.video${$(element).find('> a').attr('href')}`,
			'duration': $(element).find('.css-ptuw1s').text(),
			'title': $(element).find('.css-1h0cpt4').text().replace(/\s+/g, ' '),
			'pubDate': moment().subtract(to_moment_duration($(element).find('.css-12axsrb').text())).toString(),
		};
		return vle;
	}).get();
	info.video_listing_entrys = vles;

	return info;
}

function extract_videopage(html) {
	let info = {
		description: '',
	};
	let $ = cheerio.load(html);
	// [items] description
	const description = $('.css-jgvb17').html();
	info.description = description;
	return info;
}

// convert a banned.video video release time to moment duration
// i.e. '2 days ago' -> {days: '2'}
function to_moment_duration(timeago) {
    const conversionMap = {
        'second': 'seconds',
        'minute': 'minutes',
        'hour': 'hours',
        'day': 'days',
        'year': 'years',
    };
    const valueMatch = timeago.match(/(\d+|a|an)/);
    const unitMatch = timeago.match(/(second|minute|hour|day|year)s?/);

    const value = valueMatch[0] === 'a' || valueMatch[0] === 'an' ? 1 : parseInt(valueMatch[0], 10);
    const unit = conversionMap[unitMatch[1]];
    return moment.duration({[unit]: value});
}

