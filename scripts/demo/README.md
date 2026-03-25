# Demo Scenarios (A-D)

This folder contains runnable demo scripts for stress and behavior scenarios.

## Scenarios

- A: load on `GET /api/v1/tickets`
- B: race condition for ticket reservation
- C: temporary hold and expiration recovery
- D: async order processing via RabbitMQ + WebSocket update

## Run

From project root:

```bash
npm run demo:a
npm run demo:b
npm run demo:c
npm run demo:d
npm run demo:all
```

## Useful flags

Pass flags directly to the runner script if needed:

```bash
node scripts/demo/run-scenarios.js --scenario=ALL --apiBaseUrl=http://localhost:3000 --wsUrl=ws://localhost:3000/ws/v1 --concurrency=50 --iterations=1000
```

Main options:
- `--scenario=A|B|C|D|ALL`
- `--apiBaseUrl=...`
- `--wsUrl=...`
- `--rabbitmqUrl=...`
- `--concurrency=...`
- `--iterations=...`
- `--timeoutMs=...`
- `--holdWaitBufferSeconds=...`
- `--maxWaitSeconds=...`
- `--reportFormats=json|csv|json,csv`
- `--reportDir=...`
- `--reportPrefix=...`
- `--trendCsv=true|false`
- `--trendCsvPath=...`

## Report export (JSON/CSV)

Default run exports JSON report to `scripts/demo/output`.

Example with both formats:

```bash
npm run demo:all -- --reportFormats=json,csv --reportPrefix=demo-nightly
```

You can also export to a custom folder:

```bash
node scripts/demo/run-scenarios.js --scenario=ALL --reportFormats=json,csv --reportDir=tmp/demo-reports
```

Append long-term trend CSV across multiple runs:

```bash
node scripts/demo/run-scenarios.js --scenario=ALL --trendCsv=true --trendCsvPath=scripts/demo/output/demo-trend.csv
```

Run twice and compare growth in one file:

```bash
node scripts/demo/run-scenarios.js --scenario=A --iterations=10 --concurrency=2 --trendCsv=true
node scripts/demo/run-scenarios.js --scenario=A --iterations=10 --concurrency=2 --trendCsv=true
```

## Note for Scenario C

If hold TTL is long, Scenario C can take longer to finish.
Set API env `HOLD_TTL_SECONDS` to a smaller value for faster demos.

