// LeapGuard Core
// This script acts as the main "antivirus" engine for the game running in the iframe.
// It initializes by processing incidents from the Sentinel, then takes over with full instrumentation,
// advanced console wrapping, and periodic health checks.
// Detected issues are reported as "incidents" to the IDE's "LeapGuard Security Console"
// for analysis and automated fixing by the AI.

export const autonomousDebugger = `
const leapGuardCore = {
    _incidents: new Set(),
    _config: {
        healthCheckInterval: 250, // ms
    },
    _healthCheckIntervalId: null,

    _safeStringifyForHash(obj) {
        const seen = new WeakSet();
        return JSON.stringify(obj, (key, value) => {
            if (typeof key === 'string' && (key.startsWith('__react') || key.startsWith('$$') || key === '_owner' || key === '_store')) {
                return undefined;
            }
            if (typeof value === 'object' && value !== null) {
                if (typeof value.nodeType === 'number' && typeof value.nodeName === 'string') {
                    return '[DOM Element]';
                }
                if (seen.has(value)) {
                    return '[Circular Reference]';
                }
                seen.add(value);
            }
            if (typeof value === 'function') {
                return \`[Function(\${value.name || 'anonymous'})]\`;
            }
            return value;
        });
    },

    instrument(functionName, originalFn) {
        return (...args) => {
            try {
                return originalFn(...args);
            } catch (error) {
                const errorMessage = error instanceof Error ? (error.stack || error.message) : String(error);
                this.reportIncident('trusted', \`Exception in \${functionName}\`, errorMessage, { args });
                throw error;
            }
        };
    },
    
    reportIncident(threatLevel, suspect, message, context = {}) {
        const stack = (context && context.error && context.error.stack) ? context.error.stack : (new Error()).stack;
        
        const incidentHash = threatLevel + suspect + message;
        if (this._incidents.has(incidentHash)) {
            return;
        }
        this._incidents.add(incidentHash);

        if (this._incidents.size > 100) {
            const oldestIncident = this._incidents.values().next().value;
            this._incidents.delete(oldestIncident);
        }

        const payload = {
            id: \`incident-\${Date.now()}-\${Math.random().toString(16).slice(2)}\`,
            timestamp: Date.now(),
            threatLevel,
            suspect,
            message,
            evidence: {
                stack,
                context
            }
        };
        
        if (window.parent && window.parent !== window) {
            window.parent.postMessage({ type: 'debugger-incident', payload }, '*');
        }
    },

    _runHealthCheck(customCheck) {
        try {
             if (typeof customCheck === 'function') {
                customCheck();
            }
        } catch(e) {
            console.error("Error during LeapGuard health check:", e);
        }
    },

    init(options = {}) {
        if (this._healthCheckIntervalId) {
            clearInterval(this._healthCheckIntervalId);
        }
        
        const customCheck = options.healthCheck || (() => {});

        this._healthCheckIntervalId = setInterval(
            () => this._runHealthCheck(customCheck),
            this._config.healthCheckInterval
        );
        console.log('LeapGuard Core: Autonomous Runtime Analysis System activated.');
    }
};

// The Sentinel script established window.LeapGuard.
// Now, the Core initializes itself and takes over.
if (window.LeapGuard && typeof window.LeapGuard._initializeCore === 'function') {
    window.LeapGuard._initializeCore(leapGuardCore);
} else {
    // Fallback if the sentinel script failed for some reason
    window.LeapGuard = leapGuardCore;
}
`;