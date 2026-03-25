const {
  getTicketById,
  incrementActiveHolds,
  decrementActiveHolds,
} = require('./demo-tickets');
const { getWebsocketRuntime } = require('../websocket/websocket-runtime');

const HOLD_TTL_SECONDS = 30 * 60;
const holds = new Map();
let holdSequence = 1;

function createHoldId() {
  const id = String(holdSequence).padStart(4, '0');
  holdSequence += 1;
  return `h_${id}`;
}

function getNow() {
  return Date.now();
}

function toResponse(hold) {
  const ttlMs = Math.max(hold.expiresAtMs - getNow(), 0);

  return {
    id: hold.id,
    ticketId: hold.ticketId,
    sessionId: hold.sessionId,
    status: hold.status,
    expiresAt: new Date(hold.expiresAtMs).toISOString(),
    ttlSeconds: Math.ceil(ttlMs / 1000),
    createdAt: hold.createdAt,
    updatedAt: hold.updatedAt,
  };
}

function expireHold(holdId) {
  const hold = holds.get(holdId);

  if (!hold || hold.status !== 'active') {
    return;
  }

  hold.status = 'expired';
  hold.updatedAt = new Date().toISOString();
  clearTimeout(hold.timeoutId);
  hold.timeoutId = null;

  const ticket = decrementActiveHolds(hold.ticketId);
  const websocketRuntime = getWebsocketRuntime();

  if (websocketRuntime && ticket) {
    websocketRuntime.broadcastHoldExpired(hold);
    websocketRuntime.broadcastTicketAvailability(ticket);
  }
}

function createHold({ ticketId, sessionId }) {
  const ticket = getTicketById(ticketId);

  if (!ticket) {
    return {
      error: {
        statusCode: 404,
        code: 'TICKET_NOT_FOUND',
        message: 'Ticket was not found.',
      },
    };
  }

  if (!ticket.isActive) {
    return {
      error: {
        statusCode: 422,
        code: 'TICKET_NOT_ACTIVE',
        message: 'Ticket is not active.',
      },
    };
  }

  if (ticket.availableQuantity <= 0) {
    return {
      error: {
        statusCode: 409,
        code: 'TICKET_NOT_AVAILABLE',
        message: 'Ticket is not available.',
      },
    };
  }

  const holdId = createHoldId();
  const nowIso = new Date().toISOString();
  const expiresAtMs = getNow() + HOLD_TTL_SECONDS * 1000;

  const hold = {
    id: holdId,
    ticketId,
    sessionId,
    status: 'active',
    createdAt: nowIso,
    updatedAt: nowIso,
    expiresAtMs,
    timeoutId: null,
  };

  hold.timeoutId = setTimeout(() => {
    expireHold(hold.id);
  }, HOLD_TTL_SECONDS * 1000);

  holds.set(hold.id, hold);

  const updatedTicket = incrementActiveHolds(ticketId);
  const websocketRuntime = getWebsocketRuntime();

  if (websocketRuntime && updatedTicket) {
    websocketRuntime.broadcastTicketAvailability(updatedTicket);
  }

  return {
    data: toResponse(hold),
  };
}

function getHoldById(holdId) {
  const hold = holds.get(holdId);

  if (!hold) {
    return null;
  }

  return toResponse(hold);
}

function getHoldRecordById(holdId) {
  return holds.get(holdId) || null;
}

function cancelHold(holdId) {
  const hold = holds.get(holdId);

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

  hold.status = 'cancelled';
  hold.updatedAt = new Date().toISOString();

  if (hold.timeoutId) {
    clearTimeout(hold.timeoutId);
    hold.timeoutId = null;
  }

  const updatedTicket = decrementActiveHolds(hold.ticketId);
  const websocketRuntime = getWebsocketRuntime();

  if (websocketRuntime && updatedTicket) {
    websocketRuntime.broadcastTicketAvailability(updatedTicket);
  }

  return {
    data: toResponse(hold),
  };
}

function confirmHold(holdId) {
  const hold = holds.get(holdId);

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

  hold.status = 'confirmed';
  hold.updatedAt = new Date().toISOString();

  if (hold.timeoutId) {
    clearTimeout(hold.timeoutId);
    hold.timeoutId = null;
  }

  const updatedTicket = decrementActiveHolds(hold.ticketId);

  return {
    data: toResponse(hold),
    ticket: updatedTicket,
  };
}

module.exports = {
  HOLD_TTL_SECONDS,
  createHold,
  getHoldById,
  getHoldRecordById,
  cancelHold,
  confirmHold,
};