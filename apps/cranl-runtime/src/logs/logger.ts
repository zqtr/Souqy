import pino from 'pino';
import { env } from '../config';

export const logger = pino({
  level: env.LOG_LEVEL,
  base: {
    service: 'cranl-runtime',
    environment: env.NODE_ENV,
  },
  timestamp: pino.stdTimeFunctions.isoTime,
});
