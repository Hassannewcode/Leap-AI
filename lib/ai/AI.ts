// --- Leap Engine In-Game AI Module ---

export const inGameAI = `
const inGameAI = (() => {
    const pendingRequests = new Map();

    // Listen for responses from the parent window
    window.addEventListener('message', (event) => {
        const { type, payload } = event.data;
        if (type === 'ai-text-response' && payload && payload.requestId) {
            const request = pendingRequests.get(payload.requestId);
            if (request) {
                if (payload.success) {
                    request.resolve(payload.text);
                } else {
                    request.reject(new Error(payload.error));
                }
                pendingRequests.delete(payload.requestId);
            }
        }
    });

    function generateText(prompt) {
        return new Promise((resolve, reject) => {
            const requestId = \`ai-req-\${Date.now()}-\${Math.random().toString(16).slice(2)}\`;
            pendingRequests.set(requestId, { resolve, reject });

            try {
                 window.parent.postMessage({
                    type: 'ai-generate-text',
                    payload: { prompt, requestId }
                }, '*');
            } catch (e) {
                reject(new Error("Failed to communicate with the AI host."));
                pendingRequests.delete(requestId);
            }
        });
    }

    function findPath(startPos, endPos, grid) {
        if (!grid) {
            console.error("findPath requires a navigation grid.");
            return [];
        }
        
        // The grid is defined in world pixels, but pathfinding needs grid coordinates.
        const V_SIZE = Engine.getVirtualSize();
        const cols = grid[0].length;
        const rows = grid.length;
        const gridSizeX = V_SIZE.width / cols;
        const gridSizeY = V_SIZE.height / rows;

        const startGrid = {
            x: Math.floor(startPos.x / gridSizeX),
            y: Math.floor(startPos.y / gridSizeY),
        };
        const endGrid = {
            x: Math.floor(endPos.x / gridSizeX),
            y: Math.floor(endPos.y / gridSizeY),
        };

        const pathInGridCoords = aStarPathfinding.findPath(startGrid, endGrid, grid);
        
        // Convert path back to world coordinates (cell centers)
        return pathInGridCoords.map(node => ({
            x: node.x * gridSizeX + gridSizeX / 2,
            y: node.y * gridSizeY + gridSizeY / 2,
        }));
    }

    return {
        generateText,
        findPath,
    };
})();
`