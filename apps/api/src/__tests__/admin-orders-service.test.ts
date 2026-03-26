import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as dependenciesRuntime from '../lib/dependencies-runtime';
import * as ordersRepositoryModule from '../repositories/orders-repository';
import * as adminOrdersService from '../services/admin-orders-service';
import type { PostgresRuntime } from '../types/runtime';
import type { Order, AdminOrder, OrderStatus } from '../types/domain';

vi.mock('../lib/dependencies-runtime');
vi.mock('../repositories/orders-repository');

describe('admin-orders-service', () => {
  let mockRepository: NonNullable<ReturnType<typeof ordersRepositoryModule.createOrdersRepository>>;

  beforeEach(() => {
    mockRepository = {
      findAll: vi.fn(),
      countAll: vi.fn(),
      findById: vi.fn(),
      cancelOrder: vi.fn(),
      updateTotalPrice: vi.fn(),
      createOrder: vi.fn(),
      createOrderItem: vi.fn(),
      mapOrderRow: vi.fn(),
    };
    vi.mocked(ordersRepositoryModule.createOrdersRepository).mockReturnValue(mockRepository);
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('listOrders', () => {
    it('returns error if postgres not available', async () => {
      vi.mocked(dependenciesRuntime.getDependenciesRuntime).mockReturnValue({ postgres: null, redis: null, rabbitmq: null });
      const result = await adminOrdersService.listOrders(1, 20);
      expect('error' in result).toBe(true);
      if ('error' in result) {
        expect(result.error?.statusCode).toBe(503);
        expect(result.error?.code).toBe('POSTGRES_NOT_AVAILABLE');
      }
    });

    it('returns error if repository creation fails', async () => {
      vi.mocked(dependenciesRuntime.getDependenciesRuntime).mockReturnValue({ postgres: {} as PostgresRuntime, redis: null, rabbitmq: null });
      vi.mocked(ordersRepositoryModule.createOrdersRepository).mockReturnValue(null);
      const result = await adminOrdersService.listOrders(1, 20);
      expect('error' in result).toBe(true);
      if ('error' in result) {
        expect(result.error?.statusCode).toBe(503);
        expect(result.error?.code).toBe('POSTGRES_NOT_AVAILABLE');
      }
    });

    it('returns paginated orders without filters', async () => {
      const items: AdminOrder[] = [
        {
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
        },
      ];
      vi.mocked(mockRepository.findAll).mockResolvedValue(items);
      vi.mocked(mockRepository.countAll).mockResolvedValue(42);
      vi.mocked(dependenciesRuntime.getDependenciesRuntime).mockReturnValue({ postgres: {} as PostgresRuntime, redis: null, rabbitmq: null });

      const result = await adminOrdersService.listOrders(2, 10);
      expect(mockRepository.findAll).toHaveBeenCalledWith({
        limit: 10,
        offset: 10,
        status: undefined,
        startDate: undefined,
        endDate: undefined,
        email: undefined,
      });
      expect(mockRepository.countAll).toHaveBeenCalledWith({
        status: undefined,
        startDate: undefined,
        endDate: undefined,
        email: undefined,
      });
      expect('data' in result).toBe(true);
      if ('data' in result) {
        expect(result.data?.items).toEqual(items);
        expect(result.data?.meta.total).toBe(42);
        expect(result.data?.meta.page).toBe(2);
        expect(result.data?.meta.limit).toBe(10);
        expect(result.data?.meta.hasMore).toBe(true); // offset 10 + 10 items < 42
      }
    });

    it('calculates hasMore correctly when no more items', async () => {
      const items: AdminOrder[] = [];
      vi.mocked(mockRepository.findAll).mockResolvedValue(items);
      vi.mocked(mockRepository.countAll).mockResolvedValue(5);
      vi.mocked(dependenciesRuntime.getDependenciesRuntime).mockReturnValue({ postgres: {} as PostgresRuntime, redis: null, rabbitmq: null });

      const result = await adminOrdersService.listOrders(1, 10);
      expect('data' in result).toBe(true);
      if ('data' in result) {
        expect(result.data?.meta.hasMore).toBe(false); // offset 0 + 0 items < 5, but items.length = 0
      }
    });

    it('passes filters to repository', async () => {
      const items: AdminOrder[] = [];
      vi.mocked(mockRepository.findAll).mockResolvedValue(items);
      vi.mocked(mockRepository.countAll).mockResolvedValue(0);
      vi.mocked(dependenciesRuntime.getDependenciesRuntime).mockReturnValue({ postgres: {} as PostgresRuntime, redis: null, rabbitmq: null });

      const filters = {
        status: 'confirmed' as OrderStatus,
        startDate: '2025-01-01',
        endDate: '2025-01-31',
        email: 'test@example.com',
      };
      await adminOrdersService.listOrders(1, 20, filters);

      expect(mockRepository.findAll).toHaveBeenCalledWith({
        limit: 20,
        offset: 0,
        status: 'confirmed',
        startDate: '2025-01-01',
        endDate: '2025-01-31',
        email: 'test@example.com',
      });
      expect(mockRepository.countAll).toHaveBeenCalledWith({
        status: 'confirmed',
        startDate: '2025-01-01',
        endDate: '2025-01-31',
        email: 'test@example.com',
      });
    });

    it('returns internal error on repository exception', async () => {
      vi.mocked(mockRepository.findAll).mockRejectedValue(new Error('DB error'));
      vi.mocked(dependenciesRuntime.getDependenciesRuntime).mockReturnValue({ postgres: {} as PostgresRuntime, redis: null, rabbitmq: null });

      const result = await adminOrdersService.listOrders(1, 20);
      expect('error' in result).toBe(true);
      if ('error' in result) {
        expect(result.error?.statusCode).toBe(500);
        expect(result.error?.code).toBe('INTERNAL_ERROR');
      }
    });
  });

  describe('getOrderDetail', () => {
    it('returns error if id is not a valid UUID', async () => {
      const result = await adminOrdersService.getOrderDetail('8');
      expect('error' in result).toBe(true);
      if ('error' in result) {
        expect(result.error?.statusCode).toBe(400);
        expect(result.error?.code).toBe('INVALID_ID');
        expect(result.error?.message).toBe('Invalid order ID format.');
      }
    });

    it('returns error if postgres not available', async () => {
      vi.mocked(dependenciesRuntime.getDependenciesRuntime).mockReturnValue({ postgres: null, redis: null, rabbitmq: null });
      const result = await adminOrdersService.getOrderDetail('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11');
      expect('error' in result).toBe(true);
      if ('error' in result) {
        expect(result.error?.statusCode).toBe(503);
      }
    });

    it('returns error if order not found', async () => {
      vi.mocked(mockRepository.findById).mockResolvedValue(null);
      vi.mocked(dependenciesRuntime.getDependenciesRuntime).mockReturnValue({ postgres: {} as PostgresRuntime, redis: null, rabbitmq: null });

      const result = await adminOrdersService.getOrderDetail('b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a22');
      expect('error' in result).toBe(true);
      if ('error' in result) {
        expect(result.error?.statusCode).toBe(404);
        expect(result.error?.code).toBe('ORDER_NOT_FOUND');
      }
    });

    it('returns order detail when found', async () => {
      const order: Order = {
        id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
        orderNumber: 'ORD-123',
        status: 'confirmed',
        email: 'user@example.com',
        name: 'John Doe',
        referenceNumber: 'REF-456',
        currency: 'CZK',
        totalPrice: 5000,
        items: [
          {
            ticketId: 'ticket-1',
            ticketTitle: 'Concert Ticket',
            quantity: 2,
            unitPrice: 2000,
            totalPrice: 4000,
          },
        ],
        createdAt: '2025-01-15T10:30:00Z',
        updatedAt: '2025-01-15T10:30:00Z',
      };
      vi.mocked(mockRepository.findById).mockResolvedValue(order);
      vi.mocked(dependenciesRuntime.getDependenciesRuntime).mockReturnValue({ postgres: {} as PostgresRuntime, redis: null, rabbitmq: null });

      const result = await adminOrdersService.getOrderDetail('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11');
      expect('data' in result).toBe(true);
      if ('data' in result) {
        expect(result.data).toEqual(order);
      }
    });

    it('returns internal error on repository exception', async () => {
      vi.mocked(mockRepository.findById).mockRejectedValue(new Error('DB error'));
      vi.mocked(dependenciesRuntime.getDependenciesRuntime).mockReturnValue({ postgres: {} as PostgresRuntime, redis: null, rabbitmq: null });

      const result = await adminOrdersService.getOrderDetail('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11');
      expect('error' in result).toBe(true);
      if ('error' in result) {
        expect(result.error?.statusCode).toBe(500);
      }
    });
  });

  describe('cancelOrder', () => {
    it('returns error if id is not a valid UUID', async () => {
      const result = await adminOrdersService.cancelOrder('8');
      expect('error' in result).toBe(true);
      if ('error' in result) {
        expect(result.error?.statusCode).toBe(400);
        expect(result.error?.code).toBe('INVALID_ID');
        expect(result.error?.message).toBe('Invalid order ID format.');
      }
    });

    it('returns error if postgres not available', async () => {
      vi.mocked(dependenciesRuntime.getDependenciesRuntime).mockReturnValue({ postgres: null, redis: null, rabbitmq: null });
      const result = await adminOrdersService.cancelOrder('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11');
      expect('error' in result).toBe(true);
      if ('error' in result) {
        expect(result.error?.statusCode).toBe(503);
      }
    });

    it('returns error if order not found', async () => {
      vi.mocked(mockRepository.findById).mockResolvedValue(null);
      vi.mocked(dependenciesRuntime.getDependenciesRuntime).mockReturnValue({ postgres: {} as PostgresRuntime, redis: null, rabbitmq: null });

      const result = await adminOrdersService.cancelOrder('b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a22');
      expect('error' in result).toBe(true);
      if ('error' in result) {
        expect(result.error?.statusCode).toBe(404);
        expect(result.error?.code).toBe('ORDER_NOT_FOUND');
      }
    });

    it('returns error if order already cancelled', async () => {
      const cancelledOrder: Order = {
        id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
        orderNumber: 'ORD-123',
        status: 'cancelled',
        email: 'user@example.com',
        name: 'John Doe',
        referenceNumber: 'REF-456',
        currency: 'CZK',
        totalPrice: 5000,
        items: [],
        createdAt: '2025-01-15T10:30:00Z',
        updatedAt: '2025-01-15T10:30:00Z',
      };
      vi.mocked(mockRepository.findById).mockResolvedValue(cancelledOrder);
      vi.mocked(dependenciesRuntime.getDependenciesRuntime).mockReturnValue({ postgres: {} as PostgresRuntime, redis: null, rabbitmq: null });

      const result = await adminOrdersService.cancelOrder('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11');
      expect('error' in result).toBe(true);
      if ('error' in result) {
        expect(result.error?.statusCode).toBe(409);
        expect(result.error?.code).toBe('ORDER_NOT_CANCELLABLE');
        expect(result.error?.message).toContain('cancelled');
      }
    });

    it('returns error if order already expired', async () => {
      const expiredOrder: Order = {
        id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
        orderNumber: 'ORD-123',
        status: 'expired',
        email: 'user@example.com',
        name: 'John Doe',
        referenceNumber: 'REF-456',
        currency: 'CZK',
        totalPrice: 5000,
        items: [],
        createdAt: '2025-01-15T10:30:00Z',
        updatedAt: '2025-01-15T10:30:00Z',
      };
      vi.mocked(mockRepository.findById).mockResolvedValue(expiredOrder);
      vi.mocked(dependenciesRuntime.getDependenciesRuntime).mockReturnValue({ postgres: {} as PostgresRuntime, redis: null, rabbitmq: null });

      const result = await adminOrdersService.cancelOrder('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11');
      expect('error' in result).toBe(true);
      if ('error' in result) {
        expect(result.error?.statusCode).toBe(409);
        expect(result.error?.code).toBe('ORDER_NOT_CANCELLABLE');
        expect(result.error?.message).toContain('expired');
      }
    });

    it('calls cancelOrder and returns updated order', async () => {
      const originalOrder: Order = {
        id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
        orderNumber: 'ORD-123',
        status: 'confirmed',
        email: 'user@example.com',
        name: 'John Doe',
        referenceNumber: 'REF-456',
        currency: 'CZK',
        totalPrice: 5000,
        items: [],
        createdAt: '2025-01-15T10:30:00Z',
        updatedAt: '2025-01-15T10:30:00Z',
      };
      const updatedOrder: Order = {
        ...originalOrder,
        status: 'cancelled',
        updatedAt: '2025-01-15T11:00:00Z',
      };
      vi.mocked(mockRepository.findById)
        .mockResolvedValueOnce(originalOrder)
        .mockResolvedValueOnce(updatedOrder);
      vi.mocked(mockRepository.cancelOrder).mockResolvedValue(true);
      vi.mocked(dependenciesRuntime.getDependenciesRuntime).mockReturnValue({ postgres: {} as PostgresRuntime, redis: null, rabbitmq: null });

      const result = await adminOrdersService.cancelOrder('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11');
      expect('data' in result).toBe(true);
      expect(mockRepository.cancelOrder).toHaveBeenCalledWith('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11');
      if ('data' in result) {
        expect(result.data).toEqual(updatedOrder);
      }
    });

    it('returns error if cancelOrder returns false', async () => {
      const originalOrder: Order = {
        id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
        orderNumber: 'ORD-123',
        status: 'confirmed',
        email: 'user@example.com',
        name: 'John Doe',
        referenceNumber: 'REF-456',
        currency: 'CZK',
        totalPrice: 5000,
        items: [],
        createdAt: '2025-01-15T10:30:00Z',
        updatedAt: '2025-01-15T10:30:00Z',
      };
      vi.mocked(mockRepository.findById).mockResolvedValue(originalOrder);
      vi.mocked(mockRepository.cancelOrder).mockResolvedValue(false);
      vi.mocked(dependenciesRuntime.getDependenciesRuntime).mockReturnValue({ postgres: {} as PostgresRuntime, redis: null, rabbitmq: null });

      const result = await adminOrdersService.cancelOrder('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11');
      expect('error' in result).toBe(true);
      if ('error' in result) {
        expect(result.error?.statusCode).toBe(500);
        expect(result.error?.code).toBe('INTERNAL_ERROR');
      }
    });

    it('returns error if cannot load updated order', async () => {
      const originalOrder: Order = {
        id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
        orderNumber: 'ORD-123',
        status: 'confirmed',
        email: 'user@example.com',
        name: 'John Doe',
        referenceNumber: 'REF-456',
        currency: 'CZK',
        totalPrice: 5000,
        items: [],
        createdAt: '2025-01-15T10:30:00Z',
        updatedAt: '2025-01-15T10:30:00Z',
      };
      vi.mocked(mockRepository.findById)
        .mockResolvedValueOnce(originalOrder)
        .mockResolvedValueOnce(null);
      vi.mocked(mockRepository.cancelOrder).mockResolvedValue(true);
      vi.mocked(dependenciesRuntime.getDependenciesRuntime).mockReturnValue({ postgres: {} as PostgresRuntime, redis: null, rabbitmq: null });

      const result = await adminOrdersService.cancelOrder('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11');
      expect('error' in result).toBe(true);
      if ('error' in result) {
        expect(result.error?.statusCode).toBe(500);
        expect(result.error?.code).toBe('INTERNAL_ERROR');
      }
    });

    it('returns internal error on repository exception', async () => {
      vi.mocked(mockRepository.findById).mockRejectedValue(new Error('DB error'));
      vi.mocked(dependenciesRuntime.getDependenciesRuntime).mockReturnValue({ postgres: {} as PostgresRuntime, redis: null, rabbitmq: null });

      const result = await adminOrdersService.cancelOrder('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11');
      expect('error' in result).toBe(true);
      if ('error' in result) {
        expect(result.error?.statusCode).toBe(500);
      }
    });
  });

  describe('updateOrderTotalPrice', () => {
    it('returns error if id is not a valid UUID', async () => {
      const result = await adminOrdersService.updateOrderTotalPrice('8', 1000);
      expect('error' in result).toBe(true);
      if ('error' in result) {
        expect(result.error?.statusCode).toBe(400);
        expect(result.error?.code).toBe('INVALID_ID');
        expect(result.error?.message).toBe('Invalid order ID format.');
      }
    });

    it('returns error if postgres not available', async () => {
      vi.mocked(dependenciesRuntime.getDependenciesRuntime).mockReturnValue({ postgres: null, redis: null, rabbitmq: null });
      const result = await adminOrdersService.updateOrderTotalPrice('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 1000);
      expect('error' in result).toBe(true);
      if ('error' in result) {
        expect(result.error?.statusCode).toBe(503);
      }
    });

    it('returns error if totalPrice is negative', async () => {
      vi.mocked(dependenciesRuntime.getDependenciesRuntime).mockReturnValue({ postgres: {} as PostgresRuntime, redis: null, rabbitmq: null });
      const result = await adminOrdersService.updateOrderTotalPrice('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', -100);
      expect('error' in result).toBe(true);
      if ('error' in result) {
        expect(result.error?.statusCode).toBe(400);
        expect(result.error?.code).toBe('INVALID_TOTAL_PRICE');
      }
    });

    it('returns error if order not found', async () => {
      vi.mocked(mockRepository.findById).mockResolvedValue(null);
      vi.mocked(dependenciesRuntime.getDependenciesRuntime).mockReturnValue({ postgres: {} as PostgresRuntime, redis: null, rabbitmq: null });

      const result = await adminOrdersService.updateOrderTotalPrice('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 1000);
      expect('error' in result).toBe(true);
      if ('error' in result) {
        expect(result.error?.statusCode).toBe(404);
        expect(result.error?.code).toBe('ORDER_NOT_FOUND');
      }
    });

    it('calls updateTotalPrice and returns updated order', async () => {
      const originalOrder: Order = {
        id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
        orderNumber: 'ORD-123',
        status: 'confirmed',
        email: 'user@example.com',
        name: 'John Doe',
        referenceNumber: 'REF-456',
        currency: 'CZK',
        totalPrice: 5000,
        items: [],
        createdAt: '2025-01-15T10:30:00Z',
        updatedAt: '2025-01-15T10:30:00Z',
      };
      const updatedOrder: Order = {
        ...originalOrder,
        totalPrice: 4500,
        updatedAt: '2025-01-15T11:00:00Z',
      };
      vi.mocked(mockRepository.findById)
        .mockResolvedValueOnce(originalOrder)
        .mockResolvedValueOnce(updatedOrder);
      vi.mocked(mockRepository.updateTotalPrice).mockResolvedValue(true);
      vi.mocked(dependenciesRuntime.getDependenciesRuntime).mockReturnValue({ postgres: {} as PostgresRuntime, redis: null, rabbitmq: null });

      const result = await adminOrdersService.updateOrderTotalPrice('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 4500);
      expect('data' in result).toBe(true);
      expect(mockRepository.updateTotalPrice).toHaveBeenCalledWith('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 4500);
      if ('data' in result) {
        expect(result.data).toEqual(updatedOrder);
      }
    });

    it('returns error if updateTotalPrice returns false', async () => {
      const originalOrder: Order = {
        id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
        orderNumber: 'ORD-123',
        status: 'confirmed',
        email: 'user@example.com',
        name: 'John Doe',
        referenceNumber: 'REF-456',
        currency: 'CZK',
        totalPrice: 5000,
        items: [],
        createdAt: '2025-01-15T10:30:00Z',
        updatedAt: '2025-01-15T10:30:00Z',
      };
      vi.mocked(mockRepository.findById).mockResolvedValue(originalOrder);
      vi.mocked(mockRepository.updateTotalPrice).mockResolvedValue(false);
      vi.mocked(dependenciesRuntime.getDependenciesRuntime).mockReturnValue({ postgres: {} as PostgresRuntime, redis: null, rabbitmq: null });

      const result = await adminOrdersService.updateOrderTotalPrice('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 4500);
      expect('error' in result).toBe(true);
      if ('error' in result) {
        expect(result.error?.statusCode).toBe(500);
        expect(result.error?.code).toBe('INTERNAL_ERROR');
      }
    });

    it('returns error if cannot load updated order', async () => {
      const originalOrder: Order = {
        id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
        orderNumber: 'ORD-123',
        status: 'confirmed',
        email: 'user@example.com',
        name: 'John Doe',
        referenceNumber: 'REF-456',
        currency: 'CZK',
        totalPrice: 5000,
        items: [],
        createdAt: '2025-01-15T10:30:00Z',
        updatedAt: '2025-01-15T10:30:00Z',
      };
      vi.mocked(mockRepository.findById)
        .mockResolvedValueOnce(originalOrder)
        .mockResolvedValueOnce(null);
      vi.mocked(mockRepository.updateTotalPrice).mockResolvedValue(true);
      vi.mocked(dependenciesRuntime.getDependenciesRuntime).mockReturnValue({ postgres: {} as PostgresRuntime, redis: null, rabbitmq: null });

      const result = await adminOrdersService.updateOrderTotalPrice('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 4500);
      expect('error' in result).toBe(true);
      if ('error' in result) {
        expect(result.error?.statusCode).toBe(500);
        expect(result.error?.code).toBe('INTERNAL_ERROR');
      }
    });

    it('returns internal error on repository exception', async () => {
      vi.mocked(mockRepository.findById).mockRejectedValue(new Error('DB error'));
      vi.mocked(dependenciesRuntime.getDependenciesRuntime).mockReturnValue({ postgres: {} as PostgresRuntime, redis: null, rabbitmq: null });

      const result = await adminOrdersService.updateOrderTotalPrice('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 4500);
      expect('error' in result).toBe(true);
      if ('error' in result) {
        expect(result.error?.statusCode).toBe(500);
      }
    });
  });
});
