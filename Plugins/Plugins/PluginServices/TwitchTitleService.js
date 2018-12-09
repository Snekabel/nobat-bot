import WebService from '../../WebService'
import {formatNumber} from "../../lib";

const API_KEY = 'mnzg0w4xci1ph1dzv06x3gpjug73vsa';
class TwitchTitleService {

    constructor() {
        this.webService = new WebService();
        this.regexp = /https:\/\/www\.twitch\.tv\/(\w+)/;
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
        let apiUrl = `https://api.twitch.tv/kraken/channels/${videoId}?client_id=${API_KEY}`;

        this.webService.download(apiUrl)
            .then(function (data) {
                let videoInfo = this.constructModel(data)
                let retString = `Title: ${videoInfo.status}. Channel: ${videoInfo.streamer}. Views: ${videoInfo.views}. Followers: ${videoInfo.followers}`;

                service.say(retString, channel);
            }.bind(this));
    }

    constructModel(data) {
        let obj = JSON.parse(data);

        let status = obj.status;
        let game = obj.game;
        if (game == null) {
            game = 'Event';
        }
        let streamer = obj.display_name;
        let views = obj.views;
        let followers = obj.followers;

        return {
            status: status,
            game: game,
            streamer: streamer,
            views: formatNumber(views),
            followers: formatNumber(followers)
        };
    }
}

export default TwitchTitleService;