"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Player = void 0;
const types_1 = require("./types");
const Unit_1 = require("./Unit");
class Player {
    constructor(id, slot) {
        this.id = id;
        this.slot = slot;
        this.units = [];
        this.score = 0;
        this.isConnected = true;
    }
    addUnit(unitType, position) {
        const unitId = `${this.id}-${unitType}-${Date.now()}-${Math.random()}`;
        const unit = Unit_1.UnitFactory.createUnit(unitType, this.slot, position, unitId);
        this.units.push(unit);
        return unit;
    }
    removeUnit(unitId) {
        const index = this.units.findIndex(u => u.id === unitId);
        if (index !== -1) {
            this.units.splice(index, 1);
            return true;
        }
        return false;
    }
    getUnit(unitId) {
        return this.units.find(u => u.id === unitId);
    }
    getAliveUnits() {
        return this.units.filter(u => u.stats.hp > 0);
    }
    hasAliveUnits() {
        return this.getAliveUnits().length > 0;
    }
    incrementScore() {
        this.score++;
    }
    resetForNewRound() {
        this.units.forEach(unit => {
            unit.position = { ...unit.originalPosition };
            unit.stats.hp = unit.stats.maxHp;
            unit.state = 'SEEK';
            unit.targetId = undefined;
        });
    }
    clearAllUnits() {
        this.units = [];
    }
    canPlaceUnitAt(position) {
        // Check if position is within player's area
        if (this.slot === types_1.PlayerSlot.PLAYER_A) {
            return position.x >= 0 && position.x <= 3;
        }
        else {
            return position.x >= 4 && position.x <= 7;
        }
    }
    getMaxUnits() {
        return 12;
    }
    canAddMoreUnits() {
        return this.units.length < this.getMaxUnits();
    }
}
exports.Player = Player;
