// imports
const xml = require('xml');

// exports
module.exports = {
    rss_to_xml: rss_to_xml,
    formatXml: formatXml,
};

function rss_to_xml(rss) {
    // private function to structure items
    let structure_items = function(items) {
        if (items == null) {
            return [];
        }
        return items.map(item => ({
            'item': [
                {
                    'title': item.title,
                },
                {
                    'link': item.link,
                },
                {
                    'pubDate': getRFC822Date(item.pubDate),
                },
                {
                    'guid': item.link,
                },
                {
                    'description': item.description,
                },
            ],
        }));
    };

    // create the feed object
    let feedObject = {
        'rss': [
            {
                _attr: {
                    'version': '2.0',
                    'xmlns:atom': 'http://www.w3.org/2005/Atom',
                },
            },
            {
                'channel': [
                    {
                        'title': rss.channel.title,
                    },
                    {
                        'link': rss.channel.link,
                    },
                    {
                        'description': rss.channel.description,
                    },
                    {
                        'language': rss.channel.language,
                    },
                    {
                        'atom:link': {
                                _attr: {
                                    //'href': 'selfhost.server/index.xml',
                                    'rel': 'self',
                                    'type': 'application/rss+xml',
                                },
                            },
                    },
                    ...structure_items(rss.items),
                ],
            },
        ],
    };
    // return the xml
    return xml(feedObject);
}

function formatXml(xml, tab) { // tab = optional indent value, default is tab (\t)
    var formatted = '', indent= '';
    tab = tab || '\t';
    xml.split(/>\s*</).forEach(function(node) {
        if (node.match(/^\/\w/)) indent = indent.substring(tab.length); // decrease indent by one 'tab'
        formatted += indent + '<' + node + '>\r\n';
        if (node.match(/^<?\w[^>]*[^\/]$/)) indent += tab;              // increase indent
    });
    return formatted.substring(1, formatted.length-3);
}

function getRFC822Date(date) {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    
    const d = new Date(date);
    
    const day = days[d.getUTCDay()];
    const month = months[d.getUTCMonth()];
    const dayOfMonth = String(d.getUTCDate()).padStart(2, '0');
    const year = d.getUTCFullYear();
    const hours = String(d.getUTCHours()).padStart(2, '0');
    const minutes = String(d.getUTCMinutes()).padStart(2, '0');
    const seconds = String(d.getUTCSeconds()).padStart(2, '0');
    
    return `${day}, ${dayOfMonth} ${month} ${year} ${hours}:${minutes}:${seconds} GMT`;
}
    