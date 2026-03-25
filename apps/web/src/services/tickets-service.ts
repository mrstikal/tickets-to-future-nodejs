import { apiDelete, apiGet, apiPost } from '@/services/api-client';
import type {
  Hold,
  Order,
  Ticket,
  TicketsListResponse,
  EventsGroupsResponse,
  EventsPaginatedResponse,
} from '@/types/tickets';

export async function getTickets(): Promise<Ticket[]> {
  const response = await apiGet<TicketsListResponse>('/api/v1/tickets');
  return response.items;
}

export async function getTicketById(ticketId: string): Promise<Ticket> {
  return apiGet<Ticket>(`/api/v1/tickets/${ticketId}`);
}

export async function createHold(params: {
  ticketId: string;
  sessionId: string;
}): Promise<Hold> {
  return apiPost<Hold, { ticketId: string; sessionId: string }>(
    '/api/v1/holds',
    params
  );
}

export async function cancelHold(holdId: string): Promise<Hold> {
  return apiDelete<Hold>(`/api/v1/holds/${holdId}`);
}

export async function getHoldById(holdId: string): Promise<Hold> {
  return apiGet<Hold>(`/api/v1/holds/${holdId}`);
}

export async function createOrder(params: {
  holdIds: string[];
  sessionId: string;
  email: string;
  name: string;
  referenceNumber?: string;
}): Promise<Order> {
  return apiPost<Order, typeof params>(
    '/api/v1/orders',
    params
  );
}

export async function getOrderById(orderId: string): Promise<Order> {
  return apiGet<Order>(`/api/v1/orders/${orderId}`);
}

export async function getEventsGroups(): Promise<EventsGroupsResponse> {
  return apiGet<EventsGroupsResponse>('/api/v1/events/groups');
}

export async function getEventsByPeriod(
  startYear: number,
  endYear: number,
  page: number = 1,
  limit: number = 20
): Promise<EventsPaginatedResponse> {
  const params = new URLSearchParams({
    startYear: startYear.toString(),
    endYear: endYear.toString(),
    page: page.toString(),
    limit: limit.toString(),
  });
  return apiGet<EventsPaginatedResponse>(`/api/v1/events?${params.toString()}`);
}

export async function getHolds(sessionId: string): Promise<Hold[]> {
  const response = await apiGet<{ items: Hold[] }>('/api/v1/holds/session/' + encodeURIComponent(sessionId));
  return response.items;
}
