

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
let lastTime = 0;
const state = new Map();

// Camera now includes state for screen shake effects, zoom, and smooth following
const camera = { 
    x: 0, 
    y: 0,
    zoom: 1,
    target: null,
    followSpeed: 0.05,
    shakeIntensity: 0,
    shakeDuration: 0,
};

const background = {
    url: null,
    scrollSpeedX: 0,
    scrollSpeedY: 0,
};

// This function is called by the scene manager to bootstrap a new scene.
const engineResetSceneState = function() {
    sprites = [];
    particles = [];
    // onUpdateCallback is no longer needed. The scene manager handles this.
    camera.x = 0;
    camera.y = 0;
    camera.zoom = 1;
    camera.target = null;
    camera.shakeIntensity = 0;
    camera.shakeDuration = 0;
}

// The engine provides its reset logic to the central scene manager.
sceneManager.registerResetFunction(engineResetSceneState);

window.Engine = {
    getCanvas: () => canvas,
    getVirtualSize: () => ({ width: VIRTUAL_WIDTH, height: VIRTUAL_HEIGHT }),
    setScalingStrategy: (strategy) => {
        if (['fit', 'fill'].includes(strategy)) {
            scalingStrategy = strategy;
            resizeCanvas();
        } else {
            console.warn('Unsupported scaling strategy: \\'' + strategy + '\\'. Using \\'' + scalingStrategy + '\\'.');
        }
    },
    getAllSprites: () => sprites,
    onUpdate: () => console.warn("Engine.onUpdate is deprecated. Define an 'onUpdate' method in your scene configuration instead."),
    setData: (key, value) => state.set(key, value),
    getData: (key) => state.get(key),
    scene: {
        define: (name, config) => sceneManager.define(name, config),
        load: (name, params) => sceneManager.load(name, params),
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
                alpha: 1,
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
         particles: ({ x=0, y=0, count=10, color='orange', size=2, life=0.5, gravity=0 }) => {
            for(let i=0; i<count; i++) {
                particles.push({
                    x, y,
                    vx: (Math.random() - 0.5) * 150,
                    vy: (Math.random() - 0.5) * 150,
                    life: Math.random() * life,
                    maxLife: life,
                    color, size, gravity
                });
            }
        },
        stateMachine: createStateMachine
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
        isKeyJustPressed: (key) => keysJustPressed.has(key),
        isMousePressed: () => isMousePressed,
        isMouseJustClicked: () => isMouseJustClickedFlag,
        wasAnyInputJustPressed: () => keysJustPressed.size > 0 || isMouseJustClickedFlag,
        getMousePos: () => ({ x: (mousePosition.x - offsetX) / scale, y: (mousePosition.y - offsetY) / scale }),
        getMouseWorldPos: () => {
            const V_SIZE = Engine.getVirtualSize();
            const mouse = Engine.input.getMousePos();
            const worldX = ( mouse.x - V_SIZE.width / 2 ) / camera.zoom + camera.x + V_SIZE.width / 2;
            const worldY = ( mouse.y - V_SIZE.height / 2 ) / camera.zoom + camera.y + V_SIZE.height / 2;
            return { x: worldX, y: worldY };
        },
    },
    physics: {
       checkCollision: physics.checkCollision,
       checkCircularCollision: physics.checkCircularCollision,
       getCollisions: physics.getCollisions,
       createGridFromSprites: physics.createGridFromSprites,
    },
    camera: {
        get x() { return camera.x; },
        get y() { return camera.y; },
        setZoom: (z) => camera.zoom = Math.max(0.1, z),
        getZoom: () => camera.zoom,
        shake: (intensity, duration) => {
            camera.shakeIntensity = intensity;
            camera.shakeDuration = duration;
        },
        follow: (sprite, speed = 0.05) => {
           camera.target = sprite;
           camera.followSpeed = speed;
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
                alpha: config.alpha ?? 1,
                size: config.size || 16,
                font: config.font || 'sans-serif',
                align: config.align || 'left',
                ...config, // Allow passing x, y directly
            });
        }
    },
    audio: {
        play: (soundName) => playSound(soundName)
    },
    events: eventBus,
    tween: tweenManager,
    ai: inGameAI,
};

// --- LeapGuard Instrumentation ---
if (window.LeapGuard && window.LeapGuard.instrument) {
    Engine.create.sprite = window.LeapGuard.instrument('Engine.create.sprite', Engine.create.sprite);
    Engine.scene.load = window.LeapGuard.instrument('Engine.scene.load', Engine.scene.load);
    window.LeapGuard.init({
        healthCheck: () => {
            const allSprites = Engine.getAllSprites();
            if (allSprites.length > 500) {
                 window.LeapGuard.reportIncident('trusted', 'Performance Check', 'High object count: ' + allSprites.length + '. This may impact performance.');
            }
            for (const sprite of allSprites) {
                if (isNaN(sprite.x) || isNaN(sprite.y)) {
                    window.LeapGuard.reportIncident('trusted', 'Data Integrity Check', 'Sprite \\'' + sprite.name + '\\' has NaN position.', { id: sprite.id, x: sprite.x, y: sprite.y });
                }
                if (sprite.width <= 0 || sprite.height <= 0) {
                    window.LeapGuard.reportIncident('trusted', 'Data Integrity Check', 'Sprite \\'' + sprite.name + '\\' has an invalid size (W: ' + sprite.width + ', H: ' + sprite.height + '). It may be invisible.', { id: sprite.id, width: sprite.width, height: sprite.height });
                }
                if (sprite.imageUrl && !assetCache[sprite.imageUrl]) {
                    // This can happen briefly while loading, so we add a check.
                    if (!loadingAssets.has(sprite.imageUrl)) {
                       window.LeapGuard.reportIncident('trusted', 'Asset Check', 'Sprite \\'' + sprite.name + '\\' has a broken image reference: ' + sprite.imageUrl);
                    }
                }
                if (Math.abs(sprite.x) > VIRTUAL_WIDTH * 5 || Math.abs(sprite.y) > VIRTUAL_HEIGHT * 5) {
                    window.LeapGuard.reportIncident('trusted', 'Position Check', 'Sprite \\'' + sprite.name + '\\' is far outside the viewport. It might be lost.', { id: sprite.id, x: sprite.x, y: sprite.y });
                }
                const velocityMagnitude = Math.sqrt((sprite.vx || 0)**2 + (sprite.vy || 0)**2);
                if (velocityMagnitude > 2000) { // 2000 pixels/sec is very fast
                    window.LeapGuard.reportIncident('trusted', 'Velocity Check', 'Sprite \\'' + sprite.name + '\\' has a very high velocity (' + velocityMagnitude.toFixed(0) + ' p/s). This may be unintentional.', { id: sprite.id, vx: sprite.vx, vy: sprite.vy });
                }
            }
        }
    });
}
`