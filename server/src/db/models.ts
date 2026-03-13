/**
 * Database Models
 * 
 * This module defines data models and their CRUD operations.
 * 
 * =============================================================================
 * IMPORTANT: SQL Syntax
 * =============================================================================
 * 
 * The SQL queries below use Oracle SQL syntax because that's the primary
 * target database. The connection.ts module automatically converts this to
 * SQLite-compatible syntax when DB_TYPE=sqlite.
 * 
 * Key differences to be aware of:
 * 
 * 1. Pagination:
 *    Oracle:  SELECT ... OFFSET :2 ROWS FETCH NEXT :3 ROWS ONLY
 *    SQLite:  SELECT ... LIMIT :3 OFFSET :2
 *    (Automatically converted by connection.ts)
 * 
 * 2. Parameter binding:
 *    Oracle:  Uses :1, :2, :3 placeholders with native binding
 *    SQLite:  Uses :1, :2, :3 but with manual string substitution
 *    (Handled by connection.ts)
 * 
 * 3. Column names:
 *    Oracle:  Returns UPPERCASE column names (e.g., USER_ID, CREATED_AT)
 *    SQLite:  Returns as-defined (e.g., user_id, created_at)
 *    (Converted to lowercase by connection.ts)
 * 
 * If you add new queries, follow these patterns:
 * - Use :1, :2, :3 for positional parameters (works in both)
 * - Use OFFSET :n ROWS FETCH NEXT :m ROWS ONLY for pagination (converted automatically)
 * - Use UPPERCASE column names to match Oracle convention
 */

import { execute, executeOne, run, getDbConnection } from './connection.js';
import { v4 as uuidv4 } from 'uuid';

export interface User {
  id: string;
  email: string;
  name: string | null;
  password_hash: string;
  avatar_url: string | null;
  role: 'USER' | 'ADMIN';
  created_at: Date;
  updated_at: Date;
}

export interface Session {
  id: string;
  user_id: string;
  access_token?: string | null;
  refresh_token: string;
  expires_at: Date;
  created_at: Date;
  updated_at: Date;
}

export interface Item {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  metadata: any;
  created_at: Date;
  updated_at: Date;
}

export interface Subscription {
  id: string;
  user_id: string;
  stripe_subscription_id: string | null;
  stripe_customer_id: string | null;
  status: 'TRIALING' | 'ACTIVE' | 'PAST_DUE' | 'CANCELLED' | 'UNPAID';
  plan: string;
  current_period_start: Date | null;
  current_period_end: Date | null;
  cancelled_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

export interface Notification {
  id: string;
  user_id: string;
  title: string;
  body: string;
  data: any;
  read_status: number;
  created_at: Date;
}

// User operations
export const userModel = {
  async findByEmail(email: string): Promise<User | null> {
    return executeOne<User>(
      'SELECT * FROM users WHERE email = :1',
      [email]
    );
  },

  async findById(id: string): Promise<User | null> {
    return executeOne<User>(
      'SELECT * FROM users WHERE id = :1',
      [id]
    );
  },

  async create(data: { email: string; name?: string; passwordHash: string; role?: string }): Promise<User> {
    const id = uuidv4();
    const role = data.role || 'USER';
    
    await run(
      `INSERT INTO users (id, email, name, password_hash, role) VALUES (:1, :2, :3, :4, :5)`,
      [id, data.email, data.name || null, data.passwordHash, role]
    );

    return {
      id,
      email: data.email,
      name: data.name || null,
      password_hash: data.passwordHash,
      avatar_url: null,
      role: role as 'USER' | 'ADMIN',
      created_at: new Date(),
      updated_at: new Date(),
    };
  },

  async update(id: string, data: { name?: string; avatarUrl?: string }): Promise<void> {
    const sets: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (data.name !== undefined) {
      sets.push(`name = :${paramIndex++}`);
      params.push(data.name);
    }
    if (data.avatarUrl !== undefined) {
      sets.push(`avatar_url = :${paramIndex++}`);
      params.push(data.avatarUrl);
    }

    if (sets.length > 0) {
      sets.push(`updated_at = CURRENT_TIMESTAMP`);
      params.push(id);
      await run(
        `UPDATE users SET ${sets.join(', ')} WHERE id = :${paramIndex}`,
        params
      );
    }
  },
};

// Session operations
export const sessionModel = {
  async create(data: { userId: string; accessToken?: string; refreshToken: string; expiresAt: Date }): Promise<Session> {
    const id = uuidv4();
    
    await run(
      `INSERT INTO sessions (id, user_id, access_token, refresh_token, expires_at) VALUES (:1, :2, :3, :4, :5)`,
      [id, data.userId, data.accessToken || null, data.refreshToken, data.expiresAt]
    );

    return {
      id,
      user_id: data.userId,
      access_token: data.accessToken || null,
      refresh_token: data.refreshToken,
      expires_at: data.expiresAt,
      created_at: new Date(),
      updated_at: new Date(),
    };
  },

  async findByAccessToken(accessToken: string): Promise<User | null> {
    const session = await executeOne<Session>(
      `SELECT user_id, expires_at FROM sessions WHERE access_token = :1 AND expires_at > CURRENT_TIMESTAMP`,
      [accessToken]
    );
    
    if (!session) {
      return null;
    }
    
    const user = await executeOne<User>(
      `SELECT id, email, name, password_hash, avatar_url, role, created_at, updated_at FROM users WHERE id = :1`,
      [session.user_id]
    );
    
    return user;
  },

  async findByRefreshToken(refreshToken: string): Promise<User | null> {
    // First get the session to find the user_id
    const session = await executeOne<Session>(
      `SELECT s.user_id, s.expires_at
       FROM sessions s
       WHERE s.refresh_token = :1 AND s.expires_at > CURRENT_TIMESTAMP`,
      [refreshToken]
    );
    
    if (!session) {
      return null;
    }
    
    // Then get the user
    const user = await executeOne<User>(
      `SELECT id, email, name, password_hash, avatar_url, role, created_at, updated_at
       FROM users WHERE id = :1`,
      [session.user_id]
    );
    
    return user;
  },

  async delete(refreshToken: string): Promise<void> {
    await run('DELETE FROM sessions WHERE refresh_token = :1', [refreshToken]);
  },

  async deleteByUserId(userId: string): Promise<void> {
    await run('DELETE FROM sessions WHERE user_id = :1', [userId]);
  },
};

// Item operations
export const itemModel = {
  async findAllByUserId(userId: string, page = 1, limit = 20): Promise<Item[]> {
    const offset = (page - 1) * limit;
    return execute<Item>(
      `SELECT * FROM items WHERE user_id = :1 ORDER BY created_at DESC OFFSET :2 ROWS FETCH NEXT :3 ROWS ONLY`,
      [userId, offset, limit]
    );
  },

  async findById(id: string, userId: string): Promise<Item | null> {
    return executeOne<Item>(
      'SELECT * FROM items WHERE id = :1 AND user_id = :2',
      [id, userId]
    );
  },

  async create(data: { userId: string; title: string; description?: string; metadata?: any }): Promise<Item> {
    const id = uuidv4();
    
    await run(
      `INSERT INTO items (id, user_id, title, description, metadata) VALUES (:1, :2, :3, :4, :5)`,
      [id, data.userId, data.title, data.description || null, JSON.stringify(data.metadata || {})]
    );

    return {
      id,
      user_id: data.userId,
      title: data.title,
      description: data.description || null,
      metadata: data.metadata || {},
      created_at: new Date(),
      updated_at: new Date(),
    };
  },

  async update(id: string, userId: string, data: { title?: string; description?: string; metadata?: any }): Promise<void> {
    const sets: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (data.title !== undefined) {
      sets.push(`title = :${paramIndex++}`);
      params.push(data.title);
    }
    if (data.description !== undefined) {
      sets.push(`description = :${paramIndex++}`);
      params.push(data.description);
    }
    if (data.metadata !== undefined) {
      sets.push(`metadata = :${paramIndex++}`);
      params.push(JSON.stringify(data.metadata));
    }

    if (sets.length > 0) {
      sets.push(`updated_at = CURRENT_TIMESTAMP`);
      params.push(id, userId);
      await run(
        `UPDATE items SET ${sets.join(', ')} WHERE id = :${paramIndex++} AND user_id = :${paramIndex}`,
        params
      );
    }
  },

  async delete(id: string, userId: string): Promise<void> {
    await run('DELETE FROM items WHERE id = :1 AND user_id = :2', [id, userId]);
  },
};

// Subscription operations
export const subscriptionModel = {
  async findByUserId(userId: string): Promise<Subscription | null> {
    return executeOne<Subscription>(
      'SELECT * FROM subscriptions WHERE user_id = :1',
      [userId]
    );
  },

  async upsert(data: {
    userId: string;
    stripeSubscriptionId?: string;
    stripeCustomerId?: string;
    status?: string;
    plan?: string;
    currentPeriodStart?: Date;
    currentPeriodEnd?: Date;
  }): Promise<void> {
    const existing = await this.findByUserId(data.userId);
    
    if (existing) {
      const sets: string[] = [];
      const params: any[] = [];
      let paramIndex = 1;

      if (data.stripeSubscriptionId !== undefined) {
        sets.push(`stripe_subscription_id = :${paramIndex++}`);
        params.push(data.stripeSubscriptionId);
      }
      if (data.stripeCustomerId !== undefined) {
        sets.push(`stripe_customer_id = :${paramIndex++}`);
        params.push(data.stripeCustomerId);
      }
      if (data.status !== undefined) {
        sets.push(`status = :${paramIndex++}`);
        params.push(data.status);
      }
      if (data.currentPeriodStart !== undefined) {
        sets.push(`current_period_start = :${paramIndex++}`);
        params.push(data.currentPeriodStart);
      }
      if (data.currentPeriodEnd !== undefined) {
        sets.push(`current_period_end = :${paramIndex++}`);
        params.push(data.currentPeriodEnd);
      }

      if (sets.length > 0) {
        sets.push(`updated_at = CURRENT_TIMESTAMP`);
        params.push(data.userId);
        await run(
          `UPDATE subscriptions SET ${sets.join(', ')} WHERE user_id = :${paramIndex}`,
          params
        );
      }
    } else {
      const id = uuidv4();
      await run(
        `INSERT INTO subscriptions (id, user_id, stripe_subscription_id, stripe_customer_id, status, plan, current_period_start, current_period_end)
         VALUES (:1, :2, :3, :4, :5, :6, :7, :8)`,
        [
          id,
          data.userId,
          data.stripeSubscriptionId || null,
          data.stripeCustomerId || null,
          data.status || 'TRIALING',
          data.plan || 'monthly',
          data.currentPeriodStart || null,
          data.currentPeriodEnd || null,
        ]
      );
    }
  },
};

// Notification operations
export const notificationModel = {
  async findAllByUserId(userId: string, limit = 20, read?: boolean): Promise<Notification[]> {
    let sql = 'SELECT * FROM notifications WHERE user_id = :1';
    const params: any[] = [userId];

    if (read !== undefined) {
      sql += ' AND read_status = :2';
      params.push(read ? 1 : 0);
    }

    sql += ' ORDER BY created_at DESC FETCH FIRST :3 ROWS ONLY';
    params.push(limit);

    return execute<Notification>(sql, params);
  },

  async markAsRead(id: string, userId: string): Promise<void> {
    await run(
      'UPDATE notifications SET read_status = 1 WHERE id = :1 AND user_id = :2',
      [id, userId]
    );
  },

  async markAllAsRead(userId: string): Promise<void> {
    await run(
      'UPDATE notifications SET read_status = 1 WHERE user_id = :1 AND read_status = 0',
      [userId]
    );
  },

  async create(data: { userId: string; title: string; body: string; data?: any }): Promise<Notification> {
    const id = uuidv4();
    
    await run(
      `INSERT INTO notifications (id, user_id, title, body, data) VALUES (:1, :2, :3, :4, :5)`,
      [id, data.userId, data.title, data.body, JSON.stringify(data.data || {})]
    );

    return {
      id,
      user_id: data.userId,
      title: data.title,
      body: data.body,
      data: data.data || {},
      read_status: 0,
      created_at: new Date(),
    };
  },
};
