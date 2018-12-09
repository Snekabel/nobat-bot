import {PROTOCOLS, MSG_TYPES} from '../../Constants';
import YoutubeTitleService from '../../Plugins/Plugins/PluginServices/YoutubeTitleService';

const mumble = require('mumble');
const lame = require('lame');
const fs = require('fs');
const streamy = require("youtube-audio-stream");

const EVT_TEXT_MESSAGE = 'textMessage';
const EVT_USER_STATE = 'userState';
const EVT_USER_REMOVE = 'userRemove';
const EVT_USER_CONNECT = 'user-connect';
const EVT_USER_MOVED = 'user-move';
const EVT_CHANNEL_REMOVE = 'channelRemove';

class MumbleService {
  constructor(configuration, pluginsService, trigger) {
    console.log('Creating a new Mumble service...');
    console.log('Nick: ', configuration.nick);
    console.log('Hostname: ', configuration.hostname);
    console.log('Port: ', configuration.port);
    console.log('Channel: ', configuration.channel);
    console.log('Tokens: ', configuration.tokens);
    console.log('Mumble URL: ', this.generateMumbleUrl(configuration));
    console.log('');

    this.configuration = configuration;
    this.pluginsService = pluginsService;
    this.trigger = trigger;
    this.nick = configuration.nick;
    this.mumbleUrl = this.generateMumbleUrl(configuration);
    this.client = {};
    this.sessions = {};
    this.yts = new YoutubeTitleService();

    this.stream = null;
    this.volume = 0.1;
    this.playlistUrls = [];
    this.playlistNames = [];
    this.currentSong = -1;
    this.repeat = false;

    this.REGEXP_ADD_YOUTUBE = new RegExp(`\\${trigger}add (?:https?:\\/{2})?(?:w{3}\\.)?youtu(?:be)?\\.(?:com|be)((?:\\/watch\\?v=|\\/)([^\\s&]+))`);
    this.REGEXP_VOL = new RegExp(`\\${trigger}vol 0\\.\\d*`);

    this.connect = this.connect.bind(this);
    this.getConfiguration = this.getConfiguration.bind(this);
    this.getUsers = this.getUsers.bind(this);
    this.loadUsers = this.loadUsers.bind(this);
    this.EVT_TEXT_MESSAGE = this.EVT_TEXT_MESSAGE.bind(this);
    this.EVT_USER_STATE = this.EVT_USER_STATE.bind(this);
    this.EVT_USER_REMOVE = this.EVT_USER_REMOVE.bind(this);
    this.EVT_USER_MOVED = this.EVT_USER_MOVED.bind(this);
    this.EVT_USER_CONNECT = this.EVT_USER_CONNECT.bind(this);
    this.say = this.say.bind(this);
    this.playSound = this.playSound.bind(this);
    this.stopSound = this.stopSound.bind(this);
    this.setVolume = this.setVolume.bind(this);
    this.playNext = this.playNext.bind(this);

    this.connect()
  }

  generateMumbleUrl(configuration) {
    return `mumble://${configuration.nick.replace(' ', '%20')}@${configuration.hostname}:${configuration.port}/${configuration.channel.replace(' ', '%20')}/?version=1.2.0`
  }

  getConfiguration() {
    return this.configuration;
  }

  connect() {
    mumble.connect(this.mumbleUrl, function (error, client) {
      if (error) {
        //throw new Error(error);
      }
      this.client = client;
      this.client.authenticate(this.configuration.nick, null, this.configuration.tokens);
      this.client.on(EVT_TEXT_MESSAGE, this.EVT_TEXT_MESSAGE);
      this.client.on(EVT_USER_STATE, this.EVT_USER_STATE);
      this.client.on(EVT_USER_REMOVE, this.EVT_USER_REMOVE);
      this.client.on(EVT_USER_CONNECT, this.EVT_USER_CONNECT);
      this.client.on(EVT_USER_MOVED, this.EVT_USER_MOVED);

    }.bind(this));
    setTimeout(this.loadUsers, 5000);
  }

  loadUsers() {
    for (const user of this.client.users()) {
      this.sessions[user.session] = {
        user: user.name,
        channel: user.channel.name
      }
    }
  }

  getUsers() {
    let arr = [];
    for (const key in this.sessions) {
      if (this.sessions.hasOwnProperty(key)) {
          arr.push(this.sessions[key]);
      }
    }
    return arr;
  }

  EVT_TEXT_MESSAGE(data) {
    let userData = null;
    for (const user of this.client.users()) {
      if (data.actor === user.session) {
        userData = {
          user: user.name,
          channel: user.channel.name
        };
        break;
      }
    }

    if (!userData || userData.user === this.nick) {
      return;
    }
    
    const author = userData.user.toLowerCase();
    if (this.configuration.ignoreUsers.find(e => e === author)) {
        return;
    }

    const msgObj = {
      protocol: PROTOCOLS.MUMBLE,
      type: MSG_TYPES.MESSAGE,
      hostname: this.configuration.hostname,
      user: userData.user,
      channel: userData.channel,
      //channel: this.configuration.channel,
      message: this.cleanMessage(data.message)
    };

      let triggerOwn = false;
      if (this.REGEXP_ADD_YOUTUBE.test(msgObj.message)) {
          const ytLink = msgObj.message.split(' ')[1];
          this.yts.getVideoInfo(ytLink, (videoInfo) => {
              this.playlistUrls.push(ytLink);
              this.playlistNames.push(videoInfo.title);
              this.say(`Song added: ${videoInfo.title}`);
          });
          triggerOwn = true;
      }
      else if (msgObj.message.startsWith(this.trigger + 'play')) {
          if (this.playlistUrls.length > 0) {
              this.say(`Starting playlist with ${this.playlistUrls.length} songs`);
              this.playNext();
          }
          triggerOwn = true;
      }
      else if (msgObj.message.startsWith(this.trigger + 'repeat')) {
          this.repeat = !this.repeat;
          this.say('Repeat: '+this.repeat);
          triggerOwn = true;
      } else if (msgObj.message.startsWith(this.trigger + 'stop')) {
          this.stopSound();
          triggerOwn = true;
      } else if (msgObj.message.startsWith(this.trigger + 'next') || msgObj.message.startsWith(this.trigger + 'skip')) {
          this.playNext();
          triggerOwn = true;
      } else if (msgObj.message.startsWith(this.trigger + 'list')) {
          let strName = '';
          for (let i = 0; i < this.playlistNames.length; i++) {
            strName += `${i} - ${this.playlistNames[i]} <br/>`;
          }
          this.say('Playlist: ' + strName);
          triggerOwn = true;
      } else if (msgObj.message.startsWith(this.trigger + 'clean') || msgObj.message.startsWith(this.trigger + 'clear')) {
          this.playlistUrls = [];
          this.playlistNames = [];
          this.currentSong = -1;
          this.say('Playlist cleaned');
          triggerOwn = true;
      } else if (this.REGEXP_VOL.test(msgObj.message)) {
          let newVolume = this.volume;
          const newVolStr = msgObj.message.split(' ')[1];
          try {
              newVolume = parseFloat(newVolStr)
          } catch (e) {
              this.say('Volume is not a float value!')
          }
          this.setVolume(newVolume);
          this.say('Volume set to '+this.volume);
          triggerOwn = true;
      } else if (msgObj.message === this.trigger+'vol') {
          this.say('Current volume: '+this.volume);
          triggerOwn = true;
      }

      if(!triggerOwn) {
          this.pluginsService.trigger(msgObj, this);
      }
  }

  EVT_USER_STATE(state) {

  }
  EVT_USER_REMOVE(data) {
    const userObj = this.sessions[data.session];
    if (userObj === undefined) {
      const msgObj = {
        protocol: PROTOCOLS.MUMBLE,
        type: MSG_TYPES.USER_LEFT,
        hostname: this.configuration.hostname,
        user: '',
        channel: this.configuration.channel,
        message: `A user left from the mumble server, but i had no client data associated with the client id: ${data.session}...`
      };
      this.pluginsService.trigger(msgObj, this);
      return;
    }

    const name = userObj.user.toLowerCase();
    if (this.configuration.ignoreUsers.find(e => e === name)) {
        return;
    }


    const msgObj = {
      protocol: PROTOCOLS.MUMBLE,
      type: MSG_TYPES.USER_LEFT,
      hostname: this.configuration.hostname,
      user: userObj.user,
      channel: this.configuration.channel,
      message: `User left: ${userObj.user}`
    };
    this.pluginsService.trigger(msgObj, this);
    delete this.sessions[data.session];
  }

  EVT_USER_CONNECT(data) {
    this.sessions[data.session] = {
      user: data.name,
      channel: data.channel.name
    };

    const name = data.name.toLowerCase();
    if (this.configuration.ignoreUsers.find(e => e === name)) {
        return;
    }

    const msgObj = {
      protocol: PROTOCOLS.MUMBLE,
      type: MSG_TYPES.USER_JOINED,
      hostname: this.configuration.hostname,
      user: data.name,
      //channel: data.channel.name,
      channel: this.configuration.channel,
      message: `User connected: ${data.name}`
    };
    this.pluginsService.trigger(msgObj, this);
  }

  EVT_USER_MOVED(user, fromChannel, toChannel, actor) {
    /*
    if (this.sessions[user.session] !== undefined) {
        this.sessions[user.session].channel = toChannel.name;
    }

    const msgObj = {
        protocol: PROTOCOLS.MUMBLE,
        type: MSG_TYPES.USER_JOINED,
        hostname: this.configuration.hostname,
        user: user.name,
        channel: toChannel.name,
        message: `User joined: ${toChannel.name}`
    };
    this.pluginsService.trigger(msgObj, this);
    */
  }

  cleanMessage(message) {
    const split = message.split(' ');
    let fixedString = '';
    split.forEach((str) => {
      if (str.startsWith('<a href=') || str.startsWith('href=')) {
        fixedString += str.substring(str.indexOf('>') + 1, str.lastIndexOf('<')) + ' ';
      }
      else if (str.startsWith('<')) {
      }
      else {
        fixedString += str + ' ';
      }
    });

    if (fixedString.charAt(fixedString.length - 1) === ' ') {
      fixedString = fixedString.substring(0, fixedString.length - 1);
    }

    return fixedString;
  }

  say(text, to) {
    this.client.user.channel.sendMessage(text);
  }

  playSound(url, onFinish) {
    console.log('Play youtube URL: ', url);
    //var stream;
    const decoder = new lame.Decoder();
    if (this.stream != null) {
      this.stream.end();
      this.stream.unpipe();
      //this.stream.close();
    }

    
    decoder.on('format', function (format) {
      //console.log( format );
      this.stream.pipe(this.client.inputStream({
          channels: format.channels,
          sampleRate: format.sampleRate,
          gain: this.volume
        })
      );
    }.bind(this));

    try {
      this.stream = streamy(url).pipe(decoder);
      //console.log(this.stream);
      this.stream.on('format', function (format) {
        console.log("FORMAT", format);
      });
      this.stream.on('close', function (g) {
        console.log("Close ", g);
      });
      this.stream.on('finish', function (finish) {
        console.log("Finish ", finish);
        onFinish();
      });
      this.stream.on('prefinish', function (prefinish) {
        console.log("Prefinish ", prefinish);
      });
      this.stream.on('end', function (end) {
        console.log("End ", end);
      });
      this.stream.on('error', function (error) {
        console.log("Error ", error);
      });
    }
    catch (err) {
      console.error(err);
    }
    
  }

  stopSound() {
    if (this.stream != null) {
      this.stream.end();
      this.stream.unpipe();
    }
  }

  setVolume(vol) {
    if (vol > 1 || vol < 0) {
      this.say('Volume must be between 0 and 1!');
      return;
    }
    this.volume = vol;
  }

  playNext() {
    this.currentSong++;

    if (this.playlistUrls.length > this.currentSong) {
      try {
        this.playSound(this.playlistUrls[this.currentSong], this.playNext);
        this.say("Now playing: " + this.playlistNames[this.currentSong])
      } catch (e) {
        this.say("Exception: "+e.message);
      }
    }
    else {
      this.currentSong = -1;
      if (this.repeat) {
        try {
          this.playNext();
        } catch (e) {
          this.say("Exception: "+e.message);
        }
      }
    }
  }
}

export default MumbleService;