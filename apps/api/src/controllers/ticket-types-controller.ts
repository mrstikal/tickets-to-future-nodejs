import type { IncomingMessage, ServerResponse } from 'node:http';
import { readJsonBody } from '../lib/read-json-body';
import { sendJson } from '../lib/send-json';
import {
  listTicketTypes,
  getTicketType,
  createTicketType,
  updateTicketType,
  deleteTicketType, forceDeleteTicketType, checkTicketTypeHasEvents,
} from '../services/ticket-types-service';

export async function listTicketTypesHandler(
  request: IncomingMessage,
  response: ServerResponse
): Promise<void> {
  try {
    const url = new URL(request.url || '/', 'http://localhost');
    const pageParam = url.searchParams.get('page');
    const limitParam = url.searchParams.get('limit');

    const page = pageParam ? parseInt(pageParam, 10) : 1;
    const limit = limitParam ? parseInt(limitParam, 10) : 20;

    const result = await listTicketTypes(page, limit);
    sendJson(response, 200, result);
  } catch {
    sendJson(response, 500, { error: { message: 'Failed to list ticket types' } });
  }
}

export async function checkTicketTypeHasEventsHandler(
  request: IncomingMessage,
  response: ServerResponse,
  id: string
): Promise<void> {
  try {
    const hasEvents = await checkTicketTypeHasEvents(id);
    sendJson(response, 200, { hasEvents });
  } catch (error) {
    sendJson(response, 500, { error: { message: (error as Error).message || 'Failed to check ticket type events' } });
  }
}

export async function getTicketTypeHandler(
  request: IncomingMessage,
  response: ServerResponse,
  id: string
): Promise<void> {
  try {
    const ticketType = await getTicketType(id);
    if (!ticketType) {
      sendJson(response, 404, { error: { message: 'Ticket type not found' } });
      return;
    }
    sendJson(response, 200, ticketType);
  } catch {
    sendJson(response, 500, { error: { message: 'Failed to get ticket type' } });
  }
}

export async function createTicketTypeHandler(
  request: IncomingMessage,
  response: ServerResponse
): Promise<void> {
  try {
    const body = await readJsonBody<{
      title: string;
      description: string;
      isActive: boolean;
      imageAssetId: string;
      totalQuantity: number;
      soldQuantity: number;
    }>(request);

    const created = await createTicketType(body);
    sendJson(response, 201, created);
  } catch (error) {
    sendJson(response, 400, { error: { message: (error as Error).message || 'Failed to create ticket type' } });
  }
}

export async function updateTicketTypeHandler(
  request: IncomingMessage,
  response: ServerResponse,
  id: string
): Promise<void> {
  try {
    const body = await readJsonBody<{
      title?: string;
      description?: string;
      isActive?: boolean;
      imageAssetId?: string;
      totalQuantity?: number;
      soldQuantity?: number;
    }>(request);

    const updated = await updateTicketType(id, body);
    if (!updated) {
      sendJson(response, 404, { error: { message: 'Ticket type not found' } });
      return;
    }
    sendJson(response, 200, updated);
  } catch (error) {
    sendJson(response, 400, { error: { message: (error as Error).message || 'Failed to update ticket type' } });
  }
}

export async function deleteTicketTypeHandler(
  request: IncomingMessage,
  response: ServerResponse,
  id: string
): Promise<void> {
  try {
    const deleted = await deleteTicketType(id);
    if (!deleted) {
      sendJson(response, 404, { error: { message: 'Ticket type not found or cannot be deleted' } });
      return;
    }
    sendJson(response, 204, null);
  } catch (error) {
    sendJson(response, 400, { error: { message: (error as Error).message || 'Failed to delete ticket type' } });
  }
}

export async function forceDeleteTicketTypeHandler(
  request: IncomingMessage,
  response: ServerResponse,
  id: string
): Promise<void> {
  try {
    const deleted = await forceDeleteTicketType(id);
    if (!deleted) {
      sendJson(response, 404, { error: { message: 'Ticket type not found or cannot be force deleted' } });
      return;
    }
    sendJson(response, 204, null);
  } catch (error) {
    sendJson(response, 400, { error: { message: (error as Error).message || 'Failed to force delete ticket type' } });
  }
}
