import { Server as SocketIOServer } from 'socket.io';
import { GameEngine } from '../game/GameEngine';
import { PlayerHandlers } from './handlers/PlayerHandlers';
import { SocketUtils } from './utils/SocketUtils';

export class NetworkManager {
  private io: SocketIOServer;
  private gameEngine: GameEngine;
  private playerHandlers: PlayerHandlers;
  private playerSockets: Map<string, any> = new Map();
  private playerSessions: Map<string, { socketId: string; lastSeen: number }> = new Map();
  private rateLimiter: Map<string, number> = new Map();
  private readonly RATE_LIMIT_MS = 100; // Max 10 actions per second per client

  constructor(io: SocketIOServer, gameEngine: GameEngine) {
    this.io = io;
    this.gameEngine = gameEngine;
    
    // Initialize handlers
    this.playerHandlers = new PlayerHandlers(
      gameEngine,
      this.playerSockets,
      this.playerSessions
    );
    
    // Set up update callback to broadcast state changes
    this.gameEngine.setUpdateCallback(() => {
      this.sendGameStateToAll();
    });
    
    this.setupSocketHandlers();
  }

  private setupSocketHandlers(): void {
    SocketUtils.setupSocketHandlers(this.io, this.playerHandlers, this.rateLimiter);
  }

  private sendGameStateToAll(): void {
    const gameState = this.gameEngine.getGameState();
    SocketUtils.sendGameStateToAll(this.io, gameState);
  }

  public broadcastError(message: string): void {
    SocketUtils.broadcastError(this.io, message);
  }

  public shutdown(): void {
    this.playerSockets.clear();
    this.rateLimiter.clear();
    this.playerSessions.clear();
  }
  
  public cleanupOldSessions(): void {
    this.playerHandlers.cleanupOldSessions();
  }
}
