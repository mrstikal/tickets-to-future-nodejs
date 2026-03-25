import { logger } from '../lib/logger';
import { createPostgresClient } from '../db/postgres-client';
import { createRedisRuntime } from '../cache/redis-client';
import { createRabbitmqRuntime } from '../queue/rabbitmq-client';
import type { DependenciesRuntime } from '../types/runtime';

async function tryConnect<T extends { connect: () => Promise<void> } | null>(
  runtime: T,
  label: string
): Promise<T> {
  if (!runtime) {
    return runtime;
  }

  try {
    await runtime.connect();
    logger.info(`${label} connected`);
    return runtime;
  } catch (error) {
    logger.error(`Failed to connect ${label}`, error);
    return runtime;
  }
}

export async function initializeDependencies(): Promise<DependenciesRuntime> {
  const postgres = await tryConnect(createPostgresClient(), 'Postgres');
  const redis = await tryConnect(createRedisRuntime(), 'Redis');
  const rabbitmq = await tryConnect(createRabbitmqRuntime(), 'RabbitMQ');

  if (rabbitmq) {
    try {
      await rabbitmq.startConsumers();
      logger.info('RabbitMQ consumers started');
    } catch (error) {
      logger.error('Failed to start RabbitMQ consumers', error);
    }
  }

  return {
    postgres,
    redis,
    rabbitmq,
  };
}

export async function closeDependencies(
  runtime: DependenciesRuntime
): Promise<void> {
  const closers = [runtime.rabbitmq, runtime.redis, runtime.postgres]
    .filter(Boolean)
    .map(async (dependency) => {
      try {
        await dependency!.close();
      } catch (error) {
        logger.error(`Failed to close ${dependency!.name}`, error);
      }
    });

  await Promise.all(closers);
}