import { UnitInstance } from '../entities/unitInstance';
import { UnitTemplate } from '../entities/unitTemplate';
import { findTargetInRange } from './target';

export interface AttackAction {
  attackerId: string;
  targetId: string;
  damage: number;
}

export interface DeathRecord {
  unitId: string;
  teamId: string;
  tick: number;
}

export function processAttacks(
  units: UnitInstance[],
  templates: Map<string, UnitTemplate>,
  currentTick: number
): AttackAction[] {
  const attacks: AttackAction[] = [];
  const aliveUnits = units.filter(unit => unit.alive);

  for (const unit of aliveUnits) {
    const template = templates.get(unit.templateId);
    if (!template) continue;

    if ((currentTick - unit.lastAttackTick) < template.attackCooldown) {
      continue;
    }

    const enemies = aliveUnits.filter(u => u.teamId !== unit.teamId);
    const target = findTargetInRange(unit, template, enemies);

    if (target) {
      attacks.push({
        attackerId: unit.id,
        targetId: target.id,
        damage: template.damage
      });
      unit.lastAttackTick = currentTick;
    }
  }

  return attacks;
}

export function applyDamage(
  attacks: AttackAction[],
  units: UnitInstance[],
  currentTick: number
): DeathRecord[] {
  const deaths: DeathRecord[] = [];
  const unitMap = new Map(units.map(u => [u.id, u]));

  for (const attack of attacks) {
    const target = unitMap.get(attack.targetId);
    if (!target || !target.alive) continue;

    target.currentHp -= attack.damage;
    
    if (target.currentHp <= 0) {
      target.currentHp = 0;
      target.alive = false;
      deaths.push({
        unitId: target.id,
        teamId: target.teamId,
        tick: currentTick
      });
    }
  }

  return deaths;
}
