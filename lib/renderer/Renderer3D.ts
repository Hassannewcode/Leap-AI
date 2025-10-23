
export const renderer3D = `
function animate() {
    const deltaTime = clock.getDelta();
    
    onUpdateCallback(deltaTime);
    
     if (isInspectMode) {
        raycaster.setFromCamera(mouse, camera);
        const intersects = raycaster.intersectObjects(meshes);

        if (intersects.length > 0) {
            if (hoveredMesh !== intersects[0].object) {
                hoveredMesh = intersects[0].object;
                if (boxHelper) scene.remove(boxHelper);
                boxHelper = new THREE.BoxHelper(hoveredMesh, 0x00ffff); // cyan color
                scene.add(boxHelper);
            }
        } else {
            hoveredMesh = null;
            if (boxHelper) {
                scene.remove(boxHelper);
                boxHelper = null;
            }
        }
    }
    
    if (cameraTarget) {
        const targetPosition = cameraTarget.position.clone().add(cameraOffset);
        camera.position.lerp(targetPosition, 0.08);
        camera.lookAt(cameraTarget.position);
    }

    if (boxHelper) {
        boxHelper.update();
    }

    renderer.render(scene, camera);
}
renderer.setAnimationLoop(animate);
`;
