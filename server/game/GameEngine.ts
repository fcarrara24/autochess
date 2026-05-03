import { GameState, GamePhase, PlayerSlot, UnitType } from '../models';
import { Grid, Player, UnitController } from '../models';

export class GameEngine {
  private gameState: GameState;
  private gameLoopInterval: NodeJS.Timeout | null = null;
  private readonly TICK_RATE = 200; // 5 ticks per second
  private readonly PLACEMENT_TIME = 30000; // 30 seconds
  private readonly BATTLE_TIME = 40000; // 40 seconds

  constructor() {
    this.gameState = this.initializeGame();
  }

  private initializeGame(): GameState {
    const grid = new Grid();
    return {
      phase: GamePhase.PLACEMENT,
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

  public getGameState(): GameState {
    return { ...this.gameState };
  }

  public addPlayer(playerId: string): PlayerSlot | null {
    if (this.gameState.players.length >= 2) {
      return null;
    }

    const existingPlayer = this.gameState.players.find(p => p.id === playerId);
    if (existingPlayer) {
      return existingPlayer.slot;
    }

    const slot = this.gameState.players.length === 0 ? PlayerSlot.PLAYER_A : PlayerSlot.PLAYER_B;
    const player = new Player(playerId, slot);
    this.gameState.players.push(player);

    if (this.gameState.players.length === 2) {
      this.startPlacementPhase();
    }

    return slot;
  }

  public removePlayer(playerId: string): void {
    const playerIndex = this.gameState.players.findIndex(p => p.id === playerId);
    if (playerIndex !== -1) {
      this.gameState.players[playerIndex].isConnected = false;
      this.pauseGame();
    }
  }

  public reconnectPlayer(playerId: string): boolean {
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

  private startPlacementPhase(): void {
    this.gameState.phase = GamePhase.PLACEMENT;
    this.gameState.roundStartTime = Date.now();
    this.gameState.isPaused = false;
    
    // Clear any existing game loop
    if (this.gameLoopInterval) {
      clearInterval(this.gameLoopInterval);
      this.gameLoopInterval = null;
    }

    // Start placement timer
    setTimeout(() => {
      if (this.gameState.phase === GamePhase.PLACEMENT) {
        this.startBattlePhase();
      }
    }, this.PLACEMENT_TIME);
  }

  private startBattlePhase(): void {
    this.gameState.phase = GamePhase.BATTLE;
    this.gameState.roundStartTime = Date.now();
    this.gameState.tickCount = 0;

    // Start game loop
    this.gameLoopInterval = setInterval(() => {
      this.gameTick();
    }, this.TICK_RATE);

    // Battle timeout
    setTimeout(() => {
      if (this.gameState.phase === GamePhase.BATTLE) {
        this.endRound();
      }
    }, this.BATTLE_TIME);
  }

  private gameTick(): void {
    if (this.gameState.isPaused || this.gameState.phase !== GamePhase.BATTLE) {
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

  private processMovementPhase(): void {
    const allUnits = this.getAllAliveUnits();
    
    // Sort units by placement timestamp and player priority
    allUnits.sort((a, b) => {
      if (a.placementTimestamp !== b.placementTimestamp) {
        return a.placementTimestamp - b.placementTimestamp;
      }
      return a.owner === PlayerSlot.PLAYER_A ? -1 : 1;
    });

    // Process movement for each unit
    for (const unit of allUnits) {
      UnitController.updateUnitState(unit, this.gameState.grid, allUnits);
      
      if (unit.state === 'SEEK' || unit.state === 'ENGAGED') {
        this.moveUnit(unit);
      }
    }
  }

  private moveUnit(unit: import('../models/types').Unit): void {
    const validMoves = UnitController.getValidMovePositions(unit, this.gameState.grid);
    
    if (validMoves.length === 0) {
      return;
    }

    let targetPosition: import('../models/types').Position | null = null;

    if (unit.state === 'SEEK') {
      // Move forward toward enemy side
      const forwardDirection = unit.owner === PlayerSlot.PLAYER_A ? 1 : -1;
      const forwardPositions = validMoves.filter(pos => 
        pos.x === unit.position.x + forwardDirection
      );
      
      if (forwardPositions.length > 0) {
        targetPosition = forwardPositions[0];
      } else {
        // Try diagonal forward positions
        const diagonalPositions = validMoves.filter(pos => 
          pos.x === unit.position.x + forwardDirection
        );
        if (diagonalPositions.length > 0) {
          targetPosition = diagonalPositions[0];
        }
      }
    } else if (unit.state === 'ENGAGED') {
      // Move diagonally toward target enemy
      const target = unit.targetId ? this.getAllAliveUnits().find(u => u.id === unit.targetId) : null;
      if (target) {
        const dx = Math.sign(target.position.x - unit.position.x);
        const dy = Math.sign(target.position.y - unit.position.y);
        
        const diagonalPos = validMoves.find(pos => 
          pos.x === unit.position.x + dx && pos.y === unit.position.y + dy
        );
        
        if (diagonalPos) {
          targetPosition = diagonalPos;
        }
      }
    }

    if (targetPosition) {
      this.gameState.grid.moveUnit(unit.position, targetPosition);
    }
  }

  private processAttackPhase(): void {
    const allUnits = this.getAllAliveUnits();
    
    // All attacks happen simultaneously
    const attacks: { attacker: import('../models/types').Unit; defender: import('../models/types').Unit; damage: number }[] = [];
    
    for (const unit of allUnits) {
      UnitController.updateUnitState(unit, this.gameState.grid, allUnits);
      
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

  private processDeathResolution(): void {
    const allUnits = this.getAllUnits();
    
    for (const unit of allUnits) {
      if (unit.stats.hp <= 0) {
        this.gameState.grid.removeUnit(unit.position);
      }
    }
  }

  private checkRoundEnd(): boolean {
    const playerAUnits = this.getAllAliveUnits().filter(u => u.owner === PlayerSlot.PLAYER_A);
    const playerBUnits = this.getAllAliveUnits().filter(u => u.owner === PlayerSlot.PLAYER_B);
    
    return playerAUnits.length === 0 || playerBUnits.length === 0;
  }

  private endRound(): void {
    if (this.gameLoopInterval) {
      clearInterval(this.gameLoopInterval);
      this.gameLoopInterval = null;
    }

    const playerAUnits = this.getAllAliveUnits().filter(u => u.owner === PlayerSlot.PLAYER_A);
    const playerBUnits = this.getAllAliveUnits().filter(u => u.owner === PlayerSlot.PLAYER_B);

    // Award points
    if (playerAUnits.length > 0 && playerBUnits.length === 0) {
      const playerA = this.gameState.players.find(p => p.slot === PlayerSlot.PLAYER_A);
      if (playerA) playerA.incrementScore();
    } else if (playerBUnits.length > 0 && playerAUnits.length === 0) {
      const playerB = this.gameState.players.find(p => p.slot === PlayerSlot.PLAYER_B);
      if (playerB) playerB.incrementScore();
    }

    // Check for match winner
    const playerA = this.gameState.players.find(p => p.slot === PlayerSlot.PLAYER_A);
    const playerB = this.gameState.players.find(p => p.slot === PlayerSlot.PLAYER_B);

    if (playerA && playerA.score >= 3) {
      this.gameState.winner = PlayerSlot.PLAYER_A;
      return;
    }
    if (playerB && playerB.score >= 3) {
      this.gameState.winner = PlayerSlot.PLAYER_B;
      return;
    }

    // Start new round
    this.startNewRound();
  }

  private startNewRound(): void {
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

  private getAllUnits(): import('../models/types').Unit[] {
    return this.gameState.players.flatMap(p => p.units);
  }

  private getAllAliveUnits(): import('../models/types').Unit[] {
    return this.getAllUnits().filter(u => u.stats.hp > 0);
  }

  private pauseGame(): void {
    this.gameState.isPaused = true;
  }

  private resumeGame(): void {
    this.gameState.isPaused = false;
  }

  public shutdown(): void {
    if (this.gameLoopInterval) {
      clearInterval(this.gameLoopInterval);
      this.gameLoopInterval = null;
    }
  }
}
