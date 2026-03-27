/**
 * Firestore Models
 * 
 * This module provides Firestore implementations of all data models.
 * Used when DB_TYPE=firestore in production (Cloud Run).
 * 
 * Collections:
 * - users: User accounts
 * - sessions: Auth sessions
 * - courts: Tennis court information
 * - favorites: User's favorite courts
 * - reports: Court availability reports
 * - subscriptions: Stripe subscription data
 * - notifications: User notifications
 */

import { getDb, COLLECTIONS, docToObject } from './firestore.js';
import { Firestore, QueryConstraint, where, orderBy, limit, startAfter, QueryDocumentSnapshot } from 'firebase-admin/firestore';
import { v4 as uuidv4 } from 'uuid';

// Types (same as models.ts)
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

export interface Court {
  id: string;
  name: string;
  address: string;
  city: string | null;
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

const db = () => getDb();

// User operations
export const userModel = {
  async findByEmail(email: string): Promise<User | null> {
    const snapshot = await db().collection(COLLECTIONS.USERS)
      .where('email', '==', email)
      .limit(1)
      .get();
    
    if (snapshot.empty) return null;
    return docToObject<User>(snapshot.docs[0]);
  },

  async findById(id: string): Promise<User | null> {
    const doc = await db().collection(COLLECTIONS.USERS).doc(id).get();
    if (!doc.exists) return null;
    return { id: doc.id, ...doc.data() } as User;
  },

  async create(data: { email: string; name?: string; passwordHash: string; role?: string }): Promise<User> {
    const id = uuidv4();
    const now = new Date();
    const user: User = {
      id,
      email: data.email,
      name: data.name || null,
      password_hash: data.passwordHash,
      avatar_url: null,
      role: (data.role || 'USER') as 'USER' | 'ADMIN',
      created_at: now,
      updated_at: now,
    };
    
    await db().collection(COLLECTIONS.USERS).doc(id).set(user);
    return user;
  },

  async update(id: string, data: { name?: string; avatarUrl?: string }): Promise<void> {
    const updateData: any = { updated_at: new Date() };
    if (data.name !== undefined) updateData.name = data.name;
    if (data.avatarUrl !== undefined) updateData.avatar_url = data.avatarUrl;
    
    await db().collection(COLLECTIONS.USERS).doc(id).update(updateData);
  },
};

// Session operations
export const sessionModel = {
  async create(data: { userId: string; accessToken?: string; refreshToken: string; expiresAt: Date }): Promise<Session> {
    const id = uuidv4();
    const now = new Date();
    const session: Session = {
      id,
      user_id: data.userId,
      access_token: data.accessToken || null,
      refresh_token: data.refreshToken,
      expires_at: data.expiresAt,
      created_at: now,
      updated_at: now,
    };
    
    await db().collection('sessions').doc(id).set(session);
    return session;
  },

  async findByAccessToken(accessToken: string): Promise<User | null> {
    const snapshot = await db().collection('sessions')
      .where('access_token', '==', accessToken)
      .limit(1)
      .get();
    
    if (snapshot.empty) return null;
    
    const session = snapshot.docs[0].data() as Session;
    // Check expiration in code (Firestore doesn't support > on non-equality fields without index)
    if (new Date(session.expires_at) <= new Date()) return null;
    
    return userModel.findById(session.user_id);
  },

  async findByRefreshToken(refreshToken: string): Promise<User | null> {
    const snapshot = await db().collection('sessions')
      .where('refresh_token', '==', refreshToken)
      .limit(1)
      .get();
    
    if (snapshot.empty) return null;
    
    const session = snapshot.docs[0].data() as Session;
    // Check expiration in code
    if (new Date(session.expires_at) <= new Date()) return null;
    
    return userModel.findById(session.user_id);
  },

  async delete(refreshToken: string): Promise<void> {
    const snapshot = await db().collection('sessions')
      .where('refresh_token', '==', refreshToken)
      .get();
    
    const batch = db().batch();
    snapshot.docs.forEach(doc => batch.delete(doc.ref));
    await batch.commit();
  },

  async deleteByUserId(userId: string): Promise<void> {
    const snapshot = await db().collection('sessions')
      .where('user_id', '==', userId)
      .get();
    
    const batch = db().batch();
    snapshot.docs.forEach(doc => batch.delete(doc.ref));
    await batch.commit();
  },
};

// Court operations
export const courtModel = {
  async findAll(page = 1, limit = 20): Promise<Court[]> {
    let query = db().collection(COLLECTIONS.COURTS)
      .orderBy('name')
      .limit(limit);
    
    if (page > 1) {
      const prevSnapshot = await db().collection(COLLECTIONS.COURTS)
        .orderBy('name')
        .limit((page - 1) * limit)
        .get();
      
      if (!prevSnapshot.empty) {
        const lastDoc = prevSnapshot.docs[prevSnapshot.docs.length - 1];
        query = query.startAfter(lastDoc);
      }
    }
    
    const snapshot = await query.get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Court));
  },

  async findById(id: string): Promise<Court | null> {
    const doc = await db().collection(COLLECTIONS.COURTS).doc(id).get();
    if (!doc.exists) return null;
    return { id: doc.id, ...doc.data() } as Court;
  },

  async findNearby(lat: number, lng: number, radiusKm: number, limit = 20): Promise<(Court & { distance_km: number })[]> {
    // Validate inputs - Firestore rejects undefined values
    if (typeof lat !== 'number' || typeof lng !== 'number' || isNaN(lat) || isNaN(lng)) {
      console.error('Invalid coordinates for findNearby:', { lat, lng });
      return [];
    }
    
    // Simple bounding box query - Firestore doesn't support geo queries natively
    const latDelta = radiusKm / 111.0;
    const lngDelta = radiusKm / (111.0 * Math.cos(lat * Math.PI / 180));
    
    // Use Number() and fallback to 0 to ensure valid values passed to Firestore
    const minLat = Number(lat) - Number(latDelta);
    const maxLat = Number(lat) + Number(latDelta);
    const minLng = Number(lng) - Number(lngDelta);
    const maxLng = Number(lng) + Number(lngDelta);
    
    console.log('Firestore query bounds:', { minLat, maxLat, minLng, maxLng, isNaN: { minLat: isNaN(minLat), maxLat: isNaN(maxLat), minLng: isNaN(minLng), maxLng: isNaN(maxLng) } });
    
    const snapshot = await db().collection(COLLECTIONS.COURTS)
      .where('latitude', '>=', minLat)
      .where('latitude', '<=', maxLat)
      .where('longitude', '>=', minLng)
      .where('longitude', '<=', maxLng)
      .limit(limit)
      .get();
    
    console.log('Firestore query returned', snapshot.size, 'documents');
    
    return snapshot.docs
      .map(doc => {
        const data = doc.data();
        // Skip documents with undefined coordinates
        if (data.latitude === undefined || data.longitude === undefined) {
          return null;
        }
        const court = data as Court;
        // Calculate actual distance
        const R = 6371; // Earth's radius in km
        const dLat = (court.latitude - lat) * Math.PI / 180;
        const dLon = (court.longitude - lng) * Math.PI / 180;
        const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                  Math.cos(lat * Math.PI / 180) * Math.cos(court.latitude * Math.PI / 180) *
                  Math.sin(dLon/2) * Math.sin(dLon/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        const distance = R * c;
        return { ...court, distance_km: distance };
      })
      .filter((c): c is Court & { distance_km: number } => c !== null)
      .sort((a, b) => a.distance_km - b.distance_km);
  },

  async search(query: string, limit = 20): Promise<Court[]> {
    // Firestore doesn't support full-text search, use simple contains
    // For production, consider Algolia or Elasticsearch
    const upperQuery = query.toUpperCase();
    const snapshot = await db().collection(COLLECTIONS.COURTS)
      .limit(limit * 2) // Get more, filter manually
      .get();
    
    return snapshot.docs
      .map(doc => ({ id: doc.id, ...doc.data() } as Court))
      .filter(c => c.name.toUpperCase().includes(upperQuery) || c.address.toUpperCase().includes(upperQuery))
      .slice(0, limit);
  },

  async create(data: {
    name: string;
    address: string;
    city?: string;
    latitude: number;
    longitude: number;
    totalCourts: number;
    courtType: string;
    surface: string;
    hasLights: boolean;
    isFree: boolean;
    googleMapsUrl?: string;
    notes?: string;
  }): Promise<Court> {
    const id = uuidv4();
    const now = new Date();
    const court: Court = {
      id,
      name: data.name,
      address: data.address,
      city: data.city || null,
      latitude: data.latitude,
      longitude: data.longitude,
      total_courts: data.totalCourts,
      court_type: data.courtType,
      surface: data.surface,
      has_lights: data.hasLights,
      is_free: data.isFree,
      google_maps_url: data.googleMapsUrl || null,
      notes: data.notes || null,
      created_at: now,
      updated_at: now,
    };
    
    await db().collection(COLLECTIONS.COURTS).doc(id).set(court);
    return court;
  },

  async updateStatus(courtId: string, status: string): Promise<void> {
    await db().collection(COLLECTIONS.COURTS).doc(courtId).update({
      status,
      updated_at: new Date(),
    });
  },
};

// Favorite operations
export const favoriteModel = {
  async findByUserId(userId: string): Promise<(FavoriteCourt & { court: Court })[]> {
    const snapshot = await db().collection(COLLECTIONS.FAVORITES)
      .where('user_id', '==', userId)
      .orderBy('created_at', 'desc')
      .get();
    
    const result: (FavoriteCourt & { court: Court })[] = [];
    for (const doc of snapshot.docs) {
      const fav = { id: doc.id, ...doc.data() } as FavoriteCourt;
      const court = await courtModel.findById(fav.court_id);
      if (court) {
        result.push({ ...fav, court });
      }
    }
    return result;
  },

  async findByUserAndCourt(userId: string, courtId: string): Promise<FavoriteCourt | null> {
    const snapshot = await db().collection(COLLECTIONS.FAVORITES)
      .where('user_id', '==', userId)
      .where('court_id', '==', courtId)
      .limit(1)
      .get();
    
    if (snapshot.empty) return null;
    return { id: snapshot.docs[0].id, ...snapshot.docs[0].data() } as FavoriteCourt;
  },

  async add(userId: string, courtId: string): Promise<FavoriteCourt> {
    const existing = await this.findByUserAndCourt(userId, courtId);
    if (existing) return existing;

    const id = uuidv4();
    const favorite: FavoriteCourt = {
      id,
      user_id: userId,
      court_id: courtId,
      created_at: new Date(),
    };
    
    await db().collection(COLLECTIONS.FAVORITES).doc(id).set(favorite);
    return favorite;
  },

  async remove(userId: string, courtId: string): Promise<void> {
    const snapshot = await db().collection(COLLECTIONS.FAVORITES)
      .where('user_id', '==', userId)
      .where('court_id', '==', courtId)
      .get();
    
    const batch = db().batch();
    snapshot.docs.forEach(doc => batch.delete(doc.ref));
    await batch.commit();
  },
};

// Court Report operations
export const courtReportModel = {
  async findByCourtId(courtId: string, limit = 20): Promise<CourtReport[]> {
    // Validate courtId to avoid Firestore error with undefined
    if (!courtId) {
      console.error('findByCourtId called with invalid courtId:', courtId);
      return [];
    }
    
    try {
      // Simple query without orderBy to avoid index requirement
      // Just get reports for this court, we'll sort in memory if needed
      const snapshot = await db().collection(COLLECTIONS.REPORTS)
        .where('court_id', '==', String(courtId))
        .limit(limit)
        .get();
      
      return snapshot.docs.map(doc => {
        const data = doc.data();
        // Filter out any undefined values
        const cleaned: any = {};
        for (const [key, value] of Object.entries(data)) {
          if (value !== undefined) {
            cleaned[key] = value;
          }
        }
        return { id: doc.id, ...cleaned } as CourtReport;
      });
    } catch (err: any) {
      console.error('findByCourtId error:', err.message);
      return [];
    }
  },

  async findRecentByCourtId(courtId: string, hours = 2): Promise<CourtReport[]> {
    const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000);
    const snapshot = await db().collection(COLLECTIONS.REPORTS)
      .where('court_id', '==', courtId)
      .where('created_at', '>=', cutoff)
      .orderBy('created_at', 'desc')
      .get();
    
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as CourtReport));
  },

  async create(data: {
    courtId: string;
    userId: string;
    availableCourts?: number;
    queueGroups?: number;
    waitTimeMinutes?: number;
    status: string;
    reportType?: string;
  }): Promise<CourtReport> {
    const id = uuidv4();
    const report: CourtReport = {
      id,
      court_id: data.courtId,
      user_id: data.userId,
      available_courts: data.availableCourts ?? null,
      queue_groups: data.queueGroups ?? null,
      wait_time_minutes: data.waitTimeMinutes ?? null,
      status: data.status,
      report_type: data.reportType ?? null,
      created_at: new Date(),
    };
    
    await db().collection(COLLECTIONS.REPORTS).doc(id).set(report);
    return report;
  },
};

// Subscription operations
export const subscriptionModel = {
  async findByUserId(userId: string): Promise<Subscription | null> {
    const snapshot = await db().collection('subscriptions')
      .where('user_id', '==', userId)
      .limit(1)
      .get();
    
    if (snapshot.empty) return null;
    return { id: snapshot.docs[0].id, ...snapshot.docs[0].data() } as Subscription;
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
    const now = new Date();
    
    if (existing) {
      const updateData: any = { updated_at: now };
      if (data.stripeSubscriptionId !== undefined) updateData.stripe_subscription_id = data.stripeSubscriptionId;
      if (data.stripeCustomerId !== undefined) updateData.stripe_customer_id = data.stripeCustomerId;
      if (data.status !== undefined) updateData.status = data.status;
      if (data.currentPeriodStart !== undefined) updateData.current_period_start = data.currentPeriodStart;
      if (data.currentPeriodEnd !== undefined) updateData.current_period_end = data.currentPeriodEnd;
      
      await db().collection('subscriptions').doc(existing.id).update(updateData);
    } else {
      const id = uuidv4();
      const subscription: Subscription = {
        id,
        user_id: data.userId,
        stripe_subscription_id: data.stripeSubscriptionId || null,
        stripe_customer_id: data.stripeCustomerId || null,
        status: (data.status || 'TRIALING') as Subscription['status'],
        plan: data.plan || 'monthly',
        current_period_start: data.currentPeriodStart || null,
        current_period_end: data.currentPeriodEnd || null,
        cancelled_at: null,
        created_at: now,
        updated_at: now,
      };
      
      await db().collection('subscriptions').doc(id).set(subscription);
    }
  },
};

// Notification operations
export const notificationModel = {
  async findAllByUserId(userId: string, limit = 20, read?: boolean): Promise<Notification[]> {
    let query: any = db().collection(COLLECTIONS.NOTIFICATIONS)
      .where('user_id', '==', userId)
      .orderBy('created_at', 'desc')
      .limit(limit);
    
    // Note: Firestore doesn't support where + orderBy on different fields efficiently
    // For read filtering, we get all and filter in memory
    const snapshot = await query.get();
    let notifications = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Notification));
    
    if (read !== undefined) {
      notifications = notifications.filter(n => n.read_status === (read ? 1 : 0));
      notifications = notifications.slice(0, limit);
    }
    
    return notifications;
  },

  async markAsRead(id: string, userId: string): Promise<void> {
    await db().collection(COLLECTIONS.NOTIFICATIONS).doc(id).update({ read_status: 1 });
  },

  async markAllAsRead(userId: string): Promise<void> {
    const snapshot = await db().collection(COLLECTIONS.NOTIFICATIONS)
      .where('user_id', '==', userId)
      .where('read_status', '==', 0)
      .get();
    
    const batch = db().batch();
    snapshot.docs.forEach(doc => batch.update(doc.ref, { read_status: 1 }));
    await batch.commit();
  },

  async create(data: { userId: string; title: string; body: string; data?: any }): Promise<Notification> {
    const id = uuidv4();
    const notification: Notification = {
      id,
      user_id: data.userId,
      title: data.title,
      body: data.body,
      data: data.data || {},
      read_status: 0,
      created_at: new Date(),
    };
    
    await db().collection(COLLECTIONS.NOTIFICATIONS).doc(id).set(notification);
    return notification;
  },

  async registerPushToken(userId: string, token: string): Promise<void> {
    const userRef = db().collection(COLLECTIONS.USERS).doc(userId);
    await userRef.set({ pushToken: token }, { merge: true });
  },

  async delete(id: string, userId: string): Promise<void> {
    const docRef = db().collection(COLLECTIONS.NOTIFICATIONS).doc(id);
    const doc = await docRef.get();
    if (doc.exists && doc.data()?.user_id === userId) {
      await docRef.delete();
    }
  },

  async getPushTokensByUserIds(userIds: string[]): Promise<string[]> {
    if (userIds.length === 0) return [];
    
    const tokens: string[] = [];
    const batch = db().collection(COLLECTIONS.USERS).where('id', 'in', userIds);
    const snapshot = await batch.get();
    
    snapshot.docs.forEach(doc => {
      const data = doc.data();
      if (data.pushToken) tokens.push(data.pushToken);
    });
    
    return tokens;
  },
};

// Court subscription for notifications
export interface CourtSubscription {
  id: string;
  user_id: string;
  court_id: string;
  created_at: Date;
}

export const courtSubscriptionModel = {
  async subscribe(userId: string, courtId: string): Promise<void> {
    const id = `${userId}_${courtId}`;
    const subscription: CourtSubscription = {
      id,
      user_id: userId,
      court_id: courtId,
      created_at: new Date(),
    };
    
    await db().collection('court_subscriptions').doc(id).set(subscription, { merge: true });
  },

  async unsubscribe(userId: string, courtId: string): Promise<void> {
    const id = `${userId}_${courtId}`;
    await db().collection('court_subscriptions').doc(id).delete();
  },

  async getUserSubscriptions(userId: string): Promise<CourtSubscription[]> {
    const snapshot = await db().collection('court_subscriptions')
      .where('user_id', '==', userId)
      .get();
    
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as CourtSubscription));
  },

  async getSubscribersByCourt(courtId: string): Promise<CourtSubscription[]> {
    const snapshot = await db().collection('court_subscriptions')
      .where('court_id', '==', courtId)
      .get();
    
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as CourtSubscription));
  },

  async getUserSubscriptionsWithCourts(userId: string): Promise<(CourtSubscription & { court: Court | null })[]> {
    const subscriptions = await this.getUserSubscriptions(userId);
    const result: (CourtSubscription & { court: Court | null })[] = [];
    
    for (const sub of subscriptions) {
      const court = await courtModel.findById(sub.court_id);
      result.push({ ...sub, court });
    }
    
    return result;
  },
};