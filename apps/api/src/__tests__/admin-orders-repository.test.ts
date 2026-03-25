import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createOrdersRepository } from '../repositories/orders-repository';
import type { PostgresRuntime } from '../types/runtime';
import type { OrderStatus } from '../types/domain';

describe('orders-repository (admin methods)', () => {
  let mockPool: { query: ReturnType<typeof vi.fn> };
  let mockPostgresRuntime: PostgresRuntime;

  beforeEach(() => {
    mockPool = {
      query: vi.fn(),
    };
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

  describe('createOrdersRepository', () => {
    it('returns null if postgresRuntime is null', () => {
      const repo = createOrdersRepository(null);
      expect(repo).toBeNull();
    });

    it('returns repository object if postgresRuntime exists', () => {
      const repo = createOrdersRepository(mockPostgresRuntime);
      expect(repo).toBeDefined();
      expect(repo).toHaveProperty('findAll');
      expect(repo).toHaveProperty('countAll');
      expect(repo).toHaveProperty('cancelOrder');
      expect(repo).toHaveProperty('updateTotalPrice');
    });
  });

  describe('findAll', () => {
    it('returns empty array when no orders', async () => {
      const repo = createOrdersRepository(mockPostgresRuntime)!;
      mockPool.query.mockResolvedValue({ rows: [] });

      const result = await repo.findAll({ limit: 20, offset: 0 });
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT'),
        [20, 0]
      );
      expect(result).toEqual([]);
    });

    it('returns mapped admin orders with itemCount', async () => {
      const repo = createOrdersRepository(mockPostgresRuntime)!;
      const rows = [
        {
          id: 'order-1',
          order_number: 'ORD-123',
          status: 'confirmed' as OrderStatus,
          email: 'user@example.com',
          name: 'John Doe',
          reference_number: 'REF-456',
          total_price: 5000,
          currency: 'CZK',
          created_at: '2025-01-15T10:30:00Z',
          updated_at: '2025-01-15T10:30:00Z',
          item_count: '3',
        },
        {
          id: 'order-2',
          order_number: 'ORD-124',
          status: 'created' as OrderStatus,
          email: 'another@example.com',
          name: null,
          reference_number: null,
          total_price: 2000,
          currency: 'CZK',
          created_at: '2025-01-14T09:15:00Z',
          updated_at: '2025-01-14T09:15:00Z',
          item_count: '1',
        },
      ];
      mockPool.query.mockResolvedValue({ rows });

      const result = await repo.findAll({ limit: 10, offset: 0 });
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        id: 'order-1',
        orderNumber: 'ORD-123',
        status: 'confirmed',
        email: 'user@example.com',
        name: 'John Doe',
        referenceNumber: 'REF-456',
        totalPrice: 5000,
        currency: 'CZK',
        itemCount: 3,
        createdAt: '2025-01-15T10:30:00Z',
        updatedAt: '2025-01-15T10:30:00Z',
      });
      expect(result[1]).toEqual({
        id: 'order-2',
        orderNumber: 'ORD-124',
        status: 'created',
        email: 'another@example.com',
        name: undefined,
        referenceNumber: undefined,
        totalPrice: 2000,
        currency: 'CZK',
        itemCount: 1,
        createdAt: '2025-01-14T09:15:00Z',
        updatedAt: '2025-01-14T09:15:00Z',
      });
    });

    it('applies status filter', async () => {
      const repo = createOrdersRepository(mockPostgresRuntime)!;
      mockPool.query.mockResolvedValue({ rows: [] });

      await repo.findAll({
        limit: 20,
        offset: 0,
        status: 'confirmed',
      });

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('WHERE o.status = $1'),
        ['confirmed', 20, 0]
      );
    });

    it('applies startDate filter', async () => {
      const repo = createOrdersRepository(mockPostgresRuntime)!;
      mockPool.query.mockResolvedValue({ rows: [] });

      await repo.findAll({
        limit: 20,
        offset: 0,
        startDate: '2025-01-01',
      });

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('WHERE o.created_at >= $1'),
        ['2025-01-01', 20, 0]
      );
    });

    it('applies endDate filter', async () => {
      const repo = createOrdersRepository(mockPostgresRuntime)!;
      mockPool.query.mockResolvedValue({ rows: [] });

      await repo.findAll({
        limit: 20,
        offset: 0,
        endDate: '2025-01-31',
      });

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('WHERE o.created_at <= $1'),
        ['2025-01-31', 20, 0]
      );
    });

    it('applies email filter (ILIKE)', async () => {
      const repo = createOrdersRepository(mockPostgresRuntime)!;
      mockPool.query.mockResolvedValue({ rows: [] });

      await repo.findAll({
        limit: 20,
        offset: 0,
        email: 'test',
      });

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('WHERE o.email ILIKE $1'),
        ['%test%', 20, 0]
      );
    });

    it('combines multiple filters', async () => {
      const repo = createOrdersRepository(mockPostgresRuntime)!;
      mockPool.query.mockResolvedValue({ rows: [] });

      await repo.findAll({
        limit: 10,
        offset: 20,
        status: 'confirmed',
        startDate: '2025-01-01',
        endDate: '2025-01-31',
        email: 'user',
      });

      const query = mockPool.query.mock.calls[0][0];
      expect(query).toContain('WHERE');
      expect(query).toContain('AND');
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.any(String),
        ['confirmed', '2025-01-01', '2025-01-31', '%user%', 10, 20]
      );
    });
  });

  describe('countAll', () => {
    it('returns total count without filters', async () => {
      const repo = createOrdersRepository(mockPostgresRuntime)!;
      mockPool.query.mockResolvedValue({ rows: [{ count: '42' }] });

      const result = await repo.countAll({});
      expect(mockPool.query).toHaveBeenCalledWith(
        'SELECT COUNT(*) FROM orders o',
        []
      );
      expect(result).toBe(42);
    });

    it('applies status filter', async () => {
      const repo = createOrdersRepository(mockPostgresRuntime)!;
      mockPool.query.mockResolvedValue({ rows: [{ count: '5' }] });

      const result = await repo.countAll({ status: 'created' });
      expect(mockPool.query).toHaveBeenCalledWith(
        'SELECT COUNT(*) FROM orders o WHERE o.status = $1',
        ['created']
      );
      expect(result).toBe(5);
    });

    it('applies startDate and endDate filters', async () => {
      const repo = createOrdersRepository(mockPostgresRuntime)!;
      mockPool.query.mockResolvedValue({ rows: [{ count: '12' }] });

      const result = await repo.countAll({
        startDate: '2025-01-01',
        endDate: '2025-01-31',
      });
      expect(mockPool.query).toHaveBeenCalledWith(
        'SELECT COUNT(*) FROM orders o WHERE o.created_at >= $1 AND o.created_at <= $2',
        ['2025-01-01', '2025-01-31']
      );
      expect(result).toBe(12);
    });

    it('applies email filter', async () => {
      const repo = createOrdersRepository(mockPostgresRuntime)!;
      mockPool.query.mockResolvedValue({ rows: [{ count: '3' }] });

      const result = await repo.countAll({ email: 'example' });
      expect(mockPool.query).toHaveBeenCalledWith(
        'SELECT COUNT(*) FROM orders o WHERE o.email ILIKE $1',
        ['%example%']
      );
      expect(result).toBe(3);
    });
  });

  describe('cancelOrder', () => {
    it('returns true when rowCount > 0', async () => {
      const repo = createOrdersRepository(mockPostgresRuntime)!;
      mockPool.query.mockResolvedValue({ rowCount: 1 });

      const result = await repo.cancelOrder('order-123');
      expect(mockPool.query).toHaveBeenCalledWith(
        `UPDATE orders SET status = 'cancelled', updated_at = now() WHERE id = $1`,
        ['order-123']
      );
      expect(result).toBe(true);
    });

    it('returns false when rowCount = 0', async () => {
      const repo = createOrdersRepository(mockPostgresRuntime)!;
      mockPool.query.mockResolvedValue({ rowCount: 0 });

      const result = await repo.cancelOrder('nonexistent');
      expect(result).toBe(false);
    });
  });

  describe('updateTotalPrice', () => {
    it('returns true when rowCount > 0', async () => {
      const repo = createOrdersRepository(mockPostgresRuntime)!;
      mockPool.query.mockResolvedValue({ rowCount: 1 });

      const result = await repo.updateTotalPrice('order-123', 9999);
      expect(mockPool.query).toHaveBeenCalledWith(
        `UPDATE orders SET total_price = $1, updated_at = now() WHERE id = $2`,
        [9999, 'order-123']
      );
      expect(result).toBe(true);
    });

    it('returns false when rowCount = 0', async () => {
      const repo = createOrdersRepository(mockPostgresRuntime)!;
      mockPool.query.mockResolvedValue({ rowCount: 0 });

      const result = await repo.updateTotalPrice('nonexistent', 5000);
      expect(result).toBe(false);
    });
  });
});