export enum UnitType {
  MELEE = 'melee',
  RANGED = 'ranged'
}


export enum UnitState {
  SEEK = 'SEEK',
  ENGAGED = 'ENGAGED',
  ATTACK = 'ATTACK',
  IDLE = 'IDLE'
}

export enum PlayerSlot {
  PLAYER_A = 'A',
  PLAYER_B = 'B'
}

export enum GamePhase {
  PLACEMENT = 'PLACEMENT',
  BATTLE = 'BATTLE'
}

export interface Position {
  x: number; // column 0-7
  y: number; // row 0-2
}

export interface UnitStats {
  hp: number;
  maxHp: number;
  damage: number;
  range: number; // Manhattan distance
}

export interface Unit {
  id: string;
  type: UnitType;
  owner: PlayerSlot;
  position: Position;
  originalPosition: Position; // for round reset
  stats: UnitStats;
  state: UnitState;
  targetId?: string;
  placementTimestamp: number;
}

// Player class is defined in Player.ts

export interface Grid {
  width: number; // 8
  height: number; // 3
  tiles: (Unit | null)[][];
}

export interface GameState {
  phase: GamePhase;
  players: import('./Player').Player[];
  grid: import('./Grid').Grid;
  currentRound: number;
  roundStartTime: number;
  placementTimeLimit: number; // 30 seconds
  battleTimeLimit: number; // 40 seconds
  tickCount: number;
  isPaused: boolean;
  roundWinner?: PlayerSlot;
  winner?: PlayerSlot;
  drawResult?: boolean;
}

export interface ClientAction {
  type: 'place' | 'move' | 'remove';
  unitId?: string;
  unitType?: UnitType;
  position: Position;
  timestamp: number;
}

export interface ServerMessage {
  type: 'gameState' | 'error' | 'actionResult';
  data: any;
}
