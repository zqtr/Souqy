import { Router } from 'express';
import { getQueueSummaries } from '../queues';

export const queuesRouter = Router();

queuesRouter.get('/queues', async (_req, res, next) => {
  try {
    const queues = await getQueueSummaries();
    res.json({ queues });
  } catch (error) {
    next(error);
  }
});
