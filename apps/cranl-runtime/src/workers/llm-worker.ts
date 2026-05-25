import { Worker, type Job } from 'bullmq';
import { env } from '../config';
import { AiChatJobSchema, type AiChatJob } from '../jobs/types';
import { logger } from '../logs/logger';
import { runLlmPipeline } from '../pipelines/llmPipeline';
import { QueueName } from '../queues/names';
import { getRedisConnection } from '../utils/redis';

export function createLlmWorker(): Worker<AiChatJob> {
  const worker = new Worker<AiChatJob>(
    QueueName.AiChat,
    async (job: Job<AiChatJob>) => {
      logger.info(
        {
          jobId: job.id,
          queue: job.queueName,
          attempt: job.attemptsMade + 1,
          maxAttempts: job.opts.attempts ?? 1,
        },
        'llm job received',
      );

      await job.updateProgress({ status: 'validating', percent: 10 });
      const data = AiChatJobSchema.parse(job.data);

      await job.updateProgress({ status: 'running', percent: 50 });
      const output = await runLlmPipeline(data);

      await job.updateProgress({ status: 'completed', percent: 100, outputId: output.id });
      logger.info({ jobId: job.id, outputId: output.id }, 'llm job completed');
      return output;
    },
    {
      connection: getRedisConnection(),
      concurrency: env.WORKER_CONCURRENCY,
    },
  );

  worker.on('failed', (job, error) => {
    logger.error(
      {
        jobId: job?.id,
        queue: QueueName.AiChat,
        attemptsMade: job?.attemptsMade,
        attempts: job?.opts.attempts,
        error,
      },
      'llm job failed',
    );
  });

  worker.on('error', (error) => {
    logger.error({ error, queue: QueueName.AiChat }, 'llm worker error');
  });

  return worker;
}
