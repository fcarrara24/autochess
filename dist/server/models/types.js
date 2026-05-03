"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GamePhase = exports.PlayerSlot = exports.UnitState = exports.UnitType = void 0;
var UnitType;
(function (UnitType) {
    UnitType["MELEE"] = "melee";
    UnitType["RANGED"] = "ranged";
})(UnitType || (exports.UnitType = UnitType = {}));
var UnitState;
(function (UnitState) {
    UnitState["SEEK"] = "SEEK";
    UnitState["ENGAGED"] = "ENGAGED";
    UnitState["ATTACK"] = "ATTACK";
    UnitState["IDLE"] = "IDLE";
})(UnitState || (exports.UnitState = UnitState = {}));
var PlayerSlot;
(function (PlayerSlot) {
    PlayerSlot["PLAYER_A"] = "A";
    PlayerSlot["PLAYER_B"] = "B";
})(PlayerSlot || (exports.PlayerSlot = PlayerSlot = {}));
var GamePhase;
(function (GamePhase) {
    GamePhase["PLACEMENT"] = "PLACEMENT";
    GamePhase["BATTLE"] = "BATTLE";
})(GamePhase || (exports.GamePhase = GamePhase = {}));
