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


// quando trovi gli obiettivi da attaccare ti concentri su quelli se sono nel range ( fighting )
// se trovi un obiettivo nell diamante di movimento ( largo quanto la larghezza del campo )
// sei in stato engaged e cerchi di avvicinarti fino a che non  puoi attaccarlo
// se non trovi un obiettivo segui il pattern in stato di seek evitando i personaggi avversari 
// due unità (alleate o avversarie non possono occupare lo stesso spazio )


// per farlo cambia anche unit instance
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

    // Ordinamento deterministico delle unità per consistenza
    const sortedDeckUnits = [...deck.units].sort((a, b) => {
      // Ordina per templateId poi per count
      if (a.templateId !== b.templateId) {
        return a.templateId.localeCompare(b.templateId);
      }
      return a.count - b.count;
    });

    for (const deckUnit of sortedDeckUnits) {
      const template = templates.get(deckUnit.templateId);
      if (!template) continue;

      for (let i = 0; i < deckUnit.count; i++) {
        const position = this.getStartPosition(unitIndex, teamId, deck.units.length);
        const unit = UnitInstanceFactory.create(deckUnit.templateId, position, teamId, template);
        units.push(unit);
        unitIndex++;
      }
    }

    // Ordinamento finale deterministico delle unità create
    units.sort((a, b) => {
      // Ordina per ID per consistenza assoluta
      return a.id.localeCompare(b.id);
    });

    return {
      id: teamId,
      name: `${teamId} - ${deck.name}`,
      units
    };
  }

  // Sistema di posizionamento avanzato su più file per griglie più grandi
  private getStartPosition(unitIndex: number, teamId: string, totalUnits: number): Position {
    const gridHeight = this.config.gridSize.height;
    const gridWidth = this.config.gridSize.width;
    
    // Calcola numero di file necessarie
    const maxUnitsPerFile = gridHeight;
    const numFiles = Math.ceil(totalUnits / maxUnitsPerFile);
    
    // Determina file e posizione nella file
    const fileIndex = Math.floor(unitIndex / maxUnitsPerFile);
    const positionInFile = unitIndex % maxUnitsPerFile;
    
    // Calcola posizione X basata sul team e numero di file
    let x: number;
    if (teamId === 'teamA') {
      // Team A: parte da sinistra verso centro
      x = fileIndex;
    } else {
      // Team B: parte da destra verso centro
      x = gridWidth - 1 - fileIndex;
    }
    
    // Calcola posizione Y distribuita uniformemente nella file
    const unitsInThisFile = Math.min(maxUnitsPerFile, totalUnits - (fileIndex * maxUnitsPerFile));
    const spacing = gridHeight / (unitsInThisFile + 1);
    const y = Math.floor(spacing * (positionInFile + 1));
    
    // Ensure coordinates sono within bounds
    const clampedX = Math.max(0, Math.min(gridWidth - 1, x));
    const clampedY = Math.max(0, Math.min(gridHeight - 1, y));
    
    return { x: clampedX, y: clampedY };
  }
}
