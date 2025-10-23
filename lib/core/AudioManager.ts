export const audioManager = `
const audioContext = new (window.AudioContext || window.webkitAudioContext)();

function playSound(soundName) {
    if (audioContext.state === 'suspended') {
        audioContext.resume();
    }
    
    const soundId = \`offline-sound-\\\${soundName}\`;
    const audioEl = document.getElementById(soundId);

    if (audioEl && typeof audioEl.play === 'function') {
        audioEl.currentTime = 0;
        audioEl.play().catch(error => {
            // Play() can return a promise which may be rejected if the user hasn't interacted with the page yet.
            // We'll log this as a warning, not an error.
            // FIX: Escape template literal within the string.
            console.warn(\`Could not play sound "\\\${soundName}":\`, error);
        });
    } else {
        console.warn(\`Audio element with ID "\\\${soundId}" not found.\`);
    }
}
`;