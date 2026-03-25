import { getDependenciesRuntime } from '../lib/dependencies-runtime';
import { env } from '../config/env';
import { createHoldsRepository } from '../repositories/holds-repository';
import { createTicketsRepository } from '../repositories/tickets-repository';
import { getWebsocketRuntime } from '../websocket/websocket-runtime';
import { logger } from '../lib/logger';
import { delCache, delCachePattern } from '../lib/redis-cache';
import { isValidUuid, validateSessionId } from '../lib/validators';
import type { Hold, ServiceResult } from '../types/domain';

export const HOLD_TTL_SECONDS = env.holdTtlSeconds;

function createValidationError<T>(
  statusCode: number,
  code: string,
  message: string
): ServiceResult<T> {
  return {
    error: {
      statusCode,
      code,
      message,
    },
  };
}

async function publishHoldExpiredEvent(hold: Hold): Promise<void> {
  const runtime = getDependenciesRuntime();
  const channel = runtime.rabbitmq?.getChannel();

  if (!channel) {
    return;
  }

  try {
    channel.publish(
      'tickets.events',
      'hold.expired',
      Buffer.from(
        JSON.stringify({
          eventType: 'hold.expired',
          holdId: hold.id,
          ticketId: hold.ticketId,
          sessionId: hold.sessionId,
          occurredAt: new Date().toISOString(),
        })
      )
    );
  } catch (error) {
    logger.error('Failed to publish hold.expired event', error);
  }
}

export async function createHold(params: {
  ticketId: string;
  sessionId: string;
}): Promise<ServiceResult<Hold>> {
  // Input validation
  if (!isValidUuid(params.ticketId)) {
    return createValidationError(400, 'INVALID_TICKET_ID', 'Invalid ticket ID format.');
  }
  if (!validateSessionId(params.sessionId)) {
    return createValidationError(400, 'INVALID_SESSION_ID', 'Invalid session ID.');
  }

  const runtime = getDependenciesRuntime();

  if (!runtime.postgres) {
    return createValidationError(
      503,
      'POSTGRES_NOT_AVAILABLE',
      'Postgres is not available.'
    );
  }

  const ticketsRepository = createTicketsRepository(runtime.postgres);
  const holdsRepository = createHoldsRepository(runtime.postgres);

  if (!ticketsRepository || !holdsRepository) {
    return createValidationError(
      503,
      'POSTGRES_NOT_AVAILABLE',
      'Postgres is not available.'
    );
  }

  // Check hold limit per session (max 100 active)
  const activeHoldsForSession = await holdsRepository.findBySessionId(params.sessionId);
  if (activeHoldsForSession.length >= 100) {
    return createValidationError(
      409,
      'HOLD_LIMIT_EXCEEDED',
      'Maximum 100 active holds per session reached.'
    );
  }

    const client = await runtime.postgres.pool.connect();

  try {
    await client.query('BEGIN');

    await holdsRepository.expireActiveHoldsForTicket(params.ticketId, client);

    const ticket = await ticketsRepository.findRawByIdForUpdate(params.ticketId, client);

    if (!ticket) {
      await client.query('ROLLBACK');
      return createValidationError(404, 'TICKET_NOT_FOUND', 'Ticket was not found.');
    }

    if (!ticket.is_active) {
      await client.query('ROLLBACK');
      return createValidationError(422, 'TICKET_NOT_ACTIVE', 'Ticket is not active.');
    }

    const activeHoldsCount = await holdsRepository.countActiveHoldsByTicketId(params.ticketId, client);

    const availableQuantity = ticket.total_quantity - ticket.sold_quantity - activeHoldsCount;

    if (availableQuantity <= 0) {
      await client.query('ROLLBACK');
      return createValidationError(
        409,
        'TICKET_NOT_AVAILABLE',
        'Ticket is not available.'
      );
    }

    const expiresAt = new Date(Date.now() + HOLD_TTL_SECONDS * 1000).toISOString();

    const hold = await holdsRepository.createHold({
      ticketId: params.ticketId,
      sessionId: params.sessionId,
      expiresAt,
    }, client);

    await client.query('COMMIT');

    // Cache invalidation
    await delCache('tickets:list');
    await delCache(`ticket:detail:${params.ticketId}`);
    await delCachePattern('events:*');

    const updatedTicket = await ticketsRepository.findById(params.ticketId);
    const websocketRuntime = getWebsocketRuntime();

    if (websocketRuntime && updatedTicket) {
      websocketRuntime.broadcastTicketAvailability(updatedTicket);
      websocketRuntime.broadcastHoldUpdate(params.sessionId, hold);
    }

    return { data: hold };
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch {
      // ignore
    }
    logger.error('Failed to create hold in Postgres', error);
    return createValidationError(500, 'INTERNAL_ERROR', 'Internal server error.');
  } finally {
    client.release();
  }
}

export async function getHoldById(
  holdId: string
): Promise<ServiceResult<Hold>> {
  if (!isValidUuid(holdId)) {
    return createValidationError(400, 'INVALID_HOLD_ID', 'Invalid hold ID format.');
  }

  const runtime = getDependenciesRuntime();

  if (!runtime.postgres) {
    return createValidationError(
      503,
      'POSTGRES_NOT_AVAILABLE',
      'Postgres is not available.'
    );
  }

  const holdsRepository = createHoldsRepository(runtime.postgres);
  const ticketsRepository = createTicketsRepository(runtime.postgres);
  const websocketRuntime = getWebsocketRuntime();

  if (!holdsRepository || !ticketsRepository) {
    return createValidationError(
      503,
      'POSTGRES_NOT_AVAILABLE',
      'Postgres is not available.'
    );
  }

  try {
    let hold = await holdsRepository.findById(holdId);

    if (!hold) {
      return createValidationError(404, 'HOLD_NOT_FOUND', 'Hold was not found.');
    }

    if (hold.status === 'active' && new Date(hold.expiresAt).getTime() <= Date.now()) {
      const expiredHold = await holdsRepository.expireHold(holdId);
      if (expiredHold) {
        await publishHoldExpiredEvent(expiredHold);
      }
      hold = expiredHold || (await holdsRepository.findById(holdId));

      if (!hold) {
        return createValidationError(404, 'HOLD_NOT_FOUND', 'Hold was not found.');
      }

      // Cache invalidation on expire
      await delCache('tickets:list');
      await delCache(`ticket:detail:${hold.ticketId}`);
      await delCachePattern('events:*');

      const updatedTicket = await ticketsRepository.findById(hold.ticketId);

      if (websocketRuntime) {
        websocketRuntime.broadcastHoldExpired(hold);

        if (updatedTicket) {
          websocketRuntime.broadcastTicketAvailability(updatedTicket);
        }
      }
    }

    return { data: hold };
  } catch (error) {
    logger.error('Failed to load hold from Postgres', error);
    return createValidationError(500, 'INTERNAL_ERROR', 'Internal server error.');
  }
}

export async function cancelHold(
  holdId: string
): Promise<ServiceResult<Hold>> {
  if (!isValidUuid(holdId)) {
    return createValidationError(400, 'INVALID_HOLD_ID', 'Invalid hold ID format.');
  }

  const runtime = getDependenciesRuntime();

  if (!runtime.postgres) {
    return createValidationError(
      503,
      'POSTGRES_NOT_AVAILABLE',
      'Postgres is not available.'
    );
  }

  const holdsRepository = createHoldsRepository(runtime.postgres);
  const ticketsRepository = createTicketsRepository(runtime.postgres);
  const websocketRuntime = getWebsocketRuntime();

  if (!holdsRepository || !ticketsRepository) {
    return createValidationError(
      503,
      'POSTGRES_NOT_AVAILABLE',
      'Postgres is not available.'
    );
  }

  try {
    const existingHold = await holdsRepository.findById(holdId);

    if (!existingHold) {
      return createValidationError(404, 'HOLD_NOT_FOUND', 'Hold was not found.');
    }

    if (
      existingHold.status === 'active' &&
      new Date(existingHold.expiresAt).getTime() <= Date.now()
    ) {
      const expiredHold = await holdsRepository.expireHold(holdId);
      if (expiredHold) {
        await publishHoldExpiredEvent(expiredHold);
      }
      const updatedTicket = await ticketsRepository.findById(existingHold.ticketId);

      if (websocketRuntime) {
        websocketRuntime.broadcastHoldExpired(expiredHold || existingHold);

        if (updatedTicket) {
          websocketRuntime.broadcastTicketAvailability(updatedTicket);
        }
      }

      return createValidationError(409, 'HOLD_NOT_ACTIVE', 'Hold is not active.');
    }

    if (existingHold.status !== 'active') {
      return createValidationError(409, 'HOLD_NOT_ACTIVE', 'Hold is not active.');
    }

    const cancelledHold = await holdsRepository.cancelHold(holdId);

    if (!cancelledHold) {
      return createValidationError(409, 'HOLD_NOT_ACTIVE', 'Hold is not active.');
    }

    // Cache invalidation
    await delCache('tickets:list');
    await delCache(`ticket:detail:${existingHold.ticketId}`);
    await delCachePattern('events:*');

    const updatedTicket = await ticketsRepository.findById(existingHold.ticketId);

    if (websocketRuntime && updatedTicket) {
      websocketRuntime.broadcastTicketAvailability(updatedTicket);
      websocketRuntime.broadcastHoldUpdate(existingHold.sessionId, cancelledHold);
    }

    return { data: cancelledHold };
  } catch (error) {
    logger.error('Failed to cancel hold in Postgres', error);
    return createValidationError(500, 'INTERNAL_ERROR', 'Internal server error.');
  }
}

export async function getHoldsBySessionId(
  sessionId: string
): Promise<ServiceResult<Hold[]>> {
  if (!validateSessionId(sessionId)) {
    return createValidationError(400, 'INVALID_SESSION_ID', 'Invalid session ID.');
  }

  const runtime = getDependenciesRuntime();

  if (!runtime.postgres) {
    return createValidationError(
      503,
      'POSTGRES_NOT_AVAILABLE',
      'Postgres is not available.'
    );
  }

  const holdsRepository = createHoldsRepository(runtime.postgres);

  if (!holdsRepository) {
    return createValidationError(
      503,
      'POSTGRES_NOT_AVAILABLE',
      'Postgres is not available.'
    );
  }

  try {
    const holds = await holdsRepository.findBySessionId(sessionId);

    return { data: holds };
  } catch (error) {
    logger.error('Failed to load holds by session from Postgres', error);
    return createValidationError(500, 'INTERNAL_ERROR', 'Internal server error.');
  }
}
