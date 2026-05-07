import { Server as SocketIOServer, Socket } from 'socket.io';
import { GameEngine } from '../game/GameEngine';
import { ClientAction, ServerMessage, GamePhase, UnitType } from '../models';

export class NetworkManager {
  private io: SocketIOServer;
  private gameEngine: GameEngine;
  private playerSockets: Map<string, Socket> = new Map();
  private rateLimiter: Map<string, number> = new Map();
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

      // Handle player joining
      socket.on('joinGame', () => {
        this.handlePlayerJoin(socket);
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

  private handlePlayerJoin(socket: Socket): void {
    const playerSlot = this.gameEngine.addPlayer(socket.id);
    
    if (playerSlot === null) {
      // Game is full
      socket.emit('error', { message: 'Game is full' });
      socket.disconnect();
      return;
    }

    this.playerSockets.set(socket.id, socket);
    
    // Send initial game state
    this.sendGameStateToAll();
    
    // Send player their slot
    socket.emit('playerSlot', { slot: playerSlot });
    
    console.log(`Player ${socket.id} assigned to slot ${playerSlot}`);
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
    
    this.gameEngine.removePlayer(socket.id);
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
  }
}
