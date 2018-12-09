import IRCService from "./Protocols/IRCService"
import MumbleService from "./Protocols/MumbleService"
import DiscordService from "./Protocols/DiscordService";
import HangoutsService from "./Protocols/HangoutsService";
import PluginsService from "../Plugins/PluginsService";
import SQLService from "./SQLService";
import {NAME, VERSION, CONFIG_FILE, PROTOCOLS} from "../Constants";

const fs = require('fs');

class MainService {
    constructor() {
        this.configuration = {};
        this.trigger = '';
        this.servers = [];
        this.sqlService = null;
        this.getServers = this.getServers.bind(this);
        this.getSQLService = this.getSQLService.bind(this);
        this.getCrossTalksConfig = this.getCrossTalksConfig.bind(this);
        this.createServers = this.createServers.bind(this);
        this.createServer = this.createServer.bind(this);
        this.createSQLService = this.createSQLService.bind(this);
        this.createTriggerString = this.createTriggerString.bind(this);

        console.log(`========== STARTING ${NAME} v ${VERSION} ==========`);
        console.log(`Loading configuration file ${CONFIG_FILE}...`);
        this.configuration = this.loadConfiguration();
        if (!this.configuration) {
            console.log('No configuration found! Exiting...');
            process.exit(1);
        }

        console.log('Loading SQL service...');
        this.createSQLService();

        console.log('Loading plugins...');
        this.createTriggerString();
        console.log('Using trigger: '+this.trigger);
        this.pluginsService = new PluginsService(this, this.trigger);

        console.log('Creating server services...');
        this.createServers();

    }

    createServers() {
        if (this.configuration.servers != null) {
            let servers = this.configuration.servers;
            for (let server of servers) {
                this.createServer(server)
            }
        }
    }

    createServer(server) {

        switch (server.protocol) {
            case PROTOCOLS.IRC:
                console.log(`MAIN SERVICE: Adding a new ${PROTOCOLS.IRC} server...`);
                this.servers.push(new IRCService(server, this.pluginsService, this.trigger));
                break;

            case PROTOCOLS.MUMBLE:
                console.log(`MAIN SERVICE: Adding a new ${PROTOCOLS.MUMBLE} server...`);
                this.servers.push(new MumbleService(server, this.pluginsService, this.trigger));
                break;

            case PROTOCOLS.DISCORD:
                console.log(`MAIN SERVICE: Adding a new ${PROTOCOLS.DISCORD} server...`);
                this.servers.push(new DiscordService(server, this.pluginsService, this.trigger));
                break;

            case PROTOCOLS.HANGOUTS:
                console.log(`MAIN SERVICE: Adding a new ${PROTOCOLS.HANGOUTS} server...`);
                this.servers.push(new HangoutsService(server, this.pluginsService, this.trigger));
                break;
        }
    }

    createSQLService() {
        if (this.configuration.mysql) {
            this.sqlService = new SQLService(this.configuration.mysql);
        }
    }

    createTriggerString() {
        if (this.configuration.trigger) {
            this.trigger = this.configuration.trigger;
        }
    }

    getServers() {
        return this.servers;
    }

    getSQLService() {
        return this.sqlService;
    }

    getCrossTalksConfig() {
        return this.configuration.crosstalks;
    }

    loadConfiguration() {
        let configFile = (`${__dirname}/../Configuration/${CONFIG_FILE}`);
        if (!fs.existsSync(configFile)) {
            return false;
        }
        let fileString = fs.readFileSync(configFile, 'utf8');

        return JSON.parse(fileString);
    }
}


export default MainService;