function parseArgs(argv) {
  const result = {};

  for (const arg of argv) {
    if (!arg.startsWith('--')) {
      continue;
    }

    const [key, value] = arg.slice(2).split('=');
    result[key] = value === undefined ? 'true' : value;
  }

  return result;
}

function numberArg(args, key, fallback) {
  const raw = args[key];
  if (!raw) {
    return fallback;
  }

  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function csvArg(args, key, fallback) {
  const raw = args[key];
  if (!raw) {
    return fallback;
  }

  return raw
    .split(',')
    .map((part) => part.trim().toLowerCase())
    .filter(Boolean);
}

function booleanArg(args, key, fallback) {
  const raw = args[key];

  if (raw === undefined) {
    return fallback;
  }

  const normalized = String(raw).trim().toLowerCase();

  if (normalized === 'true' || normalized === '1' || normalized === 'yes') {
    return true;
  }

  if (normalized === 'false' || normalized === '0' || normalized === 'no') {
    return false;
  }

  return fallback;
}

function buildConfig(argv) {
  const args = parseArgs(argv);

  return {
    apiBaseUrl: args.apiBaseUrl || process.env.DEMO_API_BASE_URL || 'http://localhost:3000',
    wsUrl: args.wsUrl || process.env.DEMO_WS_URL || 'ws://localhost:3000/ws/v1',
    rabbitmqUrl:
      args.rabbitmqUrl ||
      process.env.RABBITMQ_URL ||
      'amqp://guest:guest@localhost:5672',
    timeoutMs: numberArg(args, 'timeoutMs', 15000),
    concurrency: numberArg(args, 'concurrency', 30),
    iterations: numberArg(args, 'iterations', 300),
    holdWaitBufferSeconds: numberArg(args, 'holdWaitBufferSeconds', 2),
    maxWaitSeconds: numberArg(args, 'maxWaitSeconds', 420),
    sessionPrefix: args.sessionPrefix || 'demo-session',
    emailDomain: args.emailDomain || 'demo.local',
    scenario: (args.scenario || 'ALL').toUpperCase(),
    reportFormats: csvArg(args, 'reportFormats', ['json']),
    reportDir: args.reportDir || 'scripts/demo/output',
    reportPrefix: args.reportPrefix || 'demo-report',
    trendCsv: booleanArg(args, 'trendCsv', false),
    trendCsvPath: args.trendCsvPath || 'scripts/demo/output/demo-trend.csv',
  };
}

module.exports = {
  buildConfig,
};

