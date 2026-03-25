import type { IncomingMessage, ServerResponse } from 'node:http';
import { readJsonBody } from '../lib/read-json-body';
import { sendJson } from '../lib/send-json';
import { login, refreshToken, verifyToken, signUp } from '../services/auth-service';
import { rateLimit } from '../middleware/rate-limiter';
import { parseCookies, setAuthCookies, clearAuthCookies } from '../lib/cookies';
import type { LoginInput } from '../types/domain';

export async function loginHandler(
  request: IncomingMessage,
  response: ServerResponse
): Promise<void> {
  const rateLimitResult = await rateLimit(request, 'auth-login', 5, 15 * 60 * 1000);

  if (rateLimitResult.blocked) {
    sendJson(response, 429, {
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'Too many login attempts. Please try again later.',
      },
    });
    return;
  }

  try {
    const body = await readJsonBody<LoginInput>(request);

    if (!body.email || !body.password) {
      sendJson(response, 400, {
        error: {
          code: 'MISSING_CREDENTIALS',
          message: 'Email and password are required.',
        },
      });
      return;
    }

    const result = await login(body);

    if ('error' in result) {
      sendJson(response, result.error.statusCode, {
        error: {
          code: result.error.code,
          message: result.error.message,
        },
      });
      return;
    }

    // Set HttpOnly cookie with access token
    const accessToken = result.data.accessToken;
    const refreshToken = result.data.refreshToken;

    setAuthCookies(response, accessToken, refreshToken);

    // Send user data without tokens in response body
    sendJson(response, 200, { user: result.data.user });
  } catch {
    sendJson(response, 400, {
      error: {
        code: 'INVALID_REQUEST',
        message: 'Invalid request body.',
      },
    });
  }
}

export async function refreshTokenHandler(
  request: IncomingMessage,
  response: ServerResponse
): Promise<void> {
  try {
    const body = await readJsonBody<{ refreshToken: string }>(request);

    if (!body.refreshToken) {
      sendJson(response, 400, {
        error: {
          code: 'MISSING_TOKEN',
          message: 'Refresh token is required.',
        },
      });
      return;
    }

    const result = await refreshToken(body.refreshToken);

    if ('error' in result) {
      sendJson(response, result.error.statusCode, {
        error: {
          code: result.error.code,
          message: result.error.message,
        },
      });
      return;
    }

    sendJson(response, 200, result.data);
  } catch {
    sendJson(response, 400, {
      error: {
        code: 'INVALID_REQUEST',
        message: 'Invalid request body.',
      },
    });
  }
}

export async function meHandler(
  request: IncomingMessage,
  response: ServerResponse
): Promise<void> {
  const cookieHeader = request.headers.cookie;

  if (!cookieHeader) {
    sendJson(response, 401, {
      error: {
        code: 'MISSING_TOKEN',
        message: 'Authentication cookie is required.',
      },
    });
    return;
  }

  // Parse cookies
  const cookies = parseCookies(cookieHeader);

  const token = cookies['auth_token'];

  if (!token) {
    sendJson(response, 401, {
      error: {
        code: 'MISSING_TOKEN',
        message: 'Authentication token cookie is missing.',
      },
    });
    return;
  }

  const result = await verifyToken(token);

  if ('error' in result) {
    sendJson(response, result.error.statusCode, {
      error: {
        code: result.error.code,
        message: result.error.message,
      },
    });
    return;
  }

  sendJson(response, 200, result.data);
}

export async function signUpHandler(
  request: IncomingMessage,
  response: ServerResponse
): Promise<void> {
  const rateLimitResult = await rateLimit(request, 'auth-signup', 5, 15 * 60 * 1000);

  if (rateLimitResult.blocked) {
    sendJson(response, 429, {
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'Too many signup attempts. Please try again later.',
      },
    });
    return;
  }

  try {
    const body = await readJsonBody<{ email: string; password: string; name: string }>(request);

    if (!body.email || !body.password || !body.name) {
      sendJson(response, 400, {
        error: {
          code: 'MISSING_FIELDS',
          message: 'Email, password, and name are required.',
        },
      });
      return;
    }

    const result = await signUp(body);

    if ('error' in result) {
      sendJson(response, result.error.statusCode, {
        error: {
          code: result.error.code,
          message: result.error.message,
        },
      });
      return;
    }

    // Set HttpOnly cookie with access token
    const accessToken = result.data.accessToken;
    const refreshToken = result.data.refreshToken;

    setAuthCookies(response, accessToken, refreshToken);

    // Send user data without tokens in response body
    sendJson(response, 200, { user: result.data.user });
  } catch {
    sendJson(response, 400, {
      error: {
        code: 'INVALID_REQUEST',
        message: 'Invalid request body.',
      },
    });
  }
}

export async function logoutHandler(
  request: IncomingMessage,
  response: ServerResponse
): Promise<void> {
  // Clear auth cookies by setting them with Max-Age=0
  clearAuthCookies(response);

  sendJson(response, 200, { message: 'Logged out successfully' });
}
