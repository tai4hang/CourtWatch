import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { authenticate } from '../middleware/auth.js';
import { 
  courtModel, 
  favoriteModel, 
  courtReportModel 
} from '../db/models.js';
import { trackEvent, AnalyticsEvents } from '../services/analytics.js';
import { logger } from '../utils/logger.js';
import { notifyCourtAvailable } from '../services/firebase.js';

// Helper to convert Date or Timestamp to ISO string
const toISOString = (date: any): string | null => {
  if (!date) return null;
  if (typeof date.toISOString === 'function') {
    return date.toISOString();
  }
  if (date._seconds) {
    return new Date(date._seconds * 1000).toISOString();
  }
  return null;
};

// Calculate distance between two coordinates in km (Haversine formula)
const calculateDistance = (lat1: number, lng1: number, lat2: number, lng2: number): number => {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

const createCourtSchema = z.object({
  name: z.string().min(1),
  address: z.string().min(1),
  city: z.string().optional(),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  totalCourts: z.number().int().positive(),
  courtType: z.string().min(1),
  surface: z.string().min(1),
  hasLights: z.boolean(),
  isFree: z.boolean(),
  googleMapsUrl: z.string().url().optional(),
  notes: z.string().optional(),
});

const reportStatusSchema = z.object({
  courtId: z.string().uuid(),
  status: z.string().min(1),
  availableCourts: z.number().int().min(0).optional(),
  queueGroups: z.number().int().min(0).optional(),
  waitTimeMinutes: z.number().int().min(0).optional(),
  reportType: z.string().optional(),
});

// Get all courts with pagination
export async function courtRoutes(fastify: FastifyInstance) {
  // Get all courts
  fastify.get('/', async (request: FastifyRequest<{ 
    Querystring: { page?: string; limit?: string; search?: string; status?: string; city?: string } 
  }>, reply: FastifyReply) => {
    const page = parseInt(request.query.page || '1', 10);
    const limit = Math.min(parseInt(request.query.limit || '20', 10), 500);
    const search = request.query.search;
    const statusFilter = request.query.status;
    const cityFilter = request.query.city;

    let courts;
    if (search) {
      courts = await courtModel.search(search, limit);
    } else {
      courts = await courtModel.findAll(page, limit);
    }

    // Add lastReported from most recent report for each court
    const courtsWithLastReported = await Promise.all(
      courts.map(async (court) => {
        const reports = await courtReportModel.findByCourtId(court.id, 1);
        const lastReported = reports.length > 0 ? reports[0].created_at : null;
        return {
          ...court,
          lastReported: toISOString(lastReported),
        };
      })
    );

    // Filter by status if provided
    let filteredCourts = courtsWithLastReported;
    if (statusFilter) {
      filteredCourts = courtsWithLastReported.filter(c => c.status === statusFilter);
    }

    // Filter by city if provided (supports comma-separated list of cities)
    if (cityFilter && cityFilter !== 'all') {
      const cityList = cityFilter.split(',').map(c => c.trim());
      filteredCourts = filteredCourts.filter(c => c.city && cityList.includes(c.city));
    }

    return { courts: filteredCourts };
  });

  // Get nearby courts
  fastify.get('/nearby', async (request: FastifyRequest<{ 
    Querystring: { lat: string; lng: string; radius?: string; limit?: string } 
  }>, reply: FastifyReply) => {
    const lat = parseFloat(request.query.lat);
    const lng = parseFloat(request.query.lng);
    const radiusKm = parseFloat(request.query.radius || '10');
    const limit = Math.min(parseInt(request.query.limit || '20', 10), 500);

    // Validate coordinates
    if (isNaN(lat) || isNaN(lng) || lat === undefined || lng === undefined) {
      console.error('Invalid coordinates:', { lat, lng, query: request.query });
      return reply.status(400).send({ error: 'Invalid coordinates' });
    }

    console.log('findNearby called with:', { lat, lng, radiusKm, limit });
    const courts = await courtModel.findNearby(lat, lng, radiusKm, limit);

    // Add lastReported and distance_km for each court
    const courtsWithMeta = await Promise.all(
      courts.map(async (court) => {
        const reports = await courtReportModel.findByCourtId(court.id, 1);
        const lastReported = reports.length > 0 ? reports[0].created_at : null;
        
        // Calculate distance
        const distance_km = calculateDistance(lat, lng, court.latitude, court.longitude);
        
        return {
          ...court,
          lastReported: toISOString(lastReported),
          distance_km,
        };
      })
    );

    return { courts: courtsWithMeta };
  });

  // Get court by ID
  fastify.get('/:id', async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const court = await courtModel.findById(request.params.id);

    if (!court) {
      return reply.status(404).send({ error: 'Court not found' });
    }

    const reports = await courtReportModel.findByCourtId(court.id, 10);

    // Get the most recent report timestamp
    const lastReported = reports.length > 0 ? reports[0].created_at : null;

    return {
      court: {
        ...court,
        lastReported: toISOString(lastReported),
        reports: reports.map(r => ({
          id: r.id,
          userId: r.user_id,
          availableCourts: r.available_courts,
          queueGroups: r.queue_groups,
          waitTimeMinutes: r.wait_time_minutes,
          status: r.status,
          reportType: r.report_type,
          createdAt: toISOString(r.created_at),
        })),
      },
    };
  });

  // Create a new court
  fastify.post('/', { preHandler: authenticate }, async (request: FastifyRequest, reply: FastifyReply) => {
    const input = createCourtSchema.parse(request.body);

    const court = await courtModel.create({
      name: input.name,
      address: input.address,
      city: input.city,
      latitude: input.latitude,
      longitude: input.longitude,
      totalCourts: input.totalCourts,
      courtType: input.courtType,
      surface: input.surface,
      hasLights: input.hasLights,
      isFree: input.isFree,
      googleMapsUrl: input.googleMapsUrl,
      notes: input.notes,
    });

    trackEvent(AnalyticsEvents.COURT_CREATED, { courtId: court.id }, request.user!.id);

    return { court };
  });

  // Report court status (requires auth)
  fastify.post('/report', { preHandler: authenticate }, async (request: FastifyRequest, reply: FastifyReply) => {
    const input = reportStatusSchema.parse(request.body);

    // Verify court exists
    const court = await courtModel.findById(input.courtId);
    if (!court) {
      return reply.status(404).send({ error: 'Court not found' });
    }

    // Get previous status to check if it changed to AVAILABLE
    const previousStatus = court.status;

    const report = await courtReportModel.create({
      courtId: input.courtId,
      userId: request.user!.id,
      status: input.status,
      availableCourts: input.availableCourts,
      queueGroups: input.queueGroups,
      waitTimeMinutes: input.waitTimeMinutes,
      reportType: input.reportType,
    });

    // Update court status and timestamp
    await courtModel.updateStatus(input.courtId, input.status);

    trackEvent(AnalyticsEvents.COURT_REPORTED, { 
      courtId: input.courtId, 
      status: input.status 
    }, request.user!.id);

    // Send push notification if court became AVAILABLE
    if (input.status === 'AVAILABLE' && previousStatus !== 'AVAILABLE') {
      try {
        await notifyCourtAvailable(input.courtId, court.name, court.city || 'GTA');
      } catch (err) {
        logger.error({ err, courtId: input.courtId }, 'Failed to send notification');
      }
    }

    return { report };
  });

  // Get user's favorites
  fastify.get('/favorites/me', { preHandler: authenticate }, async (request: FastifyRequest) => {
    const favorites = await favoriteModel.findByUserId(request.user!.id);

    return {
      favorites: favorites.map(fav => ({
        id: fav.id,
        court: fav.court,
        addedAt: fav.created_at,
      })),
    };
  });

  // Add to favorites
  fastify.post('/favorites', { preHandler: authenticate }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { courtId } = request.body as { courtId: string };

    if (!courtId) {
      return reply.status(400).send({ error: 'courtId is required' });
    }

    const court = await courtModel.findById(courtId);
    if (!court) {
      return reply.status(404).send({ error: 'Court not found' });
    }

    const favorite = await favoriteModel.add(request.user!.id, courtId);

    trackEvent(AnalyticsEvents.FAVORITE_ADDED, { courtId }, request.user!.id);

    return { favorite: { id: favorite.id, courtId, addedAt: favorite.created_at } };
  });

  // Remove from favorites
  fastify.delete('/favorites/:courtId', { preHandler: authenticate }, async (request: FastifyRequest<{ Params: { courtId: string } }>) => {
    await favoriteModel.remove(request.user!.id, request.params.courtId);

    return { success: true };
  });

  // Check if court is favorite
  fastify.get('/favorites/check/:courtId', { preHandler: authenticate }, async (request: FastifyRequest<{ Params: { courtId: string } }>) => {
    const favorite = await favoriteModel.findByUserAndCourt(request.user!.id, request.params.courtId);

    return { isFavorite: !!favorite };
  });

  // Get court reports
  fastify.get('/:courtId/reports', async (request: FastifyRequest<{ Params: { courtId: string }; Querystring: { limit?: string } }>) => {
    const limit = parseInt(request.query.limit || '20', 10);
    const reports = await courtReportModel.findByCourtId(request.params.courtId, limit);

    return {
      reports: reports.map(r => ({
        id: r.id,
        userId: r.user_id,
        availableCourts: r.available_courts,
        queueGroups: r.queue_groups,
        waitTimeMinutes: r.wait_time_minutes,
        status: r.status,
        reportType: r.report_type,
        createdAt: toISOString(r.created_at),
      })),
    };
  });
}