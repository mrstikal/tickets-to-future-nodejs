const {
  listTickets,
  pickTicketForSale,
  createHold,
  createOrder,
  getOrder,
} = require('./shared/api');
const { createWsListener } = require('./shared/ws-listener');
const { createRabbitListener } = require('./shared/rabbit-listener');

async function runScenarioD(config) {
  console.log('\n=== Demo Scenario D: Async processing over RabbitMQ ===');

  const tickets = await listTickets(config);
  const target = pickTicketForSale(tickets);

  if (!target) {
    throw new Error('No sellable ticket found for scenario D.');
  }

  console.log(`Target ticket: ${target.id} (${target.title})`);

  const ws = await createWsListener(config, ['tickets', `ticket:${target.id}`]);
  const rabbit = await createRabbitListener(config, 'order.confirmed');

  try {
    const hold = await createHold(config, {
      ticketId: target.id,
      sessionId: `${config.sessionPrefix}-${Date.now()}-async`,
    });

    const order = await createOrder(config, {
      holdId: hold.id,
      sessionId: hold.sessionId,
      email: `async-demo@${config.emailDomain}`,
    });

    console.log(`Order created: ${order.id}`);

    const rabbitEvent = await rabbit.waitFor(
      (event) => event.eventType === 'order.confirmed' && event.orderId === order.id,
      config.timeoutMs
    );

    const wsEvent = await ws.waitFor(
      (event) => event.type === 'order.status.updated' && event.orderId === order.id,
      config.timeoutMs
    );

    const orderAfter = await getOrder(config, order.id);

    console.log(`RabbitMQ event received: ${rabbitEvent.eventType} for order ${rabbitEvent.orderId}`);
    console.log(`WebSocket event received: ${wsEvent.type} (${wsEvent.status})`);
    console.log(`Order status in API: ${orderAfter.status}`);

    const ok = orderAfter.status === 'confirmed';
    console.log(ok ? 'Result: PASS (async flow confirmed).' : 'Result: FAIL (order status mismatch).');

    return {
      ok,
      orderId: order.id,
      rabbitEventType: rabbitEvent.eventType,
      wsStatus: wsEvent.status,
    };
  } finally {
    ws.close();
    await rabbit.close().catch(() => undefined);
  }
}

module.exports = {
  runScenarioD,
};

