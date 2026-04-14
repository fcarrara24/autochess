import { Position } from '../entities/unitInstance';
import { Grid } from '../utils/grid';

export interface PathNode {
  position: Position;
  gCost: number; // Distance from start
  hCost: number; // Heuristic distance to target
  fCost: number; // gCost + hCost
  parent: PathNode | null;
}

export class SimplePathfinder {
  static findPath(
    start: Position,
    target: Position,
    grid: Grid,
    maxDistance: number = 8
  ): Position[] | null {
    // Simple greedy pathfinding - not full A* but much better than random movement
    const path: Position[] = [];
    let current = { ...start };
    const visited = new Set<string>();

    for (let step = 0; step < maxDistance; step++) {
      const key = `${current.x},${current.y}`;
      if (visited.has(key)) break;
      visited.add(key);

      if (current.x === target.x && current.y === target.y) {
        return path;
      }

      // Get all valid neighbors
      const neighbors = this.getValidNeighbors(current, grid);
      if (neighbors.length === 0) break;

      // Choose neighbor closest to target (greedy approach)
      const bestNeighbor = this.selectBestNeighbor(neighbors, target);
      
      path.push(bestNeighbor);
      current = bestNeighbor;

      // Stop if we're in range
      const distance = this.getDistance(current, target);
      if (distance <= 1) break;
    }

    return path.length > 0 ? path : null;
  }

  static findNextMove(
    start: Position,
    target: Position,
    grid: Grid
  ): Position | null {
    const neighbors = this.getValidNeighbors(start, grid);
    if (neighbors.length === 0) return null;

    return this.selectBestNeighbor(neighbors, target);
  }

  private static getValidNeighbors(pos: Position, grid: Grid): Position[] {
    const neighbors: Position[] = [];
    const directions = [
      { x: 0, y: 1 },   // right
      { x: 0, y: -1 },  // left
      { x: 1, y: 0 },   // down (forward for team A)
      { x: -1, y: 0 },  // up (backward for team A)
    ];

    for (const dir of directions) {
      const newPos = { x: pos.x + dir.x, y: pos.y + dir.y };
      if (grid.isValidPosition(newPos) && !grid.isOccupied(newPos)) {
        neighbors.push(newPos);
      }
    }

    return neighbors;
  }

  private static selectBestNeighbor(neighbors: Position[], target: Position): Position {
    // Select neighbor that minimizes distance to target
    let best = neighbors[0];
    let bestDistance = this.getDistance(best, target);

    for (let i = 1; i < neighbors.length; i++) {
      const distance = this.getDistance(neighbors[i], target);
      
      // Prefer forward movement if distances are equal
      if (distance < bestDistance || 
          (distance === bestDistance && neighbors[i].x > best.x)) {
        best = neighbors[i];
        bestDistance = distance;
      }
    }

    return best;
  }

  static getDistance(pos1: Position, pos2: Position): number {
    return Math.abs(pos1.x - pos2.x) + Math.abs(pos1.y - pos2.y); // Manhattan distance
  }

  static findNearestEnemy(unitPos: Position, enemyPositions: Position[]): Position | null {
    if (enemyPositions.length === 0) return null;

    let nearest = enemyPositions[0];
    let minDistance = this.getDistance(unitPos, nearest);

    for (let i = 1; i < enemyPositions.length; i++) {
      const distance = this.getDistance(unitPos, enemyPositions[i]);
      if (distance < minDistance) {
        minDistance = distance;
        nearest = enemyPositions[i];
      }
    }

    return nearest;
  }

  static getMovementVector(from: Position, to: Position): Position {
    return {
      x: Math.sign(to.x - from.x),
      y: Math.sign(to.y - from.y)
    };
  }
}
