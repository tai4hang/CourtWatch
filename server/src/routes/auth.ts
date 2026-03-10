import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { authService } from '../services/auth.js';
import { trackEvent, AnalyticsEvents } from '../services/analytics.js';
import { authenticate } from '../middleware/auth.js';

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().optional(),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

export async function authRoutes(fastify: FastifyInstance) {
  // Register
  fastify.post('/register', async (request: FastifyRequest, reply: FastifyReply) => {
    const input = registerSchema.parse(request.body);
    const result = await authService.register(input);
    
    trackEvent(AnalyticsEvents.USER_SIGNUP, { email: input.email }, result.user.id);
    
    // Set refresh token as HTTP-only cookie
    reply.setCookie('refreshToken', result.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 30 * 24 * 60 * 60, // 30 days
    });
    
    return {
      user: result.user,
      accessToken: result.accessToken,
    };
  });

  // Login
  fastify.post('/login', async (request: FastifyRequest, reply: FastifyReply) => {
    const input = loginSchema.parse(request.body);
    const result = await authService.login(input);
    
    trackEvent(AnalyticsEvents.USER_LOGIN, { email: input.email }, result.user.id);
    
    reply.setCookie('refreshToken', result.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 30 * 24 * 60 * 60,
    });
    
    return {
      user: result.user,
      accessToken: result.accessToken,
    };
  });

  // Refresh token
  fastify.post('/refresh', async (request: FastifyRequest, reply: FastifyReply) => {
    const refreshToken = request.cookies.refreshToken || request.body?.refreshToken;
    if (!refreshToken) {
      return reply.status(401).send({ error: 'No refresh token provided' });
    }
    
    const result = await authService.refresh(refreshToken);
    
    reply.setCookie('refreshToken', result.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 30 * 24 * 60 * 60,
    });
    
    return { accessToken: result.accessToken };
  });

  // Logout
  fastify.post('/logout', async (request: FastifyRequest, reply: FastifyReply) => {
    const refreshToken = request.cookies.refreshToken;
    if (refreshToken) {
      await authService.logout(refreshToken);
    }
    
    reply.clearCookie('refreshToken');
    return { success: true };
  });

  // Verify token (protected route example)
  fastify.get('/verify', { preHandler: authenticate }, async (request: FastifyRequest) => {
    return { user: request.user };
  });
}
