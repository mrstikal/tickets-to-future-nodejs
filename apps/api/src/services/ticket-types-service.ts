import { getDependenciesRuntime } from '../lib/dependencies-runtime';
import { createTicketTypesRepository } from '../repositories/ticket-types-repository';
import { validatePositiveInteger } from '../lib/validators';
import type { TicketType } from '../types/domain';

export interface PaginatedTicketTypes {
  items: TicketType[];
  meta: {
    total: number;
    page: number;
    limit: number;
    hasMore: boolean;
  };
}

export async function listTicketTypes(page: number = 1, limit: number = 20): Promise<PaginatedTicketTypes> {
  const runtime = getDependenciesRuntime();

  if (!runtime.postgres) {
    return {
      items: [],
      meta: {
        total: 0,
        page: page,
        limit: limit,
        hasMore: false,
      },
    };
  }

  const repository = createTicketTypesRepository(runtime.postgres);

  if (!repository) {
    return {
      items: [],
      meta: {
        total: 0,
        page: page,
        limit: limit,
        hasMore: false,
      },
    };
  }

  // Validate page and limit
  const validPage = validatePositiveInteger(page) ?? 1;
  const validLimit = validatePositiveInteger(limit) ?? 20;

  const offset = (validPage - 1) * validLimit;

  const { items, total } = await repository.findAll(validLimit, offset);

  return {
    items,
    meta: {
      total: total,
      page: validPage,
      limit: validLimit,
      hasMore: total > validPage * validLimit,
    },
  };
}

export async function checkTicketTypeHasEvents(id: string): Promise<boolean> {
  const runtime = getDependenciesRuntime();

  if (!runtime.postgres) {
    throw new Error('Postgres not available');
  }

  const repository = createTicketTypesRepository(runtime.postgres);

  if (!repository) {
    throw new Error('Repository not available');
  }

  return await repository.hasEvents(id);
}

export async function getTicketType(id: string): Promise<TicketType | null> {
  const runtime = getDependenciesRuntime();

  if (!runtime.postgres) {
    return null;
  }

  const repository = createTicketTypesRepository(runtime.postgres);

  if (!repository) {
    return null;
  }

  return await repository.findById(id);
}

export async function createTicketType(data: {
  title: string;
  description: string;
  isActive: boolean;
  imageAssetId: string;
  totalQuantity: number;
  soldQuantity: number;
}): Promise<TicketType> {
  const runtime = getDependenciesRuntime();

  if (!runtime.postgres) {
    throw new Error('Postgres not available');
  }

  const repository = createTicketTypesRepository(runtime.postgres);

  if (!repository) {
    throw new Error('Repository not available');
  }

  // Additional validation can be added here

  return await repository.create(data);
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
): Promise<TicketType | null> {
  const runtime = getDependenciesRuntime();

  if (!runtime.postgres) {
    throw new Error('Postgres not available');
  }

  const repository = createTicketTypesRepository(runtime.postgres);

  if (!repository) {
    throw new Error('Repository not available');
  }

  return await repository.update(id, data);
}

export async function deleteTicketType(id: string): Promise<boolean> {
  const runtime = getDependenciesRuntime();

  if (!runtime.postgres) {
    throw new Error('Postgres not available');
  }

  const repository = createTicketTypesRepository(runtime.postgres);

  if (!repository) {
    throw new Error('Repository not available');
  }

  return await repository.delete(id);
}

export async function forceDeleteTicketType(id: string): Promise<boolean> {
  const runtime = getDependenciesRuntime();

  if (!runtime.postgres) {
    throw new Error('Postgres not available');
  }

  const repository = createTicketTypesRepository(runtime.postgres);

  if (!repository) {
    throw new Error('Repository not available');
  }

  return await repository.forceDelete(id);
}
