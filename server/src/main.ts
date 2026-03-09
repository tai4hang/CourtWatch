import { buildApp } from './app.js';
import { logger } from './utils/logger.js';

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

async function start() {
  try {
    const app = await buildApp();
    
    await app.listen({ port: PORT, host: '0.0.0.0' });
    
    logger.info(`Server running on port ${PORT}`);
  } catch (err) {
    logger.error(err);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down...');
  process.exit(0);
});

start();
