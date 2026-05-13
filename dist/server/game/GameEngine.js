"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GameEngine = void 0;
const models_1 = require("../models");
const models_2 = require("../models");
class GameEngine {
    constructor() {
        this.gameLoopInterval = null;
        this.TICK_RATE = 1000; // 1 tick per second
        this.PLACEMENT_TIME = 20000; // 20 seconds
        this.BATTLE_TIME = 10000; // 10 seconds
        this.gameState = this.initializeGame();
    }
    setUpdateCallback(callback) {
        this.updateCallback = callback;
    }
    notifyUpdate() {
        if (this.updateCallback) {
            this.updateCallback();
        }
    }
    initializeGame() {
        const grid = new models_1.Grid();
        return {
            phase: models_1.GamePhase.PLACEMENT,
            players: [],
            grid,
            currentRound: 1,
            roundStartTime: Date.now(),
            placementTimeLimit: this.PLACEMENT_TIME,
            battleTimeLimit: this.BATTLE_TIME,
            tickCount: 0,
            isPaused: false,
            totalGames: 0,
            maxGames: 6
        };
    }
    getGameState() {
        return { ...this.gameState };
    }
    addPlayer(playerId, isReconnection = false, requestedSlot) {
        // Check for reconnection first
        const existingPlayer = this.gameState.players.find(p => p.id === playerId);
        if (existingPlayer) {
            if (isReconnection) {
                existingPlayer.isConnected = true;
                console.log(`Player ${playerId} reconnected successfully`);
                // Resume game if both players are now connected
                if (this.gameState.players.every(p => p.isConnected)) {
                    this.resumeGame();
                }
            }
            return existingPlayer.slot;
        }
        let slot;
        // If player requested a specific slot
        if (requestedSlot) {
            const playerInRequestedSlot = this.gameState.players.find(p => p.slot === requestedSlot);
            if (playerInRequestedSlot) {
                // Slot is occupied, steal it from the current player
                console.log(`Player ${playerId} is stealing slot ${requestedSlot} from player ${playerInRequestedSlot.id}`);
                // Disconnect the current player
                playerInRequestedSlot.isConnected = false;
                // Remove the old player and add the new one
                const playerIndex = this.gameState.players.findIndex(p => p.id === playerInRequestedSlot.id);
                this.gameState.players.splice(playerIndex, 1);
                slot = requestedSlot;
            }
            else {
                // Slot is free, assign it
                slot = requestedSlot;
            }
        }
        else {
            // No specific slot requested, assign automatically
            if (this.gameState.players.length >= 2) {
                return null; // Game full and no specific slot requested
            }
            slot = this.gameState.players.length === 0 ? models_1.PlayerSlot.PLAYER_A : models_1.PlayerSlot.PLAYER_B;
        }
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
    markPlayerAsDisconnected(playerId) {
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
            // Check if we can resume the game or start placement timer
            const connectedPlayers = this.gameState.players.filter(p => p.isConnected);
            if (connectedPlayers.length === 2) {
                if (this.gameState.isPaused) {
                    this.resumeGame();
                }
                else if (this.gameState.phase === models_1.GamePhase.PLACEMENT && !this.gameState.roundStartTime) {
                    // Both players connected and placement timer hasn't started yet
                    this.checkAndStartPlacementTimer();
                }
            }
            return true;
        }
        return false;
    }
    startPlacementPhase() {
        this.gameState.phase = models_1.GamePhase.PLACEMENT;
        this.gameState.isPaused = false;
        // Clear any existing game loop
        if (this.gameLoopInterval) {
            clearInterval(this.gameLoopInterval);
            this.gameLoopInterval = null;
        }
        // Notify clients of phase change
        this.notifyUpdate();
        // Wait for both players to be connected before starting timer
        this.checkAndStartPlacementTimer();
    }
    checkAndStartPlacementTimer() {
        const connectedPlayers = this.gameState.players.filter(p => p.isConnected);
        if (connectedPlayers.length === 2) {
            // Both players are connected, start the timer
            this.gameState.roundStartTime = Date.now();
            // Start placement timer
            setTimeout(() => {
                if (this.gameState.phase === models_1.GamePhase.PLACEMENT) {
                    this.startBattlePhase();
                }
            }, this.PLACEMENT_TIME);
        }
        else {
            // Wait a bit and check again
            setTimeout(() => {
                if (this.gameState.phase === models_1.GamePhase.PLACEMENT) {
                    this.checkAndStartPlacementTimer();
                }
            }, 1000);
        }
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
        // Notify listeners of phase change
        this.notifyUpdate();
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
        // Notify listeners of state change
        this.notifyUpdate();
        // Check for round end
        if (this.checkRoundEnd()) {
            this.endRound();
        }
    }
    processMovementPhase() {
        const allUnits = this.getAllAliveUnits();
        console.log(`Processing movement for ${allUnits.length} units`);
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
                const oldPos = { ...unit.position };
                this.moveUnit(unit);
                // Log if unit actually moved
                if (oldPos.x !== unit.position.x || oldPos.y !== unit.position.y) {
                    console.log(`Unit ${unit.owner} ${unit.type} moved from (${oldPos.x},${oldPos.y}) to (${unit.position.x},${unit.position.y})`);
                }
            }
        }
    }
    moveUnit(unit) {
        const validMoves = models_2.UnitController.getValidMovePositions(unit, this.gameState.grid);
        console.log(`Unit ${unit.owner} ${unit.type} at (${unit.position.x},${unit.position.y}) has ${validMoves.length} valid moves:`, validMoves);
        if (validMoves.length === 0) {
            return;
        }
        let targetPosition = null;
        if (unit.state === 'SEEK') {
            // Always find nearest enemy and move toward it
            const allUnits = this.getAllAliveUnits();
            const enemies = allUnits.filter(u => u.owner !== unit.owner);
            if (enemies.length > 0) {
                // Find closest enemy
                let nearestEnemy = enemies[0];
                let minDistance = this.gameState.grid.getManhattanDistance(unit.position, nearestEnemy.position);
                for (const enemy of enemies) {
                    const distance = this.gameState.grid.getManhattanDistance(unit.position, enemy.position);
                    if (distance < minDistance) {
                        minDistance = distance;
                        nearestEnemy = enemy;
                    }
                }
                console.log(`SEEK mode - nearest enemy at (${nearestEnemy.position.x},${nearestEnemy.position.y}), distance: ${minDistance}`);
                // If enemy is in range, don't move (should transition to ATTACK)
                if (minDistance <= unit.stats.range) {
                    console.log(`Enemy in range, staying in position`);
                    return;
                }
                // Move toward the nearest enemy
                const dx = Math.sign(nearestEnemy.position.x - unit.position.x);
                const dy = Math.sign(nearestEnemy.position.y - unit.position.y);
                // Try to move in the direction of the enemy
                const towardPositions = validMoves.filter(pos => {
                    const moveDx = Math.sign(pos.x - unit.position.x);
                    const moveDy = Math.sign(pos.y - unit.position.y);
                    return (moveDx === dx && moveDy === 0) || (moveDx === 0 && moveDy === dy) || (moveDx === dx && moveDy === dy);
                });
                console.log(`Positions toward enemy:`, towardPositions);
                if (towardPositions.length > 0) {
                    // Prefer diagonal if available, then straight
                    const diagonalPos = towardPositions.find(pos => Math.sign(pos.x - unit.position.x) === dx && Math.sign(pos.y - unit.position.y) === dy);
                    targetPosition = diagonalPos || towardPositions[0];
                }
                else {
                    // If no direct path, try any valid move that reduces distance
                    let bestPos = validMoves[0];
                    let bestDistance = this.gameState.grid.getManhattanDistance(bestPos, nearestEnemy.position);
                    for (const pos of validMoves) {
                        const distance = this.gameState.grid.getManhattanDistance(pos, nearestEnemy.position);
                        if (distance < bestDistance) {
                            bestDistance = distance;
                            bestPos = pos;
                        }
                    }
                    console.log(`Best position to reduce distance: (${bestPos.x},${bestPos.y}), new distance: ${bestDistance}`);
                    targetPosition = bestPos;
                }
            }
        }
        else if (unit.state === 'ENGAGED') {
            // Move diagonally toward target enemy
            const target = unit.targetId ? this.getAllAliveUnits().find(u => u.id === unit.targetId) : null;
            console.log(`ENGAGED mode - target:`, target ? `at (${target.position.x},${target.position.y})` : 'not found');
            if (target) {
                const dx = Math.sign(target.position.x - unit.position.x);
                const dy = Math.sign(target.position.y - unit.position.y);
                console.log(`Direction to target: dx=${dx}, dy=${dy}`);
                const diagonalPos = validMoves.find(pos => pos.x === unit.position.x + dx && pos.y === unit.position.y + dy);
                console.log(`Diagonal position found:`, diagonalPos);
                if (diagonalPos) {
                    targetPosition = diagonalPos;
                }
            }
        }
        if (targetPosition) {
            console.log(`Moving unit to (${targetPosition.x},${targetPosition.y})`);
            this.gameState.grid.moveUnit(unit.position, targetPosition);
        }
        else {
            console.log(`No valid target position found for unit ${unit.owner} ${unit.type}`);
        }
    }
    processAttackPhase() {
        const allUnits = this.getAllAliveUnits();
        console.log(`Processing attacks for ${allUnits.length} units`);
        // All attacks happen simultaneously
        const attacks = [];
        for (const unit of allUnits) {
            models_2.UnitController.updateUnitState(unit, this.gameState.grid, allUnits);
            console.log(`Unit ${unit.owner} ${unit.type} at (${unit.position.x},${unit.position.y}) state: ${unit.state}, target: ${unit.targetId}`);
            if (unit.state === 'ATTACK') {
                const target = unit.targetId ? allUnits.find(u => u.id === unit.targetId) : null;
                if (target) {
                    const distance = this.gameState.grid.getManhattanDistance(unit.position, target.position);
                    const inRange = this.gameState.grid.isInRange(unit.position, target.position, unit.stats.range);
                    console.log(`Target found at (${target.position.x},${target.position.y}), distance: ${distance}, range: ${unit.stats.range}, inRange: ${inRange}`);
                    if (inRange) {
                        attacks.push({ attacker: unit, defender: target, damage: unit.stats.damage });
                        console.log(`Attack: ${unit.owner} ${unit.type} -> ${target.owner} ${target.type} for ${unit.stats.damage} damage`);
                    }
                }
                else {
                    console.log(`No target found for unit ${unit.id}`);
                }
            }
        }
        console.log(`Total attacks this tick: ${attacks.length}`);
        // Apply all damage
        for (const attack of attacks) {
            const oldHp = attack.defender.stats.hp;
            attack.defender.stats.hp -= attack.damage;
            console.log(`Damage applied: ${attack.defender.owner} ${attack.defender.type} HP ${oldHp} -> ${attack.defender.stats.hp}`);
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
        let roundWinner = undefined;
        let isDraw = false;
        // Increment total games played
        this.gameState.totalGames++;
        // Check for draw (both units dead or timeout)
        if (playerAUnits.length === 0 && playerBUnits.length === 0) {
            isDraw = true;
            console.log('Round ended in a draw - both players have no units');
        }
        else if (this.gameState.tickCount >= (this.BATTLE_TIME / this.TICK_RATE)) {
            // Timeout reached - check who has more units
            if (playerAUnits.length === playerBUnits.length) {
                isDraw = true;
                console.log('Round ended in a draw - timeout with equal units');
            }
        }
        // Award points and determine round winner (if not draw)
        if (!isDraw) {
            if (playerAUnits.length > 0 && playerBUnits.length === 0) {
                const playerA = this.gameState.players.find(p => p.slot === models_1.PlayerSlot.PLAYER_A);
                if (playerA) {
                    playerA.incrementScore();
                    roundWinner = models_1.PlayerSlot.PLAYER_A;
                }
            }
            else if (playerBUnits.length > 0 && playerAUnits.length === 0) {
                const playerB = this.gameState.players.find(p => p.slot === models_1.PlayerSlot.PLAYER_B);
                if (playerB) {
                    playerB.incrementScore();
                    roundWinner = models_1.PlayerSlot.PLAYER_B;
                }
            }
        }
        // Set round result in game state
        this.gameState.roundWinner = roundWinner;
        this.gameState.drawResult = isDraw;
        // Notify listeners of round end
        this.notifyUpdate();
        // Check for absolute winner (3 wins or max games reached)
        const playerA = this.gameState.players.find(p => p.slot === models_1.PlayerSlot.PLAYER_A);
        const playerB = this.gameState.players.find(p => p.slot === models_1.PlayerSlot.PLAYER_B);
        let absoluteWinner = undefined;
        let matchEnded = false;
        if (playerA && playerA.score >= 3) {
            absoluteWinner = models_1.PlayerSlot.PLAYER_A;
            matchEnded = true;
            console.log('Player A wins the match with 3 victories!');
        }
        else if (playerB && playerB.score >= 3) {
            absoluteWinner = models_1.PlayerSlot.PLAYER_B;
            matchEnded = true;
            console.log('Player B wins the match with 3 victories!');
        }
        else if (this.gameState.totalGames >= this.gameState.maxGames) {
            // Max games reached, check who has more points
            matchEnded = true; // Match ends regardless of winner
            if (playerA && playerB) {
                if (playerA.score > playerB.score) {
                    absoluteWinner = models_1.PlayerSlot.PLAYER_A;
                    console.log(`Player A wins the match on points (${playerA.score} vs ${playerB.score})!`);
                }
                else if (playerB.score > playerA.score) {
                    absoluteWinner = models_1.PlayerSlot.PLAYER_B;
                    console.log(`Player B wins the match on points (${playerB.score} vs ${playerA.score})!`);
                }
                else {
                    // Still tied after max games - it's a draw
                    console.log('Match ends in a tie after max games!');
                }
            }
        }
        // Set absolute winner if determined
        if (absoluteWinner) {
            this.gameState.winner = absoluteWinner;
            this.notifyUpdate();
            return; // Don't start new round when match is over
        }
        // If match ended without winner (draw), still don't start new round
        if (matchEnded) {
            this.notifyUpdate();
            return;
        }
        // Start next round after 5 seconds (only if match continues)
        setTimeout(() => {
            this.startNewRound();
        }, 5000);
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
        if (this.gameState.isPaused && this.gameState.players.every(p => p.isConnected)) {
            this.gameState.isPaused = false;
            console.log('Game resumed - all players connected');
        }
    }
    shutdown() {
        if (this.gameLoopInterval) {
            clearInterval(this.gameLoopInterval);
            this.gameLoopInterval = null;
        }
    }
}
exports.GameEngine = GameEngine;
