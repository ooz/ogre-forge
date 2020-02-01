/*
## Ogre Protocol

pp_<gameId> .. player game prefix

hi_<playerId>     .. handshake/player sign-up
pl_<playerNumber> .. player number assignment by game (1, 2 .. players, 0 .. reject)
p1_<action>       .. player 1 action command
p2_<action>       .. player 2 action command
*/

var parameters = getParameters();

var WIDTH = (parameters.player == 'screen') ? 600 : 300;
var HEIGHT = (parameters.player == 'screen') ? 300 : 600;

var config = {
    type: Phaser.AUTO,
    width: WIDTH,
    height: HEIGHT,
    parent: 'game-container',
    fullscreenTarget: 'game-container',
    scale: {
        mode: Phaser.Scale.FIT,
        parent: 'game-container',
        autoCenter: Phaser.Scale.CENTER_BOTH,
        width: WIDTH,
        height: HEIGHT
    },
    scene: {
        preload: preload,
        create: create,
        update: update
    }
};

var game = new Phaser.Game(config);

function preload ()
{
    this.load.image('button', 'assets/btn.png')
}

var peer;
var players = {
    p1: {
        id: null,
        conn: null
    },
    p2: {
        id: null,
        conn: null
    },
    me: {
        number: null
    }
}
if (parameters.player == 'screen') {
    peer = new Peer(parameters.gameId, {debug: 3});
    peer.on('connection', function(conn) {
        conn.on('data', function(data){
          debug(data)
          if (data.startsWith('hi_')) {
            var playerId = data.substr(3);
            if (players.p1.id == null) {
                players.p1.id = playerId;
                players.p1.conn = conn;
                conn.send('pl_1');
            } else if (players.p2.id == null) {
                players.p2.id = playerId;
                players.p2.conn = conn;
                conn.send('pl_2');
            } else {
                conn.send('pl_0'); // reject
            }
          }
          if (data.startsWith('p1_')) {
            var command = data.substr(3);
            debug("Player 1: " + command);
          }
          if (data.startsWith('p2_')) {
            var command = data.substr(3);
            debug("Player 2: " + command);
          }
        });
      });
} else {
    peer = new Peer();
}

var conn = null;
if (parameters.player != 'screen') {
    conn = peer.connect(parameters.gameId);
    conn.on('open', function() {
      conn.send('hi_' + parameters.playerId);
    });
    conn.on('data', function(data) {
        debug('From game: ' + data);
        var command = data.substr(3);
        if (data.startsWith('pl_')) {
            players.me.number = 'p' + command;
        }
    });
}


var button;
var debugConsole = null;
function create ()
{
    //this.add.image(400, 300, 'sky');

    debugConsole = this.add.text(10, 10, '', { font: '16px Courier', fill: '#00ff00' });

    this.input.on('pointerup', function (pointer) {
        if (!game.scale.isFullscreen) {
            game.scale.startFullscreen()
        }
        /*
        else {
            game.scale.stopFullscreen()
        }
        */
    }, this);

    button = this.add.sprite(100, 100, 'button').setInteractive();
    button.on('pointerup', function () {
        debug('btn down');
        if (conn != null) {
            if (players.me.number == 'p1' || players.me.number == 'p2') {
                conn.send(players.me.number + '_stomp');
            }
        }
    });

    var gameUrl = 'https://ooz.github.io/ogre-forge/?gameId=p1_' + parameters.gameId;
    // https://developers.google.com/chart/infographics/docs/qr_codes?csw=1
    get('game-qrcode').setAttribute('src', 'https://chart.googleapis.com/chart?cht=qr&chs=300x300&chl=' + encodeURI(gameUrl));
}

function update ()
{
}

// BROWSER

function getParameters() {
    var url = new URL(window.location.href)
    var gameId = url.searchParams.get('gameId') || createGameId();
    var player = 'screen';
    var playerId = 'screen'
    if (gameId.startsWith('pp_')) {
        gameId = gameId.substr(3);
        player = 'pp';
        playerId = createGameId();
    }
    return {
        'gameId': gameId,
        'player': player,
        'playerId': playerId
    }
}

// From https://gist.github.com/6174/6062387
function createGameId() {
    return [...Array(64)].map(i=>(~~(Math.random()*36)).toString(36)).join('')
}

console.log("GameId: " + parameters.gameId);
console.log("Player: " + parameters.player);

// PEER
/*
var peer = new Peer();
peer.on('connection', function(conn) {
    conn.on('data', function(data){
      // Will print 'hi!'
      console.log(data);
    });
  });
*/

function get(id) {
    return document.getElementById(id)
}

function debug(text, line=1.0) {
    console.log(text);
    if (debugConsole != null) {
        debugConsole.setText(text)
    }
}