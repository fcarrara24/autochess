import { UnitType, UnitState, PlayerSlot, Position, UnitStats, Unit } from './types';
import { Grid } from './Grid';
import { UNIT_STATS } from './UnitStats';

export class UnitFactory {
  static createUnit(type: UnitType, owner: PlayerSlot, position: Position, id: string): Unit {
    const stats = this.getUnitStats(type);
    return {
      id,
      type,
      owner,
      position: { ...position },
      originalPosition: { ...position },
      stats: { ...stats },
      state: UnitState.SEEK,
      placementTimestamp: Date.now()
    };
  }

  private static getUnitStats(type: UnitType): UnitStats {
    const stats = UNIT_STATS[type];
    if (!stats) {
      throw new Error(`Unknown unit type: ${type}`);
    }
    return { ...stats };
  }
}

export class UnitController {
  static getUnitInForwardInteractionLine(unit: Unit, grid: Grid, allUnits: Unit[]): Unit | null {
    const interactionPositions = grid.getForwardInteractionLine(unit.position, unit.owner);
    
    for (const pos of interactionPositions) {
      const targetUnit = grid.getUnitAt(pos);
      if (targetUnit && targetUnit.owner !== unit.owner) {
        return targetUnit;
      }
    }
    
    return null;
  }

  static getValidMovePositions(unit: Unit, grid: Grid): Position[] {
    const neighbors = grid.getNeighbors(unit.position);
    return neighbors.filter(pos => !grid.isOccupied(pos));
  }

  static getTargetPriority(unit: Unit, grid: Grid, allUnits: Unit[]): Unit | null {
    // Priority 1: Previous target (if still in range)
    if (unit.targetId) {
      const previousTarget = allUnits.find(u => u.id === unit.targetId);
      if (previousTarget && 
          previousTarget.stats.hp > 0 && 
          grid.isInRange(unit.position, previousTarget.position, unit.stats.range)) {
        return previousTarget;
      }
    }

    // Priority 2: Find targets in priority directions
    const directions = this.getTargetDirections(unit.owner);
    const enemies = allUnits.filter(u => u.owner !== unit.owner && u.stats.hp > 0);

    for (const direction of directions) {
      const targetPos = {
        x: unit.position.x + direction.x,
        y: unit.position.y + direction.y
      };

      if (grid.isValidPosition(targetPos)) {
        const enemyAtPos = enemies.find(e => 
          e.position.x === targetPos.x && e.position.y === targetPos.y
        );
        if (enemyAtPos) {
          return enemyAtPos;
        }
      }
    }

    // If no target in priority positions, find closest enemy in range
    const enemiesInRange = enemies.filter(e => 
      grid.isInRange(unit.position, e.position, unit.stats.range)
    );

    if (enemiesInRange.length > 0) {
      // Return the closest enemy
      return enemiesInRange.reduce((closest, enemy) => {
        const closestDist = grid.getManhattanDistance(unit.position, closest.position);
        const enemyDist = grid.getManhattanDistance(unit.position, enemy.position);
        return enemyDist < closestDist ? enemy : closest;
      });
    }

    return null;
  }

  private static getTargetDirections(playerSlot: PlayerSlot): { x: number; y: number }[] {
    if (playerSlot === 'A') {
      return [
        { x: 1, y: 0 },   // forward center
        { x: 1, y: -1 },  // forward-left
        { x: 1, y: 1 },   // forward-right
        { x: 0, y: -1 },  // left
        { x: 0, y: 1 }    // right
      ];
    } else {
      return [
        { x: -1, y: 0 },  // forward center
        { x: -1, y: -1 }, // forward-left
        { x: -1, y: 1 },  // forward-right
        { x: 0, y: -1 },  // left
        { x: 0, y: 1 }    // right
      ];
    }
  }

  static updateUnitState(unit: Unit, grid: Grid, allUnits: Unit[]): void {
    const target = this.getTargetPriority(unit, grid, allUnits);
    
    if (target) {
      unit.targetId = target.id;
      
      if (grid.isInRange(unit.position, target.position, unit.stats.range)) {
        unit.state = UnitState.ATTACK;
      } else {
        unit.state = UnitState.ENGAGED;
      }
    } else {
      unit.targetId = undefined;
      unit.state = UnitState.SEEK;
    }
  }

  static resetUnit(unit: Unit): void {
    unit.position = { ...unit.originalPosition };
    unit.stats.hp = unit.stats.maxHp;
    unit.state = UnitState.SEEK;
    unit.targetId = undefined;
  }

  static isDead(unit: Unit): boolean {
    return unit.stats.hp <= 0;
  }
}
