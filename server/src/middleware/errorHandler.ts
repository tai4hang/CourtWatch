import { FastifyError, FastifyReply, FastifyRequest } from 'fastify';
import { logger } from '../utils/logger.js';
import { ZodError } from 'zod';

export function errorHandler(
  error: FastifyError,
  request: FastifyRequest,
  reply: FastifyReply
) {
  // Log error
  logger.error({
    err: error,
    method: request.method,
    url: request.url,
    params: request.params,
    query: request.query,
  });

  // Zod validation errors
  if (error instanceof ZodError) {
    return reply.status(400).send({
      error: 'Validation Error',
      message: 'Invalid request data',
      details: error.errors,
      statusCode: 400,
    });
  }

  // Fastify JWT errors
  if (error.name === 'JsonWebTokenError') {
    return reply.status(401).send({
      error: 'Unauthorized',
      message: 'Invalid token',
      statusCode: 401,
    });
  }

  if (error.name === 'TokenExpiredError') {
    return reply.status(401).send({
      error: 'Unauthorized',
      message: 'Token expired',
      statusCode: 401,
    });
  }

  // Custom app errors with statusCode
  if (error.statusCode && error.statusCode < 500) {
    return reply.status(error.statusCode).send({
      error: error.name,
      message: error.message,
      statusCode: error.statusCode,
    });
  }

  // Default error
  const statusCode = error.statusCode || 500;
  const message = error.message || 'Internal Server Error';

  return reply.status(statusCode).send({
    error: statusCode >= 500 ? 'Internal Server Error' : error.name,
    message: process.env.NODE_ENV === 'production' && statusCode >= 500
      ? 'Something went wrong'
      : message,
    statusCode,
  });
}
