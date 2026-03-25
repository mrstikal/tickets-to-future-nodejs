import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as dependenciesRuntime from '../lib/dependencies-runtime';
import * as ticketTypesRepositoryModule from '../repositories/ticket-types-repository';
import * as ticketTypesService from '../services/ticket-types-service';
import type { PostgresRuntime } from '../types/runtime';

vi.mock('../lib/dependencies-runtime');
vi.mock('../repositories/ticket-types-repository');

describe('ticket-types-service', () => {
  let mockRepository: NonNullable<ReturnType<typeof ticketTypesRepositoryModule.createTicketTypesRepository>>;

  beforeEach(() => {
    mockRepository = {
      findAll: vi.fn(),
      hasEvents: vi.fn(),
      findById: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      forceDelete: vi.fn(),
    };
    vi.mocked(ticketTypesRepositoryModule.createTicketTypesRepository).mockReturnValue(mockRepository);
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('listTicketTypes', () => {
    it('returns empty result if postgres not available', async () => {
      vi.mocked(dependenciesRuntime.getDependenciesRuntime).mockReturnValue({ postgres: null, redis: null, rabbitmq: null });
      const result = await ticketTypesService.listTicketTypes();
      expect(result.items).toEqual([]);
      expect(result.meta.total).toBe(0);
    });

    it('returns paginated ticket types', async () => {
      const items = [{ id: '1', title: 'Test', description: 'desc', isActive: true, imageAssetId: 'img1', totalQuantity: 10, soldQuantity: 5, createdAt: '', updatedAt: '' }];
      vi.mocked(mockRepository.findAll).mockResolvedValue({ items, total: 1 });
      vi.mocked(dependenciesRuntime.getDependenciesRuntime).mockReturnValue({ postgres: {} as PostgresRuntime, redis: null, rabbitmq: null });
      const result = await ticketTypesService.listTicketTypes(1, 10);
      expect(mockRepository.findAll).toHaveBeenCalledWith(10, 0);
      expect(result.items).toEqual(items);
      expect(result.meta.total).toBe(1);
      expect(result.meta.page).toBe(1);
      expect(result.meta.limit).toBe(10);
      expect(result.meta.hasMore).toBe(false);
    });
  });

  describe('checkTicketTypeHasEvents', () => {
    it('throws if postgres not available', async () => {
      vi.mocked(dependenciesRuntime.getDependenciesRuntime).mockReturnValue({ postgres: null, redis: null, rabbitmq: null });
      await expect(ticketTypesService.checkTicketTypeHasEvents('1')).rejects.toThrow('Postgres not available');
    });

    it('returns true or false from repository', async () => {
      vi.mocked(mockRepository.hasEvents).mockResolvedValue(true);
      vi.mocked(dependenciesRuntime.getDependenciesRuntime).mockReturnValue({ postgres: {} as PostgresRuntime, redis: null, rabbitmq: null });
      const result = await ticketTypesService.checkTicketTypeHasEvents('1');
      expect(result).toBe(true);
    });
  });

  describe('getTicketType', () => {
    it('returns null if postgres not available', async () => {
      vi.mocked(dependenciesRuntime.getDependenciesRuntime).mockReturnValue({ postgres: null, redis: null, rabbitmq: null });
      const result = await ticketTypesService.getTicketType('1');
      expect(result).toBeNull();
    });

    it('returns ticket type from repository', async () => {
      const ticketType = { id: '1', title: 'Test', description: '', isActive: true, imageAssetId: 'img1', totalQuantity: 10, soldQuantity: 5, createdAt: '', updatedAt: '' };
      vi.mocked(mockRepository.findById).mockResolvedValue(ticketType);
      vi.mocked(dependenciesRuntime.getDependenciesRuntime).mockReturnValue({ postgres: {} as PostgresRuntime, redis: null, rabbitmq: null });
      const result = await ticketTypesService.getTicketType('1');
      expect(result).toEqual(ticketType);
    });
  });

  describe('createTicketType', () => {
    it('throws if postgres not available', async () => {
      vi.mocked(dependenciesRuntime.getDependenciesRuntime).mockReturnValue({ postgres: null, redis: null, rabbitmq: null });
      await expect(ticketTypesService.createTicketType({ title: '', description: '', isActive: true, imageAssetId: '', totalQuantity: 0, soldQuantity: 0 })).rejects.toThrow('Postgres not available');
    });

    it('calls repository create and returns result', async () => {
      const data = { title: 'New', description: 'desc', isActive: true, imageAssetId: 'img1', totalQuantity: 10, soldQuantity: 0 };
      const created = { id: '1', ...data, createdAt: '', updatedAt: '' };
      vi.mocked(mockRepository.create).mockResolvedValue(created);
      vi.mocked(dependenciesRuntime.getDependenciesRuntime).mockReturnValue({ postgres: {} as PostgresRuntime, redis: null, rabbitmq: null });
      const result = await ticketTypesService.createTicketType(data);
      expect(mockRepository.create).toHaveBeenCalledWith(data);
      expect(result).toEqual(created);
    });
  });

  describe('updateTicketType', () => {
    it('throws if postgres not available', async () => {
      vi.mocked(dependenciesRuntime.getDependenciesRuntime).mockReturnValue({ postgres: null, redis: null, rabbitmq: null });
      await expect(ticketTypesService.updateTicketType('1', {})).rejects.toThrow('Postgres not available');
    });

    it('calls repository update and returns result', async () => {
      const updated = { id: '1', title: 'Updated', description: '', isActive: true, imageAssetId: 'img1', totalQuantity: 10, soldQuantity: 5, createdAt: '', updatedAt: '' };
      vi.mocked(mockRepository.update).mockResolvedValue(updated);
      vi.mocked(dependenciesRuntime.getDependenciesRuntime).mockReturnValue({ postgres: {} as PostgresRuntime, redis: null, rabbitmq: null });
      const result = await ticketTypesService.updateTicketType('1', { title: 'Updated' });
      expect(mockRepository.update).toHaveBeenCalledWith('1', { title: 'Updated' });
      expect(result).toEqual(updated);
    });
  });

  describe('deleteTicketType', () => {
    it('throws if postgres not available', async () => {
      vi.mocked(dependenciesRuntime.getDependenciesRuntime).mockReturnValue({ postgres: null, redis: null, rabbitmq: null });
      await expect(ticketTypesService.deleteTicketType('1')).rejects.toThrow('Postgres not available');
    });

    it('calls repository delete and returns result', async () => {
      vi.mocked(mockRepository.delete).mockResolvedValue(true);
      vi.mocked(dependenciesRuntime.getDependenciesRuntime).mockReturnValue({ postgres: {} as PostgresRuntime, redis: null, rabbitmq: null });
      const result = await ticketTypesService.deleteTicketType('1');
      expect(mockRepository.delete).toHaveBeenCalledWith('1');
      expect(result).toBe(true);
    });
  });

  describe('forceDeleteTicketType', () => {
    it('throws if postgres not available', async () => {
      vi.mocked(dependenciesRuntime.getDependenciesRuntime).mockReturnValue({ postgres: null, redis: null, rabbitmq: null });
      await expect(ticketTypesService.forceDeleteTicketType('1')).rejects.toThrow('Postgres not available');
    });

    it('calls repository forceDelete and returns result', async () => {
      vi.mocked(mockRepository.forceDelete).mockResolvedValue(true);
      vi.mocked(dependenciesRuntime.getDependenciesRuntime).mockReturnValue({ postgres: {} as PostgresRuntime, redis: null, rabbitmq: null });
      const result = await ticketTypesService.forceDeleteTicketType('1');
      expect(mockRepository.forceDelete).toHaveBeenCalledWith('1');
      expect(result).toBe(true);
    });
  });
});