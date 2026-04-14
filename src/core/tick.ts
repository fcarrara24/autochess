import { UnitInstance } from '../entities/unitInstance';
import { UnitTemplate } from '../entities/unitTemplate';
import { Grid } from '../utils/grid';
import { tryMoveUnit } from './movement';
import { processAttacks, applyDamage, AttackAction, DeathRecord } from './combat';

export interface TickLog {
  tick: number;
  moves: Array<{ unitId: string; from: { x: number; y: number }; to: { x: number; y: number } }>;
  attacks: AttackAction[];
  deaths: DeathRecord[];
}

export function processTick(
  currentTick: number,
  units: UnitInstance[],
  templates: Map<string, UnitTemplate>,
  grid: Grid
): TickLog {
  const tickLog: TickLog = {
    tick: currentTick,
    moves: [],
    attacks: [],
    deaths: []
  };

  const aliveUnits = units.filter(unit => unit.alive);
  const teamAUnits = aliveUnits.filter(u => u.teamId === 'teamA');
  const teamBUnits = aliveUnits.filter(u => u.teamId === 'teamB');

  const enemyPositionsA = teamBUnits.map(u => u.position);
  const enemyPositionsB = teamAUnits.map(u => u.position);

  // Movement phase
  for (const unit of aliveUnits) {
    const template = templates.get(unit.templateId);
    if (!template) continue;

    if ((currentTick - unit.lastMoveTick) >= template.movementCooldown) {
      const enemyPositions = unit.teamId === 'teamA' ? enemyPositionsB : enemyPositionsA;
      const oldPos = { ...unit.position };
      const newPos = tryMoveUnit(unit, template, grid, currentTick, enemyPositions);
      
      if (newPos) {
        tickLog.moves.push({
          unitId: unit.id,
          from: oldPos,
          to: newPos
        });
      }
    }
  }

  // Attack phase
  tickLog.attacks = processAttacks(units, templates, currentTick);
  tickLog.deaths = applyDamage(tickLog.attacks, units, currentTick);

  for (const death of tickLog.deaths) {
    const deadUnit = units.find(u => u.id === death.unitId);
    if (deadUnit) {
      grid.vacate(deadUnit.position);
    }
  }

  return tickLog;
}
