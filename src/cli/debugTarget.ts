#!/usr/bin/env node

import { UnitTemplateManager, UnitTemplate } from '../entities/unitTemplate';
import { SimulationEngine, SimulationConfig } from '../core/engine';
import { PREDEFINED_DECKS } from '../entities/deck';
import { findTargetInRange, getDistance } from '../core/target';

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
      id: 'fast_melee',
      name: 'Fast Melee',
      hp: 80,
      damage: 25,
      range: 1,
      movementCooldown: 1,
      attackCooldown: 1,
      tags: ['melee', 'fast', 'glass_cannon']
    }
  ];

  templates.forEach(template => templateManager.register(template));
}

function debugTargetFinding(): void {
  console.log('🔍 DEBUG: Target Finding Analysis');
  console.log('==================================\n');

  const templateManager = new UnitTemplateManager();
  setupDefaultTemplates(templateManager);

  const config: SimulationConfig = {
    maxTicks: 10,
    enableLogging: true,
    gridSize: { width: 12, height: 8 }
  };

  const engine = new SimulationEngine(templateManager, config);
  
  const deckA = PREDEFINED_DECKS['turtle'];
  const deckB = PREDEFINED_DECKS['aggro'];

  const teamA = engine.createTeamFromDeck(deckA, 'teamA', templateManager);
  const teamB = engine.createTeamFromDeck(deckB, 'teamB', templateManager);

  const allUnits = [...teamA.units, ...teamB.units];
  const templates = new Map(templateManager.getAll().map(t => [t.id, t]));

  console.log('Initial positions:');
  allUnits.forEach(unit => {
    const template = templates.get(unit.templateId);
    console.log(`  ${unit.id} (${unit.teamId}): pos(${unit.position.x},${unit.position.y}) range:${template?.range} cooldown:${template?.attackCooldown}`);
  });

  // Simulate a few ticks with debug info
  for (let tick = 0; tick < 10; tick++) {
    console.log(`\n=== TICK ${tick} ===`);
    
    const aliveUnits = allUnits.filter(unit => unit.alive);
    
    for (const unit of aliveUnits) {
      const template = templates.get(unit.templateId);
      if (!template) continue;

      console.log(`\nChecking unit ${unit.id} (${unit.teamId}):`);
      console.log(`  Position: (${unit.position.x},${unit.position.y})`);
      console.log(`  Last attack tick: ${unit.lastAttackTick}`);
      console.log(`  Current tick: ${tick}`);
      console.log(`  Attack cooldown: ${template.attackCooldown}`);
      console.log(`  Can attack: ${(tick - unit.lastAttackTick) >= template.attackCooldown}`);

      if ((tick - unit.lastAttackTick) >= template.attackCooldown) {
        const enemies = aliveUnits.filter(enemy => enemy.teamId !== unit.teamId);
        console.log(`  Enemies found: ${enemies.length}`);
        
        enemies.forEach(enemy => {
          const distance = getDistance(unit.position, enemy.position);
          console.log(`    Enemy ${enemy.id} at (${enemy.position.x},${enemy.position.y}) distance: ${distance} (range: ${template?.range})`);
        });

        const target = findTargetInRange(unit, template!, enemies);
        console.log(`  Selected target: ${target ? target.id : 'NONE'}`);
        
        if (target) {
          console.log(`  ✅ Would attack ${target.id} for ${template!.damage} damage!`);
          unit.lastAttackTick = tick;
        }
      }
    }
  }
}

debugTargetFinding();
