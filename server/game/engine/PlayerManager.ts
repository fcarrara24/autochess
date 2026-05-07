import { PlayerSlot } from '../../../models';
import { Player } from '../../../models/Player';

export class PlayerManager {
  private players: Player[] = [];

  addPlayer(playerId: string, isReconnection: boolean = false): PlayerSlot | null {
    // Check for reconnection first
    const existingPlayer = this.players.find(p => p.id === playerId);
    if (existingPlayer) {
      if (isReconnection) {
        existingPlayer.isConnected = true;
        console.log(`Player ${playerId} reconnected successfully`);
      }
      return existingPlayer.slot;
    }

    // Check if game is full (only for new players)
    if (this.players.length >= 2) {
      return null;
    }

    const slot = this.players.length === 0 ? PlayerSlot.PLAYER_A : PlayerSlot.PLAYER_B;
    const player = new Player(playerId, slot);
    this.players.push(player);

    return slot;
  }

  removePlayer(playerId: string): void {
    const playerIndex = this.players.findIndex(p => p.id === playerId);
    if (playerIndex !== -1) {
      this.players[playerIndex].isConnected = false;
    }
  }

  markPlayerAsDisconnected(playerId: string): void {
    const playerIndex = this.players.findIndex(p => p.id === playerId);
    if (playerIndex !== -1) {
      this.players[playerIndex].isConnected = false;
    }
  }

  getPlayers(): Player[] {
    return this.players;
  }

  getPlayerById(playerId: string): Player | null {
    return this.players.find(p => p.id === playerId) || null;
  }

  areAllPlayersConnected(): boolean {
    return this.players.every(p => p.isConnected);
  }

  clear(): void {
    this.players = [];
  }
}
