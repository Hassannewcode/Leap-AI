// --- LeapGuard Activity Logger ---
// This module provides a "flight recorder" for user interactions.

interface UserActivityEvent {
    type: 'click' | 'keydown';
    timestamp: number;
    details: {
        selector?: string;
        position?: { x: number; y: number };
        key?: string;
        code?: string;
        text?: string;
    };
}

const MAX_LOG_SIZE = 100;
const activityLog: UserActivityEvent[] = [];

/**
 * Generates a CSS selector path for a given DOM element.
 * This helps identify which UI element was interacted with.
 * @param element The target element.
 * @returns A CSS selector string.
 */
// FIX: Export `generateSelector` so it can be used by other modules like the accessibility auditor.
export const generateSelector = (element: Element | null): string => {
    if (!element || !(element instanceof Element)) return 'unknown';

    const path: string[] = [];
    let current: Element | null = element;

    while (current && current.nodeType === Node.ELEMENT_NODE) {
        let selector = current.nodeName.toLowerCase();
        if (current.id) {
            selector += `#${current.id}`;
            path.unshift(selector);
            break; // ID is unique, no need to go further
        } else {
            let sibling: Element | null = current;
            let nth = 1;
            while ((sibling = sibling.previousElementSibling)) {
                if (sibling.nodeName.toLowerCase() === selector) {
                    nth++;
                }
            }
            if (nth !== 1) {
                selector += `:nth-of-type(${nth})`;
            }
        }
        path.unshift(selector);
        current = current.parentElement;
    }
    return path.join(' > ');
};

const logEvent = (event: UserActivityEvent) => {
    if (activityLog.length >= MAX_LOG_SIZE) {
        activityLog.shift(); // Remove the oldest entry to keep the log size manageable
    }
    activityLog.push(event);
};

const handleClick = (event: MouseEvent) => {
    const target = event.target as Element;
    logEvent({
        type: 'click',
        timestamp: Date.now(),
        details: {
            selector: generateSelector(target),
            position: { x: event.clientX, y: event.clientY },
            text: target.textContent?.trim().substring(0, 25) || undefined
        }
    });
};

const handleKeyDown = (event: KeyboardEvent) => {
    // To avoid logging potentially sensitive information, we only log non-character keys from inputs,
    // but log all keys from non-input elements.
    const isInput = event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement;
    if (isInput && event.key.length > 1) { // Log control keys like 'Enter', 'Escape' from inputs
         logEvent({
            type: 'keydown',
            timestamp: Date.now(),
            details: {
                selector: generateSelector(event.target as Element),
                key: event.key,
                code: event.code
            }
        });
    } else if (!isInput) {
        logEvent({
            type: 'keydown',
            timestamp: Date.now(),
            details: {
                selector: generateSelector(event.target as Element),
                key: event.key,
                code: event.code
            }
        });
    }
};

const init = () => {
    // Use capture phase to catch events before they are potentially stopped by other handlers.
    document.addEventListener('click', handleClick, { capture: true });
    document.addEventListener('keydown', handleKeyDown, { capture: true });
    console.log("LeapGuard Activity Monitor initialized.");
};

const getLogs = (): UserActivityEvent[] => {
    return [...activityLog]; // Return a copy for safety
};

// Expose to window for ErrorBoundary access
declare global {
    interface Window {
        LeapActivityLog: {
            init: () => void;
            // FIX: Using `any[]` to ensure this declaration is identical to the one in ErrorBoundary.tsx,
            // which resolves a TypeScript error about conflicting global types.
            getLogs: () => any[];
        };
    }
}

// Ensure the global object exists
if (!window.LeapActivityLog) {
    window.LeapActivityLog = {
        init,
        getLogs
    };
}


export const ActivityLogger = window.LeapActivityLog;