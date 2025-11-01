
export const physics2D = `
const physics = {
    // AABB collision check (now assumes center-based coordinates)
    checkCollision: (spriteA, spriteB) => {
        if (!spriteA || !spriteB) return false;
        const a_left = spriteA.x - spriteA.width / 2;
        const a_right = spriteA.x + spriteA.width / 2;
        const a_top = spriteA.y - spriteA.height / 2;
        const a_bottom = spriteA.y + spriteA.height / 2;

        const b_left = spriteB.x - spriteB.width / 2;
        const b_right = spriteB.x + spriteB.width / 2;
        const b_top = spriteB.y - spriteB.height / 2;
        const b_bottom = spriteB.y + spriteB.height / 2;

        return a_left < b_right && a_right > b_left && a_top < b_bottom && a_bottom > b_top;
    },
    // More accurate circular collision check
    checkCircularCollision: (spriteA, spriteB) => {
        if (!spriteA || !spriteB) return false;
        const dx = spriteA.x - spriteB.x;
        const dy = spriteA.y - spriteB.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const radiusA = spriteA.radius || (Math.min(spriteA.width, spriteA.height) / 2);
        const radiusB = spriteB.radius || (Math.min(spriteB.width, spriteB.height) / 2);
        return distance < radiusA + radiusB;
    },
    getCollisions: (sprite, useCircular = false) => {
        const checkFunc = useCircular ? physics.checkCircularCollision : physics.checkCollision;
        return sprites.filter(other => sprite !== other && checkFunc(sprite, other));
    },
    // Creates a 2D grid for pathfinding based on sprite positions
    createGridFromSprites: (obstacleSprites, gridSize) => {
        const V_SIZE = Engine.getVirtualSize();
        const cols = Math.ceil(V_SIZE.width / gridSize);
        const rows = Math.ceil(V_SIZE.height / gridSize);
        const grid = Array(rows).fill(null).map(() => Array(cols).fill(0));

        for (const sprite of obstacleSprites) {
            const startCol = Math.floor((sprite.x - sprite.width / 2) / gridSize);
            const endCol = Math.ceil((sprite.x + sprite.width / 2) / gridSize);
            const startRow = Math.floor((sprite.y - sprite.height / 2) / gridSize);
            const endRow = Math.ceil((sprite.y + sprite.height / 2) / gridSize);

            for (let r = startRow; r < endRow; r++) {
                for (let c = startCol; c < endCol; c++) {
                    if (r >= 0 && r < rows && c >= 0 && c < cols) {
                        grid[r][c] = 1; // Mark as unwalkable
                    }
                }
            }
        }
        return grid;
    }
};
`;
