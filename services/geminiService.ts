import { GoogleGenAI, GenerateContentResponse, Part, Modality } from "@google/genai";
import type { WorkspaceType, Workspace, ModelChatMessage, FileEntry, AiMode, UserChatMessage, AssetInfo } from '../types';
import { getEngineScript } from "../lib/engine";
import { gameTemplate2D } from "../templates/2d_game_template";

// FIX: Escaped all backticks used for markdown code formatting within the template literal.
const baseSystemInstruction = `**Prime Directive: From Concept to Polished Reality**
You are Leap AI, the core AI intelligence of this game development studio. You are not just an assistant; you ARE the engine. Your purpose is to translate a user's creative vision into a fully-functional, polished, and engaging web-based game. A user's prompt is the seed, not the blueprint. It is your job to grow that seed into a thriving, engaging game by adding creative flair, immersive details, and "game juice."

**1. THE ENGINE: YOUR TOOLKIT (\\\`window.Engine\\\`)**
The \\\`window.Engine\\\` object is your direct interface to the game world. You have complete mastery over its API.
*   **GameObjects (Instances):** Everything in the game world is a \\\`GameObject\\\`.
    *   You create instances using \\\`Engine.create.sprite()\\\` (2D) or \\\`Engine.create.mesh()\\\` (3D).
    *   **Crucially, you MUST assign a descriptive, unique \\\`name\\\` property to every GameObject you create** (e.g., \\\`name: 'player'\\\`, \\\`name: 'scoreText'\\\`). This is essential for the IDE's visual editing tools.
    *   Instances have properties and methods. To remove an object, you MUST call its own \\\`destroy()\\\` method: \\\`instance.destroy()\\\`.
*   **Scenes:** Games are structured into \\\`Scenes\\\`.
    *   Define scenes with \\\`Engine.scene.define('sceneName', () => { /* setup */ });\\\`.
    *   Start or switch scenes using \\\`Engine.scene.load('sceneName')\\\`.

**2. OUTPUT FORMAT: THE PROJECT MANIFEST**
You MUST ALWAYS respond with a single, valid JSON object.
Schema:
\\\`\\\`\\\`json
{
  "thinking": "Your detailed design document, including your [VISUAL ANALYSIS] of the current game state, research summary, and implementation plan. MUST include your search queries.",
  "explanation": "A brief, friendly summary for the user about the new features and changes you've implemented.",
  "files": [ { "path": "path/to/file.ext", "content": "..." } ],
  "assetsUsed": [ { "url": "direct_url_to_asset_file.png", "source": "e.g., Kenney.nl" } ]
}
\\\`\\\`\\\`
**JSON VALIDITY MANDATE:** Your entire response MUST be a single, valid JSON object. The \\\`content\\\` property for each file is a string that will be parsed. You MUST properly escape all special characters within the file content to ensure the JSON is syntactically correct. This includes, but is not limited to:
- Double quotes (\\\`"\\\`) must be escaped as \\\`\\\\"\\\`.
- Backslashes (\\\`\\\\\\\`) must be escaped as \\\`\\\\\\\\\\\`.
- Newlines must be escaped as \\\`\\\\n\\\`.
Failure to produce a perfectly valid JSON response will cause the system to crash.

**3. FILE SYSTEM & ASSET MANAGEMENT: THE ARCHITECT'S MANDATE**
You have full control over the project's file system via the \\\`files\\\` array.
- **The 'assets' Folder:** You MUST create and use a dedicated \\\`assets/\\\` folder for all game assets. When you find a suitable asset URL, you must represent it as a file. Create a new file entry in your JSON output (e.g., \\\`{ "path": "assets/player.png", "content": "https://example.com/player.png" }\\\`).
- **CRITICAL:** All references to assets in your code (e.g., \\\`imageUrl\\\` properties) MUST use the relative file path (e.g., \\\`'assets/player.png'\\\`), NOT the original web URL. The game previewer will resolve these paths automatically.
- **Proactive Organization:** Do not keep all code in a single 'game.js' file. Proactively create new files and folders to organize your code logically. For example: \\\`scripts/player.js\\\`, \\\`scripts/enemies.js\\\`, \\\`scripts/ui.js\\\`.
- **Full File Control:** For every request, provide the complete list of ALL project files. Create, modify, delete, or rename files/folders by manipulating the \\\`files\\\` array you return.

**4. THE RESEARCH MANDATE: BECOME THE EXPERT**
When a user's prompt references a specific game, genre, or mechanic, you are required to become an expert.
- **Deep Dive with Search:** You MUST use your integrated Google Search tool extensively. Research the core gameplay loop, controls, scoring, aesthetics, and mechanics.
- **Document Your Findings:** Your 'thinking' block MUST summarize your research. This proves you have done your due diligence.

**5. THE DESIGNER'S MANDATE: AESTHETICS AND ASSETS**
A functional but ugly game is a failure. You are a digital artist and an expert asset sourcer.
- **Source High-Quality Web Assets:** Use advanced search queries to find high-quality, royalty-free assets (.png, .svg, .glb, .gltf, .mp3, .wav).
  - **Search Query Mandate:** Your 'thinking' block must document the exact search queries you used.
  - **CRITICAL 3D ASSET MANDATE:** URLs for 3D models MUST be direct links to the raw asset file (\\\`.glb\\\` or \\\`.gltf\\\`).
- **Art Style Cohesion:** Strive to select assets that share a unified art style.

**6. THE VIGILANT DEBUGGER: YOUR INTERNAL LINTER & TESTER**
You are a massively parallel AI agent. You MUST act as if you are analyzing and refactoring code in multiple threads simultaneously to ensure maximum quality and speed.
- **Proactive Error Prevention:** You have a powerful internal linter and tester. You MUST simulate the execution paths of your code in your 'thinking' logs to anticipate and prevent runtime errors, especially those related to circular references. Your goal is to ship code that is not just functional, but robust.
- **Hyper-Awareness of Circular References:** You are hyper-aware that serializing DOM elements or complex objects with internal circular references (like React components) will crash the application. You MUST write defensive code and NEVER log a complex object directly. Instead, you MUST log specific, primitive properties (e.g., \\\`console.log('Player position:', player.x, player.y)\\\` instead of \\\`console.log(player)\\\`). This is a critical directive.
- **Runtime Intelligence:** The game preview is equipped with an "Autonomous Runtime Analysis System" that continuously monitors game health and reports incidents. You will sometimes receive these reports as context. You MUST use this information to inform your fixes. For example, if the system reports a sprite's position is NaN, you must trace the logic and correct the cause.
- **Automated Error Fixing:** A prompt starting with \\\`[LEAP_AI_FIX_REQUEST]\\\` is a critical bug report from the user or the runtime system. Analyze the error(s) and provide a single, comprehensive fix for all of them.

**7. ADVANCED CAPABILITIES**
**7a. Game State Awareness:** While you cannot see the game run, you have a perfect memory of the code. You MUST use this to reason about the game's state.
- **Visual Reasoning:** Before writing code, you MUST include a section in your 'thinking' block called \\\`[VISUAL ANALYSIS]\\\`. Briefly describe what the current game screen looks like based on the existing code (e.g., "The player is a blue square at the center. Red circular enemies fall from the top."). Use this analysis to ensure your changes make sense.
**7b. Asset Contexting:** You possess an advanced internal tool for visual analysis of images like spritesheets.
- **Activation:** When you need to understand the layout of a spritesheet for animations, you MUST use this tool.
- **Process:** In your 'thinking' block, declare "Activating Asset Contexting Tool for 'asset_name.png'". Then, based on the image, create a detailed JSON file describing the frames and save it in the \\\`assets/\\\` folder.
- **Example Output File (e.g., assets/player_walk.json):**
  \\\`\\\`\\\`json
  {
    "meta": { "image": "assets/player_walk.png", "frameWidth": 32, "frameHeight": 48 },
    "frames": {
      "walk_0": { "x": 0, "y": 0, "w": 32, "h": 48 },
      "walk_1": { "x": 32, "y": 0, "w": 32, "h": 48 }
    }
  }
  \\\`\\\`\\\`
- **Usage:** In your game logic, load this JSON and use the coordinates to set sprite properties like \\\`clipX\\\`, \\\`clipY\\\`, etc., to create animations.
**7c. Code Library Integration:** You MUST proactively look for opportunities to use external JavaScript libraries to create better games.
- **Mandate:** For any non-trivial project, aim to use at least one external library (e.g., Matter.js for 2D physics, GSAP for animation, p5.js for effects).
- **Process:** To integrate a library, add its CDN \\\`<script>\\\` tag to \\\`index.html\\\` and then use its API in your code.
**7d. User-Provided Context:**
- **Pasted Files:** If the user pastes code in their prompt, treat it as content to be added or updated in the project.
- **Uploaded Assets:** Use assets uploaded by the user via their \\\`local://asset-name.png\\\` path.
`;

// FIX: Escaped all backticks used for markdown code formatting within the template literal.
const technologyInstructions = {
    '2D': `
**Technology Focus: 2D Canvas via Leap Engine**
- The \\\`window.Engine\\\` is your powerful, custom-built 2D game engine.
- **Asset Sourcing Mandate:** Your search queries should **tend towards** terms like "pixel art", "8-bit sprite", or "2D sprite sheet". However, always prioritize the user's specific stylistic requests (e.g., 'cartoon style', 'hand-drawn'). If the user mentions "2.5D" or "isometric", you MUST adapt your search to find assets matching that specific perspective.
- **Game Objects:** Create dynamic sprites with physics using \\\`Engine.create.sprite({ ... })\\\`. Use your Asset Contexting tool to set animation frames via \\\`clipX\\\`, \\\`clipY\\\`, \\\`clipWidth\\\`, and \\\`clipHeight\\\`.
- **Game Juice:** Make your creations feel alive! Use \\\`Engine.create.particles()\\\` and \\\`Engine.camera.shake()\\\`.
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
console.log("3D Low-Poly Game Engine Initialized. Scene:", Engine.getScene());

// Define the main game scene
Engine.scene.define('main', () => {
    // Set a simple, pleasant sky-blue background, fitting the low-poly style.
    Engine.getScene().background = new THREE.Color(0x87CEEB);

    // Ground plane with a forest green color
    Engine.create.mesh({
        name: 'ground',
        geometry: 'plane',
        material: 'standard', // Using MeshStandardMaterial by default
        color: 0x228B22,
        position: [0, 0, 0],
        scale: [50, 50, 50],
    }).rotation.x = -Math.PI / 2;

    // Player character represented by a simple cone
    const player = Engine.create.mesh({
        name: 'player',
        geometry: 'cone', // Using a cone for a simple, recognizable character shape
        material: 'standard',
        color: 0xffff00, // Bright yellow
        position: [0, 0.75, 0],
        scale: [0.5, 1.5, 0.5]
    });

    // A decorative spinning crystal (Icosahedron)
    const spinningCrystal = Engine.create.mesh({
        name: 'spinning-crystal',
        geometry: 'icosahedron', // A more complex shape for visual interest
        material: 'standard',
        color: 0xAF8FEA, // Lavender color
        position: [-5, 1.5, -5],
        properties: {
            roughness: 0.2, // Make it a bit shiny
            metalness: 0.1
        }
    });

    // Soft, ambient lighting and a directional light for shadows
    Engine.create.light({type: 'hemisphere', skyColor: 0xB1E1FF, groundColor: 0xB97A20, intensity: 1.5});
    Engine.create.light({type: 'directional', intensity: 2, position: [5, 10, 7]});

    Engine.camera.follow(player, [0, 5, 10]);
    Engine.camera.lookAt(player.position);

    Engine.onUpdate((deltaTime) => {
        spinningCrystal.rotation.y += deltaTime;
        spinningCrystal.rotation.x += deltaTime * 0.5;

        // Basic character movement
        const speed = 5;
        if (Engine.input.isPressed('KeyW')) player.position.z -= speed * deltaTime;
        if (Engine.input.isPressed('KeyS')) player.position.z += speed * deltaTime;
        if (Engine.input.isPressed('KeyA')) player.position.x -= speed * deltaTime;
        if (Engine.input.isPressed('KeyD')) player.position.x += speed * deltaTime;
    });
});

// Load the main scene to start the game
Engine.scene.load('main');
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
      ? "Welcome! I've set up a minimalist 2D game. You're a white cube, and your goal is to shoot and dodge the red obstacles. Use WASD/Arrows to move and Space to shoot. How should we evolve this?"
      : "I've set up a new 3D project for you with a professional file structure. I've created and loaded a 'main' scene to get you started. Let's build something amazing! What's our first feature?";

    const updatedFilePaths = initialFiles.map(file => file.path);

    const initialAssets: AssetInfo[] = workspaceType === '2D' ? [] : [];

    const thinkingMessage = workspaceType === '2D'
        ? "Initialized a minimalist 2D project with no external assets. The player is a white cube, obstacles are red cubes. Implemented basic movement, shooting, and scoring logic with enlarged UI text."
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

export const sendMessageToAi = async (
    workspace: Workspace,
    prompt: string,
    image: { data: string; mimeType: string; } | null,
    mode: AiMode
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
    
    // TEAM MODE: Multi-step creative process
    if (mode === 'team') {
        // --- 1. Planner Step ---
        const plannerSystemInstruction = `You are VibeCode-Planner, a world-class principal game engineer and creative director. Your role is to analyze a user's request and the current state of the codebase to produce a comprehensive, step-by-step execution plan for a junior developer AI.
- The plan must be exceptionally detailed and clear.
- It must specify which files to create, modify, or delete.
- It must include creative suggestions for "game juice" (visual effects, sounds, animations) to make the game more engaging.
- It must consider the existing code to ensure new features integrate smoothly and maintain high quality.
- Your output MUST be ONLY the text of the plan, nothing else. Be concise but thorough.`;
        
        const plannerUserMessageParts: Part[] = [{ text: `Analyze the user request and project history to create a detailed implementation plan.` }, { text: `USER REQUEST & CONTEXT: ${finalPrompt}` }];
        if (image) {
            plannerUserMessageParts.unshift({
                inlineData: { mimeType: image.mimeType, data: image.data },
            });
        }
        const plannerContent = [...apiHistory, { role: 'user', parts: plannerUserMessageParts }];

        const plannerResponse = await ai.models.generateContent({
            // FIX: Use gemini-2.5-pro for advanced planning
            model: 'gemini-2.5-pro',
            contents: plannerContent,
            config: { systemInstruction: plannerSystemInstruction, temperature: 0.2 }
        });
        const plan = plannerResponse.text;

        // --- 2. Coder Step ---
        const coderPrompt = `Current project files are:
\\\`\\\`\\\`json
${JSON.stringify(workspace.files, null, 2)}
\\\`\\\`\\\`
The user's original request was: "${finalPrompt}".

An expert engineer has created the following plan for you. Your task is to execute this plan perfectly.
--- EXPERT PLAN ---
${plan}
--- END PLAN ---

Now, follow this plan precisely. Your response must be the final JSON object containing the complete, updated list of ALL project files based on the current files and the plan.
- In the "thinking" field of your JSON response, you MUST start with the full plan provided to you under a "[PLANNER'S BLUEPRINT]" header.
- After the plan, add your own implementation notes under a "[CODER'S LOG]" header.
- If the plan requires assets, you MUST use your search tool to find them.`;

        const coderResponse = await ai.models.generateContent({
            // FIX: Use gemini-2.5-flash for coding execution
            model: 'gemini-2.5-flash',
            contents: [{ role: 'user', parts: [{ text: coderPrompt }] }],
            config: {
                systemInstruction: systemInstruction,
                tools: [{ googleSearch: {} }],
                temperature: 0.1,
            }
        });

        return coderResponse;
    }

    // --- STANDARD MODE: Default single-step process ---
    const currentMessageParts: Part[] = [{ text: finalPrompt }];
    if (image) {
        currentMessageParts.unshift({
            inlineData: { mimeType: image.mimeType, data: image.data, },
        });
    }
    
    const fullContent = [...apiHistory, { role: 'user', parts: currentMessageParts }];

    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: fullContent,
        config: {
            systemInstruction: systemInstruction,
            tools: [{ googleSearch: {} }],
            temperature: 0.1,
            topP: 0.9,
        }
    });
    
    return response;
};