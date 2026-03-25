import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as dependenciesRuntime from '../lib/dependencies-runtime';
import * as holdsRepositoryModule from '../repositories/holds-repository';
import * as ticketsRepositoryModule from '../repositories/tickets-repository';
import * as redisCacheModule from '../lib/redis-cache';
import * as websocketRuntimeModule from '../websocket/websocket-runtime';
/* eslint-disable @typescript-eslint/no-explicit-any */
import * as holdsService from '../services/holds-service';
import type { PostgresRuntime, RabbitmqRuntime, WebsocketBroadcaster } from '../types/runtime';
import type { Hold } from '../types/domain';

vi.mock('../lib/dependencies-runtime');
vi.mock('../repositories/holds-repository');
vi.mock('../repositories/tickets-repository');
vi.mock('../lib/redis-cache');
vi.mock('../websocket/websocket-runtime');

describe('holds-service', () => {
  let mockHoldsRepository: NonNullable<ReturnType<typeof holdsRepositoryModule.createHoldsRepository>>;
  let mockTicketsRepository: NonNullable<ReturnType<typeof ticketsRepositoryModule.createTicketsRepository>>;
  let mockPostgresRuntime: PostgresRuntime;
  let mockRabbitMQRuntime: RabbitmqRuntime;

  beforeEach(() => {
    mockHoldsRepository = {
      createHold: vi.fn(),
      findById: vi.fn(),
      expireHold: vi.fn(),
      cancelHold: vi.fn(),
      confirmHold: vi.fn(),
      countActiveHoldsByTicketId: vi.fn(),
      expireActiveHoldsForTicket: vi.fn(),
      findBySessionId: vi.fn(),
    } as any;

    mockTicketsRepository = {
      findById: vi.fn(),
      findRawById: vi.fn(),
      findRawByIdForUpdate: vi.fn(),
      incrementSoldQuantity: vi.fn(),
    } as any;

    mockPostgresRuntime = {
      pool: {
        connect: vi.fn().mockResolvedValue({ query: vi.fn(), release: vi.fn(), }),
      },
      name: 'postgres',
      connect: vi.fn(),
      checkHealth: vi.fn(),
      close: vi.fn(),
    } as unknown as PostgresRuntime;

    mockRabbitMQRuntime = {
      name: 'rabbitmq',
      connect: vi.fn(),
      checkHealth: vi.fn(),
      getChannel: vi.fn().mockReturnValue({ publish: vi.fn() }),
      startConsumers: vi.fn(),
      stopConsumers: vi.fn(),
      close: vi.fn(),
    } as unknown as RabbitmqRuntime;

    vi.mocked(holdsRepositoryModule.createHoldsRepository).mockReturnValue(mockHoldsRepository);
    // By default assume no active holds for session
    vi.mocked(mockHoldsRepository.findBySessionId).mockResolvedValue([] as any);
    vi.mocked(ticketsRepositoryModule.createTicketsRepository).mockReturnValue(mockTicketsRepository);
    vi.mocked(redisCacheModule.delCache).mockResolvedValue();
    vi.mocked(redisCacheModule.delCachePattern).mockResolvedValue();
    vi.mocked(websocketRuntimeModule.getWebsocketRuntime).mockReturnValue({
      broadcastTicketAvailability: vi.fn(),
      broadcastHoldUpdate: vi.fn(),
      broadcastHoldExpired: vi.fn(),
    } as unknown as WebsocketBroadcaster);
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it('returns error if postgres not available', async () => {
    vi.mocked(dependenciesRuntime.getDependenciesRuntime).mockReturnValue({ postgres: null, redis: null, rabbitmq: null });
    const result = await holdsService.createHold({ ticketId: '11111111-1111-4111-8111-111111111111', sessionId: 'session-1234567890' });
    expect('error' in result).toBe(true);
    if ('error' in result) {
      expect(result.error?.statusCode).toBe(503);
      expect(result.error?.code).toBe('POSTGRES_NOT_AVAILABLE');
    }
  });

  it('returns validation error for invalid ticket id', async () => {
    vi.mocked(dependenciesRuntime.getDependenciesRuntime).mockReturnValue({ postgres: mockPostgresRuntime, redis: null, rabbitmq: null });
    const result = await holdsService.createHold({ ticketId: 'not-uuid', sessionId: 'session-1' });
    expect('error' in result).toBe(true);
    if ('error' in result) {
      expect(result.error?.statusCode).toBe(400);
      expect(result.error?.code).toBe('INVALID_TICKET_ID');
    }
  });

  it('returns validation error for invalid session id', async () => {
    vi.mocked(dependenciesRuntime.getDependenciesRuntime).mockReturnValue({ postgres: mockPostgresRuntime, redis: null, rabbitmq: null });
    const result = await holdsService.createHold({ ticketId: '11111111-1111-4111-8111-111111111111', sessionId: '' });
    expect('error' in result).toBe(true);
    if ('error' in result) {
      expect(result.error?.statusCode).toBe(400);
      expect(result.error?.code).toBe('INVALID_SESSION_ID');
    }
  });

  it('enforces hold limit per session', async () => {
    vi.mocked(dependenciesRuntime.getDependenciesRuntime).mockReturnValue({ postgres: mockPostgresRuntime, redis: null, rabbitmq: null });
    vi.mocked(mockHoldsRepository.findBySessionId).mockResolvedValue(new Array(100).fill({} as Hold));
    const result = await holdsService.createHold({ ticketId: '11111111-1111-4111-8111-111111111111', sessionId: 'session-1234567890' });
    expect('error' in result).toBe(true);
    if ('error' in result) {
      expect(result.error?.statusCode).toBe(409);
      expect(result.error?.code).toBe('HOLD_LIMIT_EXCEEDED');
    }
  });

  it('handles ticket not found and rollbacks', async () => {
    const fakeClient = { query: vi.fn(), release: vi.fn() } as any;
    vi.mocked(mockPostgresRuntime.pool.connect).mockResolvedValue(fakeClient);
    vi.mocked(dependenciesRuntime.getDependenciesRuntime).mockReturnValue({ postgres: mockPostgresRuntime, redis: null, rabbitmq: mockRabbitMQRuntime });
    vi.mocked(mockHoldsRepository.expireActiveHoldsForTicket).mockResolvedValue(undefined as any);
    vi.mocked(mockTicketsRepository.findRawByIdForUpdate).mockResolvedValue(null);

    const result = await holdsService.createHold({ ticketId: '11111111-1111-4111-8111-111111111111', sessionId: 'session-1234567890' });
    expect('error' in result).toBe(true);
    if ('error' in result) {
      expect(result.error?.statusCode).toBe(404);
      expect(result.error?.code).toBe('TICKET_NOT_FOUND');
    }
    expect(fakeClient.query).toHaveBeenCalled();
  });

  it('creates hold and broadcasts on success', async () => {
    const fakeClient = { query: vi.fn(), release: vi.fn() } as any;
    vi.mocked(mockPostgresRuntime.pool.connect).mockResolvedValue(fakeClient);
    vi.mocked(dependenciesRuntime.getDependenciesRuntime).mockReturnValue({ postgres: mockPostgresRuntime, redis: null, rabbitmq: mockRabbitMQRuntime });

    vi.mocked(mockHoldsRepository.expireActiveHoldsForTicket).mockResolvedValue(undefined as any);
    vi.mocked(mockTicketsRepository.findRawByIdForUpdate).mockResolvedValue({ id: 't1', total_quantity: 10, sold_quantity: 1, is_active: true } as any);
    vi.mocked(mockHoldsRepository.countActiveHoldsByTicketId).mockResolvedValue(0);
    const createdHold = { id: 'h1', ticketId: 't1', sessionId: 'session-1', status: 'active', expiresAt: new Date(Date.now() + 1000 * 60).toISOString(), ttlSeconds: 60, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() } as Hold;
    vi.mocked(mockHoldsRepository.createHold).mockResolvedValue(createdHold);
    vi.mocked(mockTicketsRepository.findById).mockResolvedValue({ id: 't1', availableQuantity: 9, soldQuantity: 1, activeHolds: 0 } as any);

    const ws = vi.mocked(websocketRuntimeModule.getWebsocketRuntime)() as any;
    const result = await holdsService.createHold({ ticketId: '11111111-1111-4111-8111-111111111111', sessionId: 'session-1234567890' });
    expect('data' in result).toBe(true);
    if ('data' in result) {
      expect(result.data).toEqual(createdHold);
    }
    expect(vi.mocked(redisCacheModule.delCache)).toHaveBeenCalled();
    expect(ws.broadcastTicketAvailability).toHaveBeenCalled();
    expect(ws.broadcastHoldUpdate).toHaveBeenCalled();
  });

  it('getHoldById expires expired hold and broadcasts', async () => {
    vi.mocked(dependenciesRuntime.getDependenciesRuntime).mockReturnValue({ postgres: mockPostgresRuntime, redis: null, rabbitmq: mockRabbitMQRuntime });
    const expiredHold = { id: '11111111-1111-4111-8111-111111111111', ticketId: 't1', sessionId: 's1', status: 'active', expiresAt: new Date(Date.now() - 1000).toISOString(), ttlSeconds: 0, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() } as Hold;
    vi.mocked(mockHoldsRepository.findById).mockResolvedValueOnce(expiredHold).mockResolvedValueOnce({ ...expiredHold, status: 'expired' } as Hold);
    vi.mocked(mockHoldsRepository.expireHold).mockResolvedValue({ ...expiredHold, status: 'expired' } as Hold);
    vi.mocked(mockTicketsRepository.findById).mockResolvedValue({ id: 't1', availableQuantity: 10, soldQuantity: 0, activeHolds: 0 } as any);

    const result = await holdsService.getHoldById('11111111-1111-4111-8111-111111111111');
    expect('data' in result).toBe(true);
    if ('data' in result) {
      expect(result.data.status).toBe('expired');
    }
    const ws = vi.mocked(websocketRuntimeModule.getWebsocketRuntime)() as any;
    expect(vi.mocked(redisCacheModule.delCachePattern)).toHaveBeenCalled();
    expect(ws.broadcastHoldExpired).toHaveBeenCalled();
    expect(ws.broadcastTicketAvailability).toHaveBeenCalled();
  });
});
