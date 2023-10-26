const puppeteer = require('puppeteer');
const fs = require('fs');

const crawl = require('../app/crawl.js');

(async () => {

    const url = '';
    const output_file = 'html/file.html';
    
    console.log(`URL ${url}`);
    const html = await crawl.crawl_url(url, {method: 'axios'});
    
    fs.writeFileSync(output_file, html);

})();

