# 📚 Autochess Simulator - Developer Guide

## 🎯 Panoramica

Autochess Simulator è un sistema deterministico per simulare battaglie tra squadre di unità con architettura modulare TypeScript.

## 🏗️ Architettura del Sistema

```
src/
├── core/                    # Motore di simulazione
│   ├── engine.ts          # Motore principale
│   ├── tick.ts           # Gestione tick
│   ├── movement.ts        # Sistema movimento
│   ├── pathfinding.ts     # Pathfinding semplice
│   ├── combat.ts         # Sistema combattimento
│   ├── target.ts         # Target finding
│   └── grid.ts           # Gestione griglia
├── entities/                # Entità del gioco
│   ├── unit.ts           # UnitTemplate e UnitInstance
│   ├── team.ts           # Team management
│   └── deck.ts           # Deck configuration
├── utils/                  # Utilità
│   ├── deterministic.ts   # RNG deterministico
│   └── grid.ts           # Grid utilities
├── cli/                    # Interfaccia linea comando
│   ├── runMatch.ts       # Esegui singolo match
│   ├── runBatch.ts       # Batch testing
│   ├── visualMatch.ts     # Visualizzazione terminale
│   ├── testSimulator.ts   # Test interno
│   └── debugTarget.ts     # Debug target system
└── web/                    # Interfaccia web
    ├── index.html         # UI completa
    ├── server.js          # WebSocket server
    └── package.json       # Dipendenze web
```

## 🎮 Core System

### SimulationEngine
Classe principale che orchestra le simulazioni:

```typescript
class SimulationEngine {
  // Configurazione
  config: SimulationConfig;
  
  // Metodi principali
  runMatch(deckA: Deck, deckB: Deck): MatchResult;
  getStartPosition(teamId: string, unitIndex: number): Position;
}
```

### Tick Processing
Ogni tick è diviso in fasi:

1. **Movement Phase**: Le unità si muovono
2. **Attack Phase**: Le unità attaccano
3. **Damage Phase**: I danni vengono applicati

```typescript
function processTick(tick: number, units: UnitInstance[], templates: Map<string, UnitTemplate>, grid: Grid): TickLog {
  // 1. Process movement
  processMovement(units, templates, grid);
  
  // 2. Process attacks
  const attacks = processAttacks(units, templates);
  
  // 3. Apply damage
  const deaths = applyDamage(attacks, units);
  
  return { tick, moves: [], attacks, deaths };
}
```

## 🏃 Movement System

### Pathfinding Semplice
Algoritmo greedy che si muove verso il nemico più vicino:

```typescript
class SimplePathfinder {
  // Trova il nemico più vicino
  findNearestEnemy(unit: UnitInstance, enemies: UnitInstance[]): UnitInstance;
  
  // Calcola la prossima posizione
  getNextPosition(current: Position, target: Position): Position;
  
  // Calcola distanza Manhattan
  getDistance(pos1: Position, pos2: Position): number;
}
```

### Regole Movimento
- **Max 1 tile** per attivazione
- **Cooldown**: Basato su template unità
- **Collision detection**: Una unità per tile
- **Boundary check**: Limite griglia rispettato

## ⚔️ Combat System

### Target Finding
Selezione deterministica dei bersagli:

```typescript
function findTargetInRange(unit: UnitInstance, enemies: UnitInstance[]): UnitInstance | null {
  // Filtra nemici nel range
  const targetsInRange = enemies.filter(enemy => {
    const distance = getDistance(unit.position, enemy.position);
    return distance <= unit.template.range;
  });
  
  // Ordina per distanza, poi per ID
  targetsInRange.sort((a, b) => {
    const distA = getDistance(unit.position, a.position);
    const distB = getDistance(unit.position, b.position);
    return distA - distB || a.id.localeCompare(b.id);
  });
  
  return targetsInRange[0] || null;
}
```

### Attack Resolution
Sistema simultaneo con cooldown:

```typescript
function processAttacks(units: UnitInstance[]): AttackAction[] {
  const attacks: AttackAction[] = [];
  
  for (const unit of units) {
    if (!unit.alive) continue;
    
    // Check cooldown
    if ((currentTick - unit.lastAttackTick) < unit.template.attackCooldown) {
      continue;
    }
    
    // Trova bersaglio
    const target = findTargetInRange(unit, getEnemies(unit));
    if (target) {
      attacks.push({
        attackerId: unit.id,
        targetId: target.id,
        damage: unit.template.damage
      });
      unit.lastAttackTick = currentTick;
    }
  }
  
  return attacks;
}
```

## 🎲 Unit System

### UnitTemplate
Definizione statica delle unità:

```typescript
interface UnitTemplate {
  id: string;              // ID univoco
  name: string;            // Nome visualizzato
  hp: number;              // Health points
  damage: number;           // Danno base
  range: number;           // Range attacco
  movementCooldown: number;  // Tick tra movimenti
  attackCooldown: number;    // Tick tra attacchi
  tags: string[];          // Tags per logica
}
```

### UnitInstance
Stato runtime di un'unità:

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
```

## 📋 Deck System

### Deck Configuration
Struttura deck per team composition:

```typescript
interface Deck {
  name: string;
  units: Array<{
    templateId: string;
    count: number;
  }>;
}

// Esempi:
const TURTLE_DECK: Deck = {
  name: 'turtle',
  units: [
    { templateId: 'tank', count: 3 },
    { templateId: 'ranged', count: 2 }
  ]
};
```

### Predefined Decks
- **Turtle**: 3 Tank + 2 Ranged (difensivo)
- **Aggro**: 4 Fast Melee + 1 Melee (offensivo)
- **Balanced**: 1 Tank + 2 Melee + 2 Ranged (equilibrato)

## 🎯 Grid System

### Grid Management
Sistema griglia per posizionamento e collisioni:

```typescript
class Grid {
  // Occupazione tile
  occupy(position: Position, unit: UnitInstance): void;
  
  // Liberazione tile
  vacate(position: Position): void;
  
  // Check occupazione
  isOccupied(position: Position): boolean;
  
  // Ottieni unità
  getUnitAt(position: Position): UnitInstance | null;
}
```

### Coordinate System
- **Origine**: (0,0) in alto a sinistra
- **Dimensioni**: Configurabili (default 12x6)
- **Indicizzazione**: `grid[y][x]`

## 🎲 Deterministic System

### RNG Deterministico
Generatore di numeri casuali riproducibile:

```typescript
class DeterministicRNG {
  private seed: number;
  
  // Linear Congruential Generator
  next(): number {
    this.seed = (this.seed * 1664525 + 1013904223) % Math.pow(2, 32);
    return this.seed / Math.pow(2, 32);
  }
  
  // Range utility
  nextInt(min: number, max: number): number;
  nextFloat(min: number, max: number): number;
  nextBoolean(probability: number = 0.5): boolean;
  
  // Shuffle deterministico
  shuffle<T>(array: T[]): T[];
}
```

### Utilità Deterministiche
- **deterministicSort**: Ordinamento consistente
- **deterministicHash**: Hash oggetti per debug

## 🖥️ CLI Commands

### Script Disponibili
```bash
# Esegui singolo match
npm run run-match -- --deckA turtle --deckB aggro

# Batch testing
npm run run-batch -- --matches 100 --decks turtle,aggro,balanced

# Visualizzazione terminale
npm run run-visual -- --deckA turtle --deckB aggro --speed 50

# Test simulator
npm run test-sim

# Debug target system
npm run debug-target
```

### Opzioni CLI
- `--deckA <name>`: Deck team A
- `--deckB <name>`: Deck team B
- `--maxTicks <num>`: Limite tick
- `--speed <ms>`: Velocità visualizzazione
- `--width <num>`: Larghezza griglia
- `--height <num>`: Altezza griglia

## 🌐 Web Interface

### Architettura Web
- **Frontend**: HTML5 + CSS3 + JavaScript ES6+
- **Backend**: Node.js + WebSocket
- **Styling**: CSS Grid + Flexbox + Animazioni

### API Web
```javascript
// Controlli simulazione
simulator.startSimulation();     // Inizia autoplay
simulator.pauseSimulation();     // Metti in pausa
simulator.stepSimulation();       // Singolo tick
simulator.resetSimulation();     // Reset completo

// Navigazione fasi
simulator.advancePhase();        // Avanza fase
simulator.previousPhase();       // Fase precedente

// Storia mosse
simulator.previousMove();        // Mossa precedente
simulator.nextMove();            // Mossa successiva

// Visualizzazione
simulator.zoomIn();             // Zoom in
simulator.zoomOut();            // Zoom out
simulator.centerView();         // Centra vista
```

### Controlli Tastiera
- **→ Freccia Destra**: Avanza fase
- **← Freccia Sinistra**: Fase precedente
- **↑ Freccia Su/Spazio**: Toggle autoplay
- **↓ Freccia Giù**: Reset simulazione

## 🗄️ Database Integration

### SQLite Schema
```sql
-- Match results
CREATE TABLE matches (
  id INTEGER PRIMARY KEY,
  deckA TEXT NOT NULL,
  deckB TEXT NOT NULL,
  winner TEXT,
  duration INTEGER,
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Unit statistics
CREATE TABLE unit_stats (
  id INTEGER PRIMARY KEY,
  match_id INTEGER,
  unit_id TEXT,
  team_id TEXT,
  damage_dealt INTEGER,
  damage_taken INTEGER,
  survived BOOLEAN,
  FOREIGN KEY (match_id) REFERENCES matches(id)
);
```

## 🧪 Testing System

### Test Automatizzati
```typescript
// Batch testing
function runBatchSimulation(matches: number, decks: string[]): BatchResults {
  const results: MatchResult[] = [];
  
  for (let i = 0; i < matches; i++) {
    const deckA = getRandomDeck(decks);
    const deckB = getRandomDeck(decks);
    
    const result = engine.runMatch(deckA, deckB);
    results.push(result);
  }
  
  return analyzeResults(results);
}
```

### Debug Tools
- **Debug Target**: Analisi target finding
- **Visual Match**: Step-by-step visualization
- **Test Simulator**: Batch analysis

## 🔧 Development Setup

### Installazione
```bash
# Clona repository
git clone <repo-url>
cd autochess

# Installa dipendenze
npm install

# Compila TypeScript
npm run build

# Esegui test
npm test
```

### Scripts Disponibili
```json
{
  "scripts": {
    "build": "tsc",
    "start": "node dist/index.js",
    "dev": "ts-node src/index.ts",
    "run-match": "ts-node src/cli/runMatch.ts",
    "run-batch": "ts-node src/cli/runBatch.ts",
    "run-visual": "ts-node src/cli/visualMatch.ts",
    "test-sim": "ts-node src/cli/testSimulator.ts",
    "debug-target": "ts-node src/cli/debugTarget.ts",
    "web": "cd web && npm start",
    "install-web": "cd web && npm install"
  }
}
```

## 🎯 Best Practices

### Code Organization
- **Modularità**: Ogni modulo ha responsabilità chiara
- **Type Safety**: TypeScript strict mode
- **Determinismo**: Nessuna casualità non controllata
- **Pure Functions**: Funzioni senza side effects

### Performance
- **O(1)** per operazioni griglia
- **Lazy evaluation** dove possibile
- **Memory efficient**: Pool objects quando necessario
- **No GC pressure**: Evita allocazioni massive

### Testing
- **Unit tests**: Per ogni modulo
- **Integration tests**: Per flussi completi
- **Deterministic tests**: Stesso seed = stesso risultato
- **Edge cases**: Boundary conditions

## 🐛 Debug Tips

### Common Issues
1. **Units don't move**: Check movement cooldown
2. **No attacks**: Check range and target finding
3. **Stalemates**: Check positioning logic
4. **Performance**: Profile tick processing

### Debug Tools
```typescript
// Enable debug logging
const DEBUG = true;

function debugLog(message: string) {
  if (DEBUG) console.log(`[DEBUG] ${message}`);
}

// State inspection
function printState(units: UnitInstance[], tick: number) {
  console.log(`Tick ${tick}:`);
  units.forEach(u => console.log(`  ${u.id}: (${u.position.x},${u.position.y}) HP:${u.currentHp}/${u.template.hp}`));
}
```

## 🚀 Deployment

### Production Build
```bash
# Build ottimizzato
npm run build

# Test produzione
npm run test:prod

# Package
npm run package
```

### Environment Variables
```bash
NODE_ENV=production
PORT=3000
GRID_WIDTH=12
GRID_HEIGHT=6
```

---

**🎮 Happy Coding!**

Questo sistema è progettato per essere estensibile, manutenibile e performante. Segui le best practices e contribuirai a un prodotto di qualità!
