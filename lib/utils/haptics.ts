
// Centralized Haptic Feedback Utility

/**
 * Triggers haptic feedback if the device supports it.
 * A simple, short vibration is used for standard UI interactions.
 * @param pattern The vibration pattern. Can be a single number or an array of numbers. Defaults to a short 50ms pulse.
 */
export const triggerHapticFeedback = (pattern: VibratePattern = 50): void => {
    // Check if the Vibration API is supported by the browser
    if ('vibrate' in navigator) {
        try {
            // The navigator.vibrate method triggers vibration on the device.
            navigator.vibrate(pattern);
        } catch (error) {
            // This might happen in sandboxed environments or if the feature is disabled.
            console.warn("Haptic feedback failed.", error);
        }
    }
};
