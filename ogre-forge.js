/*
## Ogre Protocol

pp_<gameId> .. player game prefix

hi_<playerId>     .. handshake/player sign-up
pl_<playerNumber> .. player number assignment by game (1, 2 .. players, 0 .. reject)
p1_<action>       .. player 1 action command
p2_<action>       .. player 2 action command
*/

var parameters = getParameters();

var WIDTH = (_isGameScreen()) ? 600 : 300;
var HEIGHT = (_isGameScreen()) ? 300 : 600;

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
        update: update,
        extend: {
            _initUI: _initUI
        }
    },
    backgroundColor: '#c2b280'
};

var game = new Phaser.Game(config);
var players = {
    body: null,
    p1: {
        id: null,
        conn: null,
        commands: [],
        head: null
    },
    p2: {
        id: null,
        conn: null,
        commands: [],
        head: null
    },
    me: {
        number: null
    }
}

// ## PEERS
var peer;
if (_isGameScreen()) {
    peer = new Peer(parameters.gameId, {debug: 3});
    peer.on('connection', function(conn) {
        conn.on('data', function(data){
          if (data.startsWith('hi_')) {
            var playerId = data.substr(3);
            if (players.p1.id == null) {
                players.p1.id = playerId;
                players.p1.conn = conn;
                conn.send('pl_1');
                debug('Welcome left head!')
            } else if (players.p2.id == null) {
                players.p2.id = playerId;
                players.p2.conn = conn;
                conn.send('pl_2');
                debug('Welcome right head!')
            } else {
                conn.send('pl_0'); // reject
                debug('Another head wanted to join?! O_o')
            }
          }
          if (data.startsWith('p1_')) {
            var command = data.substr(3);
            players.p1.commands.push(command)
          }
          if (data.startsWith('p2_')) {
            var command = data.substr(3);
            players.p2.commands.push(command)
          }
        });
      });
} else {
    peer = new Peer();
}

var conn = null;
if (!_isGameScreen()) {
    conn = peer.connect(parameters.gameId);
    conn.on('open', function() {
      conn.send('hi_' + parameters.playerId);
    });
    conn.on('data', function(data) {
        //debug('From game: ' + data);
        var command = data.substr(3);
        if (data.startsWith('pl_')) {
            players.me.number = 'p' + command;
            if (command == '0') {
                debug('Game full! Max. 2 players! x_x')
            }
        }
    });
}
// ## PEERS END

// ## GAME CALLBACKS
function preload() {
    if (_isGameScreen()) {
        this.load.image('anvil', 'assets/anvil.png')
        this.load.image('smithy_bg', 'assets/smithy_bg.png')
        this.load.image('ogre_body', 'assets/ogre_body_short.png')

        var pluginUrl = 'https://raw.githubusercontent.com/rexrainbow/phaser3-rex-notes/master/dist/rexshakepositionplugin.min.js';
        this.load.plugin('rexshakepositionplugin', pluginUrl, true);
    } else {
        this.load.image('p1_foot', 'assets/stomp_p1.png')
        this.load.image('p2_foot', 'assets/stomp_p2.png')
    }

    this.load.image('p1_head', 'assets/ogre1.png')
    this.load.image('p2_head', 'assets/ogre2.png')
}

var debugConsole = null;
var anvil = null;
var paused = true;
function create() {
    this.input.on('pointerup', function (pointer) {
        if (!game.scale.isFullscreen) {
            game.scale.startFullscreen()
            paused = false;
        }
        /*
        else {
            game.scale.stopFullscreen()
        }
        */
    }, this);

    if (_isGameScreen()) {
        this.add.image(300, 150, 'smithy_bg');
        players.body = this.add.image(300, 135, 'ogre_body');
        players.body.shake = this.plugins.get('rexshakepositionplugin').add(players.body, {
            duration: 200,
            magnitude: 2,
        }).on('complete', function () {});
        players.p1.head = this.add.image(250, 105, 'p1_head');
        players.p1.head.shake = this.plugins.get('rexshakepositionplugin').add(players.p1.head, {
            duration: 200,
            magnitude: 1,
        }).on('complete', function () {});
        players.p2.head = this.add.image(350, 105, 'p2_head');
        players.p2.head.shake = this.plugins.get('rexshakepositionplugin').add(players.p2.head, {
            duration: 150,
            magnitude: 1,
        }).on('complete', function () {});
        anvil = this.add.image(300, 325, 'anvil');
        anvil.shake = this.plugins.get('rexshakepositionplugin').add(anvil, {
            duration: 400,
            magnitude: 4,
        }).on('complete', function () {});
    }

    var gameUrl = 'https://ooz.github.io/ogre-forge/?gameId=pp_' + parameters.gameId;
    // https://developers.google.com/chart/infographics/docs/qr_codes?csw=1
    get('game-qrcode').setAttribute('src', 'https://chart.googleapis.com/chart?cht=qr&chs=300x300&chl=' + encodeURI(gameUrl));

    debugConsole = this.add.text(10, 10, '', { font: '16px Courier', fill: '#00ff00' });
}

var button = null;
var gyroMagnitude = 0.0;
function _initUI() {
    if (button != null) return;

    if (_isValidPlayer()) {
        this.add.image(WIDTH / 2, 500, players.me.number + '_head');
        button = this.add.sprite(WIDTH / 2, HEIGHT / 2, players.me.number + '_foot').setInteractive();
        button.on('pointerup', function () {
            if (conn != null) {
                if (_isValidPlayer()) {
                    conn.send(players.me.number + '_stomp');
                }
            }
        });

        if (gyro.hasFeature('devicemotion')) {
            gyro.frequency = 50; // ms
            gyro.startTracking(_onGyro);
        }

        this.cameras.main.backgroundColor = Phaser.Display.Color.HexStringToColor("#c2b280");
    }
}

function _onGyro(o) {
    let magnitude = Math.sqrt(o.x * o.x + o.y * o.y + o.z * o.z);
    gyroMagnitude = Math.max(magnitude, gyroMagnitude);
}

function _isGameScreen() {
    return parameters.player == 'screen';
}
function _isValidPlayer() {
    return players.me.number == 'p1' || players.me.number == 'p2';
}

const GOLD_LOSS_PER_SEC = 10;
var gameState = _initGameState()
function _initGameState() {
    return {
        gold: 1000,
        lastPrintTimeInMs: 0
    }
}
function update(time, delta) {
    this._initUI();
    if (!game.scale.isFullScreen) game.paused = true;

    if (_isValidPlayer() && conn != null) {
        if (gyroMagnitude >= 23.0) {
            //debug("Gyro: " + gyroMagnitude);
            conn.send(players.me.number + '_bash');
            gyroMagnitude = 0.0;
        }
    } else if (_isGameScreen()) {
        _updateGold(time, delta)

        // P1 input
        if (players.p1.commands.length > 0) {
            var cmd = players.p1.commands.shift();
            debug("P1: " + cmd);
            if (cmd == 'bash') {
                gameState.gold += 10;
            } else if (cmd == 'stomp') {
                // move obj left
            }
            if (players.body != null) players.body.shake.shake();
            if (players.p1.head != null) players.p1.head.shake.shake();
            if (anvil != null) anvil.shake.shake();
        }
        // P2 input
        if (players.p2.commands.length > 0) {
            var cmd = players.p2.commands.shift();
            debug("P2: " + cmd);
            if (cmd == 'bash') {
                gameState.gold += 10;
            } else if (cmd == 'stomp') {
                // move obj right
            }
            if (players.body != null) players.body.shake.shake();
            if (players.p2.head != null) players.p2.head.shake.shake();
            if (anvil != null) anvil.shake.shake();
        }
    }
}
function _updateGold(time, delta) {
    if (paused) return;

    gameState.gold -= (GOLD_LOSS_PER_SEC / 1000.0) * delta;
    gameState.gold = Math.max(gameState.gold, 0);
    if (time - gameState.lastPrintTimeInMs >= 3000) {
        debug("Gold: " + gameState.gold.toFixed(0))
        gameState.lastPrintTimeInMs = time;
    }
}
// ## GAME CALLBACKS END

// ## UTIL LIB
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

function createGameId() {
    // From https://gist.github.com/6174/6062387
    return [...Array(64)].map(i=>(~~(Math.random()*36)).toString(36)).join('')
}

function get(id) {
    return document.getElementById(id)
}

var debugLines = [];
function debug(text) {
    console.log(text);
    debugLines.push(text);
    while (debugLines.length > 5) {
        debugLines.shift()
    }
    if (debugConsole != null) {
        debugConsole.setText(debugLines)
    }
}
// ## UTIL LIB END
