import type { ServerResponse } from 'node:http';

export function sendJson(
  response: ServerResponse,
  statusCode: number,
  payload: unknown
): void {
  // Preserve existing headers and add Content-Type
  const existingHeaders = response.getHeaders();
  const headers = {
    ...existingHeaders,
    'Content-Type': 'application/json; charset=utf-8',
  };

  response.writeHead(statusCode, headers);

  response.end(JSON.stringify(payload));
}
