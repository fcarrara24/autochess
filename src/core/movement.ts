import { UnitInstance, Position, UnitState } from '../entities/unitInstance';
import { UnitTemplate } from '../entities/unitTemplate';
import { Grid } from '../utils/grid';
import { SimplePathfinder } from './pathfinding';

export function tryMoveUnit(
  unit: UnitInstance,
  template: UnitTemplate,
  grid: Grid,
  currentTick: number,
  enemyPositions: Position[]
): Position | null {
  // Se l'unità ha un target fisso, usa pathfinding verso di esso
  if (unit.targetId && unit.state !== 'idle') {
    // Trova posizione del target (implementazione semplificata)
    // In una versione completa, questo dovrebbe essere gestito dal sistema stati
    const targetPos = findTargetPosition(unit, enemyPositions);
    if (targetPos) {
      const nextMove = SimplePathfinder.findNextMove(unit.position, targetPos, grid, unit.teamId);
      if (nextMove && grid.isValidPosition(nextMove) && !grid.isOccupied(nextMove)) {
        grid.moveUnit(unit.position, nextMove, unit);
        unit.position = nextMove;
        unit.lastMoveTick = currentTick;
        return nextMove;
      }
    }
  }

  // Sistema di movimento intelligente verso il nemico più vicino
  if (enemyPositions.length > 0) {
    const nearestEnemy = SimplePathfinder.findNearestEnemy(unit.position, enemyPositions);
    if (nearestEnemy) {
      const nextMove = SimplePathfinder.findNextMove(unit.position, nearestEnemy, grid, unit.teamId);
      if (nextMove && grid.isValidPosition(nextMove) && !grid.isOccupied(nextMove)) {
        grid.moveUnit(unit.position, nextMove, unit);
        unit.position = nextMove;
        unit.lastMoveTick = currentTick;
        return nextMove;
      }
    }
  }

  // SEEK behavior: se non ci sono nemici, muovi verso il centro
  if (enemyPositions.length === 0) {
    // Imposta stato SEEK se non è già in SEEK
    if (unit.state !== UnitState.SEEK) {
      unit.state = UnitState.SEEK;
      unit.targetId = null; // Resetta target quando in SEEK
    }
    
    const centerPos = getCenterPosition(grid);
    
    // Controlla se l'unità ha già raggiunto il centro (area 3x3 intorno al centro)
    const distanceToCenter = Math.abs(unit.position.x - centerPos.x) + Math.abs(unit.position.y - centerPos.y);
    if (distanceToCenter <= 2) {
      // Se vicino al centro, smetti di muoverti in SEEK
      return null;
    }
    
    const nextMove = SimplePathfinder.findNextMove(unit.position, centerPos, grid, unit.teamId);
    if (nextMove && grid.isValidPosition(nextMove) && !grid.isOccupied(nextMove)) {
      // Verifica che il movimento sia effettivamente verso il centro
      const currentDistance = Math.abs(unit.position.x - centerPos.x) + Math.abs(unit.position.y - centerPos.y);
      const newDistance = Math.abs(nextMove.x - centerPos.x) + Math.abs(nextMove.y - centerPos.y);
      
      if (newDistance < currentDistance) {
        grid.moveUnit(unit.position, nextMove, unit);
        unit.position = nextMove;
        unit.lastMoveTick = currentTick;
        return nextMove;
      }
    }
    
    // Se non può muoversi verso il centro, rimani fermo in SEEK
    return null;
  } else {
    // Se ci sono nemici e siamo in SEEK, torna a IDLE per trovare target
    if (unit.state === UnitState.SEEK) {
      unit.state = UnitState.IDLE;
    }
  }

  // Fallback: movimento forward se nessun nemico o pathfinding fallisce
  let forwardPos: Position;
  
  if (unit.teamId === 'teamA') {
    // Team A: muovi sempre verso destra, ma evita di tornare indietro se al bordo
    if (unit.position.x === 0) {
      // Se al bordo sinistro, forza movimento verso destra
      forwardPos = { x: unit.position.x + 1, y: unit.position.y };
    } else {
      // Altrimenti muovi verso destra (verso il nemico)
      forwardPos = { x: unit.position.x + 1, y: unit.position.y };
    }
  } else {
    // Team B: muovi sempre verso sinistra
    forwardPos = { x: unit.position.x - 1, y: unit.position.y };
  }
  
  if (grid.isValidPosition(forwardPos) && !grid.isOccupied(forwardPos)) {
    grid.moveUnit(unit.position, forwardPos, unit);
    unit.position = forwardPos;
    unit.lastMoveTick = currentTick;
    return forwardPos;
  }

  // Try alternative positions if forward is blocked
  const alternatives = [
    { x: unit.position.x, y: unit.position.y + 1 },
    { x: unit.position.x, y: unit.position.y - 1 },
    { x: unit.position.x + (unit.teamId === 'teamA' ? 1 : -1), y: unit.position.y + 1 },
    { x: unit.position.x + (unit.teamId === 'teamA' ? 1 : -1), y: unit.position.y - 1 },
  ];

  for (const alt of alternatives) {
    if (grid.isValidPosition(alt) && !grid.isOccupied(alt)) {
      // Additional safety check - ensure position is within grid bounds
      if (alt.x >= 0 && alt.x < grid.getWidth() && alt.y >= 0 && alt.y < grid.getHeight()) {
        grid.moveUnit(unit.position, alt, unit);
        unit.position = alt;
        unit.lastMoveTick = currentTick;
        return alt;
      }
    }
  }

  return null;
}

// Funzione helper per trovare posizione target (implementazione semplificata)
function findTargetPosition(unit: UnitInstance, enemyPositions: Position[]): Position | null {
  if (enemyPositions.length === 0) return null;
  
  // Per ora, ritorna il nemico più vicino
  // In futuro, questo dovrebbe usare unit.targetId per trovare il target specifico
  return SimplePathfinder.findNearestEnemy(unit.position, enemyPositions);
}

// Funzione helper per calcolare posizione centro griglia (SEEK behavior)
function getCenterPosition(grid: Grid): Position {
  const width = grid.getWidth();
  const height = grid.getHeight();
  return {
    x: Math.floor(width / 2),
    y: Math.floor(height / 2)
  };
}

// Legacy functions for compatibility
export type Direction = 'forward' | 'left' | 'right' | 'backward';

export function getPositionFromDirection(pos: Position, direction: Direction): Position {
  switch (direction) {
    case 'forward': return { x: pos.x + 1, y: pos.y };
    case 'backward': return { x: pos.x - 1, y: pos.y };
    case 'left': return { x: pos.x, y: pos.y - 1 };
    case 'right': return { x: pos.x, y: pos.y + 1 };
  }
}
