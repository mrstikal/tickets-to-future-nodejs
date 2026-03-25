import type { IncomingMessage, ServerResponse } from 'node:http';
import { logger } from './logger';

export function attachRequestLogging(
  request: IncomingMessage,
  response: ServerResponse
): void {
  const startedAt = Date.now();
  const method = request.method || 'UNKNOWN';
  const url = request.url || '/';

  response.on('finish', () => {
    const durationMs = Date.now() - startedAt;

    logger.info('HTTP request completed', {
      method,
      url,
      statusCode: response.statusCode,
      durationMs,
    });
  });
}