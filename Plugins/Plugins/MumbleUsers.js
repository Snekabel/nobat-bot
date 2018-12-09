import { PROTOCOLS } from "../../Constants";

const PLUGIN_NAME = 'PLUGIN_MUMBLE_USERS';
class MumbleUsers {
    constructor(PluginsService, mTrigger) {
        this.pluginsService = PluginsService;
        this.mTrigger = mTrigger;
        this.reportTo = [
            {
            protocol: PROTOCOLS.DISCORD,
            hostname: '',
            channel: ''
            },
            {
            protocol: PROTOCOLS.HANGOUTS,
            hostname: '',
            channel: ''
            }
        ];

        this.supportsAction = this.supportsAction.bind(this);
        this.trigger = this.trigger.bind(this);
        this.findMumbleServer = this.findMumbleServer.bind(this);
    }
    /**
     * Does this service support this action?
     * @param input
     * @param service [optional]
     * @return {boolean}
     */
    supportsAction(input, service) {
        const configuration = service.getConfiguration();
        if (configuration.disabledPlugins) {
            for (const dp of configuration.disabledPlugins) {
                if (dp.channel === input.channel) {
                    if (dp.plugins.includes(PLUGIN_NAME)) {
                        return false;
                    }
                }
            }
        }

        for (const item of this.reportTo) {
            if (input.message === this.mTrigger+"mumble"
                && input.protocol === item.protocol
                && input.hostname === item.hostname
                && input.channel === item.channel) {
                return true;
            }
        }
        return false;
    }

    /**
     * Trigger this service, and send the output to the other service
     * @param input
     * @param service
     */
    trigger(input, service) {
        if (!this.supportsAction(input, service)) {
            return false;
        }
        const mumbleServer = this.findMumbleServer(input);
        if (mumbleServer !== false) {
            let mumbleUsers = mumbleServer.getUsers().map((user) => user.user);
            mumbleUsers = mumbleUsers.join(", ");
            service.say("Mumble users: "+mumbleUsers, input.channel);
        }
    }

    findMumbleServer() {
        const servers = this.pluginsService.getServers();
        for (const server of servers) {
            const sconfig = server.configuration;
            if (sconfig.protocol === PROTOCOLS.MUMBLE) {
                return server;
            }
        }
        return false;
    }
}

export default MumbleUsers;