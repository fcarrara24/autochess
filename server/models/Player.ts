import { PlayerSlot, Position, Unit, UnitState, UnitType } from './types';
import { UnitFactory } from './Unit';

export class Player {
  public id: string;
  public slot: PlayerSlot;
  public units: Unit[];
  public score: number;
  public isConnected: boolean;

  constructor(id: string, slot: PlayerSlot) {
    this.id = id;
    this.slot = slot;
    this.units = [];
    this.score = 0;
    this.isConnected = true;
  }

  addUnit(unitType: UnitType, position: Position): Unit {
    const unitId = `${this.id}-${unitType}-${Date.now()}-${Math.random()}`;
    const unit = UnitFactory.createUnit(unitType, this.slot, position, unitId);
    this.units.push(unit);
    return unit;
  }

  removeUnit(unitId: string): boolean {
    const index = this.units.findIndex(u => u.id === unitId);
    if (index !== -1) {
      this.units.splice(index, 1);
      return true;
    }
    return false;
  }

  getUnit(unitId: string): Unit | undefined {
    return this.units.find(u => u.id === unitId);
  }

  getAliveUnits(): Unit[] {
    return this.units.filter(u => u.stats.hp > 0);
  }

  hasAliveUnits(): boolean {
    return this.getAliveUnits().length > 0;
  }

  incrementScore(): void {
    this.score++;
  }

  resetForNewRound(): void {
    this.units.forEach(unit => {
      unit.position = { ...unit.originalPosition };
      unit.stats.hp = unit.stats.maxHp;
      unit.state = 'SEEK' as UnitState;
      unit.targetId = undefined;
    });
  }

  clearAllUnits(): void {
    this.units = [];
  }

  canPlaceUnitAt(position: Position): boolean {
    // Check if position is within player's area
    if (this.slot === PlayerSlot.PLAYER_A) {
      return position.x >= 0 && position.x <= 3;
    } else {
      return position.x >= 4 && position.x <= 7;
    }
  }

  getMaxUnits(): number {
    return 12;
  }

  canAddMoreUnits(): boolean {
    return this.units.length < this.getMaxUnits();
  }
}
