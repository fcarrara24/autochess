import { GameState, GamePhase, PlayerSlot, UnitType, Unit, Position, Grid } from '../models';
import { IGrid, Player, UnitController } from '../models';

export class GameEngine {
  private gameState: GameState;
  private gameLoopInterval: NodeJS.Timeout | null = null;
  private updateCallback?: () => void;
  private readonly TICK_RATE = 1000; // 1 tick per second
  private readonly PLACEMENT_TIME = 20000; // 20 seconds
  private readonly BATTLE_TIME = 10000; // 10 seconds

  constructor() {
    this.gameState = this.initializeGame();
  }
  
  public setUpdateCallback(callback: () => void): void {
    this.updateCallback = callback;
  }
  
  private notifyUpdate(): void {
    if (this.updateCallback) {
      this.updateCallback();
    }
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
      isPaused: false,
      totalGames: 0,
      maxGames: 6
    };
  }

  public getGameState(): GameState {
    return { ...this.gameState };
  }

  public addPlayer(playerId: string, isReconnection: boolean = false): PlayerSlot | null {
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

    // Check if game is full (only for new players)
    if (this.gameState.players.length >= 2) {
      return null;
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
  
  public markPlayerAsDisconnected(playerId: string): void {
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
      
      // Check if we can resume the game or start placement timer
      const connectedPlayers = this.gameState.players.filter(p => p.isConnected);
      if (connectedPlayers.length === 2) {
        if (this.gameState.isPaused) {
          this.resumeGame();
        } else if (this.gameState.phase === GamePhase.PLACEMENT && !this.gameState.roundStartTime) {
          // Both players connected and placement timer hasn't started yet
          this.checkAndStartPlacementTimer();
        }
      }
      
      return true;
    }
    return false;
  }

  private startPlacementPhase(): void {
    this.gameState.phase = GamePhase.PLACEMENT;
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
  
  private checkAndStartPlacementTimer(): void {
    const connectedPlayers = this.gameState.players.filter(p => p.isConnected);
    
    if (connectedPlayers.length === 2) {
      // Both players are connected, start the timer
      this.gameState.roundStartTime = Date.now();
      
      // Start placement timer
      setTimeout(() => {
        if (this.gameState.phase === GamePhase.PLACEMENT) {
          this.startBattlePhase();
        }
      }, this.PLACEMENT_TIME);
    } else {
      // Wait a bit and check again
      setTimeout(() => {
        if (this.gameState.phase === GamePhase.PLACEMENT) {
          this.checkAndStartPlacementTimer();
        }
      }, 1000);
    }
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
    
    // Notify listeners of phase change
    this.notifyUpdate();
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
    
    // Notify listeners of state change
    this.notifyUpdate();
    
    // Check for round end
    if (this.checkRoundEnd()) {
      this.endRound();
    }
  }

  private processMovementPhase(): void {
    const allUnits = this.getAllAliveUnits();
    console.log(`Processing movement for ${allUnits.length} units`);
    
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
        const oldPos = { ...unit.position };
        this.moveUnit(unit);
        
        // Log if unit actually moved
        if (oldPos.x !== unit.position.x || oldPos.y !== unit.position.y) {
          console.log(`Unit ${unit.owner} ${unit.type} moved from (${oldPos.x},${oldPos.y}) to (${unit.position.x},${unit.position.y})`);
        }
      }
    }
  }

  private moveUnit(unit: Unit): void {
    const validMoves = UnitController.getValidMovePositions(unit, this.gameState.grid);
    console.log(`Unit ${unit.owner} ${unit.type} at (${unit.position.x},${unit.position.y}) has ${validMoves.length} valid moves:`, validMoves);
    
    if (validMoves.length === 0) {
      return;
    }

    let targetPosition: Position | null = null;

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
          const diagonalPos = towardPositions.find(pos => 
            Math.sign(pos.x - unit.position.x) === dx && Math.sign(pos.y - unit.position.y) === dy
          );
          targetPosition = diagonalPos || towardPositions[0];
        } else {
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
    } else if (unit.state === 'ENGAGED') {
      // Move diagonally toward target enemy
      const target = unit.targetId ? this.getAllAliveUnits().find(u => u.id === unit.targetId) : null;
      console.log(`ENGAGED mode - target:`, target ? `at (${target.position.x},${target.position.y})` : 'not found');
      if (target) {
        const dx = Math.sign(target.position.x - unit.position.x);
        const dy = Math.sign(target.position.y - unit.position.y);
        
        console.log(`Direction to target: dx=${dx}, dy=${dy}`);
        
        const diagonalPos = validMoves.find(pos => 
          pos.x === unit.position.x + dx && pos.y === unit.position.y + dy
        );
        
        console.log(`Diagonal position found:`, diagonalPos);
        
        if (diagonalPos) {
          targetPosition = diagonalPos;
        }
      }
    }

    if (targetPosition) {
      console.log(`Moving unit to (${targetPosition.x},${targetPosition.y})`);
      this.gameState.grid.moveUnit(unit.position, targetPosition);
    } else {
      console.log(`No valid target position found for unit ${unit.owner} ${unit.type}`);
    }
  }

  private processAttackPhase(): void {
    const allUnits = this.getAllAliveUnits();
    console.log(`Processing attacks for ${allUnits.length} units`);
    
    // All attacks happen simultaneously
    const attacks: { attacker: Unit; defender: Unit; damage: number }[] = [];
    
    for (const unit of allUnits) {
      UnitController.updateUnitState(unit, this.gameState.grid, allUnits);
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
        } else {
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

    let roundWinner: PlayerSlot | undefined = undefined;
    let isDraw = false;
    
    // Increment total games played
    this.gameState.totalGames++;
    
    // Check for draw (both units dead or timeout)
    if (playerAUnits.length === 0 && playerBUnits.length === 0) {
      isDraw = true;
      console.log('Round ended in a draw - both players have no units');
    } else if (this.gameState.tickCount >= (this.BATTLE_TIME / this.TICK_RATE)) {
      // Timeout reached - check who has more units
      if (playerAUnits.length === playerBUnits.length) {
        isDraw = true;
        console.log('Round ended in a draw - timeout with equal units');
      }
    }
    
    // Award points and determine round winner (if not draw)
    if (!isDraw) {
      if (playerAUnits.length > 0 && playerBUnits.length === 0) {
        const playerA = this.gameState.players.find(p => p.slot === PlayerSlot.PLAYER_A);
        if (playerA) {
          playerA.incrementScore();
          roundWinner = PlayerSlot.PLAYER_A;
        }
      } else if (playerBUnits.length > 0 && playerAUnits.length === 0) {
        const playerB = this.gameState.players.find(p => p.slot === PlayerSlot.PLAYER_B);
        if (playerB) {
          playerB.incrementScore();
          roundWinner = PlayerSlot.PLAYER_B;
        }
      }
    }
    
    // Set round result in game state
    this.gameState.roundWinner = roundWinner;
    this.gameState.drawResult = isDraw;
    
    // Notify listeners of round end
    this.notifyUpdate();

    // Check for absolute winner (3 wins or max games reached)
    const playerA = this.gameState.players.find(p => p.slot === PlayerSlot.PLAYER_A);
    const playerB = this.gameState.players.find(p => p.slot === PlayerSlot.PLAYER_B);

    let absoluteWinner: PlayerSlot | undefined = undefined;
    let matchEnded = false;
    
    if (playerA && playerA.score >= 3) {
      absoluteWinner = PlayerSlot.PLAYER_A;
      matchEnded = true;
      console.log('Player A wins the match with 3 victories!');
    } else if (playerB && playerB.score >= 3) {
      absoluteWinner = PlayerSlot.PLAYER_B;
      matchEnded = true;
      console.log('Player B wins the match with 3 victories!');
    } else if (this.gameState.totalGames >= this.gameState.maxGames) {
      // Max games reached, check who has more points
      matchEnded = true; // Match ends regardless of winner
      if (playerA && playerB) {
        if (playerA.score > playerB.score) {
          absoluteWinner = PlayerSlot.PLAYER_A;
          console.log(`Player A wins the match on points (${playerA.score} vs ${playerB.score})!`);
        } else if (playerB.score > playerA.score) {
          absoluteWinner = PlayerSlot.PLAYER_B;
          console.log(`Player B wins the match on points (${playerB.score} vs ${playerA.score})!`);
        } else {
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

  private getAllUnits(): Unit[] {
    return this.gameState.players.flatMap(p => p.units);
  }

  private getAllAliveUnits(): Unit[] {
    return this.getAllUnits().filter(u => u.stats.hp > 0);
  }

  private pauseGame(): void {
    this.gameState.isPaused = true;
  }

  private resumeGame(): void {
    if (this.gameState.isPaused && this.gameState.players.every(p => p.isConnected)) {
      this.gameState.isPaused = false;
      console.log('Game resumed - all players connected');
    }
  }

  public shutdown(): void {
    if (this.gameLoopInterval) {
      clearInterval(this.gameLoopInterval);
      this.gameLoopInterval = null;
    }
  }
}
