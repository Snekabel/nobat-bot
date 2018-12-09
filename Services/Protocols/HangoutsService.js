import {PROTOCOLS, MSG_TYPES} from '../../Constants';

var Client = require('hangupsjs');
var Q = require('q');

const EVT_TEXT_MESSAGE = 'chat_message';
const EVT_CONNECT_FAILED = 'connect_failed';

class hangoutsService {
    constructor(configuration, pluginsService, trigger) {
        console.log('Creating a new Hangouts service...');
        console.log('cookies: ', configuration.cookies);
        console.log('Hostname (Server name): ', configuration.hostname);
        console.log('Channel name: ', configuration.channelObj.name);
        console.log('Channel id: ', configuration.channelObj.id);
        console.log('');
        this.configuration = configuration;
        this.pluginsService = pluginsService;
        this.trigger = trigger;

        this.client = new Client();
        this.myId = this.configuration.gaia_id
        this.generateCookiesObj = this.generateCookiesObj.bind(this);
        this.connect = this.connect.bind(this);
        this.getConfiguration = this.getConfiguration.bind(this);

        this.EVT_TEXT_MESSAGE = this.EVT_TEXT_MESSAGE.bind(this);
        this.EVT_CONNECT_FAILED = this.EVT_CONNECT_FAILED.bind(this);
        this.isReconnecting = false;
        this.say = this.say.bind(this);
        this.connect();

        this.sqlService = this.pluginsService.getSQLService();
        this.idUsernameArr = [];
        this.loadUsersMap = this.loadUsersMap.bind(this);
        this.setUserNick = this.setUserNick.bind(this);
        this.loadUsersMap();
        //setInterval(this.loadUsersMap, 60000);
    }

    generateCookiesObj() {
        const creds = function() {
            return Q({
                cookies: this.configuration.cookies
            });
        }.bind(this);
        return creds;
    }

    connect() {
        this.client.on(EVT_TEXT_MESSAGE, this.EVT_TEXT_MESSAGE);
        this.client.on(EVT_CONNECT_FAILED, this.EVT_CONNECT_FAILED);
        this.client.connect(this.generateCookiesObj()).then(()=>{
            console.log("Hangouts: Logged in!");
        }).done()
    }

    getConfiguration() {
        return this.configuration;
    }

    EVT_TEXT_MESSAGE(ev) {
        let msg = '';
        let gaia_id = 0;
        let nick = null;
        try {
            const msgArr = [];
            ev.chat_message.message_content.segment.forEach(e => {
                if (e.text) {
                    msgArr.push(e.text);
                }
            });
            msg = msgArr.join(' ');
        } catch(e) {
            console.log('MSG ERROR', e);
            return;
        }
        try {
            gaia_id = ev.sender_id.gaia_id;
            const userObj = this.idUsernameArr.find(e => e.hangouts_id === gaia_id);
            if (userObj) {
                nick = userObj.nick;
            }
        } catch(e) {
            console.log('gaia_id ERROR!', e);
        }
        
        if (!msg || gaia_id === this.myId) {
            return;
        }

        if (nick && nick.length > 20) {
            nick = nick.substring(0, 20);
        }

        const msgObj = {
            protocol: PROTOCOLS.HANGOUTS,
            type: MSG_TYPES.MESSAGE,
            hostname: this.configuration.hostname,
            user: nick ? nick:gaia_id,
            userId: gaia_id,
            channel: this.configuration.channelObj.name,
            message: msg
        };
        this.pluginsService.trigger(msgObj, this);
    }

    EVT_CONNECT_FAILED() {
        /*
        console.log('HANGOUTS: Connection failed, reconnecting in 60 secs...');
        if (!this.isReconnecting) {
            this.isReconnecting = true;
            setTimeout(() => {
                if(this.isReconnecting) {
                    this.connect();
                    this.isReconnecting = false;
                }
    
            }, 60000);
        }
	*/
    }

    say(text, to) {
        this.client.sendchatmessage(this.configuration.channelObj.id, [
            [0, text]
        ]);
    }

    loadUsersMap() {
        this.sqlService.query('SELECT * FROM hangouts_id_nick').then((result) => {
            const [RowDataPacket] = result;
            this.idUsernameArr = RowDataPacket.map((row) => (
                {
                    hangouts_id: row.hangouts_id,
                    nick: row.nick
                }
            ));
        }).catch((error) => {
            throw error;
        });
    }

    //Triggered from HangoutsIdNick
    setUserNick(hangoutId, nick) {
        let found = false;
        for (let i = 0; i < this.idUsernameArr.length; i++) {
            if (hangoutId === this.idUsernameArr[i].hangouts_id) {
                this.idUsernameArr[i].nick = nick;
                found = true;
                break;
            }
        }
        this.idUsernameArr.push({hangouts_id: hangoutId, nick: nick});
    }
}

export default hangoutsService;
