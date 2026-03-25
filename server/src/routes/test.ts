import { FastifyInstance } from 'fastify';
import { getDb } from '../db/firestore.js';

export async function testRoutes(fastify: FastifyInstance) {
  // Test Firestore connection
  fastify.get('/test/firestore', async (request, reply) => {
    try {
      const db = getDb();
      const collections = await db.listCollections();
      
      return {
        status: 'ok',
        message: 'Firestore connected',
        collections: collections.map(c => c.id),
      };
    } catch (err: any) {
      return reply.status(500).send({
        status: 'error',
        message: err.message,
        stack: process.env.NODE_ENV !== 'production' ? err.stack : undefined,
      });
    }
  });

  // Test user model
  fastify.get('/test/user-model', async (request, reply) => {
    try {
      const { userModel } = await import('../db/models.js');
      
      // Try to find a user (should return null)
      const user = await userModel.findByEmail('test@test.com');
      
      return {
        status: 'ok',
        message: 'User model working',
        userFound: !!user,
      };
    } catch (err: any) {
      return reply.status(500).send({
        status: 'error',
        message: err.message,
        stack: process.env.NODE_ENV !== 'production' ? err.stack : undefined,
      });
    }
  });
}