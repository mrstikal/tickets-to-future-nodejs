import path from 'node:path';
import dotenv from 'dotenv';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

function validateEnv() {
  const required = [
    'JWT_SECRET',
    'JWT_REFRESH_SECRET',
  ] as const;

  for (const key of required) {
    if (!process.env[key]) {
      throw new Error(`Missing required environment variable: ${key}`);
    }
  }
}

export const env = {
  port: Number(process.env.PORT || 3000),
  postgresUrl: process.env.POSTGRES_URL || '',
  redisUrl: process.env.REDIS_URL || '',
  rabbitmqUrl: process.env.RABBITMQ_URL || '',
  holdTtlSeconds: Number(process.env.HOLD_TTL_SECONDS || 30 * 60),
  jwtSecret: process.env.JWT_SECRET!,
  jwtRefreshSecret: process.env.JWT_REFRESH_SECRET!,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '15m',
  jwtRefreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',

  // Postgres Pool
  postgresPoolMax: Number(process.env.POSTGRES_POOL_MAX || 10),
  postgresPoolIdleTimeoutMillis: Number(process.env.POSTGRES_POOL_IDLE_TIMEOUT_MS || 30000),
  postgresPoolConnectionTimeoutMillis: Number(process.env.POSTGRES_POOL_CONNECTION_TIMEOUT_MS || 2000),
};

export { validateEnv };
