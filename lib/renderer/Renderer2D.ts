// FIX: Add declarations for variables from other script modules to resolve TypeScript errors.
declare global {
    interface Window {
        gizmoState: {
            handles: Record<string, any>;
            hoveredHandle: string | null;
        };
    }
}

declare const scale: number;
declare const ctx: CanvasRenderingContext2D;
declare const camera: { x: number; y: number; zoom: number; target: any; followSpeed: number; shakeIntensity: number; shakeDuration: number; };
declare let lastTime: number;
declare const tweenManager: { update: (dt: number) => void; };
declare let sprites: any[];
declare const VIRTUAL_WIDTH: number;
declare const VIRTUAL_HEIGHT: number;
declare let isInspectMode: boolean;
declare const getTransformedRect: (sprite: any) => { x: number; y: number; }[];
declare const isPointInPolygon: (point: { x: number; y: number; }, polygon: { x: number; y: number; }[]) => boolean;
declare let worldMousePos: { x: number; y: number; };
declare let hoveredSprite: any;
declare let particles: any[];
declare const sceneManager: { update: (dt: number) => void; };
declare const canvas: HTMLCanvasElement;
declare const offsetX: number;
declare const offsetY: number;
declare const background: { url: string | null; scrollSpeedX: number; scrollSpeedY: number; };
declare const assetCache: Record<string, HTMLImageElement>;
declare let selectedSprite: any;
declare const clearJustPressed: () => void;

// FIX: Convert the file into a module by exporting its content as a string.
export const renderer2D = `
function drawSelectionGizmo(sprite) {
    const HANDLE_SIZE = 8 / scale;
    const ROTATION_HANDLE_OFFSET = 20 / scale;
    
    // Reset handles for the new frame
    window.gizmoState.handles = {};

    ctx.save();
    
    // --- Calculations ---
    const w = sprite.width;
    const h = sprite.height;
    const rot = sprite.rotation || 0;
    
    // Transform to sprite's local space
    ctx.translate(sprite.x, sprite.y);
    ctx.rotate(rot);
    
    // --- Draw Bounding Box ---
    ctx.strokeStyle = '#00aaff';
    ctx.lineWidth = 2 / (scale * camera.zoom);
    ctx.strokeRect(-w / 2, -h / 2, w, h);

    // --- Draw and Store Handles ---
    const handlePositions = {
        tl: { x: -w / 2, y: -h / 2, cursor: 'nwse-resize' },
        t:  { x: 0, y: -h / 2, cursor: 'ns-resize' },
        tr: { x: w / 2, y: -h / 2, cursor: 'nesw-resize' },
        r:  { x: w / 2, y: 0, cursor: 'ew-resize' },
        br: { x: w / 2, y: h / 2, cursor: 'nwse-resize' },
        b:  { x: 0, y: h / 2, cursor: 'ns-resize' },
        bl: { x: -w / 2, y: h / 2, cursor: 'nesw-resize' },
        l:  { x: -w / 2, y: 0, cursor: 'ew-resize' },
        rotate: { x: 0, y: -h / 2 - ROTATION_HANDLE_OFFSET / camera.zoom, cursor: 'crosshair'}
    };
    
    ctx.fillStyle = '#00aaff';
    const cos = Math.cos(rot);
    const sin = Math.sin(rot);
    
    for (const name in handlePositions) {
        const pos = handlePositions[name];
        ctx.save();
        ctx.translate(pos.x, pos.y);
        if (name !== 'rotate') { // Resize handles don't rotate with the sprite
            ctx.rotate(-rot);
        }
        ctx.fillRect(-HANDLE_SIZE / 2 / camera.zoom, -HANDLE_SIZE / 2 / camera.zoom, HANDLE_SIZE / camera.zoom, HANDLE_SIZE / camera.zoom);
        ctx.restore();
        
        // Store world position of the handle for hit detection
        window.gizmoState.handles[name] = {
            x: sprite.x + pos.x * cos - pos.y * sin,
            y: sprite.y + pos.x * sin + pos.y * cos,
            size: HANDLE_SIZE * scale,
            cursor: pos.cursor
        };
    }
    
    // --- Draw Rotation Line ---
    ctx.beginPath();
    ctx.moveTo(0, -h/2);
    ctx.lineTo(0, -h/2 - ROTATION_HANDLE_OFFSET / camera.zoom);
    ctx.stroke();

    ctx.restore(); // Restore from sprite's local transform

    // --- Draw Info Tag (in screen space) ---
    ctx.save();
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.font = \\\`bold \\\${12 / scale}px sans-serif\\\`;
    const text = \\\`\\\${sprite.name} (x: \\\${sprite.x.toFixed(1)}, y: \\\${sprite.y.toFixed(1)})\\\`;
    const textMetrics = ctx.measureText(text);
    const tagX = sprite.x - textMetrics.width / 2;
    const tagY = sprite.y + h/2 * cos + ROTATION_HANDLE_OFFSET * cos / camera.zoom + 15 / scale;
    ctx.fillRect(tagX - 5, tagY - 14, textMetrics.width + 10, 20);
    ctx.fillStyle = '#fff';
    ctx.fillText(text, tagX, tagY);
    ctx.restore();
}

function gameLoop(timestamp) {
    const deltaTime = (timestamp - lastTime) / 1000 || 0;
    lastTime = timestamp;

    // --- ENGINE SYSTEMS UPDATE ---
    tweenManager.update(deltaTime);
    
    // --- PHYSICS & MOVEMENT UPDATE ---
    sprites.forEach(s => {
        // Apply acceleration to velocity
        s.vx += (s.ax || 0) * deltaTime;
        s.vy += (s.ay || 0) * deltaTime;
        
        // Apply drag
        const dragFactor = Math.pow(1 - (s.drag || 0), deltaTime * 60); // Frame-rate independent drag
        s.vx *= dragFactor;
        s.vy *= dragFactor;

        // Apply velocity to position
        s.x += s.vx * deltaTime;
        s.y += s.vy * deltaTime;

        // Handle screen clamping against the virtual resolution
        if (s.clampToScreen) {
            const halfW = s.width / 2;
            const halfH = s.height / 2;
            s.x = Math.max(halfW, Math.min(VIRTUAL_WIDTH - halfW, s.x));
            s.y = Math.max(halfH, Math.min(VIRTUAL_HEIGHT - halfH, s.y));
        }
    });
    
    // Editor/Inspector Logic
    if (isInspectMode) {
        let foundSprite = null;
        // Iterate backwards to select the top-most sprite
        for (let i = sprites.length - 1; i >= 0; i--) {
            const s = sprites[i];
            const rect = getTransformedRect(s);
            if (isPointInPolygon(worldMousePos, rect)) {
                foundSprite = s;
                break;
            }
        }
        hoveredSprite = foundSprite;
    }
    
    // Particle Update
    particles = particles.filter(p => p.life > 0);
    particles.forEach(p => {
        p.vy += (p.gravity || 0) * deltaTime;
        p.x += p.vx * deltaTime;
        p.y += p.vy * deltaTime;
        p.life -= deltaTime;
    });
    
    // User-defined game logic is now handled by the active scene
    sceneManager.update(deltaTime);

    // --- DRAWING ---
    // Clear the entire physical canvas to create letterbox bars
    ctx.fillStyle = 'black';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Save context, translate and scale to draw the virtual screen
    ctx.save();
    ctx.translate(offsetX, offsetY);
    ctx.scale(scale, scale);


    // Background (drawn within the virtual canvas)
    if (background.url && assetCache[background.url]) {
        const img = assetCache[background.url];
        const pattern = ctx.createPattern(img, 'repeat');
        ctx.fillStyle = pattern;
        ctx.save();
        // Modulo prevents scroll coordinates from becoming excessively large
        const scrollX = (background.scrollSpeedX * (timestamp / 1000)) % img.width;
        const scrollY = (background.scrollSpeedY * (timestamp / 1000)) % img.height;
        ctx.translate(scrollX, scrollY);
        // Fill the entire virtual canvas area, compensating for the scroll translation
        ctx.fillRect(-scrollX, -scrollY, VIRTUAL_WIDTH, VIRTUAL_HEIGHT);
        ctx.restore();
    } else {
        // Fallback to clear the virtual canvas if no background is set
        ctx.fillStyle = 'black';
        ctx.fillRect(0, 0, VIRTUAL_WIDTH, VIRTUAL_HEIGHT);
    }
    
    ctx.save(); // Start of world rendering

    // Apply Camera Follow
    if (camera.target) {
        camera.x += (camera.target.x - camera.x) * camera.followSpeed;
        camera.y += (camera.target.y - camera.y) * camera.followSpeed;
    }

    // Apply Camera Shake
    if (camera.shakeDuration > 0) {
        camera.shakeDuration -= deltaTime;
        const shakeX = (Math.random() - 0.5) * camera.shakeIntensity;
        const shakeY = (Math.random() - 0.5) * camera.shakeIntensity;
        ctx.translate(shakeX, shakeY);
        if (camera.shakeDuration <= 0) {
            camera.shakeIntensity = 0;
        }
    }

    // Apply Camera Zoom and Position
    ctx.translate(VIRTUAL_WIDTH / 2, VIRTUAL_HEIGHT / 2);
    ctx.scale(camera.zoom, camera.zoom);
    ctx.translate(-VIRTUAL_WIDTH / 2, -VIRTUAL_HEIGHT / 2);
    ctx.translate(-camera.x, -camera.y);
    
    const gameSprites = sprites.filter(s => s.type !== 'ui');
    const uiSprites = sprites.filter(s => s.type === 'ui');

    // Game Sprites with rotation
    gameSprites.forEach(sprite => {
         if (sprite.imageUrl && assetCache[sprite.imageUrl]) {
            const img = assetCache[sprite.imageUrl];
            ctx.save();
            ctx.globalAlpha = sprite.alpha !== undefined ? sprite.alpha : 1.0;
            ctx.translate(sprite.x, sprite.y);
            ctx.rotate(sprite.rotation || 0);
            
            const sWidth = sprite.clipWidth ?? img.width;
            const sHeight = sprite.clipHeight ?? img.height;
            ctx.drawImage(img, sprite.clipX, sprite.clipY, sWidth, sHeight, -sprite.width / 2, -sprite.height / 2, sprite.width, sprite.height);

            ctx.restore();
        } else if (!sprite.isText) {
            // Fallback for non-image sprites
            ctx.save();
            ctx.globalAlpha = sprite.alpha !== undefined ? sprite.alpha : 1.0;
            ctx.fillStyle = sprite.color;
            ctx.fillRect(sprite.x - sprite.width / 2, sprite.y - sprite.height / 2, sprite.width, sprite.height);
            ctx.restore();
        }
    });

    // Particles
    particles.forEach(p => {
        const lifeRatio = Math.max(0, p.life / p.maxLife);
        ctx.globalAlpha = lifeRatio > 0.5 ? 1 : lifeRatio * 2;
        ctx.fillStyle = p.color;
        ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
    });
    ctx.globalAlpha = 1.0;
    
    // Visual Editor Overlay (drawn in world space)
    if (isInspectMode) {
        if (selectedSprite) {
            drawSelectionGizmo(selectedSprite);
        } else if (hoveredSprite) {
            // Simple hover highlight
            const rect = getTransformedRect(hoveredSprite);
            ctx.beginPath();
            ctx.moveTo(rect[0].x, rect[0].y);
            for (let i = 1; i < rect.length; i++) {
                ctx.lineTo(rect[i].x, rect[i].y);
            }
            ctx.closePath();
            ctx.strokeStyle = 'rgba(0, 170, 255, 0.5)';
            ctx.lineWidth = 2 / (scale * camera.zoom);
            ctx.stroke();
        }
    }


    ctx.restore(); // End camera transform and shake
    
    // UI Sprites (drawn on top, without camera offset)
    uiSprites.forEach(sprite => {
         if (sprite.isText) {
            ctx.save();
            ctx.globalAlpha = sprite.alpha;
            ctx.fillStyle = sprite.color;
            ctx.font = sprite.size + 'px ' + sprite.font;
            ctx.textAlign = sprite.align;
            ctx.fillText(sprite.text, sprite.x, sprite.y);
            ctx.restore();
        }
    });

    ctx.restore(); // Restore from the main scale/translate transform
    
    // Clear the "just pressed" keys at the end of the frame
    clearJustPressed();

    requestAnimationFrame(gameLoop);
}
`;
