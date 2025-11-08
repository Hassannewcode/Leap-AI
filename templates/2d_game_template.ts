import type { FileEntry } from '../types';
import { getEngineScript } from '../lib/engine';

export const gameTemplate2D = (): FileEntry[] => {
    const engineScript = getEngineScript('2D');

    const indexHtml = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
    <title>AI 2D Game</title>
    <link rel="stylesheet" href="style.css">
</head>
<body>
    <canvas id="game-canvas"></canvas>
    
    <!-- Audio Assets -->
    <audio id="offline-sound-shoot" src="assets/shoot.mp3" preload="auto"></audio>
    <audio id="offline-sound-explosion" src="assets/explosion.mp3" preload="auto"></audio>
    <audio id="offline-sound-gameOver" src="assets/gameOver.mp3" preload="auto"></audio>
    <audio id="offline-sound-music" src="assets/music.mp3" preload="auto" loop></audio>

    <script id="engine-script">
// --- Leap AI Engine ---
${engineScript}
// --- End Engine ---
    </script>
    <script type="module" src="./scripts/main.js" id="game-logic"></script>
</body>
</html>`;

    const styleCss = `
body { 
    margin: 0; 
    overflow: hidden; 
    background: #000; 
}
canvas { 
    display: block; 
}
audio {
    display: none;
}
`;

    const mainJs = `
// --- main.js: Game Logic Layer ---
console.log("Leap Engine 2D Initialized.");

const V_SIZE = Engine.getVirtualSize();
Engine.setScalingStrategy('fit'); 

// --- Scene Definitions ---

// Start Scene (Menu)
Engine.scene.define('start', {
    onEnter: () => {
        const titleText = Engine.create.sprite({ name: 'titleText', type: 'ui', x: V_SIZE.width / 2, y: V_SIZE.height / 3, alpha: 0 });
        Engine.ui.drawText({ target: titleText, text: 'JAVASCRIPT SHOOTER', size: 80, color: '#ffdd00', font: 'sans-serif', align: 'center' });
        Engine.tween.create(titleText, { alpha: 1 }, { duration: 2000, ease: 'easeIn' }).start();

        const startPrompt = Engine.create.sprite({ name: 'startPrompt', type: 'ui', x: V_SIZE.width / 2, y: V_SIZE.height * 0.6 });
        Engine.ui.drawText({ target: startPrompt, text: 'Press ANY KEY to Begin\\nUse WASD or Arrows to Move\\nUse SPACE to Shoot', size: 36, color: 'white', font: 'monospace', align: 'center' });
    },
    onUpdate: () => {
        if (Engine.input.wasAnyInputJustPressed()) {
            Engine.scene.load('main');
        }
    }
});

// Main Game Scene
Engine.scene.define('main', {
    onEnter: () => {
        const music = document.getElementById('offline-sound-music');
        if (music) {
            music.currentTime = 0;
            music.play().catch(e => console.warn("Music playback failed.", e));
        }

        Engine.setData('score', 0);
        Engine.setData('isGameOver', false);
        Engine.setData('obstacleSpeed', 100);
        Engine.setData('obstacleSpawnRate', 1.2);
        Engine.setData('timeSinceLastObstacle', 0);

        const player = Engine.create.sprite({
            name: 'player',
            x: V_SIZE.width / 2,
            y: V_SIZE.height - 100,
            width: 50,
            height: 50,
            color: 'white',
            clampToScreen: true,
            drag: 0.1 
        });
        Engine.setData('player', player);

        const scoreText = Engine.create.sprite({ name: "scoreText", type: "ui", x: 20, y: 40 });
        Engine.setData('scoreText', scoreText);

        const gameOverText = Engine.create.sprite({ name: "gameOverText", type: "ui", x: V_SIZE.width/2, y: V_SIZE.height/2, alpha: 0 });
        Engine.setData('gameOverText', gameOverText);
    },
    onUpdate: (deltaTime) => {
        const isGameOver = Engine.getData('isGameOver');

        if (isGameOver) {
            handleGameOver(deltaTime);
        } else {
            handlePlayerInput();
            handleObstacleSpawning(deltaTime);
            handleCollisions();
            updateUI();
        }
    },
    onExit: () => {
        const music = document.getElementById('offline-sound-music');
        if (music) music.pause();
    }
});

function handlePlayerInput() {
    const player = Engine.getData('player');
    if (!player) return;

    const playerSpeed = 600;

    // Horizontal Movement (sets velocity, drag is handled by JS engine)
    if (Engine.input.isPressed('KeyA') || Engine.input.isPressed('ArrowLeft')) {
        player.vx = -playerSpeed;
    } else if (Engine.input.isPressed('KeyD') || Engine.input.isPressed('ArrowRight')) {
        player.vx = playerSpeed;
    }
    
    // Vertical Movement
    if (Engine.input.isPressed('KeyW') || Engine.input.isPressed('ArrowUp')) {
        player.vy = -playerSpeed;
    } else if (Engine.input.isPressed('KeyS') || Engine.input.isPressed('ArrowDown')) {
        player.vy = playerSpeed;
    }

    // Shooting
    if (Engine.input.isKeyJustPressed('Space')) {
        Engine.audio.play('shoot');
        Engine.create.sprite({
            name: 'bullet',
            x: player.x,
            y: player.y - 30,
            width: 8,
            height: 25,
            color: '#ffdd00',
            vy: -850,
        });
        Engine.camera.shake(3, 0.05);
    }
}

function handleObstacleSpawning(deltaTime) {
    let timeSinceLastObstacle = Engine.getData('timeSinceLastObstacle');
    timeSinceLastObstacle += deltaTime;
    
    const obstacleSpawnRate = Engine.getData('obstacleSpawnRate');
    if (timeSinceLastObstacle > obstacleSpawnRate) {
        timeSinceLastObstacle = 0;
        const obstacleSize = 50;
        Engine.create.sprite({
            name: 'obstacle',
            x: Math.random() * (V_SIZE.width - obstacleSize) + obstacleSize / 2,
            y: -obstacleSize / 2,
            width: obstacleSize,
            height: obstacleSize,
            color: '#ff4444',
            vy: Engine.getData('obstacleSpeed'),
        });
    }
    Engine.setData('timeSinceLastObstacle', timeSinceLastObstacle);
}

function handleCollisions() {
    const player = Engine.getData('player');
    const allSprites = Engine.getAllSprites();
    const bullets = allSprites.filter(s => s.name === 'bullet');
    const obstacles = allSprites.filter(s => s.name === 'obstacle');

    // Bullets vs Obstacles
    bullets.forEach(bullet => {
        obstacles.forEach(obstacle => {
            if (Engine.physics.checkCollision(bullet, obstacle)) {
                onObstacleDestroyed(obstacle);
                bullet.destroy();
                return; // Stop checking this bullet
            }
        });
        if (bullet.y < -50) bullet.destroy();
    });

    // Player vs Obstacles
    if (player) {
        obstacles.forEach(obstacle => {
            if (Engine.physics.checkCollision(player, obstacle)) {
                onPlayerKilled(player, obstacle);
                return;
            }
        });
    }

    // Cleanup off-screen obstacles
    obstacles.forEach(obstacle => {
        if (obstacle.y > V_SIZE.height + 50) obstacle.destroy();
    });
}

function onObstacleDestroyed(obstacle) {
    Engine.audio.play('explosion');
    Engine.create.particles({ x: obstacle.x, y: obstacle.y, count: 25, color: '#A9A9A9', life: 0.8, size: 4, gravity: 200 });
    Engine.camera.shake(10, 0.15);
    obstacle.destroy();
    
    Engine.setData('score', Engine.getData('score') + 100);
    Engine.setData('obstacleSpeed', Engine.getData('obstacleSpeed') + 5);
    Engine.setData('obstacleSpawnRate', Math.max(0.2, Engine.getData('obstacleSpawnRate') * 0.985));
}

function onPlayerKilled(player, obstacle) {
    Engine.audio.play('gameOver');
    Engine.create.particles({ x: player.x, y: player.y, count: 80, color: '#ff0000', life: 1.5, size: 5, gravity: 100 });
    Engine.camera.shake(30, 0.7);
    player.destroy();
    obstacle.destroy();
    Engine.setData('player', null);
    Engine.setData('isGameOver', true);
}

function updateUI() {
    const scoreText = Engine.getData('scoreText');
    const score = Engine.getData('score');
    Engine.ui.drawText({
        target: scoreText,
        text: 'Score: ' + score,
        size: 36, color: '#aaffaa', font: 'monospace'
    });
}

function handleGameOver(deltaTime) {
    const gameOverText = Engine.getData('gameOverText');
    const score = Engine.getData('score');
    
    if (gameOverText.alpha < 1) {
        gameOverText.alpha += deltaTime * 0.5;
    }
    Engine.ui.drawText({
        target: gameOverText,
        text: 'GAME OVER\\nFinal Score: ' + score + '\\n\\nPress R to Restart',
        size: 60, color: 'red', font: 'monospace', align: 'center'
    });
    if (Engine.input.isKeyJustPressed('KeyR')) {
        Engine.scene.load('main');
    }
}
`;

    return [
        { path: 'index.html', content: indexHtml },
        { path: 'scripts/main.js', content: mainJs.trim() },
        { path: 'style.css', content: styleCss.trim() },
        { path: 'assets/shoot.mp3', content: 'https://cdn.pixabay.com/download/audio/2022/03/15/audio_2b24f6057a.mp3?filename=laser-gun-shot-31835.mp3' },
        { path: 'assets/explosion.mp3', content: 'https://cdn.pixabay.com/download/audio/2021/08/04/audio_16cc3b601f.mp3?filename=explosion-6055.mp3' },
        { path: 'assets/gameOver.mp3', content: 'https://cdn.pixabay.com/download/audio/2022/03/10/audio_c370e72c84.mp3?filename=videogame-death-sound-43894.mp3' },
        { path: 'assets/music.mp3', content: 'https://cdn.pixabay.com/download/audio/2022/10/26/audio_95931a57d7.mp3?filename=arcade-game-background-music-8-bit-8-bit-music-123249.mp3' },
        { path: 'notes.txt', content: 'This is a 2D shooter template built with a pure JavaScript architecture. All game logic is contained in `scripts/main.js`.' },
    ];
};