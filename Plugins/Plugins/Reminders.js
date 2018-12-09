import {MSG_TYPES} from "../../Constants";
const moment = require('moment');
moment.locale('se');

const MOMENT_DB_FORMAT = 'X';
const MOMENT_TEXT_FORMAT = 'YYYY-MM-DD HH:mm:ss';
const PLUGIN_NAME = 'PLUGIN_REMINDERS';
class Reminders {
    constructor(PluginsService, mTrigger) {
        this.pluginsService = PluginsService;
        this.sqlService = this.pluginsService.getSQLService();

        this.loadReminders = this.loadReminders.bind(this);
        this.supportsAction = this.supportsAction.bind(this);
        this.trigger = this.trigger.bind(this);
        this.findServerTo = this.findServerTo.bind(this);
        this.runLoop = this.runLoop.bind(this);

        this.REGEXP_ADD_JOIN = new RegExp(`^\\${mTrigger}remind add join (\\w+) (.*)`);
        this.REGEXP_ADD_DATE = new RegExp(`^\\${mTrigger}remind add date ([0-9-: ]{19}) (.*)`);
        this.REGEXP_DELETE_ID = new RegExp(`^\\${mTrigger}remind delete (\\d+)`);
        this.REGEXP_SHOW_REMINDERS = new RegExp(`^\\${mTrigger}remind list`);

        this.loadedReminders = [];
        this.loadReminders();

        setInterval(this.runLoop, 60000);
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

        const msg = input.message;
        return this.REGEXP_ADD_JOIN.test(msg)
            || this.REGEXP_ADD_DATE.test(msg)
            || this.REGEXP_DELETE_ID.test(msg)
            || this.REGEXP_SHOW_REMINDERS.test(msg)
            || input.type === MSG_TYPES.USER_JOINED
    }

    trigger(input, service) {
        if (!this.supportsAction(input, service)) {
            return false;
        }
        const msg = input.message;
        if (input.type === MSG_TYPES.USER_JOINED) {
            const matchingIds = [];
            this.loadedReminders.forEach((item) => {
                if (item.type === 1
                && item.protocol === input.protocol
                && item.hostname === input.hostname
                && item.channel === input.channel
                && item.toUser === input.user) {
                    matchingIds.push(item.id);
                    service.say(`${item.toUser}: ${item.fromUser} told me to remind you next time i saw you that: ${item.message}.`, item.channel);
                }
            });

            if (matchingIds.length === 0) {
                return;
            }

            const sql = 'DELETE FROM reminders WHERE id IN (?)';
            const sqlArgs = [matchingIds];
            this.sqlService.query(sql, sqlArgs).then((result) => {
                console.log(`Removed reminders with ids ${matchingIds.join()} from the database`);
            });
            this.loadedReminders = this.loadedReminders.filter(item => !matchingIds.includes(item.id));
        }
        else if (this.REGEXP_ADD_JOIN.test(msg)) {
            const res = this.REGEXP_ADD_JOIN.exec(msg);
            const rUser = res[1];
            const rMsg = res[2];

            const sql = `INSERT INTO reminders 
            (type, message, protocol, from_user, to_user, hostname, channel)
             VALUES (?, ?, ?, ?, ?, ?, ?)`;
            const sqlArgs = [1, rMsg, input.protocol, input.user, rUser, input.hostname, input.channel];
            this.sqlService.query(sql, sqlArgs).then((result) => {
                const [OkPacket] = result;
                const id = OkPacket.insertId;
                this.loadedReminders.push({
                    id: id,
                    type: 1,
                    timestamp: parseInt(moment().format(MOMENT_DB_FORMAT)),
                    message: rMsg,
                    protocol: input.protocol,
                    fromUser: input.user,
                    toUser: rUser,
                    hostname: input.hostname,
                    channel: input.channel
                });
                service.say(`OK! I will remind ${rUser} of that next time i see him`, input.channel);
                service.say(`This reminder has ID: ${id}`, input.channel);
            });
        }
        else if (this.REGEXP_ADD_DATE.test(msg)) {
            const res = this.REGEXP_ADD_DATE.exec(msg);
            const rDate = res[1];
            const rMsg = res[2];

            const sql = `INSERT INTO reminders 
            (type, message, protocol, from_user, hostname, channel, date)
             VALUES (?, ?, ?, ?, ?, ?, ?)`;
            const sqlArgs = [0, rMsg, input.protocol, input.user, input.hostname, input.channel, rDate];
            this.sqlService.query(sql, sqlArgs).then((result) => {
                const [OkPacket] = result;
                const id = OkPacket.insertId;
                this.loadedReminders.push({
                    id: id,
                    type: 0,
                    timestamp: parseInt(moment(rDate).format(MOMENT_DB_FORMAT)),
                    message: rMsg,
                    protocol: input.protocol,
                    fromUser: input.user,
                    toUser: '',
                    hostname: input.hostname,
                    channel: input.channel
                });
                service.say(`OK! I will put out this reminder on ${rDate}!`, input.channel);
                service.say(`This reminder has ID: ${id}`, input.channel);
            });
        }
        else if (this.REGEXP_SHOW_REMINDERS.test(msg)) {
            const sql = 'SELECT * FROM reminders WHERE PROTOCOL = ? AND hostname = ? AND channel = ?';
            const sqlArgs = [input.protocol, input.hostname, input.channel];
            let reminders = [];
            this.sqlService.query(sql, sqlArgs).then((result) => {
                const [RowDataPacket] = result;
                reminders = RowDataPacket.map((row) => (
                    {
                        id: row.id,
                        type: row.type,
                        timestamp: moment.unix(row.timestamp).format(MOMENT_TEXT_FORMAT),
                        message: row.message,
                        fromUser: row.from_user,
                        toUser: row.to_user,
                        channel: row.channel
                    }
                ));

                if (reminders.length === 0) {
                    service.say('There are no reminders stored for this channel', input.channel);
                    return;
                }
                service.say(`There are ${reminders.length} stored reminders: `, input.channel);
                reminders.forEach((reminder) => {
                    let type = reminder.type === 1 ? 'JOIN':'DATE';
                    service.say(`Id: ${reminder.id} Type: ${type}. Message: ${reminder.message}`, input.channel);
                });
            }).catch((error) => {
                throw error;
            });
        }
        else if (this.REGEXP_DELETE_ID.test(msg)) {
            const res = this.REGEXP_DELETE_ID.exec(msg);
            const id = parseInt(res[1]);

            const reminderInMemory = this.loadedReminders.find((item => item.id === id));
            console.log('reminderInMemory', reminderInMemory);
            console.log('reminderInMemory input', input);

            if (!reminderInMemory) {
                service.say('No reminder with such an Id exists...', input.channel);
            }
            if (reminderInMemory.protocol === input.protocol
                && reminderInMemory.hostname === input.hostname
                && reminderInMemory.channel === input.channel
                && reminderInMemory.fromUser === input.user) {

                this.sqlService.query('DELETE FROM reminders WHERE id = ?', [id]).then((result) => {
                    this.loadedReminders = this.loadedReminders.filter(item => item.id !== id);
                    service.say('Reminder removed...', input.channel);
                });
            } else {
                service.say('You did not create this reminder, so you have no right to remove it.', input.channel);
            }
        }
    }

    loadReminders() {
        this.sqlService.query('SELECT * FROM reminders').then((result) => {
            const [RowDataPacket] = result;
            this.loadedReminders = RowDataPacket.map((row) => (
                {
                    id: row.id,
                    type: row.type,
                    timestamp: parseInt(moment(row.date).format(MOMENT_DB_FORMAT)),
                    message: row.message,
                    protocol: row.protocol,
                    fromUser: row.from_user,
                    toUser: row.to_user,
                    hostname: row.hostname,
                    channel: row.channel
                }
            ));

            console.log('LOADED REMINDERS', this.loadedReminders);
        }).catch((error) => {
            throw error;
        });
    }

    /**
     * Given an object of the form
     * {
     *     protocol: '',
     *     hostname: '',
     *     channel: '',
     * }
     * Attempt to find a protocol service matching these, and return it.
     * @param input
     */
    findServerTo(input) {
        const servers = this.pluginsService.getServers();
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

            if (sconfig.hostname === input.hostname
            && channels.includes(input.channel)) {
                return server;
            }
        }
        return false;
    }

    runLoop() {
        if (this.loadedReminders.length === 0) {
            return;
        }
        const currentTimeStamp = parseInt(moment().format(MOMENT_DB_FORMAT));
        console.log('runLoop()', currentTimeStamp, this.loadedReminders);

        const matchingIds = [];
        this.loadedReminders.forEach((item) => {
            if (item.type === 0 && item.timestamp < currentTimeStamp) {
                const protocolService = this.findServerTo(item);
                if (protocolService) {
                    matchingIds.push(item.id);
                    protocolService.say(`This is an automatic timed reminder from ${item.fromUser}: ${item.message}`, item.channel);
                }
            }
        });

        if (matchingIds.length === 0) {
            return;
        }

        const sql = 'DELETE FROM reminders WHERE id IN (?)';
        const sqlArgs = [matchingIds];
        this.sqlService.query(sql, sqlArgs).then((result) => {
            console.log(`Removed reminders with ids ${matchingIds.join()} from the database`);
        });
        this.loadedReminders = this.loadedReminders.filter(item => !matchingIds.includes(item.id));
    }


}
export default Reminders;