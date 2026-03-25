import type { IncomingMessage, ServerResponse } from 'node:http';
import { sendJson } from '../lib/send-json';
import { readJsonBody } from '../lib/read-json-body';
import { createOrder, getOrderById } from '../services/orders-service';
import { verifyToken } from '../services/auth-service';
import { parseCookies } from '../lib/cookies';

type CreateOrderRequestBody = {
  holdIds?: string[];
  sessionId?: string;
  email?: string;
  name?: string;
  referenceNumber?: string;
};

export async function createOrderHandler(
  request: IncomingMessage,
  response: ServerResponse
): Promise<void> {
  try {
    const body = await readJsonBody<CreateOrderRequestBody>(request);
    const { holdIds, sessionId, email, name, referenceNumber } = body;

    if (!holdIds || !holdIds.length || !sessionId || !email || !name) {
      sendJson(response, 400, {
        error: {
          code: 'VALIDATION_ERROR',
          message: 'holdIds, sessionId, email and name are required.',
        },
      });
      return;
    }

    // Check for authentication cookie
    let userId: string | undefined;
    const cookieHeader = request.headers.cookie;
    if (cookieHeader) {
      const cookies = parseCookies(cookieHeader);
      const token = cookies['auth_token'];
      if (token) {
        const authResult = await verifyToken(token);
        if ('data' in authResult) {
          userId = authResult.data.id;
        }
      }
    }

    const result = await createOrder({ holdIds, sessionId, email, name, referenceNumber, userId });

    if ('error' in result) {
      sendJson(response, result.error.statusCode, {
        error: {
          code: result.error.code,
          message: result.error.message,
        },
      });
      return;
    }

    sendJson(response, 201, result.data);
  } catch (error) {
    sendJson(response, 400, {
      error: {
        code: 'INVALID_REQUEST',
        message:
          error instanceof Error ? error.message : 'Invalid request payload.',
      },
    });
  }
}

export async function getOrderHandler(
  request: IncomingMessage,
  response: ServerResponse,
  orderId: string
): Promise<void> {
  const result = await getOrderById(orderId);

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