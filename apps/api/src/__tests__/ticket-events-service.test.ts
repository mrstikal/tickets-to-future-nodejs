import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as dependenciesRuntime from '../lib/dependencies-runtime';
import * as ticketEventsRepositoryModule from '../repositories/ticket-events-repository';
import * as ticketEventsService from '../services/ticket-events-service';
import type { PostgresRuntime } from '../types/runtime';
import type { TicketEvent } from '../types/domain';

vi.mock('../lib/dependencies-runtime');
vi.mock('../repositories/ticket-events-repository');

describe('ticket-events-service', () => {
  let mockRepository: NonNullable<ReturnType<typeof ticketEventsRepositoryModule.createTicketEventsRepository>>;

  beforeEach(() => {
    mockRepository = {
      findAll: vi.fn(),
      findById: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      forceDelete: vi.fn(),
      hasHoldsOrOrders: vi.fn(),
    };
    vi.mocked(ticketEventsRepositoryModule.createTicketEventsRepository).mockReturnValue(mockRepository);
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('listTicketEvents', () => {
    it('returns empty result if postgres not available', async () => {
      vi.mocked(dependenciesRuntime.getDependenciesRuntime).mockReturnValue({ postgres: null, redis: null, rabbitmq: null });
      const result = await ticketEventsService.listTicketEvents();
      expect(result.items).toEqual([]);
      expect(result.meta.total).toBe(0);
      expect(result.meta.page).toBe(1);
      expect(result.meta.limit).toBe(20);
      expect(result.meta.hasMore).toBe(false);
    });

    it('returns paginated ticket events', async () => {
      const items: TicketEvent[] = [
        {
          id: '1',
          ticketTypeId: 'type1',
          slug: 'test-event',
          title: 'Test Event',
          description: 'desc',
          eventAt: '2025-12-31T20:00:00Z',
          price: 1000,
          currency: 'CZK',
          totalQuantity: 100,
          soldQuantity: 50,
          isActive: true,
          imageAssetId: 'img1',
          imageUrl: '/path/to/image.jpg',
          createdAt: '2025-01-01T00:00:00Z',
          updatedAt: '2025-01-01T00:00:00Z',
        },
      ];
      vi.mocked(mockRepository.findAll).mockResolvedValue({ items, total: 1 });
      vi.mocked(dependenciesRuntime.getDependenciesRuntime).mockReturnValue({ postgres: {} as PostgresRuntime, redis: null, rabbitmq: null });
      const result = await ticketEventsService.listTicketEvents(1, 20);
      expect(mockRepository.findAll).toHaveBeenCalledWith(20, 0, undefined);
      expect(result.items).toEqual(items);
      expect(result.meta.total).toBe(1);
      expect(result.meta.page).toBe(1);
      expect(result.meta.limit).toBe(20);
      expect(result.meta.hasMore).toBe(false);
    });

    it('passes ticketTypeId filter to repository', async () => {
      vi.mocked(mockRepository.findAll).mockResolvedValue({ items: [], total: 0 });
      vi.mocked(dependenciesRuntime.getDependenciesRuntime).mockReturnValue({ postgres: {} as PostgresRuntime, redis: null, rabbitmq: null });
      await ticketEventsService.listTicketEvents(1, 20, 'type-123');
      expect(mockRepository.findAll).toHaveBeenCalledWith(20, 0, 'type-123');
    });

    it('validates page and limit', async () => {
      vi.mocked(mockRepository.findAll).mockResolvedValue({ items: [], total: 0 });
      vi.mocked(dependenciesRuntime.getDependenciesRuntime).mockReturnValue({ postgres: {} as PostgresRuntime, redis: null, rabbitmq: null });
      await ticketEventsService.listTicketEvents(0, -5);
      // validatePositiveInteger should convert invalid values to defaults
      expect(mockRepository.findAll).toHaveBeenCalledWith(20, 0, undefined);
    });
  });

  describe('getTicketEvent', () => {
    it('returns null if postgres not available', async () => {
      vi.mocked(dependenciesRuntime.getDependenciesRuntime).mockReturnValue({ postgres: null, redis: null, rabbitmq: null });
      const result = await ticketEventsService.getTicketEvent('1');
      expect(result).toBeNull();
    });

    it('returns ticket event from repository', async () => {
      const ticketEvent: TicketEvent = {
        id: '1',
        ticketTypeId: 'type1',
        slug: 'test-event',
        title: 'Test Event',
        description: 'desc',
        eventAt: '2025-12-31T20:00:00Z',
        price: 1000,
        currency: 'CZK',
        totalQuantity: 100,
        soldQuantity: 50,
        isActive: true,
        imageAssetId: 'img1',
        imageUrl: '/path/to/image.jpg',
        createdAt: '2025-01-01T00:00:00Z',
        updatedAt: '2025-01-01T00:00:00Z',
      };
      vi.mocked(mockRepository.findById).mockResolvedValue(ticketEvent);
      vi.mocked(dependenciesRuntime.getDependenciesRuntime).mockReturnValue({ postgres: {} as PostgresRuntime, redis: null, rabbitmq: null });
      const result = await ticketEventsService.getTicketEvent('1');
      expect(result).toEqual(ticketEvent);
    });
  });

  describe('createTicketEvent', () => {
    it('throws if postgres not available', async () => {
      vi.mocked(dependenciesRuntime.getDependenciesRuntime).mockReturnValue({ postgres: null, redis: null, rabbitmq: null });
      const data = {
        ticketTypeId: 'type1',
        slug: 'new-event',
        title: 'New Event',
        description: 'desc',
        eventAt: '2025-12-31T20:00:00Z',
        price: 1500,
        currency: 'CZK',
        totalQuantity: 200,
        soldQuantity: 0,
        isActive: true,
        imageAssetId: 'img2',
      };
      await expect(ticketEventsService.createTicketEvent(data)).rejects.toThrow('Postgres not available');
    });

    it('calls repository create and returns result', async () => {
      const data = {
        ticketTypeId: 'type1',
        slug: 'new-event',
        title: 'New Event',
        description: 'desc',
        eventAt: '2025-12-31T20:00:00Z',
        price: 1500,
        currency: 'CZK',
        totalQuantity: 200,
        soldQuantity: 0,
        isActive: true,
        imageAssetId: 'img2',
      };
      const created: TicketEvent = {
        id: '2',
        ...data,
        imageUrl: '/path/to/image2.jpg',
        createdAt: '2025-01-02T00:00:00Z',
        updatedAt: '2025-01-02T00:00:00Z',
      };
      vi.mocked(mockRepository.create).mockResolvedValue(created);
      vi.mocked(dependenciesRuntime.getDependenciesRuntime).mockReturnValue({ postgres: {} as PostgresRuntime, redis: null, rabbitmq: null });
      const result = await ticketEventsService.createTicketEvent(data);
      expect(mockRepository.create).toHaveBeenCalledWith(data);
      expect(result).toEqual(created);
    });
  });

  describe('updateTicketEvent', () => {
    it('throws if postgres not available', async () => {
      vi.mocked(dependenciesRuntime.getDependenciesRuntime).mockReturnValue({ postgres: null, redis: null, rabbitmq: null });
      await expect(ticketEventsService.updateTicketEvent('1', { title: 'Updated' })).rejects.toThrow('Postgres not available');
    });

    it('calls repository update and returns result', async () => {
      const updated: TicketEvent = {
        id: '1',
        ticketTypeId: 'type1',
        slug: 'test-event',
        title: 'Updated Event',
        description: 'desc',
        eventAt: '2025-12-31T20:00:00Z',
        price: 1000,
        currency: 'CZK',
        totalQuantity: 100,
        soldQuantity: 50,
        isActive: true,
        imageAssetId: 'img1',
        imageUrl: '/path/to/image.jpg',
        createdAt: '2025-01-01T00:00:00Z',
        updatedAt: '2025-01-02T00:00:00Z',
      };
      vi.mocked(mockRepository.update).mockResolvedValue(updated);
      vi.mocked(dependenciesRuntime.getDependenciesRuntime).mockReturnValue({ postgres: {} as PostgresRuntime, redis: null, rabbitmq: null });
      const result = await ticketEventsService.updateTicketEvent('1', { title: 'Updated Event' });
      expect(mockRepository.update).toHaveBeenCalledWith('1', { title: 'Updated Event' });
      expect(result).toEqual(updated);
    });
  });

  describe('deleteTicketEvent', () => {
    it('throws if postgres not available', async () => {
      vi.mocked(dependenciesRuntime.getDependenciesRuntime).mockReturnValue({ postgres: null, redis: null, rabbitmq: null });
      await expect(ticketEventsService.deleteTicketEvent('1')).rejects.toThrow('Postgres not available');
    });

    it('calls repository delete and returns result', async () => {
      vi.mocked(mockRepository.delete).mockResolvedValue(true);
      vi.mocked(dependenciesRuntime.getDependenciesRuntime).mockReturnValue({ postgres: {} as PostgresRuntime, redis: null, rabbitmq: null });
      const result = await ticketEventsService.deleteTicketEvent('1');
      expect(mockRepository.delete).toHaveBeenCalledWith('1');
      expect(result).toBe(true);
    });
  });

  describe('forceDeleteTicketEvent', () => {
    it('throws if postgres not available', async () => {
      vi.mocked(dependenciesRuntime.getDependenciesRuntime).mockReturnValue({ postgres: null, redis: null, rabbitmq: null });
      await expect(ticketEventsService.forceDeleteTicketEvent('1')).rejects.toThrow('Postgres not available');
    });

    it('calls repository forceDelete and returns result', async () => {
      vi.mocked(mockRepository.forceDelete).mockResolvedValue(true);
      vi.mocked(dependenciesRuntime.getDependenciesRuntime).mockReturnValue({ postgres: {} as PostgresRuntime, redis: null, rabbitmq: null });
      const result = await ticketEventsService.forceDeleteTicketEvent('1');
      expect(mockRepository.forceDelete).toHaveBeenCalledWith('1');
      expect(result).toBe(true);
    });
  });

  describe('checkTicketEventHasHoldsOrOrders', () => {
    it('throws if postgres not available', async () => {
      vi.mocked(dependenciesRuntime.getDependenciesRuntime).mockReturnValue({ postgres: null, redis: null, rabbitmq: null });
      await expect(ticketEventsService.checkTicketEventHasHoldsOrOrders('1')).rejects.toThrow('Postgres not available');
    });

    it('returns true or false from repository', async () => {
      vi.mocked(mockRepository.hasHoldsOrOrders).mockResolvedValue(true);
      vi.mocked(dependenciesRuntime.getDependenciesRuntime).mockReturnValue({ postgres: {} as PostgresRuntime, redis: null, rabbitmq: null });
      const result = await ticketEventsService.checkTicketEventHasHoldsOrOrders('1');
      expect(result).toBe(true);
    });
  });
});