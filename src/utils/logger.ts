import { TickLog } from '../core/tick';
import { UnitInstance } from '../entities/unitInstance';
import { writeFileSync, readFileSync } from 'fs';
import { join } from 'path';

export interface MatchSnapshot {
  tick: number;
  units: UnitInstance[];
  gridState: string;
}

export interface DebugSession {
  id: string;
  timestamp: Date;
  snapshots: MatchSnapshot[];
  logs: TickLog[];
}

export class DebugLogger {
  private sessions: Map<string, DebugSession> = new Map();
  private currentSession?: DebugSession;

  startSession(matchId?: string): string {
    const sessionId = matchId || `debug_${Date.now()}`;
    const session: DebugSession = {
      id: sessionId,
      timestamp: new Date(),
      snapshots: [],
      logs: []
    };

    this.sessions.set(sessionId, session);
    this.currentSession = session;

    console.log(`[DEBUG] Started debug session: ${sessionId}`);
    return sessionId;
  }

  logTick(tickLog: TickLog, units: UnitInstance[], gridState?: string): void {
    if (!this.currentSession) {
      console.warn('[DEBUG] No active debug session');
      return;
    }

    this.currentSession.logs.push(tickLog);
    
    const snapshot: MatchSnapshot = {
      tick: tickLog.tick,
      units: units.map(unit => ({ ...unit })),
      gridState: gridState || this.serializeGridState(units)
    };

    this.currentSession.snapshots.push(snapshot);

    if (tickLog.moves.length > 0 || tickLog.attacks.length > 0 || tickLog.deaths.length > 0) {
      console.log(`[DEBUG] Tick ${tickLog.tick}: ${tickLog.moves.length} moves, ${tickLog.attacks.length} attacks, ${tickLog.deaths.length} deaths`);
    }
  }

  endSession(): DebugSession | undefined {
    if (!this.currentSession) {
      console.warn('[DEBUG] No active debug session to end');
      return undefined;
    }

    const session = this.currentSession;
    console.log(`[DEBUG] Ended debug session: ${session.id} (${session.snapshots.length} ticks)`);
    
    this.currentSession = undefined;
    return session;
  }

  saveSession(sessionId: string, filePath?: string): void {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    const path = filePath || join(process.cwd(), `debug_session_${sessionId}.json`);
    const data = JSON.stringify(session, null, 2);
    
    writeFileSync(path, data);
    console.log(`[DEBUG] Saved session ${sessionId} to ${path}`);
  }

  loadSession(filePath: string): DebugSession {
    const data = readFileSync(filePath, 'utf-8');
    const session: DebugSession = JSON.parse(data);
    
    this.sessions.set(session.id, session);
    console.log(`[DEBUG] Loaded session ${session.id} from ${filePath}`);
    
    return session;
  }

  getSession(sessionId: string): DebugSession | undefined {
    return this.sessions.get(sessionId);
  }

  getSnapshot(sessionId: string, tick: number): MatchSnapshot | undefined {
    const session = this.sessions.get(sessionId);
    if (!session) return undefined;

    return session.snapshots.find(snapshot => snapshot.tick === tick);
  }

  replaySession(sessionId: string, onTick?: (snapshot: MatchSnapshot, log: TickLog) => void): void {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    console.log(`[DEBUG] Replaying session ${sessionId} (${session.snapshots.length} ticks)`);

    for (let i = 0; i < session.snapshots.length; i++) {
      const snapshot = session.snapshots[i];
      const log = session.logs[i];

      console.log(`[DEBUG] === Tick ${snapshot.tick} ===`);
      console.log(`[DEBUG] Active units: ${snapshot.units.filter(u => u.alive).length}`);
      
      if (onTick) {
        onTick(snapshot, log);
      }

      if (log.moves.length > 0) {
        console.log(`[DEBUG] Moves: ${log.moves.map(m => `${m.unitId} from (${m.from.x},${m.from.y}) to (${m.to.x},${m.to.y})`).join(', ')}`);
      }

      if (log.attacks.length > 0) {
        console.log(`[DEBUG] Attacks: ${log.attacks.map(a => `${a.attackerId} -> ${a.targetId} (${a.damage} dmg)`).join(', ')}`);
      }

      if (log.deaths.length > 0) {
        console.log(`[DEBUG] Deaths: ${log.deaths.map(d => `${d.unitId} (${d.teamId})`).join(', ')}`);
      }
    }
  }

  private serializeGridState(units: UnitInstance[]): string {
    const aliveUnits = units.filter(u => u.alive);
    return aliveUnits
      .sort((a, b) => a.id.localeCompare(b.id))
      .map(u => `${u.id}:(${u.position.x},${u.position.y})`)
      .join('|');
  }

  compareSnapshots(sessionId: string, tick1: number, tick2: number): void {
    const snapshot1 = this.getSnapshot(sessionId, tick1);
    const snapshot2 = this.getSnapshot(sessionId, tick2);

    if (!snapshot1 || !snapshot2) {
      console.error(`[DEBUG] Cannot compare snapshots - one or both not found`);
      return;
    }

    console.log(`[DEBUG] Comparing tick ${tick1} vs tick ${tick2}`);

    const units1 = new Map(snapshot1.units.map(u => [u.id, u]));
    const units2 = new Map(snapshot2.units.map(u => [u.id, u]));

    const allUnitIds = new Set([...units1.keys(), ...units2.keys()]);

    for (const unitId of allUnitIds) {
      const unit1 = units1.get(unitId);
      const unit2 = units2.get(unitId);

      if (!unit1) {
        console.log(`[DEBUG] ${unitId}: SPAWNED at (${unit2!.position.x},${unit2!.position.y})`);
      } else if (!unit2) {
        console.log(`[DEBUG] ${unitId}: REMOVED`);
      } else {
        const changes: string[] = [];
        
        if (unit1.position.x !== unit2.position.x || unit1.position.y !== unit2.position.y) {
          changes.push(`moved from (${unit1.position.x},${unit1.position.y}) to (${unit2.position.x},${unit2.position.y})`);
        }
        
        if (unit1.currentHp !== unit2.currentHp) {
          changes.push(`HP ${unit1.currentHp} -> ${unit2.currentHp}`);
        }
        
        if (unit1.alive !== unit2.alive) {
          changes.push(`alive ${unit1.alive} -> ${unit2.alive}`);
        }

        if (changes.length > 0) {
          console.log(`[DEBUG] ${unitId}: ${changes.join(', ')}`);
        }
      }
    }
  }
}
