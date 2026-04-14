#!/usr/bin/env node

import { UnitTemplateManager, UnitTemplate } from '../entities/unitTemplate';
import { SimulationEngine, SimulationConfig } from '../core/engine';
import { PREDEFINED_DECKS } from '../entities/deck';
import { SQLiteDatabase } from '../db/sqlite';
import { Repository } from '../db/repository';
import { BatchSimulator, BatchConfig, BatchResult } from '../meta/simulator';
import { MatchupAnalyzer } from '../meta/matchup';

interface CliOptions {
  iterations: number;
  maxTicks: number;
  enableLogging: boolean;
  gridSize: {
    width: number;
    height: number;
  };
  decks: string[];
  generateReport: boolean;
}

function parseArguments(): CliOptions {
  const args = process.argv.slice(2);
  
  const options: CliOptions = {
    iterations: 100,
    maxTicks: 1000,
    enableLogging: false,
    gridSize: { width: 12, height: 8 },
    decks: Object.keys(PREDEFINED_DECKS),
    generateReport: true
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    switch (arg) {
      case '--iterations':
        options.iterations = parseInt(args[++i]) || 100;
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
      case '--decks':
        const deckList = args[++i];
        options.decks = deckList.split(',').map(d => d.trim());
        break;
      case '--no-report':
        options.generateReport = false;
        break;
      case '--help':
        console.log(`
Autochess Batch Simulator

Usage: npm run run-batch -- [options]

Options:
  --iterations <num>  Iterations per matchup (default: 100)
  --maxTicks <num>    Maximum ticks per match (default: 1000)
  --logging           Enable detailed logging (not recommended for batches)
  --width <num>       Grid width (default: 12)
  --height <num>      Grid height (default: 8)
  --decks <list>      Comma-separated deck list (default: all)
  --no-report         Skip matchup report generation
  --help              Show this help

Available decks: ${Object.keys(PREDEFINED_DECKS).join(', ')}
        `);
        process.exit(0);
    }
  }

  const invalidDecks = options.decks.filter(deck => !PREDEFINED_DECKS[deck]);
  if (invalidDecks.length > 0) {
    console.error(`Error: Invalid decks: ${invalidDecks.join(', ')}`);
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

function displayBatchResults(result: BatchResult): void {
  console.log('\n=== Batch Simulation Results ===');
  console.log(`Total matches simulated: ${result.totalMatches}`);
  console.log(`Overall Team A wins: ${result.overallStats.totalTeamAWins}`);
  console.log(`Overall Team B wins: ${result.overallStats.totalTeamBWins}`);
  console.log(`Overall draws: ${result.overallStats.totalDraws}`);
  console.log(`Average match duration: ${result.overallStats.avgMatchDuration.toFixed(1)} ticks`);
  console.log('');

  console.log('=== Matchup Matrix ===');
  console.log('| Deck A | Deck B | A Wins | B Wins | Draws | A Win Rate | Duration |');
  console.log('|--------|--------|--------|--------|-------|------------|----------|');

  for (const matchup of result.matchupMatrix.sort((a: any, b: any) => b.teamAWins - a.teamAWins)) {
    const total = matchup.teamAWins + matchup.teamBWins + matchup.draws;
    const winRate = total > 0 ? (matchup.teamAWins / total * 100).toFixed(1) : '0.0';
    
    console.log(`| ${matchup.deckA.padEnd(8)} | ${matchup.deckB.padEnd(8)} | ${matchup.teamAWins.toString().padStart(6)} | ${matchup.teamBWins.toString().padStart(6)} | ${matchup.draws.toString().padStart(5)} | ${winRate.padStart(9)}% | ${matchup.avgDuration.toFixed(1).padStart(8)} |`);
  }
}

async function main(): Promise<void> {
  console.log('=== Autochess Batch Simulator ===\n');

  const options = parseArguments();
  
  console.log(`Batch Configuration:`);
  console.log(`  Iterations per matchup: ${options.iterations}`);
  console.log(`  Max Ticks: ${options.maxTicks}`);
  console.log(`  Grid Size: ${options.gridSize.width}x${options.gridSize.height}`);
  console.log(`  Logging: ${options.enableLogging ? 'Enabled' : 'Disabled'}`);
  console.log(`  Decks: ${options.decks.join(', ')}`);
  console.log(`  Report Generation: ${options.generateReport ? 'Enabled' : 'Disabled'}`);
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

  const batchConfig: BatchConfig = {
    teams: options.decks.map(deckName => PREDEFINED_DECKS[deckName]),
    iterationsPerMatchup: options.iterations,
    maxTicks: options.maxTicks,
    enableLogging: options.enableLogging
  };

  const simulator = new BatchSimulator(templateManager, config, repository);

  console.log('Starting batch simulation...\n');
  const startTime = Date.now();

  const result = await simulator.runBatchSimulation(batchConfig);
  const endTime = Date.now();

  displayBatchResults(result);
  console.log(`\nBatch simulation completed in ${endTime - startTime}ms`);

  if (options.generateReport) {
    console.log('\nGenerating matchup analysis report...\n');
    
    const analyzer = new MatchupAnalyzer(repository);
    const decks = options.decks.map(deckName => PREDEFINED_DECKS[deckName]);
    const matchups = await analyzer.getMatchupMatrix(decks);
    
    const report = analyzer.generateMatchupReport(matchups);
    console.log(report);
  }

  db.close();
}

main().catch(console.error);
