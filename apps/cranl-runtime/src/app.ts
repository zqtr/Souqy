import express, { type ErrorRequestHandler } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { logger } from './logs/logger';
import { healthRouter } from './routes/health';
import { queuesRouter } from './routes/queues';
import { workersRouter } from './routes/workers';

export function createApp() {
  const app = express();

  app.use(express.json({ limit: '2mb' }));
  app.use((req, res, next) => {
    const requestId = req.header('x-request-id') ?? uuidv4();
    res.setHeader('x-request-id', requestId);
    logger.info(
      {
        requestId,
        method: req.method,
        path: req.path,
      },
      'request received',
    );
    next();
  });

  app.use(healthRouter);
  app.use(workersRouter);
  app.use(queuesRouter);

  app.use((_req, res) => {
    res.status(404).json({
      error: 'not_found',
    });
  });

  const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
    logger.error({ error }, 'request failed');
    res.status(500).json({
      error: 'internal_server_error',
      message: error instanceof Error ? error.message : 'Unexpected error',
    });
  };

  app.use(errorHandler);
  return app;
}
