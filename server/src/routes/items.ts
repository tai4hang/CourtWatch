import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { authenticate } from '../middleware/auth.js';
import { itemModel } from '../db/models.js';
import { trackEvent, AnalyticsEvents } from '../services/analytics.js';

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

    const items = await itemModel.findAllByUserId(request.user!.id, page, limit);

    return {
      items: items.map(item => ({
        id: item.id,
        userId: item.user_id,
        title: item.title,
        description: item.description,
        metadata: item.metadata,
        createdAt: item.created_at,
        updatedAt: item.updated_at,
      })),
      pagination: {
        page,
        limit,
        // Note: Oracle doesn't have easy count, simplifying for now
      },
    };
  });

  // Get item by ID
  fastify.get('/:id', { preHandler: authenticate }, async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const item = await itemModel.findById(request.params.id, request.user!.id);

    if (!item) {
      return reply.status(404).send({ error: 'Item not found' });
    }

    return {
      item: {
        id: item.id,
        userId: item.user_id,
        title: item.title,
        description: item.description,
        metadata: item.metadata,
        createdAt: item.created_at,
        updatedAt: item.updated_at,
      }
    };
  });

  // Create item
  fastify.post('/', { preHandler: authenticate }, async (request: FastifyRequest, reply: FastifyReply) => {
    const input = createItemSchema.parse(request.body);

    const item = await itemModel.create({
      userId: request.user!.id,
      title: input.title,
      description: input.description,
      metadata: input.metadata,
    });

    trackEvent(AnalyticsEvents.ITEM_CREATED, { itemId: item.id }, request.user!.id);

    return { item };
  });

  // Update item
  fastify.put('/:id', { preHandler: authenticate }, async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const input = updateItemSchema.parse(request.body);

    const existing = await itemModel.findById(request.params.id, request.user!.id);
    if (!existing) {
      return reply.status(404).send({ error: 'Item not found' });
    }

    await itemModel.update(request.params.id, request.user!.id, {
      title: input.title,
      description: input.description,
      metadata: input.metadata,
    });

    const updated = await itemModel.findById(request.params.id, request.user!.id);

    return {
      item: {
        id: updated!.id,
        userId: updated!.user_id,
        title: updated!.title,
        description: updated!.description,
        metadata: updated!.metadata,
        createdAt: updated!.created_at,
        updatedAt: updated!.updated_at,
      }
    };
  });

  // Delete item
  fastify.delete('/:id', { preHandler: authenticate }, async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const existing = await itemModel.findById(request.params.id, request.user!.id);
    if (!existing) {
      return reply.status(404).send({ error: 'Item not found' });
    }

    await itemModel.delete(request.params.id, request.user!.id);

    trackEvent(AnalyticsEvents.ITEM_DELETED, { itemId: request.params.id }, request.user!.id);

    return { success: true };
  });
}
