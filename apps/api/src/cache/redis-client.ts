import { createClient } from 'redis';
import { env } from '../config/env';
import { logger } from '../lib/logger';
import type { RedisRuntime } from '../types/runtime';

export function createRedisRuntime(): RedisRuntime | null {
  if (!env.redisUrl) {
    logger.info('Redis URL is not configured');
    return null;
  }

  const client = createClient({
    url: env.redisUrl,
  });

  client.on('error', (error) => {
    logger.error('Redis client error', error);
  });

  return {
    name: 'redis',
    client,
    async connect() {
      if (!client.isOpen) {
        await client.connect();
      }
    },
    async checkHealth() {
      try {
        if (!client.isOpen) {
          return 'disconnected';
        }

        await client.ping();
        return 'ok';
      } catch {
        return 'error';
      }
    },
    async close() {
      if (client.isOpen) {
        await client.quit();
      }
    },
  };
}