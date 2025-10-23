
// --- LeapGuard Safety Protocol ---
// Provides non-AI, immediate actions to stabilize the game runtime.
export const safetyProtocol = `
(function() {
    if (!window.LeapGuard) {
        console.error("LeapGuard Core not found. Safety Protocol cannot attach.");
        return;
    }

    const quarantineAction = (incident) => {
        if (!incident || !incident.suspect || !incident.evidence || !incident.evidence.context) {
            console.warn('[LeapGuard] Quarantine failed: Invalid incident data received.');
            return;
        }

        const context = incident.evidence.context;
        let actionTaken = 'No action taken.';

        try {
            // --- 2D Engine Actions ---
            if (typeof window.Engine.getAllSprites === 'function') {
                const sprites = window.Engine.getAllSprites();
                const spriteId = context.id;
                const targetSprite = spriteId ? sprites.find(s => s.id === spriteId) : null;

                if (targetSprite) {
                    switch(incident.suspect) {
                        case 'Data Integrity Check': // e.g., NaN position
                            targetSprite.destroy();
                            actionTaken = \`Destroyed sprite '\${targetSprite.name}' due to data corruption (NaN).\`;
                            break;
                        case 'Position Check': // e.g., out of bounds
                             targetSprite.destroy();
                            actionTaken = \`Destroyed sprite '\${targetSprite.name}' for being out of bounds.\`;
                            break;
                        case 'Velocity Check': // e.g., excessive speed
                            targetSprite.vx = 0;
                            targetSprite.vy = 0;
                            actionTaken = \`Reset velocity of sprite '\${targetSprite.name}'.\`;
                            break;
                        default:
                            targetSprite.destroy();
                            actionTaken = \`Performed generic quarantine on sprite '\${targetSprite.name}' by destroying it.\`;
                            break;
                    }
                }
            }
            // --- 3D Engine Actions ---
            else if (typeof window.Engine.getScene === 'function') {
                const scene = window.Engine.getScene();
                const meshUuid = context.uuid;
                const targetMesh = meshUuid ? scene.getObjectByProperty('uuid', meshUuid) : null;

                if (targetMesh) {
                     switch(incident.suspect) {
                        case 'Data Integrity Check': // e.g., NaN position
                            window.Engine.destroy(targetMesh);
                            actionTaken = \`Destroyed mesh '\${targetMesh.name}' due to data corruption (NaN).\`;
                            break;
                        default:
                            window.Engine.destroy(targetMesh);
                            actionTaken = \`Performed generic quarantine on mesh '\${targetMesh.name}' by destroying it.\`;
                            break;
                    }
                }
            }
        } catch (e) {
            actionTaken = 'An error occurred during quarantine procedure: ' + e.message;
            console.error('[LeapGuard] Quarantine Error:', e);
        }
        
        console.log(\`[LeapGuard Protocol] Incident: "\${incident.message}". Quarantine Result: \${actionTaken}\`);
    };

    window.addEventListener('message', (event) => {
        if (event.data?.type === 'quarantine-incident') {
            quarantineAction(event.data.payload);
        }
    });
    
    // Attach to LeapGuard core if available
    if (window.LeapGuard) {
        window.LeapGuard.quarantine = quarantineAction;
    }
})();
`;
