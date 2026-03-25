import { getDependenciesRuntime } from '../lib/dependencies-runtime';
import { logger } from '../lib/logger';
import { createHoldsRepository } from '../repositories/holds-repository';
import { createOrdersRepository } from '../repositories/orders-repository';
import { createTicketsRepository } from '../repositories/tickets-repository';
import { getWebsocketRuntime } from '../websocket/websocket-runtime';
import { delCache, delCachePattern } from '../lib/redis-cache';
import { isValidUuid, validateEmail, validateSessionId } from '../lib/validators';
import type { CreateOrderInput, Order, ServiceResult, Hold } from '../types/domain';
import type { RawTicketRow } from '../repositories/tickets-repository';

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

function toNumber(value: unknown): number | null {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value === 'string') {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

async function publishOrderConfirmedEvent(order: Order): Promise<void> {
  const runtime = getDependenciesRuntime();
  const channel = runtime.rabbitmq?.getChannel();

  if (!channel) {
    return;
  }

  try {
    channel.publish(
      'tickets.events',
      'order.confirmed',
      Buffer.from(
        JSON.stringify({
          eventType: 'order.confirmed',
          orderId: order.id,
          orderNumber: order.orderNumber,
          email: order.email,
          items: order.items,
          totalPrice: order.totalPrice,
          currency: order.currency,
          occurredAt: new Date().toISOString(),
        })
      )
    );
  } catch (error) {
    logger.error('Failed to publish order.confirmed event', error);
  }
}

export async function createOrder(
  input: CreateOrderInput
): Promise<ServiceResult<Order>> {
  // Input validation
  if (!input.holdIds || !input.holdIds.length) {
    return createValidationError(400, 'INVALID_HOLD_IDS', 'holdIds array is required and must not be empty.');
  }
  for (const holdId of input.holdIds) {
    if (!isValidUuid(holdId)) {
      return createValidationError(400, 'INVALID_HOLD_ID', 'Invalid hold ID format.');
    }
  }
  if (!validateEmail(input.email)) {
    return createValidationError(400, 'INVALID_EMAIL', 'Invalid email format.');
  }
  if (!input.name || !input.name.trim()) {
    return createValidationError(400, 'INVALID_NAME', 'Name is required.');
  }
  if (!validateSessionId(input.sessionId)) {
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
  const ticketsRepository = createTicketsRepository(runtime.postgres);
  const ordersRepository = createOrdersRepository(runtime.postgres);

  if (!holdsRepository || !ticketsRepository || !ordersRepository) {
    return createValidationError(
      503,
      'POSTGRES_NOT_AVAILABLE',
      'Postgres is not available.'
    );
  }

    const client = await runtime.postgres.pool.connect();

  try {
    const holdsResults = await Promise.all(input.holdIds.map(id => holdsRepository.findById(id)));

    // Group holds by ticketId
    const holdsByTicketId = new Map<string, Hold[]>();
    const ticketMap = new Map<string, RawTicketRow>();
    let totalPrice = 0;

    for (const hold of holdsResults) {
      if (!hold) {
        return createValidationError(404, 'HOLD_NOT_FOUND', 'Hold not found.');
      }

      // Type guard: after the check above, hold is not null
      if (hold.status !== 'active') {
        return createValidationError(409, 'HOLD_NOT_ACTIVE', 'Hold not active.');
      }

      if (hold.sessionId !== input.sessionId) {
        return createValidationError(422, 'HOLD_SESSION_MISMATCH', 'Hold session mismatch.');
      }

      if (new Date(hold.expiresAt).getTime() <= Date.now()) {
        holdsRepository.expireHold(hold.id);
        return createValidationError(409, 'HOLD_NOT_ACTIVE', 'Hold expired.');
      }

      const ticket = await ticketsRepository.findRawById(hold.ticketId);

      if (!ticket) {
        return createValidationError(404, 'TICKET_NOT_FOUND', 'Ticket not found.');
      }

      if (!holdsByTicketId.has(ticket.id)) {
        holdsByTicketId.set(ticket.id, []);
        ticketMap.set(ticket.id, ticket);
      }
      holdsByTicketId.get(ticket.id)!.push(hold);

      const ticketPrice = toNumber(ticket.price);
      if (ticketPrice === null) {
        return createValidationError(500, 'INVALID_TICKET_PRICE', 'Invalid ticket price.');
      }
      totalPrice += ticketPrice;
    }

    // Apply 10% discount if user is authenticated
    const discountMultiplier = input.userId ? 0.9 : 1.0;
    const discountPercentage = input.userId ? 10 : 0;
    const discountedTotalPrice = Math.round(totalPrice * discountMultiplier * 100) / 100;

    await client.query('BEGIN');

    // Ensure ticketMap is not empty
    if (ticketMap.size === 0) {
      await client.query('ROLLBACK');
      return createValidationError(500, 'INTERNAL_ERROR', 'No tickets found for holds.');
    }

    const createdOrder = await ordersRepository.createOrder({
      email: input.email,
      name: input.name,
      referenceNumber: input.referenceNumber || null,
      status: 'confirmed',
      totalPrice: discountedTotalPrice,
      currency: ticketMap.values().next().value!.currency,
      discountPercentage,
    }, client);

    // Process each ticket group
    for (const [ticketId, holds] of holdsByTicketId.entries()) {
      const ticket = ticketMap.get(ticketId);
      if (!ticket) {
        await client.query('ROLLBACK');
        return createValidationError(500, 'INTERNAL_ERROR', 'Ticket not found in map.');
      }
      const quantity = holds.length;
      const unitPrice = toNumber(ticket.price);
      if (unitPrice === null) {
        await client.query('ROLLBACK');
        return createValidationError(500, 'INVALID_TICKET_PRICE', 'Invalid ticket price.');
      }
      const discountedUnitPrice = Math.round(unitPrice * discountMultiplier * 100) / 100;
      const totalPriceForTicket = Math.round(unitPrice * quantity * discountMultiplier * 100) / 100;

      // Confirm all holds for this ticket
      for (const hold of holds) {
        const confirmedHold = await holdsRepository.confirmHold(hold.id, client);
        if (!confirmedHold) {
          await client.query('ROLLBACK');
          return createValidationError(409, 'HOLD_NOT_ACTIVE', 'Hold not active.');
        }
      }

      // Create single order item for this ticket
      await ordersRepository.createOrderItem({
        orderId: createdOrder.id,
        ticketId,
        quantity,
        unitPrice: discountedUnitPrice,
        totalPrice: totalPriceForTicket,
      }, client);

      // Increment sold quantity by the total quantity for this ticket
      await ticketsRepository.incrementSoldQuantity(ticketId, quantity, client);
    }

    await client.query('COMMIT');

    const fullOrder = await ordersRepository.findById(createdOrder.id);

    if (!fullOrder) {
      return createValidationError(500, 'INTERNAL_ERROR', 'Internal server error.');
    }

    // Get all tickets from ticketMap for cache invalidation and websocket updates
    const tickets = Array.from(ticketMap.values());
    const updatedTickets = await Promise.all(tickets.map((t) => ticketsRepository.findById(t.id)));
    const websocketRuntime = getWebsocketRuntime();

    if (websocketRuntime) {
      websocketRuntime.broadcastOrderStatusUpdated(fullOrder);

      for (const ut of updatedTickets) {
        if (ut) {
          websocketRuntime.broadcastTicketAvailability(ut);
        }
      }

      // Broadcast hold updates for each confirmed hold so the cart badge refreshes
      for (const holds of holdsByTicketId.values()) {
        for (const hold of holds) {
          // Re-fetch the confirmed hold to get updated status
          const confirmedHold = await holdsRepository.findById(hold.id);
          if (confirmedHold) {
            websocketRuntime.broadcastHoldUpdate(input.sessionId, confirmedHold);
          }
        }
      }
    }

    // Cache invalidation
    for (const t of tickets) {
      await delCache(`ticket:detail:${t.id}`);
    }
    await delCache('tickets:list');
    await delCachePattern('events:*');

    await publishOrderConfirmedEvent(fullOrder);

    return { data: fullOrder };
  } catch (error) {
    try {
      await client.query('rollback');
    } catch {
      // no-op
    }

    logger.error('Failed to create order in Postgres', error);
    return createValidationError(500, 'INTERNAL_ERROR', 'Internal server error.');
  } finally {
    client.release();
  }
}

export async function getOrderById(
  orderId: string
): Promise<ServiceResult<Order>> {
  const runtime = getDependenciesRuntime();

  if (!runtime.postgres) {
    return createValidationError(
      503,
      'POSTGRES_NOT_AVAILABLE',
      'Postgres is not available.'
    );
  }

  const ordersRepository = createOrdersRepository(runtime.postgres);

  if (!ordersRepository) {
    return createValidationError(
      503,
      'POSTGRES_NOT_AVAILABLE',
      'Postgres is not available.'
    );
  }

  try {
    const order = await ordersRepository.findById(orderId);

    if (!order) {
      return createValidationError(404, 'ORDER_NOT_FOUND', 'Order was not found.');
    }

    return { data: order };
  } catch (error) {
    logger.error('Failed to load order from Postgres', error);
    return createValidationError(500, 'INTERNAL_ERROR', 'Internal server error.');
  }
}