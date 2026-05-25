import { Router } from 'express';
import { listWorkerDefinitions } from '../workers/registry';

export const workersRouter = Router();

workersRouter.get('/workers', (_req, res) => {
  res.json({
    workers: listWorkerDefinitions(),
  });
});
