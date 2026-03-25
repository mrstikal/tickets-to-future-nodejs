import { getDependenciesRuntime } from '../lib/dependencies-runtime';
import { createTicketEventsRepository } from '../repositories/ticket-events-repository';
import { validatePositiveInteger } from '../lib/validators';
import type { TicketEvent } from '../types/domain';

export interface PaginatedTicketEvents {
  items: TicketEvent[];
  meta: {
    total: number;
    page: number;
    limit: number;
    hasMore: boolean;
  };
}

export async function listTicketEvents(
  page: number = 1,
  limit: number = 20,
  ticketTypeId?: string
): Promise<PaginatedTicketEvents> {
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

  const repository = createTicketEventsRepository(runtime.postgres);

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

  const { items, total } = await repository.findAll(validLimit, offset, ticketTypeId);

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

export async function getTicketEvent(id: string): Promise<TicketEvent | null> {
  const runtime = getDependenciesRuntime();

  if (!runtime.postgres) {
    return null;
  }

  const repository = createTicketEventsRepository(runtime.postgres);

  if (!repository) {
    return null;
  }

  return await repository.findById(id);
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
  imageAssetId: string;
}): Promise<TicketEvent> {
  const runtime = getDependenciesRuntime();

  if (!runtime.postgres) {
    throw new Error('Postgres not available');
  }

  const repository = createTicketEventsRepository(runtime.postgres);

  if (!repository) {
    throw new Error('Repository not available');
  }

  // Additional validation can be added here

  return await repository.create(data);
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
    imageAssetId?: string;
  }
): Promise<TicketEvent | null> {
  const runtime = getDependenciesRuntime();

  if (!runtime.postgres) {
    throw new Error('Postgres not available');
  }

  const repository = createTicketEventsRepository(runtime.postgres);

  if (!repository) {
    throw new Error('Repository not available');
  }

  return await repository.update(id, data);
}

export async function deleteTicketEvent(id: string): Promise<boolean> {
  const runtime = getDependenciesRuntime();

  if (!runtime.postgres) {
    throw new Error('Postgres not available');
  }

  const repository = createTicketEventsRepository(runtime.postgres);

  if (!repository) {
    throw new Error('Repository not available');
  }

  return await repository.delete(id);
}

export async function forceDeleteTicketEvent(id: string): Promise<boolean> {
  const runtime = getDependenciesRuntime();

  if (!runtime.postgres) {
    throw new Error('Postgres not available');
  }

  const repository = createTicketEventsRepository(runtime.postgres);

  if (!repository) {
    throw new Error('Repository not available');
  }

  return await repository.forceDelete(id);
}

export async function checkTicketEventHasHoldsOrOrders(id: string): Promise<boolean> {
  const runtime = getDependenciesRuntime();

  if (!runtime.postgres) {
    throw new Error('Postgres not available');
  }

  const repository = createTicketEventsRepository(runtime.postgres);

  if (!repository) {
    throw new Error('Repository not available');
  }

  return await repository.hasHoldsOrOrders(id);
}