// --- LeapGuard Performance Monitor ---
// Captures Core Web Vitals and other performance metrics to provide context for crashes.

const MAX_ENTRIES = 50;

let layoutShifts: PerformanceEntry[] = [];
let interactionTimings: PerformanceEntry[] = [];

const init = (): void => {
    try {
        const observer = new PerformanceObserver((list) => {
            for (const entry of list.getEntries()) {
                if (entry.entryType === 'layout-shift') {
                    if (layoutShifts.length >= MAX_ENTRIES) {
                        layoutShifts.shift();
                    }
                    layoutShifts.push(entry);
                } else if (entry.entryType === 'event') {
                    // We look for 'event' timings as a proxy for INP.
                    // A high duration indicates a slow interaction.
                    if (entry.duration > 100) { // Log interactions over 100ms
                         if (interactionTimings.length >= MAX_ENTRIES) {
                            interactionTimings.shift();
                        }
                        interactionTimings.push(entry);
                    }
                }
            }
        });
        
        // Start observing the relevant performance entries.
        observer.observe({ entryTypes: ['layout-shift', 'event'] });
        console.log("LeapGuard Performance Monitor initialized.");
    } catch (e) {
        console.warn("PerformanceObserver is not supported in this browser. Performance metrics will be unavailable.");
    }
};

const getLayoutShifts = (): PerformanceEntry[] => {
    return [...layoutShifts];
};

const getInteractionTimings = (): PerformanceEntry[] => {
    return [...interactionTimings];
};


export const PerformanceMonitor = {
    init,
    getLayoutShifts,
    getInteractionTimings,
};
