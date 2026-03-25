import { getDependenciesRuntime } from '../lib/dependencies-runtime';
import { logger } from '../lib/logger';
import type { IncomingMessage } from 'node:http';

interface RateLimitResult {
  blocked: boolean;
  remainingAttempts: number;
  resetTime: number;
}

export async function rateLimit(
  request: IncomingMessage,
  key: string,
  maxAttempts: number,
  windowMs: number
): Promise<RateLimitResult> {
  const runtime = getDependenciesRuntime();

  if (!runtime.redis) {
    // If Redis is not available, allow all requests
    return {
      blocked: false,
      remainingAttempts: maxAttempts,
      resetTime: Date.now() + windowMs,
    };
  }

  // Get client IP (fallback to a default if not available)
  const clientIP = request.socket?.remoteAddress || 'unknown';

  // Create unique key for this client and action
  const redisKey = `ratelimit:${key}:${clientIP}`;

  try {
    // Get current attempts count
    const currentAttempts = await runtime.redis.client.get(redisKey);
    const attempts = currentAttempts ? parseInt(currentAttempts, 10) : 0;

    if (attempts >= maxAttempts) {
      // Check if window has expired
      const ttl = await runtime.redis.client.ttl(redisKey);
      if (ttl > 0) {
        return {
          blocked: true,
          remainingAttempts: 0,
          resetTime: Date.now() + (ttl * 1000),
        };
      }
    }

    // Increment attempts
    const newAttempts = attempts + 1;
    await runtime.redis.client.setEx(redisKey, Math.floor(windowMs / 1000), newAttempts.toString());

    return {
      blocked: false,
      remainingAttempts: Math.max(0, maxAttempts - newAttempts),
      resetTime: Date.now() + windowMs,
    };
  } catch (error) {
    // If Redis fails, allow the request
    logger.error('Rate limiting failed:', error);
    return {
      blocked: false,
      remainingAttempts: maxAttempts,
      resetTime: Date.now() + windowMs,
    };
  }
}
