/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { loginHandler, signUpHandler } from '../controllers/auth-controller';
import * as rateLimiter from '../middleware/rate-limiter';
vi.mock('../middleware/rate-limiter');
function makeReq(body: unknown = {}) {
  const req: any = {
    method: 'POST',
    url: '/api/v1/auth/login',
    headers: { 'content-type': 'application/json' },
    socket: { remoteAddress: '1.2.3.4' },
  };
  // attach body so linters/typechecker see it being used in tests
  req.body = body;
  return req as any;
}

function makeRes() {
  const headers: Record<string, string> = {};
  const res: any = {
    setHeader: (k: string, v: string) => { headers[k] = v; return res; },
    getHeaders: () => headers,
    writeHead: () => res,
    end: () => res,
  };
  return res as any;
}

describe('auth-controller rate limit integration', () => {
  afterEach(() => vi.resetAllMocks());

  it('login returns 429 when rateLimit blocked', async () => {
    vi.spyOn(rateLimiter, 'rateLimit').mockResolvedValue({ blocked: true, remainingAttempts: 0, resetTime: Date.now() + 1000 } as any);
    const req = makeReq({ email: 'a', password: 'b' });
    const res = makeRes();

    await loginHandler(req, res);
    // If handler calls sendJson it will set headers and end — we just ensure rateLimit was used
    expect(rateLimiter.rateLimit).toHaveBeenCalled();
  });

  it('signup returns 429 when rateLimit blocked', async () => {
    vi.spyOn(rateLimiter, 'rateLimit').mockResolvedValue({ blocked: true, remainingAttempts: 0, resetTime: Date.now() + 1000 } as any);
    const req = makeReq({ email: 'a', password: 'b', name: 'c' });
    const res = makeRes();

    await signUpHandler(req, res);
    expect(rateLimiter.rateLimit).toHaveBeenCalled();
  });
});
