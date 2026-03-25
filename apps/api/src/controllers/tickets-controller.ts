import type { IncomingMessage, ServerResponse } from 'node:http';
import { URLSearchParams } from 'node:url';
import { sendJson } from '../lib/send-json';
import {
  listTickets,
  getTicketDetail,
  getEventsGroups,
  getEventsByDateRange,
} from '../services/tickets-service';

export async function listTicketsHandler(
  request: IncomingMessage,
  response: ServerResponse
): Promise<void> {
  const items = await listTickets();

  sendJson(response, 200, {
    items,
    meta: {
      total: items.length,
    },
  });
}

export async function getTicketDetailHandler(
  request: IncomingMessage,
  response: ServerResponse,
  ticketId: string
): Promise<void> {
  const ticket = await getTicketDetail(ticketId);

  if (!ticket) {
    sendJson(response, 404, {
      error: {
        code: 'TICKET_NOT_FOUND',
        message: 'Ticket was not found.',
      },
    });
    return;
  }

  sendJson(response, 200, ticket);
}

export async function getEventsGroupsHandler(
  request: IncomingMessage,
  response: ServerResponse
): Promise<void> {
  const groupsResponse = await getEventsGroups();

  sendJson(response, 200, groupsResponse);
}

export async function getEventsByPeriodHandler(
  request: IncomingMessage,
  response: ServerResponse
): Promise<void> {
  const url = new URL(request.url || '', `http://${request.headers.host}`);
  const params = new URLSearchParams(url.search);

  const startYearStr = params.get('startYear');
  const endYearStr = params.get('endYear');
  const pageStr = params.get('page') || '1';
  const limitStr = params.get('limit') || '20';

  if (!startYearStr || !endYearStr) {
    sendJson(response, 400, {
      error: {
        code: 'MISSING_PARAMS',
        message: 'startYear and endYear are required.',
      },
    });
    return;
  }

  const startYear = parseInt(startYearStr, 10);
  const endYear = parseInt(endYearStr, 10);
  const page = parseInt(pageStr, 10);
  const limit = parseInt(limitStr, 10);

  if (isNaN(startYear) || isNaN(endYear) || isNaN(page) || isNaN(limit) || page < 1 || limit < 1) {
    sendJson(response, 400, {
      error: {
        code: 'INVALID_PARAMS',
        message: 'Invalid parameters: startYear, endYear, page, and limit must be positive integers.',
      },
    });
    return;
  }

  const paginatedResponse = await getEventsByDateRange(startYear, endYear, page, limit);

  sendJson(response, 200, paginatedResponse);
}
