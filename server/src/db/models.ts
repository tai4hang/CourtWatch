/**
 * Database Models - Firestore Implementation
 * 
 * This module provides Firestore implementations of all data models.
 * Used when DB_TYPE=firestore in production (Cloud Run).
 */

export * from './firestore-models.js';
export { userModel, sessionModel, courtModel, favoriteModel, courtReportModel, subscriptionModel, notificationModel } from './firestore-models.js';

// Item model - not used in CourtWatch
export const itemModel = {
  async findAllByUserId() { return []; },
  async findById() { return null; },
  async create() { throw new Error('Not implemented'); },
  async update() { throw new Error('Not implemented'); },
  async delete() { throw new Error('Not implemented'); },
};
