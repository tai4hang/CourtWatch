/**
 * Database Connection Layer
 * 
 * Supports Firestore (production) and SQLite (local dev without credentials)
 * 
 * Environment Variables:
 *   DB_TYPE=firestore - Use Firestore (Cloud Run, GCP)
 *   DB_TYPE=sqlite - Use SQLite (local development)
 *   FIRESTORE_EMULATOR_HOST=host:port - Use Firestore emulator
 */

import { logger } from '../utils/logger.js';
import type { Firestore } from 'firebase-admin/firestore';

type DbType = 'firestore' | 'sqlite';
const DB_TYPE = (process.env.DB_TYPE as DbType) || 'firestore';

let db: Firestore | any = null;
let initialized = false;

async function initSqlite() {
  const initSqliteDb = (await import('sql.js')).default;
  const fs = await import('fs');
  
  const SQL = await initSqliteDb();
  const dbPath = process.env.SQLITE_PATH || './data/dev.db';
  
  // Ensure directory exists
  const dir = './data';
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  
  let dbBuffer: Buffer | null = null;
  if (fs.existsSync(dbPath)) {
    dbBuffer = fs.readFileSync(dbPath);
  }
  
  const sqliteDb = dbBuffer ? new SQL.Database(dbBuffer) : new SQL.Database();
  
  // Create tables
  const schema = `
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      name TEXT,
      password_hash TEXT NOT NULL,
      avatar_url TEXT,
      role TEXT DEFAULT 'USER',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
    
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      access_token TEXT,
      refresh_token TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );
    
    CREATE TABLE IF NOT EXISTS courts (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      address TEXT NOT NULL,
      latitude REAL NOT NULL,
      longitude REAL NOT NULL,
      total_courts INTEGER DEFAULT 1,
      court_type TEXT DEFAULT 'tennis',
      surface TEXT DEFAULT 'hard',
      has_lights INTEGER DEFAULT 0,
      is_free INTEGER DEFAULT 0,
      google_maps_url TEXT,
      notes TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
    
    CREATE TABLE IF NOT EXISTS favorite_courts (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      court_id TEXT NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (court_id) REFERENCES courts(id)
    );
    
    CREATE TABLE IF NOT EXISTS court_reports (
      id TEXT PRIMARY KEY,
      court_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      available_courts INTEGER,
      queue_groups INTEGER,
      wait_time_minutes INTEGER,
      status TEXT NOT NULL,
      report_type TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (court_id) REFERENCES courts(id),
      FOREIGN KEY (user_id) REFERENCES users(id)
    );
  `;
  
  sqliteDb.run(schema);
  
  return sqliteDb;
}

async function initFirestoreDb() {
  // Must set emulator env var BEFORE importing firebase-admin
  const emulatorHost = process.env.FIRESTORE_EMULATOR_HOST;
  if (emulatorHost) {
    process.env.FIRESTORE_EMULATOR_HOST = emulatorHost;
    process.env.GCLOUD_PROJECT = process.env.GCP_PROJECT || 'demo-project';
    console.log('Firestore emulator mode:', emulatorHost);
  }
  
  const { initFirestore } = await import('./firestore.js');
  return initFirestore();
}

export async function initDb(): Promise<void> {
  if (initialized) return;
  
  logger.info(`Initializing ${DB_TYPE} database...`);
  
  if (DB_TYPE === 'firestore') {
    db = await initFirestoreDb();
    logger.info('Firestore initialized successfully');
  } else {
    db = await initSqlite();
    logger.info('SQLite connected');
  }
  
  initialized = true;
}

export function getDbConnection(): Firestore | any {
  if (!db) {
    throw new Error('Database not initialized. Call initDb() first.');
  }
  return db;
}

export async function closeDb(): Promise<void> {
  db = null;
  initialized = false;
  logger.info('Database connection closed');
}

// Legacy SQL exports (only work in SQLite mode)
export async function execute<T = any>(sql: string, params: any[] = []): Promise<T[]> {
  if (DB_TYPE !== 'sqlite') {
    throw new Error('SQL queries only supported in SQLite mode');
  }
  
  const sqliteDb = getDbConnection();
  const stmt = sqliteDb.prepare(sql);
  stmt.bind(params);
  
  const results: T[] = [];
  while (stmt.step()) {
    results.push(stmt.getAsObject() as T);
  }
  stmt.free();
  
  return results;
}

export async function executeOne<T = any>(sql: string, params: any[] = []): Promise<T | null> {
  const results = await execute<T>(sql, params);
  return results[0] || null;
}

export async function run(sql: string, params: any[] = []): Promise<void> {
  if (DB_TYPE !== 'sqlite') {
    throw new Error('SQL queries only supported in SQLite mode');
  }
  
  const sqliteDb = getDbConnection();
  sqliteDb.run(sql, params);
}