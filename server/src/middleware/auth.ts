import { FastifyRequest, FastifyReply } from 'fastify';
import { logger } from '../utils/logger.js';
import { authService } from '../services/auth.js';

export interface AuthUser {
  id: string;
  email: string;
  role: 'USER' | 'ADMIN';
}

export async function authenticate(
  request: FastifyRequest,
  reply: FastifyReply
) {
  try {
    // Get token from Authorization header
    const authHeader = request.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return reply.status(401).send({
        error: 'Unauthorized',
        message: 'No token provided',
        statusCode: 401,
      });
    }

    const token = authHeader.substring(7);
    
    // Validate token (in this implementation, we're using refresh token as access token)
    const user = await authService.validateRefreshToken(token);
    
    if (!user) {
      return reply.status(401).send({
        error: 'Unauthorized',
        message: 'Invalid or expired token',
        statusCode: 401,
      });
    }

    request.user = {
      id: user.id,
      email: user.email,
      role: user.role,
    };
  } catch (err) {
    logger.warn({ err }, 'Authentication failed');
    return reply.status(401).send({
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
  
  if (request.user?.role !== 'ADMIN') {
    return reply.status(403).send({
      error: 'Forbidden',
      message: 'Admin access required',
      statusCode: 403,
    });
  }
}
