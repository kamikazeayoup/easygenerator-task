import { Logger } from '@nestjs/common';
import type { RequestHandler } from 'express';

const logger = new Logger('AuthAttempt');

function outcomeFor(statusCode: number): string {
  if (statusCode === 204) return 'accepted';
  if (statusCode === 429) return 'rate_limited';
  if (statusCode >= 500) return 'error';
  return 'rejected';
}

export function logAuthAttempt(action: 'sign-in' | 'sign-up'): RequestHandler {
  return (_request, response, next) => {
    response.once('finish', () => {
      const { statusCode } = response;
      logger.log({ event: 'auth_attempt', action, outcome: outcomeFor(statusCode), statusCode });
    });
    next();
  };
}
