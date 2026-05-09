import { Server as SocketIOServer, Socket } from 'socket.io';
import { GameEngine } from '../game/GameEngine';
import { ClientAction, ServerMessage, GamePhase, UnitType, PlayerSlot } from '../models';
import { IGrid } from '../models';

export class NetworkManager {
  private io: SocketIOServer;
  private gameEngine: GameEngine;
  private playerSockets: Map<string, Socket> = new Map();
  private rateLimiter: Map<string, number> = new Map();
  private playerSessions: Map<string, { socketId: string; lastSeen: number }> = new Map();
  private readonly RATE_LIMIT_MS = 100; // Max 10 actions per second per client

  // constructor
  constructor(io: SocketIOServer, gameEngine: GameEngine) {
    this.io = io;
    this.gameEngine = gameEngine;
    
    // Set up update callback to broadcast state changes
    this.gameEngine.setUpdateCallback(() => {
      this.sendGameStateToAll();
    });
    
    this.setupSocketHandlers();
  }

  // setup socket actions upon connection
  private setupSocketHandlers(): void {
    this.io.on('connection', (socket: Socket) => {
      console.log(`Player connected: ${socket.id}`);

      // Handle player joining with optional persistent ID and slot
      socket.on('joinGame', (data: { persistentId?: string, requestedSlot?: string }) => {
        this.handlePlayerJoin(socket, data?.persistentId, data?.requestedSlot);
      });

      // Handle client actions
      socket.on('playerAction', (action: ClientAction) => {
        this.handlePlayerAction(socket, action);
      });

      // Handle disconnection
      socket.on('disconnect', () => {
        this.handlePlayerDisconnect(socket);
      });
    });
  }

  private handlePlayerJoin(socket: Socket, persistentId?: string, requestedSlot?: string): void {
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
    let slotEnum: PlayerSlot | undefined = undefined;
    if (requestedSlot) {
      slotEnum = requestedSlot === 'A' ? PlayerSlot.PLAYER_A : requestedSlot === 'B' ? PlayerSlot.PLAYER_B : undefined;
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

  private handlePlayerAction(socket: Socket, action: ClientAction): void {
    // Rate limiting
    if (!this.checkRateLimit(socket.id)) {
      socket.emit('error', { message: 'Rate limit exceeded' });
      return;
    }

    // Only allow actions during placement phase
    const gameState = this.gameEngine.getGameState();
    if (gameState.phase !== GamePhase.PLACEMENT) {
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
      } else {
        socket.emit('error', { message: 'Invalid action' });
      }
    } catch (error) {
      console.error('Error handling player action:', error);
      socket.emit('error', { message: 'Server error' });
    }
  }

  private handlePlaceAction(socket: Socket, action: ClientAction): boolean {
    if (!action.unitType) return false;

    const gameState = this.gameEngine.getGameState();
    const player = gameState.players.find(p => p.id === socket.id);
    
    if (!player) return false;

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

  private handleMoveAction(socket: Socket, action: ClientAction): boolean {
    if (!action.unitId) return false;

    const gameState = this.gameEngine.getGameState();
    const player = gameState.players.find(p => p.id === socket.id);
    
    if (!player) return false;

    const unit = player.getUnit(action.unitId);
    if (!unit) return false;

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

  private handleRemoveAction(socket: Socket, action: ClientAction): boolean {
    if (!action.unitId) return false;

    const gameState = this.gameEngine.getGameState();
    const player = gameState.players.find(p => p.id === socket.id);
    
    if (!player) return false;

    const unit = player.getUnit(action.unitId);
    if (!unit) return false;

    // Remove the unit
    gameState.grid.removeUnit(unit.position);
    player.removeUnit(action.unitId);
    
    return true;
  }

  private handlePlayerDisconnect(socket: Socket): void {
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

  private checkRateLimit(socketId: string): boolean {
    const now = Date.now();
    const lastAction = this.rateLimiter.get(socketId);
    
    if (lastAction && now - lastAction < this.RATE_LIMIT_MS) {
      return false;
    }
    
    this.rateLimiter.set(socketId, now);
    return true;
  }
  // general purpose method to call all clients
  private sendGameStateToAll(): void {
    const gameState = this.gameEngine.getGameState();
    const message: ServerMessage = {
      type: 'gameState',
      data: gameState
    };
    
    this.io.emit('gameState', message);
  }

  public broadcastError(message: string): void {
    const errorMessage: ServerMessage = {
      type: 'error',
      data: { message }
    };
    
    this.io.emit('error', errorMessage);
  }

  public shutdown(): void {
    this.playerSockets.clear();
    this.rateLimiter.clear();
    this.playerSessions.clear();
  }
  
  // Clean up old sessions (call this periodically)
  public cleanupOldSessions(): void {
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
