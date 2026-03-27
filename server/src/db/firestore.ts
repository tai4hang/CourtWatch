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
 * 
 * For local development with emulator:
 *   FIRESTORE_EMULATOR_HOST=localhost:8080
 *   npx firebase emulators:start
 */

import { Firestore, CollectionReference, QueryDocumentSnapshot, getFirestore } from 'firebase-admin/firestore';
import { initializeApp, cert, getApps, App, getApp } from 'firebase-admin/app';
import fs from 'fs';

// Firebase Admin automatically connects to emulator when FIRESTORE_EMULATOR_HOST is set
// Just ensure the env var is set properly
const EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST;
if (EMULATOR_HOST) {
  console.log(`Using Firestore emulator: ${EMULATOR_HOST}`);
  process.env.GCLOUD_PROJECT = process.env.GCP_PROJECT || 'demo-project';
  // This env var is automatically read by firebase-admin
}

let db: Firestore | null = null;
let app: App | null = null;

export function initFirestore(): Firestore {
  if (db) return db;

  // Get GCP project from env
  const projectId = process.env.GCP_PROJECT || process.env.GCLOUD_PROJECT || 'demo-project';
  console.log('Initializing Firestore with project:', projectId);

  // Check for emulator mode
  if (process.env.FIRESTORE_EMULATOR_HOST) {
    console.log('Connecting to Firestore emulator:', process.env.FIRESTORE_EMULATOR_HOST);
  }

  // Initialize Firebase Admin if not already initialized
  if (getApps().length === 0) {
    const credentialsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
    console.log('Credentials path:', credentialsPath);
    
    try {
      if (credentialsPath && fs.existsSync(credentialsPath)) {
        // Use service account file
        console.log('Using service account file');
        const serviceAccount = require(credentialsPath);
        app = initializeApp({
          credential: cert(serviceAccount),
          projectId: projectId,
        });
      } else {
        // Use default credentials (Cloud Run, GKE, etc.)
        console.log('Using default credentials');
        app = initializeApp({
          projectId: projectId,
        });
      }
    } catch (err) {
      console.error('Error initializing Firebase app:', err);
      throw err;
    }
  } else {
    app = getApps()[0];
    console.log('Using existing Firebase app');
  }

  // Use getFirestore() instead of app.firestore() - use default database
  try {
    db = getFirestore(app);
    // Enable timestamps in snapshots
    db.settings({ timestampsInSnapshots: true });
    console.log('Firestore initialized successfully with default database');
  } catch (err) {
    console.error('Error getting Firestore instance:', err);
    throw err;
  }

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
