import { Queue, type JobsOptions } from 'bullmq';
import { getRedisConnection } from '../utils/redis';
import { queueNames, type QueueName } from './names';

const defaultJobOptions: JobsOptions = {
  attempts: 3,
  backoff: {
    type: 'exponential',
    delay: 5_000,
  },
  removeOnComplete: {
    age: 60 * 60 * 24,
    count: 1_000,
  },
  removeOnFail: {
    age: 60 * 60 * 24 * 7,
    count: 5_000,
  },
};

const queues = new Map<QueueName, Queue>();

export function getQueue(name: QueueName): Queue {
  const existing = queues.get(name);
  if (existing) return existing;

  const queue = new Queue(name, {
    connection: getRedisConnection(),
    defaultJobOptions,
  });
  queues.set(name, queue);
  return queue;
}

export function getAllQueues(): Queue[] {
  return queueNames.map((name) => getQueue(name));
}

export async function getQueueSummaries() {
  const summaries = await Promise.all(
    getAllQueues().map(async (queue) => {
      const counts = await queue.getJobCounts(
        'waiting',
        'active',
        'completed',
        'failed',
        'delayed',
        'paused',
      );

      return {
        name: queue.name,
        counts,
      };
    }),
  );

  return summaries;
}

export async function closeQueues(): Promise<void> {
  await Promise.all([...queues.values()].map((queue) => queue.close()));
  queues.clear();
}
