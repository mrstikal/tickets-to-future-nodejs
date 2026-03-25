function createHttpError(status, payload) {
  const message = payload?.error?.message || `HTTP ${status}`;
  const error = new Error(message);
  error.status = status;
  error.code = payload?.error?.code || 'HTTP_ERROR';
  error.payload = payload;
  return error;
}

async function requestJson(config, path, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), config.timeoutMs);

  try {
    const response = await fetch(`${config.apiBaseUrl}${path}`, {
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
      signal: controller.signal,
    });

    const payload = await response.json();

    if (!response.ok) {
      throw createHttpError(response.status, payload);
    }

    return payload;
  } finally {
    clearTimeout(timer);
  }
}

async function listTickets(config) {
  const payload = await requestJson(config, '/api/v1/tickets');
  return payload.items || [];
}

async function getTicket(config, ticketId) {
  return requestJson(config, `/api/v1/tickets/${ticketId}`);
}

async function createHold(config, body) {
  return requestJson(config, '/api/v1/holds', {
    method: 'POST',
    body,
  });
}

async function getHold(config, holdId) {
  return requestJson(config, `/api/v1/holds/${holdId}`);
}

async function cancelHold(config, holdId) {
  return requestJson(config, `/api/v1/holds/${holdId}`, {
    method: 'DELETE',
  });
}

async function createOrder(config, body) {
  return requestJson(config, '/api/v1/orders', {
    method: 'POST',
    body,
  });
}

async function getOrder(config, orderId) {
  return requestJson(config, `/api/v1/orders/${orderId}`);
}

function pickTicketForSale(tickets) {
  return tickets
    .filter((ticket) => ticket.isActive && ticket.availableQuantity > 0)
    .sort((a, b) => a.availableQuantity - b.availableQuantity)[0] || null;
}

module.exports = {
  listTickets,
  getTicket,
  createHold,
  getHold,
  cancelHold,
  createOrder,
  getOrder,
  pickTicketForSale,
  requestJson,
};

