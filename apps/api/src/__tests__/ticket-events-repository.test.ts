import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createTicketEventsRepository } from '../repositories/ticket-events-repository';
import type { PostgresRuntime } from '../types/runtime';

describe('ticket-events-repository', () => {
  let mockPool: { query: ReturnType<typeof vi.fn>; connect: ReturnType<typeof vi.fn> };
  let mockClient: { query: ReturnType<typeof vi.fn>; release: ReturnType<typeof vi.fn> };
  let mockPostgresRuntime: PostgresRuntime;

  beforeEach(() => {
    mockPool = {
      query: vi.fn(),
      connect: vi.fn(),
    };
    mockClient = {
      query: vi.fn(),
      release: vi.fn(),
    };
    mockPool.connect.mockResolvedValue(mockClient);
    mockPostgresRuntime = {
      name: 'postgres',
      pool: mockPool as unknown as import('pg').Pool,
      connect: vi.fn(),
      checkHealth: vi.fn(),
      close: vi.fn(),
    } as PostgresRuntime;
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('createTicketEventsRepository', () => {
    it('returns null if postgresRuntime is null', () => {
      const repo = createTicketEventsRepository(null);
      expect(repo).toBeNull();
    });

    it('returns repository object if postgresRuntime exists', () => {
      const repo = createTicketEventsRepository(mockPostgresRuntime);
      expect(repo).toBeDefined();
      expect(repo).toHaveProperty('findAll');
      expect(repo).toHaveProperty('findById');
      expect(repo).toHaveProperty('create');
      expect(repo).toHaveProperty('update');
      expect(repo).toHaveProperty('delete');
      expect(repo).toHaveProperty('forceDelete');
      expect(repo).toHaveProperty('hasHoldsOrOrders');
    });
  });

  describe('findAll', () => {
    it('returns items and total without filter', async () => {
      const repo = createTicketEventsRepository(mockPostgresRuntime)!;
      mockPool.query
        .mockResolvedValueOnce({ rows: [{ count: '5' }] }) // count query
        .mockResolvedValueOnce({
          rows: [
            {
              id: '1',
              ticket_type_id: 'type1',
              slug: 'event1',
              title: 'Event 1',
              description: 'desc1',
              event_at: '2025-12-31T20:00:00Z',
              price: 1000,
              currency: 'CZK',
              total_quantity: 100,
              sold_quantity: 50,
              is_active: true,
              image_asset_id: 'img1',
              created_at: '2025-01-01T00:00:00Z',
              updated_at: '2025-01-01T00:00:00Z',
              local_image_path: '/path/to/image1.jpg',
            },
          ],
        });

      const result = await repo.findAll(20, 0);
      expect(mockPool.query).toHaveBeenCalledWith(
        'SELECT COUNT(*) FROM ticket_events',
        []
      );
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT'),
        ['20', '0']
      );
      expect(result.items).toHaveLength(1);
      expect(result.total).toBe(5);
      expect(result.items[0]).toEqual({
        id: '1',
        ticketTypeId: 'type1',
        slug: 'event1',
        title: 'Event 1',
        description: 'desc1',
        eventAt: '2025-12-31T20:00:00Z',
        price: 1000,
        currency: 'CZK',
        totalQuantity: 100,
        soldQuantity: 50,
        isActive: true,
        imageAssetId: 'img1',
        imageUrl: '/path/to/image1.jpg',
        createdAt: '2025-01-01T00:00:00Z',
        updatedAt: '2025-01-01T00:00:00Z',
      });
    });

    it('applies ticketTypeId filter', async () => {
      const repo = createTicketEventsRepository(mockPostgresRuntime)!;
      mockPool.query
        .mockResolvedValueOnce({ rows: [{ count: '2' }] })
        .mockResolvedValueOnce({ rows: [] });

      await repo.findAll(10, 0, 'type-abc');
      expect(mockPool.query).toHaveBeenCalledWith(
        'SELECT COUNT(*) FROM ticket_events WHERE ticket_type_id = $1',
        ['type-abc']
      );
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('WHERE te.ticket_type_id = $1'),
        ['type-abc', '10', '0']
      );
    });
  });

  describe('findById', () => {
    it('returns null if not found', async () => {
      const repo = createTicketEventsRepository(mockPostgresRuntime)!;
      mockPool.query.mockResolvedValue({ rows: [] });
      const result = await repo.findById('nonexistent');
      expect(result).toBeNull();
    });

    it('returns mapped ticket event if found', async () => {
      const repo = createTicketEventsRepository(mockPostgresRuntime)!;
      mockPool.query.mockResolvedValue({
        rows: [
          {
            id: '123',
            ticket_type_id: 'type1',
            slug: 'found-event',
            title: 'Found Event',
            description: 'desc',
            event_at: '2025-12-31T20:00:00Z',
            price: 2000,
            currency: 'CZK',
            total_quantity: 50,
            sold_quantity: 10,
            is_active: true,
            image_asset_id: 'img123',
            created_at: '2025-01-01T00:00:00Z',
            updated_at: '2025-01-01T00:00:00Z',
            local_image_path: '/path/to/found.jpg',
          },
        ],
      });
      const result = await repo.findById('123');
      expect(result).toEqual({
        id: '123',
        ticketTypeId: 'type1',
        slug: 'found-event',
        title: 'Found Event',
        description: 'desc',
        eventAt: '2025-12-31T20:00:00Z',
        price: 2000,
        currency: 'CZK',
        totalQuantity: 50,
        soldQuantity: 10,
        isActive: true,
        imageAssetId: 'img123',
        imageUrl: '/path/to/found.jpg',
        createdAt: '2025-01-01T00:00:00Z',
        updatedAt: '2025-01-01T00:00:00Z',
      });
    });
  });

  describe('create', () => {
    it('inserts data and fetches created event', async () => {
      const repo = createTicketEventsRepository(mockPostgresRuntime)!;
      const insertRow = {
        id: 'new-id',
        ticket_type_id: 'type1',
        slug: 'new-slug',
        title: 'New Event',
        description: 'desc',
        event_at: '2025-12-31T20:00:00Z',
        price: 1500,
        currency: 'CZK',
        total_quantity: 100,
        sold_quantity: 0,
        is_active: true,
        image_asset_id: 'img-new',
        created_at: '2025-01-02T00:00:00Z',
        updated_at: '2025-01-02T00:00:00Z',
      };
      mockPool.query
        .mockResolvedValueOnce({ rows: [insertRow] }) // INSERT RETURNING
        .mockResolvedValueOnce({
          rows: [
            {
              ...insertRow,
              local_image_path: '/path/to/new.jpg',
            },
          ],
        }); // findById call

      const data = {
        ticketTypeId: 'type1',
        slug: 'new-slug',
        title: 'New Event',
        description: 'desc',
        eventAt: '2025-12-31T20:00:00Z',
        price: 1500,
        currency: 'CZK',
        totalQuantity: 100,
        soldQuantity: 0,
        isActive: true,
        imageAssetId: 'img-new',
      };
      const result = await repo.create(data);
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO ticket_events'),
        [
          'type1',
          'new-slug',
          'New Event',
          'desc',
          '2025-12-31T20:00:00Z',
          1500,
          'CZK',
          100,
          0,
          true,
          'img-new',
        ]
      );
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT'),
        ['new-id']
      );
      expect(result).toEqual({
        id: 'new-id',
        ticketTypeId: 'type1',
        slug: 'new-slug',
        title: 'New Event',
        description: 'desc',
        eventAt: '2025-12-31T20:00:00Z',
        price: 1500,
        currency: 'CZK',
        totalQuantity: 100,
        soldQuantity: 0,
        isActive: true,
        imageAssetId: 'img-new',
        imageUrl: '/path/to/new.jpg',
        createdAt: '2025-01-02T00:00:00Z',
        updatedAt: '2025-01-02T00:00:00Z',
      });
    });

    it('throws if findById after create returns null', async () => {
      const repo = createTicketEventsRepository(mockPostgresRuntime)!;
      mockPool.query
        .mockResolvedValueOnce({ rows: [{ id: 'new-id' }] })
        .mockResolvedValueOnce({ rows: [] }); // findById returns empty
      const data = {
        ticketTypeId: 'type1',
        slug: 'new-slug',
        title: 'New Event',
        description: 'desc',
        eventAt: '2025-12-31T20:00:00Z',
        price: 1500,
        currency: 'CZK',
        totalQuantity: 100,
        soldQuantity: 0,
        isActive: true,
        imageAssetId: 'img-new',
      };
      await expect(repo.create(data)).rejects.toThrow('Failed to fetch created ticket event');
    });
  });

  describe('update', () => {
    it('returns null if id not found', async () => {
      const repo = createTicketEventsRepository(mockPostgresRuntime)!;
      mockPool.query.mockResolvedValue({ rows: [] });
      const result = await repo.update('nonexistent', { title: 'Updated' });
      expect(result).toBeNull();
    });

    it('updates fields and returns mapped result', async () => {
      const repo = createTicketEventsRepository(mockPostgresRuntime)!;
      mockPool.query.mockResolvedValue({
        rows: [
          {
            id: '123',
            ticket_type_id: 'type1',
            slug: 'updated-slug',
            title: 'Updated Title',
            description: 'new desc',
            event_at: '2025-12-31T20:00:00Z',
            price: 2000,
            currency: 'CZK',
            total_quantity: 100,
            sold_quantity: 20,
            is_active: false,
            image_asset_id: 'img-updated',
            created_at: '2025-01-01T00:00:00Z',
            updated_at: '2025-01-02T00:00:00Z',
            local_image_path: '/path/to/updated.jpg',
          },
        ],
      });
      const result = await repo.update('123', {
        title: 'Updated Title',
        description: 'new desc',
        isActive: false,
        price: 2000,
      });
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE ticket_events'),
        expect.arrayContaining(['Updated Title', 'new desc', false, 2000, '123'])
      );
      expect(result).toEqual({
        id: '123',
        ticketTypeId: 'type1',
        slug: 'updated-slug',
        title: 'Updated Title',
        description: 'new desc',
        eventAt: '2025-12-31T20:00:00Z',
        price: 2000,
        currency: 'CZK',
        totalQuantity: 100,
        soldQuantity: 20,
        isActive: false,
        imageAssetId: 'img-updated',
        imageUrl: '/path/to/updated.jpg',
        createdAt: '2025-01-01T00:00:00Z',
        updatedAt: '2025-01-02T00:00:00Z',
      });
    });

    it('calls findById if no fields to update', async () => {
      const repo = createTicketEventsRepository(mockPostgresRuntime)!;
      const existing = {
        id: '123',
        ticket_type_id: 'type1',
        slug: 'existing',
        title: 'Existing',
        description: 'desc',
        event_at: '2025-12-31T20:00:00Z',
        price: 1000,
        currency: 'CZK',
        total_quantity: 100,
        sold_quantity: 50,
        is_active: true,
        image_asset_id: 'img1',
        created_at: '2025-01-01T00:00:00Z',
        updated_at: '2025-01-01T00:00:00Z',
        local_image_path: '/path/to/existing.jpg',
      };
      mockPool.query.mockResolvedValue({ rows: [existing] });
      const result = await repo.update('123', {});
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT'),
        ['123']
      );
      expect(result).toEqual({
        id: '123',
        ticketTypeId: 'type1',
        slug: 'existing',
        title: 'Existing',
        description: 'desc',
        eventAt: '2025-12-31T20:00:00Z',
        price: 1000,
        currency: 'CZK',
        totalQuantity: 100,
        soldQuantity: 50,
        isActive: true,
        imageAssetId: 'img1',
        imageUrl: '/path/to/existing.jpg',
        createdAt: '2025-01-01T00:00:00Z',
        updatedAt: '2025-01-01T00:00:00Z',
      });
    });
  });

  describe('delete', () => {
    it('throws if has holds or orders', async () => {
      const repo = createTicketEventsRepository(mockPostgresRuntime)!;
      mockPool.query
        .mockResolvedValueOnce({ rows: [{ '?column?': 1 }] }) // hasHoldsOrOrders returns true
        .mockResolvedValueOnce({ rows: [] }); // orders check not reached
      await expect(repo.delete('123')).rejects.toThrow('Cannot delete ticket event with existing holds or orders');
    });

    it('deletes and returns true if rowCount > 0', async () => {
      const repo = createTicketEventsRepository(mockPostgresRuntime)!;
      mockPool.query
        .mockResolvedValueOnce({ rows: [] }) // no holds
        .mockResolvedValueOnce({ rows: [] }) // no orders
        .mockResolvedValueOnce({ rowCount: 1 });
      const result = await repo.delete('123');
      expect(mockPool.query).toHaveBeenCalledWith(
        'DELETE FROM ticket_events WHERE id = $1',
        ['123']
      );
      expect(result).toBe(true);
    });

    it('returns false if rowCount = 0', async () => {
      const repo = createTicketEventsRepository(mockPostgresRuntime)!;
      mockPool.query
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rowCount: 0 });
      const result = await repo.delete('123');
      expect(result).toBe(false);
    });
  });

  describe('forceDelete', () => {
    it('performs transaction and returns true if successful', async () => {
      const repo = createTicketEventsRepository(mockPostgresRuntime)!;
      mockClient.query
        .mockResolvedValueOnce(undefined) // BEGIN
        .mockResolvedValueOnce({ rowCount: 2 }) // delete holds
        .mockResolvedValueOnce({ rowCount: 3 }) // delete order items
        .mockResolvedValueOnce({ rowCount: 1 }) // delete ticket event
        .mockResolvedValueOnce(undefined); // COMMIT

      const result = await repo.forceDelete('123');
      expect(mockPool.connect).toHaveBeenCalled();
      expect(mockClient.query).toHaveBeenCalledWith('BEGIN');
      expect(mockClient.query).toHaveBeenCalledWith(
        'DELETE FROM ticket_holds WHERE ticket_id = $1',
        ['123']
      );
      expect(mockClient.query).toHaveBeenCalledWith(
        'DELETE FROM order_items WHERE ticket_id = $1',
        ['123']
      );
      expect(mockClient.query).toHaveBeenCalledWith(
        'DELETE FROM ticket_events WHERE id = $1',
        ['123']
      );
      expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
      expect(mockClient.release).toHaveBeenCalled();
      expect(result).toBe(true);
    });

    it('rolls back on error and rethrows', async () => {
      const repo = createTicketEventsRepository(mockPostgresRuntime)!;
      const error = new Error('DB error');
      mockClient.query
        .mockResolvedValueOnce(undefined) // BEGIN
        .mockRejectedValueOnce(error); // delete holds fails

      await expect(repo.forceDelete('123')).rejects.toThrow('DB error');
      expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
      expect(mockClient.release).toHaveBeenCalled();
    });
  });

  describe('hasHoldsOrOrders', () => {
    it('returns true if holds exist', async () => {
      const repo = createTicketEventsRepository(mockPostgresRuntime)!;
      mockPool.query
        .mockResolvedValueOnce({ rows: [{ '?column?': 1 }] }) // holds exist
        .mockResolvedValueOnce({ rows: [] }); // orders check not needed
      const result = await repo.hasHoldsOrOrders('123');
      expect(mockPool.query).toHaveBeenCalledWith(
        'SELECT 1 FROM ticket_holds WHERE ticket_id = $1 LIMIT 1',
        ['123']
      );
      expect(result).toBe(true);
    });

    it('returns true if orders exist', async () => {
      const repo = createTicketEventsRepository(mockPostgresRuntime)!;
      mockPool.query
        .mockResolvedValueOnce({ rows: [] }) // no holds
        .mockResolvedValueOnce({ rows: [{ '?column?': 1 }] }); // orders exist
      const result = await repo.hasHoldsOrOrders('123');
      expect(mockPool.query).toHaveBeenCalledWith(
        'SELECT 1 FROM order_items WHERE ticket_id = $1 LIMIT 1',
        ['123']
      );
      expect(result).toBe(true);
    });

    it('returns false if neither holds nor orders exist', async () => {
      const repo = createTicketEventsRepository(mockPostgresRuntime)!;
      mockPool.query
        .mockResolvedValueOnce({ rows: [] }) // no holds
        .mockResolvedValueOnce({ rows: [] }); // no orders
      const result = await repo.hasHoldsOrOrders('123');
      expect(result).toBe(false);
    });
  });
});
