
import { WorkspaceType } from '../types';

import { consoleOverride } from './utils/consoleOverride';
import { autonomousDebugger } from './utils/debugger';
import { safetyProtocol } from './core/safetyProtocol';

import { assetManager } from './assets/AssetManager';
import { audioManager } from './core/AudioManager';
import { inputManager } from './core/InputManager';
import { sceneManager } from './core/SceneManager';

import { visualEditor2D, visualEditor3D } from './editor/VisualEditor';
import { physics2D } from './physics/Physics2D';
import { physics3D } from './physics/Physics3D';
import { engine2D } from './core/Engine2D';
import { engine3D } from './core/Engine3D';
import { renderer2D } from './renderer/Renderer2D';
import { renderer3D } from './renderer/Renderer3D';

export const getEngineScript = (workspaceType: WorkspaceType): string => {
    
    // Common modules for both 2D and 3D
    const commonModules = [
        consoleOverride,
        autonomousDebugger,
        assetManager,
        audioManager,
        inputManager,
        sceneManager,
        safetyProtocol
    ];
    
    if (workspaceType === '2D') {
        const modules2D = [
            ...commonModules,
            physics2D,
            engine2D, // Defines window.Engine and depends on physics
            visualEditor2D, // Depends on canvas and sprites array
            renderer2D, // The main loop, depends on everything before it
        ];
        return modules2D.join('\n\n');

    }

    if (workspaceType === '3D') {
        const modules3D = [
            `import * as THREE from 'three';`,
            ...commonModules,
            physics3D,
            engine3D, // Defines window.Engine, depends on THREE and physics
            visualEditor3D, // Depends on canvas, camera, scene, meshes
            renderer3D, // The main loop
        ];
        return modules3D.join('\n\n');
    }

    return '';
};
