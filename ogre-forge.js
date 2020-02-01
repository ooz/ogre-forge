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
    this.load.setBaseURL('http://labs.phaser.io');

    this.load.image('sky', 'assets/skies/space3.png');
    this.load.image('red', 'assets/particles/red.png');
}

function create ()
{
    this.add.image(400, 300, 'sky');

    var particles = this.add.particles('red');

    var emitter = particles.createEmitter({
        speed: 100,
        scale: { start: 1, end: 0 },
        blendMode: 'ADD'
    });

    emitter.start();

    this.input.on('pointerup', function (pointer) {
        if (!game.scale.isFullscreen) {
            game.scale.startFullscreen()
        } else {
            game.scale.stopFullscreen()
        }
    }, this);

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
    if (gameId.startsWith('p1_')) {
        gameId = gameId.substr(3);
        player = 'p1';
    }
    return {
        'gameId': gameId,
        'player': player
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