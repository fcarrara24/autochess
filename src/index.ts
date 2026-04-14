#!/usr/bin/env node

import { UnitTemplateManager, UnitTemplate } from './entities/unitTemplate';
import { PREDEFINED_DECKS } from './entities/deck';
import { SimulationEngine, SimulationConfig } from './core/engine';
import { SQLiteDatabase } from './db/sqlite';
import { Repository } from './db/repository';

// Initialize default templates
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

async function initializeDatabase(): Promise<void> {
  const db = new SQLiteDatabase();
  const repository = new Repository(db);

  // Save default templates to database
  const templateManager = new UnitTemplateManager();
  setupDefaultTemplates(templateManager);

  for (const template of templateManager.getAll()) {
    await repository.saveUnitTemplate(template);
  }

  console.log('Database initialized with default templates');
  db.close();
}

function showHelp(): void {
  console.log(`
Autochess Battle Simulator

Available commands:
  npm run dev                    - Run development server
  npm run build                  - Build the project
  npm run run-match -- [options] - Run a single match
  npm run run-batch -- [options] - Run batch simulations

For detailed help on specific commands:
  npm run run-match -- --help
  npm run run-batch -- --help

Predefined decks: ${Object.keys(PREDEFINED_DECKS).join(', ')}

Examples:
  npm run run-match -- --deckA turtle --deckB aggro --logging
  npm run run-batch -- --iterations 50 --decks turtle,aggro,balanced
`);
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  if (args.includes('--help') || args.includes('-h')) {
    showHelp();
    return;
  }

  if (args.includes('--init-db')) {
    await initializeDatabase();
    return;
  }

  if (args.length === 0) {
    console.log('Autochess Battle Simulator');
    console.log('Use --help for available commands');
    return;
  }

  showHelp();
}

if (require.main === module) {
  main().catch(console.error);
}

export { UnitTemplateManager, SimulationEngine, PREDEFINED_DECKS };
export * from './entities/unitTemplate';
export * from './entities/unitInstance';
export * from './entities/team';
export * from './entities/deck';
export * from './core/engine';
export * from './core/tick';
export * from './core/movement';
export * from './core/combat';
export * from './meta/simulator';
export * from './meta/matchup';
export * from './db/sqlite';
export * from './db/repository';
export * from './utils/logger';
export * from './utils/deterministic';
