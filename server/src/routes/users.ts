import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { authenticate } from '../middleware/auth.js';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const updateUserSchema = z.object({
  name: z.string().optional(),
  avatarUrl: z.string().url().optional(),
});

export async function userRoutes(fastify: FastifyInstance) {
  // Get current user
  fastify.get('/me', { preHandler: authenticate }, async (request: FastifyRequest, reply: FastifyReply) => {
    const user = await prisma.user.findUnique({
      where: { id: request.user!.id },
      select: {
        id: true,
        email: true,
        name: true,
        avatarUrl: true,
        role: true,
        createdAt: true,
        subscription: {
          select: {
            id: true,
            status: true,
            plan: true,
            currentPeriodEnd: true,
          },
        },
      },
    });

    if (!user) {
      return reply.status(404).send({ error: 'User not found' });
    }

    return { user };
  });

  // Update current user
  fastify.put('/me', { preHandler: authenticate }, async (request: FastifyRequest, reply: FastifyReply) => {
    const input = updateUserSchema.parse(request.body);

    const user = await prisma.user.update({
      where: { id: request.user!.id },
      data: input,
      select: {
        id: true,
        email: true,
        name: true,
        avatarUrl: true,
        role: true,
        createdAt: true,
      },
    });

    return { user };
  });

  // Get user by ID (admin only)
  fastify.get('/:id', { preHandler: authenticate }, async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    if (request.user?.role !== 'admin') {
      return reply.status(403).send({ error: 'Forbidden' });
    }

    const user = await prisma.user.findUnique({
      where: { id: request.params.id },
      select: {
        id: true,
        email: true,
        name: true,
        avatarUrl: true,
        role: true,
        createdAt: true,
        subscription: true,
      },
    });

    if (!user) {
      return reply.status(404).send({ error: 'User not found' });
    }

    return { user };
  });
}
