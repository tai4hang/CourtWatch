import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { authenticate } from '../middleware/auth.js';
import { userModel, subscriptionModel } from '../db/models.js';

const updateUserSchema = z.object({
  name: z.string().optional(),
  avatarUrl: z.string().optional(),
});

export async function userRoutes(fastify: FastifyInstance) {
  // Get current user
  fastify.get('/me', { preHandler: authenticate }, async (request: FastifyRequest, reply: FastifyReply) => {
    const user = await userModel.findById(request.user!.id);

    if (!user) {
      return reply.status(404).send({ error: 'User not found' });
    }

    const subscription = await subscriptionModel.findByUserId(request.user!.id);

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        avatarUrl: user.avatar_url,
        role: user.role,
        createdAt: user.created_at,
      },
      subscription: subscription ? {
        id: subscription.id,
        status: subscription.status,
        plan: subscription.plan,
        currentPeriodEnd: subscription.current_period_end,
      } : null,
    };
  });

  // Get subscription (placeholder - no subscription system yet)
  fastify.get('/subscription', { preHandler: authenticate }, async (request: FastifyRequest, reply: FastifyReply) => {
    return { subscription: null };
  });

  // Update current user
  fastify.put('/me', { preHandler: authenticate }, async (request: FastifyRequest, reply: FastifyReply) => {
    const input = updateUserSchema.parse(request.body);

    await userModel.update(request.user!.id, {
      name: input.name,
      avatarUrl: input.avatarUrl,
    });

    const user = await userModel.findById(request.user!.id);

    return {
      user: {
        id: user!.id,
        email: user!.email,
        name: user!.name,
        avatarUrl: user!.avatar_url,
        role: user!.role,
        createdAt: user!.created_at,
      }
    };
  });
}
