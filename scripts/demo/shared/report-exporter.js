const fs = require('node:fs');
const path = require('node:path');

function sanitizeFilePart(value) {
  return String(value).replace(/[^a-zA-Z0-9_-]+/g, '-');
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function escapeCsvCell(value) {
  const raw = value === undefined || value === null ? '' : String(value);
  if (raw.includes(',') || raw.includes('"') || raw.includes('\n')) {
    return `"${raw.replace(/"/g, '""')}"`;
  }
  return raw;
}

function buildBaseFileName(report) {
  const prefix = sanitizeFilePart(report.meta.reportPrefix || 'demo-report');
  const scenario = sanitizeFilePart(report.meta.scenario || 'ALL');
  const runId = sanitizeFilePart(report.meta.runId);
  return `${prefix}-${scenario}-${runId}`;
}

function writeJsonReport(report, reportDir) {
  ensureDir(reportDir);
  const fileName = `${buildBaseFileName(report)}.json`;
  const filePath = path.join(reportDir, fileName);
  fs.writeFileSync(filePath, JSON.stringify(report, null, 2), 'utf8');
  return filePath;
}

function writeCsvReport(report, reportDir) {
  ensureDir(reportDir);
  const fileName = `${buildBaseFileName(report)}.csv`;
  const filePath = path.join(reportDir, fileName);

  const header = [
    'runId',
    'scenario',
    'ok',
    'failed',
    'rps',
    'p95',
    'orderId',
    'detailsJson',
  ];

  const rows = report.outputs.map((item) => {
    const result = item.result || {};
    return [
      report.meta.runId,
      item.name,
      result.ok,
      result.failed,
      result.rps,
      result.stats?.p95,
      result.orderId,
      JSON.stringify(result),
    ];
  });

  const lines = [
    header.map(escapeCsvCell).join(','),
    ...rows.map((row) => row.map(escapeCsvCell).join(',')),
  ];

  fs.writeFileSync(filePath, `${lines.join('\n')}\n`, 'utf8');
  return filePath;
}

function appendTrendCsv(report, trendCsvPath) {
  const absolutePath = path.resolve(trendCsvPath);
  ensureDir(path.dirname(absolutePath));

  const header = [
    'startedAt',
    'runId',
    'selectedScenario',
    'scenario',
    'ok',
    'failed',
    'rps',
    'p95',
    'orderId',
    'detailsJson',
  ];

  const fileExists = fs.existsSync(absolutePath);
  const lines = [];

  if (!fileExists) {
    lines.push(header.map(escapeCsvCell).join(','));
  }

  for (const item of report.outputs) {
    const result = item.result || {};
    const row = [
      report.meta.startedAt,
      report.meta.runId,
      report.meta.scenario,
      item.name,
      result.ok,
      result.failed,
      result.rps,
      result.stats?.p95,
      result.orderId,
      JSON.stringify(result),
    ];

    lines.push(row.map(escapeCsvCell).join(','));
  }

  if (lines.length > 0) {
    fs.appendFileSync(absolutePath, `${lines.join('\n')}\n`, 'utf8');
  }

  return absolutePath;
}

module.exports = {
  writeJsonReport,
  writeCsvReport,
  appendTrendCsv,
};

