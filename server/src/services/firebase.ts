import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getMessaging, MulticastMessage } from 'firebase-admin/messaging';
import { logger } from '../utils/logger.js';
import { notificationModel, courtSubscriptionModel } from '../db/models.js';

// Handle both plain and base64-encoded private key
let privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');
if (!privateKey && process.env.FIREBASE_PRIVATE_KEY_B64) {
  privateKey = Buffer.from(process.env.FIREBASE_PRIVATE_KEY_B64, 'base64').toString('utf-8');
}

const serviceAccount = {
  type: 'service_account',
  project_id: 'courtwatch-a4135',
  private_key: privateKey,
  client_email: process.env.FIREBASE_CLIENT_EMAIL,
};

// Initialize Firebase Admin
if (getApps().length === 0) {
  try {
    if (serviceAccount.private_key && serviceAccount.client_email) {
      initializeApp({
        credential: cert(serviceAccount as any),
      });
      logger.info('Firebase Admin initialized');
    } else {
      logger.warn('Firebase Admin: Missing credentials, push notifications will not work');
    }
  } catch (err) {
    logger.error({ err }, 'Firebase Admin init error');
  }
}

export async function sendPushNotification(
  tokens: string[],
  title: string,
  body: string,
  data?: Record<string, string>
): Promise<number> {
  if (tokens.length === 0) {
    return 0;
  }

  try {
    const messaging = getMessaging();
    
    const message: MulticastMessage = {
      tokens,
      notification: {
        title,
        body,
      },
      data: data || {},
      android: {
        priority: 'high' as const,
        notification: {
          channelId: 'courtwatch',
        },
      },
      apns: {
        payload: {
          aps: {
            sound: 'default',
          },
        },
      },
    };

    const response = await messaging.sendEachForMulticast(message);
    
    logger.info({ 
      successCount: response.successCount, 
      failureCount: response.failures.length 
    }, 'Push notification sent');

    return response.successCount;
  } catch (err) {
    logger.error({ err }, 'Failed to send push notification');
    throw err;
  }
}

export async function notifyCourtAvailable(courtId: string, courtName: string, city: string): Promise<void> {
  try {
    // Get all subscribers for this court
    const subscriptions = await courtSubscriptionModel.getSubscribersByCourt(courtId);
    
    if (subscriptions.length === 0) {
      logger.info({ courtId }, 'No subscribers for this court');
      return;
    }

    // Get push tokens for all subscribers
    const userIds = subscriptions.map(s => s.user_id);
    const tokens = await notificationModel.getPushTokensByUserIds(userIds);
    
    if (tokens.length === 0) {
      logger.info({ courtId }, 'No push tokens found for subscribers');
      return;
    }

    // Send push notification
    await sendPushNotification(
      tokens,
      'Court Available! 🎾',
      `${courtName} in ${city} is now available!`,
      { courtId, type: 'court_available' }
    );

    logger.info({ courtId, recipientCount: tokens.length }, 'Court available notification sent');
  } catch (err) {
    logger.error({ err, courtId }, 'Failed to notify court subscribers');
  }
}

