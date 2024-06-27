// imports
const cheerio = require('cheerio');

const crawl = require('../crawl.js');

// export
module.exports = async function(target) {
	return await compose(target);
};

// CONSTANTS
const cache_dir = '.cache/rumble';

async function crawl_rumble(url) {
	// return await crawl.crawl_url(url, {method: 'axios', delay: '2000'});
	return await crawl.crawl_url(url, {method: 'puppeteer_stealth'})
}

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
		html_main = await crawl_rumble(url_main);
	} catch (error) {
		if (error.response && error.response.status === 404) {
			alt_mode = true;
		} else {
			throw error;
		}
	}
	// check for puppeteer alt mode
	if (cheerio.load(html_main)('.channel-header--title-wrapper').length == 0) {
		alt_mode = true;
	}

	let videostream_entrys;
	if (alt_mode) {
		html_alt = await crawl_rumble(url_alt);
		// const info_alt = extract_altpage(html_alt);
		// api got changed and is consistent with new channels now
		const info_alt = extract_mainpage(html_alt);

		rss.channel.title = info_alt.title;
		rss.channel.link = url_alt;
		rss.channel.description = '';
		videostream_entrys = info_alt.videostream_entrys;
	} else {
		// remember html_main has succeeded
		html_about = await crawl_rumble(url_about);
		const info_main = extract_mainpage(html_main);
		const info_about = extract_aboutpage(html_about);
		
		rss.channel.title = info_main.title;
		rss.channel.link = url_main;
		rss.channel.description = info_about.description;
		videostream_entrys = info_main.videostream_entrys;
	}

	// now extract info about the individual videostreams
	let items = [];
	for (let element of videostream_entrys) {
		items.push(await compose_item(element));
	}
	// sort items
	items.sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate));
	// put items into rss
	rss.items = items;
	
	return rss;
}

async function compose_item(videostream_entry) {
	// remember: a videostream_entry contains: link, *duration, title, pubDate, *status
	const url = videostream_entry.link;
	let item = {
		'title': videostream_entry.title,
		'link': url,
		'pubDate': videostream_entry.pubDate,
		'description': '',
	};
	
	// check for item in cache
	if (['readwrite', 'readonly'].includes(process.env.CACHING)) {
		const props = ['title', 'link', 'pubDate'];
		const [is_cached, ci] = crawl.match_cache(cache_dir, url, item, props);
		if (is_cached) {
			return ci;
		}
	}

	const html = await crawl_rumble(url);
	const info = extract_videostreampage(html);
	const st = videostream_entry.status;
	const description_header = st === 'upcoming' ? 'Upcoming Video' :
							(st === 'live' ? 'Live Show' :
							(st === 'dvr' ? 'DVR (postprocessing)' :
							`Duration: ${videostream_entry.duration}`));
	item.description = `${description_header}<br><br>${info.description}`;

	// provided caching/write is on -> write to cache
	// if the video is upcoming/live/dvr, then don't write to cache
	if (videostream_entry.status === 'archived' && process.env.CACHING === 'readwrite') {
		crawl.write_cache(cache_dir, url, item);
	}

	return item;
}


// #####################################
// ###   html extraction functions   ###
// #####################################

// HINT: in cheerio selection, space means 'or' and chained dot means 'and'

function extract_altpage(html) {
	let info = {
		title: '',
		video_listing_entrys: [],
	};
	let $ = cheerio.load(html);
	// [channel] title
	info.title = $('.listing-header--title').text();
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

function extract_mainpage(html) {
	let info = {
		title: '',
		videostream_entrys: [],
	};
	let $ = cheerio.load(html);
	// [channel] title
	info.title = $('.channel-header--title-wrapper > h1').text();
	// [items] link, *duration, title, pubDate, *status
	const thumbnailgrid = $('.thumbnail__grid');
	const vles = thumbnailgrid.find('.videostream.thumbnail__grid--item').map((_, element) => {
		let status = 'archived';
		if ($(element).find('.videostream__status--upcoming').length > 0) {
			status = 'upcoming';
		} else if ($(element).find('.videostream__status--live').length > 0) {
			status = 'live';
		} else if ($(element).find('.videostream__status--dvr').length > 0) {
			status = 'dvr';
		}
		// put together the items
		let vle = {
			'link': `https://rumble.com${$(element).find('.videostream__link.link').attr('href')}`,
			'duration': $(element).find('.videostream__badge.videostream__status.videostream__status--duration').text(),
			'title': $(element).find('.thumbnail__title.line-clamp-2').text(),
			'pubDate': $(element).find('.videostream__data--subitem.videostream__time').attr('datetime'),
			'status': status,
		};
		return vle;
	}).get();
	info.videostream_entrys = vles;

	return info;
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

function extract_videostreampage(html) {
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
