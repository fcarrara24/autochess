#!/usr/bin/env node

import { UnitTemplateManager, UnitTemplate } from '../entities/unitTemplate';
import { SimulationEngine, SimulationConfig } from '../core/engine';
import { PREDEFINED_DECKS } from '../entities/deck';
import { SQLiteDatabase } from '../db/sqlite';
import { Repository } from '../db/repository';
import { Grid } from '../utils/grid';
import { TickLog } from '../core/tick';

interface CliOptions {
  deckA: string;
  deckB: string;
  maxTicks: number;
  speed: number; // milliseconds between ticks
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
    speed: 200,
    gridSize: { width: 8, height: 6 }
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
      case '--speed':
        options.speed = parseInt(args[++i]) || 200;
        break;
      case '--width':
        options.gridSize.width = parseInt(args[++i]) || 12;
        break;
      case '--height':
        options.gridSize.height = parseInt(args[++i]) || 8;
        break;
      case '--help':
        console.log(`
Autochess Visual Match Runner

Usage: npm run run-visual -- [options]

Options:
  --deckA <name>     Deck for team A (default: balanced)
  --deckB <name>     Deck for team B (default: balanced)
  --maxTicks <num>   Maximum ticks per match (default: 1000)
  --speed <ms>       Delay between ticks in milliseconds (default: 200)
  --width <num>      Grid width (default: 8)
  --height <num>     Grid height (default: 6)
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

class VisualRenderer {
  private gridWidth: number;
  private gridHeight: number;

  constructor(gridWidth: number, gridHeight: number) {
    this.gridWidth = gridWidth;
    this.gridHeight = gridHeight;
  }

  clearScreen(): void {
    // More aggressive screen clearing
    process.stdout.write('\x1B[2J\x1B[H');
    console.clear();
  }

  renderGrid(units: any[], templates: Map<string, UnitTemplate>, tick: number, gridSize: {width: number, height: number}): void {
    const grid: string[][] = Array(gridSize.height).fill(null).map(() => 
      Array(gridSize.width).fill('.')
    );

    // Place units on grid
    for (const unit of units.filter(u => u.alive)) {
      const template = templates.get(unit.templateId);
      if (!template) continue;

      const { x, y } = unit.position;
      if (x >= 0 && x < gridSize.width && y >= 0 && y < gridSize.height) {
        const symbol = this.getUnitSymbol(unit.teamId, template);
        grid[y][x] = symbol;
      }
    }

    // Clear screen and render
    this.clearScreen();
    
    console.log('=== AUTOCHESS VISUAL SIMULATION ===');
    console.log(`Tick: ${tick}`);
    console.log('');
    
    // Render grid with borders
    console.log('   ' + '01234567'.slice(0, gridSize.width));
    console.log('  +' + '-'.repeat(gridSize.width) + '+');
    
    for (let y = 0; y < gridSize.height; y++) {
      const rowStr = grid[y] ? grid[y].join('') : '.'.repeat(gridSize.width);
      console.log(`${y.toString().padStart(2)}|${rowStr}|`);
    }
    
    console.log('  +' + '-'.repeat(gridSize.width) + '+');
    console.log('');

    // Render legend
    console.log('Legend:');
    console.log('  Team A: T=Tank, M=Melee, F=Fast Melee, R=Ranged');
    console.log('  Team B: t=Tank, m=Melee, f=Fast Melee, r=Ranged');
    console.log('  .=Empty');
    console.log('');

    // Render unit status
    this.renderUnitStatus(units, templates);
  }

  private getUnitSymbol(teamId: string, template: UnitTemplate): string {
    const baseSymbol = template.id.charAt(0).toUpperCase();
    return teamId === 'teamA' ? baseSymbol : baseSymbol.toLowerCase();
  }

  getGridString(units: any[], templates: Map<string, UnitTemplate>, gridSize: {width: number, height: number}): string {
    const grid: string[][] = Array(gridSize.height).fill(null).map(() => 
      Array(gridSize.width).fill('.')
    );

    // Place units on grid
    for (const unit of units.filter(u => u.alive)) {
      const template = templates.get(unit.templateId);
      if (!template) continue;

      const { x, y } = unit.position;
      if (x >= 0 && x < gridSize.width && y >= 0 && y < gridSize.height) {
        const symbol = this.getUnitSymbol(unit.teamId, template);
        grid[y][x] = symbol;
      }
    }

    let output = '';
    output += '   ' + '01234567'.slice(0, gridSize.width) + '\n';
    output += '  +' + '-'.repeat(gridSize.width) + '+\n';
    
    for (let y = 0; y < gridSize.height; y++) {
      const rowStr = grid[y] ? grid[y].join('') : '.'.repeat(gridSize.width);
      output += `${y.toString().padStart(2)}|${rowStr}|\n`;
    }
    
    output += '  +' + '-'.repeat(gridSize.width) + '+\n\n';
    return output;
  }

  public getUnitStatusString(units: any[], templates: Map<string, UnitTemplate>): string {
    let output = 'Unit Status:\n\n';

    const teamAUnits = units.filter(u => u.teamId === 'teamA');
    const teamBUnits = units.filter(u => u.teamId === 'teamB');

    output += 'Team A:\n';
    for (const unit of teamAUnits) {
      const template = templates.get(unit.templateId);
      const status = unit.alive ? `HP: ${unit.currentHp}/${template?.hp}` : 'DEAD';
      output += `  ${unit.templateId}: ${status} at (${unit.position.x},${unit.position.y})\n`;
    }

    output += '\nTeam B:\n';
    for (const unit of teamBUnits) {
      const template = templates.get(unit.templateId);
      const status = unit.alive ? `HP: ${unit.currentHp}/${template?.hp}` : 'DEAD';
      output += `  ${unit.templateId}: ${status} at (${unit.position.x},${unit.position.y})\n`;
    }

    return output;
  }

  public getTickLogString(log: any): string {
    let output = '';
    
    if (log.moves.length > 0 || log.attacks.length > 0 || log.deaths.length > 0) {
      output += `\n--- Tick ${log.tick} Actions ---\n`;
      
      if (log.moves.length > 0) {
        output += `Moves: ${log.moves.length}\n`;
        for (const move of log.moves.slice(0, 3)) {
          output += `  ${move.unitId}: (${move.from.x},${move.from.y}) -> (${move.to.x},${move.to.y})\n`;
        }
        if (log.moves.length > 3) {
          output += `  ... and ${log.moves.length - 3} more\n`;
        }
      }

      if (log.attacks.length > 0) {
        output += `Attacks: ${log.attacks.length}\n`;
        for (const attack of log.attacks.slice(0, 3)) {
          output += `  ${attack.attackerId} -> ${attack.targetId} (${attack.damage} dmg)\n`;
        }
        if (log.attacks.length > 3) {
          output += `  ... and ${log.attacks.length - 3} more\n`;
        }
      }

      if (log.deaths.length > 0) {
        output += `Deaths: ${log.deaths.length}\n`;
        for (const death of log.deaths.slice(0, 3)) {
          output += `  ${death.unitId} (${death.teamId})\n`;
        }
        if (log.deaths.length > 3) {
          output += `  ... and ${log.deaths.length - 3} more\n`;
        }
      }
    }

    return output;
  }

  renderUnitStatus(units: any[], templates: Map<string, UnitTemplate>): void {
    console.log(this.getUnitStatusString(units, templates));
  }

  renderTickLog(log: TickLog): void {
    if (log.moves.length > 0 || log.attacks.length > 0 || log.deaths.length > 0) {
      console.log('');
      console.log(`--- Tick ${log.tick} Actions ---`);
      
      if (log.moves.length > 0) {
        console.log(`Moves: ${log.moves.length}`);
        for (const move of log.moves.slice(0, 3)) {
          console.log(`  ${move.unitId}: (${move.from.x},${move.from.y}) -> (${move.to.x},${move.to.y})`);
        }
        if (log.moves.length > 3) {
          console.log(`  ... and ${log.moves.length - 3} more`);
        }
      }

      if (log.attacks.length > 0) {
        console.log(`Attacks: ${log.attacks.length}`);
        for (const attack of log.attacks.slice(0, 3)) {
          console.log(`  ${attack.attackerId} -> ${attack.targetId} (${attack.damage} dmg)`);
        }
        if (log.attacks.length > 3) {
          console.log(`  ... and ${log.attacks.length - 3} more`);
        }
      }

      if (log.deaths.length > 0) {
        console.log(`Deaths: ${log.deaths.length}`);
        for (const death of log.deaths) {
          console.log(`  ${death.unitId} (${death.teamId})`);
        }
      }
    }
  }

  renderMatchResult(result: any): void {
    console.log('');
    console.log('=== MATCH COMPLETE ===');
    console.log(`Winner: ${result.winner.toUpperCase()}`);
    console.log(`Duration: ${result.totalTicks} ticks`);
    console.log(`Team A Survivors: ${result.survivingUnits.teamA}`);
    console.log(`Team B Survivors: ${result.survivingUnits.teamB}`);
    console.log('');
    console.log('Press any key to exit...');
  }
}

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function main(): Promise<void> {
  console.log('=== Autochess Visual Match Runner ===\n');

  const options = parseArguments();
  
  console.log(`Match Configuration:`);
  console.log(`  Team A: ${options.deckA}`);
  console.log(`  Team B: ${options.deckB}`);
  console.log(`  Max Ticks: ${options.maxTicks}`);
  console.log(`  Grid Size: ${options.gridSize.width}x${options.gridSize.height}`);
  console.log(`  Speed: ${options.speed}ms per tick`);
  console.log('');
  console.log('Press Enter to start...');
  
  // Wait for user input
  await new Promise(resolve => {
    process.stdin.once('data', resolve);
  });

  const templateManager = new UnitTemplateManager();
  setupDefaultTemplates(templateManager);

  const db = new SQLiteDatabase();
  const repository = new Repository(db);

  const config: SimulationConfig = {
    maxTicks: options.maxTicks,
    enableLogging: true,
    gridSize: options.gridSize
  };

  const renderer = new VisualRenderer(options.gridSize.width, options.gridSize.height);
  const templates = new Map(templateManager.getAll().map(t => [t.id, t]));

  // Create teams
  const engine = new SimulationEngine(templateManager, config);
  const deckA = PREDEFINED_DECKS[options.deckA];
  const deckB = PREDEFINED_DECKS[options.deckB];

  const teamA = engine.createTeamFromDeck(deckA, 'teamA', templateManager);
  const teamB = engine.createTeamFromDeck(deckB, 'teamB', templateManager);

  const allUnits = [...teamA.units, ...teamB.units];
  const grid = new Grid(options.gridSize.width, options.gridSize.height);

  // Initialize grid
  for (const unit of allUnits) {
    grid.occupy(unit.position, unit);
  }

  // Run visual simulation
  let currentTick = 0;
  let matchEnded = false;

  while (currentTick < options.maxTicks && !matchEnded) {
    // Build complete frame output to prevent flicker/overlap
    let frameOutput = '';
    
    frameOutput += '=== AUTOCHESS VISUAL SIMULATION ===\n';
    frameOutput += `Tick: ${currentTick}\n\n`;
    
    // Add grid
    frameOutput += renderer.getGridString(allUnits, templates, options.gridSize);
    
    // Add unit status
    frameOutput += renderer.getUnitStatusString(allUnits, templates);
    
    // Add tick actions
    const tickLog = processTick(currentTick, allUnits, templates, grid);
    frameOutput += renderer.getTickLogString(tickLog);
    
    // Clear and render entire frame at once
    renderer.clearScreen();
    console.log(frameOutput);
    
    // Check win conditions
    const aliveTeamA = teamA.units.filter(u => u.alive).length;
    const aliveTeamB = teamB.units.filter(u => u.alive).length;

    if (aliveTeamA === 0 || aliveTeamB === 0) {
      matchEnded = true;
      
      // Victory message
      let victoryOutput = '=== AUTOCHESS VISUAL SIMULATION ===\n\n';
      victoryOutput += '=====================================\n';
      victoryOutput += '           VICTORY!\n';
      victoryOutput += '=====================================\n\n';
      
      if (aliveTeamA > 0) {
        victoryOutput += 'TEAM A WINS! (Turtle)\n';
        victoryOutput += 'Survivors: ' + aliveTeamA + '\n';
      } else if (aliveTeamB > 0) {
        victoryOutput += 'TEAM B WINS! (Aggro)\n';
        victoryOutput += 'Survivors: ' + aliveTeamB + '\n';
      }
      
      victoryOutput += `Match completed in ${currentTick} ticks\n\n`;
      victoryOutput += 'Press any key to exit...\n';
      
      renderer.clearScreen();
      console.log(victoryOutput);
      
      // Wait for key press then exit
      await new Promise(resolve => {
        process.stdin.once('data', resolve);
      });
      
      return; // Exit immediately
    }

    currentTick++;

    if (!matchEnded) {
      await sleep(options.speed);
    }
  }

  // Final render
  renderer.renderGrid(allUnits, templates, currentTick, options.gridSize);

  // Calculate and show results
  const finalAliveTeamA = teamA.units.filter(u => u.alive).length;
  const finalAliveTeamB = teamB.units.filter(u => u.alive).length;

  let winner: string;
  if (finalAliveTeamA > 0 && finalAliveTeamB === 0) {
    winner = 'teamA';
  } else if (finalAliveTeamB > 0 && finalAliveTeamA === 0) {
    winner = 'teamB';
  } else {
    winner = 'draw';
  }

  const result = {
    winner,
    totalTicks: currentTick,
    survivingUnits: {
      teamA: finalAliveTeamA,
      teamB: finalAliveTeamB
    },
    summaryStats: {
      totalDamageDealt: {
        teamA: 0,
        teamB: 0
      },
      unitsKilled: {
        teamA: teamA.units.length - finalAliveTeamA,
        teamB: teamB.units.length - finalAliveTeamB
      }
    }
  };

  renderer.renderMatchResult(result);

  // Save to database
  try {
    const matchId = await repository.saveMatch(result, deckA, deckB);
    console.log(`\nMatch saved to database with ID: ${matchId}`);
  } catch (error) {
    console.error('Failed to save match to database:', error);
  }

  db.close();
}

// Import processTick function (simplified version for visual mode)
import { processTick } from '../core/tick';

main().catch(console.error);
