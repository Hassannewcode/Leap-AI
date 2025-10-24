
import { useState, useEffect } from 'react';

/**
 * Custom React hook to track the browser's online/offline status.
 * It uses the 'online' and 'offline' events on the window object.
 * This is a key part of the "headless" monitoring system.
 *
 * @returns {boolean} True if the browser is online, false otherwise.
 */
export const useOnlineStatus = (): boolean => {
    // Initialize state with the current online status of the browser.
    const [isOnline, setIsOnline] = useState(navigator.onLine);

    useEffect(() => {
        // Define handlers to update the state.
        const handleOnline = () => setIsOnline(true);
        const handleOffline = () => setIsOnline(false);

        // Add event listeners when the component mounts.
        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        // Cleanup function to remove event listeners when the component unmounts.
        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, []); // Empty dependency array means this effect runs only once on mount.

    return isOnline;
};
