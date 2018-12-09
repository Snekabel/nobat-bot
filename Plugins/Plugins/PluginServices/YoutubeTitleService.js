import WebService from '../../WebService'
import {formatNumber} from "../../lib";

const API_KEY = 'AIzaSyAVaxYzSpnU4_rSA55te4LIfEfAjJrW0sw';
class YoutubeTitleService {

    constructor() {
        this.webService = new WebService();
        this.regexp = /(?:https?:\/{2})?(?:w{3}\.)?youtu(?:be)?\.(?:com|be)((?:\/watch\?v=|\/)([^\s&]+))/;
    }

    supportsAction(input, channel, service) {
        return this.regexp.test(input);
    }

    getVideoId(input) {
        let match = this.regexp.exec(input);
        if (match == null || match[2] === undefined) {
            return false;
        }
        return match[2];
    }

    trigger(input, channel, service) {
        if (!this.supportsAction(input, channel, service) || !this.getVideoId(input)) {
            return;
        }

        this.getVideoInfo(input, (videoInfo) => {
            let retString = `Title: ${videoInfo.title}. Channel: ${videoInfo.channel}. Duration: ${videoInfo.duration}. Views: ${videoInfo.views}. Rating: ${videoInfo.likeRatio}.`;
            service.say(retString, channel);
        });
    }

    getVideoInfo(url, callback) {
        let videoId = this.getVideoId(url);
        let apiUrl = `https://www.googleapis.com/youtube/v3/videos?id=${videoId}&key=${API_KEY}&fields=items(snippet,statistics,contentDetails)&part=snippet,statistics,contentDetails`;
        this.webService.download(apiUrl)
            .then(function (data) {
                const videoInfo = this.constructModel(data);
                if (videoInfo) {
                    callback(videoInfo);
                }
            }.bind(this));
    }

    constructModel(data) {
        let obj = JSON.parse(data);
        if (obj.items !== undefined && obj.items.length > 0) {
            let item = obj.items[0];

            let title = item.snippet.title;
            let channel = item.snippet.channelTitle;
            let duration = item.contentDetails.duration;
            let views = parseInt(item.statistics.viewCount);
            let likeCount = parseInt(item.statistics.likeCount);
            let dislikeCount = parseInt(item.statistics.dislikeCount);
            let likeRatio = 0;
            let total = likeCount+dislikeCount;

            if(likeCount != null && dislikeCount != null) {
                likeRatio = Math.round((likeCount/total) * 100);
                likeRatio += '%';
            }

            if (duration === 'PT0S') {
                duration = 'LIVE';
            } else {
                duration = duration.substring(2);
                let index = duration.indexOf("H");
                if (index > -1) {
                    duration = duration.substring(0, index + 1) + " " + duration.substring(index + 1);
                }
                index = duration.indexOf("M");
                if (index > -1) {
                    duration = duration.substring(0, index + 1) + " " + duration.substring(index + 1);
                }
                duration = duration.toLowerCase();
            }

            return {
                title: title,
                channel: channel,
                duration: duration,
                views: formatNumber(views),
                likeCount: formatNumber(likeCount),
                dislikeCount: formatNumber(dislikeCount),
                likeRatio: likeRatio
            };
        }
    }
}

export default YoutubeTitleService;