import { Router } from 'express';
import { env } from '../config';
import { redisHealth } from '../utils/redis';

export const healthRouter = Router();

healthRouter.get('/health', async (_req, res) => {
  const redis = await redisHealth();
  res.status(redis.ok ? 200 : 503).json({
    ok: redis.ok,
    service: 'cranl-runtime',
    environment: env.NODE_ENV,
    uptimeSeconds: Math.round(process.uptime()),
    redis,
  });
});
