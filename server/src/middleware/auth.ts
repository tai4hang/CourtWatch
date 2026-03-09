import { FastifyRequest, FastifyReply } from 'fastify';
import { logger } from '../utils/logger.js';

export interface AuthUser {
  id: string;
  email: string;
  role: 'user' | 'admin';
}

declare module 'fastify' {
  interface FastifyRequest {
    user?: AuthUser;
  }
}

export async function authenticate(
  request: FastifyRequest,
  reply: FastifyReply
) {
  try {
    await request.jwtVerify();
  } catch (err) {
    logger.warn({ err }, 'Authentication failed');
    reply.status(401).send({
      error: 'Unauthorized',
      message: 'Invalid or expired token',
      statusCode: 401,
    });
  }
}

export async function requireAdmin(
  request: FastifyRequest,
  reply: FastifyReply
) {
  await authenticate(request, reply);
  
  if (request.user?.role !== 'admin') {
    reply.status(403).send({
      error: 'Forbidden',
      message: 'Admin access required',
      statusCode: 403,
    });
  }
}
