// --- Leap Engine State Machine ---
// A simple finite state machine implementation for managing entity behaviors.

export const stateMachine = `
function createStateMachine(config) {
    if (!config || !config.initialState || !config.states) {
        console.error("Invalid FSM config. Requires 'initialState' and 'states'.");
        return null;
    }

    const fsm = {
        _target: null,
        _currentState: null,
        _config: config,
        
        start(target) {
            this._target = target;
            this.setState(this._config.initialState);
        },

        setState(newStateName) {
            if (this._currentState && this._currentState.onExit) {
                this._currentState.onExit(this._target);
            }
            
            this._currentState = this._config.states[newStateName];
            
            if (this._currentState) {
                if (this._currentState.onEnter) {
                    this._currentState.onEnter(this._target);
                }
            } else {
                console.error(\`FSM Error: State '\${newStateName}' not found.\`);
            }
        },

        transition(eventName) {
            if (!this._currentState || !this._currentState.transitions) return;

            const nextStateName = this._currentState.transitions[eventName];
            if (nextStateName) {
                this.setState(nextStateName);
            }
        },

        update(deltaTime) {
            if (this._currentState && this._currentState.onUpdate) {
                this._currentState.onUpdate(this._target, deltaTime);
            }
        },
        
        getCurrentState() {
            for (const stateName in this._config.states) {
                if (this._config.states[stateName] === this._currentState) {
                    return stateName;
                }
            }
            return null;
        }
    };

    return fsm;
}
`;
