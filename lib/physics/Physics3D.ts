
export const physics3D = `
const physics = {
    checkCollision: (meshA, meshB) => {
        if (!meshA || !meshB) return false;
        const boxA = new THREE.Box3().setFromObject(meshA);
        const boxB = new THREE.Box3().setFromObject(meshB);
        return boxA.intersectsBox(boxB);
    },
    getCollisions: (mesh) => {
        const boxA = new THREE.Box3().setFromObject(mesh);
        return meshes.filter(other => {
            if (mesh === other) return false;
            const boxB = new THREE.Box3().setFromObject(other);
            return boxA.intersectsBox(boxB);
        });
    }
};
`;
