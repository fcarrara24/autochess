import { UnitTemplate } from './unitTemplate';

export interface Position {
  x: number;
  y: number;
}

export interface UnitInstance {
  id: string;
  templateId: string;
  currentHp: number;
  position: Position;
  teamId: string;
  lastMoveTick: number;
  lastAttackTick: number;
  alive: boolean;
}

export class UnitInstanceFactory {
  private static idCounter = 0;

  static create(
    templateId: string,
    position: Position,
    teamId: string,
    template: UnitTemplate
  ): UnitInstance {
    return {
      id: `unit_${++this.idCounter}`,
      templateId,
      currentHp: template.hp,
      position: { ...position },
      teamId,
      lastMoveTick: -1,
      lastAttackTick: -1,
      alive: true
    };
  }

  static resetIdCounter(): void {
    this.idCounter = 0;
  }
}

export function isUnitAlive(unit: UnitInstance): boolean {
  return unit.alive && unit.currentHp > 0;
}

export function canMove(unit: UnitInstance, currentTick: number, template: UnitTemplate): boolean {
  return isUnitAlive(unit) && (currentTick - unit.lastMoveTick) >= template.movementCooldown;
}

export function canAttack(unit: UnitInstance, currentTick: number, template: UnitTemplate): boolean {
  return isUnitAlive(unit) && (currentTick - unit.lastAttackTick) >= template.attackCooldown;
}
