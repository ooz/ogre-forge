/*
## Ogre Protocol

pp_<gameId> .. multiplayer game prefix
sp_<gameId> .. singleplayer game prefix

hi_<playerId>     .. handshake/player sign-up
pl_<playerNumber> .. player number assignment by game (1, 2 .. players, 0 .. reject)
p1_<action>       .. player 1 action command
p2_<action>       .. player 2 action command
*/

const WEAPON_TYPES = ['hammer', 'sword', 'staff', 'heart']
const FIRST_WEAPON = 'hammer'

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
    physics: {
        default: 'arcade',
        arcade: { debug: true }
    },
    scene: {
        preload: preload,
        create: create,
        update: update,
        extend: {
            _initUI: _initUI,
            _newWeapon: _newWeapon
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
            if (players.p1.id == null || parameters.singlePlayer) {
                players.p1.id = playerId;
                players.p1.conn = conn;
                conn.send('pl_1');
                debug('Welcome Player 1!')
            } else if (players.p2.id == null) {
                players.p2.id = playerId;
                players.p2.conn = conn;
                conn.send('pl_2');
                debug('Welcome Player 2!')
            } else {
                conn.send('pl_0'); // reject
                debug('Max. 2 heads, max. 2 players! O_o')
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
        // Screen / PC / game assets only
        this.load.image('anvil', 'assets/anvil.png')
        this.load.image('smithy_bg', 'assets/smithy_bg.png')
        this.load.image('ogre_body', 'assets/ogre_body_short.png')

        this.load.image('hammer', 'assets/hammer.png')
        this.load.image('sword', 'assets/sword.png')
        this.load.image('staff', 'assets/staff.png')
        this.load.image('heart', 'assets/heart_broken.png')

        this.load.audio('kaching', ['assets/sounds/Kaching.ogg', 'assets/sounds/Kaching.mp3']);
        this.load.audio('stomp', ['assets/sounds/STOMP_RAY.ogg', 'assets/sounds/STOMP_RAY.mp3']);
        this.load.audio('kling', ['assets/sounds/KLING.ogg', 'assets/sounds/KLING.mp3']);
        this.load.audio('kling_pitch', ['assets/sounds/KLING_PITCH.ogg', 'assets/sounds/KLING_PITCH.mp3']);
        this.load.audio('woosh', ['assets/sounds/WOOSH_RAY.ogg', 'assets/sounds/WOOSH_RAY.mp3']);

        // From https://github.com/rexrainbow/phaser3-rex-notes/blob/master/docs/docs/shake-position.md
        var pluginUrl = 'https://raw.githubusercontent.com/rexrainbow/phaser3-rex-notes/master/dist/rexshakepositionplugin.min.js';
        this.load.plugin('rexshakepositionplugin', pluginUrl, true);
    } else {
        // Controller / smartphone / client assets only
        this.load.image('p1_foot', 'assets/stomp_p1.png')
        this.load.image('p2_foot', 'assets/stomp_p2.png')

        this.load.audio('grunz', ['assets/sounds/GRUNZ.ogg', 'assets/sounds/GRUNZ.mp3']);
        this.load.audio('grunzgrunz', ['assets/sounds/GRUNZGRUNZ.ogg', 'assets/sounds/GRUNZGRUNZ.mp3']);
    }

    // Common assets
    this.load.image('p1_head', 'assets/ogre1.png')
    this.load.image('p2_head', 'assets/ogre2.png')
}

const SPEED = 300;
var weapon = {
    primary: {
        sprite: null,
        physics: null,
        type: '',
        position: 1, // 0 left, 1 middle, 2 right; lower than 0: fall off left, higher than 2: fall off right
        target: {x: 300, y: 270},
        model: {},
        gain: 0,
        exists: function() {
            return this.sprite != null;
        },
        moveLeft: function() {
            if (this.sprite == null || !this.isOnAnvil()) { return; }
            this.position -= 1;
            if (this.position < 0) {
                this.fallOff();
            }
            this.target = targetForPosition(this.position);
            this.physics.moveTo(this.sprite, this.target.x, this.target.y, SPEED)

            playSound(sounds.stomp);
        },
        isOnAnvil: function() {
            return this.position >= 0 && this.position <= 2;
        },
        moveRight: function() {
            if (this.sprite == null || !this.isOnAnvil()) { return; }
            this.position += 1;
            if (this.position > 2) {
                this.fallOff(position);
            }
            this.target = targetForPosition(this.position);
            this.physics.moveTo(this.sprite, this.target.x, this.target.y, SPEED)

            playSound(sounds.stomp);
        },
        fallOff: function() {
            if (this.sprite == null) { return; }

            this.target = targetForPosition(this.position);
            this.physics.moveTo(this.sprite, this.target.x, this.target.y, SPEED)
        },
        bash: function() {
            if (this.sprite == null) { return; }

            if (random(1, 2) == 1) {
                playSound(sounds.kling);
            } else {
                playSound(sounds.klingPitch);
            }
        },
        magic: function() {
            if (this.sprite == null) { return; }

            playSound(sounds.woosh);
        },
        update: function(time, delta) {
            if (this.sprite == null) { return; }
            if (this.sprite.body.speed > 0) {
                var distance = Phaser.Math.Distance.Between(this.sprite.x, this.sprite.y, this.target.x, this.target.y);

                if (distance < 8) { // Reached target
                    this.sprite.body.reset(this.target.x, this.target.y);

                    if (this.sprite.y > 330) { // Sprite is offscreen, fell off --> KrachBumm sound, destroy and spawn new weapon
                        debug("SPRITE OFFSCREEN")
                    }
                }
            }
        }
    },
    queue: null,
    fadeoutQueue: null
};
function _newWeapon(type) {
    weapon.primary.type = type;
    weapon.primary.sprite = this.physics.add.image(300, 270, type)
    weapon.primary.physics = this.physics;
    if (type == 'hammer') {
        weapon.primary.model = newWeaponModel(0, 0, 0, 0, 2, 0);
        weapon.primary.gain = 100;
    } else if (type == 'sword') {
        weapon.primary.model = newWeaponModel(-1, 0, 1, 0, 1, 0);
        weapon.primary.gain = 150;
    } else if (type == 'staff') {
        weapon.primary.model = newWeaponModel(1, 0, 1, 0, -1, 2);
        weapon.primary.gain = 200;
    } else if (type == 'heart') {
        weapon.primary.model = newWeaponModel(0, 0, -1, 1, 0, 0);
        weapon.primary.gain = 1000;
    }
}
// left, middle, right; B .. Bash, M .. Magic
// 1 or 2: respective number of hits needed
// 0: no effect if hit
// -1: breaking/fly off it hit
function newWeaponModel(leftB, leftM, middleB, middleM, rightB, rightM) {
    return {
        leftB: leftB,
        leftM: leftM,
        middleB: middleB,
        middleM: middleM,
        rightB: rightB,
        rightM: rightM
    }
}
function targetForPosition(position) {
    // center, default
    var x = 300;
    var y = 270;
    if (position == 0) {
        x = 220;
    } else if (position == 2) {
        x = 380;
    } else if (position < 0) {
        x = 100;
        y = 350;
    } else if (position > 2) {
        x = 500;
        y = 350;
    }
    return {
        x: x,
        y: y,
    }
}

var debugConsole = null;
var anvil = null;
var paused = true;
var sounds = {
    kaching: null,
    stomp: null,
    kling: null,
    klingPitch: null,
    grunz: null,
    grunzgrunz: null,
    woosh: null
}
//var lastSound = null;
function playSound(sound, delay=0) {
    if (delay == 0) {
        sound.play();
    } else {
        sound.play({delay: delay});
    }
}
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

        this._newWeapon(FIRST_WEAPON);

        sounds.kaching = this.sound.add('kaching');
        sounds.stomp = this.sound.add('stomp');
        sounds.kling = this.sound.add('kling');
        sounds.klingPitch = this.sound.add('kling_pitch');
        sounds.woosh = this.sound.add('woosh');
    }

    var gameType = (parameters.singlePlayer) ? 'sp' : 'pp';
    var gameUrl = 'https://ooz.github.io/ogre-forge/?gameId=' + gameType + '_' + parameters.gameId;
    // https://developers.google.com/chart/infographics/docs/qr_codes?csw=1
    get('game-qrcode').setAttribute('src', 'https://chart.googleapis.com/chart?cht=qr&chs=300x300&chl=' + encodeURI(gameUrl));

    debugConsole = this.add.text(10, 10, '', { font: '16px Courier', fill: '#00ff00' });
}

var button = null;
var gyroMagnitude = 0.0;
function _initUI() {
    if (button != null) return;

    if (_isValidPlayer()) {
        sounds.grunz = this.sound.add('grunz');
        sounds.grunzgrunz = this.sound.add('grunzgrunz');

        if (parameters.singlePlayer) {
            var button2 = this.add.sprite(WIDTH / 2, 500, 'p2_foot').setInteractive();
            button2.on('pointerup', function () {
                if (conn != null) {
                    if (_isValidPlayer()) {
                        conn.send('p2_stomp');
                    }
                }
            });
            var bashButton1 = this.add.sprite(75, 100, 'p1_head').setInteractive();
            bashButton1.on('pointerup', function () {
                if (conn != null) {
                    if (_isValidPlayer()) {
                        conn.send('p1_bash');
                    }
                }
            });
            var bashButton2 = this.add.sprite(225, 100, 'p2_head').setInteractive();
            bashButton2.on('pointerup', function () {
                if (conn != null) {
                    if (_isValidPlayer()) {
                        conn.send('p2_bash');
                    }
                }
            });
        } else {
            this.add.image(WIDTH / 2, 500, players.me.number + '_head');
        }

        if (parameters.singlePlayer) {
            playSound(sounds.grunz);
            playSound(sounds.grunzgrunz, 1);
        } else if (players.me.number == 'p1') {
            playSound(sounds.grunz);
        } else if (players.me.number == 'p2') {
            playSound(sounds.grunzgrunz);
        }

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

        //this.cameras.main.backgroundColor = Phaser.Display.Color.HexStringToColor("#c2b280");
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

    if (_isValidPlayer() && conn != null) {
        if (gyroMagnitude >= 23.0) {
            //debug("Gyro: " + gyroMagnitude);
            if (parameters.singlePlayer) {
                conn.send('p2_bash'); // For single player we want the smartphone shake to always be a physical hit
            } else {
                conn.send(players.me.number + '_bash');
            }

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
                weapon.primary.magic();
            } else if (cmd == 'stomp') {
                weapon.primary.moveLeft();
            }
            if (players.body != null && cmd == 'stomp') players.body.shake.shake();
            if (players.p1.head != null && cmd == 'bash') players.p1.head.shake.shake();
            if (anvil != null) anvil.shake.shake();
            debug("Paused: " + paused)
        }
        // P2 input
        if (players.p2.commands.length > 0) {
            var cmd = players.p2.commands.shift();
            debug("P2: " + cmd);
            if (cmd == 'bash') {
                gameState.gold += 10;
                weapon.primary.bash();
            } else if (cmd == 'stomp') {
                weapon.primary.moveRight();
            }
            if (players.body != null && cmd == 'stomp') players.body.shake.shake();
            if (players.p2.head != null && cmd == 'bash') players.p2.head.shake.shake();
            if (anvil != null) anvil.shake.shake();
            debug("Paused: " + paused)
        }

        weapon.primary.update(time, delta);
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
    var singlePlayer = url.searchParams.get('sp') || 'false';
    singlePlayer = (singlePlayer == 'true') ? true : false;
    var player = 'screen';
    var playerId = 'screen'
    if (gameId.startsWith('pp_')) {
        gameId = gameId.substr(3);
        player = 'pp';
        playerId = createGameId();
        singlePlayer = false;
    }
    if (gameId.startsWith('sp_')) {
        gameId = gameId.substr(3);
        player = 'sp';
        playerId = createGameId();
        singlePlayer = true;
    }
    return {
        'gameId': gameId,
        'player': player,
        'playerId': playerId,
        'singlePlayer': singlePlayer
    }
}

function createGameId() {
    // From https://gist.github.com/6174/6062387
    return [...Array(64)].map(i=>(~~(Math.random()*36)).toString(36)).join('')
}

function get(id) {
    return document.getElementById(id)
}

function random(min, max) {
    return Phaser.Math.RND.between(min, max);
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
