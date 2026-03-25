import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { authenticate } from '../middleware/auth.js';
import { courtModel, favoriteModel, courtReportModel } from '../db/models.js';
import { z } from 'zod';

const courtSchema = z.object({
  name: z.string(),
  address: z.string(),
  latitude: z.number(),
  longitude: z.number(),
  totalCourts: z.number().optional().default(1),
  courtType: z.string().optional().default('tennis'),
  surface: z.string().optional().default('hard'),
  hasLights: z.boolean().optional().default(false),
  isFree: z.boolean().optional().default(false),
  googleMapsUrl: z.string().optional(),
  notes: z.string().optional(),
});

const reportSchema = z.object({
  courtId: z.string(),
  availableCourts: z.number().optional(),
  queueGroups: z.number().optional(),
  waitTimeMinutes: z.number().optional(),
  status: z.string(),
  reportType: z.string().optional(),
});

export async function courtRoutes(fastify: FastifyInstance) {
  // Get all courts
  fastify.get('/', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const courts = await courtModel.findAll();
      return courts;
    } catch (err) {
      request.log.error(err);
      reply.status(500).send({ error: 'Failed to fetch courts' });
    }
  });

  // Get nearby courts
  fastify.get('/nearby', async (request: FastifyRequest<{ Querystring: { lat: string; lng: string; radius?: string } }>, reply: FastifyReply) => {
    try {
      const { lat, lng, radius } = request.query;
      if (!lat || !lng) {
        return reply.status(400).send({ error: 'lat and lng are required' });
      }
      
      const courts = await courtModel.findNearby(
        parseFloat(lat),
        parseFloat(lng),
        radius ? parseFloat(radius) : 5
      );
      return courts;
    } catch (err) {
      request.log.error(err);
      reply.status(500).send({ error: 'Failed to fetch nearby courts' });
    }
  });

  // Get court by ID
  fastify.get('/:id', async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    try {
      const { id } = request.params;
      const court = await courtModel.findById(id);
      
      if (!court) {
        return reply.status(404).send({ error: 'Court not found' });
      }
      
      return court;
    } catch (err) {
      request.log.error(err);
      reply.status(500).send({ error: 'Failed to fetch court' });
    }
  });

  // Create court
  fastify.post('/', { preHandler: authenticate }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const input = courtSchema.parse(request.body);
      const court = await courtModel.create(input);
      return reply.status(201).send(court);
    } catch (err) {
      request.log.error(err);
      reply.status(500).send({ error: 'Failed to create court' });
    }
  });

  // Get court reports
  fastify.get('/:id/reports', async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    try {
      const { id } = request.params;
      const reports = await courtReportModel.findByCourtId(id);
      return reports;
    } catch (err) {
      request.log.error(err);
      reply.status(500).send({ error: 'Failed to fetch reports' });
    }
  });

  // Create court report
  fastify.post('/:id/reports', { preHandler: authenticate }, async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    try {
      const { id } = request.params;
      const userId = (request as any).user.id;
      const input = reportSchema.parse({ ...request.body, courtId: id });
      
      const report = await courtReportModel.create({
        ...input,
        user_id: userId,
      });
      
      return reply.status(201).send(report);
    } catch (err) {
      request.log.error(err);
      reply.status(500).send({ error: 'Failed to create report' });
    }
  });

  // Get favorites for a court
  fastify.get('/:id/favorites', async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    try {
      // Just return empty for now - need user context
      return [];
    } catch (err) {
      request.log.error(err);
      reply.status(500).send({ error: 'Failed to fetch favorites' });
    }
  });
}