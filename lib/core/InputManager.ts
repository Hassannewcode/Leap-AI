

export const inputManager = `
const keysPressed = new Set();
const keysJustPressed = new Set();
let isMousePressed = false;
let isMouseJustClickedFlag = false;
const mousePosition = { x: 0, y: 0 };

document.addEventListener('keydown', (e) => {
    if (!keysPressed.has(e.code)) {
        keysJustPressed.add(e.code);
    }
    keysPressed.add(e.code);
});

document.addEventListener('keyup', (e) => {
    keysPressed.delete(e.code);
});

document.addEventListener('mousedown', (e) => {
    isMousePressed = true;
    isMouseJustClickedFlag = true;
});

document.addEventListener('mouseup', (e) => {
    isMousePressed = false;
});

document.addEventListener('mousemove', (e) => {
    const canvas = document.getElementById('game-canvas');
    if (canvas) {
        const rect = canvas.getBoundingClientRect();
        mousePosition.x = e.clientX - rect.left;
        mousePosition.y = e.clientY - rect.top;
    }
});


// This function will be called by the renderer at the start of each frame
function clearJustPressed() {
    keysJustPressed.clear();
    isMouseJustClickedFlag = false;
}
`;