// For 2D
export const visualEditor2D = `
let isInspectMode = false;
let mousePos = { x: 0, y: 0 };
let hoveredSprite = null;
let selectedSprite = null;

function sendSelectionData(sprite) {
    if (sprite) {
        window.parent.postMessage({ type: 'visual-editor-select', payload: {
            id: sprite.id,
            name: sprite.name || 'Unnamed Object',
            type: '2D',
            x: sprite.x,
            y: sprite.y,
            width: sprite.width,
            height: sprite.height,
            rotation: sprite.rotation || 0,
            alpha: sprite.alpha !== undefined ? sprite.alpha : 1,
        } }, '*');
    } else {
        window.parent.postMessage({ type: 'visual-editor-select', payload: null }, '*');
    }
}


function updateMousePos(event) {
    const rect = canvas.getBoundingClientRect();
    mousePos.x = event.clientX - rect.left;
    mousePos.y = event.clientY - rect.top;
}
canvas.addEventListener('mousemove', updateMousePos);
canvas.addEventListener('click', () => {
    if (isInspectMode) {
        if (hoveredSprite) {
            selectedSprite = hoveredSprite;
        } else {
            selectedSprite = null;
        }
        sendSelectionData(selectedSprite);
    }
});
window.addEventListener('message', (event) => {
    if (event.data?.type === 'visual-editor-toggle') {
        isInspectMode = event.data.payload.enabled;
        if (!isInspectMode) {
            hoveredSprite = null; // Clear hover when disabling
            selectedSprite = null;
            sendSelectionData(null);
        }
    }
    if (event.data?.type === 'visual-editor-update-property') {
        const { id, propertyPath, value } = event.data.payload;
        const spriteToUpdate = sprites.find(s => s.id === id);
        if (spriteToUpdate) {
            // This is a simple property updater, doesn't handle nested paths for 2D.
            spriteToUpdate[propertyPath] = parseFloat(value) || value;
        }
    }
    if (event.data?.type === 'visual-editor-force-select') {
        const { id } = event.data.payload;
        if (id === null) {
            selectedSprite = null;
        } else {
            const spriteToSelect = sprites.find(s => s.id === id);
            if (spriteToSelect) {
                selectedSprite = spriteToSelect;
            }
        }
        sendSelectionData(selectedSprite);
    }
});

// Periodically send scene graph
setInterval(() => {
    if (isInspectMode) {
         const sceneGraph = sprites.map(s => ({
            id: s.id,
            name: s.name || \`Unnamed (\${s.id.toString().slice(2, 6)})\`,
            type: s.isText ? 'UIText' : 'Sprite',
        }));
        window.parent.postMessage({ type: 'scene-graph-update', payload: sceneGraph }, '*');
    }
}, 1000);
`;
// For 3D
export const visualEditor3D = `
let isInspectMode = false;
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
let hoveredMesh = null;
let selectedMesh = null;
let boxHelper = null;

function sendSelectionData(mesh) {
    if (boxHelper) {
        scene.remove(boxHelper);
        boxHelper = null;
    }
    if (mesh) {
        boxHelper = new THREE.BoxHelper(mesh, 0x00ffff); // cyan color
        scene.add(boxHelper);
        
        window.parent.postMessage({ type: 'visual-editor-select', payload: {
            id: mesh.uuid,
            name: mesh.name || 'Unnamed Mesh',
            type: '3D',
            position: { x: mesh.position.x, y: mesh.position.y, z: mesh.position.z },
            scale: { x: mesh.scale.x, y: mesh.scale.y, z: mesh.scale.z },
            rotation: { x: mesh.rotation.x, y: mesh.rotation.y, z: mesh.rotation.z },
        } }, '*');
    } else {
         window.parent.postMessage({ type: 'visual-editor-select', payload: null }, '*');
    }
}

function updateMousePos(event) {
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = - (event.clientY / window.innerHeight) * 2 + 1;
}
canvas.addEventListener('mousemove', updateMousePos, false);
canvas.addEventListener('click', () => {
    if (isInspectMode) {
        if (hoveredMesh) {
            selectedMesh = hoveredMesh;
        } else {
            selectedMesh = null;
        }
        sendSelectionData(selectedMesh);
    }
});
 window.addEventListener('message', (event) => {
    if (event.data?.type === 'visual-editor-toggle') {
        isInspectMode = event.data.payload.enabled;
         if (!isInspectMode) {
            selectedMesh = null;
            hoveredMesh = null;
            sendSelectionData(null);
        }
    }
    if (event.data?.type === 'visual-editor-update-property') {
        const { id, propertyPath, value } = event.data.payload;
        const meshToUpdate = meshes.find(m => m.uuid === id);
        if (meshToUpdate) {
            const keys = propertyPath.split('.');
            let current = meshToUpdate;
            for(let i=0; i < keys.length - 1; i++) {
                current = current[keys[i]];
            }
            if (current) {
                current[keys[keys.length - 1]] = parseFloat(value) || value;
            }
        }
    }
     if (event.data?.type === 'visual-editor-force-select') {
        const { id } = event.data.payload;
        if (id === null) {
            selectedMesh = null;
        } else {
             const meshToSelect = meshes.find(m => m.uuid === id);
            if (meshToSelect) {
                selectedMesh = meshToSelect;
            }
        }
        sendSelectionData(selectedMesh);
    }
});

// Periodically send scene graph
setInterval(() => {
    if (isInspectMode) {
         const sceneGraph = meshes.map(m => ({
            id: m.uuid,
            name: m.name || \`Unnamed Mesh\`,
            type: m.type || 'Object3D',
        }));
        window.parent.postMessage({ type: 'scene-graph-update', payload: sceneGraph }, '*');
    }
}, 1000);
`;