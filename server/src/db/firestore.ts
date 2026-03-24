/**
 * Firestore Database Connection
 * 
 * Requires:
 *   - GOOGLE_APPLICATION_CREDENTIALS path to service account JSON file
 *   - Or use Google Cloud's default credentials (Cloud Run, GKE, etc.)
 * 
 * Environment Variables:
 *   FIRESTORE_EMULATOR_HOST=localhost:8080 (for local development)
 *   GCP_PROJECT=your-project-id (if not using default credentials)
 */

import { Firestore, CollectionReference, QueryDocumentSnapshot } from 'firebase-admin/firestore';
import { initializeApp, cert, getApps, App, getApp } from 'firebase-admin/app';
import fs from 'fs';
import path from 'path';

let db: Firestore | null = null;
let app: App | null = null;

export function initFirestore(): Firestore {
  if (db) return db;

  // Initialize Firebase Admin if not already initialized
  if (getApps().length === 0) {
    const credentialsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
    
    if (credentialsPath && fs.existsSync(credentialsPath)) {
      // Use service account file
      const serviceAccount = require(credentialsPath);
      app = initializeApp({
        credential: cert(serviceAccount),
      });
    } else {
      // Use default credentials (Cloud Run, GKE, etc.)
      app = initializeApp();
    }
  } else {
    app = getApps()[0];
  }

  db = getApp().firestore();
  
  // Enable timestamps in snapshots
  db.settings({ timestampsInSnapshots: true });

  console.log('Firestore initialized successfully');
  return db;
}

export function getDb(): Firestore {
  if (!db) {
    return initFirestore();
  }
  return db;
}

// Collection names
export const COLLECTIONS = {
  USERS: 'users',
  COURTS: 'courts',
  FAVORITES: 'favorites',
  REPORTS: 'reports',
  NOTIFICATIONS: 'notifications',
} as const;

// Helper to convert Firestore document to object
export function docToObject<T>(doc: QueryDocumentSnapshot): T {
  return {
    id: doc.id,
    ...doc.data(),
  } as T;
}

export default {
  initFirestore,
  getDb,
  COLLECTIONS,
  docToObject,
};