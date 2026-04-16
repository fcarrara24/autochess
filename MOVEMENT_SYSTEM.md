# # Sistema di Movimento Autochess - Guida Completa

## # Panoramica

Il sistema di movimento di Autochess è basato su un **motore deterministico** che combina **pathfinding intelligente**, **stati finiti delle unità**, e **regole di engagement** precise per creare battaglie strategiche e prevedibili.

## # Stati delle Unità

### # Stati Principali

```
IDLE     -> Unità in attesa, cerca bersagli
ENGAGED  -> Unità ha target fisso, si muove verso di esso  
FIGHTING -> Unità in range di attacco, interrompe movimento
```

### # Transizioni di Stato

```
[IDLE] --(trova nemico)--> [ENGAGED] --(in range)--> [FIGHTING]
  ^                                                      |
  |                                                      v
  +---------(nemico muore)-------[IDLE] <----(fuori range)----+
```

## # Griglia di Movimento (12x6)

### # Layout Standard

```
   0 1 2 3 4 5 6 7 8 9 10 11   <-- Coordinate X
  +------------------------+
0 | . . . . . . . . . . . . |
1 | . . . . . . . . . . . . |
2 | T T T . . . . . . f f f |   <-- Team A (T) vs Team B (f)
3 | . R . . . . . . . m . . |
4 | . . . . . . . . . f . . |
5 | T T T . . . . . . m m m |
  +------------------------+
  ^                         ^
  Y=0                       Y=5   <-- Coordinate Y
```

### # Zone di Attivazione

```
   0 1 2 3 4 5 6 7 8 9 10 11
  +------------------------+
0 | S S S S S S S S S S S S |  <-- Zone Seek (movimento esplorativo)
1 | S S S S S S S S S S S S |
2 | T E E E E E E E E E E f |  <-- Team A (T), Engagement (E), Team B (f)
3 | . E E E E E E E E E E . |
4 | . E E E E E E E E E E f |
5 | T E E E E E E E E E m m |  <-- Movement prioritario verso centro
  +------------------------+
```

## # Algoritmo di Movimento

### # 1. Fase di Target Selection

```typescript
// Se unità ha target fisso (ENGAGED/FIGHTING)
if (unit.targetId && unit.state !== 'idle') {
  const targetPos = findTargetPosition(unit, enemyPositions);
  // Usa pathfinding verso target specifico
} else {
  // Trova nemico più vicino (IDLE -> ENGAGED)
  const nearestEnemy = findNearestEnemy(unit.position, enemyPositions);
  if (nearestEnemy) {
    unit.targetId = nearestEnemy.id;
    unit.state = 'engaged';
    unit.lastTargetChangeTick = currentTick;
  }
}
```

### # 2. Fase di Pathfinding

#### # Schema Priorità Direzionale (Deterministico)

```
Per ogni unità (U), le direzioni sono prioritarie così:

    |2|1|3    1 = Avanti (priorità massima)
    |4|U|5    2 = Sinistra-alto, 3 = Destra-alto  
    |7|6|8    4 = Sinistra, 5 = Destra
             6 = Sinistra-basso, 7 = Dietro-sinistra
             8 = Dietro, 9 = Dietro-destra
```

#### # Algoritmo di Selezione

```typescript
function selectBestNeighbor(neighbors: Position[], target: Position): Position {
  // 1. Ordina per distanza Manhattan minima
  // 2. A parità di distanza, usa schema priorità:
  //    - Avanti > Sinistra > Destra > Indietro
  // 3. Se ancora pari, ordinamento lessicale coordinate
}
```

### # 3. Fase di Esecuzione Movimento

```typescript
// 1. Controlla cooldown movimento
if ((currentTick - unit.lastMoveTick) >= template.movementCooldown) {
  
  // 2. Prova movimento verso target (pathfinding)
  const nextMove = findNextMove(unit.position, targetPos, grid);
  
  // 3. Verifica validità posizione
  if (nextMove && isValidPosition(nextMove) && !isOccupied(nextMove)) {
    // 4. Esegui movimento
    grid.moveUnit(unit.position, nextMove, unit);
    unit.position = nextMove;
    unit.lastMoveTick = currentTick;
  }
}
```

## # Regole di Engagement

### # Range di Attacco per Tipo Unità

```
Tank:      Range = 1 (melee)
Melee:     Range = 1 (melee)  
Fast_Melee: Range = 1 (melee)
Ranged:    Range = 4 (distanza)
```

### # Regole di Transizione Stati

```typescript
// IDLE -> ENGAGED
if (unit.state === 'idle' && enemiesInRange.length > 0) {
  unit.state = 'engaged';
  unit.targetId = selectBestTarget(enemiesInRange);
}

// ENGAGED -> FIGHTING  
if (unit.state === 'engaged' && distanceToTarget <= unit.range) {
  unit.state = 'fighting';
  // Interrompe movimento, inizia attacchi
}

// FIGHTING -> ENGAGED
if (unit.state === 'fighting' && distanceToTarget > unit.range) {
  unit.state = 'engaged';
  // Riprende movimento verso target
}

// ENGAGED/FIGHTING -> IDLE
if (unit.targetId && !isTargetAlive(unit.targetId)) {
  unit.state = 'idle';
  unit.targetId = null;
  // Cerca nuovo target
}
```

## # Esempio Flusso Completo

### # Scenario Iniziale

```
Tick 0: Team A (sinistra) vs Team B (destra)

   0 1 2 3 4 5 6 7 8 9 10 11
  +------------------------+
0 | T . . . . . . . . . . f |  T= Tank A, f= Fast_Melee B
1 | . . . . . . . . . . . . |
2 | R . . . . . . . . . . m |  R= Ranged A, m= Melee B  
3 | . . . . . . . . . . . . |
4 | . . . . . . . . . . . . |
5 | T . . . . . . . . . . . |
  +------------------------+
```

### # Tick 1-3: Fase IDLE -> ENGAGED

```
Unità Tank (0,0) trova nemico più vicino: Fast_Melee (11,0)
- Distance: 11 (> range 1)
- Stato: IDLE -> ENGAGED  
- Target: unit_5 (Fast_Melee)
- Movimento: (0,0) -> (1,0)

Unità Ranged (0,2) trova nemico più vicino: Melee (11,2)  
- Distance: 11 (> range 4)
- Stato: IDLE -> ENGAGED
- Target: unit_6 (Melee)
- Movimento: (0,2) -> (1,2)
```

### # Tick 4-6: Avvicinamento Progressivo

```
   0 1 2 3 4 5 6 7 8 9 10 11
  +------------------------+
0 | . T . . . . . . . . f . |
1 | . . . . . . . . . . . . |
2 | . R . . . . . . . . m . |
3 | . . . . . . . . . . . . |
4 | . . . . . . . . . . . . |
5 | T . . . . . . . . . . . |
  +------------------------+

Tank: (1,0) -> (2,0) [distance: 9]
Ranged: (1,2) -> (2,2) [distance: 9]  
Fast_Melee: (11,0) -> (10,0) [distance: 7]
Melee: (11,2) -> (10,2) [distance: 7]
```

### # Tick 7-9: First Engagement

```
   0 1 2 3 4 5 6 7 8 9 10 11
  +------------------------+
0 | . . T . . . . . f . . . |
1 | . . . . . . . . . . . . |
2 | . . R . . . . . m . . . |
3 | . . . . . . . . . . . . |
4 | . . . . . . . . . . . . |
5 | T . . . . . . . . . . . |
  +------------------------+

Tank: (2,0) -> (3,0) [distance: 7]
Ranged: (2,2) -> (3,2) [distance: 7, in range!]
Fast_Melee: (10,0) -> (9,0) [distance: 6]
Melee: (10,2) -> (9,2) [distance: 6]

Ranged entra in FIGHTING (range 4 raggiunto)
- Stato: ENGAGED -> FIGHTING
- Movimento: INTERROTTO
- Inizia attacchi ogni 2 ticks
```

### # Tick 10+: Combat Phase

```
   0 1 2 3 4 5 6 7 8 9 10 11
  +------------------------+
0 | . . . T . . . f . . . . |
1 | . . . . . . . . . . . . |
2 | . . . R . . . m . . . . |
3 | . . . . . . . . . . . . |
4 | . . . . . . . . . . . . |
5 | T . . . . . . . . . . . |
  +------------------------+

Ranged (3,2) attacca Melee (9,2):
- Distance: 6 (in range 4)
- Damage: 35 every 2 ticks
- Stato: FIGHTING (rimane fermo)

Tank (3,0) continua avvicinamento:
- Target: Fast_Melee (8,0)  
- Movimento: (3,0) -> (4,0)
- Distance: 4
```

## # Comportamenti Speciali

### # 1. Collision Detection

```typescript
// Due unità non possono occupare stessa posizione
if (grid.isOccupied(targetPosition)) {
  // Try alternative positions
  const alternatives = getValidNeighbors(currentPosition, grid);
  return selectBestAlternative(alternatives);
}
```

### # 2. Target Persistence

```typescript
// Unità ENGAGED mantengono target finché possibile
if (unit.state === 'engaged' && isTargetAlive(unit.targetId)) {
  // Continua verso stesso target anche se appare nemico più vicino
  // Questo crea "duels" tra unità specifiche
}
```

### # 3. Cooldown Management

```typescript
// Movement Cooldown per tipo unità
Tank:      movementCooldown = 3 ticks
Melee:     movementCooldown = 2 ticks  
Fast_Melee: movementCooldown = 1 ticks
Ranged:    movementCooldown = 3 ticks

// Attack Cooldown per tipo unità
Tank:      attackCooldown = 2 ticks
Melee:     attackCooldown = 1 ticks
Fast_Melee: attackCooldown = 1 ticks  
Ranged:    attackCooldown = 2 ticks
```

## # Edge Cases e Gestione

### # 1. Unità Bloccate

```
Se unità non può muoversi (bloccata da alleati/ostacoli):
- Prova posizioni alternative
- Se nessuna posizione valida, salta movimento
- Cooldown non viene consumato
```

### # 2. Target Switching

```
Unità può cambiare target solo quando:
- Target attuale muore
- Nuovo target è significativamente più vicino (> 3 tile)
- Sono passati almeno 5 ticks dall'ultimo target change
```

### # 3. Bounds Checking

```
Tutti i movimenti verificano:
- 0 <= x < grid.width (default 12)
- 0 <= y < grid.height (default 6)
- Posizione dentro griglia valida
```

## # Performance e Ottimizzazione

### # Complessità Algoritmica

```
Target Finding:    O(n) per unità (n = nemici)
Pathfinding:       O(1) (greedy, non A* completo)
Movement Update:   O(u) totale (u = unità totali)
Overall per tick: O(u * n) ~ O(n²) per n unità totali
```

### # Ottimizzazioni Implementate

1. **Manhattan Distance**: O(1) vs Euclidean O(log n)
2. **Greedy Pathfinding**: O(1) per step vs A* O(n log n)
3. **Spatial Indexing**: Grid lookup O(1) per posizioni
4. **Deterministic Sorting**: Cache risultati ordinamenti

## # Debug e Diagnostica

### # Logging Levels

```typescript
// DEBUG: Movimento singolo unità
console.log(`Unit ${unit.id}: ${unit.state} -> ${newPos}`);

// INFO: Cambi stato importanti  
console.log(`Unit ${unit.id}: ${oldState} -> ${newState}`);

// WARN: Edge cases
console.warn(`Unit ${unit.id}: Blocked at ${unit.position}`);
```

### # Visualization Tools

```bash
# Visualizzazione step-by-step
npm run run-visual -- --deckA turtle --deckB aggro --speed 50

# Debug target finding
npm run debug-target -- --deckA turtle --deckB aggro
```

---

## # Riepilogo Regole Chiave

1. **Determinismo**: Stesso seed = stesso risultato garantito
2. **Stati Finiti**: IDLE -> ENGAGED -> FIGHTING -> IDLE
3. **Target Persistence**: Unità ENGAGED mantengono target
4. **Pathfinding Greedy**: Priorità distanza + schema direzionale
5. **Collision Avoidance**: Una unità per tile
6. **Cooldown Respect**: Movement e attack rispettano tempi
7. **Range-Based Combat**: Solo in range = attacchi, fuori = movimento

Questo sistema crea battaglie strategiche, prevedibili e bilanciate con comportamenti unità realistici e tattiche di squadra coerenti!
