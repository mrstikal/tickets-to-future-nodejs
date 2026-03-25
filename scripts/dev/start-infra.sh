#!/usr/bin/env bash
set -euo pipefail

echo "Starting infra (Postgres, Redis, RabbitMQ)..."
docker compose up -d
echo
docker compose ps
