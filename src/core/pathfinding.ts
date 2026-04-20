import { Position } from '../entities/unitInstance';
import { Grid } from '../utils/grid';

export interface PathNode {
  position: Position;
  gCost: number; // Distance from start
  hCost: number; // Heuristic distance to target
  fCost: number; // gCost + hCost
  parent: PathNode | null;
}


// Path finder integrato con sistema stati finiti e target fisso 
export class SimplePathfinder {
  static findPath(
    start: Position,
    target: Position,
    grid: Grid,
    teamId: string, // ID del team per distinguere alleati da nemici
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
      const neighbors = this.getValidNeighbors(current, grid, teamId);
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
    grid: Grid,
    teamId: string // ID del team per distinguere alleati da nemici
  ): Position | null {
    const neighbors = this.getValidNeighbors(start, grid, teamId);
    if (neighbors.length === 0) return null;

    return this.selectBestNeighbor(neighbors, target);
  }

  private static getValidNeighbors(pos: Position, grid: Grid, teamId: string): Position[] {
    const neighbors: Position[] = [];
    const directions = [
      { x: 0, y: 1 },   // right
      { x: 0, y: -1 },  // left
      { x: 1, y: 0 },   // down (forward for team A)
      { x: -1, y: 0 },  // up (backward for team A)
    ];

    for (const dir of directions) {
      const newPos = { x: pos.x + dir.x, y: pos.y + dir.y };
      if (grid.isValidPosition(newPos)) {
        const occupyingUnit = grid.getUnitAt(newPos);
        // Permetti movimento se la posizione è vuota O occupata da unità alleata
        if (!occupyingUnit || occupyingUnit.teamId === teamId) {
          neighbors.push(newPos);
        }
      }
    }

    return neighbors;
  }

  private static selectBestNeighbor(neighbors: Position[], target: Position): Position {
    // Schema priorità deterministico:
    /*
      |2|1|3
      |4|u|5
      |7|6|8
    */
    // u rappresenta l'unità, in ordine viene dato priorità alle truppe "avanti"  
    // centrali rispetto a quelle laterali, sinistra rispetto a destra
    
    // Calcola direzione verso target
    const dx = Math.sign(target.x - neighbors[0].x);
    const dy = Math.sign(target.y - neighbors[0].y);
    
    // Mappa direzioni a priorità
    // Team A: deve andare a destra (x crescente) - PRIORITÀ MASSIMA
    // Team B: deve andare a sinistra (x decrescente) - PRIORITÀ MASSIMA
    const directionPriority: Record<string, number> = {
      '1,0': 1,   // destra (x crescente) - MOVIMENTO PRINCIPALE
      '0,1': 2,   // avanti (y crescente)
      '0,-1': 3,  // indietro (y decrescente)
      '-1,0': 4,  // sinistra (x decrescente)
    };
    
    // Ordina vicini per distanza, poi per priorità direzionale deterministica
    const sortedNeighbors = [...neighbors].sort((a, b) => {
      const distA = this.getDistance(a, target);
      const distB = this.getDistance(b, target);
      
      if (distA !== distB) {
        return distA - distB; // Priorità distanza minima
      }
      
      // A parità di distanza, usa schema priorità deterministico
      const dirA = `${Math.sign(a.x - neighbors[0].x)},${Math.sign(a.y - neighbors[0].y)}`;
      const dirB = `${Math.sign(b.x - neighbors[0].x)},${Math.sign(b.y - neighbors[0].y)}`;
      
      const priorityA = directionPriority[dirA] || 99;
      const priorityB = directionPriority[dirB] || 99;
      
      if (priorityA !== priorityB) {
        return priorityA - priorityB;
      }
      
      // Se ancora pari, usa ordinamento consistente basato su coordinate
      const coordA = `${a.x},${a.y}`;
      const coordB = `${b.x},${b.y}`;
      return coordA.localeCompare(coordB);
    });

    return sortedNeighbors[0];
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
