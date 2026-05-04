"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GameEngine = void 0;
const models_1 = require("../models");
const models_2 = require("../models");
class GameEngine {
    constructor() {
        this.gameLoopInterval = null;
        this.TICK_RATE = 200; // 5 ticks per second
        this.PLACEMENT_TIME = 30000; // 30 seconds
        this.BATTLE_TIME = 40000; // 40 seconds
        this.gameState = this.initializeGame();
    }
    initializeGame() {
        const grid = new models_2.Grid();
        return {
            phase: models_1.GamePhase.PLACEMENT,
            players: [],
            grid,
            currentRound: 1,
            roundStartTime: Date.now(),
            placementTimeLimit: this.PLACEMENT_TIME,
            battleTimeLimit: this.BATTLE_TIME,
            tickCount: 0,
            isPaused: false
        };
    }
    getGameState() {
        return { ...this.gameState };
    }
    addPlayer(playerId) {
        if (this.gameState.players.length >= 2) {
            return null;
        }
        const existingPlayer = this.gameState.players.find(p => p.id === playerId);
        if (existingPlayer) {
            return existingPlayer.slot;
        }
        const slot = this.gameState.players.length === 0 ? models_1.PlayerSlot.PLAYER_A : models_1.PlayerSlot.PLAYER_B;
        const player = new models_2.Player(playerId, slot);
        this.gameState.players.push(player);
        if (this.gameState.players.length === 2) {
            this.startPlacementPhase();
        }
        return slot;
    }
    removePlayer(playerId) {
        const playerIndex = this.gameState.players.findIndex(p => p.id === playerId);
        if (playerIndex !== -1) {
            this.gameState.players[playerIndex].isConnected = false;
            this.pauseGame();
        }
    }
    reconnectPlayer(playerId) {
        const player = this.gameState.players.find(p => p.id === playerId);
        if (player) {
            player.isConnected = true;
            // Check if we can resume the game
            const connectedPlayers = this.gameState.players.filter(p => p.isConnected);
            if (connectedPlayers.length === 2 && this.gameState.isPaused) {
                this.resumeGame();
            }
            return true;
        }
        return false;
    }
    startPlacementPhase() {
        this.gameState.phase = models_1.GamePhase.PLACEMENT;
        this.gameState.roundStartTime = Date.now();
        this.gameState.isPaused = false;
        // Clear any existing game loop
        if (this.gameLoopInterval) {
            clearInterval(this.gameLoopInterval);
            this.gameLoopInterval = null;
        }
        // Start placement timer
        setTimeout(() => {
            if (this.gameState.phase === models_1.GamePhase.PLACEMENT) {
                this.startBattlePhase();
            }
        }, this.PLACEMENT_TIME);
    }
    startBattlePhase() {
        this.gameState.phase = models_1.GamePhase.BATTLE;
        this.gameState.roundStartTime = Date.now();
        this.gameState.tickCount = 0;
        // Start game loop
        this.gameLoopInterval = setInterval(() => {
            this.gameTick();
        }, this.TICK_RATE);
        // Battle timeout
        setTimeout(() => {
            if (this.gameState.phase === models_1.GamePhase.BATTLE) {
                this.endRound();
            }
        }, this.BATTLE_TIME);
    }
    gameTick() {
        if (this.gameState.isPaused || this.gameState.phase !== models_1.GamePhase.BATTLE) {
            return;
        }
        this.gameState.tickCount++;
        // Movement phase
        this.processMovementPhase();
        // Attack phase
        this.processAttackPhase();
        // Death resolution
        this.processDeathResolution();
        // Check for round end
        if (this.checkRoundEnd()) {
            this.endRound();
        }
    }
    processMovementPhase() {
        const allUnits = this.getAllAliveUnits();
        // Sort units by placement timestamp and player priority
        allUnits.sort((a, b) => {
            if (a.placementTimestamp !== b.placementTimestamp) {
                return a.placementTimestamp - b.placementTimestamp;
            }
            return a.owner === models_1.PlayerSlot.PLAYER_A ? -1 : 1;
        });
        // Process movement for each unit
        for (const unit of allUnits) {
            models_2.UnitController.updateUnitState(unit, this.gameState.grid, allUnits);
            if (unit.state === 'SEEK' || unit.state === 'ENGAGED') {
                this.moveUnit(unit);
            }
        }
    }
    moveUnit(unit) {
        const validMoves = models_2.UnitController.getValidMovePositions(unit, this.gameState.grid);
        if (validMoves.length === 0) {
            return;
        }
        let targetPosition = null;
        if (unit.state === 'SEEK') {
            // Move forward toward enemy side
            const forwardDirection = unit.owner === models_1.PlayerSlot.PLAYER_A ? 1 : -1;
            const forwardPositions = validMoves.filter(pos => pos.x === unit.position.x + forwardDirection);
            if (forwardPositions.length > 0) {
                targetPosition = forwardPositions[0];
            }
            else {
                // Try diagonal forward positions
                const diagonalPositions = validMoves.filter(pos => pos.x === unit.position.x + forwardDirection);
                if (diagonalPositions.length > 0) {
                    targetPosition = diagonalPositions[0];
                }
            }
        }
        else if (unit.state === 'ENGAGED') {
            // Move diagonally toward target enemy
            const target = unit.targetId ? this.getAllAliveUnits().find(u => u.id === unit.targetId) : null;
            if (target) {
                const dx = Math.sign(target.position.x - unit.position.x);
                const dy = Math.sign(target.position.y - unit.position.y);
                const diagonalPos = validMoves.find(pos => pos.x === unit.position.x + dx && pos.y === unit.position.y + dy);
                if (diagonalPos) {
                    targetPosition = diagonalPos;
                }
            }
        }
        if (targetPosition) {
            this.gameState.grid.moveUnit(unit.position, targetPosition);
        }
    }
    processAttackPhase() {
        const allUnits = this.getAllAliveUnits();
        // All attacks happen simultaneously
        const attacks = [];
        for (const unit of allUnits) {
            models_2.UnitController.updateUnitState(unit, this.gameState.grid, allUnits);
            if (unit.state === 'ATTACK') {
                const target = unit.targetId ? allUnits.find(u => u.id === unit.targetId) : null;
                if (target && this.gameState.grid.isInRange(unit.position, target.position, unit.stats.range)) {
                    attacks.push({ attacker: unit, defender: target, damage: unit.stats.damage });
                }
            }
        }
        // Apply all damage
        for (const attack of attacks) {
            attack.defender.stats.hp -= attack.damage;
        }
    }
    processDeathResolution() {
        const allUnits = this.getAllUnits();
        for (const unit of allUnits) {
            if (unit.stats.hp <= 0) {
                this.gameState.grid.removeUnit(unit.position);
            }
        }
    }
    checkRoundEnd() {
        const playerAUnits = this.getAllAliveUnits().filter(u => u.owner === models_1.PlayerSlot.PLAYER_A);
        const playerBUnits = this.getAllAliveUnits().filter(u => u.owner === models_1.PlayerSlot.PLAYER_B);
        return playerAUnits.length === 0 || playerBUnits.length === 0;
    }
    endRound() {
        if (this.gameLoopInterval) {
            clearInterval(this.gameLoopInterval);
            this.gameLoopInterval = null;
        }
        const playerAUnits = this.getAllAliveUnits().filter(u => u.owner === models_1.PlayerSlot.PLAYER_A);
        const playerBUnits = this.getAllAliveUnits().filter(u => u.owner === models_1.PlayerSlot.PLAYER_B);
        // Award points
        if (playerAUnits.length > 0 && playerBUnits.length === 0) {
            const playerA = this.gameState.players.find(p => p.slot === models_1.PlayerSlot.PLAYER_A);
            if (playerA)
                playerA.incrementScore();
        }
        else if (playerBUnits.length > 0 && playerAUnits.length === 0) {
            const playerB = this.gameState.players.find(p => p.slot === models_1.PlayerSlot.PLAYER_B);
            if (playerB)
                playerB.incrementScore();
        }
        // Check for match winner
        const playerA = this.gameState.players.find(p => p.slot === models_1.PlayerSlot.PLAYER_A);
        const playerB = this.gameState.players.find(p => p.slot === models_1.PlayerSlot.PLAYER_B);
        if (playerA && playerA.score >= 3) {
            this.gameState.winner = models_1.PlayerSlot.PLAYER_A;
            return;
        }
        if (playerB && playerB.score >= 3) {
            this.gameState.winner = models_1.PlayerSlot.PLAYER_B;
            return;
        }
        // Start new round
        this.startNewRound();
    }
    startNewRound() {
        this.gameState.currentRound++;
        // Reset units to original positions
        for (const player of this.gameState.players) {
            player.resetForNewRound();
        }
        // Rebuild grid
        this.gameState.grid.clear();
        for (const player of this.gameState.players) {
            for (const unit of player.units) {
                this.gameState.grid.setUnitAt(unit.position, unit);
            }
        }
        // Start placement phase
        this.startPlacementPhase();
    }
    getAllUnits() {
        return this.gameState.players.flatMap(p => p.units);
    }
    getAllAliveUnits() {
        return this.getAllUnits().filter(u => u.stats.hp > 0);
    }
    pauseGame() {
        this.gameState.isPaused = true;
    }
    resumeGame() {
        this.gameState.isPaused = false;
    }
    shutdown() {
        if (this.gameLoopInterval) {
            clearInterval(this.gameLoopInterval);
            this.gameLoopInterval = null;
        }
    }
}
exports.GameEngine = GameEngine;
