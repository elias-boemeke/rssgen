// imports
const axios = require('axios');
const cheerio = require('cheerio');

// export
module.exports = async function(target) {
	return await compose(target);
};

// CONSTANTS
const CACHING = 'on'; // 'on' <-> 'off'

// package rss object
async function compose(target) {
	// put in invariant properties
	let rss = {
		channel: {
			language: 'en-us',
		},
	};

	let url = `https://rumble.com/c/${target}`;
	let url_about = `${url}/about`;
	
	// main page
	let response = await axios.get(url);
	let html = response.data;

	let $ = cheerio.load(html);
	rss.channel.title = $('.channel-header--title-wrapper').text();
	rss.channel.link = url;

	// individual video pages
	let vles = $('.video-listing-entry').map((_, element) => {
		let vle = {
			'link': `https://rumble.com${$(element).find('.video-item .video-item--a').attr('href')}`,
			'duration': $(element).find('.video-item .video-item--a .video-item--duration').attr('data-value'),
			'pubDate': $(element).find('.video-item .video-item--info .video-item--meta.video-item--time').attr('datetime'),
			'title': $(element).find('.video-item .video-item--info .video-item--title').text(),
			//'views': $(element).find('.video-item .video-item--info .video-item--footer .video-counters .video-counters--item.video-item--views').text(),
		};
		return vle;
	}).get();
	// begin crawl
	let promises = [];
	vles.forEach(element => {
		promises.push(compose_item(element));
	});
	let items = await Promise.all(promises);
	// sort items
	items.sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate));
	// put items into rss
	rss.items = items;

	// about page
	response = await axios.get(url_about);
	html = response.data;
	$ = cheerio.load(html);
	rss.channel.description = $('.channel-about--description > p').text();

	return rss;
}

async function compose_item(video_listing_entry) {
	const url = video_listing_entry.link;
	let item = {
		'title': video_listing_entry.title,
		'link': url,
		'pubDate': video_listing_entry.pubDate,
	};

	let response = await axios.get(url);
	let html = response.data;

	let $ = cheerio.load(html);
	const container = $('.container.content.media-description');
	const firstDescription = container.find('.media-description.media-description--first').text();
	const moreDescriptions = container.find('.media-description.media-description--more').map((_, element) => $(element).text()).get();
	item.description = `Duration: ${video_listing_entry.duration}\n\n${firstDescription}\n\n${moreDescriptions.join('\n\n')}`;

	return item;
}

// TODO
// write_cache and match_cache functions