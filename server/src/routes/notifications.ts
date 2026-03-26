import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { authenticate, requireAdmin } from '../middleware/auth.js';
import { notificationModel, courtSubscriptionModel } from '../db/models.js';
import { trackEvent, AnalyticsEvents } from '../services/analytics.js';
import { logger } from '../utils/logger.js';
import { sendPushNotification } from '../services/firebase.js';

const sendNotificationSchema = z.object({
  userId: z.string().optional(),
  title: z.string().min(1),
  body: z.string().min(1),
  data: z.record(z.unknown()).optional(),
});

const registerTokenSchema = z.object({
  token: z.string().min(1),
});

const subscribeSchema = z.object({
  courtId: z.string().min(1),
});

export async function notificationRoutes(fastify: FastifyInstance) {
  // Register push token for current user
  fastify.post('/register', { preHandler: authenticate }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { token } = registerTokenSchema.parse(request.body);
    
    await notificationModel.registerPushToken(request.user!.id, token);
    
    logger.info({ userId: request.user!.id }, 'Push token registered');
    return { success: true };
  });

  // Subscribe to court notifications
  fastify.post('/subscribe', { preHandler: authenticate }, async (request: FastifyRequest<{ Body: { courtId: string } }>, reply: FastifyReply) => {
    const { courtId } = subscribeSchema.parse(request.body);
    
    await courtSubscriptionModel.subscribe(request.user!.id, courtId);
    
    logger.info({ userId: request.user!.id, courtId }, 'User subscribed to court notifications');
    return { success: true };
  });

  // Unsubscribe from court notifications
  fastify.delete('/subscribe/:courtId', { preHandler: authenticate }, async (request: FastifyRequest<{ Params: { courtId: string } }>, reply: FastifyReply) => {
    const { courtId } = request.params;
    
    await courtSubscriptionModel.unsubscribe(request.user!.id, courtId);
    
    logger.info({ userId: request.user!.id, courtId }, 'User unsubscribed from court notifications');
    return { success: true };
  });

  // Get user's court subscriptions
  fastify.get('/subscriptions', { preHandler: authenticate }, async (request: FastifyRequest) => {
    const subscriptions = await courtSubscriptionModel.getUserSubscriptions(request.user!.id);
    
    return { subscriptions };
  });
  // Get user's notifications
  fastify.get('/', { preHandler: authenticate }, async (request: FastifyRequest<{ Querystring: { read?: string; limit?: string } }>) => {
    const limit = parseInt(request.query.limit || '20', 10);
    const read = request.query.read !== undefined ? request.query.read === 'true' : undefined;

    const notifications = await notificationModel.findAllByUserId(request.user!.id, limit, read);

    return {
      notifications: notifications.map(n => ({
        id: n.id,
        userId: n.user_id,
        title: n.title,
        body: n.body,
        data: n.data,
        read: n.read_status === 1,
        createdAt: n.created_at,
      })),
    };
  });

  // Mark notification as read
  fastify.put('/:id/read', { preHandler: authenticate }, async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    await notificationModel.markAsRead(request.params.id, request.user!.id);
    return { success: true };
  });

  // Mark all as read
  fastify.put('/read-all', { preHandler: authenticate }, async (request: FastifyRequest) => {
    await notificationModel.markAllAsRead(request.user!.id);
    return { success: true };
  });

  // Delete notification
  fastify.delete('/:id', { preHandler: authenticate }, async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    // For now, just return success (implement delete if needed)
    return { success: true };
  });

  // Send notification (admin only)
  fastify.post('/send', { preHandler: requireAdmin }, async (request: FastifyRequest, reply: FastifyReply) => {
    const input = sendNotificationSchema.parse(request.body);

    if (input.userId) {
      const notification = await notificationModel.create({
        userId: input.userId,
        title: input.title,
        body: input.body,
        data: input.data,
      });

      trackEvent(AnalyticsEvents.NOTIFICATION_SENT, { notificationId: notification.id });

      logger.info({ notificationId: notification.id, userId: input.userId }, 'Notification sent');

      return { notification };
    }

    return reply.status(400).send({ error: 'userId required' });
  });
}
