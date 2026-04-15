# 📖 Autochess Simulator - API Reference

## 🎯 Core API

### SimulationEngine

```typescript
class SimulationEngine {
  constructor(config: SimulationConfig);
  
  // Esegui match completo
  runMatch(deckA: Deck, deckB: Deck): MatchResult;
  
  // Posizionamento iniziale unità
  getStartPosition(teamId: string, unitIndex: number): Position;
}
```

### SimulationConfig

```typescript
interface SimulationConfig {
  maxTicks: number;        // Massimo tick (default: 1000)
  gridSize: {              // Dimensioni griglia
    width: number;         // Larghezza (default: 12)
    height: number;        // Altezza (default: 6)
  };
  seed?: number;           // Seed RNG (default: 12345)
}
```

### MatchResult

```typescript
interface MatchResult {
  winner: 'teamA' | 'teamB' | 'draw';
  duration: number;        // Tick totali
  survivors: {            // Unità sopravvissute
    teamA: number;
    teamB: number;
  };
  logs: TickLog[];        // Log completo match
  statistics: {           // Statistiche dettagliate
    totalDamage: {
      teamA: number;
      teamB: number;
    };
    unitsKilled: {
      teamA: number;
      teamB: number;
    };
  };
}
```

## 🏃 Movement API

### SimplePathfinder

```typescript
class SimplePathfinder {
  // Trova nemico più vicino
  findNearestEnemy(unit: UnitInstance, enemies: UnitInstance[]): UnitInstance | null;
  
  // Calcola prossima posizione verso target
  getNextPosition(current: Position, target: Position): Position;
  
  // Distanza Manhattan
  getDistance(pos1: Position, pos2: Position): number;
}
```

### Movement Utilities

```typescript
// Processa movimento per tutte le unità
function processMovement(units: UnitInstance[], templates: Map<string, UnitTemplate>, grid: Grid): MoveAction[];

// Muovi singola unità
function tryMoveUnit(unit: UnitInstance, grid: Grid): MoveAction | null;

// Check se unità può muoversi
function canUnitMove(unit: UnitInstance, position: Position): boolean;
```

### MoveAction

```typescript
interface MoveAction {
  unitId: string;
  from: Position;
  to: Position;
  tick: number;
}
```

## ⚔️ Combat API

### Target Finding

```typescript
// Trova bersaglio nel range
function findTargetInRange(unit: UnitInstance, enemies: UnitInstance[]): UnitInstance | null;

// Filtra nemici nel range
function getEnemiesInRange(unit: UnitInstance, enemies: UnitInstance[]): UnitInstance[];

// Ordina bersagli per priorità
function sortTargets(unit: UnitInstance, targets: UnitInstance[]): UnitInstance[];
```

### Attack Processing

```typescript
// Processa attacchi per tutte le unità
function processAttacks(units: UnitInstance[], templates: Map<string, UnitTemplate>): AttackAction[];

// Applica danni dalle azioni
function applyDamage(attacks: AttackAction[], units: UnitInstance[]): DeathAction[];

// Check se unità può attaccare
function canUnitAttack(unit: UnitInstance): boolean;
```

### Combat Actions

```typescript
interface AttackAction {
  attackerId: string;
  targetId: string;
  damage: number;
  tick: number;
}

interface DeathAction {
  unitId: string;
  teamId: string;
  tick: number;
  cause: 'damage' | 'out_of_bounds';
}
```

## 🎲 Grid API

### Grid Class

```typescript
class Grid {
  constructor(width: number, height: number);
  
  // Occupazione tile
  occupy(position: Position, unit: UnitInstance): void;
  
  // Liberazione tile
  vacate(position: Position): void;
  
  // Check occupazione
  isOccupied(position: Position): boolean;
  
  // Ottieni unità a posizione
  getUnitAt(position: Position): UnitInstance | null;
  
  // Ottieni tutte le unità
  getAllUnits(): UnitInstance[];
  
  // Check bounds
  isValidPosition(position: Position): boolean;
}
```

### Position

```typescript
interface Position {
  x: number;
  y: number;
}

// Position utilities
function createPosition(x: number, y: number): Position;
function arePositionsEqual(pos1: Position, pos2: Position): boolean;
function isAdjacent(pos1: Position, pos2: Position): boolean;
```

## 🎲 Unit API

### UnitTemplate

```typescript
interface UnitTemplate {
  id: string;              // ID univoco
  name: string;            // Nome visualizzato
  hp: number;              // Health points
  damage: number;           // Danno per attacco
  range: number;           // Range attacco (tile)
  movementCooldown: number;  // Tick tra movimenti
  attackCooldown: number;    // Tick tra attacchi
  tags: string[];          // Tags per logica
}

// Template utilities
function createTemplate(config: Partial<UnitTemplate>): UnitTemplate;
function getTemplateById(id: string): UnitTemplate | null;
function validateTemplate(template: UnitTemplate): boolean;
```

### UnitInstance

```typescript
interface UnitInstance {
  id: string;              // ID univoco
  templateId: string;       // Riferimento template
  position: Position;        // Posizione attuale
  teamId: string;          // Team di appartenza
  currentHp: number;       // HP attuali
  lastMoveTick: number;    // Ultimo tick movimento
  lastAttackTick: number;  // Ultimo tick attacco
  alive: boolean;          // Stato vita/morte
}

// Unit utilities
function createUnit(templateId: string, teamId: string, position: Position): UnitInstance;
function isUnitAlive(unit: UnitInstance): boolean;
function getUnitEffectiveDamage(unit: UnitInstance): number;
function getUnitEffectiveRange(unit: UnitInstance): number;
```

## 📋 Deck API

### Deck Management

```typescript
interface Deck {
  name: string;
  units: Array<{
    templateId: string;
    count: number;
  }>;
}

class DeckFactory {
  // Crea deck da configurazione
  static create(name: string, units: Array<{ templateId: string; count: number }>): Deck;
  
  // Conta unità nel deck
  static getUnitCount(deck: Deck): number;
  
  // Validazione deck
  static validate(deck: Deck): boolean;
}
```

### Predefined Decks

```typescript
export const PREDEFINED_DECKS: Record<string, Deck> = {
  turtle: {
    name: 'turtle',
    units: [
      { templateId: 'tank', count: 3 },
      { templateId: 'ranged', count: 2 }
    ]
  },
  aggro: {
    name: 'aggro',
    units: [
      { templateId: 'fast_melee', count: 4 },
      { templateId: 'melee', count: 1 }
    ]
  },
  balanced: {
    name: 'balanced',
    units: [
      { templateId: 'tank', count: 1 },
      { templateId: 'melee', count: 2 },
      { templateId: 'ranged', count: 2 }
    ]
  }
};
```

## 🎲 Deterministic API

### RNG System

```typescript
class DeterministicRNG {
  constructor(seed: number = 12345);
  
  // Next random number [0,1)
  next(): number;
  
  // Integer range [min,max]
  nextInt(min: number, max: number): number;
  
  // Float range [min,max]
  nextFloat(min: number, max: number): number;
  
  // Boolean with probability
  nextBoolean(probability: number = 0.5): boolean;
  
  // Shuffle array
  shuffle<T>(array: T[]): T[];
  
  // Reset seed
  reset(seed?: number): void;
  
  // Get current seed
  getSeed(): number;
}
```

### Deterministic Utilities

```typescript
// Ordinamento consistente
function deterministicSort<T>(array: T[], keyFn?: (item: T) => string): T[];

// Hash oggetti
function deterministicHash(obj: any): string;

// Confronto posizioni
function comparePositions(pos1: Position, pos2: Position): number;

// Ordinamento unità
function sortUnitsDeterministically(units: UnitInstance[]): UnitInstance[];
```

## 🖥️ CLI API

### Command Line Interface

```typescript
// Parse arguments
function parseArguments(): CliOptions;

// Esegui match con opzioni
function runMatch(options: CliOptions): void;

// Esegui batch test
function runBatch(options: CliOptions): void;

// Visualizzazione match
function runVisualMatch(options: CliOptions): void;
```

### CLI Options

```typescript
interface CliOptions {
  deckA: string;           // Deck team A
  deckB: string;           // Deck team B
  maxTicks: number;         // Massimo tick
  speed: number;            // Velocità visualizzazione
  gridSize: {              // Dimensioni griglia
    width: number;
    height: number;
  };
  help: boolean;           // Show help
}
```

## 🌐 Web API

### Simulator Class

```typescript
class AutochessSimulator {
  // Inizializzazione
  constructor();
  
  // Controllo simulazione
  startSimulation(): void;
  pauseSimulation(): void;
  stepSimulation(): void;
  resetSimulation(): void;
  
  // Navigazione fasi
  advancePhase(): void;
  previousPhase(): void;
  
  // Storia mosse
  previousMove(): void;
  nextMove(): void;
  saveState(): void;
  restoreState(index: number): void;
  
  // Visualizzazione
  renderGrid(): void;
  updateDisplay(): void;
  zoomIn(): void;
  zoomOut(): void;
  centerView(): void;
  
  // Autoplay
  toggleAutoplay(): void;
  startAutoplay(): void;
  stopAutoplay(): void;
}
```

### Web Controls

```javascript
// Global functions
function startSimulation() { simulator.startSimulation(); }
function pauseSimulation() { simulator.pauseSimulation(); }
function stepSimulation() { simulator.stepSimulation(); }
function resetSimulation() { simulator.resetSimulation(); }
function previousMove() { simulator.previousMove(); }
function nextMove() { simulator.nextMove(); }
function populateSquad() { simulator.populateWithSquad(); }

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
  switch(e.key) {
    case 'ArrowRight': simulator.advancePhase(); break;
    case 'ArrowLeft': simulator.previousPhase(); break;
    case 'ArrowUp':
    case ' ': simulator.toggleAutoplay(); break;
    case 'ArrowDown': simulator.resetSimulation(); break;
  }
});
```

## 🗄️ Database API

### SQLite Operations

```typescript
// Match results
async function saveMatch(result: MatchResult): Promise<number>;
async function getMatch(id: number): Promise<MatchResult | null>;
async function getMatches(limit?: number): Promise<MatchResult[]>;

// Statistics
async function getStatistics(deckA?: string, deckB?: string): Promise<MatchStatistics>;
async function saveUnitStats(matchId: number, units: UnitInstance[]): Promise<void>;

// Database utilities
async function initializeDatabase(): Promise<void>;
async function clearDatabase(): Promise<void>;
```

## 🧪 Testing API

### Test Framework

```typescript
// Unit testing
function testMovement(): TestResult;
function testCombat(): TestResult;
function testGrid(): TestResult;

// Integration testing
function testCompleteMatch(deckA: Deck, deckB: Deck): TestResult;

// Batch testing
function runBatchSimulation(config: BatchConfig): BatchResults;

// Debug utilities
function debugTargetFinding(units: UnitInstance[]): void;
function debugMovement(units: UnitInstance[]): void;
function debugCombat(units: UnitInstance[]): void;
```

### Test Configuration

```typescript
interface BatchConfig {
  matches: number;
  decks: string[];
  maxTicks: number;
  outputFormat: 'console' | 'json' | 'csv';
}

interface TestResult {
  passed: boolean;
  message: string;
  details?: any;
}
```

## 🔧 Utility API

### Common Utilities

```typescript
// Position utilities
function clampPosition(pos: Position, bounds: {width: number, height: number}): Position;
function distanceManhattan(pos1: Position, pos2: Position): number;

// Array utilities
function shuffleArray<T>(array: T[], rng: DeterministicRNG): T[];
function groupBy<T, K>(array: T[], keyFn: (item: T) => K): Map<K, T[]>;

// Validation utilities
function validatePosition(pos: Position, grid: Grid): boolean;
function validateUnit(unit: UnitInstance): boolean;
function validateDeck(deck: Deck): boolean;

// Logging utilities
function createLogger(level: 'debug' | 'info' | 'warn' | 'error'): Logger;
function logTick(tick: number, actions: any[]): void;
```

## 📊 Event System

### Event Types

```typescript
interface GameEvent {
  type: 'movement' | 'attack' | 'death' | 'victory';
  tick: number;
  data: any;
}

// Event listeners
function addEventListener(eventType: string, callback: (event: GameEvent) => void): void;
function removeEventListener(eventType: string, callback: (event: GameEvent) => void): void;
function emitEvent(event: GameEvent): void;
```

---

**🎮 Happy Coding!**

Questa API reference copre tutte le funzionalità del sistema. Usa questi metodi per estendere o integrare il simulatore!
