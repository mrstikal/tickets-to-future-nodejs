#!/usr/bin/env bash
set -euo pipefail

echo "Stopping infra..."
docker compose down
