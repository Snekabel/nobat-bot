import {PROTOCOLS, MSG_TYPES} from '../../Constants';

const Discord = require("discord.js");
const YoutubeDL = require('youtube-dl');
const Request = require('request');

const EVT_TEXT_MESSAGE = 'message';
const EVT_VOICE_STATE_UPDATE = 'voiceStateUpdate';
const EVT_PRESENCE_UPDATE = 'presenceUpdate';
const EVT_ERROR = 'error';

class DiscordService {
    constructor(configuration, pluginsService, trigger) {
        console.log('Creating a new Discord service...');
        console.log('token: ', configuration.token);
        console.log('Nick: ', configuration.nick);
        console.log('Hostname (Server name): ', configuration.hostname);
        console.log('Channel name: ', configuration.channelObj.name);
        console.log('Channel id: ', configuration.channelObj.id);
        console.log('');
        this.configuration = configuration;

        this.client = new Discord.Client();
        this.nick = configuration.nick;
        this.voiceConnection = null;
        this.dispatcher = null;
        this.ignoreNextEnd = false;

        this.pluginsService = pluginsService;
        this.trigger = trigger;
        //This needs to be stored for the playback to work currently.
        this.lastMsg = null;
        this.usersInVoice = {};
        this.usersActivities = {};

        this.volume = 0.5;
        this.playlist = [];
        this.currentSong = -1;
        this.repeat = false;

        this.REGEXP_ADD_YOUTUBE = new RegExp(`\\${trigger}add (?:https?:\\/{2})?(?:w{3}\\.)?youtu(?:be)?\\.(?:com|be)((?:\\/watch\\?v=|\\/)([^\\s&]+))`);
        this.REGEXP_VOL = new RegExp(`\\${trigger}vol 0\\.\\d*`);

        this.connect = this.connect.bind(this);
        this.getConfiguration = this.getConfiguration.bind(this);
        this.getClientChannel = this.getClientChannel.bind(this);
        this.getAuthorVoiceChannel = this.getAuthorVoiceChannel.bind(this);
        this.getUsersInVoiceChannel = this.getUsersInVoiceChannel.bind(this);
        this.EVT_TEXT_MESSAGE = this.EVT_TEXT_MESSAGE.bind(this);
        this.EVT_VOICE_STATE_UPDATE = this.EVT_VOICE_STATE_UPDATE.bind(this);
        this.EVT_PRESENCE_UPDATE = this.EVT_PRESENCE_UPDATE.bind(this);
        this.EVT_ERROR = this.EVT_ERROR.bind(this);1

        this.say = this.say.bind(this);
        this.playSound = this.playSound.bind(this);
        this.stopSound = this.stopSound.bind(this);
        this.pause = this.pause.bind(this);
        this.resume = this.resume.bind(this);
        this.setVolume = this.setVolume.bind(this);
        this.playNext = this.playNext.bind(this);

        this.connect()
    }

    getConfiguration() {
        return this.configuration;
    }

    getClientChannel() {
        return this.client.channels.get(this.configuration.channelObj.id);
    }

    connect() {
        this.client.on(EVT_TEXT_MESSAGE, this.EVT_TEXT_MESSAGE);
        this.client.on(EVT_VOICE_STATE_UPDATE, this.EVT_VOICE_STATE_UPDATE);
        this.client.on(EVT_PRESENCE_UPDATE, this.EVT_PRESENCE_UPDATE);
        this.client.on(EVT_ERROR, this.EVT_ERROR);
        this.client.login(this.configuration.token);
    }

    EVT_TEXT_MESSAGE(msg) {
        if(msg.author.id === this.client.user.id ||
             this.configuration.channelObj.id !== msg.channel.id ||
             this.configuration.ignoreUsers.includes(msg.author.id)) {
            return;
        }
        if (msg.author.username === this.nick) {
            return;
        }
        this.lastMsg = msg;
        
        const msgObj = {
            protocol: PROTOCOLS.DISCORD,
            type: MSG_TYPES.MESSAGE,
            hostname: this.configuration.hostname,
            user: msg.author.username,
            //channel: msg.channel.name,
            //
            //The name change would have to mirrored in CrosstalkPlugin and Reminders otherwise...
            channel: this.configuration.channelObj.name,
            message: msg.content
        };

        let triggerOwn = false;
        if (this.REGEXP_ADD_YOUTUBE.test(msgObj.message)) {
            const ytLink = msgObj.message.split(' ')[1];
            this.playlist.push(ytLink);
            this.say('Song added');
            triggerOwn = true;
        }
        else if (msgObj.message.startsWith(this.trigger + 'play')) {
            if (this.playlist.length > 0) {
                this.playNext();
            }
            this.say(`Starting playlist. ${this.playlist.length} songs added`);
            triggerOwn = true;
        }
        else if (msgObj.message.startsWith(this.trigger + 'repeat')) {
            this.repeat = !this.repeat;
            this.say('Repeat: '+this.repeat);
            triggerOwn = true;
        } else if (msgObj.message.startsWith(this.trigger + 'stop')) {
            this.stopSound();
            triggerOwn = true;
        } else if (msgObj.message.startsWith(this.trigger + 'pause')) {
            this.pause();
            triggerOwn = true;
        } else if (msgObj.message.startsWith(this.trigger + 'resume')) {
            this.resume();
            triggerOwn = true;
        } else if (msgObj.message.startsWith(this.trigger + 'next') || msgObj.message.startsWith(this.trigger + 'skip')) {
            this.playNext();
            triggerOwn = true;
        } else if (msgObj.message.startsWith(this.trigger + 'list')) {
            this.say('Playlist: ' + this.playlist.toString());
            triggerOwn = true;
        } else if (msgObj.message.startsWith(this.trigger + 'clean')) {
            this.playlist = [];
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
            triggerOwn = true;
        } else if (msgObj.message === this.trigger+'vol') {
            this.say('Current volume: '+this.volume);
            triggerOwn = true;
        }

        if(!triggerOwn) {
            this.pluginsService.trigger(msgObj, this);
        }
    }

    EVT_VOICE_STATE_UPDATE(oldMember, newMember) {
      if (!oldMember || !newMember) {
        return;
      }

      let newUserChannel = newMember.voiceChannel;
      let oldUserChannel = oldMember.voiceChannel;

      if(oldUserChannel === undefined && newUserChannel !== undefined) {
        const channel = newUserChannel.name;
        let newUsersInVoice = newUserChannel.members.map(e => e.user.username);

        if (!this.usersInVoice[channel]) {
          this.usersInVoice[channel] = newUsersInVoice;
          let difference = [];
          difference[0] = newUsersInVoice[newUsersInVoice.length -1];

          const sayStr = 'User joined voice channel '+channel+': '+difference[0];
          this.say(sayStr);

          const msgObj = {
            protocol: PROTOCOLS.DISCORD,
            type: MSG_TYPES.USER_JOINED,
            hostname: this.configuration.hostname,
            user: difference[0],
            channel: this.configuration.channelObj.name,
            message: sayStr
          };
          this.pluginsService.trigger(msgObj, this);
          return;
        }

        let difference = newUsersInVoice.filter(e => !this.usersInVoice[channel].includes(e));
        if (difference[0]) {
          const sayStr = 'User joined voice channel '+channel+': '+difference[0];
          this.say(sayStr);

          const msgObj = {
            protocol: PROTOCOLS.DISCORD,
            type: MSG_TYPES.USER_JOINED,
            hostname: this.configuration.hostname,
            user: difference[0],
            channel: this.configuration.channelObj.name,
            message: sayStr
          };
          this.pluginsService.trigger(msgObj, this);
        }
        this.usersInVoice[channel] = newUsersInVoice;
      } else if(newUserChannel === undefined) {
        const channel = oldUserChannel.name;
        let newUsersInVoice = oldUserChannel.members.map(e => e.user.username);
        if (!this.usersInVoice[channel]) {
          this.usersInVoice[channel] = newUsersInVoice;
          return;
        }
        let difference = this.usersInVoice[channel].filter(e => !newUsersInVoice.includes(e));

        this.usersInVoice[channel].forEach(oldUsers => {
            const found = newUsersInVoice.find(e => e === oldUsers);
            if (!found) {
                difference.push(oldUsers);
            }
        });

        if (difference[0]) {
          const sayStr = 'User left voice channel '+channel+': '+difference[0];
          this.say(sayStr);

          const msgObj = {
            protocol: PROTOCOLS.DISCORD,
            type: MSG_TYPES.USER_LEFT,
            hostname: this.configuration.hostname,
            user: difference[0],
            channel: this.configuration.channelObj.name,
            message: sayStr
          };
          this.pluginsService.trigger(msgObj, this);
        }
        this.usersInVoice[channel] = newUsersInVoice;
      }
    }

    /**
     * @param {*} oldUser See oldUser.presence
     * @param {*} newUser See newUser.presence
     */
    EVT_PRESENCE_UPDATE(oldUser, newUser) {
        //Things gets a little too spammy with function
        return;
        const userName = newUser.user.username;
        const isStillPlaying = newUser.presence.game;

        if (isStillPlaying && oldUser) {
            if (newUser.presence.game.name && oldUser.presence.game) {
                return;
            }
        }

        let gameName = '';
        if (isStillPlaying) {
            gameName = newUser.presence.game.name;
        } else {
            if (oldUser.presence.game) {
                gameName = oldUser.presence.game.name;
            } else {
                gameName = '';
            }
        }

        const sayStr = isStillPlaying ? 
        `User ${userName} is now playing ${gameName}`:
        `User ${userName} has stopped playing ${gameName}`

        this.say(sayStr);
        const msgObj = {
          protocol: PROTOCOLS.DISCORD,
          type: MSG_TYPES.MESSAGE,
          hostname: this.configuration.hostname,
          user: userName,
          channel: this.configuration.channelObj.name,
          message: sayStr,
          cleanMessageOnly: true
        };
        this.pluginsService.trigger(msgObj, this);
    }

    EVT_ERROR(error) {
        console.log('Discord error: ', error);
    }

    getUsersInVoiceChannel(name) {
        if (!this.usersInVoice[name]) {
            return [];
        }
        return this.usersInVoice[name];
    }

    say(text, to) {
        const channel = this.getClientChannel();
        if (!channel) { //Our client is not ready yet, or it isn't connected to the network.
            return;
        }
        this.getClientChannel().send(text);
    }

    getAuthorVoiceChannel() {
        const voiceChannelArray = this.lastMsg.guild.channels.filter((v)=>v.type === "voice").filter((v)=>v.members.has(this.lastMsg.author.id)).array();
        if(voiceChannelArray.length === 0) {
            return null;
        }
        else {
            return voiceChannelArray[0];
        }
    }

    playSound(url, onFinish) {
        if (this.currentSong === -1) {
            const arr = this.lastMsg.guild.channels.filter((v)=>v.type === "voice").filter((v)=>v.members.has(this.lastMsg.author.id));
            // Make sure the user is in a voice channel.
            if (arr.length === 0) {
                this.say('You are not in a voice channel!');
                return false;
            }
        } else {
            try {
                this.ignoreNextEnd = true;
                this.dispatcher.end();
            } catch (e) {}
        }


        let videoInfo = null;
        // Get the video info from youtube-dl.
      try {
        YoutubeDL.getInfo(url, ['-q', '--no-warnings', '--force-ipv4'], (err, info) => {
          // Verify the info.
          if (err || info.format_id === undefined || info.format_id.startsWith('0')) {
            this.say('Invalid video!');
            return false;
          }
          videoInfo = info;

          new Promise((resolve, reject) => {
            // Join the voice channel if not already in one.
            if (this.voiceConnection === null) {
              //const voiceConnection = this.client.voiceConnections.get(this.lastMsg.guild.id);
              // Check if the user is in a voice channel.
              let voiceChannel = this.getAuthorVoiceChannel();
              if (voiceChannel != null) {
                voiceChannel.join().then(connection => {
                  resolve(connection);
                }).catch(console.error);
              } else {
                reject();
              }
            } else {
              resolve(this.voiceConnection);
            }
          }).then(connection => {
            this.voiceConnection = connection;
            const video = videoInfo;
            // Play the video.
            this.lastMsg.channel.sendMessage( 'Now Playing: '+video.title).then((cur) => {
              try {
                this.dispatcher = this.voiceConnection.playStream(Request(video.url));
                this.playing = true;
                //dispatcher.then(intent => {
                this.dispatcher.on('debug',(i)=>console.log("debug: " + i));
                // Catch errors in the connection.
                this.dispatcher.on('error', (err) => {
                  //this.say("fail: " + err);
                });

                // Catch the end event.
                this.dispatcher.on('end', () => {
                  if (this.ignoreNextEnd) {
                    this.ignoreNextEnd = false;
                    return;
                  }

                  console.log('Current song', this.currentSong, this.playlist.length -1, this.currentSong === (this.playlist.length -1));
                  if (this.currentSong === (this.playlist.length -1)) {
                    this.stopSound();
                  } else {
                    onFinish();
                  }
                });
              } catch (e) {
                console.log('Exception in music player: '+e);
              }

            }).catch(console.error);
          }).catch(console.error);
        });
      } catch (e) {
        this.say(e.message);
      }
    }

    stopSound() {
        this.dispatcher.end();
        this.voiceConnection.channel.leave();

        this.dispatcher = null;
        this.voiceConnection = null;

        this.currentSong = -1;
    }

    pause() {
        if (this.dispatcher) {
            this.dispatcher.pause();
        }
    }

    resume() {
        this.say('Music resumed!');
        if (this.dispatcher) {
            this.dispatcher.resume();
        }
    }

    setVolume(vol) {
        if (vol > 1 || vol < 0) {
            this.say('Volume must be between 0 and 1!');
            return;
        }
        this.volume = vol;

        if (this.dispatcher) {
            this.dispatcher.setVolume(vol);
        }
    }

    playNext() {
        this.currentSong++;

        if (this.playlist.length > this.currentSong) {
            this.playSound(this.playlist[this.currentSong], this.playNext);
        }
        else {
            this.currentSong = -1;
            if (this.repeat) {
                this.playNext();
            }
        }
    }
}

export default DiscordService;