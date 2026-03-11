import { buildApp } from './app.js';
import { logger } from './utils/logger.js';
import { initDb, closeDb } from './db/connection.js';

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

async function start() {
  try {
    // Initialize Oracle database connection
    console.log('Starting initDb...');
    await initDb();
    console.log('initDb completed - about to log');
    logger.info('Database connected');
    console.log('Database connected logged');
    console.log('About to build app...');

    const app = await buildApp();
    console.log('App built, about to listen...');
    
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
  await closeDb();
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down...');
  await closeDb();
  process.exit(0);
});

start();
