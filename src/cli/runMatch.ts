#!/usr/bin/env node

import { UnitTemplateManager, UnitTemplate } from '../entities/unitTemplate';
import { SimulationEngine, SimulationConfig } from '../core/engine';
import { PREDEFINED_DECKS } from '../entities/deck';
import { SQLiteDatabase } from '../db/sqlite';
import { Repository } from '../db/repository';

interface CliOptions {
  deckA: string;
  deckB: string;
  maxTicks: number;
  enableLogging: boolean;
  gridSize: {
    width: number;
    height: number;
  };
}

function parseArguments(): CliOptions {
  const args = process.argv.slice(2);
  
  const options: CliOptions = {
    deckA: 'balanced',
    deckB: 'balanced', 
    maxTicks: 1000,
    enableLogging: false,
    gridSize: { width: 12, height: 8 }
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    switch (arg) {
      case '--deckA':
        options.deckA = args[++i];
        break;
      case '--deckB':
        options.deckB = args[++i];
        break;
      case '--maxTicks':
        options.maxTicks = parseInt(args[++i]) || 1000;
        break;
      case '--logging':
        options.enableLogging = true;
        break;
      case '--width':
        options.gridSize.width = parseInt(args[++i]) || 12;
        break;
      case '--height':
        options.gridSize.height = parseInt(args[++i]) || 8;
        break;
      case '--help':
        console.log(`
Autochess Match Runner

Usage: npm run run-match -- [options]

Options:
  --deckA <name>     Deck for team A (default: balanced)
  --deckB <name>     Deck for team B (default: balanced)
  --maxTicks <num>   Maximum ticks per match (default: 1000)
  --logging          Enable detailed logging
  --width <num>      Grid width (default: 12)
  --height <num>     Grid height (default: 8)
  --help             Show this help

Available decks: ${Object.keys(PREDEFINED_DECKS).join(', ')}
        `);
        process.exit(0);
    }
  }

  if (!PREDEFINED_DECKS[options.deckA]) {
    console.error(`Error: Deck '${options.deckA}' not found`);
    console.error(`Available decks: ${Object.keys(PREDEFINED_DECKS).join(', ')}`);
    process.exit(1);
  }

  if (!PREDEFINED_DECKS[options.deckB]) {
    console.error(`Error: Deck '${options.deckB}' not found`);
    console.error(`Available decks: ${Object.keys(PREDEFINED_DECKS).join(', ')}`);
    process.exit(1);
  }

  return options;
}

function setupDefaultTemplates(templateManager: UnitTemplateManager): void {
  const templates: UnitTemplate[] = [
    {
      id: 'tank',
      name: 'Tank',
      hp: 150,
      damage: 20,
      range: 1,
      movementCooldown: 3,
      attackCooldown: 2,
      tags: ['melee', 'tank', 'slow']
    },
    {
      id: 'melee',
      name: 'Melee',
      hp: 100,
      damage: 30,
      range: 1,
      movementCooldown: 2,
      attackCooldown: 1,
      tags: ['melee', 'balanced']
    },
    {
      id: 'fast_melee',
      name: 'Fast Melee',
      hp: 80,
      damage: 25,
      range: 1,
      movementCooldown: 1,
      attackCooldown: 1,
      tags: ['melee', 'fast', 'glass_cannon']
    },
    {
      id: 'ranged',
      name: 'Ranged',
      hp: 60,
      damage: 35,
      range: 4,
      movementCooldown: 3,
      attackCooldown: 2,
      tags: ['ranged', 'glass_cannon']
    }
  ];

  templates.forEach(template => templateManager.register(template));
}

async function main(): Promise<void> {
  console.log('=== Autochess Match Runner ===\n');

  const options = parseArguments();
  
  console.log(`Match Configuration:`);
  console.log(`  Team A: ${options.deckA}`);
  console.log(`  Team B: ${options.deckB}`);
  console.log(`  Max Ticks: ${options.maxTicks}`);
  console.log(`  Grid Size: ${options.gridSize.width}x${options.gridSize.height}`);
  console.log(`  Logging: ${options.enableLogging ? 'Enabled' : 'Disabled'}`);
  console.log('');

  const templateManager = new UnitTemplateManager();
  setupDefaultTemplates(templateManager);

  const db = new SQLiteDatabase();
  const repository = new Repository(db);

  const config: SimulationConfig = {
    maxTicks: options.maxTicks,
    enableLogging: options.enableLogging,
    gridSize: options.gridSize
  };

  const engine = new SimulationEngine(templateManager, config);

  const deckA = PREDEFINED_DECKS[options.deckA];
  const deckB = PREDEFINED_DECKS[options.deckB];

  console.log('Starting match...\n');

  const startTime = Date.now();
  const teamA = engine.createTeamFromDeck(deckA, 'teamA', templateManager);
  const teamB = engine.createTeamFromDeck(deckB, 'teamB', templateManager);
  
  const result = engine.runMatch(teamA, teamB);
  const endTime = Date.now();

  console.log('=== Match Results ===');
  console.log(`Winner: ${result.winner.toUpperCase()}`);
  console.log(`Duration: ${result.totalTicks} ticks`);
  console.log(`Simulation Time: ${endTime - startTime}ms`);
  console.log('');
  
  console.log('=== Final State ===');
  console.log(`Team A Survivors: ${result.survivingUnits.teamA}`);
  console.log(`Team B Survivors: ${result.survivingUnits.teamB}`);
  console.log('');
  
  console.log('=== Statistics ===');
  console.log(`Team A Damage Dealt: ${result.summaryStats.totalDamageDealt.teamA}`);
  console.log(`Team B Damage Dealt: ${result.summaryStats.totalDamageDealt.teamB}`);
  console.log(`Team A Units Killed: ${result.summaryStats.unitsKilled.teamA}`);
  console.log(`Team B Units Killed: ${result.summaryStats.unitsKilled.teamB}`);

  if (options.enableLogging && result.logs) {
    console.log('\n=== Match Log ===');
    for (const log of result.logs.slice(-5)) {
      console.log(`Tick ${log.tick}:`);
      if (log.moves.length > 0) {
        console.log(`  Moves: ${log.moves.length} units moved`);
      }
      if (log.attacks.length > 0) {
        console.log(`  Attacks: ${log.attacks.length} attacks`);
      }
      if (log.deaths.length > 0) {
        console.log(`  Deaths: ${log.deaths.length} units died`);
      }
    }
  }

  try {
    const matchId = await repository.saveMatch(result, deckA, deckB);
    console.log(`\nMatch saved to database with ID: ${matchId}`);
  } catch (error) {
    console.error('Failed to save match to database:', error);
  }

  db.close();
}

main().catch(console.error);
