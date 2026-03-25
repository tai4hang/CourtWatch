/**
 * Database Models - Unified Interface
 * 
 * Supports both Firestore and SQLite backends based on DB_TYPE:
 * - DB_TYPE=firestore: Firestore models (production)
 * - DB_TYPE=sqlite: SQLite models (local development)
 */

import { logger } from '../utils/logger.js';

type DbType = 'firestore' | 'sqlite';
const DB_TYPE = (process.env.DB_TYPE as DbType) || 'sqlite';

// Re-export types (common to all backends)
export type { User, Session, Court, FavoriteCourt, CourtReport, Subscription, Notification } from './firestore-models.js';

// Always import both - let them handle their own initialization
import * as firestoreModels from './firestore-models.js';
import * as sqlModels from './sql-models.js';

let userModel: any, sessionModel: any, courtModel: any, favoriteModel: any;
let courtReportModel: any, subscriptionModel: any, notificationModel: any, itemModel: any;

// The models are already initialized when imported - use whichever matches DB_TYPE
if (DB_TYPE === 'firestore') {
  logger.info('Using Firestore models');
  userModel = firestoreModels.userModel;
  sessionModel = firestoreModels.sessionModel;
  courtModel = firestoreModels.courtModel;
  favoriteModel = firestoreModels.favoriteModel;
  courtReportModel = firestoreModels.courtReportModel;
  subscriptionModel = firestoreModels.subscriptionModel;
  notificationModel = firestoreModels.notificationModel;
  itemModel = {
    async findAllByUserId() { return []; },
    async findById() { return null; },
    async create() { throw new Error('Not implemented'); },
    async update() { throw new Error('Not implemented'); },
    async delete() { throw new Error('Not implemented'); },
  };
} else {
  logger.info('Using SQLite models');
  userModel = sqlModels.userModel;
  sessionModel = sqlModels.sessionModel;
  courtModel = sqlModels.courtModel;
  favoriteModel = sqlModels.favoriteModel;
  courtReportModel = sqlModels.courtReportModel;
  subscriptionModel = sqlModels.subscriptionModel;
  notificationModel = sqlModels.notificationModel;
  itemModel = sqlModels.itemModel;
}

export { userModel, sessionModel, courtModel, favoriteModel };
export { courtReportModel, subscriptionModel, notificationModel, itemModel };