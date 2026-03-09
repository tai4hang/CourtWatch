import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { authenticate } from '../middleware/auth.js';
import { PrismaClient } from '@prisma/client';
import { trackEvent, AnalyticsEvents } from '../services/analytics.js';

const prisma = new PrismaClient();

const createItemSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});

const updateItemSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});

export async function itemRoutes(fastify: FastifyInstance) {
  // Get all items (with pagination)
  fastify.get('/', { preHandler: authenticate }, async (request: FastifyRequest<{ Querystring: { page?: string; limit?: string } }>) => {
    const page = parseInt(request.query.page || '1', 10);
    const limit = parseInt(request.query.limit || '20', 10);
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      prisma.item.findMany({
        where: { userId: request.user!.id },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.item.count({ where: { userId: request.user!.id } }),
    ]);

    return {
      items,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  });

  // Get item by ID
  fastify.get('/:id', { preHandler: authenticate }, async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const item = await prisma.item.findFirst({
      where: { id: request.params.id, userId: request.user!.id },
    });

    if (!item) {
      return reply.status(404).send({ error: 'Item not found' });
    }

    return { item };
  });

  // Create item
  fastify.post('/', { preHandler: authenticate }, async (request: FastifyRequest, reply: FastifyReply) => {
    const input = createItemSchema.parse(request.body);

    const item = await prisma.item.create({
      data: {
        ...input,
        userId: request.user!.id,
      },
    });

    trackEvent(AnalyticsEvents.ITEM_CREATED, { itemId: item.id }, request.user!.id);

    return { item };
  });

  // Update item
  fastify.put('/:id', { preHandler: authenticate }, async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const input = updateItemSchema.parse(request.body);

    // Check ownership
    const existing = await prisma.item.findFirst({
      where: { id: request.params.id, userId: request.user!.id },
    });

    if (!existing) {
      return reply.status(404).send({ error: 'Item not found' });
    }

    const item = await prisma.item.update({
      where: { id: request.params.id },
      data: input,
    });

    return { item };
  });

  // Delete item
  fastify.delete('/:id', { preHandler: authenticate }, async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const existing = await prisma.item.findFirst({
      where: { id: request.params.id, userId: request.user!.id },
    });

    if (!existing) {
      return reply.status(404).send({ error: 'Item not found' });
    }

    await prisma.item.delete({ where: { id: request.params.id } });

    trackEvent(AnalyticsEvents.ITEM_DELETED, { itemId: request.params.id }, request.user!.id);

    return { success: true };
  });
}
