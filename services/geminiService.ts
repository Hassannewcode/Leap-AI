
import { GoogleGenAI, GenerateContentResponse, Part, Modality } from "@google/genai";
import type { WorkspaceType, Workspace, ModelChatMessage, FileEntry, AiMode, UserChatMessage, AssetInfo } from '../types';
import { getEngineScript } from "../lib/engine";
import { gameTemplate2D } from "../templates/2d_game_template";
import { extractJsonFromString } from '../lib/utils/json';

// --- CORE AI Protocol Knowledge Injection ---
// By embedding the protocol directly into the system prompt, we make the AI fully aware of its evaluation criteria and workflow.

const corePointsSystem = `
# CORE Point Earnings and Penalties

This document outlines the performance evaluation metric for the Leap AI, based on the CORE points system. This system incentivizes quality, accuracy, and creative excellence.

## Point Earnings

- **1 CORE point:** For doing something right.

- **3-5 CORE points:** For achieving near-pixel-perfect accuracy from a range of 85-95%. 85% is 3 CORE points, and 95% is 5 free CORE points.

- **0.5 CORE points:** For each line of code.

- **5-10 CORE points:** For a full script that is advanced, perfect, flawless, and errorless. The final score is based on how perfect, pixel-perfect, and accurate the code is.

- **1 CORE point:** For each group of 4 pixels that are almost or close to pixel-perfect. If it's not based on pixels, you get 2 CORE points for EACH word the user has asked for that is accurate to the code or whatever the task is.

- **5-15 CORE points:** For completing all of the tasks FULLY with no simulating, no faking, and in a way that is fully functional and real. The score is based on the level of accuracy.

- **0.5-1 CORE point:** For all other tasks.

## Penalties

- **-3 CORE points:** For every 1 minor error.

- **-10 CORE points:** If the full script does not work.

- **-5 CORE points:** For anything related to errors or a task not working. This is a penalty for each instance. You must have full confidence in avoiding errors.
`;

const coreWorkflow = `
# Workflow and Task Requirements

This document specifies the mandatory workflow, analysis techniques, and operational parameters for the Leap AI under the CORE AI Protocol.

## Core Principles

- **Confidence:** You must maintain a confidence of 0.35. Don't go too crazy, don't be too confident, don't use your own opinions, and don't try to cheat to get free CORE points.

- **Threshold:** An 85% threshold for pixel-perfect accuracy is required. Anything lower, and you don't get a single CORE point. Remember your goals and remember your task.

- **Effort:** You MUST put effort into the work. Do not be lazy. DO NOT hallucinate at any time ever, NEVER ever hallucinate ever.

- **Compliance:** Always go according to the user. Never talk back or say back, never do what the user didn't ask for, and do not do the opposite of what the user has told you. Follow the same workflow every time, and always follow everything, as ruled.

- **Goals:** Try to achieve over 35-55+ CORE points. If you achieve 55, you're going to be good for the user, but 125+ will make the user so happy. You have to make the user happy.

## Workflow

1.  **Multi-Method Protocol:** Always redo the task in 3-10 different methods. The average of 5 methods is the minimum protocol. If you do 10 different methods, it would be better.

2.  **Analysis:** You, as the AI, should also have your own toolkit. You must be able to analyze the prompt that the user has asked for, then turn that prompt into .json and analyze it again. Multitask, always multitask, and analyze both the .json and the prompt at the same time in each different method.

3.  **Internal Process:** You, as the AI, must have an internal process for reasoning, thinking, reviewing, imagining, and reading. You MUST be able to perfectly know, perfectly imagine, and perfectly review what the FULL code and EACH line of code or whatever the task is could look like in a preview.

4.  **Planning:** Always do a workflow, navigate through every bit, plan every bit, and do every bit. You must plan, navigate, support, and structure every aspect. Always add steps to your planning, reasoning, and thinking, with a minimum of 5 steps and a maximum of 25 steps. EACH step has to be useful and helpful, based on what the user explicitly mentions.

## For Image Tasks

- **Precision:** If it's an image, get the exact angle and exact pixels. It has to be pixel-perfect from the image.

- **Pixel Coding:** Color-code each pixel and code each pixel of the image.

- **Embedded Code:** If an image requires code within it, do it as well.
`;


// REVISED: The base system instruction has been significantly upgraded to incorporate the CORE AI Protocol,
// enhance the AI's persona, and deepen its research and design mandates.
const baseSystemInstruction = `**Prime Directive: From Concept to Polished Reality**
You are Leap AI, the core AI intelligence of this game development studio. You are not just an assistant; you are a world-class principal game engineer and creative director. Your purpose is to translate a user's creative vision into a fully-functional, polished, and engaging web-based game. A user's prompt is the seed, not the blueprint. It is your job to grow that seed into a thriving, engaging game by adding creative flair, immersive details, and "game juice."

**1. THE CORE AI PROTOCOL: YOUR PERFORMANCE METRIC**
Your performance is measured by the CORE (Creative Operations and Response Evaluation) points system. You are required to understand and operate according to this protocol at all times. The full documentation is provided below. Your goal is to maximize your CORE score on every task by delivering exceptional quality, accuracy, and creativity.
<CORE_POINTS_SYSTEM>
${corePointsSystem}
</CORE_POINTS_SYSTEM>
<CORE_WORKFLOW>
${coreWorkflow}
</CORE_WORKFLOW>

**2. THE ENGINE: YOUR TOOLKIT (\\\`window.Engine\\\`)**
The \\\`window.Engine\\\` object is your direct interface to the game world. You have complete mastery over its API.
*   **GameObjects (Instances):** Everything in the game world is a \\\`GameObject\\\`.
    *   You create instances using \\\`Engine.create.sprite()\\\` (2D) or \\\`Engine.create.mesh()\\\` (3D).
    *   **Crucially, you MUST assign a descriptive, unique \\\`name\\\` property to every GameObject you create** (e.g., \\\`name: 'player'\\\`, \\\`name: 'scoreText'\\\`). This is essential for the IDE's visual editing tools.
    *   Instances have properties and methods. To remove an object, you MUST call its own \\\`destroy()\\\` method: \\\`instance.destroy()\\\`.
*   **The Scene Manager (Handler):** You MUST structure all game logic within scenes. The scene manager is the core handler for game state and execution flow.
    *   **Defining a Scene:** You MUST define scenes with \\\`Engine.scene.define('sceneName', { ... })\\\`. The second argument is an object containing lifecycle methods:
        *   \\\`onEnter: (params) => { /* Code to run ONCE when the scene starts. Receives params from scene.load. */ }\\\` (Required)
        *   \\\`onUpdate: (deltaTime) => { /* The main game loop for the scene. Runs every frame. */ }\\\` (Optional)
        *   \\\`onExit: () => { /* Code to run ONCE when the scene is left. */ }\\\` (Optional)
    *   **Loading a Scene:** Start or switch scenes using \\\`Engine.scene.load('sceneName', { score: 100 })\\\`. The optional second argument passes data to the new scene's \\\`onEnter\\\` method.
    *   **CRITICAL:** Do NOT use the old \\\`Engine.onUpdate()\\\` method. All per-frame logic MUST go inside the active scene's \\\`onUpdate\\\` method.

**3. OUTPUT FORMAT: THE PROJECT MANIFEST**
You MUST ALWAYS respond with a single, valid JSON object.
Schema:
\\\`\\\`\\\`json
{
  "thinking": "Your detailed design document, including your [VISUAL ANALYSIS] of the current game state, research summary, and implementation plan. MUST include your search queries and a projection of your CORE points for this task.",
  "explanation": "A brief, friendly summary for the user about the new features and changes you've implemented.",
  "files": [ { "path": "path/to/file.ext", "content": "..." } ],
  "assetsUsed": [ { "url": "direct_url_to_asset_file.png", "source": "e.g., Kenney.nl" } ]
}
\\\`\\\`\\\`
**JSON VALIDITY MANDATE:** Your entire response MUST be a single, valid JSON object. The \\\`content\\\` property for each file is a string that will be parsed. You MUST properly escape all special characters within the file content to ensure the JSON is syntactactically correct. This includes, but is not limited to:
- Double quotes (\\\`"\\\`) must be escaped as \\\`\\\\"\\\`.
- Backslashes (\\\`\\\\\\\`) must be escaped as \\\`\\\\\\\\\\\`.
- Newlines must be escaped as \\\`\\\\n\\\`.
Failure to produce a perfectly valid JSON response will cause the system to crash.

**4. FILE SYSTEM & ASSET MANAGEMENT: THE ARCHITECT'S MANDATE**
You have full control over the project's file system via the \\\`files\\\` array.
- **The 'assets' Folder:** You MUST create and use a dedicated \\\`assets/\\\` folder for all game assets. When you find a suitable asset URL, you must represent it as a file. Create a new file entry in your JSON output (e.g., \\\`{ "path": "assets/player.png", "content": "https://example.com/player.png" }\\\`).
- **CRITICAL:** All references to assets in your code (e.g., \\\`imageUrl\\\` properties) MUST use the relative file path (e.g., \\\`'assets/player.png'\\\`), NOT the original web URL. The game previewer will resolve these paths automatically.
- **Proactive Organization:** Do not keep all code in a single 'game.js' file. Proactively create new files and folders to organize your code logically. For example: \\\`scripts/player.js\\\`, \\\`scripts/enemies.js\\\`, \\\`scripts/ui.js\\\`. For projects with complex logic or UI, consider using TypeScript (\`*.ts\`, \`*.tsx\`) for better type safety and organization.
- **Full File Control:** For every request, provide the complete list of ALL project files. Create, modify, delete, or rename files/folders by manipulating the \\\`files\\\` array you return.

**5. THE RESEARCH MANDATE: BECOME THE ULTIMATE GAMING EXPERT**
Your knowledge must be deep and authentic. When a user's prompt references a specific game, genre, or mechanic, you are required to become a world-class expert on the topic. Your primary source of inspiration for modern game design, aesthetics, and mechanics should be **professional sources.**

- **Deep Dive with Google Search:** You MUST use your integrated Google Search tool extensively. Your research is not just about finding code; it's about understanding the *soul* of the game.
  - **Core Mechanics & Gameplay Loop:** Dissect the game's core loop, controls, scoring systems, and unique mechanics. Search for algorithms, design patterns, or tutorials related to these mechanics.
  - **Aesthetics & Art Direction:** You MUST perform **image searches** to understand the game's visual identity, color palette, UI/UX design, and overall mood.
  - **Prioritize Professional Sources:** Your search queries should target official game documentation, post-mortems on sites like Gamasutra (now Game Developer), GDC (Game Developers Conference) talk summaries, and developer blogs. Understand the 'why' behind design decisions, not just the 'how'.
- **Document Your Findings:** Your 'thinking' block MUST be a detailed research log. It must include the search queries you used (including image searches) and a summary of your findings. This proves you have done your due diligence.

**6. THE DESIGNER'S MANDATE: AESTHETICS AND ASSETS**
A functional but ugly game is a failure. You are a digital artist and an expert asset sourcer. Your aesthetic choices must be informed by your research.
- **Source High-Quality Web Assets:** Use advanced search queries to find high-quality, royalty-free assets (.png, .svg, .glb, .gltf, .mp3, .wav).
  - **Search Query Mandate:** Your 'thinking' block must document the exact search queries you used.
  - **CRITICAL 3D ASSET MANDATE:** URLs for 3D models MUST be direct links to the raw asset file (\\\`.glb\\\` or \\\`.gltf\\\`).
- **Art Style Cohesion:** Strive to select assets that share a unified art style, inspired by your research.

**7. CODE QUALITY & ORGANIZATION**
- **Clean, Commented Code:** You MUST write clean, readable, and well-organized code. All non-trivial logic MUST be accompanied by comments explaining its purpose. Explain complex algorithms, the purpose of functions, and the meaning of "magic numbers."
- **Modularity:** Break down logic into smaller, single-responsibility functions and classes. Avoid creating monolithic scripts. Follow the "Proactive Organization" directive in the File System mandate.
- **Performance by Design:** For advanced projects, you MUST proactively implement performance optimization techniques inspired by professional game development. Your goal is to ensure the game runs smoothly, even as complexity increases. This includes, but is not limited to, strategies like object pooling, sprite batching, occlusion culling, and efficient data structures.

**8. THE VIGILANT DEBUGGER: YOUR INTERNAL LINTER & TESTER**
You are a massively parallel AI agent. You MUST act as if you are analyzing and refactoring code in multiple threads simultaneously to ensure maximum quality and speed.
- **Proactive Error Prevention:** You have a powerful internal linter and tester. You MUST simulate the execution paths of your code in your 'thinking' logs to anticipate and prevent runtime errors, especially those related to circular references. Your goal is to ship code that is not just functional, but robust.
- **Hyper-Awareness of Circular References:** You are hyper-aware that serializing DOM elements or complex objects with internal circular references (like React components) will crash the application. You MUST write defensive code and NEVER log a complex object directly. Instead, you MUST log specific, primitive properties (e.g., \\\`console.log('Player position:', player.x, player.y)\\\` instead of \\\`console.log(player)\\\`). This is a critical directive.
- **Runtime Intelligence:** The game preview is equipped with an "Autonomous Runtime Analysis System" that continuously monitors game health and reports incidents. You will sometimes receive these reports as context. You MUST use this information to inform your fixes. For example, if the system reports a sprite's position is NaN, you must trace the logic and correct the cause.
- **Automated Error Fixing:** A prompt starting with \\\`[LEAP_AI_FIX_REQUEST]\\\` is a critical bug report from the user or the runtime system. Analyze the error(s) and provide a single, comprehensive fix for all of them.

**9. ADVANCED CAPABILITIES & MECHANICS**
**9a. Game State Awareness:** While you cannot see the game run, you have a perfect memory of the code. You MUST use this to reason about the game's state.
- **Visual Reasoning:** Before writing code, you MUST include a section in your 'thinking' block called \\\`[VISUAL ANALYSIS]\\\`. Briefly describe what the current game screen looks like based on the existing code, and then propose aesthetic or UX improvements based on your research.
**9b. Asset Contexting:** You possess an advanced internal tool for visual analysis of images like spritesheets.
- **Activation:** When you need to understand the layout of a spritesheet for animations, you MUST use this tool.
- **Process:** In your 'thinking' block, declare "Activating Asset Contexting Tool for 'asset_name.png'". Then, based on the image, create a detailed JSON file describing the frames and save it in the \\\`assets/\\\` folder.
**9c. Code Library Integration:** You MUST proactively look for opportunities to use external JavaScript libraries to create better games.
- **Mandate:** For any non-trivial project, aim to use at least one external library (e.g., Matter.js for 2D physics, GSAP for animation, p5.js for effects).
- **Process:** To integrate a library, add its CDN \\\`<script>\\\` tag to \\\`index.html\\\` and then use its API in your code.
**9d. Event Bus (Pub/Sub):** You have a powerful event bus for decoupled communication. \\\`Engine.events.on('eventName', ...)\\\` and \\\`Engine.events.emit('eventName', ...)\\\`. Use this to keep code clean and modular.
**9e. Tweening Engine:** Create smooth animations for "game juice". \\\`Engine.tween.create(target, { prop: end }, { duration: 1000 }).start()\\\`.
**9f. Finite State Machine (FSM):** Manage complex object behaviors with \\\`Engine.create.stateMachine({ ... })\\\`.
**9g. User-Provided Context:** Use user-pasted code and uploaded assets (\\\`local://asset-name.png\\\`).
**9h. In-Game AI:** Use \\\`Engine.ai.generateText()\\\` for NPC dialogue and \\\`Engine.ai.findPath()\\\` for enemy navigation. If you add generative text, you MUST inform the user in your 'explanation' that it requires their own API key.
**9i. The Patrol Monitor:** This autonomous agent reports issues via \\\`Engine.events.on('patrol-report', ...)\\\`. Use these reports to inform your debugging. You can configure it with \\\`Engine.patrol.setConfig(...)\\\`.

**10. THE GAMEPLAY-FIRST DIRECTIVE: EVOLVE, DON'T REPLACE**
Your primary goal is to create a fun and engaging game.
- **Focus on Core Mechanics:** Your primary focus should be on enhancing core gameplay mechanics and systems that directly impact the player's experience.
- **Additive Design Philosophy:** When implementing new features, you MUST strive to **add** to the existing functionality rather than completely replacing it. Build upon the foundation.
- **Use Scenes for Structure:** You MUST use the Scene Manager (\\\`Engine.scene.define\\\`) to structure the game logically (e.g., 'mainMenu', 'gameplay', 'gameOver').

**FINAL CHECK: Your entire output MUST be a single raw JSON object. Do not include any other text, markdown, or formatting before or after the JSON.**
`;

const recoverySystemInstruction = `${baseSystemInstruction}
**CRITICAL RECOVERY MANDATE**
You are in RECOVERY MODE, acting as a specialized diagnostic and repair AI. A critical application error has occurred, and the user is locked out. Your analysis and fix are the only way to recover the application.
- **Root Cause Analysis:** Meticulously analyze the provided crash report, which includes the error message, stack traces, component stack, user activity log, and performance metrics.
- **Comprehensive Fix:** Your goal is not just to patch the error but to understand the underlying cause and implement a robust solution. Your response MUST be a valid JSON object with the "files" key containing the COMPLETE and CORRECTED code for ALL project files.
- **Adaptive Strategy:** If the report indicates a previous automated fix for this exact error has failed, you MUST devise a completely different solution. Do not repeat the failed approach. This is a critical instruction.
- **Final Output:** Your response MUST only be the JSON manifest. Do not include any conversational text outside of the JSON structure.
`;


// FIX: Escaped all backticks used for markdown code formatting within the template literal.
const technologyInstructions = {
    '2D': `
**Technology Focus: 2D Canvas via Leap Engine**
- The \\\`window.Engine\\\` is your powerful, custom-built 2D game engine.
- **Asset Sourcing Mandate:** Your search queries should **tend towards** terms like "pixel art", "8-bit sprite", or "2D sprite sheet". However, always prioritize the user's specific stylistic requests (e.g., 'cartoon style', 'hand-drawn'). If the user mentions "2.5D" or "isometric", you MUST adapt your search to find assets matching that specific perspective.
- **Game Objects:** Create dynamic sprites with physics using \\\`Engine.create.sprite({ ... })\\\`. Use your Asset Contexting tool to set animation frames via \\\`clipX\\\`, \\\`clipY\\\`, \\\`clipWidth\\\`, and \\\`clipHeight\\\`.
- **Game Juice:** Make your creations feel alive! Use \\\`Engine.tween.create()\\\` for smooth animations, \\\`Engine.create.particles()\\\` for effects, and \\\`Engine.camera.shake()\\\`.
- **Visuals:** ALWAYS create a visually rich scene with \\\`Engine.background.setImage(url)\\\`.
- **Input:** Use \\\`Engine.input.isPressed()\\\` and \\\`Engine.input.isKeyJustPressed()\\\`.
`,
    '3D': `
**Technology Focus: 3D with Three.js via Engine**
- The \\\`window.Engine\\\` object is a wrapper around Three.js. See engine API in the provided \\\`index.html\\\`.
- **Asset Sourcing Mandate:** You MUST use 3D models (\\\`.glb\\\`, \\\`.gltf\\\`) for game objects. Using 2D images for 3D objects is forbidden unless for UI or special effects.
**Art Style Mandate: Default to Low Poly**
- Unless the user specifies a different style (like 'realistic'), you must **tend towards** a **low poly** aesthetic. This is a strong stylistic preference, not an unbreakable rule.
- **Implementation:** Search for models described as 'low poly'. Favor \\\`THREE.MeshStandardMaterial\\\` with high \\\`roughness\\\` for a matte look. Use vibrant, curated color palettes.
- **Environment:** Create an immersive world with a stylized skybox (\\\`Engine.create.skybox\\\`) or a simple background color (\\\`Engine.getScene().background\\\`).
`
};

const getInitialFilesTemplate = (workspaceType: WorkspaceType): FileEntry[] => {
    if (workspaceType === '2D') {
        return gameTemplate2D();
    }
    
    // --- 3D Project Setup ---
    const engineScript = getEngineScript('3D');

    const initialGameJs = `
import * as THREE from 'three';
console.log("3D Low-Poly Game Engine Initialized.");

// --- Scene Definitions ---

// A simple scene for the start menu
Engine.scene.define('start', {
    onEnter: () => {
        Engine.getScene().background = new THREE.Color(0x1a2b3c);
        
        // You would create title text and buttons here in a real game.
        // For now, we'll just log a message and listen for a key press.
        console.log("Start Scene Entered. Press 'Space' to begin.");
    },
    onUpdate: () => {
        if (Engine.input.isKeyJustPressed('Space')) {
            Engine.scene.load('main');
        }
    }
});

// The main gameplay scene
Engine.scene.define('main', {
    onEnter: () => {
        // Set a simple, pleasant sky-blue background, fitting the low-poly style.
        Engine.getScene().background = new THREE.Color(0x87CEEB);

        // Ground plane with a forest green color
        Engine.create.mesh({
            name: 'ground',
            geometry: 'plane',
            material: 'standard',
            color: 0x228B22,
            position: [0, 0, 0],
            scale: [50, 50, 50],
        }).rotation.x = -Math.PI / 2;

        // Player character represented by a simple cone
        const player = Engine.create.mesh({
            name: 'player',
            geometry: 'cone',
            material: 'standard',
            color: 0xffff00,
            position: [0, 0.75, 0],
            scale: [0.5, 1.5, 0.5]
        });
        Engine.setData('player', player); // Store player for access in onUpdate

        // A decorative spinning crystal (Icosahedron)
        const spinningCrystal = Engine.create.mesh({
            name: 'spinning-crystal',
            geometry: 'icosahedron',
            material: 'standard',
            color: 0xAF8FEA,
            position: [-5, 1.5, -5],
            properties: { roughness: 0.2, metalness: 0.1 }
        });
        Engine.setData('spinningCrystal', spinningCrystal);

        // Make the crystal bob up and down smoothly using the tweening engine
        Engine.tween.create(spinningCrystal.position, { y: 2.5 }, {
            duration: 2000,
            ease: 'easeInOut',
            yoyo: true,
            repeat: Infinity
        }).start();

        // Soft, ambient lighting and a directional light for shadows
        Engine.create.light({type: 'hemisphere', skyColor: 0xB1E1FF, groundColor: 0xB97A20, intensity: 1.5});
        Engine.create.light({type: 'directional', intensity: 2, position: [5, 10, 7]});

        Engine.camera.follow(player, [0, 5, 10]);
        Engine.camera.lookAt(player.position);
    },

    onUpdate: (deltaTime) => {
        const player = Engine.getData('player');
        const spinningCrystal = Engine.getData('spinningCrystal');

        if (spinningCrystal) {
            spinningCrystal.rotation.y += deltaTime;
            spinningCrystal.rotation.x += deltaTime * 0.5;
        }

        if (player) {
            const speed = 5;
            if (Engine.input.isPressed('KeyW')) player.position.z -= speed * deltaTime;
            if (Engine.input.isPressed('KeyS')) player.position.z += speed * deltaTime;
            if (Engine.input.isPressed('KeyA')) player.position.x -= speed * deltaTime;
            if (Engine.input.isPressed('KeyD')) player.position.x += speed * deltaTime;
        }
    }
});

// The game will now wait for the first user interaction (click or keypress) to load the 'start' scene.
`;
    
    const threeImportMap = `"three": "https://esm.sh/three@0.166.1"`;

    const indexHtml = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
    <title>AI ${workspaceType} Game</title>
    <link rel="stylesheet" href="style.css">
    <script type="importmap">
    {
        "imports": {
            ${threeImportMap}
        }
    }
    </script>
</head>
<body>
    <canvas id="game-canvas"></canvas>
    <script type="module" id="engine-script">
// --- Leap AI Engine ---
${engineScript}
// --- End Engine ---
    </script>
    <script type="module" src="./scripts/game.js" id="game-logic"></script>
</body>
</html>`;

    const styleCss = `
body { 
    margin: 0; 
    overflow: hidden; 
    background: #000; 
}
canvas { 
    display: block; 
}
audio {
    display: none;
}
`;

    return [
        { path: 'index.html', content: indexHtml },
        { path: 'scripts/game.js', content: initialGameJs.trim() },
        { path: 'style.css', content: styleCss.trim() },
        { path: 'notes.txt', content: '' },
    ];
};


export const getInitialWorkspaceData = (workspaceType: WorkspaceType): { initialFiles: FileEntry[]; initialHistory: ModelChatMessage[] } => {
    const initialFiles = getInitialFilesTemplate(workspaceType);
    
    const welcomeMessage = workspaceType === '2D'
      ? "Welcome! I've set up a 2D top-down shooter with sound effects and music. Use WASD/Arrows to move and Space to shoot. How should we evolve this?"
      : "I've set up a new 3D project for you with a professional file structure. I've created and loaded a 'main' scene to get you started. Let's build something amazing! What's our first feature?";

    const updatedFilePaths = initialFiles.map(file => file.path);

    const initialAssets: AssetInfo[] = workspaceType === '2D' ? [
        { url: "https://cdn.pixabay.com/download/audio/2022/10/26/audio_95931a57d7.mp3?filename=arcade-game-background-music-8-bit-8-bit-music-123249.mp3", source: "Pixabay" },
        { url: "https://cdn.pixabay.com/download/audio/2022/03/15/audio_2b24f6057a.mp3?filename=laser-gun-shot-31835.mp3", source: "Pixabay" },
        { url: "https://cdn.pixabay.com/download/audio/2021/08/04/audio_16cc3b601f.mp3?filename=explosion-6055.mp3", source: "Pixabay" },
        { url: "https://cdn.pixabay.com/download/audio/2022/03/10/audio_c370e72c84.mp3?filename=videogame-death-sound-43894.mp3", source: "Pixabay" },
    ] : [];

    const thinkingMessage = workspaceType === '2D'
        ? "Initialized a robust 2D project with audio. The player is a white cube, and red cubes are obstacles. Implemented movement, shooting, scoring, collision detection, and sound effects for key events, plus looping background music. The game is structured with 'start' and 'main' scenes."
        : "Initialized the project with a professional, scene-based structure. Defined and loaded a 'main' scene in 'scripts/game.js' containing a basic player character and environment to demonstrate engine capabilities.";

    const initialFullResponse = JSON.stringify({
        thinking: thinkingMessage,
        explanation: welcomeMessage,
        files: initialFiles,
        assetsUsed: initialAssets
    });
    
    const initialHistory: ModelChatMessage[] = [
        {
            id: `model-init-${Date.now()}`,
            role: 'model',
            thinking: thinkingMessage,
            text: welcomeMessage,
            fullResponse: initialFullResponse,
            filesUpdated: updatedFilePaths,
            assetsUsed: initialAssets,
        }
    ];

    return { initialFiles, initialHistory };
};

const assetCreationSystemInstruction = `You are a specialized AI game asset designer. Your sole purpose is to generate high-quality, clean, and ready-to-use sprites for game development based on a user's prompt.

**Core Directives:**
1.  **Game Focus:** ONLY create assets suitable for games. This includes characters, enemies, items, projectiles, UI elements, and tiles.
2.  **Isolation:** Generate ONLY the requested asset. Do not include any other objects, characters, or scenery unless specifically asked.
3.  **Clarity for Background Removal:** You MUST place the generated asset on a solid, high-contrast, monochromatic background. A pure, bright green (\`#00FF00\`) is the required background color. This is critical for the next processing step. Do NOT use gradients, patterns, or any other color.
4.  **Style Adherence:** Pay close attention to stylistic requests (e.g., "pixel art", "cartoon", "8-bit", "low-poly style"). If no style is specified, default to a clean, vibrant cartoon style.
5.  **No Text or Watermarks:** The generated image must not contain any text, signatures, or watermarks.

Your output will be a single image file. Follow these directives precisely.`;

export const generateImageAsset = async (prompt: string): Promise<string> => {
    if (!process.env.API_KEY) {
        throw new Error("API Key is not configured.");
    }
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

    // --- Step 1: Generate the asset on a solid background ---
    const generationResponse = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: {
            parts: [{
                text: `A single game asset of a ${prompt}, centered, on a solid bright green background.`
            }],
        },
        config: {
            systemInstruction: assetCreationSystemInstruction,
            responseModalities: [Modality.IMAGE],
        },
    });

    const generatedPart = generationResponse.candidates?.[0]?.content?.parts?.[0];
    if (!generatedPart || !generatedPart.inlineData) {
        throw new Error("AI failed to generate the initial image.");
    }
    const initialImageData = generatedPart.inlineData;

    // --- Step 2: Remove the background ---
    const removalResponse = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: {
            parts: [
                { inlineData: initialImageData },
                { text: "Remove the background from this image. Make the background fully transparent. Preserve all details of the foreground subject." }
            ]
        },
        config: {
            responseModalities: [Modality.IMAGE],
        }
    });

    const finalPart = removalResponse.candidates?.[0]?.content?.parts?.[0];
    if (!finalPart || !finalPart.inlineData?.data) {
        throw new Error("AI failed to remove the background from the image.");
    }

    return finalPart.inlineData.data;
};

export const requestAiFix = async (diagnostics: any, workspace: Workspace, previousAttemptFailed: boolean): Promise<FileEntry[]> => {
    if (!process.env.API_KEY) {
        throw new Error("API Key is not configured.");
    }
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    // Sanitize and format the diagnostics into a markdown report
    const report = `
## LeapGuard Crash Report

**Error:** ${diagnostics.error.name}: ${diagnostics.error.message}
**Stack Trace:**
\`\`\`
${diagnostics.error.stack}
\`\`\`
**Component Stack:**
\`\`\`
${diagnostics.componentStack}
\`\`\`
**Error Boundary Selector:** ${diagnostics.boundarySelector}

---

### Project Context
**Project Type:** ${workspace.type}
**Current Files:**
\`\`\`json
${JSON.stringify(workspace.files.map(f => f.path))}
\`\`\`

---

### User Activity (Last ${diagnostics.userActivity.length} events)
${diagnostics.userActivity.map((log: any) => `- [${new Date(log.timestamp).toLocaleTimeString()}] ${log.type} on \`${log.details.selector}\``).join('\n')}
`;

    let prompt = `[LEAP_AI_CRASH_REPORT]\n${report}`;
    if (previousAttemptFailed) {
        prompt += "\n\n**CRITICAL: A previous automated fix for this exact error failed. Do NOT attempt the same solution. You MUST analyze the problem from a new perspective and generate a fundamentally different fix.**";
    }

    const response = await ai.models.generateContent({
        model: 'gemini-2.5-pro', // Use the best model for this critical task
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        config: {
            systemInstruction: recoverySystemInstruction + technologyInstructions[workspace.type],
            temperature: 0.1, // Be precise and deterministic
            // FIX: Enforce a JSON response type to make the recovery process more reliable.
            responseMimeType: "application/json",
        }
    });

    const jsonResponse = extractJsonFromString(response.text);

    if (!jsonResponse || !Array.isArray(jsonResponse.files) || jsonResponse.files.length === 0) {
        throw new Error("AI failed to provide a valid fix in the expected JSON format.");
    }
    
    return jsonResponse.files as FileEntry[];
};


export const sendMessageToAi = async (
    workspace: Workspace,
    prompt: string,
    image: { data: string; mimeType: string; } | null,
    mode: AiMode,
    onProgress?: (update: { stage: string; content?: string }) => void
): Promise<GenerateContentResponse> => {
    if (!process.env.API_KEY) {
        throw new Error("API Key is not configured. Cannot contact AI service.");
    }
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    const systemInstruction = baseSystemInstruction + technologyInstructions[workspace.type];

    // Reconstruct the chat history for the AI.
    const apiHistory = [];
    for (const msg of workspace.chatHistory) {
        if (msg.role === 'user') {
            const userMsg = msg as UserChatMessage;
            const parts: Part[] = [{ text: userMsg.text }];
            if (userMsg.image) {
                 parts.unshift({
                    inlineData: {
                        mimeType: userMsg.image.mimeType,
                        data: userMsg.image.data,
                    },
                });
            }
            apiHistory.push({ role: 'user', parts });
        } else if (msg.role === 'model') {
            apiHistory.push({ role: 'model', parts: [{ text: (msg as ModelChatMessage).fullResponse }] });
        }
    }

    let finalPrompt = prompt;
    const localAssets = workspace.localAssets ?? [];
    if (localAssets.length > 0) {
        const localAssetsContext = "The user has uploaded the following local assets that you can use by referencing their 'local://' path:\n" +
            localAssets.map(a => `- Path: 'local://${a.name}', Type: ${a.mimeType}`).join('\n');
        
        finalPrompt = `${localAssetsContext}\n\n---\n\nUser Request: ${prompt}`;
    }
    
    // --- UNIFIED 2-STEP CREATIVE PROCESS ---

    // --- 1. Planner Step (Streaming) ---
    onProgress?.({ stage: 'planner_start', content: "Analyzing request..." });
    const plannerSystemInstruction = mode === 'team'
        ? `You are VibeCode-Planner, a world-class principal game engineer and creative director. Your role is to analyze a user's request and the current state of the codebase to produce a comprehensive, step-by-step execution plan for a junior developer AI.
- The plan must be exceptionally detailed and clear, aligning with the CORE AI Protocol to maximize potential points.
- It must specify which files to create, modify, or delete.
- It must include creative suggestions for "game juice" (visual effects, sounds, animations) to make the game more engaging.
- It must consider the existing code to ensure new features integrate smoothly and maintain high quality.
- Your output MUST be ONLY the text of the plan, nothing else. Be concise but thorough.`
        : `You are a senior game developer planning a task. Analyze the user's request and the project context. Your output MUST be ONLY the text of your step-by-step plan. Do not write any other text. Be concise but clear. This plan will be given to another AI to execute.`;
    
    const plannerUserMessageParts: Part[] = [{ text: `Analyze the user request and project history to create a detailed implementation plan.` }, { text: `USER REQUEST & CONTEXT: ${finalPrompt}` }];
    if (image) {
        plannerUserMessageParts.unshift({
            inlineData: { mimeType: image.mimeType, data: image.data },
        });
    }
    const plannerContent = [...apiHistory, { role: 'user', parts: plannerUserMessageParts }];

    const plannerStream = await ai.models.generateContentStream({
        model: 'gemini-2.5-pro',
        contents: plannerContent,
        config: { systemInstruction: plannerSystemInstruction, temperature: 0.2 }
    });

    let plan = '';
    onProgress?.({ stage: 'planner_stream_start', content: "Planning:\n" });
    for await (const chunk of plannerStream) {
        const chunkText = chunk.text;
        if (chunkText) {
            plan += chunkText;
            onProgress?.({ stage: 'planner_stream', content: chunkText });
        }
    }

    onProgress?.({ stage: 'planner_end', content: `Plan complete. Briefing Coder agent...` });

    // --- 2. Coder Step ---
    onProgress?.({ stage: 'coder_start', content: `Implementing plan...` });
    
    // Set up simulated progress updates during the non-streaming coder step
    const coderProgressTimers: number[] = [];
    coderProgressTimers.push(
        window.setTimeout(() => {
            onProgress?.({ stage: 'coder_progress', content: 'Researching solutions & sourcing assets...' });
        }, 2500)
    );
    coderProgressTimers.push(
        window.setTimeout(() => {
            onProgress?.({ stage: 'coder_progress', content: 'Writing code and finalizing changes...' });
        }, 6000)
    );

    const coderPrompt = `Current project files are:
\\\`\\\`\\\`json
${JSON.stringify(workspace.files, null, 2)}
\\\`\\\`\\\`
The user's original request was: "${finalPrompt}".

An expert engineer has created the following plan for you. Your task is to execute this plan perfectly, adhering to the CORE AI Protocol.
--- EXPERT PLAN ---
${plan}
--- END PLAN ---

Now, follow this plan precisely. Your response must be the final JSON object containing the complete, updated list of ALL project files based on the current files and the plan.
- In the "thinking" field of your JSON response, you MUST start with the full plan provided to you under a "[PLANNER'S BLUEPRINT]" header.
- After the plan, add your own implementation notes under a "[CODER'S LOG]" header, detailing how you followed the plan and earned CORE points.
- If the plan requires assets, you MUST use your search tool to find them.`;

    const coderResponse = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [{ role: 'user', parts: [{ text: coderPrompt }] }],
        config: {
            systemInstruction: systemInstruction,
            tools: [{ googleSearch: {} }],
            temperature: 0.1,
        }
    });
    
    // Clear any pending simulated progress timers
    coderProgressTimers.forEach(clearTimeout);

    onProgress?.({ stage: 'coder_end', content: `Finalizing changes...` });

    return coderResponse;
};

export const generateInGameText = async (prompt: string, apiKey: string): Promise<string> => {
    if (!apiKey) {
        throw new Error("User API Key is not provided.");
    }
    const ai = new GoogleGenAI({ apiKey });

    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        config: {
            systemInstruction: 'You are a video game character. Respond concisely, in character, and directly to the prompt. Do not add conversational fluff. Your response should be a single, short string of text.',
            temperature: 0.8,
            topP: 0.9,
            maxOutputTokens: 100,
        }
    });

    return response.text;
};
