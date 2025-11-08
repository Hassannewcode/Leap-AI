// --- LeapGuard Patrol Monitor ---
// An autonomous agent that actively patrols the game state for common issues
// like stuck entities, performance degradation, and physics anomalies. It can
// take corrective action ("injections") and broadcasts its findings.

export const patrolMonitor = `
const patrolMonitor = (() => {
    let patrolIntervalId = null;
    let lastPositions = new Map();
    const STAGNATION_THRESHOLD = 2; // seconds
    const STAGNATION_CHECKS = 4; // Check every 1/4 of the threshold

    const config = {
        isEnabled: true,
        intensity: 'normal', // 'relaxed', 'normal', 'vigilant'
        patrolFrequency: 1000, // ms
    };

    function startPatrol() {
        if (patrolIntervalId) {
            clearInterval(patrolIntervalId);
        }
        console.log("LeapGuard Patrol Monitor: Activated. Patrolling for anomalies...");
        
        let stagnationCounter = 0;
        
        patrolIntervalId = setInterval(() => {
            if (!config.isEnabled) return;

            // Run lightweight checks frequently
            checkPhysicsAnomalies();

            // Run more expensive checks less frequently
            stagnationCounter++;
            if (stagnationCounter >= STAGNATION_CHECKS) {
                checkStagnation();
                stagnationCounter = 0;
            }

        }, config.patrolFrequency);
    }
    
    function checkStagnation() {
        const V_SIZE = typeof Engine.getVirtualSize === 'function' ? Engine.getVirtualSize() : { width: 1, height: 1 };
        const allSprites = typeof Engine.getAllSprites === 'function' ? Engine.getAllSprites() : [];

        allSprites.forEach(sprite => {
            // Only check dynamic game objects that are expected to move
            if (sprite.type === 'ui' || (!sprite.vx && !sprite.vy && !sprite.ax && !sprite.ay)) {
                lastPositions.delete(sprite.id);
                return;
            }

            const currentPos = { x: sprite.x, y: sprite.y };
            const lastPosData = lastPositions.get(sprite.id);

            if (lastPosData) {
                const distanceMoved = Math.hypot(currentPos.x - lastPosData.pos.x, currentPos.y - lastPosData.pos.y);
                const timeElapsed = (Date.now() - lastPosData.timestamp) / 1000;
                
                // Smarter check: only flag if movement input is active.
                const isMovementInputActive = Engine.input.isPressed('KeyW') || Engine.input.isPressed('KeyA') ||
                                              Engine.input.isPressed('KeyS') || Engine.input.isPressed('KeyD') ||
                                              Engine.input.isPressed('ArrowUp') || Engine.input.isPressed('ArrowLeft') ||
                                              Engine.input.isPressed('ArrowDown') || Engine.input.isPressed('ArrowRight');

                if (distanceMoved < 1 && timeElapsed > STAGNATION_THRESHOLD && isMovementInputActive) {
                    // ANOMALY DETECTED: Sprite is stuck despite user input
                    const report = {
                        anomaly: 'stagnation',
                        targetId: sprite.id,
                        targetName: sprite.name,
                        details: 'Sprite \\'' + sprite.name + '\\' has not moved in ' + timeElapsed.toFixed(1) + 's despite active movement input.',
                        action: 'Applying velocity nudge.'
                    };
                    
                    // INJECTION: Apply a "steroid" nudge to get it unstuck
                    sprite.vx += (Math.random() - 0.5) * 50;
                    sprite.vy += (Math.random() - 0.5) * 50;
                    
                    Engine.events.emit('patrol-report', report);
                    window.LeapGuard.reportIncident('trusted', 'PatrolMonitor: Input Deadlock', report.details, { id: sprite.id });
                    
                    // Reset its timer after nudging
                    lastPositions.set(sprite.id, { pos: currentPos, timestamp: Date.now() });
                } else if (distanceMoved >= 1 || !isMovementInputActive) {
                    // Update timestamp if it has moved OR if there's no input (so the timer resets when player is idle)
                     lastPositions.set(sprite.id, { pos: currentPos, timestamp: Date.now() });
                }
            } else {
                 lastPositions.set(sprite.id, { pos: currentPos, timestamp: Date.now() });
            }
        });
        
        // Cleanup old entries from map to prevent memory leaks for destroyed sprites
        const now = Date.now();
        const allSpriteIds = new Set(allSprites.map(s => s.id));
        for (const id of lastPositions.keys()) {
            if (!allSpriteIds.has(id)) {
                lastPositions.delete(id);
            }
        }
    }
    
    function checkPhysicsAnomalies() {
        // This is a placeholder for more advanced checks, e.g., objects continuously
        // overlapping static scenery. This would require differentiating static vs dynamic objects.
    }

    // Initialize patrol on script load
    startPatrol();

    const patrolNamespace = {
        enable: () => config.isEnabled = true,
        disable: () => config.isEnabled = false,
        setConfig: (newConfig) => {
            Object.assign(config, newConfig);
            // Re-initialize patrol if frequency changes
            if (newConfig.patrolFrequency) {
                startPatrol();
            }
        },
    };

    // Attach to the Engine, ensuring the 'patrol' namespace exists.
    if (!window.Engine) { window.Engine = {}; }
    window.Engine.patrol = patrolNamespace;

    return patrolNamespace;
})();
`