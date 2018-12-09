import {PROTOCOLS, MSG_TYPES} from '../../Constants';
var irc = require('irc');

const EVT_TEXT_MESSAGE = 'message';
const EVT_USER_JOINED = 'join';
const EVT_USER_REMOVE = 'part';
const EVT_ERROR = 'error';
const EVT_PM = 'pm';

class IRCService {

    constructor(configuration, pluginsService, trigger) {
        console.log('Creating a new IRC service...');
        console.log('Nick: ', configuration.nick);
        console.log('Hostname: ', configuration.hostname);
        console.log('Port: ', configuration.port);
        console.log('Channels: ', configuration.channels);
        console.log('');

        this.configuration = configuration;
        this.pluginsService = pluginsService;
        this.trigger = trigger;
        this.client = {};
        this.connect = this.connect.bind(this);
        this.getConfiguration = this.getConfiguration.bind(this);
        this.EVT_TEXT_MESSAGE = this.EVT_TEXT_MESSAGE.bind(this);
        this.EVT_PM = this.EVT_PM.bind(this);
        this.EVT_ERROR = this.EVT_ERROR.bind(this);
        this.EVT_USER_JOINED = this.EVT_USER_JOINED.bind(this);
        this.EVT_USER_REMOVE = this.EVT_USER_REMOVE.bind(this);
        this.say = this.say.bind(this);

        this.connect();
    }

    connect() {
        this.client = new irc.Client(
            this.configuration.hostname,
            this.configuration.nick,
            {channels: this.configuration.channels}
        );

        this.client.addListener(EVT_TEXT_MESSAGE, this.EVT_TEXT_MESSAGE);
        this.client.addListener(EVT_PM, this.EVT_PM);
        this.client.addListener(EVT_ERROR, this.EVT_ERROR);
        this.client.addListener(EVT_USER_JOINED, this.EVT_USER_JOINED);
        this.client.addListener(EVT_USER_REMOVE, this.EVT_USER_REMOVE);
    }

    getConfiguration() {
        return this.configuration;
    }

    EVT_TEXT_MESSAGE(from, to, message) {
        if (from === this.configuration.nick) {
            return;
        }

        const msgObj = {
            protocol: PROTOCOLS.IRC,
            type: MSG_TYPES.MESSAGE,
            hostname: this.configuration.hostname,
            user: from,
            channel: to,
            message: message
        };

        this.pluginsService.trigger(msgObj, this);
    }

    EVT_USER_JOINED(channel, nick, userObj) {
        const msgObj = {
            protocol: PROTOCOLS.IRC,
            type: MSG_TYPES.USER_JOINED,
            hostname: this.configuration.hostname,
            user: nick,
            channel: channel,
            message: `User ${nick} joined ${channel}`
        };
        this.pluginsService.trigger(msgObj, this);
    }

    EVT_USER_REMOVE(channel, nick, ignoreThis, userObj) {
        const msgObj = {
            protocol: PROTOCOLS.IRC,
            type: MSG_TYPES.USER_LEFT,
            hostname: this.configuration.hostname,
            user: nick,
            channel: channel,
            message: `User ${nick} left ${channel}`
        };
        this.pluginsService.trigger(msgObj, this);
    }

    EVT_PM(from, message) {

    }

    EVT_ERROR(error) {
        console.log('IRCService error', error);
    }

    say(text, to) {
        if (!to) {
            console.log('IRC: No destination channel');
            return;
        }
        this.client.say(to, text);
    }
}

export default IRCService;