# Diagrammi Sistema di Movimento Autochess

## Griglia di Riferimento (12x6)

```
Coordinate System:
   X: 0 1 2 3 4 5 6 7 8 9 10 11
   Y: 0 1 2 3 4 5

   0 1 2 3 4 5 6 7 8 9 10 11
  +------------------------+
0 | A A A . . . . . . B B B |  A = Team A, B = Team B
1 | A R A . . . . . . B M B |  R = Ranged, M = Melee
2 | A A A . . . . . . B F B |  F = Fast Melee
3 | . . . . . . . . . . . . |
4 | . . . . . . . . . . . . |
5 | . . . . . . . . . . . . |
  +------------------------+
```

## Flusso Stati Unità

```
    [IDLE]
       | (trova nemico)
       v
    [ENGAGED] <--- (fuori range) ---+
       | (in range)                |
       v                           |
    [FIGHTING] --------------------+
       | (nemico muore)
       v
    [IDLE] (cerca nuovo target)
```

## Schema Priorità Movimento

```
Per unità in posizione (x,y), le direzioni sono:

    |2|1|3    Priorità: 1 > 2 > 3 > 4 > 5 > 6 > 7 > 8
    |4|U|5    1 = Avanti (massima priorità)
    |7|6|8    2 = Sinistra-alto, 3 = Destra-alto
             4 = Sinistra, 5 = Destra
             6 = Sinistra-basso, 7 = Dietro-sinistra
             8 = Dietro-destra

Esempio: Unità Team A in (5,3) con target in (8,3)

    | | | | | | | | | | | |
    | | | | | | | | | | |
    | | | | |T| | | | | | |  T = Target
    | | | | | | | | | | | |
    | | | |U|->|->|->|T| | | |  U = Unità, -> = Path
    | | | | | | | | | | | |
    | | | | | | | | | | | |
```

## Zone di Battaglia

```
   0 1 2 3 4 5 6 7 8 9 10 11
  +------------------------+
0 | S S S S S S S S S S S S |  S = Seek Zone (movimento esplorativo)
1 | S S E E E E E E E S S S |  E = Engagement Zone 
2 | T E E C C C C E E B F B |  C = Combat Zone (range 1-4)
3 | R E E C C C C E E B M B |  T = Tank, R = Ranged
4 | . E E C C C C E E B . . |  B = Team B units
5 | T E E C C C C E E B M M |  F = Fast Melee, M = Melee
  +------------------------+

Legend:
- Seek Zone: Unità IDLE cercano bersagli
- Engagement Zone: Unità ENGAGED si muovono verso target
- Combat Zone: Unità FIGHTING attaccano (ferme)
```

## Esempio Battaglia Step-by-Step

### Tick 0: Posizionamento Iniziale

```
   0 1 2 3 4 5 6 7 8 9 10 11
  +------------------------+
0 | T . . . . . . . . . . f |
1 | . . . . . . . . . . . . |
2 | R . . . . . . . . . . m |
3 | . . . . . . . . . . . . |
4 | . . . . . . . . . . . . |
5 | T . . . . . . . . . . . |
  +------------------------+

Stati: Tutte unità = IDLE
Target: Nessuno
Movement: Inizia ricerca nemici
```

### Tick 1-3: Target Acquisition

```
   0 1 2 3 4 5 6 7 8 9 10 11
  +------------------------+
0 | . T . . . . . . . f . . |
1 | . . . . . . . . . . . . |
2 | . R . . . . . . . m . . |
3 | . . . . . . . . . . . . |
4 | . . . . . . . . . . . . |
5 | T . . . . . . . . . . . |
  +------------------------+

Stati: Tutte unità = ENGAGED
Target: 
- Tank(1,0) -> Fast_Melee(9,0) [dist: 8]
- Ranged(1,2) -> Melee(9,2) [dist: 8]
- Fast_Melee(9,0) -> Tank(1,0) [dist: 8]
- Melee(9,2) -> Ranged(1,2) [dist: 8]
Movement: Verso target più vicino
```

### Tick 4-6: Avvicinamento

```
   0 1 2 3 4 5 6 7 8 9 10 11
  +------------------------+
0 | . . T . . . . f . . . . |
1 | . . . . . . . . . . . . |
2 | . . R . . . . . m . . . |
3 | . . . . . . . . . . . . |
4 | . . . . . . . . . . . . |
5 | T . . . . . . . . . . . |
  +------------------------+

Stati: Tutte unità = ENGAGED
Target: Stessi target (persistenza)
Movement: Continua verso target
Distance: Tank(3,0) -> Fast_Melee(7,0) [dist: 4]
```

### Tick 7-9: First Combat

```
   0 1 2 3 4 5 6 7 8 9 10 11
  +------------------------+
0 | . . . T . . f . . . . . |
1 | . . . . . . . . . . . . |
2 | . . . R . . . m . . . . |
3 | . . . . . . . . . . . . |
4 | . . . . . . . . . . . . |
5 | T . . . . . . . . . . . |
  +------------------------+

Stati: 
- Ranged(3,2) = FIGHTING (range 4 raggiunto Melee a 6)
- Altre unità = ENGAGED

Target: 
- Ranged(3,2) -> Melee(6,2) [IN RANGE!]
- Tank(3,0) -> Fast_Melee(5,0) [dist: 2]
- Fast_Melee(5,0) -> Tank(3,0) [dist: 2]
- Melee(6,2) -> Ranged(3,2) [dist: 3]

Movement: 
- Ranged: FERMO (in FIGHTING)
- Altre: Continua avvicinamento
Combat: Ranged inizia attacchi
```

### Tick 10+: Combat Phase

```
   0 1 2 3 4 5 6 7 8 9 10 11
  +------------------------+
0 | . . . . T f . . . . . . |
1 | . . . . . . . . . . . . |
2 | . . . R x m . . . . . . |
3 | . . . . . . . . . . . . |
4 | . . . . . . . . . . . . |
5 | T . . . . . . . . . . . |
  +------------------------+

Stati:
- Ranged(3,2) = FIGHTING (attacca)
- Tank(4,0) = FIGHTING (range 1 raggiunto)
- Fast_Melee(4,0) = FIGHTING (range 1 raggiunto)
- Melee(5,2) = FIGHTING (range 1 raggiunto)

Target: Tutti in range - combat totale!
Movement: Tutte FERME
Combat: Attacchi simultanei
```

## Pathfinding Esempi

### Esempio 1: Movimento Diretto

```
Unità: (2,3) -> Target: (8,3)

   0 1 2 3 4 5 6 7 8 9 10 11
  +------------------------+
0 | . . . . . . . . . . . . |
1 | . . . . . . . . . . . . |
2 | . . . . . . . . . . . . |
3 | . . U -> -> -> -> T . . |  Path diretto
4 | . . . . . . . . . . . . |
5 | . . . . . . . . . . . . |
  +------------------------+

Passi: (2,3) -> (3,3) -> (4,3) -> (5,3) -> (6,3) -> (7,3) -> (8,3)
```

### Esempio 2: Movimento con Ostacoli

```
Unità: (2,3) -> Target: (8,3)
Ostacolo: (5,3) occupato

   0 1 2 3 4 5 6 7 8 9 10 11
  +------------------------+
0 | . . . . . . . . . . . . |
1 | . . . . . . . . . . . . |
2 | . . . . . . . . . . . . |
3 | . . U -> -> X v -> T . . |  X = ostacolo, v = deviazione
4 | . . . . . . . . . . . . |
5 | . . . . . . . . . . . . |
  +------------------------+

Passi: (2,3) -> (3,3) -> (4,3) -> (4,4) -> (5,4) -> (6,4) -> (7,4) -> (8,4) -> (8,3)
```

### Esempio 3: Priorità Direzionale

```
Unità: (5,3), Target: (7,4)
Distanze uguali: (6,3) e (5,4)

   0 1 2 3 4 5 6 7 8 9 10 11
  +------------------------+
0 | . . . . . . . . . . . . |
1 | . . . . . . . . . . . . |
2 | . . . . . . . . . . . . |
3 | . . . . U 1 . . . . . . |  1 = Avanti (priorità)
4 | . . . . . 2 T . . . . . |  2 = Sinistra (secondaria)
5 | . . . . . . . . . . . . |
  +------------------------+

Scelta: (6,3) (avanti) invece di (5,4) (sinistra)
```

## Range di Attacco Visualizzati

### Melee Units (Range = 1)

```
Tank/Melee in (5,3):

   0 1 2 3 4 5 6 7 8 9 10 11
  +------------------------+
0 | . . . . . . . . . . . . |
1 | . . . . . . . . . . . . |
2 | . . . . x x x . . . . . |  x = range attacco
3 | . . . . x U x . . . . . |  U = unità
4 | . . . . x x x . . . . . |
5 | . . . . . . . . . . . . |
  +------------------------+

Può attaccare posizioni: (4,3), (6,3), (5,2), (5,4)
```

### Ranged Units (Range = 4)

```
Ranged in (5,3):

   0 1 2 3 4 5 6 7 8 9 10 11
  +------------------------+
0 | . . . . . . . . . . . . |
1 | . . x x x x x x x . . . |
2 | . . x x x x x x x . . . |
3 | . . x x x U x x x . . . |
4 | . . x x x x x x x . . . |
5 | . . . . . . . . . . . . |
  +------------------------+

Può attaccare qualsiasi posizione nel quadrato 4x4
```

## Cooldown Visualization

### Movement Timeline

```
Tank (movementCooldown = 3):
Tick: 0 1 2 3 4 5 6 7 8 9
Move: X X X X X X X X X X
      ^     ^     ^     ^
      |     |     |     |
   Move   Wait   Move   Wait

Fast_Melee (movementCooldown = 1):
Tick: 0 1 2 3 4 5 6 7 8 9
Move: X X X X X X X X X X
      ^ ^ ^ ^ ^ ^ ^ ^ ^ ^
      | | | | | | | | | |
   Move ogni tick
```

### Attack Timeline

```
Ranged (attackCooldown = 2):
Tick: 0 1 2 3 4 5 6 7 8 9
Attk: X X X X X X X X X X
      ^     ^     ^     ^
      |     |     |     |
   Attack Wait  Attack Wait

Melee (attackCooldown = 1):
Tick: 0 1 2 3 4 5 6 7 8 9
Attk: X X X X X X X X X X
      ^ ^ ^ ^ ^ ^ ^ ^ ^ ^
      | | | | | | | | | |
   Attack ogni tick
```

## Edge Cases

### 1. Unità Bloccata

```
Unità in (5,3) completamente circondata:

   0 1 2 3 4 5 6 7 8 9 10 11
  +------------------------+
0 | . . . . . . . . . . . . |
1 | . . . . x x x . . . . . |
2 | . . . . x U x . . . . . |  x = ostacoli, U = unità bloccata
3 | . . . . x x x . . . . . |
4 | . . . . . . . . . . . . |
5 | . . . . . . . . . . . . |
  +------------------------+

Risultato: Unità salta movimento, cooldown non consumato
```

### 2. Target Switching

```
Unità ENGAGED con target distante, appare target più vicino:

   0 1 2 3 4 5 6 7 8 9 10 11
  +------------------------+
0 | . . . . . . . . . . . . |
1 | . . . . . . . . . . . . |
2 | . . U . . . . . . . . . |
3 | . . . . . . . . . . . . |
4 | . . . . . . . . . . . . |
5 | . . . . . . . . . . T . |  T = target attuale (dist: 3)
  +------------------------+

Nuovo target appare:
   0 1 2 3 4 5 6 7 8 9 10 11
  +------------------------+
0 | . . . . . . . . . . . . |
1 | . . . . . . . . . . . . |
2 | . . U . N . . . . . . . |  N = nuovo target (dist: 1)
3 | . . . . . . . . . . . . |
4 | . . . . . . . . . . . . |
5 | . . . . . . . . . . T . |
  +------------------------+

Regola: Unità ENGAGED mantiene target T
Solo se T muore o distanza > 3 tile, considera N
```

Questi diagrammi mostrano esattamente come funziona il sistema di movimento in ogni situazione!
