import type { Server } from 'node:http';
import { createApp } from './app';
import { env } from './config';
import { logger } from './logs/logger';

export function startApiServer(): Server {
  const app = createApp();

  return app.listen(env.PORT, () => {
    logger.info({ port: env.PORT }, 'cranl runtime api started');
  });
}

export async function stopApiServer(server: Server): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });
}
