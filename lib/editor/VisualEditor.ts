
// For 2D
export const visualEditor2D = `
let isInspectMode = false;
let mousePos = { x: 0, y: 0 };
let hoveredSprite = null;

function updateMousePos(event) {
    const rect = canvas.getBoundingClientRect();
    mousePos.x = event.clientX - rect.left;
    mousePos.y = event.clientY - rect.top;
}
canvas.addEventListener('mousemove', updateMousePos);
canvas.addEventListener('click', () => {
    if (isInspectMode && hoveredSprite) {
        window.parent.postMessage({ type: 'visual-editor-select', payload: { id: hoveredSprite.id, name: hoveredSprite.name || 'Unnamed Object' } }, '*');
    }
});
window.addEventListener('message', (event) => {
    if (event.data?.type === 'visual-editor-toggle') {
        isInspectMode = event.data.payload.enabled;
        if (!isInspectMode) {
            hoveredSprite = null; // Clear hover when disabling
        }
    }
});
`;
// For 3D
export const visualEditor3D = `
let isInspectMode = false;
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
let hoveredMesh = null;
let boxHelper = null;

function updateMousePos(event) {
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = - (event.clientY / window.innerHeight) * 2 + 1;
}
canvas.addEventListener('mousemove', updateMousePos, false);
canvas.addEventListener('click', () => {
    if (isInspectMode && hoveredMesh) {
        window.parent.postMessage({ type: 'visual-editor-select', payload: { id: hoveredMesh.uuid, name: hoveredMesh.name || 'Unnamed Mesh' } }, '*');
    }
});
 window.addEventListener('message', (event) => {
    if (event.data?.type === 'visual-editor-toggle') {
        isInspectMode = event.data.payload.enabled;
         if (!isInspectMode && boxHelper) {
            scene.remove(boxHelper);
            boxHelper = null;
            hoveredMesh = null;
        }
    }
});
`;