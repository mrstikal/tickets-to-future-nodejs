# WIP
## This demo is still in development!

# Tickets to Future

A high-load tech demo showcasing real-time ticket sales with WebSocket updates, optimistic/pessimistic locking, transactional order flow, and async queue processing.

This demonstration application covers the complete flow from browsing ticket catalogs through reservation, checkout, to asynchronous order processing with real-time UI updates. Built to handle concurrent access patterns typical in high-demand ticket sales scenarios. The demo also includes **4 load and stress test scenarios** (A–D) targeting performance and stability: high-concurrency API load, reservation race conditions, hold expiration recovery, and end-to-end async order processing.

---

## Architecture

```
├── Frontend (Next.js 16)
│   ├── Ticket catalog, detail view, cart, checkout
│   ├── Admin dashboard (statistics, CRUD operations)
│   └── Real-time updates via WebSocket
├── Backend (pure Node.js)
│   ├── HTTP API (frameworkless, custom router)
│   ├── WebSocket server for real-time push
│   ├── Integration with Postgres, Redis, RabbitMQ
│   └── Rate limiting, CORS, structured logging
└── Data layer
    ├── Postgres 15 – persistent business data
    ├── Redis 7 – cache, temporary holds, rate limits
    └── RabbitMQ 3 – async processing, dead-letter queues
```

---

## Tech Stack

### Backend
- **Runtime**: Node.js 20+ (ES modules)
- **HTTP server**: Pure `http.createServer`, custom router without Express/Fastify
- **TypeScript**: `tsx` for development and testing
- **Database**: PostgreSQL 15 – relational schema with ticket_types ↔ ticket_events ↔ ticket_holds ↔ orders
- **Cache & state**: Redis 7 – cache for lists/details, pattern invalidation, rate limiting, TTL-based holds
- **Queue**: RabbitMQ 3 – topic exchange `tickets.events`, queues `order.confirmed.queue`, `hold.expired.queue` with DLX/DLQ
- **WebSocket**: `ws` library, endpoint `/ws/v1`, channel subscription model
- **Auth**: JWT (access + refresh tokens), bcrypt, role-based (admin)
- **Testing**: Vitest (unit, integration)
- **Logging**: Custom `logger` with log levels

### Frontend
- **Framework**: Next.js 16 (App Router)
- **Styling**: Tailwind CSS, `recharts` for charts
- **State management**: React hooks, Context (auth)
- **WebSocket hooks**: `useTicketWebSocket`, `useSessionWebSocket`
- **Testing**: Vitest + React Testing Library, Playwright (E2E)
- **UI components**: Custom components (Header, Modal, AvatarUpload, …)

---

## Key Technical Aspects

### Frameworkless Backend Architecture
- Custom `createApp` with pipeline: `requestLogger → CORS → static files → JSON body parser → router`
- Router maps HTTP methods and path patterns to controller functions
- Dependency injection via `dependencies-runtime` (Postgres, Redis, RabbitMQ, WebSocket)

### Ticket Hold Flow (Optimistic/Pessimistic Locking)
1. User clicks "Reserve" on ticket detail
2. Backend calls `SELECT FOR UPDATE` on `ticket_events` (pessimistic locking)
3. Creates record in `ticket_holds` with `status='active'`, `expires_at = NOW() + HOLD_TTL_SECONDS`
4. Redis cache for ticket detail is invalidated
5. WebSocket broadcast `ticket.availability.updated`
6. Frontend displays countdown to expiration

### Transactional Order Creation
1. Validation of hold IDs, session ID, email
2. Transaction start (`BEGIN`)
3. For each hold: `SELECT FOR UPDATE` on `ticket_holds` → check `status='active'` → `UPDATE status='confirmed'`
4. Create records in `orders` and `order_items`
5. Increment `sold_quantity` in `ticket_events` (atomic operation)
6. Commit (`COMMIT`)
7. WebSocket broadcast `order.status.updated` and `ticket.availability.updated`
8. Cache invalidation (pattern `events:*`, `tickets:*`)
9. RabbitMQ publish `order.confirmed`

### Redis Cache & Pattern Invalidation
- Cache keys: `tickets:list`, `ticket:detail:{id}`, `events:{period}`, `admin:stats:*`
- After each mutation: `delCache` + `delCachePattern`
- Rate limiting: `rate_limit:{ip}:login` with TTL

### RabbitMQ DLX/DLQ (Dead-Letter Exchange/Queue)
- Topic exchange `tickets.events`
- Queue `order.confirmed.queue` → consumer `order-consumer` (log + mock notifications)
- Queue `hold.expired.queue` → consumer `hold-consumer` (mark hold as expired)
- DLX `tickets.events.dlx` with 5min TTL → automatic retry of failed messages

### WebSocket Broadcaster
- Events:
    - `ticket.availability.updated`
    - `ticket.hold.expired`
    - `order.status.updated`
    - `hold.updated`
- Broadcast to all connected clients or filtered by session ID
- JSON payload with `eventType` and data

### Rate Limiting
- Redis-backed, currently for login endpoint only
- Configurable via env: `RATE_LIMIT_WINDOW_MS`, `RATE_LIMIT_MAX_REQUESTS`

### CORS Configuration
- Allowed origins via env `ALLOWED_ORIGINS`
- Development default: `http://localhost:3001`

---

## Data Model (PostgreSQL)

### Core Tables
- **image_assets** – character images from Rick and Morty API (external_id, name, local_image_path)
- **ticket_types** – ticket types (title, description, price, currency, total_quantity, sold_quantity, is_active)
- **ticket_events** – specific events (ticket_type_id, slug, title, event_at, price, total_quantity, sold_quantity)
- **ticket_holds** – temporary reservations (ticket_id, session_id, status, expires_at)
- **orders** – orders (email, name, status, total_price, currency, order_number)
- **order_items** – order items (order_id, ticket_id, quantity, unit_price, total_price)
- **users** – admin users (email, password_hash, role)

### Schema Relationships
```
image_assets (1) ← ticket_types (1) ← ticket_events (N)
                                         ↓
                                   ticket_holds (N)
                                         ↓
                                   order_items (N) ← orders (1)
```

---

## API Endpoints (Selection)

### Public
- `GET /api/v1/tickets` – list tickets with pagination, filtering, sorting
- `GET /api/v1/tickets/:id` – ticket detail
- `POST /api/v1/holds` – create reservation
- `GET /api/v1/holds/session/:sessionId` – get all active holds for a session
- `GET /api/v1/holds/:id` – get hold detail
- `DELETE /api/v1/holds/:id` – release reservation
- `POST /api/v1/orders` – create order from holds
- `GET /api/v1/orders/:id` – order detail
- `GET /api/v1/events/groups` – list events grouped by year for filters
- `GET /api/v1/events?startYear=...&endYear=...&page=...&limit=...` – list events by date range with pagination
- `POST /api/v1/auth/login` – login (JWT)
- `POST /api/v1/auth/signup` – register new user
- `POST /api/v1/auth/refresh` – token refresh
- `GET /api/v1/auth/me` – get current user info
- `POST /api/v1/auth/logout` – logout

### Admin
- `GET /api/v1/admin/stats/overview` – statistics overview (revenue, sold tickets)
- `GET /api/v1/admin/stats/top-selling` – top selling tickets
- `GET /api/v1/admin/stats/least-selling` – least selling tickets
- `GET /api/v1/admin/orders` – list orders with filters
- `GET /api/v1/admin/orders/:id` – order detail
- `POST /api/v1/admin/orders/:id/cancel` – cancel order
- `PATCH /api/v1/admin/orders/:id/total-price` – update order total price
- `GET /api/v1/admin/ticket-types` – list ticket types
- `POST /api/v1/admin/ticket-types` – create ticket type
- `GET /api/v1/admin/ticket-types/:id` – get ticket type detail
- `PUT /api/v1/admin/ticket-types/:id` – update ticket type
- `DELETE /api/v1/admin/ticket-types/:id` – delete ticket type
- `DELETE /api/v1/admin/ticket-types/:id/force` – force delete ticket type
- `GET /api/v1/admin/ticket-types/:id/has-events` – check if ticket type has associated events
- `GET /api/v1/admin/ticket-events` – list ticket events
- `POST /api/v1/admin/ticket-events` – create ticket event
- `GET /api/v1/admin/ticket-events/:id` – get ticket event detail
- `PUT /api/v1/admin/ticket-events/:id` – update ticket event
- `DELETE /api/v1/admin/ticket-events/:id` – delete ticket event
- `DELETE /api/v1/admin/ticket-events/:id/force` – force delete ticket event
- `GET /api/v1/admin/ticket-events/:id/has-holds-or-orders` – check if ticket event has holds or orders
- `POST /api/v1/admin/image-assets/upload` – upload image
- `POST /api/v1/admin/reset-login-limit` – reset login rate limit for an IP

---

## WebSocket Events

### Connection
`ws://localhost:3000/ws/v1`

### Subscription
Po připojení klient pošle zprávu `subscribe` s polem názvů kanálů, na které se chce přihlásit:
```json
{
  "type": "subscribe",
  "channels": ["tickets", "ticket:{ticketId}", "session.{sessionId}"]
}
```

### Received Events
```json
{
  "type": "ticket.availability.updated",
  "ticketId": "uuid",
  "availableQuantity": 5,
  "soldQuantity": 10,
  "activeHolds": 2,
  "timestamp": "2026-03-24T08:55:00Z"
}
```

```json
{
  "type": "ticket.hold.expired",
  "ticketId": "uuid",
  "holdId": "uuid",
  "sessionId": "session123",
  "timestamp": "2026-03-24T08:55:00Z"
}
```

```json
{
  "type": "order.status.updated",
  "orderId": "uuid",
  "status": "confirmed",
  "timestamp": "2026-03-24T08:55:00Z"
}
```

```json
{
  "type": "hold.updated",
  "sessionId": "session123",
  "hold": {
    "id": "uuid",
    "ticketId": "uuid",
    "status": "active",
    "expiresAt": "2026-03-24T08:55:00Z"
  },
  "timestamp": "2026-03-24T08:55:00Z"
}
```

---

## RabbitMQ Message Contracts

### Exchange: `tickets.events` (topic)

#### `order.confirmed`
```json
{
  "eventType": "order.confirmed",
  "orderId": "uuid",
  "orderNumber": "ORD-2026-00042",
  "email": "customer@example.com",
  "items": [...],
  "totalPrice": 1234,
  "currency": "CZK",
  "occurredAt": "2026-03-24T08:55:00Z"
}
```

#### `hold.expired`
```json
{
  "eventType": "hold.expired",
  "holdId": "uuid",
  "ticketId": "uuid",
  "sessionId": "session123",
  "expiredAt": "2026-03-24T08:55:00Z"
}
```

---

## Redis Keys and TTL

| Key | Description | TTL |
|------|-------|-----|
| `tickets:list` | Cache for ticket list | 60s |
| `ticket:detail:{id}` | Cache for ticket detail | 30s |
| `events:{period}` | Cache for events (today/week/month/future) | 60s |
| `admin:stats:*` | Cache for admin statistics | 30s |
| `rate_limit:{ip}:login` | Rate limit for login | 1min |
| `hold:{id}` | Temporary reservation (optional) | HOLD_TTL_SECONDS |

---

## Seed Data

Demo uses **300 characters from Rick and Morty API**:
1. Script `scripts/seed/generate-rick-morty-seed.js` downloads metadata and images
2. Saves images to `apps/web/public/assets/characters/`
3. Generates SQL insertion in `infra/sql/002_seed_demo_data.sql`
4. Creates `image_assets`, `ticket_types`, `ticket_events` with pseudo-random prices and quantities

Run seed:
```bash
npm run db:seed
```

---

## Getting Started

### Prerequisites
- Node.js 20+
- Docker & Docker Compose (for Postgres, Redis, RabbitMQ)
- (Optional) `psql` for direct database access

### 1. Clone and Install
```bash
git clone <repo>
cd tickets-to-future
npm install
```

### 2. Environment Configuration
```bash
cp .env.example .env
# edit .env as needed (CORS, DB credentials, …)
```
Docker notes (local infra only)
--------------------------------
This repository includes a docker-compose configuration that can run Postgres, Redis and RabbitMQ for local development.

Start the local infrastructure:

```bash
docker compose up -d
```

Useful commands:
- `docker compose ps` — shows container status and healthchecks (Postgres/RabbitMQ/Redis have healthchecks configured)
- `docker compose logs -f postgres` — follow Postgres logs
- `docker compose down` — stop containers
- `docker compose down -v` — stop containers and remove named volumes (useful to reset DB data)

Health endpoint checks
----------------------
After you start infra and run the API locally (for example `npm run dev:api`), verify the app health endpoints:

```bash
curl http://localhost:3000/api/v1/health
curl http://localhost:3000/api/v1/health/dependencies
```

Helper scripts
--------------
I added small helper scripts under `scripts/dev/` to simplify start/stop/reset operations for the infra.

Unix:
- `scripts/dev/start-infra.sh`
- `scripts/dev/stop-infra.sh`
- `scripts/dev/reset-infra.sh`

Windows (cmd):
- `scripts/dev/start-infra.cmd`
- `scripts/dev/stop-infra.cmd`
- `scripts/dev/reset-infra.cmd`

Usage (Unix):

```bash
bash scripts/dev/start-infra.sh
bash scripts/dev/stop-infra.sh
bash scripts/dev/reset-infra.sh
```

Usage (Windows cmd):

```cmd
scripts\dev\start-infra.cmd
scripts\dev\stop-infra.cmd
scripts\dev\reset-infra.cmd
```

Volumes used by compose:
- `postgres_data` — persistent Postgres data (named volume)
- `rabbitmq_data` — RabbitMQ data

Ports (defaults can be overridden with environment variables):
Ports (výchozí hodnoty lze přepsat proměnnými prostředí):
- Postgres: `localhost:5439` (mapuje se na port 5432 v kontejneru)
- Redis: `localhost:6380` (mapuje se na port 6379 v kontejneru)
- RabbitMQ: `localhost:5672` (mapuje se na port 5672 v kontejneru), management UI: `localhost:15672` (mapuje se na port 15672 v kontejneru)
### Subscription
After connection, the client sends a `subscribe` message with an array of channel names to subscribe to:
```json
{
  "type": "subscribe",
  "channels": ["tickets", "ticket:{ticketId}", "session.{sessionId}"]
}
```

### Received Events
The following JSON payloads are sent to clients. Note the `type` field (instead of `eventType`):

```json
{
  "type": "ticket.availability.updated",
  "ticketId": "uuid",
  "availableQuantity": 5,
  "soldQuantity": 10,
  "activeHolds": 2, 
  "timestamp": "2026-03-24T08:55:00Z"
}
```

```json
{
  "type": "ticket.hold.expired",
  "ticketId": "uuid",
  "holdId": "uuid",
  "sessionId": "session123",
  "timestamp": "2026-03-24T08:55:00Z"
}
```

```json
{
  "type": "order.status.updated",
  "orderId": "uuid",
  "status": "confirmed",
  "timestamp": "2026-03-24T08:55:00Z"
}
```

```json
{
  "type": "hold.updated",
  "sessionId": "session123",
  "hold": {
    "id": "uuid",
    "ticketId": "uuid",
    "status": "active",
    "expiresAt": "2026-03-24T08:55:00Z"
  },
  "timestamp": "2026-03-24T08:55:00Z"
}
```

---

## RabbitMQ DLX/DLQ (Dead-Letter Exchange/Queue)
- Events exchange: `tickets.events` (topic)
- Dead-letter exchange: `tickets.dlx` (fanout)
- Confirmed orders queue: `order.confirmed.queue` (with DLQ `order.confirmed.dlq`)
  - Consumer: `order-consumer` (logs and simulates notifications)
- Expired holds queue: `hold.expired.queue` (with DLQ `hold.expired.dlq`)
  - Consumer: `hold-consumer` (marks hold as expired)
- Messages that fail processing or expire are moved to the corresponding **DLQ**.
  - Messages in `order.confirmed.queue` and `hold.expired.queue` have a TTL of 5 minutes. If not processed within this time, they are moved to the **DLX** and then routed to their respective **DLQ**.

---

## Redis Keys and TTL

| Key | Description | TTL |
|------|-------|-----|
| `tickets:list` | Cache for ticket list | 60s |
| `ticket:detail:{id}` | Cache for ticket detail | 30s |
| `events:groups` | Cache for events grouped by year | 60s |
| `events:range:{startYear}-{endYear}:p{page}:l{limit}` | Cache for paginated events by date range | 60s |
| `admin:stats:*` | Cache for admin statistics | 30s |
| `admin:filters:*` | Cache for admin filters (ticket types/events) | 60s |
| `rate_limit:auth-login:{ip}` | Rate limit for login endpoint | 15min |
| `rate_limit:auth-signup:{ip}` | Rate limit for signup endpoint | 15min |
| `hold:{id}` | Dočasná rezervace (volitelné) | HOLD_TTL_SECONDS |

---

## Seed Data

This demo uses **300 characters from the Rick and Morty API**:
1. The script `scripts/seed/generate-rick-morty-seed.js` downloads metadata and images.
2. It saves images to `apps/web/public/assets/characters/`.
3. It generates SQL insertion commands into **`infra/sql/001_seed.sql`** (the default seed file in the project).
4. It creates records in `image_assets`, `ticket_types`, and `ticket_events` tables with pseudo-random prices and quantities.

To run the seed (uses `infra/sql/001_seed.sql`):
```bash
npm run db:seed
```

To **regenerate seed data** into `infra/sql/001_seed.sql`, run:
```bash
npm run db:seed:generate -- infra/sql/001_seed.sql
```

---

## Getting Started

### Prerequisites
- Node.js 20+
- Docker & Docker Compose (for Postgres, Redis, RabbitMQ)
- (Optional) `psql` for direct database access

### 1. Clone and Install
```bash
git clone <repo>
cd tickets-to-future
npm install
```

### 2. Environment Configuration
```bash
cp .env.example .env
# Edit .env as needed (CORS, DB credentials, ...)
```

### 3. Start Local Infrastructure (Postgres, Redis, RabbitMQ)

This repository includes a `docker-compose` configuration that can run Postgres, Redis, and RabbitMQ for local development.

To start only the infrastructure (without the API and WEB applications):
```bash
docker compose up -d postgres redis rabbitmq
```

Useful Docker Compose commands:
- `docker compose ps` — shows container status and health checks (Postgres/RabbitMQ/Redis have health checks configured)
- `docker compose logs -f postgres` — follows Postgres logs
- `docker compose down` — stops all containers defined in `docker-compose.yml`
- `docker compose down -v` — stops containers and removes named volumes (useful to reset database data)

### 4. API Endpoint Health Checks
After starting the infrastructure and running the API locally (e.g., `npm run dev:api`), verify the application health endpoints:

```bash
curl http://localhost:3000/api/v1/health
curl http://localhost:3000/api/v1/health/dependencies
```

### 5. Helper Scripts
Small helper scripts have been added under `scripts/dev/` to simplify start/stop/reset operations for the infrastructure.

Unix:
- `scripts/dev/start-infra.sh`
- `scripts/dev/stop-infra.sh`
- `scripts/dev/reset-infra.sh`

Windows (cmd):
- `scripts/dev/start-infra.cmd`
- `scripts/dev/stop-infra.cmd`
- `scripts/dev/reset-infra.cmd`

Example usage (Unix):
```bash
bash scripts/dev/start-infra.sh
bash scripts/dev/stop-infra.sh
bash scripts/dev/reset-infra.sh
```

Example usage (Windows cmd):
```cmd
scripts\dev\start-infra.cmd
scripts\dev\stop-infra.cmd
scripts\dev\reset-infra.cmd
```

### 6. Database Initialization and Seeding

Volumes used by Docker Compose for persistent data:
- `postgres_data` — persistent Postgres data (named volume)
- `rabbitmq_data` — RabbitMQ data

To re-initialize the DB from SQL files, run:
```bash
npm run db:drop && npm run db:init && npm run db:seed
```

### 7. Run Application
```bash
npm run dev          # runs both backend (localhost:3000) and frontend (localhost:3001)
# or separately:
npm run dev:api      # backend only
npm run dev:web      # frontend only
```

### 8. Open in Browser
- Frontend: [http://localhost:3001](http://localhost:3001)
- Backend API: [http://localhost:3000/api/v1/tickets](http://localhost:3000/api/v1/tickets)
- WebSocket: `ws://localhost:3000/ws/v1`

---

## Database Management

```bash
npm run db:reset            # drops and recreates schema + seed
npm run db:seed:generate    # regenerates seed from Rick and Morty API (into 001_seed.sql)
npm run db:seed             # uses the existing seed file (001_seed.sql)
```

---

## Demo Scenarios (A‑D)

`scripts/demo/` obsahuje připravené zátěžové scénáře:

- **A**: Zátěž na `GET /api/v1/tickets`
- **B**: Race condition pro rezervaci lístků
- **C**: Vypršení rezervace a obnova dostupnosti
- **D**: Asynchronní zpracování objednávek přes RabbitMQ + aktualizace přes WebSocket

Spuštění:
```bash
npm run demo:a      # jednotlivě
npm run demo:b
npm run demo:c
npm run demo:d
npm run demo:all    # všechny scénáře
```

Výstupy reportů do `scripts/demo/output/` (JSON/CSV).

---

## Testing

### Unit Tests (Vitest)
```bash
npm run test:unit    # spouští unit testy pro frontend i backend
npm run test:unit:api  # pouze backend unit testy
npm run test:unit:web  # pouze frontend unit testy
```

### E2E Tests (Playwright)
```bash
npm run test:e2e     # spouští Playwright E2E testy
```

---

## Admin Dashboard

Login: `admin@tickets.local` / `Admin123!`

Funkce:
- **Statistics**: revenue chart (Recharts), sold tickets, top/least selling table
- **Orders**: list with filters (status, email), order detail
- **Ticket Types**: CRUD operations for ticket types, image upload (AvatarUpload)
- **Ticket Events**: CRUD operations for events, linking to ticket types

---

## Monitoring & Logging

- Backend logs to stdout with `error`, `warn`, `info`, `debug` levels
- Request logging middleware writes `method`, `path`, `status`, `duration`
- RabbitMQ consumer logs received messages
- Redis cache logs hit/miss (optional via env)

---

## Environment Variables

**NOTE:** The following variables can be configured in the `.env` file. For local Docker Compose, it is recommended to use values that correspond to the definitions in `docker-compose.yml` and `.env.example`.

```env
# Database (local Docker Compose uses port 5439 for Postgres, default user/password)
POSTGRES_URL=postgresql://user:password@localhost:5439/tickets_db
REDIS_URL=redis://localhost:6380
RABBITMQ_URL=amqp://user:password@localhost:5672

# Application
PORT=3000
WEB_BASE_URL=http://localhost:3001 # Used for Playwright tests; Next.js server runs on port 3001
NEXT_PUBLIC_API_BASE_URL=http://localhost:3000
NEXT_PUBLIC_WS_BASE_URL=ws://localhost:3000
ALLOWED_ORIGINS=http://localhost:3001,http://127.0.0.1:3000

# Auth
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
JWT_REFRESH_SECRET=your-super-secret-refresh-key-change-this-in-production
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# Postgres Pool Configuration (used in apps/api/src/config/env.ts for pg.Pool setup)
POSTGRES_POOL_MAX=10
POSTGRES_POOL_IDLE_TIMEOUT_MS=30000
POSTGRES_POOL_CONNECTION_TIMEOUT_MS=2000

# Rate limiting (currently hard-coded in auth-controller.ts: 5 attempts / 15 min)
# RATE_LIMIT_WINDOW_MS=60000 
# RATE_LIMIT_MAX_REQUESTS=5

# Ticket holds
HOLD_TTL_SECONDS=1800 # 30 minutes, value from apps/api/src/config/env.ts, not 300s

# Logging
LOG_LEVEL=info
```

---

## Performance & Scalability

- **Cache layer**: Redis for frequently read data
- **Realtime push**: WebSocket broadcast instead of polling
- **Async processing**: RabbitMQ for offloading notifications and audits
- **DB connection pooling**: `pg.Pool` with configurable max connections
- **Rate limiting**: protection for login endpoint
- **Transaction isolation**: `BEGIN`/`COMMIT` for critical operations

---

## License

MIT

---

## Author

Tech demo created to demonstrate architecture for high-load applications with real-time updates and asynchronous processing.

**Happy ticketing!** 🎫
```

### Received Events
```json
{
  "eventType": "ticket.availability.updated",
  "ticketId": "uuid",
  "availableQuantity": 5,
  "soldQuantity": 10
}
```

```json
{
  "eventType": "ticket.hold.expired",
  "ticketId": "uuid",
  "holdId": "uuid",
  "sessionId": "session123"
}
```

```json
{
  "eventType": "order.status.updated",
  "orderId": "uuid",
  "status": "confirmed",
  "orderNumber": "ORD-2026-00042"
}
```

---

## RabbitMQ Message Contracts

### Exchange: `tickets.events` (topic)

#### `order.confirmed`
```json
{
  "eventType": "order.confirmed",
  "orderId": "uuid",
  "orderNumber": "ORD-2026-00042",
  "email": "customer@example.com",
  "items": [...],
  "totalPrice": 1234,
  "currency": "CZK",
  "occurredAt": "2026-03-24T08:55:00Z"
}
```

#### `hold.expired`
```json
{
  "eventType": "hold.expired",
  "holdId": "uuid",
  "ticketId": "uuid",
  "sessionId": "session123",
  "expiredAt": "2026-03-24T08:55:00Z"
}
```

---

## Redis Keys and TTL

| Key | Description | TTL |
|------|-------|-----|
| `tickets:list` | Cache for ticket list | 60s |
| `ticket:detail:{id}` | Cache for ticket detail | 30s |
| `events:{period}` | Cache for events (today/week/month/future) | 60s |
| `admin:stats:*` | Cache for admin statistics | 30s |
| `rate_limit:{ip}:login` | Rate limit for login | 1min |
| `hold:{id}` | Temporary reservation (optional) | HOLD_TTL_SECONDS |

---

## Seed Data

Demo uses **300 characters from Rick and Morty API**:
1. Script `scripts/seed/generate-rick-morty-seed.js` downloads metadata and images
2. Saves images to `apps/web/public/assets/characters/`
3. Generates SQL insertion in `infra/sql/002_seed_demo_data.sql`
4. Creates `image_assets`, `ticket_types`, `ticket_events` with pseudo-random prices and quantities

Run seed:
```bash
npm run db:seed
```

---

## Getting Started

### Prerequisites
- Node.js 20+
- Docker & Docker Compose (for Postgres, Redis, RabbitMQ)
- (Optional) `psql` for direct database access

### 1. Clone and Install
```bash
git clone <repo>
cd tickets-to-future
npm install
```

### 2. Environment Configuration
```bash
cp .env.example .env
# edit .env as needed (CORS, DB credentials, …)
```
Docker notes (local infra only)
--------------------------------
This repository includes a docker-compose configuration that can run Postgres, Redis and RabbitMQ for local development.

Start the local infrastructure:

```bash
docker compose up -d
```

Useful commands:
- `docker compose ps` — shows container status and healthchecks (Postgres/RabbitMQ/Redis have healthchecks configured)
- `docker compose logs -f postgres` — follow Postgres logs
- `docker compose down` — stop containers
- `docker compose down -v` — stop containers and remove named volumes (useful to reset DB data)

Health endpoint checks
----------------------
After you start infra and run the API locally (for example `npm run dev:api`), verify the app health endpoints:

```bash
curl http://localhost:3000/api/v1/health
curl http://localhost:3000/api/v1/health/dependencies
```

Helper scripts
--------------
I added small helper scripts under `scripts/dev/` to simplify start/stop/reset operations for the infra.

Unix:
- `scripts/dev/start-infra.sh`
- `scripts/dev/stop-infra.sh`
- `scripts/dev/reset-infra.sh`

Windows (cmd):
- `scripts/dev/start-infra.cmd`
- `scripts/dev/stop-infra.cmd`
- `scripts/dev/reset-infra.cmd`

Usage (Unix):

```bash
bash scripts/dev/start-infra.sh
bash scripts/dev/stop-infra.sh
bash scripts/dev/reset-infra.sh
```

Usage (Windows cmd):

```cmd
scripts\dev\start-infra.cmd
scripts\dev\stop-infra.cmd
scripts\dev\reset-infra.cmd
```

Volumes used by compose:
- `postgres_data` — persistent Postgres data (named volume)
- `rabbitmq_data` — RabbitMQ data

Ports (defaults can be overridden with environment variables):
- Postgres: localhost:5439 -> 5432
- Redis: localhost:6380 -> 6379
- RabbitMQ: localhost:5672 -> 5672, management UI: localhost:15672 -> 15672

If you want to reinitialize the DB from SQL files run:

```bash
npm run db:drop && npm run db:init && npm run db:seed
```
  - `rabbitmq_data` — RabbitMQ data

- Ports (defaults can be overridden with environment variables):
  - Postgres: localhost:5439 -> 5432
  - Redis: localhost:6380 -> 6379
  - RabbitMQ: localhost:5672 -> 5672, management UI: localhost:15672 -> 15672

If you want to reinitialize the DB from SQL files run:

```bash
npm run db:drop && npm run db:init && npm run db:seed
```


### 5. Run Application
```bash
npm run dev          # both backend (localhost:3000) and frontend (localhost:3001)
# or separately:
npm run dev:api      # backend only
npm run dev:web      # frontend only
```

### 6. Open in Browser
- Frontend: [http://localhost:3001](http://localhost:3001)
- Backend API: [http://localhost:3000/api/v1/tickets](http://localhost:3000/api/v1/tickets)
- WebSocket: `ws://localhost:3000/ws/v1`

---

## Database Management

```bash
npm run db:reset            # drops and recreates schema + seed
npm run db:seed:generate    # regenerates seed from Rick and Morty API
npm run db:seed             # uses existing seed file
```

---

## Demo Scenarios (A‑D)

`scripts/demo/` contains prepared stress scenarios:

- **A**: Load on `GET /api/v1/tickets`
- **B**: Race condition for ticket reservation
- **C**: Hold expiration and availability recovery
- **D**: Async order processing via RabbitMQ + WebSocket update

Run:
```bash
npm run demo:a      # individually
npm run demo:b
npm run demo:c
npm run demo:d
npm run demo:all    # all scenarios
```

Output reports to `scripts/demo/output/` (JSON/CSV).

---

## Testing

### Unit Tests (Vitest)
```bash
npm run test:unit    # spouští unit testy pro frontend i backend
npm run test:unit:api  # pouze backend unit testy
npm run test:unit:web  # pouze frontend unit testy
```

### E2E Tests (Playwright)
```bash
npm run test:e2e     # spouští Playwright E2E testy
```

---

## Admin Dashboard

Přihlášení: `admin@tickets.local` / `Admin123!`

Features:
- **Statistics**: revenue chart (Recharts), sold tickets, top/least selling table
- **Orders**: list with filters (status, email), order detail
- **Ticket Types**: CRUD for ticket types, image upload (AvatarUpload)
- **Ticket Events**: CRUD for events, linking to ticket types

---

## Monitoring & Logging

- Backend logs to stdout with levels `error`, `warn`, `info`, `debug`
- Request logging middleware writes `method`, `path`, `status`, `duration`
- RabbitMQ consumer logs received messages
- Redis cache logs hit/miss (optional via env)

---

## Environment Variables

**POZNÁMKA:** Následující proměnné můžete konfigurovat v souboru `.env`. Pro lokální Docker Compose je doporučeno použít hodnoty, které odpovídají definici v `docker-compose.yml` a `.env.example`.

```env
# Database (lokální Docker Compose používá port 5439 pro Postgres, defaultní user/password)
POSTGRES_URL=postgresql://user:password@localhost:5439/tickets_db
REDIS_URL=redis://localhost:6380
RABBITMQ_URL=amqp://user:password@localhost:5672

# Application
PORT=3000
WEB_BASE_URL=http://localhost:3001 # Používá se pro Playwright testy, Next.js server má svůj port 3001
NEXT_PUBLIC_API_BASE_URL=http://localhost:3000
NEXT_PUBLIC_WS_BASE_URL=ws://localhost:3000
ALLOWED_ORIGINS=http://localhost:3001,http://127.0.0.1:3000

# Auth
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
JWT_REFRESH_SECRET=your-super-secret-refresh-key-change-this-in-production
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# Postgres Pool Configuration (používá se v apps/api/src/config/env.ts pro nastavení pg.Pool)
POSTGRES_POOL_MAX=10
POSTGRES_POOL_IDLE_TIMEOUT_MS=30000
POSTGRES_POOL_CONNECTION_TIMEOUT_MS=2000

# Rate limiting (aktuálně hard-coded v auth-controller.ts: 5 pokusů / 15 min)
# RATE_LIMIT_WINDOW_MS=60000 
# RATE_LIMIT_MAX_REQUESTS=5

# Ticket holds
HOLD_TTL_SECONDS=1800 # 30 minut, hodnota z apps/api/src/config/env.ts, nikoliv 300s

# Logging
LOG_LEVEL=info
```

---

## Performance & Scalability

- **Cache layer**: Redis for frequently read data
- **Realtime push**: WebSocket broadcast instead of polling
- **Async processing**: RabbitMQ for offloading notifications and audits
- **DB connection pooling**: `pg.Pool` with configurable max connections
- **Rate limiting**: protection for login endpoint
- **Transaction isolation**: `BEGIN`/`COMMIT` for critical operations

---

## License

MIT

---

## Author

Tech demo created to demonstrate architecture for high-load applications with real-time updates and asynchronous processing.

**Happy ticketing!** 🎫