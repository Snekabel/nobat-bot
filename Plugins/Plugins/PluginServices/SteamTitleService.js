import WebService from '../../WebService'


class SteamTitleService {

    constructor() {
        this.webService = new WebService();
        this.regexp = /http:\/\/store\.steampowered\.com\/app\/(\d+)/;
    }

    supportsAction(input, channel, service) {
        return this.regexp.test(input);
    }

    getAppId(input) {
        let match = this.regexp.exec(input);
        if (match == null || match[1] === undefined) {
            return false;
        }
        return match[1];
    }

    trigger(input, channel, service) {
        if (!this.supportsAction(input, channel, service) || !this.getAppId(input)) {
            return;
        }

        let gameId = this.getAppId(input);
        let apiUrl = `http://store.steampowered.com/api/appdetails?appids=${gameId}&cc=SV`;
        this.webService.download(apiUrl)
            .then(function (data) {
                let gameInfo = this.constructModel(data, gameId);
                if (!gameInfo) {
                    return false;
                }

                let retString = `Title: ${gameInfo.name}. Price: ${gameInfo.price}. `;
                if (gameInfo.discount > 0) {
                    retString += `(${gameInfo.discount}% off!). `;
                }
                retString += `Recommendations: ${gameInfo.recommendations}.`

                service.say(retString, channel);

        }.bind(this));
    }

    constructModel(data, gameId) {
        let gameData = JSON.parse(data);
        gameData = gameData[gameId];
        if (!gameData.success) {
            return false;
        }
        gameData = gameData.data;

        let name = gameData.name;
        let price = gameData.price_overview.final.toString();
        let currency = gameData.price_overview.currency;
        let discount = gameData.price_overview.discount_percent;
        let recommendations = 0;
        if (gameData.recommendations != null &&
            gameData.recommendations.total !== undefined) {

            recommendations = gameData.recommendations.total;
        }

        if (price.length === 5) {
            let tmpPrice = price.substring(0, 3);
            tmpPrice += ',';
            tmpPrice += price.substring(3);
            price = tmpPrice;
        } else if (price.length === 4) {
            let tmpPrice = price.substring(0, 2);
            tmpPrice += ',';
            tmpPrice += price.substring(2);
            price = tmpPrice;
        } else if (price.length === 3) {
            let tmpPrice = price.substring(0, 1);
            tmpPrice += ',';
            tmpPrice += price.substring(1);
            price = tmpPrice;
        } else if (price.length === 2) {
            price = '0,' + price;
        }
        price += " " + currency;

        return {
            name: name,
            price: price,
            currency: currency,
            discount: discount,
            recommendations: new Intl.NumberFormat('sv-SE').format(recommendations)
        };
    }
}

export default SteamTitleService;