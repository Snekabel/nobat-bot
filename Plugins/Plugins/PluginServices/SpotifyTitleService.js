const rp = require('request-promise');
import WebService from '../../WebService'
import {formatNumber} from "../../lib";

class SpotifyTitleService {

    constructor() {
        this.webService = new WebService();
        this.regexp = /https:\/\/open\.spotify\.com/;

        this.supportsAction = this.supportsAction.bind(this);
        this.trigger = this.trigger.bind(this);

    }

    supportsAction(input, channel, service) {
        return this.regexp.test(input);
    }

    trigger(input, channel, service) {
        if (!this.supportsAction(input, channel, service)) {
            return;
        }

        rp({
            url: input,
            timeout: 5000,
            headers: {'User-Agent': 'curl/7.55.1', Accept: '*/*'},
            jar: rp.jar()
        }).then(function (data) {
            try {
                const $ = this.webService.jquery(data);
                const json = $('script[type="application/ld+json"]').html();
                const jsonObj = JSON.parse(json);
    
                service.say(jsonObj.description, channel);
            } catch(e) {}
 
        }.bind(this));
    }
}

export default SpotifyTitleService;