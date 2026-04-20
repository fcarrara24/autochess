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
      { x: 0, y: 1 },   // up
      { x: 0, y: -1 },  // down
      { x: 1, y: 0 },   // right (forward for team A)
      { x: -1, y: 0 },  // left (backward for team A)
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
    // Nuovo sistema di pathfinding con priorità euclidea/pitagorica
    // 1. Priorità assoluta: distanza euclidea minima dal target
    // 2. Premi avanzare verso il nemico rispetto al retrocedere
    // 3. Premi sinistra rispetto a destra
    
    // Calcola il centro della griglia come riferimento per direzione
    const gridCenter = { x: 6, y: 3 }; // Per griglia 12x6
    
    const sortedNeighbors = [...neighbors].sort((a, b) => {
      // 1. Priorità: distanza euclidea (pitagorica) dal target
      const euclideanDistA = this.getEuclideanDistance(a, target);
      const euclideanDistB = this.getEuclideanDistance(b, target);
      
      if (Math.abs(euclideanDistA - euclideanDistB) > 0.01) {
        return euclideanDistA - euclideanDistB;
      }
      
      // 2. Premi avanzare verso il nemico rispetto al retrocedere
      // Calcola se il movimento avvicina o allontana dal target
      const advanceScoreA = this.calculateAdvanceScore(a, target);
      const advanceScoreB = this.calculateAdvanceScore(b, target);
      
      if (advanceScoreA !== advanceScoreB) {
        return advanceScoreB - advanceScoreA; // Maggiore score = migliore (avanzare)
      }
      
      // 3. Premi sinistra rispetto a destra (per movimento tattico)
      const leftRightScoreA = this.calculateLeftRightScore(a, target);
      const leftRightScoreB = this.calculateLeftRightScore(b, target);
      
      if (leftRightScoreA !== leftRightScoreB) {
        return leftRightScoreB - leftRightScoreA; // Maggiore score = migliore (sinistra)
      }
      
      // 4. Fallback: distanza Manhattan per consistenza
      const manhattanDistA = this.getDistance(a, target);
      const manhattanDistB = this.getDistance(b, target);
      
      if (manhattanDistA !== manhattanDistB) {
        return manhattanDistA - manhattanDistB;
      }
      
      // 5. Ultimo fallback: ordinamento deterministico
      const coordA = `${a.x},${a.y}`;
      const coordB = `${b.x},${b.y}`;
      return coordA.localeCompare(coordB);
    });

    return sortedNeighbors[0];
  }

  // Calcola distanza euclidea (pitagorica)
  private static getEuclideanDistance(pos1: Position, pos2: Position): number {
    const dx = pos1.x - pos2.x;
    const dy = pos1.y - pos2.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  // Calcola score per avanzamento vs retrocessione
  private static calculateAdvanceScore(pos: Position, target: Position): number {
    // Direzione verso il target
    const dx = target.x - pos.x;
    const dy = target.y - pos.y;
    
    let score = 0;
    
    // Premi movimento verso il target (avanzamento)
    if (dx > 0) score += 2; // Avanzare a destra
    if (dx < 0) score -= 1; // Retrocedere a sinistra (penalità)
    if (dy > 0) score += 1; // Avanzare in basso
    if (dy < 0) score -= 0.5; // Retrocedere in alto (penalità minore)
    
    return score;
  }

  // Calcola score per preferenza sinistra vs destra
  private static calculateLeftRightScore(pos: Position, target: Position): number {
    // Movimento laterale tattico: preferisci sinistra per aggiramento
    const dx = target.x - pos.x;
    
    // Se il target è a destra, premi leggermente movimento verso sinistra (aggiramento)
    // Se il target è a sinistra, premi leggermente movimento verso destra (aggiramento)
    if (dx > 0) {
      // Target a destra: preferisci movimento verso sinistra per aggiramento
      return pos.x < target.x ? 0.5 : -0.2;
    } else {
      // Target a sinistra: preferisci movimento verso destra per aggiramento  
      return pos.x > target.x ? 0.5 : -0.2;
    }
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
