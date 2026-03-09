import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { authenticate, requireAdmin } from '../middleware/auth.js';
import { PrismaClient } from '@prisma/client';
import { trackEvent, AnalyticsEvents } from '../services/analytics.js';
import { logger } from '../utils/logger.js';

const prisma = new PrismaClient();

const sendNotificationSchema = z.object({
  userId: z.string().optional(),
  title: z.string().min(1),
  body: z.string().min(1),
  data: z.record(z.unknown()).optional(),
});

// Firebase Admin SDK would be initialized here for production
// For now, we'll simulate the push notification service

export async function notificationRoutes(fastify: FastifyInstance) {
  // Get user's notifications
  fastify.get('/', { preHandler: authenticate }, async (request: FastifyRequest<{ Querystring: { read?: string; limit?: string } }>) => {
    const limit = parseInt(request.query.limit || '20', 10);
    const where: { userId: string; read?: boolean } = { userId: request.user!.id };

    if (request.query.read !== undefined) {
      where.read = request.query.read === 'true';
    }

    const notifications = await prisma.notification.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    return { notifications };
  });

  // Mark notification as read
  fastify.put('/:id/read', { preHandler: authenticate }, async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const notification = await prisma.notification.findFirst({
      where: { id: request.params.id, userId: request.user!.id },
    });

    if (!notification) {
      return reply.status(404).send({ error: 'Notification not found' });
    }

    await prisma.notification.update({
      where: { id: request.params.id },
      data: { read: true },
    });

    return { success: true };
  });

  // Mark all as read
  fastify.put('/read-all', { preHandler: authenticate }, async (request: FastifyRequest) => {
    await prisma.notification.updateMany({
      where: { userId: request.user!.id, read: false },
      data: { read: true },
    });

    return { success: true };
  });

  // Delete notification
  fastify.delete('/:id', { preHandler: authenticate }, async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const notification = await prisma.notification.findFirst({
      where: { id: request.params.id, userId: request.user!.id },
    });

    if (!notification) {
      return reply.status(404).send({ error: 'Notification not found' });
    }

    await prisma.notification.delete({ where: { id: request.params.id } });

    return { success: true };
  });

  // Send notification (admin only)
  fastify.post('/send', { preHandler: requireAdmin }, async (request: FastifyRequest, reply: FastifyReply) => {
    const input = sendNotificationSchema.parse(request.body);

    // If userId is specified, send to that user
    // Otherwise, would need to fetch users from database
    if (input.userId) {
      const notification = await prisma.notification.create({
        data: {
          userId: input.userId,
          title: input.title,
          body: input.body,
          data: input.data,
        },
      });

      trackEvent(AnalyticsEvents.NOTIFICATION_SENT, { notificationId: notification.id });

      // In production, integrate with FCM/APNS here
      logger.info({ notificationId: notification.id, userId: input.userId }, 'Notification sent');

      return { notification };
    }

    return reply.status(400).send({ error: 'userId required' });
  });
}
