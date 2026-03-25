import { getDependenciesRuntime } from '../lib/dependencies-runtime';
import { createAdminStatsRepository } from '../repositories/admin-stats-repository';
import { getCache, setCache } from '../lib/redis-cache';
import { logger } from '../lib/logger';
import type {
  RevenueByDay,
  TicketStats,
  TicketTypeFilter,
  TicketEventFilter,
} from '../repositories/admin-stats-repository';

export interface AdminStatsOverviewResponse {
  totalRevenue: number;
  orderCount: number;
  avgOrderValue: number;
  ticketsSold: number;
  revenueByDay: RevenueByDay[];
}

export interface AdminStatsTopSellingResponse {
  items: TicketStats[];
}

export interface AdminStatsLeastSellingResponse {
  items: TicketStats[];
}

export interface AdminFiltersTicketTypesResponse {
  items: TicketTypeFilter[];
}

export interface AdminFiltersTicketEventsResponse {
  items: TicketEventFilter[];
}

function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

function parseDateRange(dateRange?: string): { startDate: Date; endDate: Date } {
  const now = new Date();
  const today = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));

  switch (dateRange) {
    case 'today': {
      return { startDate: today, endDate: new Date(today.getTime() + 24 * 60 * 60 * 1000 - 1) };
    }
    case 'week': {
      const weekStart = new Date(today.getTime() - today.getUTCDay() * 24 * 60 * 60 * 1000);
      return { startDate: weekStart, endDate: new Date(weekStart.getTime() + 7 * 24 * 60 * 60 * 1000 - 1) };
    }
    case 'month': {
      const monthStart = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));
      return { startDate: monthStart, endDate: new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + 1, 1) - 1) };
    }
    case '30days':
    default: {
      const thirtyDaysAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
      return { startDate: thirtyDaysAgo, endDate: new Date(today.getTime() + 24 * 60 * 60 * 1000 - 1) };
    }
  }
}

export async function getAdminStatsOverview(params: {
  dateRange?: string;
  startDate?: string;
  endDate?: string;
  ticketTypeId?: string;
  ticketEventId?: string;
}): Promise<AdminStatsOverviewResponse> {
  const runtime = getDependenciesRuntime();

  // Parse date range
  let startDate: Date;
  let endDate: Date;

  if (params.startDate && params.endDate) {
    startDate = new Date(params.startDate + 'T00:00:00Z');
    endDate = new Date(params.endDate + 'T23:59:59Z');
  } else {
    const range = parseDateRange(params.dateRange);
    startDate = range.startDate;
    endDate = range.endDate;
  }

  const cacheKey = `admin:stats:overview:${formatDate(startDate)}:${formatDate(endDate)}:${params.ticketTypeId || 'all'}:${params.ticketEventId || 'all'}`;

  // Try cache first
  if (runtime.redis) {
    const cached = await getCache<AdminStatsOverviewResponse>(cacheKey);
    if (cached) {
      return cached;
    }
  }

  if (!runtime.postgres) {
    logger.warn('No Postgres, returning empty stats');
    const emptyResponse: AdminStatsOverviewResponse = {
      totalRevenue: 0,
      orderCount: 0,
      avgOrderValue: 0,
      ticketsSold: 0,
      revenueByDay: [],
    };
    return emptyResponse;
  }

  try {
    const repository = createAdminStatsRepository(runtime.postgres);

    if (!repository) {
      logger.warn('No repository, returning empty stats');
      const emptyResponse: AdminStatsOverviewResponse = {
        totalRevenue: 0,
        orderCount: 0,
        avgOrderValue: 0,
        ticketsSold: 0,
        revenueByDay: [],
      };
      return emptyResponse;
    }

    const [overviewStats, revenueByDay] = await Promise.all([
      repository.getOverviewStats({
        startDate,
        endDate,
        ticketTypeId: params.ticketTypeId,
        ticketEventId: params.ticketEventId,
      }),
      repository.getRevenueByDay({
        startDate,
        endDate,
        ticketTypeId: params.ticketTypeId,
        ticketEventId: params.ticketEventId,
      }),
    ]);

    const response: AdminStatsOverviewResponse = {
      ...overviewStats,
      revenueByDay,
    };

    // Cache for 5 minutes
    if (runtime.redis) {
      await setCache(cacheKey, response, 300);
    }

    return response;
  } catch (error) {
    logger.error('Failed to get admin stats overview', error);
    const emptyResponse: AdminStatsOverviewResponse = {
      totalRevenue: 0,
      orderCount: 0,
      avgOrderValue: 0,
      ticketsSold: 0,
      revenueByDay: [],
    };
    return emptyResponse;
  }
}

export async function getAdminStatsTopSelling(params: {
  dateRange?: string;
  startDate?: string;
  endDate?: string;
  ticketTypeId?: string;
  limit?: number;
}): Promise<AdminStatsTopSellingResponse> {
  const runtime = getDependenciesRuntime();

  // Parse date range
  let startDate: Date;
  let endDate: Date;

  if (params.startDate && params.endDate) {
    startDate = new Date(params.startDate);
    endDate = new Date(params.endDate);
  } else {
    const range = parseDateRange(params.dateRange);
    startDate = range.startDate;
    endDate = range.endDate;
  }

  const limit = params.limit || 10;
  const cacheKey = `admin:stats:top-selling:${formatDate(startDate)}:${formatDate(endDate)}:${params.ticketTypeId || 'all'}:${limit}`;

  // Try cache first
  if (runtime.redis) {
    const cached = await getCache<AdminStatsTopSellingResponse>(cacheKey);
    if (cached) {
      return cached;
    }
  }

  if (!runtime.postgres) {
    logger.warn('No Postgres, returning empty top selling');
    return { items: [] };
  }

  try {
    const repository = createAdminStatsRepository(runtime.postgres);

    if (!repository) {
      logger.warn('No repository, returning empty top selling');
      return { items: [] };
    }

    const items = await repository.getTopSellingTickets({
      startDate,
      endDate,
      ticketTypeId: params.ticketTypeId,
      limit,
    });

    const response: AdminStatsTopSellingResponse = { items };

    // Cache for 5 minutes
    if (runtime.redis) {
      await setCache(cacheKey, response, 300);
    }

    return response;
  } catch (error) {
    logger.error('Failed to get admin stats top selling', error);
    return { items: [] };
  }
}

export async function getAdminStatsLeastSelling(params: {
  dateRange?: string;
  startDate?: string;
  endDate?: string;
  ticketTypeId?: string;
  limit?: number;
}): Promise<AdminStatsLeastSellingResponse> {
  const runtime = getDependenciesRuntime();

  // Parse date range
  let startDate: Date;
  let endDate: Date;

  if (params.startDate && params.endDate) {
    startDate = new Date(params.startDate);
    endDate = new Date(params.endDate);
  } else {
    const range = parseDateRange(params.dateRange);
    startDate = range.startDate;
    endDate = range.endDate;
  }

  const limit = params.limit || 10;
  const cacheKey = `admin:stats:least-selling:${formatDate(startDate)}:${formatDate(endDate)}:${params.ticketTypeId || 'all'}:${limit}`;

  // Try cache first
  if (runtime.redis) {
    const cached = await getCache<AdminStatsLeastSellingResponse>(cacheKey);
    if (cached) {
      return cached;
    }
  }

  if (!runtime.postgres) {
    logger.warn('No Postgres, returning empty least selling');
    return { items: [] };
  }

  try {
    const repository = createAdminStatsRepository(runtime.postgres);

    if (!repository) {
      logger.warn('No repository, returning empty least selling');
      return { items: [] };
    }

    const items = await repository.getLeastSellingTickets({
      startDate,
      endDate,
      ticketTypeId: params.ticketTypeId,
      limit,
    });

    const response: AdminStatsLeastSellingResponse = { items };

    // Cache for 5 minutes
    if (runtime.redis) {
      await setCache(cacheKey, response, 300);
    }

    return response;
  } catch (error) {
    logger.error('Failed to get admin stats least selling', error);
    return { items: [] };
  }
}

export async function getAdminFiltersTicketTypes(): Promise<AdminFiltersTicketTypesResponse> {
  const runtime = getDependenciesRuntime();
  const cacheKey = 'admin:filters:ticket-types';

  // Try cache first
  if (runtime.redis) {
    const cached = await getCache<AdminFiltersTicketTypesResponse>(cacheKey);
    if (cached) {
      return cached;
    }
  }

  if (!runtime.postgres) {
    logger.warn('No Postgres, returning empty ticket types');
    return { items: [] };
  }

  try {
    const repository = createAdminStatsRepository(runtime.postgres);

    if (!repository) {
      logger.warn('No repository, returning empty ticket types');
      return { items: [] };
    }

    const items = await repository.getTicketTypes();
    const response: AdminFiltersTicketTypesResponse = { items };

    // Cache for 1 hour
    if (runtime.redis) {
      await setCache(cacheKey, response, 3600);
    }

    return response;
  } catch (error) {
    logger.error('Failed to get admin filters ticket types', error);
    return { items: [] };
  }
}

export async function getAdminFiltersTicketEvents(ticketTypeId?: string): Promise<AdminFiltersTicketEventsResponse> {
  const runtime = getDependenciesRuntime();
  const cacheKey = `admin:filters:ticket-events:${ticketTypeId || 'all'}`;

  // Try cache first
  if (runtime.redis) {
    const cached = await getCache<AdminFiltersTicketEventsResponse>(cacheKey);
    if (cached) {
      return cached;
    }
  }

  if (!runtime.postgres) {
    logger.warn('No Postgres, returning empty ticket events');
    return { items: [] };
  }

  try {
    const repository = createAdminStatsRepository(runtime.postgres);

    if (!repository) {
      logger.warn('No repository, returning empty ticket events');
      return { items: [] };
    }

    const items = await repository.getTicketEvents(ticketTypeId);
    const response: AdminFiltersTicketEventsResponse = { items };

    // Cache for 1 hour
    if (runtime.redis) {
      await setCache(cacheKey, response, 3600);
    }

    return response;
  } catch (error) {
    logger.error('Failed to get admin filters ticket events', error);
    return { items: [] };
  }
}