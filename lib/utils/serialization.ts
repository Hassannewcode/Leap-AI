/**
 * Checks if a given property key is a React internal property that should be skipped during serialization.
 * The previous, more permissive filtering was flawed. It attempted to traverse into React's
 * internal Fiber nodes to find and neutralize 'stateNode' properties. However, this fails
 * when the serialization process starts on an HTMLElement directly, as the traversal
 * immediately enters a circular reference (`HTMLElement` -> `__reactFiber` -> `stateNode` -> `HTMLElement`).
 * A more aggressive and robust approach is to prevent traversal into any of React's internal
 * properties, as they are not meant to be serialized and are the primary source of these errors.
 * @param {string} key The property key to check.
 * @returns {boolean} True if the key should be skipped.
 */
const isSkippableInternal = (key: string): boolean => {
    // React's internal properties start with '__react', '$$', or are specific names like '_owner'.
    // They are not part of the component's public API and often contain cycles or non-serializable data.
    return key.startsWith('__react') || key.startsWith('$$') || key === '_owner' || key === '_store';
};

/**
 * A robust check for any DOM Node, which works across different realms (e.g., iframes).
 * An object is considered a node if it has a numeric nodeType and a string nodeName.
 * @param {any} obj The object to check.
 * @returns {boolean} True if the object is likely a DOM Node.
 */
const isLikelyDomNode = (obj: any): boolean => {
    return obj && 
           typeof obj === 'object' && 
           typeof obj.nodeType === 'number' && 
           typeof obj.nodeName === 'string';
};


/**
 * The internal recursive cleaning function.
 * @param {any} obj The object or value to clean.
 * @param {Set<any>} visited A set of already visited objects to detect cycles.
 * @returns {any} A serializable version of the input.
 */
const _clean = (obj: any, visited: Set<any>): any => {
    if (obj === null || typeof obj !== 'object') {
        // This handles primitives. Functions and symbols will be ignored by JSON.stringify
        // so we can just return them as is.
        return obj;
    }
    
    // Check for specific problematic types that are known to cause circular references.
    if (typeof Event !== 'undefined' && obj instanceof Event) {
        return `[Event: ${obj.type}]`;
    }
    if (isLikelyDomNode(obj)) return `[Quarantined DOM Element: ${obj.nodeName}]`;
    if (obj === window) return '[Window]';

    // Generic cycle detection for any other object.
    if (visited.has(obj)) {
        return '[Quarantined Circular Reference]';
    }

    // Add the object to the visited set for this path before recursing.
    visited.add(obj);

    let cleaned: any;

    try {
        if (Array.isArray(obj)) {
            // If it's an array, map over its items and clean them.
            cleaned = obj.map(item => _clean(item, visited));
        } else {
            // If it's an object, create a new object and copy over cleaned properties.
            cleaned = {};
            for (const key in obj) {
                if (Object.prototype.hasOwnProperty.call(obj, key)) {
                    // Skip internal properties which are known to cause cycles.
                    if (isSkippableInternal(key)) {
                        continue;
                    }
                    cleaned[key] = _clean(obj[key], visited);
                }
            }
        }
    } catch (error) {
        // If an error occurs during property access (e.g., from a getter), handle it gracefully.
        const message = error instanceof Error ? error.message : 'Unknown error';
        return `[Serialization Error: ${message}]`;
    } finally {
        // Important: When cleaning is done for an object, remove it from the visited set
        // so that if it appears again in a different, non-circular branch, it gets processed correctly.
        visited.delete(obj);
    }

    return cleaned;
}

/**
 * Recursively traverses an object or array and returns a "clean" version
 * that is safe to serialize to JSON. It removes known circular references
 * like DOM elements and React's internal Fiber nodes.
 * @param {any} obj The object or value to clean.
 * @returns {any} A serializable version of the input.
 */
export const cleanForSerialization = (obj: any): any => {
    return _clean(obj, new Set());
};