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
const DEBUG = false;

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
        arcade: { debug: DEBUG }
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
        commands: [],
        head: null
    },
    p2: {
        id: null,
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
                conn.send('pl_1');
                debug('Welcome Player 1!')
            } else if (players.p2.id == null) {
                players.p2.id = playerId;
                conn.send('pl_2');
                debug('Welcome Player 2!')
            } else {
                conn.send('pl_0'); // reject
                debug('Max. 2 heads, max. 2 players! O_o')
            }
          }
          if (data.startsWith('p1_') || data.startsWith('p2_')) {
            var playerId = data.substr(0, 2);
            var command = data.substr(3);
            players[playerId].commands.push(command)
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
        this.load.image('ogre_body', 'assets/ogre_body_short_bb.png')

        this.load.image('hammer', 'assets/hammer.png')
        this.load.image('sword', 'assets/sword.png')
        this.load.image('staff', 'assets/staff.png')
        this.load.image('heart', 'assets/heart_broken.png')
        this.load.image('heart_healed', 'assets/heart_healed.png')

        this.load.audio('kaching', ['assets/sounds/Kaching.ogg', 'assets/sounds/Kaching.mp3']);
        this.load.audio('stomp', ['assets/sounds/STOMP_RAY.ogg', 'assets/sounds/STOMP_RAY.mp3']);
        this.load.audio('kling', ['assets/sounds/KLING.ogg', 'assets/sounds/KLING.mp3']);
        this.load.audio('kling_pitch', ['assets/sounds/KLING_PITCH.ogg', 'assets/sounds/KLING_PITCH.mp3']);
        this.load.audio('woosh', ['assets/sounds/WOOSH_RAY.ogg', 'assets/sounds/WOOSH_RAY.mp3']);
        this.load.audio('krach_bumm', ['assets/sounds/OgreForge_Daneben.ogg', 'assets/sounds/OgreForge_Daneben.mp3']);

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
    this.load.image('bash', 'assets/bash.png')
    this.load.image('magic', 'assets/magic.png')
}

const SPEED = 300;
var weapon = {
    sprite: null,
    physics: null,
    alive: true,
    claimed: false,
    type: '',
    position: 1, // 0 left, 1 middle, 2 right; lower than 0: fall off left, higher than 2: fall off right
    target: {x: 300, y: 270},
    model: {},
    loss: 0,
    gain: 0,
    exists: function() {
        return this.sprite != null;
    },
    isOnAnvil: function() {
        return this.position >= 0 && this.position <= 2 && this.alive;
    },
    moveLeft: function() {
        if (this.sprite == null) { return; }
        playSound(sounds.stomp);
        if (!this.isOnAnvil()) { return; }

        this.position -= 1;
        if (this.position < 0) {
            this.fallOff();
        }
        this.target = targetForPosition(this.position);
        this.physics.moveTo(this.sprite, this.target.x, this.target.y, SPEED)
    },
    moveRight: function() {
        if (this.sprite == null) { return; }
        playSound(sounds.stomp);
        if (!this.isOnAnvil()) { return; }

        this.position += 1;
        if (this.position > 2) {
            this.fallOff();
        }
        this.target = targetForPosition(this.position);
        this.physics.moveTo(this.sprite, this.target.x, this.target.y, SPEED)
    },
    fallOff: function() {
        if (this.sprite == null) { return; }
        this.alive = false;
        this.target = targetForPosition(this.position);
        this.physics.moveTo(this.sprite, this.target.x, this.target.y, SPEED * 4)
    },
    breakOff: function() {
        if (this.sprite == null) { return; }
        this.alive = false;
        this.target = {x: 300, y: 360}
        this.physics.moveTo(this.sprite, this.target.x, this.target.y, SPEED * 3)
    },
    cashIn: function() {
        if (this.sprite == null) { return; }
        if (this.type == 'heart') {
            this.sprite.setTexture('heart_healed');
        } else {
            this.sprite.setTint(0xffffff);
        }

        this.alive = false;
        this.target = {x: 300, y: -60}
        this.physics.moveTo(this.sprite, this.target.x, this.target.y, SPEED * 2)
    },
    bash: function() {
        if (this.sprite == null) { return; }

        if (random(1, 2) == 1) {
            playSound(sounds.kling);
        } else {
            playSound(sounds.klingPitch);
        }

        var modelKey = `b${this._translatePositionForHit(this.position)}`;
        this._hit(modelKey);
    },
    magic: function() {
        if (this.sprite == null) { return; }

        playSound(sounds.woosh);

        var modelKey = `m${this._translatePositionForHit(this.position)}`;
        this._hit(modelKey);
    },
    _translatePositionForHit: function(pos) {
        if (pos == 0) {
            return 2
        } else if (pos == 2) {
            return 0
        }
        return pos;
    },
    _hit: function(modelKey) {
        if (!this.alive) { return; }
        this.model.hit(modelKey);
        if (this.model.isREPAIRED()) {
            this.cashIn();
        }
        if (this.model.isBroken()) {
            this.breakOff();
        }
    },
    update: function(time, delta) {
        if (this.sprite == null) { return; }
        if (this.sprite.body.speed > 0) {
            var distance = Phaser.Math.Distance.Between(this.sprite.x, this.sprite.y, this.target.x, this.target.y);

            if (distance < 8 || (this.sprite.y > 310 && distance < 16) || (this.sprite.y < -10 && distance < 16)) { // Reached target, higher tolerance for speedy offscreen move
                this.sprite.body.reset(this.target.x, this.target.y);

                if (this.sprite.y > 330) { // Sprite is offscreen, fell off --> KrachBumm sound, destroy and spawn new weapon
                    playSound(sounds.krachBumm);
                    gameState.gold -= this.loss;
                    debug("-" + this.loss);
                    this.claimed = true;
                } else if (this.sprite.y < -30) { // Sprite lifted offscreen, successfully repaired --> Kaching sound, destroy, get gold and spawn new weapon
                    playSound(sounds.kaching);
                    gameState.gold += this.gain;
                    debug("+" + this.gain);
                    this.claimed = true;
                }
            }
        }
    }
};
function _newWeapon(type, initialPosition=1) {
    weapon.type = type;
    if (weapon.sprite != null) weapon.sprite.destroy();

    weapon.position = initialPosition;
    var screenPosition = targetForPosition(initialPosition);
    weapon.sprite = this.physics.add.image(screenPosition.x, screenPosition.y, type)
    weapon.sprite.setDepth(10);
    if (type != 'heart') weapon.sprite.setTint(0xb7410e); // rust color
    weapon.physics = this.physics;
    weapon.alive = true;
    weapon.claimed = false;
    var flip = (random(0, 1)) ? true : false;
    if (flip && type != 'heart') {
        weapon.sprite.angle = 180;
    }
    switch (type) {
        case 'hammer':
            weapon.model = (!flip) ? newWeaponModel(0, 0, 0, 0, 2, 0) : newWeaponModel(2, 0, 0, 0, 0, 0);
            weapon.gain = 100;
            weapon.loss = 30;
            break;
        case 'sword':
            weapon.model = (!flip) ? newWeaponModel(-1, 0, 1, 0, 1, 0) : newWeaponModel(1, 0, 1, 0, -1, 0);
            weapon.gain = 150;
            weapon.loss = 70;
            break;
        case 'staff':
            weapon.model = (!flip) ? newWeaponModel(1, 0, 1, 0, -1, 2) : newWeaponModel(-1, 2, 1, 0, 1, 0);
            weapon.gain = 200;
            weapon.loss = 100;
            break;
        case 'heart':
            weapon.model = newWeaponModel(0, 0, -1, 1, 0, 0);
            weapon.gain = 500;
            weapon.loss = 1000;
            break;
    }
}
// left, middle, right; B .. Bash, M .. Magic
// 1 or 2: respective number of hits needed
// 0: no effect if hit
// -1: breaking/fly off it hit
function newWeaponModel(leftB, leftM, middleB, middleM, rightB, rightM) {
    return {
        b0: leftB,
        m0: leftM,
        b1: middleB,
        m1: middleM,
        b2: rightB,
        m2: rightM,
        hit: function(key) {
            if (key != 'b0' && key != 'm0' && key != 'b1' && key != 'm1' && key != 'b2' && key != 'm2') { return; }
            var value = this[key];
            if (value != 0) { // 0 .. no effect, no need to act
                this[key] = value - 1;
            }
        },
        isBroken: function() {
            return this.b0 < -1 || this.m0 < -1 || this.b1 < -1 || this.m1 < -1 || this.b2 < -1 || this.m2 < -1;
        },
        isREPAIRED: function() {
            return this._isPartREPAIRED(this.b0) && this._isPartREPAIRED(this.m0) && this._isPartREPAIRED(this.b1) && this._isPartREPAIRED(this.m1) && this._isPartREPAIRED(this.b2) && this._isPartREPAIRED(this.m2)
        },
        _isPartREPAIRED: function(part) {
            return part == 0 || part == -1;
        }
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
        y = 360;
    } else if (position > 2) {
        x = 500;
        y = 360;
    }
    return {
        x: x,
        y: y,
    }
}

var debugConsole = null;
var goldUI = null;
var anvil = null;
var paused = true;
var sounds = {
    kaching: null,
    stomp: null,
    kling: null,
    klingPitch: null,
    grunz: null,
    grunzgrunz: null,
    woosh: null,
    krachBumm: null
}
var effects = {
    bash: null,
    magic: null
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
    }, this);

    if (_isGameScreen()) {
        this.add.image(300, 150, 'smithy_bg');

        players.body = this.add.image(300, 135, 'ogre_body');
        _addShaker(players.body, 200, 2)
        players.p1.head = this.add.image(250, 105, 'p1_head');
        _addShaker(players.p1.head, 200, 1)
        players.p2.head = this.add.image(350, 105, 'p2_head');
        _addShaker(players.p2.head, 200, 1)
        anvil = this.add.image(300, 325, 'anvil');
        _addShaker(anvil, 400, 4)

        this._newWeapon(FIRST_WEAPON);

        effects.bash = this.add.image(300, 263, 'bash');
        effects.bash.alpha = 0.0;
        effects.bash.setDepth(99);
        effects.magic = this.add.image(300, 250, 'magic');
        effects.magic.alpha = 0.0;
        effects.magic.setDepth(99);

        sounds.kaching = this.sound.add('kaching');
        sounds.stomp = this.sound.add('stomp');
        sounds.kling = this.sound.add('kling');
        sounds.klingPitch = this.sound.add('kling_pitch');
        sounds.woosh = this.sound.add('woosh');
        sounds.krachBumm = this.sound.add('krach_bumm');

        goldUI = this.add.text(300, 10, '', { font: '16px Courier', fill: '#ffff00' });

        var thisGameLink = 'https://ooz.github.io/ogre-forge/?gameId=' + parameters.gameId + '&sp=' + parameters.singlePlayer;
        get('restart-game-link').setAttribute('href', encodeURI(thisGameLink));

        var gameType = (parameters.singlePlayer) ? 'sp' : 'pp';
        var gameUrl = 'https://ooz.github.io/ogre-forge/?gameId=' + gameType + '_' + parameters.gameId;
        // https://developers.google.com/chart/infographics/docs/qr_codes?csw=1
        get('game-qrcode').setAttribute('src', 'https://chart.googleapis.com/chart?cht=qr&chs=250x250&chld=L|0&chl=' + encodeURI(gameUrl));

        removeElement('smartphone-instructions')
    } else {
        // Don't need QR-Code and game links on smartphone controller
        removeElement('game-setup')
        removeElement('credits')
    }

    debugConsole = this.add.text(10, 10, '', { font: '16px Courier', fill: '#ffff00' });
}

function _addShaker(gameObj, duration, magnitude) {
    gameObj.shake = this.plugins.get('rexshakepositionplugin').add(gameObj, {
        duration: duration,
        magnitude: magnitude,
    }).on('complete', function () {});
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
                if (conn != null && !paused) {
                    if (_isValidPlayer()) {
                        conn.send('p2_stomp');
                    }
                }
            });
            var bashButton1 = this.add.sprite(75, 100, 'magic').setInteractive();
            bashButton1.on('pointerup', function () {
                if (conn != null && !paused) {
                    if (_isValidPlayer()) {
                        conn.send('p1_bash');
                    }
                }
            });
            var bashButton2 = this.add.sprite(225, 100, 'bash').setInteractive();
            bashButton2.on('pointerup', function () {
                if (conn != null && !paused) {
                    if (_isValidPlayer()) {
                        conn.send('p2_bash');
                    }
                }
            });
        } else {
            var graphic = 'magic';
            if (players.me.number == 'p2') {
                graphic = 'bash'
            }
            var basher = this.add.sprite(WIDTH / 2, 100, graphic).setInteractive();
            basher.on('pointerup', function () {
                if (conn != null && !paused) {
                    if (_isValidPlayer()) {
                        conn.send(players.me.number + '_bash');
                    }
                }
            });
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
            if (conn != null && !paused) {
                if (_isValidPlayer()) {
                    conn.send(players.me.number + '_stomp');
                }
            }
        });

        if (gyro.hasFeature('devicemotion')) {
            gyro.frequency = 50; // ms
            gyro.startTracking(_onGyro);
        }
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
        _updateEffects();

        if (weapon.claimed) {
            var nextWeapon = random(0, 3);
            var initialPosition = random(0, 2);
            this._newWeapon(WEAPON_TYPES[nextWeapon], initialPosition);
        }

        // P1 input
        if (players.p1.commands.length > 0) {
            var cmd = players.p1.commands.shift();
            //debug("P1: " + cmd);
            if (cmd == 'bash') {
                effects.magic.alpha = 1.0;
                weapon.magic();
            } else if (cmd == 'stomp') {
                weapon.moveLeft();
            }
            if (players.body != null && cmd == 'stomp') players.body.shake.shake();
            if (players.p1.head != null && cmd == 'bash') players.p1.head.shake.shake();
            if (anvil != null) anvil.shake.shake();
        }
        // P2 input
        if (players.p2.commands.length > 0) {
            var cmd = players.p2.commands.shift();
            //debug("P2: " + cmd);
            if (cmd == 'bash') {
                effects.bash.alpha = 1.0;
                weapon.bash();
            } else if (cmd == 'stomp') {
                weapon.moveRight();
            }
            if (players.body != null && cmd == 'stomp') players.body.shake.shake();
            if (players.p2.head != null && cmd == 'bash') players.p2.head.shake.shake();
            if (anvil != null) anvil.shake.shake();
        }

        weapon.update(time, delta);
    }
}
function _updateGold(time, delta) {
    if (goldUI != null) {
        goldUI.setText(gameState.gold.toFixed(0))
    }
    if (paused) return;

    gameState.gold -= (GOLD_LOSS_PER_SEC / 1000.0) * delta;
    gameState.gold = Math.max(gameState.gold, 0);

    var fadeoutTime = (DEBUG) ? 3000 : 6000;
    if (time - gameState.lastPrintTimeInMs >= fadeoutTime) {
        //debug("Gold: " + gameState.gold.toFixed(0))
        debug(""); // debug fade-out
        gameState.lastPrintTimeInMs = time;
    }
}
function _updateEffects() {
    if (effects.bash == null || effects.magic == null) return;

    _fadeOutEffect('bash')
    _fadeOutEffect('magic')
}
function _fadeOutEffect(effectName) {
    var alpha = effects[effectName].alpha;
    if (alpha > 0.0) {
        alpha -= 0.085;
        if (alpha < 0.0) alpha = 0.0;
        effects[effectName].alpha = alpha;
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

function removeElement(elemId) {
    var toRemove = get(elemId);
    toRemove.parentNode.removeChild(toRemove);
}

function random(min, max) {
    return Phaser.Math.RND.between(min, max);
}

var debugLines = [];
function debug(text) {
    if (text !== "") console.log(text);
    debugLines.push(text);
    var nrDebugLines = (DEBUG) ? 5 : 1;
    while (debugLines.length > nrDebugLines) {
        debugLines.shift()
    }
    if (debugConsole != null) {
        debugConsole.setText(debugLines)
    }
}
// ## UTIL LIB END
