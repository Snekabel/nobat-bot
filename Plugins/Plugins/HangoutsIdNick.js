import {MSG_TYPES, PROTOCOLS} from "../../Constants";

const PLUGIN_NAME = 'PLUGIN_HANGOUTS_ID_NICK';
class HangoutsIdNick {
    constructor(PluginsService, mTrigger) {
        this.pluginsService = PluginsService;
        this.sqlService = this.pluginsService.getSQLService();

        this.supportsAction = this.supportsAction.bind(this);
        this.trigger = this.trigger.bind(this);

        this.REGEXP_SET_NAME = new RegExp(`^\\${mTrigger}setname (.*)`);
    }

    /**
     * Does this service support this action?
     * @param input
     * @param service [optional]
     * @return {boolean}
     */
    supportsAction(input, service) {
        const msg = input.message;
        return input.protocol === PROTOCOLS.HANGOUTS && this.REGEXP_SET_NAME.test(msg)
    }

    trigger(input, service) {
        if (!this.supportsAction(input, service)) {
            return false;
        }
        
        const msg = input.message;
        const userId = input.userId;

        const res = this.REGEXP_SET_NAME.exec(msg);
        const newName = res[1];
        if (!newName) {
            return;
        }

        if (newName.length > 20) {
            service.say("Your name can max be 20 characters!", input.channel);
            return;
        }

        const sqlDelete = 'DELETE FROM `hangouts_id_nick` WHERE `hangouts_id` = ?;';
        const sqlDeleteArr = [userId];
        const sqlExisting = 'SELECT id FROM `hangouts_id_nick` WHERE `nick` = ? OR `nick` = ?;';
        const sqlExistingArr = [newName, newName.trim().toLowerCase()];
        const sqlInsert = 'INSERT INTO `hangouts_id_nick` (`hangouts_id`, `nick`) VALUES (?, ?);'
        const sqlInsertArr = [userId, newName];

        this.sqlService.query(sqlDelete, sqlDeleteArr).then(() => {
            this.sqlService.query(sqlExisting, sqlExistingArr).then((sqlExistingResult) => {
                let [RowDataPacket] = sqlExistingResult
                if (RowDataPacket && RowDataPacket.length > 0) {
                    service.say("Soneone else already has that name!", input.channel);
                    return;
                }
                this.sqlService.query(sqlInsert, sqlInsertArr).then((insertResult) => {
                    const [OkPacket] = insertResult;
                    const id = OkPacket.insertId;
    
                    service.say(`OK! User ${userId} is now known as ${newName}!`, input.channel);
                    const servers = this.pluginsService.getServers();
                    for (const server of servers) {
                        const sconfig = server.configuration;
                        if (server.configuration.protocol === PROTOCOLS.HANGOUTS) {
                            server.setUserNick(userId, newName);
                        }
                    }
                });
            });
        });
    }
}
export default HangoutsIdNick;