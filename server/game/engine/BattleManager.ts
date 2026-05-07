import { Unit, Position, UnitState } from '../../../models';

export class BattleManager {
  private units: Unit[] = [];
  private tickCount: number = 0;

  setUnits(units: Unit[]): void {
    this.units = units;
  }

  processTick(): void {
    this.tickCount++;
    
    // Process movement first
    this.processMovement();
    
    // Then process attacks
    this.processAttacks();
  }

  private processMovement(): void {
    const movingUnits = this.units.filter(unit => unit.state !== UnitState.ATTACK);
    
    for (const unit of movingUnits) {
      // Simple movement logic - move towards nearest enemy
      const enemies = this.getEnemies(unit);
      if (enemies.length > 0) {
        const nearestEnemy = this.findNearestEnemy(unit, enemies);
        if (nearestEnemy) {
          this.moveTowards(unit, nearestEnemy);
        }
      }
    }
  }

  private processAttacks(): void {
    const attackingUnits = this.units.filter(unit => unit.state === UnitState.ATTACK);
    
    for (const unit of attackingUnits) {
      if (unit.targetId) {
        const target = this.units.find(u => u.id === unit.targetId);
        if (target && target.stats.hp > 0) {
          this.performAttack(unit, target);
        }
      }
    }
  }

  private getEnemies(unit: Unit): Unit[] {
    return this.units.filter(u => u.owner !== unit.owner && u.stats.hp > 0);
  }

  private findNearestEnemy(unit: Unit, enemies: Unit[]): Unit | null {
    let nearest: Unit | null = null;
    let minDistance = Infinity;

    for (const enemy of enemies) {
      const distance = this.getManhattanDistance(unit.position, enemy.position);
      if (distance < minDistance) {
        minDistance = distance;
        nearest = enemy;
      }
    }

    return nearest;
  }

  private getManhattanDistance(pos1: Position, pos2: Position): number {
    return Math.abs(pos1.x - pos2.x) + Math.abs(pos1.y - pos2.y);
  }

  private moveTowards(unit: Unit, target: Unit): void {
    // Simple movement - move one step closer to target
    const dx = Math.sign(target.position.x - unit.position.x);
    const dy = Math.sign(target.position.y - unit.position.y);
    
    const newPos: Position = {
      x: unit.position.x + dx,
      y: unit.position.y + dy
    };

    // Check if new position is valid (simplified)
    if (this.isValidPosition(newPos)) {
      unit.position = newPos;
    }
  }

  private isValidPosition(pos: Position): boolean {
    return pos.x >= 0 && pos.x < 9 && pos.y >= 0 && pos.y < 3;
  }

  private performAttack(attacker: Unit, target: Unit): void {
    target.stats.hp -= attacker.stats.damage;
    if (target.stats.hp < 0) {
      target.stats.hp = 0;
    }
  }

  getTickCount(): number {
    return this.tickCount;
  }

  reset(): void {
    this.units = [];
    this.tickCount = 0;
  }
}
