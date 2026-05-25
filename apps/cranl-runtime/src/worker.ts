import type { Worker } from 'bullmq';
import { logger } from './logs/logger';
import { closeQueues } from './queues';
import { closeRedisConnection } from './utils/redis';
import { createImageWorker } from './workers/image-worker';
import { createLlmWorker } from './workers/llm-worker';
import { listWorkerDefinitions } from './workers/registry';

const workers: Worker[] = [createImageWorker(), createLlmWorker()];

logger.info(
  {
    workers: listWorkerDefinitions().map((worker) => worker.id),
  },
  'cranl workers started',
);

async function shutdown(signal: string): Promise<void> {
  logger.info({ signal }, 'stopping cranl workers');
  await Promise.all(workers.map((worker) => worker.close()));
  await closeQueues();
  await closeRedisConnection();
  process.exit(0);
}

process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));
