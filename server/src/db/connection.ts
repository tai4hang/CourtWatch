/**
 * Database Connection Layer
 * 
 * This module supports two database backends:
 * 
 * 1. SQLite (default) - For local development/testing
 *    - Set DB_TYPE=sqlite
 *    - No external dependencies needed
 *    - Data stored in ./data/dev.db (configurable via SQLITE_PATH)
 *    - Uses sql.js (WebAssembly-based SQLite)
 * 
 * 2. Oracle Cloud AI Database - For production
 *    - Set DB_TYPE=oracle
 *    - Requires Oracle Cloud ATP/ADW credentials
 *    - Uses TLS-only (SERVER authentication) on port 1521
 *    - No wallet required - credentials passed directly
 * 
 * =============================================================================
 * ENVIRONMENT VARIABLES
 * =============================================================================
 * 
 * For SQLite (defaults shown):
 *   DB_TYPE=sqlite
 *   SQLITE_PATH=./data/dev.db
 * 
 * For Oracle (required):
 *   DB_TYPE=oracle
 *   ORACLE_USER=admin
 *   ORACLE_PASSWORD=your_password
 *   ORACLE_CONNECT_STRING=your_service_name (e.g., gc4a69fc3be605f_ub3ak3mtvbqjs41l_tp.adb.oraclecloud.com)
 * 
 * =============================================================================
 * ORACLE CLOUD AI DATABASE - CONNECTION SETUP (CRITICAL!)
 * =============================================================================
 * 
 * ⚠️  IMPORTANT: Oracle Cloud ATP has TWO connection modes:
 * 
 * 1. TLS-only (SERVER authentication) - No wallet needed
 *    - Port: 1521
 *    - Protocol: TCPS (NOT TCP!)
 *    - Connection string format:
 *      (description= (retry_count=20)(retry_delay=3)(address=(protocol=tcps)(port=1521)(host=adb.us-ashburn-1.oraclecloud.com))(connect_data=(service_name=YOUR_SERVICE_NAME))(security=(ssl_server_dn_match=yes)))
 *    - This is what we use - no wallet required!
 * 
 * 2. mTLS (MUTUAL authentication) - Wallet required
 *    - Port: 1522
 *    - Protocol: TCPS
 *    - Requires wallet files (cwallet.sso, ewallet.p12, etc.)
 *    - Wallet password needed (may differ from DB password)
 *    - See connection strings from OCI console for mTLS URLs
 * 
 * =============================================================================
 * COMMON CONNECTION ERRORS & SOLUTIONS
 * =============================================================================
 * 
 * Error: "NJS-501: connection terminated unexpectedly (ECONNRESET)"
 *   → Database may be paused (Autonomous DB auto-pauses after inactivity)
 *   → Or using wrong port/protocol combination
 *   → Solution: Resume DB in OCI console, or use correct TLS-only connection
 * 
 * Error: "NJS-530: host addresses or URLs provided by connect string are incorrect"
 *   → Connection string format is wrong
 *   → Solution: Use the full connection descriptor with (protocol=tcps)(port=1521)
 * 
 * Error: "NJS-505: unable to initiate TLS connection - bad decrypt"
 *   → Wallet password is wrong (for mTLS connections)
 *   → Solution: Use TLS-only mode (port 1521) instead, no wallet needed
 * 
 * Error: "NJS-516: no configuration directory set or available to search for tnsnames.ora"
 *   → TNS_ADMIN not set or wallet path wrong
 *   → Solution: For TLS-only, use full connection descriptor (no TNS_ADMIN needed)
 * 
 * Error: "DPI-1047: Cannot locate a 64-bit Oracle Client library"
 *   → Using thick mode without Instant Client
 *   → Solution: Works fine in thin mode (no initOracleClient needed for TLS-only)
 * 
 * Error: "NJS-040: connection request timeout - queueTimeout exceeded"
 *   → Database cannot be reached or is unresponsive
 *   → Check if DB is paused in OCI console
 * 
 * =============================================================================
 * HOW TO GET CORRECT CONNECTION STRING FROM OCI
 * =============================================================================
 * 
 * 1. Go to Oracle Cloud Console → Autonomous Database → your DB
 * 2. Click "DB Connection" button
 * 3. Look at "Connection Strings" section
 * 4. For TLS-only (no wallet): Use the string with:
 *    - Protocol: TCPS (not TCP!)
 *    - Port: 1521 (not 1522)
 *    - TLS Authentication: SERVER (not MUTUAL)
 * 5. The service name is in the format: gc4a69fc3be605f_ub3ak3mtvbqjs41l_tp.adb.oraclecloud.com
 * 
 * =============================================================================
 * IMPORTANT: SQL SYNTAX DIFFERENCES
 * =============================================================================
 * 
 * Oracle and SQLite have different SQL dialects. This module automatically
 * converts certain Oracle-specific syntax to SQLite equivalents:
 * 
 * 1. Pagination:
 *    Oracle:  SELECT ... OFFSET :offset ROWS FETCH NEXT :limit ROWS ONLY
 *    SQLite:  SELECT ... LIMIT :limit OFFSET :offset
 *    (Handled in execute() function - see convertSqlForDbType())
 * 
 * 2. Parameter Binding:
 *    Oracle:  Uses named parameters (:1, :2, etc.)
 *    SQLite:  sql.js exec() doesn't support params - manual string interpolation
 *    (Handled in execute() function)
 * 
 * 3. LOB Handling:
 *    Oracle:  Returns LOB objects that need getData() to read
 *    SQLite:  Returns strings directly
 *    (Handled in transformRowKeys() function)
 * 
 * 4. Key Case:
 *    Oracle:  Column names are UPPERCASE
 *    SQLite:  Column names are as specified in schema
 *    (Handled in transformRowKeys() function - converts to lowercase)
 * 
 * =============================================================================
 * TESTING THE CONNECTION
 * =============================================================================
 * 
 * To test Oracle connection manually:
 * 
 *   node -e "
 *   const oracledb = require('oracledb');
 *   const conn = await oracledb.getConnection({
 *     user: 'admin',
 *     password: 'YOUR_PASSWORD',
 *     connectString: '(description= (retry_count=20)(retry_delay=3)(address=(protocol=tcps)(port=1521)(host=adb.us-ashburn-1.oraclecloud.com))(connect_data=(service_name=YOUR_SERVICE_NAME))(security=(ssl_server_dn_match=yes)))'
 *   });
 *   console.log(await conn.execute('SELECT SYSDATE FROM DUAL'));
 *   await conn.close();
 *   "
 * 
 * =============================================================================
 */

import { logger } from '../utils/logger.js';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

// Database type configuration - controls which database is used
// Set DB_TYPE=oracle for Oracle Cloud, DB_TYPE=sqlite (default) for local
type DbType = 'oracle' | 'sqlite';
const DB_TYPE = (process.env.DB_TYPE as DbType) || 'sqlite';

// SQLite imports (only used when DB_TYPE=sqlite)
let sqlite3: any = null;
let sqliteDb: any = null;

// Oracle imports (only used when DB_TYPE=oracle)
let oracledb: any = null;

/**
 * Initialize Oracle Cloud AI Database connection
 * 
 * Uses TCP protocol with mTLS DISABLED:
 * - Protocol: tcp (not tcps)
 * - Port: 1521 (not 1522)
 * - No wallet required
 * - Credentials passed via environment variables
 */
async function initOracle() {
  oracledb = (await import('oracledb')).default;

  // Get Oracle connection config from environment (must be set via OCI Secret in entrypoint)
  const dbUser = process.env.ORACLE_USER;
  const dbPassword = process.env.ORACLE_PASSWORD;
  const rawConnectString = process.env.ORACLE_CONNECT_STRING || '';
  
  if (!rawConnectString) {
    throw new Error('ORACLE_CONNECT_STRING environment variable is not set');
  }
  
  // =====================================================================
  // CRITICAL: Use TCPS (TLS) on port 1521, NOT TCP on port 1521!
  // 
  // Oracle Cloud ATP requires TLS encryption. Common mistake is using:
  //   ❌ protocol=tcp (plain TCP - will fail!)
  //   ✅ protocol=tcps (TLS encrypted - required!)
  //
  // Port 1521 = TLS-only (SERVER auth) - no client certificate needed
  // Port 1522 = mTLS (MUTUAL auth) - client certificate/wallet required
  // =====================================================================
  
  // Check if already a full descriptor (starts with "(description=")
  let connectDescriptor: string;
  if (rawConnectString.trim().startsWith('(description=')) {
    connectDescriptor = rawConnectString;
    logger.info('Using full Oracle connect descriptor from environment');
  } else {
    // Build the full TCPS descriptor
    connectDescriptor = `(description= 
    (retry_count=20)(retry_delay=3)
    (address=(protocol=tcps)(port=1521)(host=adb.us-ashburn-1.oraclecloud.com))
    (connect_data=(service_name=${rawConnectString}))
    (security=(ssl_server_dn_match=yes))
  )`;
  }

  try {
    // Use thin mode (no Instant Client needed for TLS-only connections)
    // Thick mode requires Oracle Instant Client libraries installed
    try {
      await oracledb.initOracleClient({ 
        // Thick mode requires Instant Client - optional but faster
      });
      logger.info('Using Oracle Thick mode');
    } catch (thickError) {
      // This is expected in most environments - thin mode works fine
      logger.warn({ error: thickError }, 'Using Oracle Thin mode (no Instant Client)');
    }

    const poolConfig: any = {
      user: dbUser,
      password: dbPassword,
      connectString: connectDescriptor,
      poolMin: 2,
      poolMax: 10,
      poolIncrement: 2,
      // TLS-only mode: no wallet, no mTLS
    };

    const pool = await oracledb.createPool(poolConfig);
    logger.info('Oracle database pool created (TLS-only, no wallet)');
    
    // Initialize schema (create tables if not exist) - with timeout
    // IMPORTANT: Must complete before returning pool
    try {
      const schemaTimeout = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Schema init timeout')), 30000)
      );
      await Promise.race([initializeOracleSchema(pool), schemaTimeout]);
      logger.info('Oracle schema initialized');
    } catch (schemaError: any) {
      logger.warn({ error: schemaError.message }, 'Schema init skipped or failed');
    }
    
    return pool;
  } catch (error: any) {
    logger.error({ error: error.message, code: error.code }, 'Failed to initialize Oracle database');
    throw error;
  }
}

/**
 * Initialize SQLite database for local development/testing
 * 
 * Uses sql.js (SQLite compiled to WebAssembly):
 * - No external database server needed
 * - Data persisted to file specified by SQLITE_PATH
 * - Schema automatically created on first run
 * 
 * Note: sql.js has some limitations compared to native SQLite:
 * - No concurrent writes (single connection recommended)
 * - Some SQLite features not supported
 * - Parameter binding not supported - uses manual string interpolation
 */
async function initSqlite() {
  try {
    const initSqlJs = require('sql.js');
    // Default path: ./data/dev.db in server directory
    // Override with SQLITE_PATH environment variable for custom location
    const dbPath = process.env.SQLITE_PATH || './data/dev.db';
    // WASM file must be in the same directory as the compiled JS
    const wasmPath = require('path').join(__dirname, 'sql-wasm.wasm');
    
    // Ensure directory exists
    const fs = require('fs');
    const dir = require('path').dirname(dbPath);
    if (!existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    // Initialize SQL.js with explicit WASM path and no workers
    const SQL = await initSqlJs({
      locateFile: () => wasmPath
    });
    
    // Load existing database or create new one
    let dbBuffer = null;
    if (existsSync(dbPath)) {
      dbBuffer = fs.readFileSync(dbPath);
    }
    
    sqliteDb = new SQL.Database(dbBuffer);
    
    // Initialize schema
    initializeSqliteSchema();
    
    // Save to file
    const data = sqliteDb.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(dbPath, buffer);
    
    // Set up periodic save
    setInterval(() => {
      try {
        const data = sqliteDb.export();
        const buffer = Buffer.from(data);
        fs.writeFileSync(dbPath, buffer);
      } catch (e) {
        logger.error({ error: e.message }, 'Failed to save SQLite database');
      }
    }, 5000);
    
    logger.info('SQLite database initialized');
    return sqliteDb;
  } catch (error: any) {
    logger.error({ error: error.message }, 'Failed to initialize SQLite database');
    throw error;
  }
}

async function initializeOracleSchema(pool: any) {
  const schemaStatements = [
    `CREATE TABLE users (
      id VARCHAR2(255) PRIMARY KEY,
      email VARCHAR2(255) UNIQUE NOT NULL,
      name VARCHAR2(255),
      password_hash VARCHAR2(255) NOT NULL,
      avatar_url VARCHAR2(500),
      role VARCHAR2(20) DEFAULT 'USER',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE sessions (
      id VARCHAR2(255) PRIMARY KEY,
      user_id VARCHAR2(255) NOT NULL,
      access_token VARCHAR2(500),
      refresh_token VARCHAR2(500) UNIQUE NOT NULL,
      expires_at TIMESTAMP NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )`,
    `CREATE TABLE courts (
      id VARCHAR2(255) PRIMARY KEY,
      name VARCHAR2(500) NOT NULL,
      address VARCHAR2(1000) NOT NULL,
      latitude NUMBER NOT NULL,
      longitude NUMBER NOT NULL,
      total_courts NUMBER NOT NULL,
      court_type VARCHAR2(20) NOT NULL,
      surface VARCHAR2(20) NOT NULL,
      has_lights NUMBER DEFAULT 0,
      is_free NUMBER DEFAULT 0,
      google_maps_url VARCHAR2(500),
      notes CLOB,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE court_reports (
      id VARCHAR2(255) PRIMARY KEY,
      court_id VARCHAR2(255) NOT NULL,
      user_id VARCHAR2(255) NOT NULL,
      available_courts NUMBER DEFAULT 0,
      queue_groups NUMBER DEFAULT 0,
      wait_time_minutes NUMBER,
      status VARCHAR2(20) NOT NULL,
      report_type VARCHAR2(20) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (court_id) REFERENCES courts(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )`,
    `CREATE TABLE favorite_courts (
      id VARCHAR2(255) PRIMARY KEY,
      user_id VARCHAR2(255) NOT NULL,
      court_id VARCHAR2(255) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (court_id) REFERENCES courts(id) ON DELETE CASCADE,
      UNIQUE (user_id, court_id)
    )`,
    `CREATE TABLE items (
      id VARCHAR2(255) PRIMARY KEY,
      user_id VARCHAR2(255) NOT NULL,
      title VARCHAR2(500) NOT NULL,
      description CLOB,
      metadata CLOB,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )`,
    `CREATE TABLE subscriptions (
      id VARCHAR2(255) PRIMARY KEY,
      user_id VARCHAR2(255) UNIQUE NOT NULL,
      stripe_subscription_id VARCHAR2(255) UNIQUE,
      stripe_customer_id VARCHAR2(255),
      status VARCHAR2(20) DEFAULT 'TRIALING',
      plan VARCHAR2(20) DEFAULT 'monthly',
      current_period_start TIMESTAMP,
      current_period_end TIMESTAMP,
      cancelled_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )`,
    `CREATE TABLE payments (
      id VARCHAR2(255) PRIMARY KEY,
      user_id VARCHAR2(255) NOT NULL,
      subscription_id VARCHAR2(255),
      stripe_payment_id VARCHAR2(255) UNIQUE NOT NULL,
      amount NUMBER NOT NULL,
      currency VARCHAR2(10) DEFAULT 'usd',
      status VARCHAR2(20) DEFAULT 'pending',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )`,
    `CREATE TABLE notifications (
      id VARCHAR2(255) PRIMARY KEY,
      user_id VARCHAR2(255) NOT NULL,
      title VARCHAR2(500) NOT NULL,
      body CLOB NOT NULL,
      data CLOB,
      read_status NUMBER DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )`,
    `CREATE TABLE activity_logs (
      id VARCHAR2(255) PRIMARY KEY,
      user_id VARCHAR2(255),
      action VARCHAR2(100) NOT NULL,
      entity_type VARCHAR2(100),
      entity_id VARCHAR2(255),
      metadata CLOB,
      ip_address VARCHAR2(50),
      user_agent VARCHAR2(500),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,
  ];
  
  const indexStatements = [
    `CREATE INDEX idx_sessions_user_id ON sessions(user_id)`,
    `CREATE INDEX idx_courts_location ON courts(latitude, longitude)`,
    `CREATE INDEX idx_court_reports_court_id ON court_reports(court_id, created_at)`,
    `CREATE INDEX idx_favorite_courts_user_id ON favorite_courts(user_id)`,
    `CREATE INDEX idx_items_user_id ON items(user_id)`,
    `CREATE INDEX idx_notifications_user_read ON notifications(user_id, read_status)`,
    `CREATE INDEX idx_activity_logs_user_id ON activity_logs(user_id)`,
  ];

  const connection = await pool.getConnection();
  try {
    // Create tables
    for (const sql of schemaStatements) {
      try {
        await connection.execute(sql);
        logger.info({ sql: sql.substring(0, 50) + '...' }, 'Table created');
      } catch (err: any) {
        // Ignore "table already exists" errors (ORA-00955)
        if (err.errorNum !== 955 && err.errorNum !== 1408) {
          logger.warn({ error: err.message, sql: sql.substring(0, 50) }, 'Skipped table statement');
        }
      }
    }
    
    // Create indexes (ignore if already exist)
    for (const sql of indexStatements) {
      try {
        await connection.execute(sql);
        logger.info({ sql: sql.substring(0, 50) + '...' }, 'Index created');
      } catch (err: any) {
        // Ignore "index already exists" errors (ORA-00955)
        if (err.errorNum !== 955) {
          logger.warn({ error: err.message, sql: sql.substring(0, 50) }, 'Skipped index statement');
        }
      }
    }
    
    logger.info('Oracle schema initialized');
  } finally {
    await connection.close();
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
      access_token TEXT,
      refresh_token TEXT UNIQUE NOT NULL,
      expires_at TEXT NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS courts (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      address TEXT NOT NULL,
      latitude REAL NOT NULL,
      longitude REAL NOT NULL,
      total_courts INTEGER NOT NULL,
      court_type TEXT NOT NULL CHECK (court_type IN ('indoor', 'outdoor', 'both')),
      surface TEXT NOT NULL CHECK (surface IN ('hard', 'clay', 'grass', 'carpet')),
      has_lights INTEGER DEFAULT 0,
      is_free INTEGER DEFAULT 0,
      google_maps_url TEXT,
      notes TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS court_reports (
      id TEXT PRIMARY KEY,
      court_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      available_courts INTEGER DEFAULT 0,
      queue_groups INTEGER DEFAULT 0,
      wait_time_minutes INTEGER,
      status TEXT NOT NULL CHECK (status IN ('available', 'partial', 'full')),
      report_type TEXT NOT NULL CHECK (report_type IN ('availability', 'queue')),
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (court_id) REFERENCES courts(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS favorite_courts (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      court_id TEXT NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (court_id) REFERENCES courts(id) ON DELETE CASCADE,
      UNIQUE (user_id, court_id)
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
    CREATE INDEX IF NOT EXISTS idx_courts_location ON courts(latitude, longitude);
    CREATE INDEX IF NOT EXISTS idx_court_reports_court_id ON court_reports(court_id, created_at);
    CREATE INDEX IF NOT EXISTS idx_favorite_courts_user_id ON favorite_courts(user_id);
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

// Helper function to convert Oracle LOB objects to strings
async function convertLobsToStrings(row: any): Promise<any> {
  const converted: any = {};
  
  for (const key of Object.keys(row)) {
    const value = row[key];
    
    // Check if value is an Oracle Lob object (has _type property that indicates LOB)
    if (value && typeof value === 'object' && value._type !== undefined) {
      try {
        // Use getData() method which is the proper way to read LOB data in thin mode
        if (typeof value.getData === 'function') {
          const data = await value.getData();
          converted[key.toLowerCase()] = data;
          continue;
        }
        // Fallback to read method if getData doesn't work
        if (typeof value.read === 'function') {
          const chunks: string[] = [];
          let chunk;
          while ((chunk = await value.read()) !== undefined) {
            if (typeof chunk === 'string') {
              chunks.push(chunk);
            } else if (Buffer.isBuffer(chunk)) {
              chunks.push(chunk.toString('utf-8'));
            }
          }
          converted[key.toLowerCase()] = chunks.join('');
          continue;
        }
      } catch (err) {
        // If we can't read the LOB, just store null
        logger.warn({ key, error: err }, 'Failed to convert LOB to string');
        converted[key.toLowerCase()] = null;
        continue;
      }
    }
    
    converted[key.toLowerCase()] = value;
  }
  
  return converted;
}

// Helper function to convert Oracle row keys to lowercase and handle LOBs
async function transformRowKeys<T>(row: any): Promise<T> {
  // First convert all keys to lowercase
  const transformed: any = {};
  for (const key of Object.keys(row)) {
    transformed[key.toLowerCase()] = row[key];
  }
  
  // If using Oracle, convert LOBs to strings
  if (DB_TYPE === 'oracle') {
    return await convertLobsToStrings(transformed) as T;
  }
  
  return transformed as T;
}

/**
 * Execute a SQL query against the configured database
 * 
 * This function abstracts away the differences between Oracle and SQLite:
 * 
 * ORACLE:
 * - Uses oracledb driver's native parameter binding
 * - Adds 8-second timeout to prevent hanging queries
 * - Returns results with UPPERCASE column names
 * - LOB objects need special handling (getData())
 * 
 * SQLITE (sql.js):
 * - Does NOT support parameter binding in exec()
 * - Parameters are substituted manually (SQL injection risk - only use with trusted input!)
 * - Returns results with original case column names
 * - Pagination syntax differs (see below)
 * 
 * =============================================================================
 * PAGINATION SYNTAX CONVERSION
 * =============================================================================
 * 
 * The models use Oracle's pagination syntax:
 *   SELECT * FROM items WHERE user_id = :1 ORDER BY created_at DESC 
 *   OFFSET :2 ROWS FETCH NEXT :3 ROWS ONLY
 * 
 * This is automatically converted to SQLite syntax:
 *   SELECT * FROM items WHERE user_id = :1 ORDER BY created_at DESC 
 *   LIMIT :3 OFFSET :2
 * 
 * IMPORTANT: This conversion happens AFTER parameter substitution,
 * so the regex matches the numeric values, not the parameter placeholders.
 * 
 * =============================================================================
 * 
 * @param sql - SQL query with Oracle-style syntax
 * @param params - Array of parameter values
 * @returns Array of result rows
 */
export async function execute<T = any>(
  sql: string,
  params: any[] = []
): Promise<T[]> {
  const connection = await getDbConnection();
  
  try {
    if (DB_TYPE === 'oracle') {
      // Oracle: Use native parameter binding with timeout
      // Oracle returns UPPERCASE column names and LOB objects
      
      // Convert SQLite LIMIT syntax to Oracle FETCH syntax before execution
      let finalSql = sql;
      const limitMatch = sql.match(/LIMIT\s+(\?|\d+)\s+OFFSET\s+(\?|\d+)/i);
      if (limitMatch) {
        // Extract limit and offset values - they should be in params array or literals
        // For simplicity, we'll use positional params :1 for limit, :2 for offset
        sql = sql.replace(/LIMIT\s+(\?|\d+)\s+OFFSET\s+(\?|\d+)/i, 'OFFSET :2 ROWS FETCH NEXT :1 ROWS ONLY');
        logger.debug({ sql }, 'Converted SQLite LIMIT to Oracle FETCH');
      }
      
      // Also handle just LIMIT without OFFSET (default offset to 0)
      const limitOnlyMatch = sql.match(/LIMIT\s+(\?|\d+)/i);
      if (limitOnlyMatch && !limitMatch) {
        sql = sql.replace(/LIMIT\s+(\?|\d+)/i, 'FETCH FIRST $1 ROWS ONLY');
        // Note: This needs to be converted with params, more complex - skip for now
      }
      
      const timeoutMs = 8000;
      const result = await Promise.race([
        connection.execute(sql, params, {
          outFormat: (require('oracledb') as any).OUT_FORMAT_OBJECT,
        }),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Query timeout')), timeoutMs)
        )
      ]) as any;
      
      // Transform row keys from UPPERCASE to lowercase and convert LOBs
      const rows = [];
      for (const row of (result.rows || [])) {
        rows.push(await transformRowKeys<T>(row));
      }
      return rows;
    } else {
      // SQLite (sql.js): Manual parameter substitution required
      // sql.js exec() does NOT support parameterized queries
      let finalSql = sql;
      
      // First, substitute positional parameters (:1, :2, :3, or ?)
      // WARNING: This is vulnerable to SQL injection if params contain user input
      // For user input, use the models layer which should validate/sanitize
      if (params.length > 0) {
        const escapedParams = params.map(p => {
          if (p === null) return 'NULL';
          if (typeof p === 'number') return p;
          if (typeof p === 'string') return `'${p.replace(/'/g, "''")}'`;
          return `'${String(p).replace(/'/g, "''")}'`;
        });
        // Replace :1, :2, :3... with values
        finalSql = finalSql.replace(/:(\d+)/g, () => String(escapedParams.shift()));
        // Also handle ? placeholders
        finalSql = finalSql.replace(/\?/g, () => String(escapedParams.shift()));
      }
      
      // CONVERT ORACLE PAGINATION SYNTAX TO SQLITE
      // Oracle:  OFFSET :offset ROWS FETCH NEXT :limit ROWS ONLY
      //          OR OFFSET n ROWS FETCH NEXT m ROWS ONLY
      // SQLite:  LIMIT :limit OFFSET :offset
      // Note: Must run AFTER parameter substitution to match numeric values
      
      // Handle placeholder format: OFFSET :2 ROWS FETCH NEXT :1 ROWS ONLY
      const oraclePlaceholderMatch = finalSql.match(/OFFSET\s+:\d+\s+ROWS\s+FETCH\s+NEXT\s+:\d+\s+ROWS\s+ONLY/i);
      if (oraclePlaceholderMatch) {
        // Convert to SQLite: LIMIT :1 OFFSET :2 (swap order for SQLite)
        finalSql = finalSql.replace(/OFFSET\s+:\d+\s+ROWS\s+FETCH\s+NEXT\s+:\d+\s+ROWS\s+ONLY/i, 'LIMIT :1 OFFSET :2');
        logger.debug({ sql: finalSql }, 'Converted Oracle pagination (placeholders) to SQLite');
      }
      
      // Handle numeric format: OFFSET 10 ROWS FETCH NEXT 20 ROWS ONLY
      const oracleOffsetMatch = finalSql.match(/OFFSET\s+(\d+)\s+ROWS\s+FETCH\s+NEXT\s+(\d+)\s+ROWS\s+ONLY/i);
      if (oracleOffsetMatch) {
        const offset = oracleOffsetMatch[1];
        const limit = oracleOffsetMatch[2];
        finalSql = finalSql.replace(oracleOffsetMatch[0], `LIMIT ${limit} OFFSET ${offset}`);
        logger.debug({ sql: finalSql }, 'Converted Oracle pagination (numeric) to SQLite');
      }
      
      logger.info({ sql: finalSql.substring(0, 60) }, 'Executing SQLite query');
      const result = connection.exec(finalSql);
      if (!result || result.length === 0) return [];
      const columns = result[0].columns;
      const values = result[0].values.map(row => {
        const obj: any = {};
        columns.forEach((col, i) => obj[col] = row[i]);
        return obj;
      });
      return values as T[];
    }
  } finally {
    // Oracle connections must be explicitly closed
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
      // Add timeout for Oracle queries
      const timeoutMs = 8000;
      const result = await Promise.race([
        connection.execute(sql, params, {
          autoCommit: true,
        }),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Query timeout')), timeoutMs)
        )
      ]) as any;
      
      return {
        rowsAffected: result.rowsAffected || 0,
        lastRowId: result.lastRowid?.toString(),
      };
    } else {
      // SQLite - manually interpolate params into SQL (handle :1, :2 or ?)
      let finalSql = sql;
      if (params.length > 0) {
        const escapedParams = params.map(p => {
          if (p === null) return 'NULL';
          if (typeof p === 'number') return p;
          if (typeof p === 'string') return `'${p.replace(/'/g, "''")}'`;
          return `'${String(p).replace(/'/g, "''")}'`;
        });
        // Replace :1, :2, :3... with values
        finalSql = sql.replace(/:(\d+)/g, () => escapedParams.shift());
        // Also handle ? placeholders
        finalSql = finalSql.replace(/\?/g, () => escapedParams.shift());
      }
      connection.run(finalSql);
      return {
        rowsAffected: connection.getRowsModified(),
      };
    }
  } finally {
    if (DB_TYPE === 'oracle') {
      await connection.close();
    }
  }
}
