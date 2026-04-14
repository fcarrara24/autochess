import { SQLiteDatabase } from './sqlite';
import { UnitTemplate } from '../entities/unitTemplate';
import { MatchResult } from '../core/engine';
import { Deck } from '../entities/deck';

export class Repository {
  constructor(private db: SQLiteDatabase) {}

  // Unit Templates
  async saveUnitTemplate(template: UnitTemplate): Promise<void> {
    const sql = `
      INSERT OR REPLACE INTO unit_templates 
      (id, name, hp, damage, range, movement_cooldown, attack_cooldown, tags)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `;
    await this.db.run(sql, [
      template.id,
      template.name,
      template.hp,
      template.damage,
      template.range,
      template.movementCooldown,
      template.attackCooldown,
      JSON.stringify(template.tags)
    ]);
  }

  async getUnitTemplate(id: string): Promise<UnitTemplate | null> {
    const sql = 'SELECT * FROM unit_templates WHERE id = ?';
    const row = await this.db.get(sql, [id]);
    
    if (!row) return null;
    
    return {
      id: row.id,
      name: row.name,
      hp: row.hp,
      damage: row.damage,
      range: row.range,
      movementCooldown: row.movement_cooldown,
      attackCooldown: row.attack_cooldown,
      tags: JSON.parse(row.tags)
    };
  }

  async getAllUnitTemplates(): Promise<UnitTemplate[]> {
    const sql = 'SELECT * FROM unit_templates';
    const rows = await this.db.all(sql);
    
    return rows.map(row => ({
      id: row.id,
      name: row.name,
      hp: row.hp,
      damage: row.damage,
      range: row.range,
      movementCooldown: row.movement_cooldown,
      attackCooldown: row.attack_cooldown,
      tags: JSON.parse(row.tags)
    }));
  }

  // Matches
  async saveMatch(match: MatchResult, teamA: Deck, teamB: Deck): Promise<number> {
    const matchSql = `
      INSERT INTO matches (winner, turns, team_a, team_b)
      VALUES (?, ?, ?, ?)
    `;
    
    const result = await this.db.run(matchSql, [
      match.winner,
      match.totalTicks,
      JSON.stringify(teamA),
      JSON.stringify(teamB)
    ]);
    
    const matchId = result.lastID!;
    
    const resultSql = `
      INSERT INTO match_results 
      (match_id, total_damage_team_a, total_damage_team_b, units_killed_team_a, units_killed_team_b, duration)
      VALUES (?, ?, ?, ?, ?, ?)
    `;
    
    await this.db.run(resultSql, [
      matchId,
      match.summaryStats.totalDamageDealt.teamA,
      match.summaryStats.totalDamageDealt.teamB,
      match.summaryStats.unitsKilled.teamA,
      match.summaryStats.unitsKilled.teamB,
      match.totalTicks
    ]);
    
    return matchId;
  }

  async getMatch(id: number): Promise<any> {
    const sql = `
      SELECT m.*, mr.total_damage_team_a, mr.total_damage_team_b, 
             mr.units_killed_team_a, mr.units_killed_team_b, mr.duration
      FROM matches m
      LEFT JOIN match_results mr ON m.id = mr.match_id
      WHERE m.id = ?
    `;
    return await this.db.get(sql, [id]);
  }

  async getWinRateByTemplate(templateId: string): Promise<number> {
    const sql = `
      SELECT 
        COUNT(CASE WHEN winner = 'teamA' THEN 1 END) * 100.0 / COUNT(*) as winrate
      FROM matches m
      WHERE json_extract(m.team_a, '$.units') LIKE '%"templateId":"' || ? || '"%'
    `;
    const result = await this.db.get(sql, [templateId]);
    return result?.winrate || 0;
  }

  async getMatchupStats(deckA: string, deckB: string): Promise<any> {
    const sql = `
      SELECT 
        COUNT(*) as total_matches,
        COUNT(CASE WHEN winner = 'teamA' THEN 1 END) as teamA_wins,
        COUNT(CASE WHEN winner = 'teamB' THEN 1 END) as teamB_wins,
        COUNT(CASE WHEN winner = 'draw' THEN 1 END) as draws,
        AVG(mr.duration) as avg_duration
      FROM matches m
      LEFT JOIN match_results mr ON m.id = mr.match_id
      WHERE json_extract(m.team_a, '$.name') = ? 
        AND json_extract(m.team_b, '$.name') = ?
    `;
    return await this.db.get(sql, [deckA, deckB]);
  }

  async getRecentMatches(limit: number = 10): Promise<any[]> {
    const sql = `
      SELECT m.*, mr.total_damage_team_a, mr.total_damage_team_b, 
             mr.units_killed_team_a, mr.units_killed_team_b, mr.duration
      FROM matches m
      LEFT JOIN match_results mr ON m.id = mr.match_id
      ORDER BY m.timestamp DESC
      LIMIT ?
    `;
    return await this.db.all(sql, [limit]);
  }

  async get(sql: string, params?: any[]): Promise<any> {
    return await this.db.get(sql, params);
  }
}
