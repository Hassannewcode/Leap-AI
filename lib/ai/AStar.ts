export const aStar = `
// A* Pathfinding Implementation
const aStarPathfinding = (() => {

    class Node {
        constructor(x, y, parent = null) {
            this.x = x;
            this.y = y;
            this.parent = parent;
            this.g = 0; // Cost from start to current node
            this.h = 0; // Heuristic cost from current node to end
            this.f = 0; // Total cost (g + h)
        }

        equals(other) {
            return this.x === other.x && this.y === other.y;
        }
    }

    function findPath(startPos, endPos, grid) {
        if (!grid || grid.length === 0 || grid[0].length === 0) {
            console.error("A*: Invalid grid provided.");
            return [];
        }

        const startNode = new Node(startPos.x, startPos.y);
        const endNode = new Node(endPos.x, endPos.y);

        const openList = [startNode];
        const closedList = [];

        while (openList.length > 0) {
            // Get the node with the lowest F cost
            let currentNode = openList[0];
            let currentIndex = 0;
            for (let i = 1; i < openList.length; i++) {
                if (openList[i].f < currentNode.f) {
                    currentNode = openList[i];
                    currentIndex = i;
                }
            }

            // Move current node from open to closed list
            openList.splice(currentIndex, 1);
            closedList.push(currentNode);

            // Found the goal
            if (currentNode.equals(endNode)) {
                const path = [];
                let current = currentNode;
                while (current !== null) {
                    path.push({ x: current.x, y: current.y });
                    current = current.parent;
                }
                return path.reverse();
            }

            // Generate children
            const children = [];
            const directions = [[0, -1], [0, 1], [-1, 0], [1, 0]]; // Up, Down, Left, Right

            for (const newPosition of directions) {
                const nodePosition = {
                    x: currentNode.x + newPosition[0],
                    y: currentNode.y + newPosition[1]
                };

                // Make sure within range
                if (nodePosition.y > (grid.length - 1) || nodePosition.y < 0 || nodePosition.x > (grid[0].length - 1) || nodePosition.x < 0) {
                    continue;
                }

                // Make sure walkable terrain
                if (grid[nodePosition.y][nodePosition.x] !== 0) {
                    continue;
                }

                children.push(new Node(nodePosition.x, nodePosition.y, currentNode));
            }

            // Loop through children
            for (const child of children) {
                // Child is on the closed list
                if (closedList.some(closedChild => closedChild.equals(child))) {
                    continue;
                }

                child.g = currentNode.g + 1;
                child.h = Math.abs(child.x - endNode.x) + Math.abs(child.y - endNode.y); // Manhattan distance
                child.f = child.g + child.h;

                // Child is already in the open list
                if (openList.some(openNode => child.equals(openNode) && child.g > openNode.g)) {
                    continue;
                }

                openList.push(child);
            }
        }

        return []; // No path found
    }

    return {
        findPath
    };
})();
`