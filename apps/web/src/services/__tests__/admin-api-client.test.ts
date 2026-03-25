import { describe, it, expect, vi } from 'vitest';
import * as adminApiClient from '../admin-api-client';

function createFetchResponse(payload: unknown): Response {
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('admin-api-client', () => {
  it('getAdminStatsOverview builds correct URL with filters', async () => {
    const filters = {
      startDate: new Date('2026-01-01'),
      endDate: new Date('2026-01-31'),
      ticketTypeId: 'type1',
      ticketEventId: 'event1',
    };
    const spy = vi.spyOn(global, 'fetch').mockImplementation(async () => createFetchResponse({}));

    await adminApiClient.getAdminStatsOverview(filters);

    expect(spy).toHaveBeenCalledWith(
      expect.stringContaining(
        '/api/v1/admin/stats/overview?startDate=2026-01-01&endDate=2026-01-31&ticketTypeId=type1&ticketEventId=event1'
      ),
      expect.objectContaining({
        cache: 'no-store',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      })
    );

    spy.mockRestore();
  });

  it('getAdminTopSelling includes limit and filters', async () => {
    const filters = { startDate: new Date('2026-01-01'), endDate: new Date('2026-01-31'), ticketTypeId: 'type1' };
    const spy = vi.spyOn(global, 'fetch').mockImplementation(async () => createFetchResponse({}));

    await adminApiClient.getAdminTopSelling(filters, 5);

    expect(spy).toHaveBeenCalledWith(
      expect.stringContaining('/api/v1/admin/stats/top-selling?startDate=2026-01-01&endDate=2026-01-31&ticketTypeId=type1&limit=5'),
      expect.objectContaining({
        cache: 'no-store',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      })
    );

    spy.mockRestore();
  });

  it('getAdminLeastSelling includes limit and filters', async () => {
    const filters = { startDate: new Date('2026-01-01'), endDate: new Date('2026-01-31'), ticketTypeId: 'type1' };
    const spy = vi.spyOn(global, 'fetch').mockImplementation(async () => createFetchResponse({}));

    await adminApiClient.getAdminLeastSelling(filters, 5);

    expect(spy).toHaveBeenCalledWith(
      expect.stringContaining('/api/v1/admin/stats/least-selling?startDate=2026-01-01&endDate=2026-01-31&ticketTypeId=type1&limit=5'),
      expect.objectContaining({
        cache: 'no-store',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      })
    );

    spy.mockRestore();
  });

  it('getAdminTicketTypes calls correct endpoint', async () => {
    const spy = vi.spyOn(global, 'fetch').mockImplementation(async () => createFetchResponse({}));

    await adminApiClient.getAdminTicketTypes();

    expect(spy).toHaveBeenCalledWith(
      'http://localhost:3000/api/v1/admin/filters/ticket-types',
      expect.objectContaining({
        cache: 'no-store',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      })
    );

    spy.mockRestore();
  });

  it('getAdminTicketEvents calls correct endpoint with and without ticketTypeId', async () => {
    const spy = vi.spyOn(global, 'fetch').mockImplementation(async () => createFetchResponse({}));

    await adminApiClient.getAdminTicketEvents('type1');
    expect(spy).toHaveBeenCalledWith(
      'http://localhost:3000/api/v1/admin/filters/ticket-events?ticketTypeId=type1',
      expect.objectContaining({
        cache: 'no-store',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      })
    );

    await adminApiClient.getAdminTicketEvents();
    expect(spy).toHaveBeenCalledWith(
      'http://localhost:3000/api/v1/admin/filters/ticket-events',
      expect.objectContaining({
        cache: 'no-store',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      })
    );

    spy.mockRestore();
  });

  it('getTicketTypesList calls correct endpoint with query params', async () => {
    const spy = vi.spyOn(global, 'fetch').mockImplementation(async () => createFetchResponse({}));

    await adminApiClient.getTicketTypesList(2, 10);

    expect(spy).toHaveBeenCalledWith(
      'http://localhost:3000/api/v1/admin/ticket-types?page=2&limit=10',
      expect.objectContaining({
        cache: 'no-store',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      })
    );

    spy.mockRestore();
  });

  it('createTicketType sends POST request with correct data', async () => {
    const spy = vi.spyOn(global, 'fetch').mockImplementation(async () => createFetchResponse({ id: 'new-id' }));

    const data = {
      title: 'New Ticket',
      description: 'Description',
      isActive: true,
      imageAssetId: 'uuid',
      totalQuantity: 100,
      soldQuantity: 0,
    };

    await adminApiClient.createTicketType(data);

    expect(spy).toHaveBeenCalledWith(
      'http://localhost:3000/api/v1/admin/ticket-types',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify(data),
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        cache: 'no-store',
      })
    );

    spy.mockRestore();
  });

  it('updateTicketType sends PUT request with correct data', async () => {
    const spy = vi.spyOn(global, 'fetch').mockImplementation(async () => createFetchResponse({ id: 'updated-id' }));

    const data = {
      title: 'Updated Ticket',
      description: 'Updated description',
      isActive: false,
      imageAssetId: 'uuid',
      totalQuantity: 50,
      soldQuantity: 10,
    };

    await adminApiClient.updateTicketType('id123', data);

    expect(spy).toHaveBeenCalledWith(
      'http://localhost:3000/api/v1/admin/ticket-types/id123',
      expect.objectContaining({
        method: 'PUT',
        body: JSON.stringify(data),
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        cache: 'no-store',
      })
    );

    spy.mockRestore();
  });

  it('deleteTicketType sends DELETE request', async () => {
    const spy = vi.spyOn(global, 'fetch').mockImplementation(async () => createFetchResponse(null));

    await adminApiClient.deleteTicketType('id123');

    expect(spy).toHaveBeenCalledWith(
      'http://localhost:3000/api/v1/admin/ticket-types/id123',
      expect.objectContaining({
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        cache: 'no-store',
      })
    );

    spy.mockRestore();
  });

  it('forceDeleteTicketType sends DELETE request to force endpoint', async () => {
    const spy = vi.spyOn(global, 'fetch').mockImplementation(async () => createFetchResponse(null));

    await adminApiClient.forceDeleteTicketType('id123');

    expect(spy).toHaveBeenCalledWith(
      'http://localhost:3000/api/v1/admin/ticket-types/id123/force',
      expect.objectContaining({
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        cache: 'no-store',
      })
    );

    spy.mockRestore();
  });

  it('uploadImageAsset sends POST request with FormData', async () => {
    const spy = vi.spyOn(global, 'fetch').mockImplementation(async () =>
      new Response(JSON.stringify({ id: 'img123', imageUrl: 'http://example.com/img.jpg', localImagePath: '/local/path' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    const file = new File(['content'], 'image.png', { type: 'image/png' });
    const result = await adminApiClient.uploadImageAsset(file);

    expect(spy).toHaveBeenCalledWith(
      expect.stringContaining('/api/v1/admin/image-assets/upload'),
      expect.objectContaining({
        method: 'POST',
        body: expect.any(FormData),
        credentials: 'include',
      })
    );

    expect(result).toEqual({
      id: 'img123',
      imageUrl: 'http://example.com/img.jpg',
      localImagePath: '/local/path',
    });

    spy.mockRestore();
  });

  it('checkTicketTypeHasEvents calls correct endpoint', async () => {
    const spy = vi.spyOn(global, 'fetch').mockImplementation(async () => createFetchResponse({ hasEvents: true }));

    const result = await adminApiClient.checkTicketTypeHasEvents('id123');

    expect(spy).toHaveBeenCalledWith(
      'http://localhost:3000/api/v1/admin/ticket-types/id123/has-events',
      expect.objectContaining({
        cache: 'no-store',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      })
    );

    expect(result).toEqual({ hasEvents: true });

    spy.mockRestore();
  });

  it('getTicketEventsList – without ticketTypeId', async () => {
    const spy = vi.spyOn(global, 'fetch').mockImplementation(async () => createFetchResponse({}));

    await adminApiClient.getTicketEventsList(1, 20);

    expect(spy).toHaveBeenCalledWith(
      'http://localhost:3000/api/v1/admin/ticket-events?page=1&limit=20',
      expect.objectContaining({
        cache: 'no-store',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      })
    );

    spy.mockRestore();
  });

  it('getTicketEventsList – with ticketTypeId', async () => {
    const spy = vi.spyOn(global, 'fetch').mockImplementation(async () => createFetchResponse({}));

    await adminApiClient.getTicketEventsList(2, 10, 'type1');

    expect(spy).toHaveBeenCalledWith(
      'http://localhost:3000/api/v1/admin/ticket-events?page=2&limit=10&ticketTypeId=type1',
      expect.objectContaining({
        cache: 'no-store',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      })
    );

    spy.mockRestore();
  });

  it('createTicketEvent sends POST request with correct data', async () => {
    const spy = vi.spyOn(global, 'fetch').mockImplementation(async () => createFetchResponse({ id: 'new-event-id' }));

    const data = {
      ticketTypeId: 'type1',
      slug: 'vip-concert',
      title: 'VIP Concert',
      description: 'Exclusive concert',
      eventAt: '2026-12-31T20:00:00.000Z',
      price: 5000,
      currency: 'CZK',
      totalQuantity: 100,
      soldQuantity: 10,
      isActive: true,
      imageAssetId: 'img-uuid',
    };

    await adminApiClient.createTicketEvent(data);

    expect(spy).toHaveBeenCalledWith(
      'http://localhost:3000/api/v1/admin/ticket-events',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify(data),
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        cache: 'no-store',
      })
    );

    spy.mockRestore();
  });

  it('updateTicketEvent sends PUT request with correct data', async () => {
    const spy = vi.spyOn(global, 'fetch').mockImplementation(async () => createFetchResponse({ id: 'updated-event-id' }));

    const data = {
      title: 'Updated Concert',
      price: 6000,
      isActive: false,
    };

    await adminApiClient.updateTicketEvent('event123', data);

    expect(spy).toHaveBeenCalledWith(
      'http://localhost:3000/api/v1/admin/ticket-events/event123',
      expect.objectContaining({
        method: 'PUT',
        body: JSON.stringify(data),
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        cache: 'no-store',
      })
    );

    spy.mockRestore();
  });

  it('deleteTicketEvent sends DELETE request', async () => {
    const spy = vi.spyOn(global, 'fetch').mockImplementation(async () => createFetchResponse(null));

    await adminApiClient.deleteTicketEvent('event123');

    expect(spy).toHaveBeenCalledWith(
      'http://localhost:3000/api/v1/admin/ticket-events/event123',
      expect.objectContaining({
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        cache: 'no-store',
      })
    );

    spy.mockRestore();
  });

  it('forceDeleteTicketEvent sends DELETE request to force endpoint', async () => {
    const spy = vi.spyOn(global, 'fetch').mockImplementation(async () => createFetchResponse(null));

    await adminApiClient.forceDeleteTicketEvent('event123');

    expect(spy).toHaveBeenCalledWith(
      'http://localhost:3000/api/v1/admin/ticket-events/event123/force',
      expect.objectContaining({
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        cache: 'no-store',
      })
    );

    spy.mockRestore();
  });

  it('checkTicketEventHasHoldsOrOrders calls correct endpoint', async () => {
    const spy = vi.spyOn(global, 'fetch').mockImplementation(async () => createFetchResponse({ hasHoldsOrOrders: true }));

    const result = await adminApiClient.checkTicketEventHasHoldsOrOrders('event123');

    expect(spy).toHaveBeenCalledWith(
      'http://localhost:3000/api/v1/admin/ticket-events/event123/has-holds-or-orders',
      expect.objectContaining({
        cache: 'no-store',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      })
    );

    expect(result).toEqual({ hasHoldsOrOrders: true });

    spy.mockRestore();
  });

  it('getOrdersList – without filters', async () => {
    const spy = vi.spyOn(global, 'fetch').mockImplementation(async () => createFetchResponse({}));

    await adminApiClient.getOrdersList(1, 20);

    expect(spy).toHaveBeenCalledWith(
      'http://localhost:3000/api/v1/admin/orders?page=1&limit=20',
      expect.objectContaining({
        cache: 'no-store',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      })
    );

    spy.mockRestore();
  });

  it('getOrdersList – with filters', async () => {
    const spy = vi.spyOn(global, 'fetch').mockImplementation(async () => createFetchResponse({}));

    await adminApiClient.getOrdersList(2, 10, {
      status: 'confirmed',
      startDate: '2026-01-01',
      endDate: '2026-01-31',
      email: 'test@example.com',
    });

    expect(spy).toHaveBeenCalledWith(
      'http://localhost:3000/api/v1/admin/orders?page=2&limit=10&status=confirmed&startDate=2026-01-01&endDate=2026-01-31&email=test%40example.com',
      expect.objectContaining({
        cache: 'no-store',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      })
    );

    spy.mockRestore();
  });

  it('getOrderDetail calls correct endpoint', async () => {
    const spy = vi.spyOn(global, 'fetch').mockImplementation(async () => createFetchResponse({}));

    await adminApiClient.getOrderDetail('order123');

    expect(spy).toHaveBeenCalledWith(
      'http://localhost:3000/api/v1/admin/orders/order123',
      expect.objectContaining({
        cache: 'no-store',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      })
    );

    spy.mockRestore();
  });

  it('cancelOrder sends POST request', async () => {
    const spy = vi.spyOn(global, 'fetch').mockImplementation(async () => createFetchResponse({ id: 'order123', status: 'cancelled' }));

    await adminApiClient.cancelOrder('order123');

    expect(spy).toHaveBeenCalledWith(
      'http://localhost:3000/api/v1/admin/orders/order123/cancel',
      expect.objectContaining({
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        cache: 'no-store',
      })
    );

    spy.mockRestore();
  });

  it('updateOrderTotalPrice sends PATCH request with totalPrice', async () => {
    const spy = vi.spyOn(global, 'fetch').mockImplementation(async () => createFetchResponse({ id: 'order123', totalPrice: 6000 }));

    await adminApiClient.updateOrderTotalPrice('order123', 6000);

    expect(spy).toHaveBeenCalledWith(
      'http://localhost:3000/api/v1/admin/orders/order123/total-price',
      expect.objectContaining({
        method: 'PATCH',
        body: JSON.stringify({ totalPrice: 6000 }),
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        cache: 'no-store',
      })
    );

    spy.mockRestore();
  });
});
