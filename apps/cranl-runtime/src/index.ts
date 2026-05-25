import { logger } from './logs/logger';
import { closeQueues } from './queues';
import { startApiServer, stopApiServer } from './server';
import { closeRedisConnection } from './utils/redis';

const server = startApiServer();

async function shutdown(signal: string): Promise<void> {
  logger.info({ signal }, 'stopping cranl runtime api');
  await stopApiServer(server);
  await closeQueues();
  await closeRedisConnection();
  process.exit(0);
}

process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));
