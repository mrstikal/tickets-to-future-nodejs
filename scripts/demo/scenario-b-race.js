const {
  listTickets,
  pickTicketForSale,
  createHold,
  createOrder,
  cancelHold,
} = require('./shared/api');
const { createWsListener } = require('./shared/ws-listener');

function buildSessionId(config, suffix) {
  return `${config.sessionPrefix}-${Date.now()}-${suffix}`;
}

async function runScenarioB(config) {
  console.log('\n=== Demo Scenario B: Race condition on last piece ===');

  const tickets = await listTickets(config);
  const oneLeft = tickets
    .filter((ticket) => ticket.isActive && ticket.availableQuantity === 1)
    .sort((a, b) => a.price - b.price)[0];

  const target = oneLeft || pickTicketForSale(tickets);

  if (!target) {
    throw new Error('No sellable ticket found for scenario B.');
  }

  console.log(`Target ticket: ${target.id} (${target.title}), available=${target.availableQuantity}`);
  if (!oneLeft) {
    console.log('Warning: ticket with exactly 1 piece was not found, using minimal available ticket.');
  }

  const ws = await createWsListener(config, ['tickets', `ticket:${target.id}`]);
  const sessionA = buildSessionId(config, 'race-A');
  const sessionB = buildSessionId(config, 'race-B');

  const [resultA, resultB] = await Promise.allSettled([
    createHold(config, { ticketId: target.id, sessionId: sessionA }),
    createHold(config, { ticketId: target.id, sessionId: sessionB }),
  ]);

  const successHolds = [resultA, resultB]
    .filter((result) => result.status === 'fulfilled')
    .map((result) => result.value);

  const failedHolds = [resultA, resultB]
    .filter((result) => result.status === 'rejected')
    .map((result) => result.reason);

  console.log(`Hold success count: ${successHolds.length}`);
  console.log(`Hold failure count: ${failedHolds.length}`);

  let order = null;
  let winnerHoldId = null;

  if (successHolds.length > 0) {
    const winner = successHolds[0];
    winnerHoldId = winner.id;
    order = await createOrder(config, {
      holdId: winner.id,
      sessionId: winner.sessionId,
      email: `race-winner@${config.emailDomain}`,
    });

    console.log(`Winning order created: ${order.id}`);
  }

  const wsAvailabilityEvent = await ws.waitFor(
    (event) => event.type === 'ticket.availability.updated' && event.ticketId === target.id,
    config.timeoutMs
  ).catch(() => null);

  if (wsAvailabilityEvent) {
    console.log('WebSocket availability update was broadcast to subscribers.');
  } else {
    console.log('Warning: no availability websocket event captured within timeout.');
  }

  for (const hold of successHolds) {
    if (!winnerHoldId || hold.id !== winnerHoldId) {
      await cancelHold(config, hold.id).catch(() => undefined);
    }
  }

  ws.close();

  const ok = successHolds.length === 1 && failedHolds.length === 1;
  console.log(
    ok
      ? 'Result: PASS (only one buyer reserved/continued).'
      : 'Result: FAIL (unexpected number of successful holds).'
  );

  return {
    ok,
    successHolds: successHolds.length,
    failedHolds: failedHolds.length,
    orderId: order?.id || null,
  };
}

module.exports = {
  runScenarioB,
};

