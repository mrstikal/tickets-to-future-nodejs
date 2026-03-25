import { apiGet, apiPost, apiPut, apiDelete } from './api-client';
import type {
  TicketType,
  PaginatedTicketTypesResponse,
  TicketEvent,
  PaginatedTicketEventsResponse,
  AdminOrderDetail,
  PaginatedOrdersResponse,
  OrderFilters
} from '@/types/admin';
import { config } from '@/lib/config';

export async function getTicketTypesList(
  page: number = 1,
  limit: number = 20
): Promise<PaginatedTicketTypesResponse> {
  const params = new URLSearchParams();
  params.append('page', page.toString());
  params.append('limit', limit.toString());

  const queryString = params.toString();
  const url = `/api/v1/admin/ticket-types${queryString ? `?${queryString}` : ''}`;

  return apiGet<PaginatedTicketTypesResponse>(url);
}

export async function createTicketType(data: {
  title: string;
  description: string;
  isActive: boolean;
  imageAssetId: string;
  totalQuantity: number;
  soldQuantity: number;
}): Promise<TicketType> {
  return apiPost<TicketType, typeof data>('/api/v1/admin/ticket-types', data);
}

export async function updateTicketType(
  id: string,
  data: {
    title?: string;
    description?: string;
    isActive?: boolean;
    imageAssetId?: string;
    totalQuantity?: number;
    soldQuantity?: number;
  }
): Promise<TicketType> {
  return apiPut<TicketType, typeof data>(`/api/v1/admin/ticket-types/${id}`, data);
}

export async function uploadImageAsset(file: File): Promise<{ id: string; imageUrl: string; localImagePath: string }> {
  const formData = new FormData();
  formData.append('file', file);

  const response = await fetch(`${config.apiBaseUrl}/api/v1/admin/image-assets/upload`, {
    method: 'POST',
    body: formData,
    credentials: 'include',
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error?.message || 'Failed to upload image asset');
  }

  return response.json();
}

export async function deleteTicketType(id: string): Promise<void> {
  await apiDelete<void>(`/api/v1/admin/ticket-types/${id}`);
}

export async function forceDeleteTicketType(id: string): Promise<void> {
  await apiDelete<void>(`/api/v1/admin/ticket-types/${id}/force`);
}

import type { DashboardFilters, AdminStatsOverview, AdminTopSellingResponse, AdminLeastSellingResponse, AdminTicketTypesResponse, AdminTicketEventsResponse } from '@/types/admin';

function toQueryString(filters: DashboardFilters): string {
  const params = new URLSearchParams();
  if (filters.startDate) {
    params.append('startDate', filters.startDate.toISOString().split('T')[0]);
  }
  if (filters.endDate) {
    params.append('endDate', filters.endDate.toISOString().split('T')[0]);
  }
  if (filters.ticketTypeId) {
    params.append('ticketTypeId', filters.ticketTypeId);
  }
  if (filters.ticketEventId) {
    params.append('ticketEventId', filters.ticketEventId);
  }
  return params.toString();
}

export async function getAdminStatsOverview(filters: DashboardFilters): Promise<AdminStatsOverview> {
  const queryString = toQueryString(filters);
  const url = `/api/v1/admin/stats/overview${queryString ? `?${queryString}` : ''}`;
  return apiGet<AdminStatsOverview>(url);
}

export async function getAdminTopSelling(filters: DashboardFilters, limit: number = 10): Promise<AdminTopSellingResponse> {
  const queryString = toQueryString(filters);
  const url = `/api/v1/admin/stats/top-selling${queryString ? `?${queryString}&limit=${limit}` : `?limit=${limit}`}`;
  return apiGet<AdminTopSellingResponse>(url);
}

export async function getAdminLeastSelling(filters: DashboardFilters, limit: number = 10): Promise<AdminLeastSellingResponse> {
  const queryString = toQueryString(filters);
  const url = `/api/v1/admin/stats/least-selling${queryString ? `?${queryString}&limit=${limit}` : `?limit=${limit}`}`;
  return apiGet<AdminLeastSellingResponse>(url);
}

export async function getAdminTicketTypes(): Promise<AdminTicketTypesResponse> {
  const url = '/api/v1/admin/filters/ticket-types';
  return apiGet<AdminTicketTypesResponse>(url);
}

export async function getAdminTicketEvents(ticketTypeId?: string): Promise<AdminTicketEventsResponse> {
  const url = ticketTypeId ? `/api/v1/admin/filters/ticket-events?ticketTypeId=${ticketTypeId}` : '/api/v1/admin/filters/ticket-events';
  return apiGet<AdminTicketEventsResponse>(url);
}

export async function checkTicketTypeHasEvents(id: string): Promise<{ hasEvents: boolean }> {
  const url = `/api/v1/admin/ticket-types/${id}/has-events`;
  return apiGet<{ hasEvents: boolean }>(url);
}

export async function getTicketEventsList(
  page: number = 1,
  limit: number = 20,
  ticketTypeId?: string
): Promise<PaginatedTicketEventsResponse> {
  const params = new URLSearchParams();
  params.append('page', page.toString());
  params.append('limit', limit.toString());
  if (ticketTypeId) {
    params.append('ticketTypeId', ticketTypeId);
  }

  const queryString = params.toString();
  const url = `/api/v1/admin/ticket-events${queryString ? `?${queryString}` : ''}`;

  return apiGet<PaginatedTicketEventsResponse>(url);
}

export async function createTicketEvent(data: {
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
  imageAssetId: string | null;
}): Promise<TicketEvent> {
  return apiPost<TicketEvent, typeof data>('/api/v1/admin/ticket-events', data);
}

export async function updateTicketEvent(
  id: string,
  data: {
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
    imageAssetId?: string | null;
  }
): Promise<TicketEvent> {
  return apiPut<TicketEvent, typeof data>(`/api/v1/admin/ticket-events/${id}`, data);
}

export async function deleteTicketEvent(id: string): Promise<void> {
  await apiDelete<void>(`/api/v1/admin/ticket-events/${id}`);
}

export async function forceDeleteTicketEvent(id: string): Promise<void> {
  await apiDelete<void>(`/api/v1/admin/ticket-events/${id}/force`);
}

export async function checkTicketEventHasHoldsOrOrders(id: string): Promise<{ hasHoldsOrOrders: boolean }> {
  const url = `/api/v1/admin/ticket-events/${id}/has-holds-or-orders`;
  return apiGet<{ hasHoldsOrOrders: boolean }>(url);
}

export async function getOrdersList(
  page: number = 1,
  limit: number = 20,
  filters?: OrderFilters
): Promise<PaginatedOrdersResponse> {
  const params = new URLSearchParams();
  params.append('page', page.toString());
  params.append('limit', limit.toString());
  if (filters?.status) {
    params.append('status', filters.status);
  }
  if (filters?.startDate) {
    params.append('startDate', filters.startDate);
  }
  if (filters?.endDate) {
    params.append('endDate', filters.endDate);
  }
  if (filters?.email) {
    params.append('email', filters.email);
  }

  const queryString = params.toString();
  const url = `/api/v1/admin/orders${queryString ? `?${queryString}` : ''}`;

  return apiGet<PaginatedOrdersResponse>(url);
}

export async function getOrderDetail(id: string): Promise<AdminOrderDetail> {
  const url = `/api/v1/admin/orders/${id}`;
  return apiGet<AdminOrderDetail>(url);
}

export async function cancelOrder(id: string): Promise<AdminOrderDetail> {
  const url = `/api/v1/admin/orders/${id}/cancel`;
  return apiPost<AdminOrderDetail, undefined>(url, undefined);
}

export async function updateOrderTotalPrice(id: string, totalPrice: number): Promise<AdminOrderDetail> {
  const url = `/api/v1/admin/orders/${id}/total-price`;
  // Since apiPatch doesn't exist, we'll use fetch directly
  const response = await fetch(`${config.apiBaseUrl}${url}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    cache: 'no-store',
    credentials: 'include',
    body: JSON.stringify({ totalPrice }),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error?.message || 'Failed to update order total price');
  }

  return response.json() as Promise<AdminOrderDetail>;
}
