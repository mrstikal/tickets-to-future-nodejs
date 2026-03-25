import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as dependenciesRuntime from '../lib/dependencies-runtime';
import * as holdsRepositoryModule from '../repositories/holds-repository';
import * as ticketsRepositoryModule from '../repositories/tickets-repository';
import * as ordersRepositoryModule from '../repositories/orders-repository';
import * as redisCacheModule from '../lib/redis-cache';
import * as websocketRuntimeModule from '../websocket/websocket-runtime';
import * as ordersService from '../services/orders-service';
import type { PostgresRuntime, RabbitmqRuntime, WebsocketBroadcaster } from '../types/runtime';
import type { Hold, Order, OrderStatus } from '../types/domain';
import type { RawTicketRow } from '../repositories/tickets-repository';

vi.mock('../lib/dependencies-runtime');
vi.mock('../repositories/holds-repository');
vi.mock('../repositories/tickets-repository');
vi.mock('../repositories/orders-repository');
vi.mock('../lib/redis-cache');
vi.mock('../websocket/websocket-runtime');

describe('orders-service', () => {
  let mockHoldsRepository: NonNullable<ReturnType<typeof holdsRepositoryModule.createHoldsRepository>>;
  let mockTicketsRepository: NonNullable<ReturnType<typeof ticketsRepositoryModule.createTicketsRepository>>;
  let mockOrdersRepository: NonNullable<ReturnType<typeof ordersRepositoryModule.createOrdersRepository>>;
  let mockPostgresRuntime: PostgresRuntime;
  let mockRabbitMQRuntime: RabbitmqRuntime;

  beforeEach(() => {
    mockHoldsRepository = {
      findById: vi.fn(),
      confirmHold: vi.fn(),
      expireHold: vi.fn(),
      cancelHold: vi.fn(),
      createHold: vi.fn(),
      countActiveHoldsByTicketId: vi.fn(),
      expireActiveHoldsForTicket: vi.fn(),
      findBySessionId: vi.fn(),
    };
    mockTicketsRepository = {
      findAll: vi.fn(),
      findById: vi.fn(),
      findRawById: vi.fn(),
      findRawByIdForUpdate: vi.fn(),
      incrementSoldQuantity: vi.fn(),
      getGroupedPreviews: vi.fn(),
      findByDateRange: vi.fn(),
    };
    mockOrdersRepository = {
      createOrder: vi.fn(),
      createOrderItem: vi.fn(),
      findById: vi.fn(),
      findAll: vi.fn(),
      countAll: vi.fn(),
      cancelOrder: vi.fn(),
      updateTotalPrice: vi.fn(),
      mapOrderRow: vi.fn(),
    };
    mockPostgresRuntime = {
      pool: {
        connect: vi.fn().mockResolvedValue({
          query: vi.fn(),
          release: vi.fn(),
        }),
      },
    } as unknown as PostgresRuntime;
    mockRabbitMQRuntime = {
      getChannel: vi.fn().mockReturnValue({
        publish: vi.fn(),
      }),
    } as unknown as RabbitmqRuntime;

    vi.mocked(holdsRepositoryModule.createHoldsRepository).mockReturnValue(mockHoldsRepository);
    vi.mocked(ticketsRepositoryModule.createTicketsRepository).mockReturnValue(mockTicketsRepository);
    vi.mocked(ordersRepositoryModule.createOrdersRepository).mockReturnValue(mockOrdersRepository);
    vi.mocked(redisCacheModule.delCache).mockResolvedValue();
    vi.mocked(redisCacheModule.delCachePattern).mockResolvedValue();
    vi.mocked(websocketRuntimeModule.getWebsocketRuntime).mockReturnValue({
      broadcastOrderStatusUpdated: vi.fn(),
      broadcastTicketAvailability: vi.fn(),
      broadcastHoldUpdate: vi.fn(),
    } as unknown as WebsocketBroadcaster);
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('createOrder', () => {
    const baseInput = {
      holdIds: ['11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222'],
      sessionId: 'session-1234567890',
      email: 'customer@example.com',
      name: 'John Doe',
      referenceNumber: 'REF-456',
    };

    const mockHold: Hold = {
      id: '11111111-1111-4111-8111-111111111111',
      ticketId: '33333333-3333-4333-8333-333333333333',
      sessionId: 'session-1234567890',
      status: 'active',
      expiresAt: new Date(Date.now() + 3600000).toISOString(),
      ttlSeconds: 3600,
      createdAt: '2025-01-01T10:00:00Z',
      updatedAt: '2025-01-01T10:00:00Z',
    };

    const mockTicket: RawTicketRow = {
      id: '33333333-3333-4333-8333-333333333333',
      ticket_type_id: '44444444-4444-4444-8444-444444444444',
      slug: 'test-ticket',
      title: 'Test Ticket',
      description: 'Description',
      event_at: '2025-12-31T20:00:00Z',
      price: 1000,
      currency: 'CZK',
      total_quantity: 100,
      sold_quantity: 50,
      is_active: true,
      image_asset_id: '55555555-5555-4555-8555-555555555555',
      created_at: '2025-01-01T00:00:00Z',
      updated_at: '2025-01-01T00:00:00Z',
    };

    const mockOrderRow = {
      id: '66666666-6666-4666-8666-666666666666',
      order_number: 'ORD-123',
      email: 'customer@example.com',
      name: 'John Doe',
      reference_number: 'REF-456',
      status: 'confirmed' as OrderStatus,
      total_price: 1800,
      currency: 'CZK',
      created_at: '2025-01-01T12:00:00Z',
      updated_at: '2025-01-01T12:00:00Z',
    };

    const mockFullOrder: Order = {
      id: '66666666-6666-4666-8666-666666666666',
      orderNumber: 'ORD-123',
      status: 'confirmed',
      email: 'customer@example.com',
      name: 'John Doe',
      referenceNumber: 'REF-456',
      currency: 'CZK',
      totalPrice: 1800,
      items: [
        {
          ticketId: 'ticket-1',
          ticketTitle: 'Test Ticket',
          quantity: 2,
          unitPrice: 900,
          totalPrice: 1800,
        },
      ],
      createdAt: '2025-01-01T12:00:00Z',
      updatedAt: '2025-01-01T12:00:00Z',
    };

    it('returns error if postgres not available', async () => {
      vi.mocked(dependenciesRuntime.getDependenciesRuntime).mockReturnValue({ postgres: null, redis: null, rabbitmq: null });
      const result = await ordersService.createOrder(baseInput);
      expect('error' in result).toBe(true);
      if ('error' in result) {
        expect(result.error?.statusCode).toBe(503);
        expect(result.error?.code).toBe('POSTGRES_NOT_AVAILABLE');
      }
    });

    it('returns error if holdIds empty', async () => {
      vi.mocked(dependenciesRuntime.getDependenciesRuntime).mockReturnValue({ postgres: mockPostgresRuntime, redis: null, rabbitmq: null });
      const result = await ordersService.createOrder({
        ...baseInput,
        holdIds: [],
      });
      expect('error' in result).toBe(true);
      if ('error' in result) {
        expect(result.error?.statusCode).toBe(400);
        expect(result.error?.code).toBe('INVALID_HOLD_IDS');
      }
    });

    it('returns error if hold not found', async () => {
      vi.mocked(mockHoldsRepository.findById).mockResolvedValue(null);
      vi.mocked(dependenciesRuntime.getDependenciesRuntime).mockReturnValue({ postgres: mockPostgresRuntime, redis: null, rabbitmq: null });
      const result = await ordersService.createOrder(baseInput);
      expect('error' in result).toBe(true);
      if ('error' in result) {
        expect(result.error?.statusCode).toBe(404);
        expect(result.error?.code).toBe('HOLD_NOT_FOUND');
      }
    });

    it('returns error if hold not active', async () => {
      vi.mocked(mockHoldsRepository.findById).mockResolvedValue({
        ...mockHold,
        status: 'expired',
      });
      vi.mocked(dependenciesRuntime.getDependenciesRuntime).mockReturnValue({ postgres: mockPostgresRuntime, redis: null, rabbitmq: null });
      const result = await ordersService.createOrder(baseInput);
      expect('error' in result).toBe(true);
      if ('error' in result) {
        expect(result.error?.statusCode).toBe(409);
        expect(result.error?.code).toBe('HOLD_NOT_ACTIVE');
      }
    });

    it('returns error if hold session mismatch', async () => {
      vi.mocked(mockHoldsRepository.findById).mockResolvedValue({
        ...mockHold,
        sessionId: 'different-session',
      });
      vi.mocked(dependenciesRuntime.getDependenciesRuntime).mockReturnValue({ postgres: mockPostgresRuntime, redis: null, rabbitmq: null });
      const result = await ordersService.createOrder(baseInput);
      expect('error' in result).toBe(true);
      if ('error' in result) {
        expect(result.error?.statusCode).toBe(422);
        expect(result.error?.code).toBe('HOLD_SESSION_MISMATCH');
      }
    });

    it('returns error if hold expired', async () => {
      vi.mocked(mockHoldsRepository.findById).mockResolvedValue({
        ...mockHold,
        expiresAt: new Date(Date.now() - 1000).toISOString(),
      });
      vi.mocked(dependenciesRuntime.getDependenciesRuntime).mockReturnValue({ postgres: mockPostgresRuntime, redis: null, rabbitmq: null });
      const result = await ordersService.createOrder(baseInput);
      expect('error' in result).toBe(true);
      if ('error' in result) {
        expect(result.error?.statusCode).toBe(409);
        expect(result.error?.code).toBe('HOLD_NOT_ACTIVE');
      }
      expect(mockHoldsRepository.expireHold).toHaveBeenCalledWith('11111111-1111-4111-8111-111111111111');
    });

    it('returns error if ticket not found', async () => {
      vi.mocked(mockHoldsRepository.findById).mockResolvedValue(mockHold);
      vi.mocked(mockTicketsRepository.findRawById).mockResolvedValue(null);
      vi.mocked(dependenciesRuntime.getDependenciesRuntime).mockReturnValue({ postgres: mockPostgresRuntime, redis: null, rabbitmq: null });
      const result = await ordersService.createOrder(baseInput);
      expect('error' in result).toBe(true);
      if ('error' in result) {
        expect(result.error?.statusCode).toBe(404);
        expect(result.error?.code).toBe('TICKET_NOT_FOUND');
      }
    });

    it('creates order without discount when userId not provided', async () => {
      vi.mocked(mockHoldsRepository.findById).mockResolvedValue(mockHold);
      vi.mocked(mockTicketsRepository.findRawById).mockResolvedValue(mockTicket);
      vi.mocked(mockOrdersRepository.createOrder).mockResolvedValue({ ...mockOrderRow, total_price: 2000 });
      vi.mocked(mockOrdersRepository.findById).mockResolvedValue({ ...mockFullOrder, totalPrice: 2000 });
      vi.mocked(mockHoldsRepository.confirmHold).mockResolvedValue({ ...mockHold, status: 'confirmed' });
      vi.mocked(dependenciesRuntime.getDependenciesRuntime).mockReturnValue({
        postgres: mockPostgresRuntime,
        redis: null,
        rabbitmq: mockRabbitMQRuntime,
      });

      const result = await ordersService.createOrder(baseInput);
      expect('data' in result).toBe(true);
      // total price = 1000 * 2 = 2000, no discount
      expect(mockOrdersRepository.createOrder).toHaveBeenCalledWith(
        expect.objectContaining({
          totalPrice: 2000,
          discountPercentage: 0,
        }),
        expect.anything()
      );
      expect(mockOrdersRepository.createOrderItem).toHaveBeenCalledWith(
        expect.objectContaining({
          unitPrice: 1000,
          totalPrice: 2000,
        }),
        expect.anything()
      );
      if ('data' in result) {
        expect(result.data.totalPrice).toBe(2000);
      }
    });

    it('applies 10% discount when userId provided', async () => {
      vi.mocked(mockHoldsRepository.findById).mockResolvedValue(mockHold);
      vi.mocked(mockTicketsRepository.findRawById).mockResolvedValue(mockTicket);
      vi.mocked(mockOrdersRepository.createOrder).mockResolvedValue(mockOrderRow);
      vi.mocked(mockOrdersRepository.findById).mockResolvedValue(mockFullOrder);
      vi.mocked(mockHoldsRepository.confirmHold).mockResolvedValue({ ...mockHold, status: 'confirmed' });
      vi.mocked(dependenciesRuntime.getDependenciesRuntime).mockReturnValue({
        postgres: mockPostgresRuntime,
        redis: null,
        rabbitmq: mockRabbitMQRuntime,
      });

      const result = await ordersService.createOrder({
        ...baseInput,
        userId: 'user-123',
      });
      expect('data' in result).toBe(true);
      // total price = 1000 * 2 * 0.9 = 1800
      expect(mockOrdersRepository.createOrder).toHaveBeenCalledWith(
        expect.objectContaining({
          totalPrice: 1800,
          discountPercentage: 10,
        }),
        expect.anything()
      );
      expect(mockOrdersRepository.createOrderItem).toHaveBeenCalledWith(
        expect.objectContaining({
          unitPrice: 900, // 1000 * 0.9
          totalPrice: 1800,
        }),
        expect.anything()
      );
      if ('data' in result) {
        expect(result.data.totalPrice).toBe(1800);
      }
    });

    it('rounds discounted prices to two decimal places', async () => {
      const ticketWithOddPrice: RawTicketRow = {
        ...mockTicket,
        price: 1234.56,
      };
      vi.mocked(mockHoldsRepository.findById).mockResolvedValue(mockHold);
      vi.mocked(mockTicketsRepository.findRawById).mockResolvedValue(ticketWithOddPrice);
      vi.mocked(mockOrdersRepository.createOrder).mockResolvedValue({ ...mockOrderRow, total_price: 2222.21 });
      vi.mocked(mockOrdersRepository.findById).mockResolvedValue({ ...mockFullOrder, totalPrice: 2222.21 });
      vi.mocked(mockHoldsRepository.confirmHold).mockResolvedValue({ ...mockHold, status: 'confirmed' });
      vi.mocked(dependenciesRuntime.getDependenciesRuntime).mockReturnValue({
        postgres: mockPostgresRuntime,
        redis: null,
        rabbitmq: mockRabbitMQRuntime,
      });

      await ordersService.createOrder({
        ...baseInput,
        userId: 'user-123',
      });
      // 1234.56 * 2 * 0.9 = 2222.208 → rounded to 2222.21
      expect(mockOrdersRepository.createOrder).toHaveBeenCalledWith(
        expect.objectContaining({
          totalPrice: 2222.21,
        }),
        expect.anything()
      );
      expect(mockOrdersRepository.createOrderItem).toHaveBeenCalledWith(
        expect.objectContaining({
          unitPrice: 1111.10, // 1234.56 * 0.9 = 1111.104 → rounded to 1111.10
          totalPrice: 2222.21,
        }),
        expect.anything()
      );
    });

    it('handles multiple holds for same ticket', async () => {
      const h1Id = '11111111-1111-4111-8111-111111111111';
      const h2Id = '22222222-2222-4222-8222-222222222222';
      const hold1 = { ...mockHold, id: h1Id };
      const hold2 = { ...mockHold, id: h2Id };
      vi.mocked(mockHoldsRepository.findById)
        .mockResolvedValueOnce(hold1)
        .mockResolvedValueOnce(hold2);
      vi.mocked(mockTicketsRepository.findRawById).mockResolvedValue(mockTicket);
      vi.mocked(mockOrdersRepository.createOrder).mockResolvedValue(mockOrderRow);
      vi.mocked(mockOrdersRepository.findById).mockResolvedValue(mockFullOrder);
      vi.mocked(mockHoldsRepository.confirmHold)
        .mockResolvedValueOnce({ ...hold1, status: 'confirmed' })
        .mockResolvedValueOnce({ ...hold2, status: 'confirmed' });
      vi.mocked(dependenciesRuntime.getDependenciesRuntime).mockReturnValue({
        postgres: mockPostgresRuntime,
        redis: null,
        rabbitmq: mockRabbitMQRuntime,
      });

      const result = await ordersService.createOrder({
        ...baseInput,
        holdIds: [h1Id, h2Id],
        userId: 'user-123',
      });
      expect('data' in result).toBe(true);
      // 2 holds for same ticket → quantity = 2
      expect(mockOrdersRepository.createOrderItem).toHaveBeenCalledWith(
        expect.objectContaining({
          quantity: 2,
          totalPrice: 1800,
        }),
        expect.anything()
      );
      expect(mockTicketsRepository.incrementSoldQuantity).toHaveBeenCalledWith(mockTicket.id, 2, expect.anything());
    });

    it('handles multiple holds for different tickets', async () => {
      const h1Id = '11111111-1111-4111-8111-111111111111';
      const h2Id = '22222222-2222-4222-8222-222222222222';
      const t2Id = '88888888-8888-4888-8888-888888888888';
      const hold1 = { ...mockHold, id: h1Id, ticketId: mockTicket.id };
      const hold2 = { ...mockHold, id: h2Id, ticketId: t2Id };
      const ticket2: RawTicketRow = {
        ...mockTicket,
        id: t2Id,
        price: 500,
      };
      vi.mocked(mockHoldsRepository.findById)
        .mockResolvedValueOnce(hold1)
        .mockResolvedValueOnce(hold2);
      vi.mocked(mockTicketsRepository.findRawById)
        .mockResolvedValueOnce(mockTicket)
        .mockResolvedValueOnce(ticket2);
      vi.mocked(mockOrdersRepository.createOrder).mockResolvedValue({ ...mockOrderRow, total_price: 1350 });
      vi.mocked(mockOrdersRepository.findById).mockResolvedValue({ ...mockFullOrder, totalPrice: 1350 });
      vi.mocked(mockHoldsRepository.confirmHold)
        .mockResolvedValueOnce({ ...hold1, status: 'confirmed' })
        .mockResolvedValueOnce({ ...hold2, status: 'confirmed' });
      vi.mocked(dependenciesRuntime.getDependenciesRuntime).mockReturnValue({
        postgres: mockPostgresRuntime,
        redis: null,
        rabbitmq: mockRabbitMQRuntime,
      });

      const result = await ordersService.createOrder({
        ...baseInput,
        holdIds: [h1Id, h2Id],
        userId: 'user-123',
      });
      expect('data' in result).toBe(true);
      // Should create two order items (one per ticket)
      expect(mockOrdersRepository.createOrderItem).toHaveBeenCalledTimes(2);
      expect(mockTicketsRepository.incrementSoldQuantity).toHaveBeenCalledWith(mockTicket.id, 1, expect.anything());
      expect(mockTicketsRepository.incrementSoldQuantity).toHaveBeenCalledWith(t2Id, 1, expect.anything());
    });

    it('returns error if confirmHold fails', async () => {
      vi.mocked(mockHoldsRepository.findById).mockResolvedValue(mockHold);
      vi.mocked(mockTicketsRepository.findRawById).mockResolvedValue(mockTicket);
      vi.mocked(mockOrdersRepository.createOrder).mockResolvedValue(mockOrderRow);
      vi.mocked(mockHoldsRepository.confirmHold).mockResolvedValue(null);
      vi.mocked(dependenciesRuntime.getDependenciesRuntime).mockReturnValue({
        postgres: mockPostgresRuntime,
        redis: null,
        rabbitmq: mockRabbitMQRuntime,
      });

      const result = await ordersService.createOrder(baseInput);
      expect('error' in result).toBe(true);
      if ('error' in result) {
        expect(result.error?.statusCode).toBe(409);
        expect(result.error?.code).toBe('HOLD_NOT_ACTIVE');
      }
    });

    it('returns internal error on exception', async () => {
      vi.mocked(mockHoldsRepository.findById).mockRejectedValue(new Error('DB error'));
      vi.mocked(dependenciesRuntime.getDependenciesRuntime).mockReturnValue({
        postgres: mockPostgresRuntime,
        redis: null,
        rabbitmq: mockRabbitMQRuntime,
      });

      const result = await ordersService.createOrder(baseInput);
      expect('error' in result).toBe(true);
      if ('error' in result) {
        expect(result.error?.statusCode).toBe(500);
        expect(result.error?.code).toBe('INTERNAL_ERROR');
      }
    });
  });

  describe('getOrderById', () => {
    it('returns error if postgres not available', async () => {
      vi.mocked(dependenciesRuntime.getDependenciesRuntime).mockReturnValue({ postgres: null, redis: null, rabbitmq: null });
      const result = await ordersService.getOrderById('order-1');
      expect('error' in result).toBe(true);
      if ('error' in result) {
        expect(result.error?.statusCode).toBe(503);
        expect(result.error?.code).toBe('POSTGRES_NOT_AVAILABLE');
      }
    });

    it('returns error if order not found', async () => {
      vi.mocked(mockOrdersRepository.findById).mockResolvedValue(null);
      vi.mocked(dependenciesRuntime.getDependenciesRuntime).mockReturnValue({ postgres: mockPostgresRuntime, redis: null, rabbitmq: null });
      const result = await ordersService.getOrderById('nonexistent');
      expect('error' in result).toBe(true);
      if ('error' in result) {
        expect(result.error?.statusCode).toBe(404);
        expect(result.error?.code).toBe('ORDER_NOT_FOUND');
      }
    });

    it('returns order if found', async () => {
      const order: Order = {
        id: 'order-1',
        orderNumber: 'ORD-123',
        status: 'confirmed',
        email: 'customer@example.com',
        name: 'John Doe',
        referenceNumber: 'REF-456',
        currency: 'CZK',
        totalPrice: 2000,
        items: [],
        createdAt: '2025-01-01T12:00:00Z',
        updatedAt: '2025-01-01T12:00:00Z',
      };
      vi.mocked(mockOrdersRepository.findById).mockResolvedValue(order);
      vi.mocked(dependenciesRuntime.getDependenciesRuntime).mockReturnValue({ postgres: mockPostgresRuntime, redis: null, rabbitmq: null });

      const result = await ordersService.getOrderById('order-1');
      expect('data' in result).toBe(true);
      if ('data' in result) {
        expect(result.data).toEqual(order);
      }
    });

    it('returns internal error on repository exception', async () => {
      vi.mocked(mockOrdersRepository.findById).mockRejectedValue(new Error('DB error'));
      vi.mocked(dependenciesRuntime.getDependenciesRuntime).mockReturnValue({ postgres: mockPostgresRuntime, redis: null, rabbitmq: null });

      const result = await ordersService.getOrderById('order-1');
      expect('error' in result).toBe(true);
      if ('error' in result) {
        expect(result.error?.statusCode).toBe(500);
        expect(result.error?.code).toBe('INTERNAL_ERROR');
      }
    });
  });
});
