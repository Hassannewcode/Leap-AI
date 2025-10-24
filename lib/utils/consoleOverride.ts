// FIX: Convert the entire file into a module exporting its content as a string.
export const consoleOverride = `
(function() {
    // Don't run in the main editor window
    if (typeof window.parent === 'undefined' || window.parent === window) return;
    
    const originalConsole = { ...console };

    const isSkippableInternal = (key) => {
        return key.startsWith('__react') || key.startsWith('$$') || key === '_owner' || key === '_store';
    };

    const isLikelyDomNode = (obj) => {
        return obj && 
               typeof obj === 'object' && 
               typeof obj.nodeType === 'number' && 
               typeof obj.nodeName === 'string';
    };

    const safeSerialize = (arg, seen = new WeakSet()) => {
        if (arg === null) return 'null';
        if (arg === undefined) return 'undefined';
        
        const argType = typeof arg;

        if (argType !== 'object' && argType !== 'function') {
            try {
                // For primitives, attempt to stringify to handle BigInt, etc., gracefully.
                // Fallback to simple toString for symbols.
                return JSON.stringify(arg) ?? String(arg);
            } catch {
                return String(arg);
            }
        }

        if (argType === 'function') {
// FIX: Escape nested template literal.
            return \`[Function Reference (Omitted): \\\${arg.name || 'anonymous'}]\`;
        }

        // Check for DOM nodes first, as they are a primary source of cycles.
        if (isLikelyDomNode(arg)) {
            let descriptor = arg.tagName?.toLowerCase() || 'node';
            if (arg.id) descriptor += '#' + arg.id;
            if (arg.className && typeof arg.className === 'string') {
                descriptor += '.' + arg.className.split(' ').filter(Boolean).join('.');
            }
// FIX: Escape nested template literal.
            return \`[Quarantined DOM Element: \\\${descriptor}]\`;
        }
        
        if (seen.has(arg)) {
            return '[Quarantined Circular Reference]';
        }
        seen.add(arg);

        if (Array.isArray(arg)) {
            if (arg.length === 0) return '[]';
            const preview = arg.slice(0, 10).map(item => safeSerialize(item, seen)).join(', ');
// FIX: Escape nested template literal.
            return \`[\\\${preview}\\\${arg.length > 10 ? ', ...' : ''}]\`;
        }
        
        try {
            const keys = Object.keys(arg);
            if (keys.length === 0) return '{}';

            const properties = keys.slice(0, 10).map(key => {
                 if (isSkippableInternal(key)) return null;
                 const valuePreview = safeSerialize(arg[key], seen);
// FIX: Escape nested template literal.
                 return \`"\\\${key}": \\\${valuePreview}\`;
            }).filter(Boolean).join(', ');
            
// FIX: Escape nested template literal.
            return \`{\\\${properties}\\\${keys.length > 10 ? ', ...' : ''}}\`;
        } catch (e) {
             return '[Object]';
        }
    };

    const postLog = (type, args) => {
        try {
            const message = args.map(arg => typeof arg === 'string' ? arg : safeSerialize(arg)).join(' ');
            window.parent.postMessage({ type: 'console', payload: { type, message } }, '*');
        } catch (e) {
            originalConsole.error('Error in custom console override:', e);
            try {
                window.parent.postMessage({ type: 'console', payload: { type: 'error', message: 'Fatal error in custom console override.' } }, '*');
            } catch (e2) {
                // If postMessage itself fails, there's nothing more we can do.
            }
        }
    };

    console.log = (...args) => {
        originalConsole.log.apply(console, args);
        postLog('log', args);
    };
    console.warn = (...args) => {
        originalConsole.warn.apply(console, args);
        postLog('warn', args);
    };
    console.error = (...args) => {
        originalConsole.error.apply(console, args);
        postLog('error', args);
    };
    console.info = (...args) => {
        originalConsole.info.apply(console, args);
        postLog('info', args);
    };

    // Catch uncaught exceptions
    window.addEventListener('error', (event) => {
// FIX: Escape nested template literal.
        const errorMessage = event.error ? (event.error.stack || event.error.message) : \`\\\${event.message} at \\\${event.filename}:\\\${event.lineno}\`;
        postLog('error', [errorMessage]);
    });

    // Catch unhandled promise rejections
    window.addEventListener('unhandledrejection', (event) => {
// FIX: Escape nested template literal.
        const errorMessage = event.reason instanceof Error ? (event.reason.stack || event.reason.message) : \`Unhandled Promise Rejection: \\\${String(event.reason)}\`;
        postLog('error', [errorMessage]);
    });
})();
`