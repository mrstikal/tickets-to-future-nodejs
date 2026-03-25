import type { IncomingMessage, ServerResponse } from 'node:http';
import { sendJson } from '../lib/send-json';
import { getDependenciesRuntime } from '../lib/dependencies-runtime';

export function getHealth(
  request: IncomingMessage,
  response: ServerResponse
): void {
  sendJson(response, 200, {
    status: 'ok',
    timestamp: new Date().toISOString(),
  });
}

export async function getDependenciesHealth(
  request: IncomingMessage,
  response: ServerResponse
): Promise<void> {
  const runtime = getDependenciesRuntime();

  const postgresStatus = runtime.postgres
    ? await runtime.postgres.checkHealth()
    : 'not_configured';

  const redisStatus = runtime.redis
    ? await runtime.redis.checkHealth()
    : 'not_configured';

  const rabbitmqStatus = runtime.rabbitmq
    ? await runtime.rabbitmq.checkHealth()
    : 'not_configured';

  const allStatuses = [postgresStatus, redisStatus, rabbitmqStatus];
  const overallStatus = allStatuses.every((status) => status === 'ok')
    ? 'ok'
    : 'degraded';

  sendJson(response, 200, {
    status: overallStatus,
    dependencies: {
      postgres: postgresStatus,
      redis: redisStatus,
      rabbitmq: rabbitmqStatus,
    },
    timestamp: new Date().toISOString(),
  });
}