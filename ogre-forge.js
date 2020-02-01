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
    }
}
if (parameters.player === 'screen') {
    peer = new Peer(parameters.gameId, {debug: 3});
    peer.on('connection', function(conn) {
        conn.on('data', function(data){
          debug(data)
          if (data.startsWith('hi_')) {
            var playerId = data.substr(3);
            if (players.p1.id == null) {
                players.p1.id = playerId;
                players.p1.conn = conn;
                conn.send('player_1');
            } else if (players.p2.id == null) {
                players.p2.id = playerId;
                players.p2.conn = conn;
                conn.send('player_2');
            }
          }
        });
      });
} else {
    peer = new Peer(parameters.playerId, {debug: 3});
    peer.on('connection', function(conn) {
        conn.on('data', function(data){
          debug('Received data from game: ' + data);
        });
      });
}

var conn = null;
if (parameters.player != 'screen') {
    conn = peer.connect(parameters.gameId);
    // on open will be launch when you successfully connect to PeerServer
    conn.on('open', function(){
      // here you have conn.id
      conn.send('hi_' + parameters.playerId);
    });
}


var button;
function create ()
{
    //this.add.image(400, 300, 'sky');

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
        console.log('btn down');
        if (conn != null) {
            conn.send("blub");
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
    if (gameId.startsWith('p1_')) {
        gameId = gameId.substr(3);
        player = 'p1';
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
    game.debug.text(text, 100.0, HEIGHT - line * 20.0);
}