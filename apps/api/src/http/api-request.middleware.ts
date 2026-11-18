import { json } from 'express';
import type { RequestHandler } from 'express';
import type { Config } from '../config/config.js';
import { sendError } from './api-errors.js';

const parseJson = json({ limit: '8kb', inflate: false, strict: false });
const readMethods = new Set(['GET', 'HEAD', 'OPTIONS']);

export function apiRequestPolicy(config: Config): RequestHandler {
  return (request, response, next) => {
    response.setHeader('Cache-Control', 'no-store');
    if (readMethods.has(request.method)) return next();

    if (request.get('origin') !== config.publicOrigin || (config.secureCookies && !request.secure)) {
      return sendError(response, 403, 'Origin not allowed.');
    }

    const hasBody = Number(request.get('content-length') ?? 0) > 0 || request.get('transfer-encoding');
    if (hasBody && !request.is('application/json')) {
      return sendError(response, 415, 'Use an application/json request body.');
    }

    parseJson(request, response, (error?: { type?: string }) => {
      if (!error) return next();
      if (error.type === 'entity.too.large') return sendError(response, 413, 'Request body is too large.');
      if (error.type === 'encoding.unsupported' || error.type === 'charset.unsupported') {
        return sendError(response, 415, 'Unsupported request encoding.');
      }
      sendError(response, 400, 'Invalid JSON request body.');
    });
  };
}
