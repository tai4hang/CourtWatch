import { logger } from '../utils/logger.js';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

// Database type configuration
type DbType = 'oracle' | 'sqlite';

const DB_TYPE = (process.env.DB_TYPE as DbType) || 'sqlite';

// SQLite imports (only import if using SQLite)
let sqlite3: any = null;
let sqliteDb: any = null;

// Oracle imports
let oracledb: any = null;

async function initOracle() {
  oracledb = (await import('oracledb')).default;

  const dbConfig = {
    user: process.env.ORACLE_USER || 'admin',
    password: process.env.ORACLE_PASSWORD || '',
    connectString: process.env.ORACLE_CONNECT_STRING || '',
    walletLocation: process.env.ORACLE_WALLET_LOCATION,
    walletPassword: process.env.ORACLE_WALLET_PASSWORD,
  };

  try {
    const hasWallet = dbConfig.walletLocation && existsSync(dbConfig.walletLocation);
    
    if (hasWallet) {
      try {
        await oracledb.initOracleClient({ 
          configDir: dbConfig.walletLocation 
        });
        logger.info('Using Oracle Thick mode (with Instant Client)');
      } catch (thickError) {
        logger.warn({ error: thickError }, 'Failed to init Thick mode, trying Thin mode');
      }
    }

    const poolConfig: any = {
      user: dbConfig.user,
      password: dbConfig.password,
      connectString: dbConfig.connectString,
      poolMin: 2,
      poolMax: 10,
      poolIncrement: 2,
    };

    if (hasWallet && dbConfig.walletPassword) {
      poolConfig.walletDirectory = dbConfig.walletLocation;
      poolConfig.walletPassword = dbConfig.walletPassword;
    }

    const pool = await oracledb.createPool(poolConfig);
    logger.info('Oracle database pool created');
    return pool;
  } catch (error: any) {
    logger.error({ error: error.message, code: error.code }, 'Failed to initialize Oracle database');
    throw error;
  }
}

async function initSqlite() {
  try {
    const Database = require('better-sqlite3');
    const dbPath = process.env.SQLITE_PATH || './data/dev.db';
    
    // Ensure directory exists
    const fs = require('fs');
    const dir = require('path').dirname(dbPath);
    if (!existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    sqliteDb = new Database(dbPath);
    sqliteDb.pragma('journal_mode = WAL');
    
    // Initialize schema
    initializeSqliteSchema();
    
    logger.info('SQLite database initialized');
    return sqliteDb;
  } catch (error: any) {
    logger.error({ error: error.message }, 'Failed to initialize SQLite database');
    throw error;
  }
}

function initializeSqliteSchema() {
  const schema = `
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      name TEXT,
      password_hash TEXT NOT NULL,
      avatar_url TEXT,
      role TEXT DEFAULT 'USER' CHECK (role IN ('USER', 'ADMIN')),
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      refresh_token TEXT UNIQUE NOT NULL,
      expires_at TEXT NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS items (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      metadata TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS subscriptions (
      id TEXT PRIMARY KEY,
      user_id TEXT UNIQUE NOT NULL,
      stripe_subscription_id TEXT UNIQUE,
      stripe_customer_id TEXT,
      status TEXT DEFAULT 'TRIALING' CHECK (status IN ('TRIALING', 'ACTIVE', 'PAST_DUE', 'CANCELLED', 'UNPAID')),
      plan TEXT DEFAULT 'monthly',
      current_period_start TEXT,
      current_period_end TEXT,
      cancelled_at TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS payments (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      subscription_id TEXT,
      stripe_payment_id TEXT UNIQUE NOT NULL,
      amount INTEGER NOT NULL,
      currency TEXT DEFAULT 'usd',
      status TEXT DEFAULT 'pending',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      title TEXT NOT NULL,
      body TEXT NOT NULL,
      data TEXT,
      read_status INTEGER DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS activity_logs (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      action TEXT NOT NULL,
      entity_type TEXT,
      entity_id TEXT,
      metadata TEXT,
      ip_address TEXT,
      user_agent TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
    CREATE INDEX IF NOT EXISTS idx_items_user_id ON items(user_id);
    CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON notifications(user_id, read_status);
    CREATE INDEX IF NOT EXISTS idx_activity_logs_user_id ON activity_logs(user_id);
  `;

  sqliteDb.exec(schema);
}

// Connection pool/storage
let pool: any = null;

export async function initDb(): Promise<void> {
  logger.info(`Initializing ${DB_TYPE} database...`);
  
  if (DB_TYPE === 'oracle') {
    pool = await initOracle();
  } else {
    pool = await initSqlite();
  }
}

export async function getDbConnection(): Promise<any> {
  if (!pool) {
    await initDb();
  }
  
  if (DB_TYPE === 'oracle') {
    return pool.getConnection();
  } else {
    return pool;
  }
}

export async function closeDb(): Promise<void> {
  if (pool) {
    if (DB_TYPE === 'oracle') {
      await pool.close(0);
    } else {
      pool.close();
    }
    pool = null;
    logger.info('Database connection closed');
  }
}

// Helper function to run queries
export async function execute<T = any>(
  sql: string,
  params: any[] = []
): Promise<T[]> {
  const connection = await getDbConnection();
  
  try {
    if (DB_TYPE === 'oracle') {
      const result = await connection.execute(sql, params, {
        outFormat: (require('oracledb') as any).OUT_FORMAT_OBJECT,
      });
      return (result.rows || []) as T[];
    } else {
      // SQLite
      const stmt = connection.prepare(sql);
      const rows = params.length > 0 ? stmt.all(...params) : stmt.all();
      return rows as T[];
    }
  } finally {
    if (DB_TYPE === 'oracle') {
      await connection.close();
    }
  }
}

// Helper function to run a single query
export async function executeOne<T = any>(
  sql: string,
  params: any[] = []
): Promise<T | null> {
  const rows = await execute<T>(sql, params);
  return rows[0] || null;
}

// Helper for INSERT/UPDATE/DELETE
export async function run(
  sql: string,
  params: any[] = []
): Promise<{ rowsAffected: number; lastRowId?: string }> {
  const connection = await getDbConnection();
  
  try {
    if (DB_TYPE === 'oracle') {
      const result = await connection.execute(sql, params, {
        autoCommit: true,
      });
      return {
        rowsAffected: result.rowsAffected || 0,
        lastRowId: result.lastRowid?.toString(),
      };
    } else {
      // SQLite
      const stmt = connection.prepare(sql);
      const result = params.length > 0 ? stmt.run(...params) : stmt.run();
      return {
        rowsAffected: result.changes,
      };
    }
  } finally {
    if (DB_TYPE === 'oracle') {
      await connection.close();
    }
  }
}
