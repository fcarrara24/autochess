import { UnitType } from './types';

export interface UnitStatsConfig {
  hp: number;
  maxHp: number;
  damage: number;
  range: number;
  aoeRadius: number;
}

export const UNIT_STATS: Record<UnitType, UnitStatsConfig> = {
  [UnitType.MELEE]: {
    hp: 30,
    maxHp: 30,
    damage: 10,
    range: 1,
    aoeRadius: 1
  },
  [UnitType.RANGED]: {
    hp: 20,
    maxHp: 20,
    damage: 6,
    range: 2,
    aoeRadius: 1
  },
  [UnitType.THROWER]: {
    hp: 15,
    maxHp: 15,
    damage: 6,
    range: 1,
    aoeRadius: 3
  },
  [UnitType.TANK]: {
    hp: 45,
    maxHp: 45,
    damage: 7,
    range: 1,
    aoeRadius: 1
  }
};
