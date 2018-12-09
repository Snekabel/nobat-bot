import WebService from '../../WebService'
import {formatNumber} from "../../lib";

class VimeoTitleService {

    constructor() {
        this.webService = new WebService();
        this.regexp = /https:\/\/vimeo\.com\/(\d+)/;
    }

    supportsAction(input, channel, service) {
        return this.regexp.test(input);
    }

    getVideoId(input) {
        var match = this.regexp.exec(input);
        if (match == null || match[1] === undefined) {
            return false;
        }
        return match[1];
    }

    trigger(input, channel, service) {
        if (!this.supportsAction(input, channel, service) || !this.getVideoId(input)) {
            return;
        }

        let videoId = this.getVideoId(input);
        let apiUrl = `http://vimeo.com/api/v2/video/${videoId}.json`;
        this.webService.download(apiUrl)
            .then(function (data) {
                let videoInfo = this.constructModel(data);
                let retString = `Title: ${videoInfo.title}. Channel: ${videoInfo.channel}. Views: ${videoInfo.numPlays}. Duration: ${videoInfo.duration}. Likes: ${videoInfo.likes}`;

                service.say(retString, channel);
            }.bind(this));
    }

    constructModel(data) {
        let obj = JSON.parse(data);
        if (obj.length === 0) {
            return false;
        }
        obj = obj[0];
        let nf = new Intl.NumberFormat('sv-SE');

        let title = obj.title;
        let channel = obj.user_name;
        let numPlays = 0;
        let hasStats = false;
        if (obj.stats_number_of_plays !== undefined) {
            numPlays = formatNumber(obj.stats_number_of_plays);
        }
        let duration = obj.duration;
        let likes = 0;
        if (hasStats) {
            likes = formatNumber(obj.stats_number_of_likes);
        }

        let hours = Math.round((duration / 3600) % 24);
        let minutes = Math.round((duration / 60) % 60);
        let seconds = Math.round(duration % 60);

        duration = '';
        if (hours > 0) {
            duration += "" + hours + "h ";
        }
        if (minutes > 0) {
            duration += "" + minutes + "m ";
        }
        if (seconds > 0) {
            duration += "" + seconds + "s";
        }

        return {
            title: title,
            channel: channel,
            numPlays: numPlays,
            duration: duration,
            likes: likes
        };
    }
}

export default VimeoTitleService;

//https:\/\/vimeo\.com\/(\d+)