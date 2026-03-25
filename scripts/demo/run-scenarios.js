const { buildConfig } = require('./shared/config');
const path = require('node:path');
const { runScenarioA } = require('./scenario-a-load');
const { runScenarioB } = require('./scenario-b-race');
const { runScenarioC } = require('./scenario-c-hold-expiration');
const { runScenarioD } = require('./scenario-d-async-processing');
const {
  writeJsonReport,
  writeCsvReport,
  appendTrendCsv,
} = require('./shared/report-exporter');

async function runSelectedScenarios(config) {
  const outputs = [];
  const selection = config.scenario;

  if (selection === 'A' || selection === 'ALL') {
    outputs.push({ name: 'A', result: await runScenarioA(config) });
  }

  if (selection === 'B' || selection === 'ALL') {
    outputs.push({ name: 'B', result: await runScenarioB(config) });
  }

  if (selection === 'C' || selection === 'ALL') {
    outputs.push({ name: 'C', result: await runScenarioC(config) });
  }

  if (selection === 'D' || selection === 'ALL') {
    outputs.push({ name: 'D', result: await runScenarioD(config) });
  }

  return outputs;
}

async function main() {
  const config = buildConfig(process.argv.slice(2));
  const startedAt = Date.now();
  const runId = new Date().toISOString().replace(/[:.]/g, '-');

  console.log('Demo runner config:', {
    apiBaseUrl: config.apiBaseUrl,
    wsUrl: config.wsUrl,
    rabbitmqUrl: config.rabbitmqUrl,
    scenario: config.scenario,
    reportFormats: config.reportFormats,
    reportDir: config.reportDir,
    trendCsv: config.trendCsv,
    trendCsvPath: config.trendCsvPath,
  });

  const outputs = await runSelectedScenarios(config);

  const report = {
    meta: {
      runId,
      startedAt: new Date(startedAt).toISOString(),
      finishedAt: new Date().toISOString(),
      durationMs: Date.now() - startedAt,
      scenario: config.scenario,
      reportPrefix: config.reportPrefix,
      apiBaseUrl: config.apiBaseUrl,
      wsUrl: config.wsUrl,
    },
    outputs,
  };

  const exportPaths = [];
  const absoluteReportDir = path.resolve(config.reportDir);

  if (config.reportFormats.includes('json')) {
    exportPaths.push(writeJsonReport(report, absoluteReportDir));
  }

  if (config.reportFormats.includes('csv')) {
    exportPaths.push(writeCsvReport(report, absoluteReportDir));
  }

  if (config.trendCsv) {
    exportPaths.push(appendTrendCsv(report, config.trendCsvPath));
  }

  const failed = outputs.filter((item) => !item.result.ok).map((item) => item.name);

  console.log('\n=== Demo Summary ===');
  for (const item of outputs) {
    console.log(`Scenario ${item.name}: ${item.result.ok ? 'PASS' : 'FAIL'}`);
  }

  if (exportPaths.length > 0) {
    console.log('\n=== Report Export ===');
    for (const filePath of exportPaths) {
      console.log(filePath);
    }
  }

  if (failed.length > 0) {
    console.log(`Failed scenarios: ${failed.join(', ')}`);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('Demo runner failed:', error.message);
  process.exit(1);
});

