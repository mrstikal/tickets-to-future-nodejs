import type { IncomingMessage, ServerResponse } from 'node:http';
import { getDependenciesRuntime } from '../lib/dependencies-runtime';
import { sendJson } from '../lib/send-json';
import { logger } from '../lib/logger';
import { getAdminStatsOverview, getAdminStatsTopSelling, getAdminStatsLeastSelling, getAdminFiltersTicketTypes, getAdminFiltersTicketEvents } from '../services/admin-stats-service';

export async function getAdminStatsOverviewHandler(
  request: IncomingMessage,
  response: ServerResponse
): Promise<void> {
  try {
    const overview = await getAdminStatsOverview({});
    sendJson(response, 200, overview);
  } catch (error) {
    logger.error('Failed to get admin stats overview:', error);
    sendJson(response, 500, { error: { message: 'Failed to get admin stats overview' } });
  }
}

export async function getAdminStatsTopSellingHandler(
  request: IncomingMessage,
  response: ServerResponse
): Promise<void> {
  try {
    const url = new URL(request.url || '/', 'http://localhost');
    const startDate = url.searchParams.get('startDate') || undefined;
    const endDate = url.searchParams.get('endDate') || undefined;
    const ticketTypeId = url.searchParams.get('ticketTypeId') || undefined;
    const limitParam = url.searchParams.get('limit');
    const limit = limitParam ? parseInt(limitParam, 10) : undefined;

    const topSelling = await getAdminStatsTopSelling({
      startDate,
      endDate,
      ticketTypeId,
      limit,
    });
    sendJson(response, 200, topSelling);
  } catch (error) {
    logger.error('Failed to get admin top selling stats:', error);
    sendJson(response, 500, { error: { message: 'Failed to get admin top selling stats' } });
  }
}

export async function getAdminStatsLeastSellingHandler(
  request: IncomingMessage,
  response: ServerResponse
): Promise<void> {
  try {
    const url = new URL(request.url || '/', 'http://localhost');
    const startDate = url.searchParams.get('startDate') || undefined;
    const endDate = url.searchParams.get('endDate') || undefined;
    const ticketTypeId = url.searchParams.get('ticketTypeId') || undefined;
    const limitParam = url.searchParams.get('limit');
    const limit = limitParam ? parseInt(limitParam, 10) : undefined;

    const leastSelling = await getAdminStatsLeastSelling({
      startDate,
      endDate,
      ticketTypeId,
      limit,
    });
    sendJson(response, 200, leastSelling);
  } catch (error) {
    logger.error('Failed to get admin least selling stats:', error);
    sendJson(response, 500, { error: { message: 'Failed to get admin least selling stats' } });
  }
}

export async function getAdminFiltersTicketTypesHandler(
  request: IncomingMessage,
  response: ServerResponse
): Promise<void> {
  try {
    const ticketTypes = await getAdminFiltersTicketTypes();
    sendJson(response, 200, ticketTypes);
  } catch (error) {
    logger.error('Failed to get admin ticket types:', error);
    sendJson(response, 500, { error: { message: 'Failed to get admin ticket types' } });
  }
}

export async function getAdminFiltersTicketEventsHandler(
  request: IncomingMessage,
  response: ServerResponse
): Promise<void> {
  try {
    const ticketEvents = await getAdminFiltersTicketEvents();
    sendJson(response, 200, ticketEvents);
  } catch (error) {
    logger.error('Failed to get admin ticket events:', error);
    sendJson(response, 500, { error: { message: 'Failed to get admin ticket events' } });
  }
}

export async function resetLoginLimit(
  request: IncomingMessage,
  response: ServerResponse
): Promise<void> {
  const runtime = getDependenciesRuntime();

  if (!runtime.redis) {
    sendJson(response, 500, {
      error: { message: 'Redis not available' }
    });
    return;
  }

  const url = new URL(request.url || '/', 'http://localhost');
  const ip = url.searchParams.get('ip');

  if (!ip) {
    sendJson(response, 400, {
      error: { message: 'IP address is required' }
    });
    return;
  }

  const key = `ratelimit:auth-login:${ip}`;

  try {
    await runtime.redis.client.del(key);
    sendJson(response, 200, {
      message: `Login rate limit reset for IP ${ip}`
    });
  } catch (error) {
    logger.error('Failed to reset login limit:', error);
    sendJson(response, 500, {
      error: { message: 'Failed to reset login limit' }
    });
  }
}