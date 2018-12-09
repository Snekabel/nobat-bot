import WebService from '../../WebService'
import {formatNumber} from '../../lib'

const SUPPORTED_DOMAINS = {
    m_blocket_se: 'm.blocket.se',
    www_blocket_se: 'www.blocket.se',
    www_webhallen_com: 'www.webhallen.com',
    www_inet_se: 'www.inet.se',
    www_tradera_com: 'www.tradera.com',
    www_kjell_com: 'www.kjell.com',
    www_clasohlson_com: 'www.clasohlson.com',
    www_biltema_se: 'www.biltema.se',
    www_komplett_se: 'www.komplett.se',
    www_twostroke_se: 'www.twostroke.se'
};

class PriceTitleService {

    constructor() {
        this.webService = new WebService();
    }

    supportsAction(input, channel, service) {
        let hostname = this.webService.getHostName(input);
        for (var key in SUPPORTED_DOMAINS) {
            if (hostname === SUPPORTED_DOMAINS[key]) {
                return true;
            }
        }
        return false;
    }

    trigger(input, channel, service) {
        if (!this.supportsAction(input, channel, service)) {
            return;
        }
        input = this.replaceUrl(input);
        this.webService.download(input, true)
            .then(function (data) {
                this.handleDomain(input, channel, service, data);
            }.bind(this));
    }

    replaceUrl(url) {
        if (url.startsWith('https://m.blocket.se')) {
            return url.replace('https://m.blocket.se', 'https://www.blocket.se');
        }
        return url;
    }

    handleDomain(input, channel, service, data) {
        let $ = this.webService.jquery(data);
        let title = $("title:first").text();
        title = this.webService.cleanString(title);
        let hostname = this.webService.getHostName(input);
        switch (hostname) {

            case SUPPORTED_DOMAINS.www_tradera_com:
                (() => {
                    let fixedPrice = $(".view-item-fixed-price");
                    if (fixedPrice.length !== 0) {
                        fixedPrice = fixedPrice.text().trim();
                        service.say(`Title: ${title}. Price: ${fixedPrice}.`, channel);

                        return;
                    }

                    let leadingBid = $("span[data-leading-bid-sum]");
                    if (leadingBid.length !== 0) {
                        leadingBid = leadingBid.text();
                    } else {
                        leadingBid = 0;
                    }

                    let timeLeft = $("span[data-time-left]").text();
                    timeLeft = timeLeft.replace('tim', 'hours');
                    timeLeft = timeLeft.replace('min', 'minutes');
                    if (timeLeft === '') {
                        timeLeft = 'None'
                    }
                    service.say(`Title: ${title}. Leading bid: ${leadingBid} sek. Time left: ${timeLeft}.`, channel);
                })();
                break;
            case SUPPORTED_DOMAINS.m_blocket_se:
            case SUPPORTED_DOMAINS.www_blocket_se:
                (() => {
                    let price = $("#vi_price").first().text();
                    let published = $("#seller-info").find("li").eq(0).text().trim().split("\n");
                    published = published[published.length-1].trim();
                    let location = $('.area_label').text().trim();

                    let msg = `Title: ${title}. Price: ${price}. Published: ${published}. Location: ${location}.`;
                    msg = msg.replace(/\n/g, "");
                    service.say(msg, channel);
                })();
                break;
            case SUPPORTED_DOMAINS.www_webhallen_com:
                (() => {
                    let regexp = /https:\/\/www\.webhallen\.com\/se\/product\/(\d+)/;
                    if (!regexp.test(input)) {
                        return;
                    }

                    let match = regexp.exec(input);
                    let productId = match[1];
                    if (productId === undefined) {
                        return;
                    }

                    let url = `https://www.webhallen.com/api/product/${productId}`;
                    this.webService.download(url).then(function (data) {
                        let obj = JSON.parse(data);
                        let name = obj.product.name
                        let price = obj.product.price.price;
                        price = parseInt(price);
                        price = formatNumber(price);

                        service.say(`Title: ${name} - Webhallen.com. Price: ${price} kr.`, channel);
                    });
                })();
                break;

            case SUPPORTED_DOMAINS.www_inet_se:
                (() => {
                    let jsonPart = $("head").find("script").eq(1).text().trim();
                    let obj = JSON.parse(jsonPart);
                    let price = obj.offers.price;
                    price = formatNumber(price);

                    service.say(`Title: ${title}. Price: ${price} kr.`, channel);
                })();
                break;

            case SUPPORTED_DOMAINS.www_kjell_com:
                (() => {

                    let price = $(".mainPrice").text().trim();
                    if (price.indexOf("-") === -1) {
                        price = price.replace(":", ".");
                    }
                    service.say(`Title: ${title}. Price: ${price} kr`, channel);
                })();
                break;

            case SUPPORTED_DOMAINS.www_clasohlson_com:
                (() => {
                    let price = $(".productPriceCurrent").text().trim();
                    service.say(`Title: ${title}. Price: ${price} kr`, channel);
                })();
                break;

            case SUPPORTED_DOMAINS.www_biltema_se:
                (() => {
                    let price = $(".productPriceQuantity").eq(1).find("span").text();
                    price = price.split("S")[0];
                    service.say(`Title: ${title}. Price: ${price} kr`, channel);
                })();
                break;

            case SUPPORTED_DOMAINS.www_komplett_se:
                (() => {
                    let price = $(".product-price-now").text();
                    price = price.replace(':','');
                    price = price.replace('-', '');
                    price += ' kr';
                    service.say(`Title: ${title}. Price: ${price} kr`, channel);
                })();
                break;

            case SUPPORTED_DOMAINS.www_twostroke_se:
                (() => {
                    let price = $("#updPrice").text();
                    service.say(`Title: ${title}. Price: ${price} kr`, channel);
                })();
                break;
        }
    }
}

export default PriceTitleService;