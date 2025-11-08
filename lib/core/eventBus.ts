// --- Leap Engine Event Bus ---
// A simple publish/subscribe system for decoupled communication.

export const eventBus = `
const eventBus = (() => {
    const listeners = {};

    function on(eventName, callback) {
        if (!listeners[eventName]) {
            listeners[eventName] = [];
        }
        listeners[eventName].push(callback);
    }

    function off(eventName, callback) {
        if (!listeners[eventName]) {
            return;
        }
        listeners[eventName] = listeners[eventName].filter(
            listener => listener !== callback
        );
    }

    function emit(eventName, data) {
        if (!listeners[eventName]) {
            return;
        }
        listeners[eventName].forEach(listener => {
            try {
                listener(data);
            } catch (e) {
                console.error('Error in event listener for \\'' + eventName + '\\':', e);
            }
        });
    }

    return { on, off, emit };
})();
`;
