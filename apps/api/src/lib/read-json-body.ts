import type { IncomingMessage } from 'node:http';

export function readJsonBody<T = Record<string, unknown>>(
  request: IncomingMessage
): Promise<T> {
  return new Promise((resolve, reject) => {
    let rawBody = '';

    request.on('data', (chunk: Buffer) => {
      rawBody += chunk.toString();

      if (rawBody.length > 1024 * 1024) {
        reject(new Error('Request body is too large.'));
        request.destroy();
      }
    });

    request.on('end', () => {
      if (!rawBody) {
        resolve({} as T);
        return;
      }

      try {
        const parsed = JSON.parse(rawBody) as T;
        resolve(parsed);
      } catch {
        reject(new Error('Invalid JSON payload.'));
      }
    });

    request.on('error', (error) => {
      reject(error);
    });
  });
}

