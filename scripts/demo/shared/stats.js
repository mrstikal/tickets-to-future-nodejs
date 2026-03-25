function percentile(values, p) {
  if (values.length === 0) {
    return 0;
  }

  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[index];
}

function summarizeDurations(values) {
  if (values.length === 0) {
    return {
      count: 0,
      min: 0,
      max: 0,
      avg: 0,
      p50: 0,
      p95: 0,
      p99: 0,
    };
  }

  const total = values.reduce((sum, value) => sum + value, 0);

  return {
    count: values.length,
    min: Math.min(...values),
    max: Math.max(...values),
    avg: Math.round(total / values.length),
    p50: percentile(values, 50),
    p95: percentile(values, 95),
    p99: percentile(values, 99),
  };
}

module.exports = {
  summarizeDurations,
};

