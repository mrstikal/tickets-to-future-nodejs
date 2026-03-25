import type { IncomingMessage, ServerResponse } from 'node:http';
import { verifyToken } from '../services/auth-service';
import { sendJson } from '../lib/send-json';
import type { User } from '../types/domain';

/**
 * Middleware that requires admin authentication.
 * Reads auth_token cookie, verifies JWT, checks if user role is 'admin'.
 * If authentication fails, sends appropriate error response and returns null.
 * If successful, returns the authenticated admin user.
 */
export async function requireAdmin(
  request: IncomingMessage,
  response: ServerResponse
): Promise<User | null> {
  const cookieHeader = request.headers.cookie;

  if (!cookieHeader) {
    sendJson(response, 401, {
      error: {
        code: 'MISSING_TOKEN',
        message: 'Authentication cookie is required.',
      },
    });
    return null;
  }

  // Parse cookies
  const cookies = Object.fromEntries(
    cookieHeader.split(';').map(cookie => {
      const [name, ...rest] = cookie.trim().split('=');
      return [name, rest.join('=')];
    })
  );

  const token = cookies['auth_token'];

  if (!token) {
    sendJson(response, 401, {
      error: {
        code: 'MISSING_TOKEN',
        message: 'Authentication token cookie is missing.',
      },
    });
    return null;
  }

  const result = await verifyToken(token);

  if ('error' in result) {
    sendJson(response, result.error.statusCode, {
      error: {
        code: result.error.code,
        message: result.error.message,
      },
    });
    return null;
  }

  const user = result.data;

  // Check if user is admin
  if (user.role !== 'admin') {
    sendJson(response, 403, {
      error: {
        code: 'FORBIDDEN',
        message: 'Admin privileges required.',
      },
    });
    return null;
  }

  return user;
}