import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import fastifyJwt from '@fastify/jwt';
import fastifyCookie from '@fastify/cookie';

import { authRoutes } from './routes/auth.js';
import { userRoutes } from './routes/users.js';
import { itemRoutes } from './routes/items.js';
import { billingRoutes } from './routes/billing.js';
import { notificationRoutes } from './routes/notifications.js';
import { healthRoutes } from './routes/health.js';
import { courtRoutes } from './routes/courts.js';
import { errorHandler } from './middleware/errorHandler.js';
import { logger } from './utils/logger.js';

export async function buildApp() {
  const app = Fastify({
    logger: logger,
  });

  // Security headers
  await app.register(helmet, {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", 'data:', 'https:'],
      },
    },
  });

  // CORS
  await app.register(cors, {
    origin: process.env.FRONTEND_URL || '*',
    credentials: true,
  });

  // Rate limiting
  await app.register(rateLimit, {
    max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100', 10),
    timeWindow: process.env.RATE_LIMIT_WINDOW_MS || '15 minutes',
    errorResponseBuilder: () => ({
      error: 'Too Many Requests',
      message: 'Rate limit exceeded. Please try again later.',
      statusCode: 429,
    }),
  });

  // JWT
  await app.register(fastifyJwt, {
    secret: {
      public: process.env.JWT_SECRET || 'default-secret',
    },
    cookie: {
      cookieName: 'refreshToken',
      signed: false,
    },
    sign: {
      expiresIn: process.env.JWT_EXPIRES_IN || '7d',
    },
  });

  // Cookies
  await app.register(fastifyCookie);

  // Error handler
  app.setErrorHandler(errorHandler);

  // Health routes
  await app.register(healthRoutes);

  // API routes
  await app.register(authRoutes, { prefix: '/api/auth' });
  await app.register(userRoutes, { prefix: '/api/users' });
  await app.register(itemRoutes, { prefix: '/api/items' });
  await app.register(billingRoutes, { prefix: '/api/billing' });
  await app.register(notificationRoutes, { prefix: '/api/notifications' });
  await app.register(courtRoutes, { prefix: '/api/courts' });

  // 404 handler
  app.setNotFoundHandler({
    preHandler: app.log.debug,
  }, (request, reply) => {
    reply.status(404).send({
      error: 'Not Found',
      message: `Route ${request.method} ${request.url} not found`,
      statusCode: 404,
    });
  });

  return app;
}
