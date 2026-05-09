import { Socket } from 'socket.io';
import { GameEngine } from '../../game/GameEngine';
import { ClientAction, GamePhase, PlayerSlot } from '../../models';

export class PlayerHandlers {
  constructor(
    private gameEngine: GameEngine,
    private playerSockets: Map<string, Socket>,
    private playerSessions: Map<string, { socketId: string; lastSeen: number }>
  ) {}

  handlePlayerJoin(socket: Socket, persistentId?: string, requestedSlot?: string): string | null {
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
      return null;
    }

    this.playerSockets.set(socket.id, socket);
    this.playerSessions.set(playerId, { socketId: socket.id, lastSeen: Date.now() });
    
    return playerSlot;
  }

  handlePlayerDisconnect(socket: Socket): void {
    console.log(`Player disconnected: ${socket.id}`);
    this.playerSockets.delete(socket.id);
    
    // Update session last seen time but don't remove player immediately
    for (const [persistentId, session] of this.playerSessions.entries()) {
      if (session.socketId === socket.id) {
        session.lastSeen = Date.now();
        // Mark player as disconnected but keep in game for reconnection
        this.gameEngine.markPlayerAsDisconnected(persistentId);
        break;
      }
    }
  }

  handlePlayerAction(socket: Socket, action: ClientAction, rateLimiter: Map<string, number>, RATE_LIMIT_MS: number): boolean {
    // Rate limiting
    if (!this.checkRateLimit(socket.id, rateLimiter, RATE_LIMIT_MS)) {
      socket.emit('error', { message: 'Rate limit exceeded' });
      return false;
    }

    // Only allow actions during placement phase
    const gameState = this.gameEngine.getGameState();
    if (gameState.phase !== GamePhase.PLACEMENT) {
      socket.emit('error', { message: 'Cannot perform actions during battle phase' });
      return false;
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

      if (!success) {
        socket.emit('error', { message: 'Invalid action' });
      }

      return success;
    } catch (error) {
      console.error('Error handling player action:', error);
      socket.emit('error', { message: 'Server error' });
      return false;
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

  private checkRateLimit(socketId: string, rateLimiter: Map<string, number>, RATE_LIMIT_MS: number): boolean {
    const now = Date.now();
    const lastAction = rateLimiter.get(socketId);
    
    if (lastAction && now - lastAction < RATE_LIMIT_MS) {
      return false;
    }
    
    rateLimiter.set(socketId, now);
    return true;
  }

  cleanupOldSessions(): void {
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
