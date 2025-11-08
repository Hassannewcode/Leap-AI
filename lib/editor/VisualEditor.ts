
// For 2D
export const visualEditor2D = `
let isInspectMode = false;
let mousePos = { x: 0, y: 0 };
let worldMousePos = { x: 0, y: 0 };
let hoveredSprite = null;
let selectedSprite = null;
let dragState = { type: null, startX: 0, startY: 0, startSprite: {} };
window.gizmoState = { // Shared state for renderer to draw and editor to interact
    handles: {},
    hoveredHandle: null
};

function getTransformedRect(sprite) {
    const w = sprite.width;
    const h = sprite.height;
    const cx = sprite.x;
    const cy = sprite.y;
    const rot = sprite.rotation || 0;
    const cos = Math.cos(rot);
    const sin = Math.sin(rot);

    const transform = (x, y) => ({
        x: cx + x * cos - y * sin,
        y: cy + x * sin + y * cos
    });

    return [
        transform(-w / 2, -h / 2), // top-left
        transform(w / 2, -h / 2),  // top-right
        transform(w / 2, h / 2),   // bottom-right
        transform(-w / 2, h / 2)  // bottom-left
    ];
}

function isPointInPolygon(point, polygon) {
    let isInside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
        const xi = polygon[i].x, yi = polygon[i].y;
        const xj = polygon[j].x, yj = polygon[j].y;

        const intersect = ((yi > point.y) !== (yj > point.y))
            && (point.x < (xj - xi) * (point.y - yi) / (yj - yi) + xi);
        if (intersect) isInside = !isInside;
    }
    return isInside;
}


function updateMousePos(event) {
    const rect = canvas.getBoundingClientRect();
    mousePos.x = event.clientX - rect.left;
    mousePos.y = event.clientY - rect.top;

    // Continuously update world mouse position for hover checks
     worldMousePos = { 
        x: ( (mousePos.x - offsetX) / scale - VIRTUAL_WIDTH / 2 ) / camera.zoom + camera.x + VIRTUAL_WIDTH / 2,
        y: ( (mousePos.y - offsetY) / scale - VIRTUAL_HEIGHT / 2 ) / camera.zoom + camera.y + VIRTUAL_HEIGHT / 2
    };
}

function handleSelection() {
    if (hoveredSprite) {
        if (selectedSprite !== hoveredSprite) {
            selectedSprite = hoveredSprite;
            // Send full sprite data on selection
            window.parent.postMessage({ type: 'visual-editor-select', payload: { 
                id: selectedSprite.id, 
                name: selectedSprite.name || 'Unnamed Object',
                x: selectedSprite.x,
                y: selectedSprite.y,
                width: selectedSprite.width,
                height: selectedSprite.height,
                rotation: selectedSprite.rotation || 0
            } }, '*');
        }
    } else {
        if (selectedSprite) {
             selectedSprite = null;
             window.parent.postMessage({ type: 'visual-editor-select', payload: null }, '*');
        }
    }
}

function handleMouseDown(e) {
    if (!isInspectMode || !selectedSprite) return;
    
    // Check if clicking on a gizmo handle
    if (window.gizmoState.hoveredHandle) {
        dragState.type = window.gizmoState.hoveredHandle;
    } else if (isPointInPolygon(worldMousePos, getTransformedRect(selectedSprite))) {
        dragState.type = 'move';
    } else {
        // Clicked outside the selected sprite, deselect it
        handleSelection();
        return;
    }
    
    dragState.startX = worldMousePos.x;
    dragState.startY = worldMousePos.y;
    dragState.startSprite = { ...selectedSprite };
}

function handleMouseMove(e) {
    // Hover and cursor update logic
    let cursor = 'default';
    if (isInspectMode) {
        if (dragState.type) { // If dragging, cursor is already set
            cursor = document.body.style.cursor;
        } else {
            window.gizmoState.hoveredHandle = null;
            if (selectedSprite) {
                 for (const handleName in window.gizmoState.handles) {
                    const handle = window.gizmoState.handles[handleName];
                    const dist = Math.hypot(worldMousePos.x - handle.x, worldMousePos.y - handle.y);
                    if (dist < handle.size / camera.zoom) {
                        cursor = handle.cursor;
                        window.gizmoState.hoveredHandle = handleName;
                        break;
                    }
                }
            }
            if (!window.gizmoState.hoveredHandle) {
                if (hoveredSprite) {
                    cursor = 'move';
                }
            }
        }
    }
    document.body.style.cursor = cursor;


    // Dragging logic
    if (!dragState.type) return;

    const dx = worldMousePos.x - dragState.startX;
    const dy = worldMousePos.y - dragState.startY;
    const s = dragState.startSprite;
    const updatedProps = {};

    switch (dragState.type) {
        case 'move':
            selectedSprite.x = s.x + dx;
            selectedSprite.y = s.y + dy;
            updatedProps.x = selectedSprite.x;
            updatedProps.y = selectedSprite.y;
            break;
        case 'rotate':
            const angle = Math.atan2(worldMousePos.y - s.y, worldMousePos.x - s.x) + Math.PI / 2;
            selectedSprite.rotation = angle;
            updatedProps.rotation = selectedSprite.rotation;
            break;
        default: // Resize handles
            const cos = Math.cos(-s.rotation);
            const sin = Math.sin(-s.rotation);
            const localDx = dx * cos - dy * sin;
            const localDy = dx * sin + dy * cos;

            let newWidth = s.width;
            let newHeight = s.height;
            let newX = s.x;
            let newY = s.y;

            if (dragState.type.includes('r')) { newWidth = s.width + localDx; }
            if (dragState.type.includes('l')) { newWidth = s.width - localDx; }
            if (dragState.type.includes('b')) { newHeight = s.height + localDy; }
            if (dragState.type.includes('t')) { newHeight = s.height - localDy; }
            
            if (newWidth < 1) newWidth = 1;
            if (newHeight < 1) newHeight = 1;

            // Adjust position to keep the center point moving correctly
            const dw = newWidth - s.width;
            const dh = newHeight - s.height;
            const moveX = (dw / 2) * Math.cos(s.rotation);
            const moveY = (dw / 2) * Math.sin(s.rotation);
            const moveHX = (dh / 2) * Math.sin(s.rotation); // perpendicular to width vector
            const moveHY = -(dh / 2) * Math.cos(s.rotation);

            if (dragState.type.includes('r')) { newX += moveX; newY += moveY; }
            if (dragState.type.includes('l')) { newX -= moveX; newY -= moveY; }
            if (dragState.type.includes('b')) { newX -= moveHX; newY -= moveHY; }
            if (dragState.type.includes('t')) { newX += moveHX; newY += moveHY; }

            selectedSprite.x = newX;
            selectedSprite.y = newY;
            selectedSprite.width = newWidth;
            selectedSprite.height = newHeight;
            
            updatedProps.x = newX;
            updatedProps.y = newY;
            updatedProps.width = newWidth;
            updatedProps.height = newHeight;
            break;
    }
    
    // Post updates for the inspector panel in real-time
    if (Object.keys(updatedProps).length > 0) {
        const payload = { ...selectedSprite, ...updatedProps };
        window.parent.postMessage({ type: 'visual-editor-select', payload }, '*');
    }
}

function handleMouseUp(e) {
    if (!dragState.type) return;

    const updates = {};
    const start = dragState.startSprite;
    
    if (selectedSprite.x !== start.x) updates.x = selectedSprite.x;
    if (selectedSprite.y !== start.y) updates.y = selectedSprite.y;
    if (selectedSprite.width !== start.width) updates.width = selectedSprite.width;
    if (selectedSprite.height !== start.height) updates.height = selectedSprite.height;
    if (selectedSprite.rotation !== start.rotation) updates.rotation = selectedSprite.rotation;

    if (Object.keys(updates).length > 0) {
        window.parent.postMessage({ type: 'visual-editor-update-object', payload: { name: selectedSprite.name, updates } }, '*');
    }
    
    dragState.type = null;
}

canvas.addEventListener('mousemove', updateMousePos);
canvas.addEventListener('mousedown', handleMouseDown);
canvas.addEventListener('mouseup', handleMouseUp);
canvas.addEventListener('click', () => {
    // Only handle selection on click if we are not finishing a drag operation
    if (isInspectMode && !dragState.type) {
         handleSelection();
    }
});

window.addEventListener('message', (event) => {
    if (event.data?.type === 'visual-editor-toggle') {
        isInspectMode = event.data.payload.enabled;
        if (!isInspectMode) {
            hoveredSprite = null;
            selectedSprite = null;
            window.parent.postMessage({ type: 'visual-editor-select', payload: null }, '*');
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