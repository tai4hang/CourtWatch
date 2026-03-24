/**
 * Database Connection Layer - Firestore Implementation
 * 
 * This module provides Firestore database connection.
 * Used when DB_TYPE=firestore in production (Cloud Run).
 * 
 * Environment Variables:
 *   DB_TYPE=firestore (required)
 *   GCP_PROJECT=your-project-id (optional, uses default credentials)
 */

import { logger } from '../utils/logger.js';
import { initFirestore, getDb } from './firestore.js';
import type { Firestore } from 'firebase-admin/firestore';

let db: Firestore | null = null;

export async function initDb(): Promise<void> {
  logger.info('Initializing Firestore database...');
  db = initFirestore();
  logger.info('Firestore initialized successfully');
}

export function getDbConnection(): Firestore {
  if (!db) {
    throw new Error('Database not initialized. Call initDb() first.');
  }
  return db;
}

export async function closeDb(): Promise<void> {
  // Firestore doesn't need explicit close
  db = null;
  logger.info('Firestore connection closed');
}

// Legacy exports for compatibility (no-op for Firestore)
export async function execute<T = any>(sql: string, params: any[] = []): Promise<T[]> {
  throw new Error('SQL queries not supported in Firestore mode');
}

export async function executeOne<T = any>(sql: string, params: any[] = []): Promise<T | null> {
  throw new Error('SQL queries not supported in Firestore mode');
}

export async function run(sql: string, params: any[] = []): Promise<void> {
  throw new Error('SQL queries not supported in Firestore mode');
}