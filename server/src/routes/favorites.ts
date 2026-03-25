import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { authenticate } from '../middleware/auth.js';
import { favoriteModel, courtModel } from '../db/models.js';
import { z } from 'zod';

const favoriteSchema = z.object({
  courtId: z.string(),
});

export async function favoriteRoutes(fastify: FastifyInstance) {
  // Get user's favorites
  fastify.get('/', { preHandler: authenticate }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const userId = (request as any).user.id;
      const favorites = await favoriteModel.findByUserId(userId);
      
      // Enrich with court data
      const enriched = await Promise.all(
        favorites.map(async (fav: any) => {
          const court = await courtModel.findById(fav.court_id);
          return { ...fav, court };
        })
      );
      
      return enriched;
    } catch (err) {
      request.log.error(err);
      reply.status(500).send({ error: 'Failed to fetch favorites' });
    }
  });

  // Add favorite
  fastify.post('/', { preHandler: authenticate }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const userId = (request as any).user.id;
      const { courtId } = favoriteSchema.parse(request.body);
      
      // Check court exists
      const court = await courtModel.findById(courtId);
      if (!court) {
        return reply.status(404).send({ error: 'Court not found' });
      }
      
      const favorite = await favoriteModel.create(userId, courtId);
      return reply.status(201).send(favorite);
    } catch (err: any) {
      if (err.message?.includes('UNIQUE constraint')) {
        return reply.status(400).send({ error: 'Already favorited' });
      }
      request.log.error(err);
      reply.status(500).send({ error: 'Failed to add favorite' });
    }
  });

  // Remove favorite
  fastify.delete('/:courtId', { preHandler: authenticate }, async (request: FastifyRequest<{ Params: { courtId: string } }>, reply: FastifyReply) => {
    try {
      const userId = (request as any).user.id;
      const { courtId } = request.params;
      
      await favoriteModel.delete(userId, courtId);
      return reply.status(204).send();
    } catch (err) {
      request.log.error(err);
      reply.status(500).send({ error: 'Failed to remove favorite' });
    }
  });
}