export const sceneManager = `
const sceneManager = (() => {
    const scenes = {};
    let activeScene = null;
    let resetFunction = () => console.warn("SceneManager: No reset function registered by the engine.");
    let isStarted = false; // Flag to ensure the game starts only once from interaction.

    // This function will be called on the first user interaction to kick off the game.
    function _handleFirstInteraction() {
        if (isStarted) return;
        isStarted = true;
        
        // If no scene is running and a 'start' scene exists, load it.
        // This is the primary mechanism to begin the game now.
        if (!activeScene && scenes['start']) {
            console.log("First user interaction detected. Starting game.");
            load('start');
        }
    }
    
    // Add listeners that will be automatically removed after the first invocation.
    document.addEventListener('keydown', _handleFirstInteraction, { once: true });
    document.addEventListener('mousedown', _handleFirstInteraction, { once: true });

    function define(name, config) {
        if (!config || typeof config.onEnter !== 'function') {
            console.error(\`Scene '\${name}' is invalid. It must be an object with at least an onEnter method.\`);
            return;
        }
        scenes[name] = {
            onEnter: config.onEnter,
            onUpdate: config.onUpdate || (() => {}),
            onExit: config.onExit || (() => {}),
            _name: name
        };
    }

    function load(name, params = {}) {
        if (!scenes[name]) {
            console.error(\`Scene '\${name}' is not defined.\`);
            return;
        }

        isStarted = true; // Loading a scene explicitly also marks the game as started.

        if (activeScene && typeof activeScene.onExit === 'function') {
            try {
                activeScene.onExit();
            } catch(e) {
                console.error(\`Error in onExit for scene '\${activeScene._name}':\`, e);
            }
        }
        
        // Execute the engine-specific bootstrap/reset logic
        resetFunction();

        activeScene = scenes[name];
        
        console.log(\`Loading scene: '\${name}'\`);
        
        if (typeof activeScene.onEnter === 'function') {
            try {
                activeScene.onEnter(params);
            } catch(e) {
                console.error(\`Error in onEnter for scene '\${name}':\`, e);
            }
        }
    }
    
    function update(deltaTime) {
        if (activeScene && typeof activeScene.onUpdate === 'function') {
             try {
                activeScene.onUpdate(deltaTime);
            } catch(e) {
                console.error(\`Error in onUpdate for scene '\${activeScene._name}':\`, e);
            }
        }
    }
    
    // This is the injection point for the engine's cleanup logic.
    function registerResetFunction(fn) {
        resetFunction = fn;
    }

    return {
        define,
        load,
        update,
        registerResetFunction,
        getActiveScene: () => activeScene
    };
})();
`;