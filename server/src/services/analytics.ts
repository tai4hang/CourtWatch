import { PostHog } from 'posthog-node';
import { logger } from '../utils/logger.js';

let posthog: PostHog | null = null;

export function initPostHog() {
  const apiKey = process.env.POSTHOG_API_KEY;
  if (!apiKey) {
    logger.warn('PostHog API key not configured');
    return;
  }
  
  posthog = new PostHog(apiKey, {
    host: process.env.POSTHOG_HOST || 'https://app.posthog.com',
  });
  
  logger.info('PostHog initialized');
}

export function trackEvent(
  event: string,
  properties?: Record<string, unknown>,
  userId?: string
) {
  if (!posthog) return;
  
  try {
    posthog.capture({
      event,
      properties: {
        ...properties,
        environment: process.env.NODE_ENV,
      },
      distinctId: userId || 'anonymous',
    });
  } catch (err) {
    logger.error({ err, event }, 'Failed to track event');
  }
}

export function identifyUser(userId: string, traits?: Record<string, unknown>) {
  if (!posthog) return;
  
  try {
    posthog.identify({
      distinctId: userId,
      properties: traits,
    });
  } catch (err) {
    logger.error({ err, userId }, 'Failed to identify user');
  }
}

// Predefined events
export const AnalyticsEvents = {
  USER_SIGNUP: 'user_signup',
  USER_LOGIN: 'user_login',
  SUBSCRIPTION_CREATED: 'subscription_created',
  SUBSCRIPTION_CANCELLED: 'subscription_cancelled',
  ITEM_CREATED: 'item_created',
  ITEM_DELETED: 'item_deleted',
  NOTIFICATION_SENT: 'notification_sent',
} as const;
