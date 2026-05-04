# Auto-Battler Game

A simple multiplayer auto-battler game built with TypeScript, Node.js, and WebSocket.

## Features

- **Multiplayer**: 2-player real-time battles
- **Authoritative Server**: Server validates all game actions
- **Unit Types**: Melee and Ranged units with different stats
- **Grid-based Combat**: 3x8 grid arena
- **Placement & Battle Phases**: 30s placement, 40s battle
- **State Machine AI**: Units with SEEK, ENGAGED, ATTACK, IDLE states
- **Real-time Updates**: 5 ticks/second game loop

## Quick Start

1. Install dependencies:
```bash
npm install
```

2. Start the server:
```bash
npm start
```

3. Open browser:
```
http://localhost:3000
```

## Development

Development mode with auto-restart:
```bash
npm run dev
```

Build TypeScript:
```bash
npm run build
```

## Game Rules

### Arena
- Grid size: 3 rows × 8 columns
- Player A area: columns 0-3 (blue)
- Player B area: columns 4-7 (red)
- Max 1 unit per tile
- Max 12 units per player

### Units
- **Melee**: 30 HP, 10 damage, range 1
- **Ranged**: 20 HP, 6 damage, range 2

### Phases
1. **Placement Phase** (30s)
   - Place units in your area
   - Move units within your area
   - Remove units
   - Right-click or shift-click to remove

2. **Battle Phase** (40s or until one side loses)
   - No player input
   - Units fight automatically
   - 5 ticks/second

### Victory
- First player to 3 points wins
- 1 point per round victory
- Timeout = 0 points (tie)

## Controls

- **Left Click**: Place selected unit type
- **Right Click/Shift**: Remove unit
- **Drag & Drop**: Move units (placement phase only)

## Architecture

```
/server
  /network    → WebSocket connections and events
  /game       → Game loop, movement, combat logic
  /models     → Unit, Player, Grid classes
  /state      → Match and round state
  index.ts    → Server bootstrap

/public
  index.html  → Game UI
  client.js   → Client-side logic and rendering
```

## Networking

- Client sends intentions only (place, move, remove)
- Server validates everything
- Server sends full game state every tick
- Rate limiting prevents spam
- Game pauses on disconnection

## Technical Details

- **Server**: Node.js + TypeScript + Socket.IO
- **Client**: HTML5 Canvas + Vanilla JavaScript
- **Game Loop**: 200ms intervals (5 ticks/sec)
- **State Sync**: Authoritative server model
- **Combat**: Manhattan distance, simultaneous attacks
