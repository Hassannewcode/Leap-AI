
export const inputManager = `
const keysPressed = new Set();
const keysJustPressed = new Set();

document.addEventListener('keydown', (e) => {
    if (!keysPressed.has(e.code)) {
        keysJustPressed.add(e.code);
    }
    keysPressed.add(e.code);
});

document.addEventListener('keyup', (e) => {
    keysPressed.delete(e.code);
});

// This function will be called by the renderer at the start of each frame
function clearJustPressed() {
    keysJustPressed.clear();
}
`;
