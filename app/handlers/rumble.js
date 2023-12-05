// imports
const cheerio = require('cheerio');

const crawl = require('../crawl.js');

// export
module.exports = async function(target) {
	return await compose(target);
};

// CONSTANTS
const cache_dir = '.cache/rumble';

// package rss object
async function compose(target) {
	// put in invariant properties
	let rss = {
		channel: {
			language: 'en-us',
		},
	};

	const url_main = `https://rumble.com/c/${target}`;
	const url_about = `${url_main}/about`;
	const url_alt = `https://rumble.com/user/${target}`;

	let html_main;
	let html_about;
	let html_alt;
	let alt_mode = false;

	// try to use url_main https://rumble.com/c/<channel>
	// alternatively switch to url_alt https://rumble.com/user/<channel>
	try {
		html_main = await crawl.crawl_url(url_main, {method: 'axios'});
	} catch (error) {
		if (error.response && error.response.status === 404) {
			alt_mode = true;
		} else {
			throw error;
		}
	}

	let video_listing_entrys;
	if (alt_mode) {
		html_alt = await crawl.crawl_url(url_alt, {method: 'axios'});
		const info_alt = extract_altpage(html_alt);

		rss.channel.title = info_alt.title;
		rss.channel.link = url_alt;
		video_listing_entrys = info_alt.video_listing_entrys;
	} else {
		// remember html_main had succeeded
		html_about = await crawl.crawl_url(url_about, {method: 'axios'});
		const info_main = extract_mainpage(html_main);
		const info_about = extract_aboutpage(html_about);
		
		rss.channel.title = info_main.title;
		rss.channel.link = url_main;
		rss.channel.description = info_about.description;
		video_listing_entrys = info_main.video_listing_entrys;
	}

	// now extract info about the videos
	let promises = [];
	for (let element of video_listing_entrys) {
		promises.push(compose_item(element));
	}
	let items = await Promise.all(promises);
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
		const props = ['title', 'link', 'pubDate'];
		const [is_cached, ci] = crawl.match_cache(cache_dir, url, item, props);
		if (is_cached) {
			return ci;
		}
	}

	const html = await crawl.crawl_url(url, {method: 'axios'});
	const info = extract_videopage(html);
	const st = video_listing_entry.status;
	const description_header = st === 'upcoming' ? 'Upcoming Video' : (st === 'live' ? 'Live Show' : `Duration: ${video_listing_entry.duration}`);
	item.description = `${description_header}<br><br>${info.description}`;

	// provided caching/write is on -> write to cache
	// if the video is upcoming/live, then don't write to cache
	if (video_listing_entry.status === 'archived' && process.env.CACHING === 'readwrite') {
		crawl.write_cache(cache_dir, url, item);
	}

	return item;
}

// #####################################
// ###   html extraction functions   ###
// #####################################

function extract_mainpage(html) {
	return extract_channel(html, 'channel-header--title-wrapper');
}

function extract_aboutpage(html) {
	let info = {
		description: '',
	};
	let $ = cheerio.load(html);
	// [channel] description
	info.description = $('.channel-about--description > p').text();
	return info;
}

function extract_altpage(html) {
	return extract_channel(html, 'listing-header--title');
}

function extract_channel(html, title_class) {
	let info = {
		title: '',
		video_listing_entrys: [],
	};
	let $ = cheerio.load(html);
	// [channel] title
	info.title = $(`.${title_class} > h1`).text();
	// [items] link, *duration, title, pubDate, *status
	const vles = $('.video-listing-entry').map((_, element) => {
		let status = 'archived';
		if ($(element).find('.video-item--upcoming').length > 0) {
			status = 'upcoming';
		} else if ($(element).find('.video-item--live').length > 0) {
			status = 'live';
		}
		// put together the items
		let vle = {
			'link': `https://rumble.com${$(element).find('.video-item .video-item--a').attr('href')}`,
			'duration': $(element).find('.video-item .video-item--a .video-item--duration').attr('data-value'),
			'title': $(element).find('.video-item .video-item--info .video-item--title').text(),
			'pubDate': $(element).find('.video-item .video-item--info .video-item--meta.video-item--time').attr('datetime'),
			'status': status,
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
	if ($('.container.content.media-description').length === 0) {
		// if there is no description, set ''
		info.description = '';
		return info;
	}
	let media_description_clone = $('.container.content.media-description').clone();
	media_description_clone.find('.media-description--show-button').remove();
	media_description_clone.find('.media-description--hide-button').remove();
	info.description = media_description_clone.html();
	return info;
}
