import { Pool } from 'pg';
import { env } from '../config/env';
import { logger } from '../lib/logger';
import type { PostgresRuntime } from '../types/runtime';

export function createPostgresClient(): PostgresRuntime | null {
  if (!env.postgresUrl) {
    logger.info('Postgres URL is not configured');
    return null;
  }

  const pool = new Pool({
    connectionString: env.postgresUrl,
    max: env.postgresPoolMax,
    idleTimeoutMillis: env.postgresPoolIdleTimeoutMillis,
    connectionTimeoutMillis: env.postgresPoolConnectionTimeoutMillis,
  });

  return {
    name: 'postgres',
    pool,
    async connect() {
      const client = await pool.connect();
      client.release();
    },
    async checkHealth() {
      try {
        await pool.query('select 1 as ok');
        return 'ok';
      } catch {
        return 'error';
      }
    },
    async close() {
      await pool.end();
    },
  };
}