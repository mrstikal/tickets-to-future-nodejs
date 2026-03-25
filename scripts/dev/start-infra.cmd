@echo off
echo Starting infra (Postgres, Redis, RabbitMQ)...
docker compose up -d
docker compose ps
