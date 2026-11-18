import { Catch, HttpException, Logger } from '@nestjs/common';
import type { ArgumentsHost, ExceptionFilter } from '@nestjs/common';
import type { Response } from 'express';
import { RateLimitExceeded, sendError } from './api-errors.js';

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(ApiExceptionFilter.name);

  catch(error: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();
    if (error instanceof RateLimitExceeded) {
      response.setHeader('Retry-After', String(error.retryAfterSeconds));
    }
    if (error instanceof HttpException) {
      const body = error.getResponse();
      if (typeof body === 'string') return sendError(response, error.getStatus(), body);
      response.status(error.getStatus()).json(body);
      return;
    }
    this.logger.error('An unhandled API error occurred.');
    sendError(response, 500, 'Internal server error.');
  }
}
