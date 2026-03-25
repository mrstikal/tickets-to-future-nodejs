/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { rateLimit } from '../middleware/rate-limiter';
import * as dependenciesRuntime from '../lib/dependencies-runtime';

vi.mock('../lib/dependencies-runtime');

describe('rate-limiter', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('allows requests when redis not available', async () => {
    vi.mocked(dependenciesRuntime.getDependenciesRuntime).mockReturnValue({ postgres: null, redis: null, rabbitmq: null } as any);
    const fakeReq: any = { socket: { remoteAddress: '1.2.3.4' } };
    const res = await rateLimit(fakeReq, 'test', 5, 1000);
    expect(res.blocked).toBe(false);
  });

  it('increments attempts and sets TTL', async () => {
    const client = {
      get: vi.fn().mockResolvedValue('1'),
      setEx: vi.fn().mockResolvedValue('OK'),
      ttl: vi.fn().mockResolvedValue(10),
    } as any;
    vi.mocked(dependenciesRuntime.getDependenciesRuntime).mockReturnValue({ postgres: null, redis: { client }, rabbitmq: null } as any);

    const fakeReq: any = { socket: { remoteAddress: '1.2.3.4' } };
    const res = await rateLimit(fakeReq, 'test-key', 5, 2000);
    expect(res.blocked).toBe(false);
    expect(client.setEx).toHaveBeenCalled();
  });

  it('blocks when attempts exceed limit and ttl positive', async () => {
    const client = {
      get: vi.fn().mockResolvedValue('10'),
      setEx: vi.fn().mockResolvedValue('OK'),
      ttl: vi.fn().mockResolvedValue(30),
    } as any;
    vi.mocked(dependenciesRuntime.getDependenciesRuntime).mockReturnValue({ postgres: null, redis: { client }, rabbitmq: null } as any);

    const fakeReq: any = { socket: { remoteAddress: '5.6.7.8' } };
    const res = await rateLimit(fakeReq, 'test-key', 5, 2000);
    expect(res.blocked).toBe(true);
    expect(res.remainingAttempts).toBe(0);
    expect(res.resetTime).toBeGreaterThan(Date.now());
  });

  it('allows when redis throws error', async () => {
    const client = {
      get: vi.fn().mockRejectedValue(new Error('boom')),
    } as any;
    vi.mocked(dependenciesRuntime.getDependenciesRuntime).mockReturnValue({ postgres: null, redis: { client }, rabbitmq: null } as any);

    const fakeReq: any = { socket: { remoteAddress: '9.9.9.9' } };
    const res = await rateLimit(fakeReq, 'test-key', 5, 2000);
    expect(res.blocked).toBe(false);
  });
});
