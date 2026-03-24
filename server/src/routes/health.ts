import { FastifyInstance } from 'fastify';
import { getDbConnection } from '../db/connection.js';

export async function healthRoutes(fastify: FastifyInstance) {
  // Basic health check
  fastify.get('/health', async () => {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    };
  });

  // Detailed health check with dependencies
  fastify.get('/health/ready', async () => {
    const checks: Record<string, { status: string; latency?: number }> = {};

    // Firestore database check
    const dbStart = Date.now();
    try {
      const db = getDbConnection();
      // Try to get a simple document to verify connection
      await db.collection('_health').doc('check').get();
      checks.database = { status: 'ok', latency: Date.now() - dbStart };
    } catch (err) {
      console.error('DB health check error:', err);
      checks.database = { status: 'error' };
    }

    const allOk = Object.values(checks).every(c => c.status === 'ok');

    return {
      status: allOk ? 'ready' : 'degraded',
      checks,
    };
  });

  // Liveness probe
  fastify.get('/health/live', async () => {
    return { status: 'alive' };
  });
}