/**
 * Database Models - Unified Interface
 * 
 * This module exports the appropriate model implementations based on DB_TYPE:
 * - 'sqlite' or 'oracle': SQL-based models (sql-models.ts)
 * - 'firestore': NoSQL Firestore models (firestore-models.ts)
 */

import { logger } from '../utils/logger.js';

// Database type - must match connection.ts
type DbType = 'firestore' | 'oracle' | 'sqlite';
const DB_TYPE = (process.env.DB_TYPE as DbType) || 'sqlite';

// Re-export types (common to all backends)
export type { User, Session, Court, FavoriteCourt, CourtReport, Subscription, Notification } from './sql-models.js';

// SQL Models (used for sqlite and oracle)
import {
  userModel as sqlUserModel,
  sessionModel as sqlSessionModel,
  itemModel as sqlItemModel,
  courtModel as sqlCourtModel,
  favoriteModel as sqlFavoriteModel,
  courtReportModel as sqlCourtReportModel,
  subscriptionModel as sqlSubscriptionModel,
  notificationModel as sqlNotificationModel,
} from './sql-models.js';

// Firestore Models (used for firestore)
import {
  userModel as fsUserModel,
  sessionModel as fsSessionModel,
  courtModel as fsCourtModel,
  favoriteModel as fsFavoriteModel,
  courtReportModel as fsCourtReportModel,
  subscriptionModel as fsSubscriptionModel,
  notificationModel as fsNotificationModel,
} from './firestore-models.js';

// Export based on DB_TYPE
if (DB_TYPE === 'firestore') {
  logger.info('Using Firestore models');
  export const userModel = fsUserModel;
  export const sessionModel = fsSessionModel;
  export const courtModel = fsCourtModel;
  export const favoriteModel = fsFavoriteModel;
  export const courtReportModel = fsCourtReportModel;
  export const subscriptionModel = fsSubscriptionModel;
  export const notificationModel = fsNotificationModel;
  
  // Item model - Firestore doesn't have items
  export const itemModel = {
    async findAllByUserId() { return []; },
    async findById() { return null; },
    async create() { throw new Error('Not implemented'); },
    async update() { throw new Error('Not implemented'); },
    async delete() { throw new Error('Not implemented'); },
  };
} else {
  logger.info(`Using SQL models (${DB_TYPE})`);
  export const userModel = sqlUserModel;
  export const sessionModel = sqlSessionModel;
  export const itemModel = sqlItemModel;
  export const courtModel = sqlCourtModel;
  export const favoriteModel = sqlFavoriteModel;
  export const courtReportModel = sqlCourtReportModel;
  export const subscriptionModel = sqlSubscriptionModel;
  export const notificationModel = sqlNotificationModel;
}
