import sqlite3 from 'sqlite3';
import { readFileSync } from 'fs';
import { join } from 'path';

export class SQLiteDatabase {
  private db: sqlite3.Database;

  constructor(dbPath: string = './autochess.db') {
    this.db = new sqlite3.Database(dbPath);
    this.initializeSchema();
  }

  private initializeSchema(): void {
    const schemaPath = join(__dirname, 'schema.sql');
    const schema = readFileSync(schemaPath, 'utf-8');
    
    this.db.serialize(() => {
      const statements = schema.split(';').filter(stmt => stmt.trim());
      
      for (const statement of statements) {
        if (statement.trim()) {
          this.db.run(statement, (err) => {
            if (err) {
              console.error('Schema initialization error:', err);
            }
          });
        }
      }
    });
  }

  getDatabase(): sqlite3.Database {
    return this.db;
  }

  close(): void {
    this.db.close();
  }

  // Async query helpers
  run(sql: string, params?: any[]): Promise<sqlite3.RunResult> {
    return new Promise((resolve, reject) => {
      this.db.run(sql, params, function(err) {
        if (err) reject(err);
        else resolve(this);
      });
    });
  }

  get(sql: string, params?: any[]): Promise<any> {
    return new Promise((resolve, reject) => {
      this.db.get(sql, params, (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  }

  all(sql: string, params?: any[]): Promise<any[]> {
    return new Promise((resolve, reject) => {
      this.db.all(sql, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }

  // Transaction helper
  transaction<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this.db.serialize(() => {
        this.db.run('BEGIN TRANSACTION');
        
        fn()
          .then(result => {
            this.db.run('COMMIT', (err) => {
              if (err) reject(err);
              else resolve(result);
            });
          })
          .catch(err => {
            this.db.run('ROLLBACK');
            reject(err);
          });
      });
    });
  }
}
