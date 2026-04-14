import { Team } from '../entities/team';
import { UnitTemplate, UnitTemplateManager } from '../entities/unitTemplate';
import { UnitInstance, UnitInstanceFactory, Position } from '../entities/unitInstance';
import { Grid } from '../utils/grid';
import { processTick, TickLog } from './tick';

export interface MatchResult {
  winner: string | 'draw';
  totalTicks: number;
  survivingUnits: {
    teamA: number;
    teamB: number;
  };
  summaryStats: {
    totalDamageDealt: {
      teamA: number;
      teamB: number;
    };
    unitsKilled: {
      teamA: number;
      teamB: number;
    };
  };
  logs?: TickLog[];
}

export interface SimulationConfig {
  maxTicks: number;
  enableLogging: boolean;
  gridSize: {
    width: number;
    height: number;
  };
}

export class SimulationEngine {
  private templateManager: UnitTemplateManager;
  private config: SimulationConfig;

  constructor(templateManager: UnitTemplateManager, config: SimulationConfig) {
    this.templateManager = templateManager;
    this.config = config;
  }

  runMatch(teamA: Team, teamB: Team): MatchResult {
    UnitInstanceFactory.resetIdCounter();
    
    const grid = new Grid(this.config.gridSize.width, this.config.gridSize.height);
    const allUnits = [...teamA.units, ...teamB.units];
    
    for (const unit of allUnits) {
      grid.occupy(unit.position, unit);
    }

    const templates = new Map(
      this.templateManager.getAll().map(t => [t.id, t])
    );

    const logs: TickLog[] = [];
    let currentTick = 0;
    let matchEnded = false;

    while (currentTick < this.config.maxTicks && !matchEnded) {
      const tickLog = processTick(currentTick, allUnits, templates, grid);
      
      if (this.config.enableLogging) {
        logs.push(tickLog);
      }

      const aliveTeamA = teamA.units.filter(u => u.alive).length;
      const aliveTeamB = teamB.units.filter(u => u.alive).length;

      if (aliveTeamA === 0 || aliveTeamB === 0) {
        matchEnded = true;
      }

      currentTick++;
    }

    const finalAliveTeamA = teamA.units.filter(u => u.alive).length;
    const finalAliveTeamB = teamB.units.filter(u => u.alive).length;

    let winner: string | 'draw';
    if (finalAliveTeamA > 0 && finalAliveTeamB === 0) {
      winner = 'teamA';
    } else if (finalAliveTeamB > 0 && finalAliveTeamA === 0) {
      winner = 'teamB';
    } else {
      winner = 'draw';
    }

    const summaryStats = this.calculateSummaryStats(logs);

    return {
      winner,
      totalTicks: currentTick,
      survivingUnits: {
        teamA: finalAliveTeamA,
        teamB: finalAliveTeamB
      },
      summaryStats,
      logs: this.config.enableLogging ? logs : undefined
    };
  }

  private calculateSummaryStats(logs: TickLog[]) {
    const stats = {
      totalDamageDealt: { teamA: 0, teamB: 0 },
      unitsKilled: { teamA: 0, teamB: 0 }
    };

    for (const log of logs) {
      for (const attack of log.attacks) {
        const attackerTeam = attack.attackerId.startsWith('unit') ? 
          (parseInt(attack.attackerId.split('_')[1]) % 2 === 0 ? 'teamA' : 'teamB') : 'teamA';
        stats.totalDamageDealt[attackerTeam as keyof typeof stats.totalDamageDealt] += attack.damage;
      }

      for (const death of log.deaths) {
        stats.unitsKilled[death.teamId as keyof typeof stats.unitsKilled]++;
      }
    }

    return stats;
  }

  createTeamFromDeck(deck: any, teamId: string, templates: UnitTemplateManager): Team {
    const units: UnitInstance[] = [];
    let unitIndex = 0;

    for (const deckUnit of deck.units) {
      const template = templates.get(deckUnit.templateId);
      if (!template) continue;

      for (let i = 0; i < deckUnit.count; i++) {
        const position = this.getStartPosition(unitIndex, teamId, deck.units.length);
        const unit = UnitInstanceFactory.create(deckUnit.templateId, position, teamId, template);
        units.push(unit);
        unitIndex++;
      }
    }

    return {
      id: teamId,
      name: `${teamId} - ${deck.name}`,
      units
    };
  }

  private getStartPosition(unitIndex: number, teamId: string, totalUnits: number): Position {
    const gridHeight = this.config.gridSize.height;
    const gridWidth = this.config.gridSize.width;
    
    // Calculate Y position to distribute units evenly
    const yPositions: number[] = [];
    const spacing = gridHeight / (totalUnits + 1);
    
    for (let i = 1; i <= totalUnits; i++) {
      const y = Math.floor(spacing * i);
      // Ensure Y is within bounds (0 to gridHeight-1)
      const clampedY = Math.max(0, Math.min(gridHeight - 1, y));
      yPositions.push(clampedY);
    }
    
    const y = yPositions[unitIndex] || Math.floor(gridHeight / 2);
    
    if (teamId === 'teamA') {
      return { x: 0, y };
    } else {
      return { x: gridWidth - 1, y };
    }
  }
}
