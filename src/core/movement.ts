import { UnitInstance, Position } from '../entities/unitInstance';
import { UnitTemplate } from '../entities/unitTemplate';
import { Grid } from '../utils/grid';

export function tryMoveUnit(
  unit: UnitInstance,
  template: UnitTemplate,
  grid: Grid,
  currentTick: number,
  enemyPositions: Position[]
): Position | null {
  // Simple forward movement - no pathfinding for now
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
