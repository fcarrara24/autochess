# Autochess Battle Simulator

A deterministic autochess battle simulator built with TypeScript and Node.js. This system allows you to simulate battles between different team compositions, analyze matchup statistics, and test unit balancing.

## Features

- **Deterministic Simulation Engine**: No randomness - every simulation is reproducible
- **Modular Architecture**: Clean separation between core engine, entities, and persistence
- **SQLite Database**: Store match results and analyze statistics
- **CLI Interface**: Run matches and batch simulations from command line
- **Debug Logging**: Comprehensive logging and replay system for debugging
- **Meta Analysis**: Win rate matrices and matchup statistics

## Quick Start

### Installation

```bash
npm install
```

### Initialize Database

```bash
npm run dev -- --init-db
```

### Run a Single Match

```bash
npm run run-match -- --deckA turtle --deckB aggro --logging
```

### Run Batch Simulations

```bash
npm run run-batch -- --iterations 100 --decks turtle,aggro,balanced
```

## Architecture

### Core Components

- **Entities**: `UnitTemplate`, `UnitInstance`, `Team`, `Deck`
- **Engine**: Deterministic tick-based simulation with movement and combat phases
- **Database**: SQLite storage for matches and statistics
- **CLI**: Command-line interface for running simulations

### Simulation Flow

1. **Setup**: Teams are created from decks using unit templates
2. **Tick Processing**: Each tick has movement, collision, and attack phases
3. **Resolution**: Damage is applied simultaneously, units die when HP reaches 0
4. **Termination**: Match ends when one team is eliminated or max ticks reached

## Unit Templates

The system includes 4 default unit types:

- **Tank**: High HP, low damage, melee range
- **Melee**: Balanced stats, melee range
- **Fast Melee**: Low HP, good damage, fast movement
- **Ranged**: Low HP, high damage, long range

## Predefined Decks

- **Turtle**: 3 tanks + 2 ranged units
- **Aggro**: 4 fast melee + 1 melee
- **Balanced**: 1 tank + 2 melee + 2 ranged

## CLI Commands

### run-match

Run a single match between two decks.

```bash
npm run run-match -- [options]
```

Options:
- `--deckA <name>`: Deck for team A (default: balanced)
- `--deckB <name>`: Deck for team B (default: balanced)
- `--maxTicks <num>`: Maximum ticks per match (default: 1000)
- `--logging`: Enable detailed logging
- `--width <num>`: Grid width (default: 12)
- `--height <num>`: Grid height (default: 8)

### run-batch

Run batch simulations for matchup analysis.

```bash
npm run run-batch -- [options]
```

Options:
- `--iterations <num>`: Iterations per matchup (default: 100)
- `--maxTicks <num>`: Maximum ticks per match (default: 1000)
- `--logging`: Enable detailed logging
- `--width <num>`: Grid width (default: 12)
- `--height <num>`: Grid height (default: 8)
- `--decks <list>`: Comma-separated deck list (default: all)
- `--no-report`: Skip matchup report generation

## Database Schema

The system uses SQLite with the following tables:

- `unit_templates`: Store unit definitions
- `matches`: Store match results
- `match_results`: Store detailed match statistics
- `match_logs`: Store tick-by-tick logs (optional)

## Debugging

The system includes comprehensive debugging features:

- **Tick Logs**: Detailed logs for each simulation tick
- **Match Snapshots**: Complete state snapshots for any tick
- **Replay System**: Replay matches to analyze behavior
- **State Comparison**: Compare snapshots between different ticks

## Determinism

The simulation engine is fully deterministic:
- No random number generation in core logic
- Consistent unit ordering in all operations
- Reproducible results given same input

## Development

### Building

```bash
npm run build
```

### Running in Development

```bash
npm run dev
```

### Project Structure

```
src/
  core/          # Simulation engine
  entities/      # Game entities
  meta/          # Batch simulation and analysis
  db/            # Database layer
  utils/         # Utilities (logging, deterministic helpers)
  cli/           # Command-line interface
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Ensure all tests pass
5. Submit a pull request

## License

MIT License
