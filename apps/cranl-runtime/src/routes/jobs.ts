import { Router } from 'express';
import { z } from 'zod';
import { AiChatJobSchema, ImageGenerationJobSchema } from '../jobs/types';
import { getQueue } from '../queues';
import { QueueName, queueNames, type QueueName as QueueNameValue } from '../queues/names';
import { requireCranlAuth } from './auth';

const JobLookupSchema = z.object({
  queue: z.string().refine((value): value is QueueNameValue =>
    queueNames.includes(value as QueueNameValue),
  ),
  jobId: z.string().min(1),
});

export const jobsRouter = Router();

jobsRouter.use('/jobs', requireCranlAuth);

jobsRouter.post('/jobs/image-generation', async (req, res, next) => {
  try {
    const data = ImageGenerationJobSchema.parse(withDefaultProvider(req.body));
    const job = await getQueue(QueueName.ImageGeneration).add(QueueName.ImageGeneration, data);
    res.status(202).json({
      status: 'queued',
      queue: QueueName.ImageGeneration,
      jobId: job.id,
      attempts: job.opts.attempts,
    });
  } catch (error) {
    next(error);
  }
});

jobsRouter.post('/jobs/ai-chat', async (req, res, next) => {
  try {
    const data = AiChatJobSchema.parse(withDefaultProvider(req.body));
    const job = await getQueue(QueueName.AiChat).add(QueueName.AiChat, data);
    res.status(202).json({
      status: 'queued',
      queue: QueueName.AiChat,
      jobId: job.id,
      attempts: job.opts.attempts,
    });
  } catch (error) {
    next(error);
  }
});

jobsRouter.get('/jobs/:queue/:jobId', async (req, res, next) => {
  try {
    const params = JobLookupSchema.parse(req.params);
    const job = await getQueue(params.queue).getJob(params.jobId);
    if (!job) {
      res.status(404).json({
        error: 'job_not_found',
      });
      return;
    }

    const state = await job.getState();
    const data = job.data as { metadata?: unknown };
    res.json({
      queue: params.queue,
      jobId: job.id,
      name: job.name,
      state,
      metadata: data.metadata,
      progress: job.progress,
      attemptsMade: job.attemptsMade,
      attempts: job.opts.attempts,
      failedReason: job.failedReason,
      returnvalue: job.returnvalue,
      timestamp: job.timestamp,
      processedOn: job.processedOn,
      finishedOn: job.finishedOn,
    });
  } catch (error) {
    next(error);
  }
});

function withDefaultProvider(input: unknown): Record<string, unknown> {
  const body = input && typeof input === 'object' && !Array.isArray(input) ? input : {};
  const payload = body as Record<string, unknown>;
  if (payload.provider) return payload;
  return {
    ...payload,
    provider: 'openai',
  };
}
