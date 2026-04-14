#!/usr/bin/env node

import { UnitTemplateManager, UnitTemplate } from '../entities/unitTemplate';
import { SimulationEngine, SimulationConfig } from '../core/engine';
import { PREDEFINED_DECKS } from '../entities/deck';

interface TestResult {
  deckA: string;
  deckB: string;
  totalMatches: number;
  teamAWins: number;
  teamBWins: number;
  draws: number;
  avgTicks: number;
  issues: string[];
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

function runTestMatch(deckAName: string, deckBName: string): TestResult {
  console.log(`\n🧪 Testing ${deckAName} vs ${deckBName}...`);
  
  const templateManager = new UnitTemplateManager();
  setupDefaultTemplates(templateManager);

  const config: SimulationConfig = {
    maxTicks: 500, // Ridotto per test più veloci
    enableLogging: false,
    gridSize: { width: 12, height: 8 }
  };

  const engine = new SimulationEngine(templateManager, config);
  
  const deckA = PREDEFINED_DECKS[deckAName];
  const deckB = PREDEFINED_DECKS[deckBName];

  const results = {
    teamAWins: 0,
    teamBWins: 0,
    draws: 0,
    totalTicks: 0,
    issues: [] as string[]
  };

  const numMatches = 20; // Test più veloci

  for (let i = 0; i < numMatches; i++) {
    try {
      const teamA = engine.createTeamFromDeck(deckA, 'teamA', templateManager);
      const teamB = engine.createTeamFromDeck(deckB, 'teamB', templateManager);

      // Validate initial positions
      const allUnits = [...teamA.units, ...teamB.units];
      const invalidPositions = allUnits.filter(u => 
        u.position.x < 0 || u.position.x >= 12 || 
        u.position.y < 0 || u.position.y >= 8
      );

      if (invalidPositions.length > 0) {
        results.issues.push(`Match ${i}: Units with invalid positions found`);
        console.log(`❌ Invalid positions in match ${i}:`, invalidPositions.map(u => `${u.id} at (${u.position.x},${u.position.y})`));
      }

      const matchResult = engine.runMatch(teamA, teamB);
      
      if (matchResult.winner === 'teamA') results.teamAWins++;
      else if (matchResult.winner === 'teamB') results.teamBWins++;
      else results.draws++;

      results.totalTicks += matchResult.totalTicks;

      // Check for strange results
      if (matchResult.totalTicks >= 499) {
        results.issues.push(`Match ${i}: Reached max ticks (likely stalemate)`);
      }

      if (matchResult.summaryStats.totalDamageDealt.teamA === 0 && 
          matchResult.summaryStats.totalDamageDealt.teamB === 0) {
        results.issues.push(`Match ${i}: No damage dealt by either team`);
      }

    } catch (error) {
      results.issues.push(`Match ${i}: Error - ${error}`);
      console.log(`❌ Error in match ${i}:`, error);
    }
  }

  const result: TestResult = {
    deckA: deckAName,
    deckB: deckBName,
    totalMatches: numMatches,
    teamAWins: results.teamAWins,
    teamBWins: results.teamBWins,
    draws: results.draws,
    avgTicks: results.totalTicks / numMatches,
    issues: results.issues
  };

  // Print results
  console.log(`📊 Results:`);
  console.log(`   Team A wins: ${result.teamAWins}`);
  console.log(`   Team B wins: ${result.teamBWins}`);
  console.log(`   Draws: ${result.draws}`);
  console.log(`   Avg duration: ${result.avgTicks.toFixed(1)} ticks`);
  
  if (result.issues.length > 0) {
    console.log(`⚠️  Issues found (${result.issues.length}):`);
    result.issues.slice(0, 5).forEach(issue => console.log(`   - ${issue}`));
    if (result.issues.length > 5) {
      console.log(`   ... and ${result.issues.length - 5} more`);
    }
  } else {
    console.log(`✅ No issues detected`);
  }

  return result;
}

async function main(): Promise<void> {
  console.log('🔬 Autochess Internal Test Suite');
  console.log('=====================================\n');

  const decks = Object.keys(PREDEFINED_DECKS);
  const allResults: TestResult[] = [];

  // Test all matchups
  for (let i = 0; i < decks.length; i++) {
    for (let j = 0; j < decks.length; j++) {
      if (i === j) continue; // Skip same deck matchups
      
      const result = runTestMatch(decks[i], decks[j]);
      allResults.push(result);
    }
  }

  // Summary
  console.log('\n📋 COMPLETE TEST SUMMARY');
  console.log('========================\n');

  const totalIssues = allResults.reduce((sum, r) => sum + r.issues.length, 0);
  console.log(`Total issues detected: ${totalIssues}`);

  if (totalIssues > 0) {
    console.log('\n🚨 PROBLEMATIC MATCHUPS:');
    allResults
      .filter(r => r.issues.length > 0)
      .forEach(r => {
        console.log(`   ${r.deckA} vs ${r.deckB}: ${r.issues.length} issues`);
        r.issues.slice(0, 3).forEach(issue => {
          console.log(`     - ${issue}`);
        });
      });
  }

  // Balance analysis
  console.log('\n⚖️  BALANCE ANALYSIS:');
  allResults.forEach(r => {
    const total = r.teamAWins + r.teamBWins + r.draws;
    const winRateA = total > 0 ? (r.teamAWins / total * 100) : 0;
    const winRateB = total > 0 ? (r.teamBWins / total * 100) : 0;
    
    console.log(`${r.deckA} vs ${r.deckB}: ${winRateA.toFixed(1)}% vs ${winRateB.toFixed(1)}% (draws: ${(r.draws/total*100).toFixed(1)}%)`);
  });

  console.log('\n✅ Test suite completed!');
}

main().catch(console.error);
