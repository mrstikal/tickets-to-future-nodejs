import type { IncomingMessage, ServerResponse } from 'node:http';
import { sendJson } from '../lib/send-json';
import { readJsonBody } from '../lib/read-json-body';
import {
  createHold,
  getHoldById,
  cancelHold,
  getHoldsBySessionId,
} from '../services/holds-service';

type CreateHoldRequestBody = {
  ticketId?: string;
  sessionId?: string;
};

export async function createHoldHandler(
  request: IncomingMessage,
  response: ServerResponse
): Promise<void> {
  try {
    const body = await readJsonBody<CreateHoldRequestBody>(request);
    const { ticketId, sessionId } = body;

    if (!ticketId || !sessionId) {
      sendJson(response, 400, {
        error: {
          code: 'VALIDATION_ERROR',
          message: 'ticketId and sessionId are required.',
        },
      });
      return;
    }

    const result = await createHold({ ticketId, sessionId });

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

export async function getHoldHandler(
  request: IncomingMessage,
  response: ServerResponse,
  holdId: string
): Promise<void> {
  const result = await getHoldById(holdId);

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

export async function cancelHoldHandler(
  request: IncomingMessage,
  response: ServerResponse,
  holdId: string
): Promise<void> {
  const result = await cancelHold(holdId);

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

export async function getHoldsBySessionHandler(
  request: IncomingMessage,
  response: ServerResponse,
  sessionId: string
): Promise<void> {
  const result = await getHoldsBySessionId(sessionId);

  if ('error' in result) {
    sendJson(response, result.error.statusCode, {
      error: {
        code: result.error.code,
        message: result.error.message,
      },
    });
    return;
  }

  sendJson(response, 200, { items: result.data });
}
