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
      const nextMove = SimplePathfinder.findNextMove(unit.position, targetPos, grid);
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
      const nextMove = SimplePathfinder.findNextMove(unit.position, nearestEnemy, grid);
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
    const nextMove = SimplePathfinder.findNextMove(unit.position, centerPos, grid);
    if (nextMove && grid.isValidPosition(nextMove) && !grid.isOccupied(nextMove)) {
      grid.moveUnit(unit.position, nextMove, unit);
      unit.position = nextMove;
      unit.lastMoveTick = currentTick;
      return nextMove;
    }
  } else {
    // Se ci sono nemici e siamo in SEEK, torna a IDLE per trovare target
    if (unit.state === UnitState.SEEK) {
      unit.state = UnitState.IDLE;
    }
  }

  // Fallback: movimento forward se nessun nemico o pathfinding fallisce
  const forwardPos = unit.teamId === 'teamA' 
    ? { x: unit.position.x + 1, y: unit.position.y }
    : { x: unit.position.x - 1, y: unit.position.y };
  
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
