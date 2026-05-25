import { timingSafeEqual } from 'node:crypto';
import type { RequestHandler } from 'express';
import { env } from '../config';
import { logger } from '../logs/logger';

function readToken(headerValue: string | undefined): string | null {
  if (!headerValue) return null;
  if (headerValue.startsWith('Bearer ')) return headerValue.slice('Bearer '.length).trim();
  return headerValue.trim();
}

function tokenMatches(provided: string, expected: string): boolean {
  const providedBuffer = Buffer.from(provided);
  const expectedBuffer = Buffer.from(expected);
  if (providedBuffer.length !== expectedBuffer.length) return false;
  return timingSafeEqual(providedBuffer, expectedBuffer);
}

export const requireCranlAuth: RequestHandler = (req, res, next) => {
  if (!env.CRANL_API_KEY) {
    logger.error('CRANL_API_KEY is not configured for protected CranL routes');
    res.status(503).json({
      error: 'cranl_api_key_not_configured',
    });
    return;
  }

  const token = readToken(req.header('authorization')) ?? readToken(req.header('x-cranl-api-key'));
  if (!token || !tokenMatches(token, env.CRANL_API_KEY)) {
    res.status(401).json({
      error: 'unauthorized',
    });
    return;
  }

  next();
};
