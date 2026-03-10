import { initDb, run, execute } from './connection.js';
import { logger } from '../utils/logger.js';

const schema = `
-- Users table
CREATE TABLE IF NOT EXISTS users (
  id VARCHAR2(36) PRIMARY KEY,
  email VARCHAR2(255) UNIQUE NOT NULL,
  name VARCHAR2(255),
  password_hash VARCHAR2(255) NOT NULL,
  avatar_url VARCHAR2(500),
  role VARCHAR2(20) DEFAULT 'USER' CHECK (role IN ('USER', 'ADMIN')),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Sessions table
CREATE TABLE IF NOT EXISTS sessions (
  id VARCHAR2(36) PRIMARY KEY,
  user_id VARCHAR2(36) NOT NULL,
  refresh_token VARCHAR2(500) UNIQUE NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_session_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Items table
CREATE TABLE IF NOT EXISTS items (
  id VARCHAR2(36) PRIMARY KEY,
  user_id VARCHAR2(36) NOT NULL,
  title VARCHAR2(500) NOT NULL,
  description VARCHAR2(2000),
  metadata JSON,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_item_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Subscriptions table
CREATE TABLE IF NOT EXISTS subscriptions (
  id VARCHAR2(36) PRIMARY KEY,
  user_id VARCHAR2(36) UNIQUE NOT NULL,
  stripe_subscription_id VARCHAR2(255) UNIQUE,
  stripe_customer_id VARCHAR2(255),
  status VARCHAR2(20) DEFAULT 'TRIALING' CHECK (status IN ('TRIALING', 'ACTIVE', 'PAST_DUE', 'CANCELLED', 'UNPAID')),
  plan VARCHAR2(20) DEFAULT 'monthly',
  current_period_start TIMESTAMP,
  current_period_end TIMESTAMP,
  cancelled_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_subscription_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Payments table
CREATE TABLE IF NOT EXISTS payments (
  id VARCHAR2(36) PRIMARY KEY,
  user_id VARCHAR2(36) NOT NULL,
  subscription_id VARCHAR2(36),
  stripe_payment_id VARCHAR2(255) UNIQUE NOT NULL,
  amount NUMBER NOT NULL,
  currency VARCHAR2(10) DEFAULT 'usd',
  status VARCHAR2(20) DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_payment_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Notifications table
CREATE TABLE IF NOT EXISTS notifications (
  id VARCHAR2(36) PRIMARY KEY,
  user_id VARCHAR2(36) NOT NULL,
  title VARCHAR2(255) NOT NULL,
  body VARCHAR2(500) NOT NULL,
  data JSON,
  read_status NUMBER(1) DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_notification_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Activity logs table
CREATE TABLE IF NOT EXISTS activity_logs (
  id VARCHAR2(36) PRIMARY KEY,
  user_id VARCHAR2(36),
  action VARCHAR2(100) NOT NULL,
  entity_type VARCHAR2(50),
  entity_id VARCHAR2(36),
  metadata JSON,
  ip_address VARCHAR2(50),
  user_agent VARCHAR2(500),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_items_user_id ON items(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON notifications(user_id, read_status);
CREATE INDEX IF NOT EXISTS idx_activity_logs_user_id ON activity_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at ON activity_logs(created_at);
`;

export async function initializeDatabase(): Promise<void> {
  try {
    await initDb();
    logger.info('Initializing database schema...');

    // Split and execute each statement
    const statements = schema
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));

    for (const sql of statements) {
      try {
        await run(sql);
      } catch (err: any) {
        // Ignore "table already exists" errors
        if (!err.message?.includes('already exists')) {
          logger.warn({ sql: sql.substring(0, 100), error: err.message }, 'Statement warning');
        }
      }
    }

    logger.info('Database schema initialized successfully');
  } catch (error) {
    logger.error({ error }, 'Failed to initialize database');
    throw error;
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  initializeDatabase()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}
