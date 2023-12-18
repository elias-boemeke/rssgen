const cheerio = require('cheerio');
const fs = require('fs');
const moment = require('moment');

const testfile = 'html/file.html';
const html = fs.readFileSync(testfile, 'utf-8');

let $ = cheerio.load(html);
