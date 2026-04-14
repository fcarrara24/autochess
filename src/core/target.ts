import { UnitInstance } from '../entities/unitInstance';
import { UnitTemplate } from '../entities/unitTemplate';

export function getDistance(pos1: { x: number; y: number }, pos2: { x: number; y: number }): number {
  return Math.abs(pos1.x - pos2.x) + Math.abs(pos1.y - pos2.y);
}

export function findTargetInRange(
  attacker: UnitInstance,
  attackerTemplate: UnitTemplate,
  potentialTargets: UnitInstance[]
): UnitInstance | null {
  const targetsInRange = potentialTargets.filter(target => {
    if (!target.alive) return false;
    const distance = getDistance(attacker.position, target.position);
    return distance <= attackerTemplate.range;
  });

  if (targetsInRange.length === 0) return null;

  targetsInRange.sort((a, b) => {
    const distA = getDistance(attacker.position, a.position);
    const distB = getDistance(attacker.position, b.position);
    if (distA !== distB) return distA - distB;
    return a.id.localeCompare(b.id);
  });

  return targetsInRange[0];
}
