import { SimulationEngine, MatchResult, SimulationConfig } from '../core/engine';
import { UnitTemplateManager } from '../entities/unitTemplate';
import { Deck } from '../entities/deck';
import { Repository } from '../db/repository';

export interface BatchConfig {
  teams: Deck[];
  iterationsPerMatchup: number;
  maxTicks: number;
  enableLogging: boolean;
}

export interface BatchResult {
  totalMatches: number;
  matchupMatrix: Array<{
    deckA: string;
    deckB: string;
    teamAWins: number;
    teamBWins: number;
    draws: number;
    avgDuration: number;
  }>;
  overallStats: {
    totalTeamAWins: number;
    totalTeamBWins: number;
    totalDraws: number;
    avgMatchDuration: number;
  };
}

export class BatchSimulator {
  private engine: SimulationEngine;
  private repository: Repository;

  constructor(
    templateManager: UnitTemplateManager,
    config: SimulationConfig,
    repository: Repository
  ) {
    this.engine = new SimulationEngine(templateManager, config);
    this.repository = repository;
  }

  async runBatchSimulation(config: BatchConfig): Promise<BatchResult> {
    const results: BatchResult = {
      totalMatches: 0,
      matchupMatrix: [],
      overallStats: {
        totalTeamAWins: 0,
        totalTeamBWins: 0,
        totalDraws: 0,
        avgMatchDuration: 0
      }
    };

    const durations: number[] = [];

    for (let i = 0; i < config.teams.length; i++) {
      for (let j = 0; j < config.teams.length; j++) {
        if (i === j) continue; // Skip same team matchups

        const deckA = config.teams[i];
        const deckB = config.teams[j];

        const matchupResult = await this.runMatchup(
          deckA,
          deckB,
          config.iterationsPerMatchup,
          config.maxTicks,
          config.enableLogging
        );

        results.matchupMatrix.push(matchupResult);
        results.totalMatches += matchupResult.teamAWins + matchupResult.teamBWins + matchupResult.draws;
        results.overallStats.totalTeamAWins += matchupResult.teamAWins;
        results.overallStats.totalTeamBWins += matchupResult.teamBWins;
        results.overallStats.totalDraws += matchupResult.draws;
        
        durations.push(matchupResult.avgDuration);
      }
    }

    results.overallStats.avgMatchDuration = 
      durations.reduce((sum, duration) => sum + duration, 0) / durations.length;

    return results;
  }

  private async runMatchup(
    deckA: Deck,
    deckB: Deck,
    iterations: number,
    maxTicks: number,
    enableLogging: boolean
  ): Promise<{
    deckA: string;
    deckB: string;
    teamAWins: number;
    teamBWins: number;
    draws: number;
    avgDuration: number;
  }> {
    let teamAWins = 0;
    let teamBWins = 0;
    let draws = 0;
    const durations: number[] = [];

    for (let i = 0; i < iterations; i++) {
      const teamA = this.engine.createTeamFromDeck(deckA, 'teamA', this.engine['templateManager']);
      const teamB = this.engine.createTeamFromDeck(deckB, 'teamB', this.engine['templateManager']);

      const config: SimulationConfig = {
        maxTicks,
        enableLogging,
        gridSize: { width: 12, height: 8 }
      };

      const tempEngine = new SimulationEngine(this.engine['templateManager'], config);
      const result = tempEngine.runMatch(teamA, teamB);

      if (result.winner === 'teamA') teamAWins++;
      else if (result.winner === 'teamB') teamBWins++;
      else draws++;

      durations.push(result.totalTicks);

      await this.repository.saveMatch(result, deckA, deckB);
    }

    return {
      deckA: deckA.name,
      deckB: deckB.name,
      teamAWins,
      teamBWins,
      draws,
      avgDuration: durations.reduce((sum, duration) => sum + duration, 0) / durations.length
    };
  }
}
