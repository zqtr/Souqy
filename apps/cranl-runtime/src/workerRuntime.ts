import type { Worker } from 'bullmq';
import { logger } from './logs/logger';
import { createImageWorker } from './workers/image-worker';
import { createLlmWorker } from './workers/llm-worker';
import { listWorkerDefinitions } from './workers/registry';

export function startWorkers(): Worker[] {
  const workers: Worker[] = [createImageWorker(), createLlmWorker()];

  logger.info(
    {
      workers: listWorkerDefinitions().map((worker) => worker.id),
    },
    'cranl workers started',
  );

  return workers;
}

export async function stopWorkers(workers: Worker[]): Promise<void> {
  await Promise.all(workers.map((worker) => worker.close()));
}
