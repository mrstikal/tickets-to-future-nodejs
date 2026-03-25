import { getAllTickets, getTicketById } from '../data/demo-tickets';
import { getDependenciesRuntime } from '../lib/dependencies-runtime';
import { createTicketsRepository } from '../repositories/tickets-repository';
import { getCache, setCache, delCache } from '../lib/redis-cache';
import { logger } from '../lib/logger';
import type { Ticket } from '../types/domain';

export async function listTickets(): Promise<Ticket[]> {
  const runtime = getDependenciesRuntime();
  const cacheKey = 'tickets:list';

  if (runtime.redis) {
    const cached = await getCache<Ticket[]>(cacheKey);
    if (cached) {
      return cached;
    }
  }

  if (!runtime.postgres) {
    const demoTickets = getAllTickets();
    if (runtime.redis) {
      await setCache(cacheKey, demoTickets, 60);
    }
    return demoTickets;
  }

  try {
    const repository = createTicketsRepository(runtime.postgres);

    if (!repository) {
      const demoTickets = getAllTickets();
      if (runtime.redis) {
        await setCache(cacheKey, demoTickets, 60);
      }
      return demoTickets;
    }

    const tickets = await repository.findAll();

    if (tickets.length === 0) {
      const demoTickets = getAllTickets();
      if (runtime.redis) {
        await setCache(cacheKey, demoTickets, 60);
      }
      return demoTickets;
    }

    if (runtime.redis) {
      await setCache(cacheKey, tickets, 60);
    }

    return tickets;
  } catch (error) {
    logger.error('Failed to load tickets from Postgres, using demo data', error);
    const demoTickets = getAllTickets();
    if (runtime.redis) {
      await setCache(cacheKey, demoTickets, 60);
    }
    return demoTickets;
  }
}

export async function getTicketDetail(
  ticketId: string
): Promise<Ticket | null> {
  const runtime = getDependenciesRuntime();
  const cacheKey = `ticket:detail:${ticketId}`;

  if (runtime.redis) {
    const cached = await getCache<Ticket>(cacheKey);
    if (cached) {
      return cached;
    }
  }

  if (!runtime.postgres) {
    const demoTicket = getTicketById(ticketId);
    if (demoTicket && runtime.redis) {
      await setCache(cacheKey, demoTicket, 30);
    }
    return demoTicket;
  }

  try {
    const repository = createTicketsRepository(runtime.postgres);

    if (!repository) {
      const demoTicket = getTicketById(ticketId);
      if (demoTicket && runtime.redis) {
        await setCache(cacheKey, demoTicket, 30);
      }
      return demoTicket;
    }

    const ticket = await repository.findById(ticketId);

    if (!ticket) {
      const demoTicket = getTicketById(ticketId);
      if (demoTicket && runtime.redis) {
        await setCache(cacheKey, demoTicket, 30);
      }
      return demoTicket;
    }

    if (runtime.redis) {
      await setCache(cacheKey, ticket, 30);
    }

    return ticket;
  } catch (error) {
    logger.error(
      'Failed to load ticket detail from Postgres, using demo data',
      error
    );
    const demoTicket = getTicketById(ticketId);
    if (demoTicket && runtime.redis) {
      await setCache(cacheKey, demoTicket, 30);
    }
    return demoTicket;
  }
}

export interface EventsGroupsResponse {
  groups: Array<{
    periodStartYear: number;
    events: Ticket[];
    totalCount: number;
  }>;
}

export async function getEventsGroups(): Promise<EventsGroupsResponse> {
  const runtime = getDependenciesRuntime();
  const cacheKey = 'events:groups';

  // Clear old cache format (temporary fix for cache inconsistency)
  if (runtime.redis) {
    await delCache(cacheKey);
  }

  if (runtime.redis) {
    const cached = await getCache<EventsGroupsResponse>(cacheKey);
    if (cached) {
      return cached;
    }
  }

  if (!runtime.postgres) {
    logger.info('No Postgres, returning empty groups');
    const emptyGroups: EventsGroupsResponse = { groups: [] };
    if (runtime.redis) {
      await setCache(cacheKey, emptyGroups, 60);
    }
    return emptyGroups;
  }

  try {
    const repository = createTicketsRepository(runtime.postgres);

    if (!repository) {
      logger.info('No repository, returning empty groups');
      const emptyGroups: EventsGroupsResponse = { groups: [] };
      if (runtime.redis) {
        await setCache(cacheKey, emptyGroups, 60);
      }
      return emptyGroups;
    }

    const groupsResponse = await repository.getGroupedPreviews();
    const result = { groups: groupsResponse || [] };

    if (runtime.redis) {
      await setCache(cacheKey, result, 60);
    }

    return result;
  } catch (error) {
    logger.error('Failed to load events groups from Postgres', error);
    const emptyGroups: EventsGroupsResponse = { groups: [] };
    if (runtime.redis) {
      await setCache(cacheKey, emptyGroups, 60);
    }
    return emptyGroups;
  }
}

export interface EventsPaginatedResponse {
  items: Ticket[];
  meta: {
    total: number;
    page: number;
    limit: number;
    hasMore: boolean;
  };
}

export async function getEventsByDateRange(
  startYear: number,
  endYear: number,
  page: number = 1,
  limit: number = 20
): Promise<EventsPaginatedResponse> {
  const runtime = getDependenciesRuntime();
  const cacheKey = `events:range:${startYear}-${endYear}:p${page}:l${limit}`;

  if (runtime.redis) {
    const cached = await getCache<EventsPaginatedResponse>(cacheKey);
    if (cached) {
      return cached;
    }
  }

  if (!runtime.postgres) {
    logger.info('No Postgres, returning empty paginated events');
    const emptyResponse: EventsPaginatedResponse = {
      items: [],
      meta: { total: 0, page, limit, hasMore: false }
    };
    if (runtime.redis) {
      await setCache(cacheKey, emptyResponse, 60);
    }
    return emptyResponse;
  }

  try {
    const repository = createTicketsRepository(runtime.postgres);

    if (!repository) {
      logger.info('No repository, returning empty paginated events');
      const emptyResponse: EventsPaginatedResponse = {
        items: [],
        meta: { total: 0, page, limit, hasMore: false }
      };
      if (runtime.redis) {
        await setCache(cacheKey, emptyResponse, 60);
      }
      return emptyResponse;
    }

    const startDate = new Date(`${startYear}-01-01T00:00:00Z`);
    const endDate = new Date(endYear + 1, 0, 1, 0, 0, 0, 0); // Start of next period

    const { items, total } = await repository.findByDateRange(startDate, endDate, limit, (page - 1) * limit);

    const response: EventsPaginatedResponse = {
      items,
      meta: {
        total,
        page,
        limit,
        hasMore: total > page * limit
      }
    };

    if (runtime.redis) {
      await setCache(cacheKey, response, 60);
    }

    return response;
  } catch (error) {
    logger.error('Failed to load paginated events from Postgres', error);
    const emptyResponse: EventsPaginatedResponse = {
      items: [],
      meta: { total: 0, page, limit, hasMore: false }
    };
    if (runtime.redis) {
      await setCache(cacheKey, emptyResponse, 60);
    }
    return emptyResponse;
  }
}
