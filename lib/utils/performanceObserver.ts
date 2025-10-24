// --- LeapGuard Performance Monitor ---
// This module provides a "flight recorder" for Core Web Vitals and interaction timings.

interface MonitoredPerformanceEntry extends PerformanceEntry {
    value?: number; // For CLS
    // Other potential properties depending on entry type
}

const MAX_LOG_SIZE = 100;
const layoutShifts: MonitoredPerformanceEntry[] = [];
const longInteractions: PerformanceEventTiming[] = [];

let observer: PerformanceObserver | null = null;

const init = () => {
    if (typeof window.PerformanceObserver === 'undefined') {
        console.warn("PerformanceObserver not supported, some diagnostics will be unavailable.");
        return;
    }

    if (observer) {
        observer.disconnect(); // Disconnect previous observer if re-initializing
    }

    observer = new PerformanceObserver((entryList) => {
        for (const entry of entryList.getEntries()) {
            if (entry.entryType === 'layout-shift') {
                if (layoutShifts.length >= MAX_LOG_SIZE) layoutShifts.shift();
                layoutShifts.push(entry as MonitoredPerformanceEntry);
            }
            if (entry.entryType === 'event' && entry.duration > 100) { // Log interactions longer than 100ms
                if (longInteractions.length >= MAX_LOG_SIZE) longInteractions.shift();
                longInteractions.push(entry as PerformanceEventTiming);
            }
        }
    });

    try {
        // FIX: Use 'entryTypes' for an array of types instead of 'type'.
        observer.observe({ entryTypes: ['layout-shift', 'event'], buffered: true });
        console.log("LeapGuard Performance Monitor initialized.");
    } catch (e) {
        // In some environments (like secure iframes), observing 'event' can fail.
        // Fallback to only observing layout-shift.
        try {
            // FIX: Use 'entryTypes' for an array of types instead of 'type'.
            observer.observe({ entryTypes: ['layout-shift'], buffered: true });
            console.log("LeapGuard Performance Monitor initialized (layout-shift only).");
        } catch (e2) {
             console.error("Failed to initialize PerformanceObserver.", e2);
        }
    }
    
};

const getLayoutShifts = (): MonitoredPerformanceEntry[] => {
    return [...layoutShifts];
};

const getLongInteractions = (): PerformanceEventTiming[] => {
    // Sort by duration descending to find the worst offenders
    return [...longInteractions].sort((a, b) => b.duration - a.duration);
};

// Expose to window for ErrorBoundary access
declare global {
    interface Window {
        LeapPerformanceMonitor: {
            init: () => void;
            getLayoutShifts: () => MonitoredPerformanceEntry[];
            getLongInteractions: () => PerformanceEventTiming[];
        };
    }
}

if (!window.LeapPerformanceMonitor) {
    window.LeapPerformanceMonitor = {
        init,
        getLayoutShifts,
        getLongInteractions
    };
}

export const PerformanceMonitor = window.LeapPerformanceMonitor;