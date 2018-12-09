import { PROTOCOLS } from "../../Constants";

const PLUGIN_NAME = 'PLUGIN_DISCORD_USERS_VOICE';
class DiscordUsersInVoice {
    constructor(PluginsService, mTrigger) {
        this.pluginsService = PluginsService;
        this.mTrigger = mTrigger;
        this.reportTo = [
            {
                protocol: PROTOCOLS.MUMBLE,
                hostname: '',
                channel: '#SK'
            },
            {
                protocol: PROTOCOLS.HANGOUTS,
                hostname: '',
                channel: ''
            }
        ];

        this.supportsAction = this.supportsAction.bind(this);
        this.trigger = this.trigger.bind(this);
        this.findDiscordServer = this.findDiscordServer.bind(this);
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
            if (input.message === this.mTrigger+"discord"
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
        const discordServer = this.findDiscordServer(input);
        if (discordServer !== false) {
            let discordUsers = discordServer.getUsersInVoiceChannel('General');
            if (discordUsers.length === 0) {
                service.say("Discord users: None", input.channel);
                return;
            }
            discordUsers = discordUsers.join(", ");
            service.say("Discord users: "+discordUsers, input.channel);
        }
    }

    findDiscordServer() {
        const servers = this.pluginsService.getServers();
        for (const server of servers) {
            const sconfig = server.configuration;
            if (sconfig.protocol === PROTOCOLS.DISCORD) {
                return server;
            }
        }
        return false;
    }
}

export default DiscordUsersInVoice;