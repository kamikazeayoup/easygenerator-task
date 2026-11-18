import { HttpException } from '@nestjs/common';
import type { Response } from 'express';

export class RateLimitExceeded extends HttpException {
  readonly retryAfterSeconds: number;

  constructor(retryAfterMs: number) {
    super('Too many requests.', 429);
    this.retryAfterSeconds = Math.ceil(retryAfterMs / 1000);
  }
}

export function sendError(response: Response, statusCode: number, message: string): void {
  response.status(statusCode).json({ statusCode, message });
}
