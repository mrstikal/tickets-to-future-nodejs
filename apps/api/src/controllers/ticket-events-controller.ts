import type { IncomingMessage, ServerResponse } from 'node:http';
import { readJsonBody } from '../lib/read-json-body';
import { sendJson } from '../lib/send-json';
import {
  listTicketEvents,
  getTicketEvent,
  createTicketEvent,
  updateTicketEvent,
  deleteTicketEvent,
  forceDeleteTicketEvent,
  checkTicketEventHasHoldsOrOrders,
} from '../services/ticket-events-service';

export async function listTicketEventsHandler(
  request: IncomingMessage,
  response: ServerResponse
): Promise<void> {
  try {
    const url = new URL(request.url || '/', 'http://localhost');
    const pageParam = url.searchParams.get('page');
    const limitParam = url.searchParams.get('limit');
    const ticketTypeIdParam = url.searchParams.get('ticketTypeId');

    const page = pageParam ? parseInt(pageParam, 10) : 1;
    const limit = limitParam ? parseInt(limitParam, 10) : 20;
    const ticketTypeId = ticketTypeIdParam || undefined;

    const result = await listTicketEvents(page, limit, ticketTypeId);
    sendJson(response, 200, result);
  } catch {
    sendJson(response, 500, { error: { message: 'Failed to list ticket events' } });
  }
}

export async function checkTicketEventHasHoldsOrOrdersHandler(
  request: IncomingMessage,
  response: ServerResponse,
  id: string
): Promise<void> {
  try {
    const hasHoldsOrOrders = await checkTicketEventHasHoldsOrOrders(id);
    sendJson(response, 200, { hasHoldsOrOrders });
  } catch (error) {
    sendJson(response, 500, { error: { message: (error as Error).message || 'Failed to check ticket event holds/orders' } });
  }
}

export async function getTicketEventHandler(
  request: IncomingMessage,
  response: ServerResponse,
  id: string
): Promise<void> {
  try {
    const ticketEvent = await getTicketEvent(id);
    if (!ticketEvent) {
      sendJson(response, 404, { error: { message: 'Ticket event not found' } });
      return;
    }
    sendJson(response, 200, ticketEvent);
  } catch {
    sendJson(response, 500, { error: { message: 'Failed to get ticket event' } });
  }
}

export async function createTicketEventHandler(
  request: IncomingMessage,
  response: ServerResponse
): Promise<void> {
  try {
    const body = await readJsonBody<{
      ticketTypeId: string;
      slug: string;
      title: string;
      description: string;
      eventAt: string;
      price: number;
      currency: string;
      totalQuantity: number;
      soldQuantity: number;
      isActive: boolean;
      imageAssetId: string;
    }>(request);

    const created = await createTicketEvent(body);
    sendJson(response, 201, created);
  } catch (error) {
    sendJson(response, 400, { error: { message: (error as Error).message || 'Failed to create ticket event' } });
  }
}

export async function updateTicketEventHandler(
  request: IncomingMessage,
  response: ServerResponse,
  id: string
): Promise<void> {
  try {
    const body = await readJsonBody<{
      ticketTypeId?: string;
      slug?: string;
      title?: string;
      description?: string;
      eventAt?: string;
      price?: number;
      currency?: string;
      totalQuantity?: number;
      soldQuantity?: number;
      isActive?: boolean;
      imageAssetId?: string;
    }>(request);

    const updated = await updateTicketEvent(id, body);
    if (!updated) {
      sendJson(response, 404, { error: { message: 'Ticket event not found' } });
      return;
    }
    sendJson(response, 200, updated);
  } catch (error) {
    sendJson(response, 400, { error: { message: (error as Error).message || 'Failed to update ticket event' } });
  }
}

export async function deleteTicketEventHandler(
  request: IncomingMessage,
  response: ServerResponse,
  id: string
): Promise<void> {
  try {
    const deleted = await deleteTicketEvent(id);
    if (!deleted) {
      sendJson(response, 404, { error: { message: 'Ticket event not found or cannot be deleted' } });
      return;
    }
    sendJson(response, 204, null);
  } catch (error) {
    sendJson(response, 400, { error: { message: (error as Error).message || 'Failed to delete ticket event' } });
  }
}

export async function forceDeleteTicketEventHandler(
  request: IncomingMessage,
  response: ServerResponse,
  id: string
): Promise<void> {
  try {
    const deleted = await forceDeleteTicketEvent(id);
    if (!deleted) {
      sendJson(response, 404, { error: { message: 'Ticket event not found or cannot be force deleted' } });
      return;
    }
    sendJson(response, 204, null);
  } catch (error) {
    sendJson(response, 400, { error: { message: (error as Error).message || 'Failed to force delete ticket event' } });
  }
}