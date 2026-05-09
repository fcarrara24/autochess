"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NetworkManager = void 0;
const models_1 = require("../models");
class NetworkManager {
    // constructor
    constructor(io, gameEngine) {
        this.playerSockets = new Map();
        this.rateLimiter = new Map();
        this.playerSessions = new Map();
        this.RATE_LIMIT_MS = 100; // Max 10 actions per second per client
        this.io = io;
        this.gameEngine = gameEngine;
        // Set up update callback to broadcast state changes
        this.gameEngine.setUpdateCallback(() => {
            this.sendGameStateToAll();
        });
        this.setupSocketHandlers();
    }
    // setup socket actions upon connection
    setupSocketHandlers() {
        this.io.on('connection', (socket) => {
            console.log(`Player connected: ${socket.id}`);
            // Handle player joining with optional persistent ID and slot
            socket.on('joinGame', (data) => {
                this.handlePlayerJoin(socket, data?.persistentId, data?.requestedSlot);
            });
            // Handle client actions
            socket.on('playerAction', (action) => {
                this.handlePlayerAction(socket, action);
            });
            // Handle disconnection
            socket.on('disconnect', () => {
                this.handlePlayerDisconnect(socket);
            });
        });
    }
    handlePlayerJoin(socket, persistentId, requestedSlot) {
        let playerId = socket.id;
        let isReconnection = false;
        // Check if this is a reconnection with persistent ID
        if (persistentId) {
            const session = this.playerSessions.get(persistentId);
            if (session && Date.now() - session.lastSeen < 5 * 60 * 1000) { // 5 minutes timeout
                // This is a valid reconnection
                playerId = persistentId;
                isReconnection = true;
                console.log(`Player reconnection detected: ${persistentId} -> ${socket.id}`);
            }
        }
        // Convert requestedSlot string to PlayerSlot enum if provided
        let slotEnum = undefined;
        if (requestedSlot) {
            slotEnum = requestedSlot === 'A' ? models_1.PlayerSlot.PLAYER_A : requestedSlot === 'B' ? models_1.PlayerSlot.PLAYER_B : undefined;
        }
        const playerSlot = this.gameEngine.addPlayer(playerId, isReconnection, slotEnum);
        if (playerSlot === null) {
            // Game is full
            socket.emit('error', { message: 'Game is full' });
            socket.disconnect();
            return;
        }
        this.playerSockets.set(socket.id, socket);
        this.playerSessions.set(playerId, { socketId: socket.id, lastSeen: Date.now() });
        // Send initial game state
        this.sendGameStateToAll();
        // Send player their slot and persistent ID
        socket.emit('playerSlot', { slot: playerSlot, persistentId: playerId });
        console.log(`Player ${socket.id} assigned to slot ${playerSlot}${isReconnection ? ' (reconnected)' : ''}${requestedSlot ? ` (requested: ${requestedSlot})` : ''}`);
    }
    handlePlayerAction(socket, action) {
        // Rate limiting
        if (!this.checkRateLimit(socket.id)) {
            socket.emit('error', { message: 'Rate limit exceeded' });
            return;
        }
        // Only allow actions during placement phase
        const gameState = this.gameEngine.getGameState();
        if (gameState.phase !== models_1.GamePhase.PLACEMENT) {
            socket.emit('error', { message: 'Cannot perform actions during battle phase' });
            return;
        }
        try {
            let success = false;
            switch (action.type) {
                case 'place':
                    success = this.handlePlaceAction(socket, action);
                    break;
                case 'move':
                    success = this.handleMoveAction(socket, action);
                    break;
                case 'remove':
                    success = this.handleRemoveAction(socket, action);
                    break;
            }
            if (success) {
                this.sendGameStateToAll();
            }
            else {
                socket.emit('error', { message: 'Invalid action' });
            }
        }
        catch (error) {
            console.error('Error handling player action:', error);
            socket.emit('error', { message: 'Server error' });
        }
    }
    handlePlaceAction(socket, action) {
        if (!action.unitType)
            return false;
        const gameState = this.gameEngine.getGameState();
        const player = gameState.players.find(p => p.id === socket.id);
        if (!player)
            return false;
        // Check if player can place more units
        if (!player.canAddMoreUnits()) {
            return false;
        }
        // Check if position is valid for player
        if (!player.canPlaceUnitAt(action.position)) {
            return false;
        }
        // Check if position is occupied
        if (gameState.grid.isOccupied(action.position)) {
            return false;
        }
        // Place the unit
        const unit = player.addUnit(action.unitType, action.position);
        gameState.grid.setUnitAt(action.position, unit);
        return true;
    }
    handleMoveAction(socket, action) {
        if (!action.unitId)
            return false;
        const gameState = this.gameEngine.getGameState();
        const player = gameState.players.find(p => p.id === socket.id);
        if (!player)
            return false;
        const unit = player.getUnit(action.unitId);
        if (!unit)
            return false;
        // Check if new position is valid for player
        if (!player.canPlaceUnitAt(action.position)) {
            return false;
        }
        // Check if new position is occupied
        if (gameState.grid.isOccupied(action.position)) {
            return false;
        }
        // Move the unit
        gameState.grid.removeUnit(unit.position);
        gameState.grid.setUnitAt(action.position, unit);
        unit.position = { ...action.position };
        unit.originalPosition = { ...action.position };
        return true;
    }
    handleRemoveAction(socket, action) {
        if (!action.unitId)
            return false;
        const gameState = this.gameEngine.getGameState();
        const player = gameState.players.find(p => p.id === socket.id);
        if (!player)
            return false;
        const unit = player.getUnit(action.unitId);
        if (!unit)
            return false;
        // Remove the unit
        gameState.grid.removeUnit(unit.position);
        player.removeUnit(action.unitId);
        return true;
    }
    handlePlayerDisconnect(socket) {
        console.log(`Player disconnected: ${socket.id}`);
        this.playerSockets.delete(socket.id);
        this.rateLimiter.delete(socket.id);
        // Update session last seen time but don't remove player immediately
        for (const [persistentId, session] of this.playerSessions.entries()) {
            if (session.socketId === socket.id) {
                session.lastSeen = Date.now();
                // Mark player as disconnected but keep in game for reconnection
                this.gameEngine.markPlayerAsDisconnected(persistentId);
                break;
            }
        }
        this.sendGameStateToAll();
    }
    checkRateLimit(socketId) {
        const now = Date.now();
        const lastAction = this.rateLimiter.get(socketId);
        if (lastAction && now - lastAction < this.RATE_LIMIT_MS) {
            return false;
        }
        this.rateLimiter.set(socketId, now);
        return true;
    }
    // general purpose method to call all clients
    sendGameStateToAll() {
        const gameState = this.gameEngine.getGameState();
        const message = {
            type: 'gameState',
            data: gameState
        };
        this.io.emit('gameState', message);
    }
    broadcastError(message) {
        const errorMessage = {
            type: 'error',
            data: { message }
        };
        this.io.emit('error', errorMessage);
    }
    shutdown() {
        this.playerSockets.clear();
        this.rateLimiter.clear();
        this.playerSessions.clear();
    }
    // Clean up old sessions (call this periodically)
    cleanupOldSessions() {
        const now = Date.now();
        const timeout = 5 * 60 * 1000; // 5 minutes
        for (const [persistentId, session] of this.playerSessions.entries()) {
            if (now - session.lastSeen > timeout) {
                this.playerSessions.delete(persistentId);
                this.gameEngine.removePlayer(persistentId);
                console.log(`Session timeout for player: ${persistentId}`);
            }
        }
    }
}
exports.NetworkManager = NetworkManager;
