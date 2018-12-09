Nobat bot
------------
**Continued development has been moved to to https://github.com/Snekabel/nobat-bot**
  
With a newly found love modern Javascript development (ES6), i decided to take on Node.js programming.  
Despite having far less code than Zubat, the very dynamic nature of javascript gave me an opportunity  
to experiment with new program structures and ways to make the program far more modular and expandable  
 without sacrificing too readability.

Nobat is a fun experiment that currently supports the following:
 - Cross plattform chat between channel and protocols (Currently Mumble, IRC, Discord and google hangouts).
 - DJ music playback on voice protocols (by using youtube links). 
 You can for example ask what users are on the mumble server from irc or discord and vice-versa.  
 All messages sent on either plattforms (including joins/quits) can also be relayed.
 Note that this is hardcoded into CrosstalkPlugin.js at the moment.
 
 - Support for Mumble, IRC, dicoord and google hangout protocols. Adding more means very little work besides usually just  
  installing and NPM package and adding a service that manages the events.
  
 - It builds a virtual DOM with a window object for URLs, prefect for extracting web-page titles etc.  
 The service handles decoding of escaped characters and also provides a JQUERY object for extracting
 data. Its all promise based so you can easily make a flow for several nested calls.
 
 - Automatic Metadata information from:  
 -- Youtube (provide your own API key in YouTubeTitleService.js)   
 -- Twitch  
 -- Vimeo  
 -- SVT Play  
 -- Steam  
 As well as shopping info like pricing, sales price (% off), location, time left etc from various shopping sites like  
 Webhallen.com, blocket.se, tradera.com etc.
 
 - Automatic reminders/messages triggered on either a user joining or a time and date.
 - Systemd services.
 
 Most of the configuration are the time not separated into JSON parts, but rather lives in Main.json.
 Plugins currently don't have their own JSON files, so you will have to provide your own API keys in the js plugin files yourself.

Installation
------------
This bot has only been tested on linux systems, and requires the build-essential tools as well as FFMPEG libraries to be installed (A simple apt-get in ubuntu/debian will fix these for you).
Other than that, you will need to install thenpm package babel-cli globally.
Example:  
`sudo apt-get install build-essential`    
`sudo apt-get install ffmpeg`  
`sudo npm install -g babel-cli`  
`npm install i`  

You should have a look at the example configuration, make your own and then you can run the bot using
`babel-node main.js`