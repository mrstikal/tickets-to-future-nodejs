const {
  listTickets,
  pickTicketForSale,
  createHold,
  getHold,
  getTicket,
} = require('./shared/api');
const { createWsListener } = require('./shared/ws-listener');

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runScenarioC(config) {
  console.log('\n=== Demo Scenario C: Temporary reservation and expiration ===');

  const tickets = await listTickets(config);
  const target = pickTicketForSale(tickets);

  if (!target) {
    throw new Error('No sellable ticket found for scenario C.');
  }

  console.log(`Target ticket: ${target.id} (${target.title})`);

  const ws = await createWsListener(config, ['tickets', `ticket:${target.id}`]);
  const before = await getTicket(config, target.id);

  const hold = await createHold(config, {
    ticketId: target.id,
    sessionId: `${config.sessionPrefix}-${Date.now()}-hold-expire`,
  });

  const afterReserve = await getTicket(config, target.id);
  const reduced = afterReserve.availableQuantity < before.availableQuantity;

  console.log(`Available before reserve: ${before.availableQuantity}`);
  console.log(`Available after reserve: ${afterReserve.availableQuantity}`);
  console.log(`Hold TTL seconds from API: ${hold.ttlSeconds}`);

  const waitSeconds = Math.min(
    hold.ttlSeconds + config.holdWaitBufferSeconds,
    config.maxWaitSeconds
  );

  if (waitSeconds < hold.ttlSeconds) {
    console.log(
      `Warning: maxWaitSeconds=${config.maxWaitSeconds} is lower than TTL (${hold.ttlSeconds}). ` +
        'Scenario may not observe expiration unless API HOLD_TTL_SECONDS is lowered.'
    );
  }

  console.log(`Waiting ${waitSeconds}s before expiration check...`);
  await delay(waitSeconds * 1000);

  const holdAfterWait = await getHold(config, hold.id).catch((error) => {
    console.log(`Hold check error: ${error.message}`);
    return null;
  });

  const afterExpire = await getTicket(config, target.id);

  const holdExpiredEvent = await ws.waitFor(
    (event) =>
      event.type === 'ticket.hold.expired' &&
      event.ticketId === target.id &&
      event.holdId === hold.id,
    config.timeoutMs
  ).catch(() => null);

  ws.close();

  console.log(`Hold status after wait: ${holdAfterWait?.status || 'unknown'}`);
  console.log(`Available after expiration check: ${afterExpire.availableQuantity}`);

  const restored = afterExpire.availableQuantity >= before.availableQuantity;
  const expired = holdAfterWait?.status === 'expired';

  const ok = reduced && restored && expired;

  console.log(
    ok
      ? 'Result: PASS (capacity decreased on reserve and returned after expiration).'
      : 'Result: FAIL (reservation/expiration behavior is incomplete).'
  );

  if (!holdExpiredEvent) {
    console.log('Warning: no ticket.hold.expired websocket event captured within timeout.');
  }

  return {
    ok,
    reduced,
    restored,
    expired,
    wsEvent: Boolean(holdExpiredEvent),
  };
}

module.exports = {
  runScenarioC,
};

