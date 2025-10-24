// FIX: Convert the entire file into an exported string constant to make it a module.
export const renderer2D = `
function gameLoop(timestamp) {
    const deltaTime = (timestamp - lastTime) / 1000 || 0;
    lastTime = timestamp;

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
        const virtualMouseX = (mousePos.x - offsetX) / scale;
        const virtualMouseY = (mousePos.y - offsetY) / scale;
        
        let foundSprite = null;
        // Iterate backwards to select the top-most sprite
        for (let i = sprites.length - 1; i >= 0; i--) {
            const s = sprites[i];
            
            let bounds = { 
                left: s.x - s.width / 2, 
                right: s.x + s.width / 2, 
                top: s.y - s.height / 2, 
                bottom: s.y + s.height / 2 
            };

            // UI Text has different bounding box logic
            if (s.isText && s.type === 'ui') {
                ctx.font = \`\\\${s.size}px \\\${s.font}\`;
                const metrics = ctx.measureText(s.text);
                const textHeight = s.size;
                
                if (s.align === 'center') {
                    bounds.left = s.x - metrics.width / 2;
                    bounds.right = s.x + metrics.width / 2;
                } else if (s.align === 'right') {
                    bounds.left = s.x - metrics.width;
                    bounds.right = s.x;
                } else { // 'left'
                    bounds.left = s.x;
                    bounds.right = s.x + metrics.width;
                }
                bounds.top = s.y - textHeight;
                bounds.bottom = s.y;
            }

            if (
                virtualMouseX >= bounds.left &&
                virtualMouseX <= bounds.right &&
                virtualMouseY >= bounds.top &&
                virtualMouseY <= bounds.bottom
            ) {
                foundSprite = s;
                break; 
            }
        }
        hoveredSprite = foundSprite;
    }
    
    // Particle Update
    particles = particles.filter(p => p.life > 0);
    particles.forEach(p => {
        p.x += p.vx * deltaTime;
        p.y += p.vy * deltaTime;
        p.life -= deltaTime;
    });
    
    // User-defined game logic
    onUpdateCallback(deltaTime);

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

    // Apply Camera Position
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
    ctx.globalAlpha = 1.0;
    particles.forEach(p => {
        ctx.fillStyle = p.color;
        const lifeRatio = Math.max(0, p.life / 0.5);
        ctx.globalAlpha = lifeRatio > 0.5 ? 1 : lifeRatio * 2;
        ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
    });
    ctx.globalAlpha = 1.0;

    ctx.restore(); // End camera transform and shake
    
    // UI Sprites (drawn on top, without camera offset)
    uiSprites.forEach(sprite => {
         if (sprite.isText) {
            ctx.fillStyle = sprite.color;
            // FIX: Escape template literal within the string.
            ctx.font = \`\\\${sprite.size}px \\\${sprite.font}\`;
            ctx.textAlign = sprite.align;
            ctx.fillText(sprite.text, sprite.x, sprite.y);
        }
    });

    // Visual Editor Overlay (drawn inside virtual canvas, on top of all elements)
    if (isInspectMode && hoveredSprite) {
        ctx.save();
        
        let s = hoveredSprite;
        let bounds = { 
            x: s.x - s.width / 2, 
            y: s.y - s.height / 2,
            width: s.width,
            height: s.height
        };

        if (s.isText && s.type === 'ui') {
             ctx.font = \`\\\${s.size}px \\\${s.font}\`;
             const metrics = ctx.measureText(s.text);
             bounds.width = metrics.width;
             bounds.height = s.size;
             bounds.y = s.y - s.size;

             if (s.align === 'center') {
                bounds.x = s.x - metrics.width / 2;
             } else if (s.align === 'right') {
                bounds.x = s.x - metrics.width;
             } else { // 'left'
                bounds.x = s.x;
             }
        }
        
        // Transparent blue overlay
        ctx.globalAlpha = 0.15; // 85% transparent
        ctx.fillStyle = '#00aaff';
        ctx.fillRect(bounds.x, bounds.y, bounds.width, bounds.height);
        
        // Outline
        ctx.globalAlpha = 1.0;
        ctx.strokeStyle = '#00aaff';
        ctx.lineWidth = 2 / scale; // Keep line width consistent
        ctx.strokeRect(bounds.x, bounds.y, bounds.width, bounds.height);
        
        ctx.restore();
    }

    ctx.restore(); // Restore from the main scale/translate transform
    
    // Clear the "just pressed" keys at the end of the frame
    clearJustPressed();

    requestAnimationFrame(gameLoop);
}

requestAnimationFrame(gameLoop);
`