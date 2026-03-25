#!/usr/bin/env bash
set -euo pipefail

echo "Resetting infra (stopping and removing volumes)..."
docker compose down -v
