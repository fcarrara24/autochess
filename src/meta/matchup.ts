import { Deck } from '../entities/deck';
import { Repository } from '../db/repository';

export interface MatchupStats {
  deckA: string;
  deckB: string;
  totalMatches: number;
  teamAWins: number;
  teamBWins: number;
  draws: number;
  avgDuration: number;
  teamAWinRate: number;
  teamBWinRate: number;
  drawRate: number;
}

export class MatchupAnalyzer {
  constructor(private repository: Repository) {}

  async getMatchupMatrix(decks: Deck[]): Promise<MatchupStats[]> {
    const matchups: MatchupStats[] = [];

    for (const deckA of decks) {
      for (const deckB of decks) {
        if (deckA.name === deckB.name) continue;

        const stats = await this.repository.getMatchupStats(deckA.name, deckB.name);
        
        if (stats && stats.total_matches > 0) {
          matchups.push({
            deckA: deckA.name,
            deckB: deckB.name,
            totalMatches: stats.total_matches,
            teamAWins: stats.teamA_wins,
            teamBWins: stats.teamB_wins,
            draws: stats.draws,
            avgDuration: stats.avg_duration || 0,
            teamAWinRate: (stats.teamA_wins / stats.total_matches) * 100,
            teamBWinRate: (stats.teamB_wins / stats.total_matches) * 100,
            drawRate: (stats.draws / stats.total_matches) * 100
          });
        }
      }
    }

    return matchups;
  }

  async getDeckPerformance(deckName: string): Promise<{
    totalMatches: number;
    wins: number;
    losses: number;
    draws: number;
    winRate: number;
    avgDuration: number;
  }> {
    const sql = `
      SELECT 
        COUNT(*) as total_matches,
        SUM(CASE WHEN 
          json_extract(team_a, '$.name') = ? AND winner = 'teamA' THEN 1
          WHEN json_extract(team_b, '$.name') = ? AND winner = 'teamB' THEN 1
          ELSE 0 END
        ) as wins,
        SUM(CASE WHEN 
          json_extract(team_a, '$.name') = ? AND winner = 'teamB' THEN 1
          WHEN json_extract(team_b, '$.name') = ? AND winner = 'teamA' THEN 1
          ELSE 0 END
        ) as losses,
        SUM(CASE WHEN winner = 'draw' THEN 1 ELSE 0 END) as draws,
        AVG(mr.duration) as avg_duration
      FROM matches m
      LEFT JOIN match_results mr ON m.id = mr.match_id
      WHERE json_extract(team_a, '$.name') = ? OR json_extract(team_b, '$.name') = ?
    `;

    const result = await this.repository.get(sql, [deckName, deckName, deckName, deckName, deckName, deckName]);
    
    if (!result || result.total_matches === 0) {
      return {
        totalMatches: 0,
        wins: 0,
        losses: 0,
        draws: 0,
        winRate: 0,
        avgDuration: 0
      };
    }

    return {
      totalMatches: result.total_matches,
      wins: result.wins,
      losses: result.losses,
      draws: result.draws,
      winRate: (result.wins / result.total_matches) * 100,
      avgDuration: result.avg_duration || 0
    };
  }

  generateMatchupReport(matchups: MatchupStats[]): string {
    let report = '# Matchup Analysis Report\n\n';
    
    report += '## Summary\n';
    report += `Total matchups analyzed: ${matchups.length}\n\n`;

    report += '## Matchup Matrix\n\n';
    report += '| Deck A | Deck B | Matches | A Wins | B Wins | Draws | A Win Rate | B Win Rate |\n';
    report += '|--------|--------|---------|--------|--------|-------|------------|------------|\n';

    for (const matchup of matchups.sort((a, b) => b.totalMatches - a.totalMatches)) {
      report += `| ${matchup.deckA} | ${matchup.deckB} | ${matchup.totalMatches} | `;
      report += `${matchup.teamAWins} | ${matchup.teamBWins} | ${matchup.draws} | `;
      report += `${matchup.teamAWinRate.toFixed(1)}% | ${matchup.teamBWinRate.toFixed(1)}% |\n`;
    }

    report += '\n## Top Performing Matchups\n\n';
    const topMatchups = matchups
      .filter(m => m.totalMatches >= 10)
      .sort((a, b) => b.teamAWinRate - a.teamAWinRate)
      .slice(0, 5);

    for (const matchup of topMatchups) {
      report += `- **${matchup.deckA} vs ${matchup.deckB}**: ${matchup.teamAWinRate.toFixed(1)}% win rate (${matchup.totalMatches} matches)\n`;
    }

    return report;
  }
}
