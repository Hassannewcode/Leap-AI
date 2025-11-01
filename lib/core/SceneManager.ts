export const sceneManager = `
const sceneManager = (() => {
    const scenes = {};
    let activeScene = null;
    let resetFunction = () => console.warn("SceneManager: No reset function registered by the engine.");

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