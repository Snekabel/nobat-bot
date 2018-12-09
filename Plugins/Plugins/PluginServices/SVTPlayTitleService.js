import WebService from '../../WebService'

class SVTPlayTitleService {

    constructor() {
        this.webService = new WebService();
        this.regexp = /https:\/\/www\.svtplay\.se\/video\/(\d+)/;
    }

    supportsAction(input, channel, service) {
        return this.regexp.test(input);
    }

    trigger(input, channel, service) {
        if (!this.supportsAction(input, channel, service)) {
            return;
        }

        this.webService.download(input)
            .then(function (data) {
                let $ = this.webService.jquery(data);
                let videoId = $('video[data-video-id]').attr('data-video-id');
                return videoId;

            }.bind(this))
            .then(function (data) {
                let svtRequest = `http://www.svt.se/videoplayer-api/video/${data}`;
                this.webService.download(svtRequest).then(function (data2) {
                    let videoData = this.constructModel(data2);
                    let retString = `Show: ${videoData.showTitle}. Episode: ${videoData.episodeTitle}. Duration: ${videoData.duration}.`;

                    service.say(retString, channel);
                }.bind(this));
            }.bind(this));
    }

    constructModel(data) {
        let obj = JSON.parse(data);

        let showTitle = obj.programTitle;
        let episodeTitle = obj.episodeTitle;
        let showDuration = obj.contentDuration;

        let hours = Math.round((showDuration / 3600) % 24);
        let minutes = Math.round((showDuration / 60) % 60);
        let seconds = Math.round(showDuration % 60);

        let duration = "";
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
            showTitle: showTitle,
            episodeTitle: episodeTitle,
            duration: duration
        }
    }
}

export default SVTPlayTitleService;
