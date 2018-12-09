const reRequire = require('re-require-module').reRequire;

class PluginsService {

    constructor(mainService, mTrigger) {
        this.mainService = mainService;
        this.mTrigger = mTrigger;
        this.loadPlugins = this.loadPlugins.bind(this);
        this.getServers = this.getServers.bind(this);
        this.getSQLService = this.getSQLService.bind(this);
        this.getCrossTalksConfig = this.getCrossTalksConfig.bind(this);

        this.plugins = this.loadPlugins();
    }

    loadPlugins() {
        return [
            (new (reRequire("./Plugins/Reminders").default)(this, this.mTrigger)),
            //(new (reRequire("./Plugins/HangoutsIdNick").default)(this, this.mTrigger)),
            (new (reRequire("./Plugins/WebTitlePlugin").default)(this, this.mTrigger)),
            (new (reRequire("./Plugins/CrosstalkPlugin").default)(this, this.mTrigger)),
            (new (reRequire("./Plugins/MumbleUsers").default)(this, this.mTrigger)),
            (new (reRequire("./Plugins/DiscordUsersInVoice").default)(this, this.mTrigger)),
            (new (reRequire("./Plugins/Help").default)(this, this.mTrigger))
        ];
    }

    trigger(input, service) {
        if (input.message === this.mTrigger+ "RELOAD") {
            this.plugins = this.loadPlugins();
            service.say("Plugins reloaded!", input.channel);
        }

        for (const key in this.plugins) {
            this.plugins[key].trigger(input, service);
        }
    }

    getServers() {
        return this.mainService.getServers();
    }

    getSQLService() {
        return this.mainService.getSQLService();
    }

    getCrossTalksConfig() {
        return this.mainService.getCrossTalksConfig();
    }
}

export default PluginsService;