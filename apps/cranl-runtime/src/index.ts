import { env } from './config';
import { createApp } from './app';
import { logger } from './logs/logger';
import { closeQueues } from './queues';
import { closeRedisConnection } from './utils/redis';

const app = createApp();

const server = app.listen(env.PORT, () => {
  logger.info({ port: env.PORT }, 'cranl runtime api started');
});

async function shutdown(signal: string): Promise<void> {
  logger.info({ signal }, 'stopping cranl runtime api');
  server.close(async () => {
    await closeQueues();
    await closeRedisConnection();
    process.exit(0);
  });
}

process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));
