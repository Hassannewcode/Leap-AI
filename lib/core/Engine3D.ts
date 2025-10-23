


export const engine3D = `
const canvas = document.getElementById('game-canvas');
if (!canvas) throw new Error('Could not find canvas');

let scene = new THREE.Scene();
scene.background = new THREE.Color(0x111111);
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);

const clock = new THREE.Clock();
const state = new Map();
let cameraTarget = null;
let cameraOffset = new THREE.Vector3(0, 5, 10);

function resizeAll() {
     camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}
window.addEventListener('resize', resizeAll);
resizeAll();

let meshes = [];
let onUpdateCallback = (deltaTime) => {};

function cleanupObject3D(object3D) {
    if (!object3D) return;
    if (object3D.geometry) object3D.geometry.dispose();
    if (object3D.material) {
         if (Array.isArray(object3D.material)) {
            object3D.material.forEach(m => {
                if (m.map) m.map.dispose();
                m.dispose()
            });
         } else {
            if (object3D.material.map) object3D.material.map.dispose();
            object3D.material.dispose();
         }
    }
}

resetSceneState = function() {
    while(scene.children.length > 0){ 
        const obj = scene.children[0];
        cleanupObject3D(obj);
        scene.remove(obj);
    }
    meshes = [];
    onUpdateCallback = () => {};
    cameraTarget = null;
    scene.background = new THREE.Color(0x111111);
}

window.Engine = {
    THREE, 
    getScene: () => scene,
    getCamera: () => camera,
    onUpdate: (callback) => { onUpdateCallback = callback; },
    setData: (key, value) => state.set(key, value),
    getData: (key) => state.get(key),
    scene: {
        define: (name, setupFunc) => {
            scenes[name] = setupFunc;
        },
        load: (name) => {
            if (scenes[name]) {
                resetSceneState();
                scenes[name]();
                // FIX: Escape template literal within the string.
                console.log(\`Scene '\\\${name}' loaded.\`);
            } else {
                // FIX: Escape template literal within the string.
                console.error(\`Scene '\\\${name}' is not defined.\`);
            }
        }
    },
    create: {
        mesh: ({ name = 'unnamed', geometry = 'box', material = 'normal', color = 0xcccccc, textureUrl = null, position = [0,0,0], scale = [1,1,1], properties = {} }) => {
            let geom;
            switch(geometry) {
                case 'sphere': geom = new THREE.SphereGeometry(0.5, 32, 16); break;
                case 'capsule': geom = new THREE.CapsuleGeometry(0.5, 0.5, 16, 8); break;
                case 'plane': geom = new THREE.PlaneGeometry(1, 1); break;
                case 'icosahedron': geom = new THREE.IcosahedronGeometry(1); break;
                case 'cone': geom = new THREE.ConeGeometry(0.5, 1, 32); break;
                case 'box': default: geom = new THREE.BoxGeometry(1, 1, 1); break;
            }
            
            let mat;
            const matParams = { color, ...properties };
            if (textureUrl) {
                const textureLoader = new THREE.TextureLoader();
                matParams.map = textureLoader.load(textureUrl);
            }

            switch(material) {
                case 'phong': mat = new THREE.MeshPhongMaterial(matParams); break;
                case 'lambert': mat = new THREE.MeshLambertMaterial(matParams); break;
                case 'standard': mat = new THREE.MeshStandardMaterial(matParams); break;
                case 'normal': default: mat = new THREE.MeshNormalMaterial(); break;
            }

            const mesh = new THREE.Mesh(geom, mat);
            mesh.name = name;
            mesh.position.set(...position);
            mesh.scale.set(...scale);
            
            mesh.destroy = () => {
                window.Engine.destroy(mesh);
            };

            scene.add(mesh);
            meshes.push(mesh);
            return mesh;
        },
        light: ({ type = 'ambient', color = 0xffffff, intensity = 1, position = [0, 10, 0] }) => {
            let light;
            switch(type) {
                case 'hemisphere':
                    light = new THREE.HemisphereLight(color, properties.groundColor, intensity);
                    break;
                case 'directional': 
                    light = new THREE.DirectionalLight(color, intensity);
                    light.position.set(...position);
                    break;
                case 'point':
                    light = new THREE.PointLight(color, intensity);
                    light.position.set(...position);
                    break;
                case 'ambient':
                default:
                    light = new THREE.AmbientLight(color, intensity);
                    break;
            }
            scene.add(light);
            return light;
        },
        skybox: (paths) => {
            if (!Array.isArray(paths) || paths.length !== 6) {
                console.error("Engine.create.skybox requires an array of 6 image URLs.");
                return;
            }
            const loader = new THREE.CubeTextureLoader();
            const texture = loader.load(paths);
            scene.background = texture;
            return texture;
        }
    },
    destroy: (object3D) => {
        if (!object3D) return;
        cleanupObject3D(object3D);
        scene.remove(object3D);
        meshes = meshes.filter(m => m !== object3D);
    },
    input: {
        isPressed: (key) => {
            const keyMap = { 'space': 'Space', 'arrowleft': 'ArrowLeft', 'arrowright': 'ArrowRight', 'arrowup': 'ArrowUp', 'arrowdown': 'ArrowDown', 'keyw': 'KeyW', 'keya': 'KeyA', 'keys': 'KeyS', 'keyd': 'KeyD'};
            const mappedKey = key.toLowerCase().replace(/ /g, '');
            return keysPressed.has(keyMap[mappedKey] || key);
        }
    },
    camera: {
        follow: (meshToFollow, offset = [0, 5, 10]) => {
            cameraTarget = meshToFollow;
            cameraOffset.set(...offset);
        },
        lookAt: (target) => {
            cameraTarget = null;
            if (Array.isArray(target)) {
               camera.lookAt(new THREE.Vector3(...target));
            } else {
               camera.lookAt(target);
            }
        }
    },
    physics: {
        checkCollision: physics.checkCollision,
        getCollisions: physics.getCollisions,
    },
    ui: {
        drawText: (config) => console.warn('Engine.ui.drawText is not implemented for 3D yet.')
    },
    audio: {
        play: (soundName) => playSound(soundName)
    }
};

camera.position.z = 10;

// --- LeapGuard Instrumentation ---
if (window.LeapGuard && window.LeapGuard.instrument) {
    Engine.create.mesh = window.LeapGuard.instrument('Engine.create.mesh', Engine.create.mesh);
    Engine.create.light = window.LeapGuard.instrument('Engine.create.light', Engine.create.light);
    Engine.onUpdate = window.LeapGuard.instrument('Engine.onUpdate', Engine.onUpdate);
    Engine.scene.load = window.LeapGuard.instrument('Engine.scene.load', Engine.scene.load);
    window.LeapGuard.init({
        healthCheck: () => {
            if (meshes.length > 300) {
// FIX: Escaped template literal to prevent it from being evaluated in the outer scope.
                 window.LeapGuard.reportIncident('trusted', 'Performance Check', \`High object count: \${meshes.length}. This may impact performance.\`);
            }
            for (const mesh of meshes) {
                if (isNaN(mesh.position.x) || isNaN(mesh.position.y) || isNaN(mesh.position.z)) {
// FIX: Escaped template literal to prevent it from being evaluated in the outer scope.
                    window.LeapGuard.reportIncident('trusted', 'Data Integrity Check', \`Mesh '\${mesh.name}' has NaN position.\`, { uuid: mesh.uuid, position: mesh.position.toArray() });
                }
            }
        }
    });
}
`