import { Router } from 'express';

export const rootRouter = Router();

rootRouter.get('/', (_req, res) => {
  res.json({
    service: 'cranl-runtime',
    ok: true,
    endpoints: ['/health', '/workers', '/queues'],
  });
});
