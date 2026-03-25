const { getTicketById, incrementSoldQuantity } = require('./demo-tickets');
const { getHoldRecordById, confirmHold } = require('./demo-holds');
const { getWebsocketRuntime } = require('../websocket/websocket-runtime');

const orders = new Map();
let orderSequence = 1;

function createOrderId() {
  const id = String(orderSequence).padStart(4, '0');
  orderSequence += 1;
  return `o_${id}`;
}

function createOrderNumber() {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, '0');
  const day = String(now.getUTCDate()).padStart(2, '0');
  const seq = String(orderSequence).padStart(4, '0');

  return `ORD-${year}${month}${day}-${seq}`;
}

function toResponse(order) {
  return {
    id: order.id,
    orderNumber: order.orderNumber,
    status: order.status,
    email: order.email,
    currency: order.currency,
    totalPrice: order.totalPrice,
    items: order.items,
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
  };
}

function createOrder({ holdId, sessionId, email }) {
  const hold = getHoldRecordById(holdId);

  if (!hold) {
    return {
      error: {
        statusCode: 404,
        code: 'HOLD_NOT_FOUND',
        message: 'Hold was not found.',
      },
    };
  }

  if (hold.status !== 'active') {
    return {
      error: {
        statusCode: 409,
        code: 'HOLD_NOT_ACTIVE',
        message: 'Hold is not active.',
      },
    };
  }

  if (hold.sessionId !== sessionId) {
    return {
      error: {
        statusCode: 422,
        code: 'HOLD_SESSION_MISMATCH',
        message: 'Hold does not belong to the provided session.',
      },
    };
  }

  const ticket = getTicketById(hold.ticketId);

  if (!ticket) {
    return {
      error: {
        statusCode: 404,
        code: 'TICKET_NOT_FOUND',
        message: 'Ticket was not found.',
      },
    };
  }

  const confirmedHold = confirmHold(holdId);

  if (confirmedHold.error) {
    return {
      error: confirmedHold.error,
    };
  }

  const updatedTicket = incrementSoldQuantity(ticket.id, 1);
  const nowIso = new Date().toISOString();

  const order = {
    id: createOrderId(),
    orderNumber: createOrderNumber(),
    status: 'confirmed',
    email,
    currency: ticket.currency,
    totalPrice: ticket.price,
    items: [
      {
        ticketId: ticket.id,
        ticketTitle: ticket.title,
        quantity: 1,
        unitPrice: ticket.price,
        totalPrice: ticket.price,
      },
    ],
    createdAt: nowIso,
    updatedAt: nowIso,
  };

  orders.set(order.id, order);

  const websocketRuntime = getWebsocketRuntime();

  if (websocketRuntime) {
    websocketRuntime.broadcastOrderStatusUpdated(order);
    websocketRuntime.broadcastTicketAvailability(updatedTicket);
  }

  return {
    data: toResponse(order),
  };
}

function getOrderById(orderId) {
  const order = orders.get(orderId);

  if (!order) {
    return null;
  }

  return toResponse(order);
}

module.exports = {
  createOrder,
  getOrderById,
};