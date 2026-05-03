"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UnitController = exports.UnitFactory = void 0;
const types_1 = require("./types");
class UnitFactory {
    static createUnit(type, owner, position, id) {
        const stats = this.getUnitStats(type);
        return {
            id,
            type,
            owner,
            position: { ...position },
            originalPosition: { ...position },
            stats: { ...stats },
            state: types_1.UnitState.SEEK,
            placementTimestamp: Date.now()
        };
    }
    static getUnitStats(type) {
        switch (type) {
            case types_1.UnitType.MELEE:
                return {
                    hp: 30,
                    maxHp: 30,
                    damage: 10,
                    range: 1
                };
            case types_1.UnitType.RANGED:
                return {
                    hp: 20,
                    maxHp: 20,
                    damage: 6,
                    range: 2
                };
            default:
                throw new Error(`Unknown unit type: ${type}`);
        }
    }
}
exports.UnitFactory = UnitFactory;
class UnitController {
    static getUnitInForwardInteractionLine(unit, grid, allUnits) {
        const interactionPositions = grid.getForwardInteractionLine(unit.position, unit.owner);
        for (const pos of interactionPositions) {
            const targetUnit = grid.getUnitAt(pos);
            if (targetUnit && targetUnit.owner !== unit.owner) {
                return targetUnit;
            }
        }
        return null;
    }
    static getValidMovePositions(unit, grid) {
        const neighbors = grid.getNeighbors(unit.position);
        return neighbors.filter(pos => !grid.isOccupied(pos));
    }
    static getTargetPriority(unit, grid, allUnits) {
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
                const enemyAtPos = enemies.find(e => e.position.x === targetPos.x && e.position.y === targetPos.y);
                if (enemyAtPos) {
                    return enemyAtPos;
                }
            }
        }
        // If no target in priority positions, find closest enemy in range
        const enemiesInRange = enemies.filter(e => grid.isInRange(unit.position, e.position, unit.stats.range));
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
    static getTargetDirections(playerSlot) {
        if (playerSlot === 'A') {
            return [
                { x: 1, y: 0 }, // forward center
                { x: 1, y: -1 }, // forward-left
                { x: 1, y: 1 }, // forward-right
                { x: 0, y: -1 }, // left
                { x: 0, y: 1 } // right
            ];
        }
        else {
            return [
                { x: -1, y: 0 }, // forward center
                { x: -1, y: -1 }, // forward-left
                { x: -1, y: 1 }, // forward-right
                { x: 0, y: -1 }, // left
                { x: 0, y: 1 } // right
            ];
        }
    }
    static updateUnitState(unit, grid, allUnits) {
        const target = this.getTargetPriority(unit, grid, allUnits);
        if (target) {
            unit.targetId = target.id;
            if (grid.isInRange(unit.position, target.position, unit.stats.range)) {
                unit.state = types_1.UnitState.ATTACK;
            }
            else {
                unit.state = types_1.UnitState.ENGAGED;
            }
        }
        else {
            unit.targetId = undefined;
            unit.state = types_1.UnitState.SEEK;
        }
    }
    static resetUnit(unit) {
        unit.position = { ...unit.originalPosition };
        unit.stats.hp = unit.stats.maxHp;
        unit.state = types_1.UnitState.SEEK;
        unit.targetId = undefined;
    }
    static isDead(unit) {
        return unit.stats.hp <= 0;
    }
}
exports.UnitController = UnitController;
