import { UnitInstance, Position } from '../entities/unitInstance';
import { UnitTemplate } from '../entities/unitTemplate';
import { Grid } from '../utils/grid';

export function tryMoveUnitDebug(
  unit: UnitInstance,
  template: UnitTemplate,
  grid: Grid,
  currentTick: number,
  enemyPositions: Position[]
): Position | null {
  console.log(`[DEBUG] Moving unit ${unit.id} from (${unit.position.x},${unit.position.y})`);
  console.log(`[DEBUG] Enemy positions: ${enemyPositions.map(p => `(${p.x},${p.y})`).join(', ')}`);
  console.log(`[DEBUG] Unit range: ${template.range}`);

  // Simple forward movement if no pathfinding
  const forwardPos = unit.teamId === 'teamA' 
    ? { x: unit.position.x + 1, y: unit.position.y }
    : { x: unit.position.x - 1, y: unit.position.y };
  
  console.log(`[DEBUG] Trying to move to (${forwardPos.x},${forwardPos.y})`);
  console.log(`[DEBUG] Valid: ${grid.isValidPosition(forwardPos)}, Occupied: ${grid.isOccupied(forwardPos)}`);
  
  if (grid.isValidPosition(forwardPos) && !grid.isOccupied(forwardPos)) {
    grid.moveUnit(unit.position, forwardPos, unit);
    unit.position = forwardPos;
    unit.lastMoveTick = currentTick;
    console.log(`[DEBUG] Successfully moved to (${forwardPos.x},${forwardPos.y})`);
    return forwardPos;
  }

  // Try alternative positions
  const alternatives = [
    { x: unit.position.x, y: unit.position.y + 1 },
    { x: unit.position.x, y: unit.position.y - 1 },
    { x: unit.position.x + (unit.teamId === 'teamA' ? 1 : -1), y: unit.position.y + 1 },
    { x: unit.position.x + (unit.teamId === 'teamA' ? 1 : -1), y: unit.position.y - 1 },
  ];

  for (const alt of alternatives) {
    if (grid.isValidPosition(alt) && !grid.isOccupied(alt)) {
      grid.moveUnit(unit.position, alt, unit);
      unit.position = alt;
      unit.lastMoveTick = currentTick;
      console.log(`[DEBUG] Moved to alternative (${alt.x},${alt.y})`);
      return alt;
    }
  }

  console.log(`[DEBUG] No valid moves found`);
  return null;
}
