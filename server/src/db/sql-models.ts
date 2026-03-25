/**
 * Database Models - SQLite Implementation
 * 
 * This module provides SQLite implementations of all data models.
 * Used when DB_TYPE=sqlite for local development.
 */

import { v4 as uuidv4 } from 'uuid';
import { getDbConnection, execute, executeOne, run } from './connection.js';

// Types
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
  access_token: string | null;
  refresh_token: string;
  expires_at: Date;
  created_at: Date;
  updated_at: Date;
}

export interface Court {
  id: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  total_courts: number;
  court_type: string;
  surface: string;
  has_lights: boolean;
  is_free: boolean;
  google_maps_url: string | null;
  notes: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface FavoriteCourt {
  id: string;
  user_id: string;
  court_id: string;
  created_at: Date;
}

export interface CourtReport {
  id: string;
  court_id: string;
  user_id: string;
  available_courts: number | null;
  queue_groups: number | null;
  wait_time_minutes: number | null;
  status: string;
  report_type: string | null;
  created_at: Date;
}

export interface Subscription {
  id: string;
  user_id: string;
  stripe_subscription_id: string;
  status: string;
  plan: string;
  current_period_end: Date;
  created_at: Date;
  updated_at: Date;
}

export interface Notification {
  id: string;
  user_id: string;
  type: string;
  title: string;
  body: string;
  read: boolean;
  created_at: Date;
}

// User Model
export const userModel = {
  async findByEmail(email: string): Promise<User | null> {
    const result = await executeOne<User>('SELECT * FROM users WHERE email = ?', [email]);
    return result;
  },

  async findById(id: string): Promise<User | null> {
    const result = await executeOne<User>('SELECT * FROM users WHERE id = ?', [id]);
    return result;
  },

  async create(data: { email: string; name?: string; passwordHash: string }): Promise<User> {
    const id = uuidv4();
    const now = new Date().toISOString();
    
    await run(
      `INSERT INTO users (id, email, name, password_hash, role, created_at, updated_at) 
       VALUES (?, ?, ?, ?, 'USER', ?, ?)`,
      [id, data.email, data.name || null, data.passwordHash, now, now]
    );
    
    return {
      id,
      email: data.email,
      name: data.name || null,
      password_hash: data.passwordHash,
      avatar_url: null,
      role: 'USER',
      created_at: new Date(now),
      updated_at: new Date(now),
    };
  },

  async update(id: string, data: Partial<User>): Promise<void> {
    const fields: string[] = [];
    const values: any[] = [];
    
    if (data.name !== undefined) { fields.push('name = ?'); values.push(data.name); }
    if (data.avatar_url !== undefined) { fields.push('avatar_url = ?'); values.push(data.avatar_url); }
    if (data.role !== undefined) { fields.push('role = ?'); values.push(data.role); }
    
    if (fields.length > 0) {
      fields.push('updated_at = ?');
      values.push(new Date().toISOString());
      values.push(id);
      
      await run(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`, values);
    }
  },
};

// Session Model
export const sessionModel = {
  async create(data: { userId: string; refreshToken: string; expiresAt: Date }): Promise<Session> {
    const id = uuidv4();
    const now = new Date().toISOString();
    
    await run(
      `INSERT INTO sessions (id, user_id, refresh_token, expires_at, created_at, updated_at) 
       VALUES (?, ?, ?, ?, ?, ?)`,
      [id, data.userId, data.refreshToken, data.expiresAt.toISOString(), now, now]
    );
    
    return {
      id,
      user_id: data.userId,
      access_token: null,
      refresh_token: data.refreshToken,
      expires_at: data.expiresAt,
      created_at: new Date(now),
      updated_at: new Date(now),
    };
  },

  async findByRefreshToken(token: string): Promise<Session | null> {
    const result = await executeOne<Session>(
      'SELECT * FROM sessions WHERE refresh_token = ? AND expires_at > ?',
      [token, new Date().toISOString()]
    );
    return result;
  },

  async delete(id: string): Promise<void> {
    await run('DELETE FROM sessions WHERE id = ?', [id]);
  },

  async deleteByUserId(userId: string): Promise<void> {
    await run('DELETE FROM sessions WHERE user_id = ?', [userId]);
  },
};

// Court Model
export const courtModel = {
  async findAll(): Promise<Court[]> {
    return execute<Court>('SELECT * FROM courts ORDER BY name');
  },

  async findById(id: string): Promise<Court | null> {
    return executeOne<Court>('SELECT * FROM courts WHERE id = ?', [id]);
  },

  async findNearby(latitude: number, longitude: number, radiusKm: number = 5): Promise<Court[]> {
    // Simple bounding box query (not precise but works for SQLite)
    const latDelta = radiusKm / 111;
    const lngDelta = radiusKm / (111 * Math.cos(latitude * Math.PI / 180));
    
    return execute<Court>(
      `SELECT * FROM courts 
       WHERE latitude BETWEEN ? AND ? 
       AND longitude BETWEEN ? AND ?
       ORDER BY name`,
      [latitude - latDelta, latitude + latDelta, longitude - lngDelta, longitude + lngDelta]
    );
  },

  async create(data: Omit<Court, 'id' | 'created_at' | 'updated_at'>): Promise<Court> {
    const id = uuidv4();
    const now = new Date().toISOString();
    
    await run(
      `INSERT INTO courts (id, name, address, latitude, longitude, total_courts, court_type, surface, has_lights, is_free, google_maps_url, notes, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, data.name, data.address, data.latitude, data.longitude, data.total_courts, data.court_type, data.surface, data.has_lights ? 1 : 0, data.is_free ? 1 : 0, data.google_maps_url, data.notes, now, now]
    );
    
    return {
      ...data,
      id,
      created_at: new Date(now),
      updated_at: new Date(now),
    };
  },
};

// Favorite Model
export const favoriteModel = {
  async findByUserId(userId: string): Promise<FavoriteCourt[]> {
    return execute<FavoriteCourt>(
      `SELECT fc.* FROM favorite_courts fc 
       WHERE fc.user_id = ? 
       ORDER BY fc.created_at DESC`,
      [userId]
    );
  },

  async create(userId: string, courtId: string): Promise<FavoriteCourt> {
    const id = uuidv4();
    const now = new Date().toISOString();
    
    await run(
      `INSERT INTO favorite_courts (id, user_id, court_id, created_at) VALUES (?, ?, ?, ?)`,
      [id, userId, courtId, now]
    );
    
    return { id, user_id: userId, court_id: courtId, created_at: new Date(now) };
  },

  async delete(userId: string, courtId: string): Promise<void> {
    await run('DELETE FROM favorite_courts WHERE user_id = ? AND court_id = ?', [userId, courtId]);
  },
};

// Court Report Model
export const courtReportModel = {
  async findByCourtId(courtId: string, limit: number = 10): Promise<CourtReport[]> {
    return execute<CourtReport>(
      `SELECT * FROM court_reports WHERE court_id = ? ORDER BY created_at DESC LIMIT ?`,
      [courtId, limit]
    );
  },

  async create(data: Omit<CourtReport, 'id' | 'created_at'>): Promise<CourtReport> {
    const id = uuidv4();
    const now = new Date().toISOString();
    
    await run(
      `INSERT INTO court_reports (id, court_id, user_id, available_courts, queue_groups, wait_time_minutes, status, report_type, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, data.court_id, data.user_id, data.available_courts, data.queue_groups, data.wait_time_minutes, data.status, data.report_type, now]
    );
    
    return { ...data, id, created_at: new Date(now) };
  },
};

// Subscription Model
export const subscriptionModel = {
  async findByUserId(userId: string): Promise<Subscription | null> {
    return executeOne<Subscription>(
      'SELECT * FROM subscriptions WHERE user_id = ? ORDER BY created_at DESC LIMIT 1',
      [userId]
    );
  },

  async create(data: Omit<Subscription, 'id' | 'created_at' | 'updated_at'>): Promise<Subscription> {
    const id = uuidv4();
    const now = new Date().toISOString();
    
    await run(
      `INSERT INTO subscriptions (id, user_id, stripe_subscription_id, status, plan, current_period_end, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, data.user_id, data.stripe_subscription_id, data.status, data.plan, data.current_period_end.toISOString(), now, now]
    );
    
    return {
      ...data,
      id,
      created_at: new Date(now),
      updated_at: new Date(now),
    };
  },
};

// Notification Model
export const notificationModel = {
  async findByUserId(userId: string, limit: number = 50): Promise<Notification[]> {
    return execute<Notification>(
      'SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT ?',
      [userId, limit]
    );
  },

  async create(data: Omit<Notification, 'id' | 'created_at'>): Promise<Notification> {
    const id = uuidv4();
    const now = new Date().toISOString();
    
    await run(
      `INSERT INTO notifications (id, user_id, type, title, body, read, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [id, data.user_id, data.type, data.title, data.body, data.read ? 1 : 0, now]
    );
    
    return { ...data, id, created_at: new Date(now) };
  },

  async markAsRead(id: string): Promise<void> {
    await run('UPDATE notifications SET read = 1 WHERE id = ?', [id]);
  },
};

// Item Model (placeholder)
export const itemModel = {
  async findAllByUserId(userId: string) {
    return [];
  },
  async findById(id: string) {
    return null;
  },
  async create(data: any) {
    throw new Error('Not implemented');
  },
  async update(id: string, data: any) {
    throw new Error('Not implemented');
  },
  async delete(id: string) {
    throw new Error('Not implemented');
  },
};