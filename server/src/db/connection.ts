import oracledb from 'oracledb';
import { logger } from '../utils/logger.js';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

// Oracle Cloud AI DB configuration

const dbConfig = {
  user: process.env.ORACLE_USER || 'admin',
  password: process.env.ORACLE_PASSWORD || '',
  connectString: process.env.ORACLE_CONNECT_STRING || '',
  walletLocation: process.env.ORACLE_WALLET_LOCATION,
  walletPassword: process.env.ORACLE_WALLET_PASSWORD,
};

let pool: oracledb.Pool | null = null;

export async function initDb(): Promise<void> {
  try {
    // Check if we have wallet and Instant Client (for Docker/production)
    const hasWallet = dbConfig.walletLocation && existsSync(dbConfig.walletLocation);
    
    // Try to use Thick mode if wallet exists
    if (hasWallet) {
      try {
        // Initialize Oracle Client for Thick mode (requires Instant Client)
        await oracledb.initOracleClient({ 
          configDir: dbConfig.walletLocation 
        });
        logger.info('Using Oracle Thick mode (with Instant Client)');
      } catch (thickError) {
        logger.warn({ error: thickError }, 'Failed to init Thick mode, trying Thin mode');
      }
    }

    const poolConfig: oracledb.PoolAttributes = {
      user: dbConfig.user,
      password: dbConfig.password,
      connectString: dbConfig.connectString,
      poolMin: 2,
      poolMax: 10,
      poolIncrement: 2,
    };

    // Add wallet config if available (for Oracle Cloud ATP)
    if (hasWallet && dbConfig.walletPassword) {
      poolConfig.walletDirectory = dbConfig.walletLocation;
      poolConfig.walletPassword = dbConfig.walletPassword;
    }

    pool = await oracledb.createPool(poolConfig);
    logger.info('Oracle database pool created');
  } catch (error: any) {
    logger.error({ error: error.message, code: error.code }, 'Failed to initialize Oracle database');
    throw error;
  }
}

export async function getDbConnection(): Promise<oracledb.Connection> {
  if (!pool) {
    await initDb();
  }
  return pool!.getConnection();
}

export async function closeDb(): Promise<void> {
  if (pool) {
    await pool.close(0);
    pool = null;
    logger.info('Oracle database pool closed');
  }
}

// Helper function to run queries
export async function execute<T = any>(
  sql: string,
  params: any[] = []
): Promise<T[]> {
  const connection = await getDbConnection();
  try {
    const result = await connection.execute(sql, params, {
      outFormat: oracledb.OUT_FORMAT_OBJECT,
    });
    return (result.rows || []) as T[];
  } finally {
    await connection.close();
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
    const result = await connection.execute(sql, params, {
      autoCommit: true,
    });
    return {
      rowsAffected: result.rowsAffected || 0,
      lastRowId: result.lastRowid?.toString(),
    };
  } finally {
    await connection.close();
  }
}
