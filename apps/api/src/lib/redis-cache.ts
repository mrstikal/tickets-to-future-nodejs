import { getDependenciesRuntime } from './dependencies-runtime';
import { logger } from './logger';

export async function getCache<T>(key: string): Promise<T | null> {
  const runtime = getDependenciesRuntime();
  const redis = runtime.redis;
  if (!redis) {
    logger.warn('Redis not available, skipping cache get', { key });
    return null;
  }
  try {
    const value = await redis.client.get(key);
    if (!value) return null;
    return JSON.parse(value) as T;
  } catch (error) {
    logger.error('Failed to get cache key', { key, error });
    return null;
  }
}

export async function setCache<T>(
  key: string,
  value: T,
  ttlSeconds?: number
): Promise<void> {
  const runtime = getDependenciesRuntime();
  const redis = runtime.redis;
  if (!redis) {
    logger.warn('Redis not available, skipping cache set', { key });
    return;
  }
  try {
    const serialized = JSON.stringify(value);
    if (ttlSeconds) {
      await redis.client.setEx(key, ttlSeconds, serialized);
    } else {
      await redis.client.set(key, serialized);
    }
  } catch (error) {
    logger.error('Failed to set cache key', { key, error });
  }
}

export async function delCache(key: string): Promise<void> {
  const runtime = getDependenciesRuntime();
  const redis = runtime.redis;
  if (!redis) {
    logger.warn('Redis not available, skipping cache delete', { key });
    return;
  }
  try {
    await redis.client.del(key);
  } catch (error) {
    logger.error('Failed to delete cache key', { key, error });
  }
}

export async function delCachePattern(pattern: string): Promise<void> {
  const runtime = getDependenciesRuntime();
  const redis = runtime.redis;
  if (!redis) {
    logger.warn('Redis not available, skipping cache pattern delete', { pattern });
    return;
  }

  try {
    let cursor = 0;
    do {
      const scanResult = await redis.client.scan(cursor, { MATCH: pattern, COUNT: 100 });
      cursor = scanResult.cursor;
      const keys = scanResult.keys;
      if (keys.length > 0) {
        await redis.client.del(keys);
      }
    } while (cursor !== 0);
  } catch (error) {
    logger.error('Failed to delete cache pattern', { pattern, error });
  }
}
