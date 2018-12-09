const { URL } = require('url');
const rp = require('request-promise');
const jsdom = require('jsdom');
const Entities = require('html-entities').AllHtmlEntities;

const TIMEOUT = 10000;
const USERAGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/71.0.3578.98 Safari/537.36';

const cleanString = (str) => {
    if (!str) {
        return undefined;
    }
    str = str.trim();
    str = str.replace(/\r?\n|\r|\t/g, '');

    const entities = new Entities();
    str = entities.decode(str);

    return str;
};

class WebService {

    constructor() {
    }

    /**
     * Checks if the string provided is a URL.
     * @param url
     * @return {boolean}
     */
    isValidUrl(url) {
        let u = url.toLowerCase();
        return u.startsWith('http://') || u.startsWith('https://');
    }

    /**
     * Returns the hostname part of a URL
     * @param url
     * @return {string}
     */
    getHostName(url) {
        try {
            let myUrl = new URL(url);
            return myUrl.hostname;
        } catch (e) {}
    }


    /**
     * Downloads a web page an returns a promise containing the HTML body
     * @param url
     * @return {promise}
     */
    download(url, isGzip = false) {
        return rp({
            url: url,
            timeout: TIMEOUT,
            headers: {'User-Agent': USERAGENT, Accept: '*/*', },
            jar: rp.jar(),
            gzip: isGzip,
            
        });
    }

    /**
     * Downloads a web page and returns a promise containing the web page's title
     * @param url
     * @returns {promise}
     */
    downloadTitle(url, isGzip = false) {
        return this.download(url, isGzip).then(function (html) {
            const {JSDOM} = jsdom;
            const dom = new JSDOM(html);
            const tdom = dom.window.document.querySelector("title");
            if (!dom || !tdom) {
                return "";
            }
            let title = tdom.innerHTML;
            title = cleanString(title);
            return title;
        });
    }

    jquery(html) {
        const {JSDOM} = jsdom;
        const dom = new JSDOM(html);
        const $ = (require('jquery'))(dom.window);

        return $;
    }

    cleanString(str) {
        return cleanString(str);
    }
}

export default WebService;