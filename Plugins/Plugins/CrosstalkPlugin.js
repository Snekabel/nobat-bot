import {PROTOCOLS, MSG_TYPES} from "../../Constants";

const PLUGIN_NAME = 'PLUGIN_CROSSTALK';
class CrosstalkPlugin {
    constructor(PluginsService, mTrigger) {
        this.pluginsService = PluginsService;
        this.mTrigger = mTrigger;
        this.supportsAction = this.supportsAction.bind(this);
        this.trigger = this.trigger.bind(this);
        this.findServersTo = this.findServersTo.bind(this);
        this.crosstalks = this.pluginsService.getCrossTalksConfig();
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

        for (const crosstalk of this.crosstalks) {
            if (!input.message.startsWith(this.mTrigger)
            && !input.message.includes('Title: ')
            && input.protocol === crosstalk.from.protocol
            && input.hostname === crosstalk.from.hostname
            && input.channel === crosstalk.from.channel) {
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
        const destinationServers = this.findServersTo(input);
        for (const destinationServer of destinationServers) {
            let msg = '';
            if (input.type === MSG_TYPES.MESSAGE) {
                if (input.cleanMessageOnly) {
                    msg = input.message;
                } else {
                    msg = `${destinationServer.to.prepend}(${input.user}): ${input.message}`;
                }
            } else {
                if (input.cleanMessageOnly) {
                    msg = input.message;
                } else {
                    msg = `${destinationServer.to.prepend} ${input.message}`;
                }
            }
            destinationServer.server.say(msg, destinationServer.to.channel);
        }
    }

    /**
     * Given an input object, attempt to find the service for the crosstalk destination.
     * @param input
     */
    findServersTo(input) {
        let dCrosstalks = [];
        for (const crosstalk of this.crosstalks) {
            const from = crosstalk.from;
            if (input.protocol === from.protocol
                && input.hostname === from.hostname ) {    
                dCrosstalks.push(crosstalk.to);
            }
        }
        if (dCrosstalks.length === 0) {
            return dCrosstalks;
        }

        let destinations = [];
        const servers = this.pluginsService.getServers();
        for (const dCrosstalk of dCrosstalks) {
            for (const server of servers) {
                const sconfig = server.configuration;
                let channels = [];
                if('channels' in sconfig) {
                    channels = sconfig.channels;
                } else if ('channel' in sconfig) {
                    channels = [sconfig.channel];
                } else if ('channelObj' in sconfig) {
                    channels = [sconfig.channelObj.name];
                }
    
                /*
                *The format of a "channel" varies depending on the service,
                *It can either be an array or a string. Only take protocol into account for now
                */
                if (dCrosstalk.protocol === sconfig.protocol
                    && channels.includes(dCrosstalk.channel)) {
                        destinations.push({
                            server: server,
                            to: dCrosstalk,
                        });
                }
            }
        }

        if (destinations.length === 0) {
            return destinations;
        }
        return destinations;
    }
}

export default CrosstalkPlugin;