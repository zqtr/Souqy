import IORedis from 'ioredis';
import { env } from '../config';
import { logger } from '../logs/logger';

let connection: IORedis | null = null;

export function getRedisConnection(): IORedis {
  if (!connection) {
    connection = new IORedis(env.REDIS_URL, {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
      enableOfflineQueue: false,
      connectTimeout: 5_000,
    });

    connection.on('error', (error) => {
      logger.error({ error }, 'redis connection error');
    });
  }

  return connection;
}

export async function closeRedisConnection(): Promise<void> {
  if (!connection) return;
  await connection.quit();
  connection = null;
}

export async function redisHealth(): Promise<{ ok: boolean; latencyMs?: number; error?: string }> {
  const startedAt = Date.now();
  try {
    await getRedisConnection().ping();
    return { ok: true, latencyMs: Date.now() - startedAt };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Redis ping failed',
    };
  }
}
