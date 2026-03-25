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
    // Get token from Authorization header or from cookie
    const authHeader = request.headers.authorization;
    let token: string | undefined;
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7);
    } else if (request.cookies?.refreshToken) {
      // Also accept refresh token from cookie
      token = request.cookies.refreshToken;
    }
    
    if (!token) {
      return reply.status(401).send({
        error: 'Unauthorized',
        message: 'No token provided',
        statusCode: 401,
      });
    }
    
    // Validate token - check both access and refresh tokens
    const user = await authService.validateToken(token);
    
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
    logger.error({ err }, 'Authentication failed with error');
    return reply.status(401).send({
      error: 'Unauthorized',
      message: 'Validate token error',
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
