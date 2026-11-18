import 'reflect-metadata';
import { ConsoleLogger, Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ExpressAdapter } from '@nestjs/platform-express';
import type { NestExpressApplication } from '@nestjs/platform-express';
import express from 'express';
import { AppModule } from './app.module.js';
import { logAuthAttempt } from './auth/logging/auth-attempt.middleware.js';
import { CONFIG } from './config/config.js';
import type { Config } from './config/config.js';
import { DatabaseService } from './database/database.service.js';
import { ApiExceptionFilter } from './http/api-exception.filter.js';
import { apiRequestPolicy } from './http/api-request.middleware.js';

async function bootstrap(): Promise<void> {
  const server = express();
  const app = await NestFactory.create<NestExpressApplication>(AppModule, new ExpressAdapter(server), {
    bodyParser: false,
    abortOnError: false,
    logger: new ConsoleLogger({ json: true }),
  });

  try {
    const config = app.get<Config>(CONFIG);
    app.set('trust proxy', config.proxyAddress ?? false);
    app.disable('x-powered-by');
    app.disable('etag');
    app.setGlobalPrefix('api');
    app.useGlobalFilters(new ApiExceptionFilter());
    server.post('/api/auth/sign-in', logAuthAttempt('sign-in'));
    server.post('/api/auth/sign-up', logAuthAttempt('sign-up'));
    app.use('/api', apiRequestPolicy(config));

    app.enableShutdownHooks();
    await app.listen(config.port, config.host);
  } catch (error) {
    // Nest's close waits for successful initialization, so close Mongo explicitly on startup failures.
    await app.get(DatabaseService).onApplicationShutdown();
    throw error;
  }
}

void bootstrap().catch((error: unknown) => {
  new Logger('Startup').error(error instanceof Error ? error.message : 'API startup failed.');
  process.exitCode = 1;
});
