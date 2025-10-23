
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
    <script id="engine-script">
// --- Leap AI Engine ---
${engineScript}
// --- End Engine ---
    </script>
    <script type="module" src="./scripts/game.js" id="game-logic"></script>
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

    const gameJs = `
console.log("Leap Engine 2D Initialized.");

// --- Engine Setup ---
// Get the game's virtual resolution. All positioning should be based on this.
const V_SIZE = Engine.getVirtualSize();

// This tells the engine to scale the virtual resolution to fit entirely
// within the screen, preserving the aspect ratio. This prevents cropping.
Engine.setScalingStrategy('fit'); 

// --- Scene Definitions ---

// Define the start scene
Engine.scene.define('start', () => {
    
    // Create title text
    const titleText = Engine.create.sprite({
        name: 'titleText',
        type: 'ui',
        x: V_SIZE.width / 2,
        y: V_SIZE.height / 3,
    });
    
    Engine.ui.drawText({
        target: titleText,
        text: \`CUBE DODGER\`,
        size: 80,
        color: '#ffdd00',
        font: 'sans-serif',
        align: 'center'
    });
    
    // Create prompt text
    const startPrompt = Engine.create.sprite({
        name: 'startPrompt',
        type: 'ui',
        x: V_SIZE.width / 2,
        y: V_SIZE.height * 0.6,
    });
    
    Engine.ui.drawText({
        target: startPrompt,
        text: \`Press SPACE to Begin\\nUse WASD or Arrows to Move\`,
        size: 36,
        color: 'white',
        font: 'monospace',
        align: 'center'
    });
    
    // Handle starting the game
    Engine.onUpdate(() => {
        if (Engine.input.isKeyJustPressed('Space')) {
            Engine.scene.load('main'); // Start the main game
        }
    });
});


// Define the main game scene
Engine.scene.define('main', () => {

    // Game state setup
    Engine.setData('score', 0);
    Engine.setData('gameOver', false);
    Engine.setData('obstacleSpeed', 100);
    Engine.setData('obstacleSpawnRate', 1.2); 
    Engine.setData('timeSinceLastObstacle', 0);

    // Create the player character as a white cube
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

    // Create a UI element for the score
    const scoreText = Engine.create.sprite({
        name: 'scoreText',
        type: 'ui', 
        x: 20,
        y: 40
    });

    // Create a game over text element (initially hidden)
    const gameOverText = Engine.create.sprite({
        name: 'gameOverText',
        type: 'ui',
        x: V_SIZE.width / 2,
        y: V_SIZE.height / 2,
    });


    // --- Main Game Loop ---
    Engine.onUpdate((deltaTime) => {
        // --- Handle Game Over State ---
        if (Engine.getData('gameOver')) {
            Engine.ui.drawText({
                target: gameOverText,
                text: \`GAME OVER\\nFinal Score: \${Engine.getData('score')}\\n\\nPress R to Restart\`,
                size: 60,
                color: 'red',
                font: 'monospace',
                align: 'center'
            });
            
            if (Engine.input.isKeyJustPressed('KeyR')) {
                Engine.scene.load('main'); // Restart the scene
            }
            return; // Stop the rest of the game logic
        }

        // --- Player Controls ---
        const playerSpeed = 600;
        
        // Horizontal Movement
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

        // --- Shooting ---
        if (Engine.input.isKeyJustPressed('Space')) {
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
        
        // --- Obstacle Spawning ---
        Engine.setData('timeSinceLastObstacle', Engine.getData('timeSinceLastObstacle') + deltaTime);
        if (Engine.getData('timeSinceLastObstacle') > Engine.getData('obstacleSpawnRate')) {
            Engine.setData('timeSinceLastObstacle', 0);
            
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

        // --- Collision Detection & Updates ---
        const allSprites = Engine.getAllSprites();
        const bullets = allSprites.filter(s => s.name === 'bullet');
        const obstacles = allSprites.filter(s => s.name === 'obstacle');

        // Bullets vs Obstacles
        bullets.forEach(bullet => {
            obstacles.forEach(obstacle => {
                if (Engine.physics.checkCollision(bullet, obstacle)) {
                    Engine.create.particles({ x: obstacle.x, y: obstacle.y, count: 25, color: '#A9A9A9', life: 0.8, size: 4 });
                    Engine.camera.shake(10, 0.15);
                    
                    bullet.destroy();
                    obstacle.destroy();
                    
                    Engine.setData('score', Engine.getData('score') + 100);
                    
                    // Make game harder over time
                    Engine.setData('obstacleSpeed', Engine.getData('obstacleSpeed') + 5); 
                    Engine.setData('obstacleSpawnRate', Math.max(0.2, Engine.getData('obstacleSpawnRate') * 0.985));
                }
            });

            if (bullet.y < -50) bullet.destroy();
        });

        // Player vs Obstacles
        obstacles.forEach(obstacle => {
            if (Engine.physics.checkCollision(player, obstacle)) {
                Engine.create.particles({ x: player.x, y: player.y, count: 80, color: '#ff0000', life: 1.5, size: 5 });
                Engine.camera.shake(30, 0.7);
                player.destroy();
                obstacle.destroy();
                Engine.setData('gameOver', true);
            }
            if (obstacle.y > V_SIZE.height + 50) obstacle.destroy();
        });
        
        // --- Update UI ---
        Engine.ui.drawText({
            target: scoreText,
            text: \`Score: \${Engine.getData('score')}\`,
            size: 36,
            color: '#aaffaa',
            font: 'monospace'
        });
    });
});

// Load the start scene to begin with the menu
Engine.scene.load('start');
`;

    return [
        { path: 'index.html', content: indexHtml },
        { path: 'scripts/game.js', content: gameJs.trim() },
        { path: 'style.css', content: styleCss.trim() },
        { path: 'notes.txt', content: 'This is a 2D top-down game built with the custom Leap Engine. You can modify the game by editing scripts/game.js or by giving me prompts in the chat.' },
    ];
};
