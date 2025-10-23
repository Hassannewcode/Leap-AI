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
    }
};
`;
