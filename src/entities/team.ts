import { UnitInstance } from './unitInstance';

export interface Team {
  id: string;
  name: string;
  units: UnitInstance[];
}

export class TeamFactory {
  static create(id: string, name: string, units: UnitInstance[]): Team {
    return {
      id,
      name,
      units: [...units]
    };
  }
}

export function getAliveUnits(team: Team): UnitInstance[] {
  return team.units.filter(unit => unit.alive);
}

export function getUnitCount(team: Team): number {
  return team.units.filter(unit => unit.alive).length;
}

export function isTeamDefeated(team: Team): boolean {
  return getUnitCount(team) === 0;
}
