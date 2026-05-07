import { Server as SocketIOServer, Socket } from 'socket.io';
import { ServerMessage } from '../../models';

export class SocketUtils {
  static sendGameStateToAll(io: SocketIOServer, gameState: any): void {
    const message: ServerMessage = {
      type: 'gameState',
      data: gameState
    };
    
    io.emit('gameState', message);
  }

  static broadcastError(io: SocketIOServer, message: string): void {
    const errorMessage: ServerMessage = {
      type: 'error',
      data: { message }
    };
    
    io.emit('error', errorMessage);
  }

  static setupSocketHandlers(
    io: SocketIOServer,
    playerHandlers: any,
    rateLimiter: Map<string, number>
  ): void {
    io.on('connection', (socket: Socket) => {
      console.log(`Player connected: ${socket.id}`);

      // Handle player joining with optional persistent ID
      socket.on('joinGame', (data: { persistentId?: string }) => {
        const playerSlot = playerHandlers.handlePlayerJoin(socket, data?.persistentId);
        
        if (playerSlot) {
          // Send player their slot and persistent ID
          socket.emit('playerSlot', { slot: playerSlot, persistentId: socket.id });
          console.log(`Player ${socket.id} assigned to slot ${playerSlot}`);
        }
      });

      // Handle client actions
      socket.on('playerAction', (action: any) => {
        playerHandlers.handlePlayerAction(socket, action, rateLimiter, 100);
      });

      // Handle disconnection
      socket.on('disconnect', () => {
        playerHandlers.handlePlayerDisconnect(socket);
      });
    });
  }
}
