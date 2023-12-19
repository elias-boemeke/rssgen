# rssgen
**rssgen** is a NodeJS server application for self-hosting an rss-feed-generator.
Currently supported websites include:
1. `https://rumble.com` - `https://<selfhost.server>/rssgen/rumble/<channel>`
2. `https://banned.video` - `https://<selfhost.server>/rssgen/banned-video/<channel>`

> Originally inspired by: <https://github.com/alexandersokolow/rss-gen>

## Installation
Assuming you have set up a server with git and npm, as well as a webserver with proxy_pass from port 3000 to 80:
1. transfer the project's source code to your server: `git clone https://github.com/elias-boemeke/rssgen.git`
2. install the required node modules: `cd rssgen/app && npm install`
3. install pm2 globally for easier process management: `npm install pm2 -g`
4. make the app run in production mode in the background: `npm run production`
5. make the app run indefinitely: `pm2 save && pm2 startup`

> Recommended user stack: debian/nginx/nodejs -> newsboat

### Troubleshooting
If you run into issues with puppeteer, take a look at these resources:
- [https://github.com/puppeteer/puppeteer](https://github.com/puppeteer/puppeteer "puppeteer on github")
- [https://pptr.dev/troubleshooting](https://pptr.dev/troubleshooting "puppeteer troubleshooting site")

## Development
To add your own favourite website to the list of supported sites, create a handler in `app/handlers`.
The name of the file will be the part in the url for queries.

The only requirements for a handler are exporting the code for app.js
```
module.exports = async function(target) {
	// your code
};
```
and the format of the return value to be of form like in the file `app/rssgen_format.txt`;
