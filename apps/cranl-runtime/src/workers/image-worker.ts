import { Worker, type Job } from 'bullmq';
import { env } from '../config';
import { ImageGenerationJobSchema, type ImageGenerationJob } from '../jobs/types';
import { logger } from '../logs/logger';
import { runImagePipeline } from '../pipelines/imagePipeline';
import { QueueName } from '../queues/names';
import { getRedisConnection } from '../utils/redis';

export function createImageWorker(): Worker<ImageGenerationJob> {
  const worker = new Worker<ImageGenerationJob>(
    QueueName.ImageGeneration,
    async (job: Job<ImageGenerationJob>) => {
      logger.info(
        {
          jobId: job.id,
          queue: job.queueName,
          attempt: job.attemptsMade + 1,
          maxAttempts: job.opts.attempts ?? 1,
        },
        'image generation job received',
      );

      await job.updateProgress({ status: 'validating', percent: 10 });
      const data = ImageGenerationJobSchema.parse(job.data);

      await job.updateProgress({ status: 'generating', percent: 50 });
      const output = await runImagePipeline(data);

      await job.updateProgress({ status: 'completed', percent: 100, outputId: output.id });
      logger.info({ jobId: job.id, outputId: output.id }, 'image generation job completed');
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
        queue: QueueName.ImageGeneration,
        attemptsMade: job?.attemptsMade,
        attempts: job?.opts.attempts,
        error,
      },
      'image generation job failed',
    );
  });

  worker.on('error', (error) => {
    logger.error({ error, queue: QueueName.ImageGeneration }, 'image worker error');
  });

  return worker;
}
