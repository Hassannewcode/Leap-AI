// FIX: Convert the entire file into an exported string constant to make it a module.
export const engine2D = `
const canvas = document.getElementById('game-canvas');
if (!canvas) throw new Error('Could not find canvas');
const ctx = canvas.getContext('2d');
if (!ctx) throw new Error('Could not get 2D context');

// Disable image smoothing to keep pixel art and sharp graphics crisp when scaled.
ctx.imageSmoothingEnabled = false;

// Virtual resolution for the game world. All game logic will be based on these dimensions.
const VIRTUAL_WIDTH = 1280;
const VIRTUAL_HEIGHT = 720;
let scale = 1;
let offsetX = 0;
let offsetY = 0;
let scalingStrategy = 'fit'; // 'fit' or 'fill'

// This function handles scaling the game to fit the window while maintaining aspect ratio (letterboxing).
function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const scaleX = canvas.width / VIRTUAL_WIDTH;
    const scaleY = canvas.height / VIRTUAL_HEIGHT;
    
    if (scalingStrategy === 'fill') {
        scale = Math.max(scaleX, scaleY);
    } else { // 'fit' is the default
        scale = Math.min(scaleX, scaleY);
    }

    const scaledWidth = VIRTUAL_WIDTH * scale;
    const scaledHeight = VIRTUAL_HEIGHT * scale;

    offsetX = (canvas.width - scaledWidth) / 2;
    offsetY = (canvas.height - scaledHeight) / 2;
}
resizeCanvas();
window.addEventListener('resize', resizeCanvas);


let sprites = [];
let particles = [];
let onUpdateCallback = (deltaTime) => {};
let lastTime = 0;
const state = new Map();

// Camera now includes state for screen shake effects
const camera = { 
    x: 0, 
    y: 0,
    shakeIntensity: 0,
    shakeDuration: 0,
};

const background = {
    url: null,
    scrollSpeedX: 0,
    scrollSpeedY: 0,
};

resetSceneState = function() {
    sprites = [];
    particles = [];
    onUpdateCallback = () => {};
    camera.x = 0;
    camera.y = 0;
    camera.shakeIntensity = 0;
    camera.shakeDuration = 0;
}

window.Engine = {
    getCanvas: () => canvas,
    getVirtualSize: () => ({ width: VIRTUAL_WIDTH, height: VIRTUAL_HEIGHT }),
    setScalingStrategy: (strategy) => {
        if (['fit', 'fill'].includes(strategy)) {
            scalingStrategy = strategy;
            resizeCanvas();
        } else {
            console.warn(\`Unsupported scaling strategy: '\${strategy}'. Using '\${scalingStrategy}'.\`);
        }
    },
    getAllSprites: () => sprites,
    onUpdate: (callback) => { onUpdateCallback = callback; },
    setData: (key, value) => state.set(key, value),
    getData: (key) => state.get(key),
    scene: {
        define: (name, setupFunc) => {
            scenes[name] = setupFunc;
        },
        load: (name) => {
            if (scenes[name]) {
                resetSceneState();
                scenes[name]();
                // FIX: Escape template literal within the string.
                console.log(\`Scene '\\\${name}' loaded.\`);
            } else {
                // FIX: Escape template literal within the string.
                console.error(\`Scene '\\\${name}' is not defined.\`);
            }
        }
    },
    create: {
        sprite: (config) => {
            if (config.imageUrl) {
                loadImage(config.imageUrl);
            }
            const spriteData = { 
                id: Math.random(), 
                name: 'unnamed', 
                x: 0, y: 0, 
                width: 32, height: 32, 
                imageUrl: null, color: 'white', type: 'game',
                rotation: 0,
                vx: 0, vy: 0, // velocity
                ax: 0, ay: 0, // acceleration
                drag: 0, // friction/drag
                clampToScreen: false, // New property
                clipX: 0, clipY: 0,
                clipWidth: null, clipHeight: null,
                ...config 
            };
            
            const spriteInstance = {
                ...spriteData,
                destroy: () => {
                    sprites = sprites.filter(s => s.id !== spriteData.id);
                }
            };

            sprites.push(spriteInstance);
            return spriteInstance;
        },
         particles: ({ x=0, y=0, count=10, color='orange', size=2, life=0.5 }) => {
            for(let i=0; i<count; i++) {
                particles.push({
                    x, y,
                    vx: (Math.random() - 0.5) * 150,
                    vy: (Math.random() - 0.5) * 150,
                    life: Math.random() * life,
                    color, size
                });
            }
        }
    },
    destroy: (spriteToDestroy) => {
        if (spriteToDestroy && typeof spriteToDestroy.destroy === 'function') {
            spriteToDestroy.destroy();
        } else {
             console.warn('Engine.destroy is deprecated. Use instance.destroy() instead.');
             sprites = sprites.filter(s => s !== spriteToDestroy);
        }
    },
    input: {
        isPressed: (key) => keysPressed.has(key),
        isKeyJustPressed: (key) => keysJustPressed.has(key)
    },
    physics: {
       checkCollision: physics.checkCollision,
       checkCircularCollision: physics.checkCircularCollision,
       getCollisions: physics.getCollisions,
    },
    camera: {
        get x() { return camera.x; },
        get y() { return camera.y; },
        shake: (intensity, duration) => {
            camera.shakeIntensity = intensity;
            camera.shakeDuration = duration;
        },
        follow: (sprite, offset = {x: 0, y: 0}) => {
           console.warn("Camera following is not used in this game type.");
        }
    },
    background: {
        setImage: (url) => {
            background.url = url;
            loadImage(url);
        },
        setScrollSpeed: (x, y) => {
            background.scrollSpeedX = x;
            background.scrollSpeedY = y;
        }
    },
    ui: {
        drawText: (config) => {
            if (!config.target) {
                console.error('Engine.ui.drawText requires a target UI sprite.');
                return;
            }
             Object.assign(config.target, {
                isText: true,
                text: config.text,
                color: config.color || 'white',
                size: config.size || 16,
                font: config.font || 'sans-serif',
                align: config.align || 'left',
            });
        }
    },
    audio: {
        play: (soundName) => playSound(soundName)
    }
};

// --- LeapGuard Instrumentation ---
if (window.LeapGuard && window.LeapGuard.instrument) {
    Engine.create.sprite = window.LeapGuard.instrument('Engine.create.sprite', Engine.create.sprite);
    Engine.onUpdate = window.LeapGuard.instrument('Engine.onUpdate', Engine.onUpdate);
    Engine.scene.load = window.LeapGuard.instrument('Engine.scene.load', Engine.scene.load);
    window.LeapGuard.init({
        healthCheck: () => {
            const allSprites = Engine.getAllSprites();
            if (allSprites.length > 500) {
// FIX: Escaped template literal to prevent it from being evaluated in the outer scope.
                 window.LeapGuard.reportIncident('trusted', 'Performance Check', \`High object count: \${allSprites.length}. This may impact performance.\`);
            }
            for (const sprite of allSprites) {
                if (isNaN(sprite.x) || isNaN(sprite.y)) {
// FIX: Escaped template literal to prevent it from being evaluated in the outer scope.
                    window.LeapGuard.reportIncident('trusted', 'Data Integrity Check', \`Sprite '\${sprite.name}' has NaN position.\`, { id: sprite.id, x: sprite.x, y: sprite.y });
                }
                if (sprite.imageUrl && !assetCache[sprite.imageUrl]) {
                    // This can happen briefly while loading, so we add a check.
                    if (!loadingAssets.has(sprite.imageUrl)) {
// FIX: Escaped template literals to prevent them from being evaluated in the outer scope.
                       window.LeapGuard.reportIncident('trusted', 'Asset Check', \`Sprite '\${sprite.name}' has a broken image reference: \${sprite.imageUrl}\`);
                    }
                }
            }
        }
    });
}
`