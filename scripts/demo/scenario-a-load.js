const { listTickets } = require('./shared/api');
const { summarizeDurations } = require('./shared/stats');

async function runScenarioA(config) {
  console.log('\n=== Demo Scenario A: Load /api/v1/tickets ===');
  console.log(`Iterations: ${config.iterations}, Concurrency: ${config.concurrency}`);

  const durations = [];
  let failed = 0;
  let remaining = config.iterations;

  const startedAt = Date.now();

  async function worker() {
    while (remaining > 0) {
      remaining -= 1;

      const t0 = Date.now();
      try {
        await listTickets(config);
        durations.push(Date.now() - t0);
      } catch {
        failed += 1;
      }
    }
  }

  await Promise.all(Array.from({ length: config.concurrency }, () => worker()));

  const totalMs = Date.now() - startedAt;
  const successful = durations.length;
  const stats = summarizeDurations(durations);
  const rps = successful > 0 ? Math.round((successful / totalMs) * 1000) : 0;

  console.log(`Successful requests: ${successful}`);
  console.log(`Failed requests: ${failed}`);
  console.log(`Duration (ms): min=${stats.min} avg=${stats.avg} p50=${stats.p50} p95=${stats.p95} p99=${stats.p99} max=${stats.max}`);
  console.log(`Throughput: ~${rps} req/s`);
  console.log('Interpretation: if Redis cache is active, p95 latency should remain stable under load.');

  return {
    ok: failed === 0,
    failed,
    stats,
    rps,
  };
}

module.exports = {
  runScenarioA,
};

