import oracledb from 'oracledb';
import { logger } from '../utils/logger.js';

// Oracle Cloud connection configuration
// For Oracle Autonomous DB, use Oracle Cloud infrastructure connections
// Format: (description=(address=(protocol=tcps)(port=1521)(host=HOST))(connect_data=(service_name=SERVICE)(security=(ssl_server_cert_dn="CN=atp.oraclecloud.com,O=Oracle Coud LLC,L=Redwood City,ST=California,C=US"))))

const dbConfig = {
  user: process.env.ORACLE_USER || 'admin',
  password: process.env.ORACLE_PASSWORD || '',
  connectString: process.env.ORACLE_CONNECT_STRING || '', // Oracle Cloud ATP connection string
  walletLocation: process.env.ORACLE_WALLET_LOCATION || './wallet',
  walletPassword: process.env.ORACLE_WALLET_PASSWORD || '',
  // For Oracle Cloud ATP with mutual TLS
  configDir: process.env.ORACLE_WALLET_LOCATION || './wallet',
};

let pool: oracledb.Pool | null = null;

export async function initDb(): Promise<void> {
  try {
    // For Oracle Cloud ATP, use thick mode with wallet
    if (process.env.ORACLE_WALLET_LOCATION) {
      await oracledb.initOracleClient({ configDir: dbConfig.walletLocation });
    }

    pool = await oracledb.createPool({
      user: dbConfig.user,
      password: dbConfig.password,
      connectString: dbConfig.connectString,
      poolMin: 2,
      poolMax: 10,
      poolIncrement: 2,
    });

    logger.info('Oracle database pool created');
  } catch (error) {
    logger.error({ error }, 'Failed to initialize Oracle database');
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
