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
- **Testing**: Vitest (unit)
- **Logging**: Custom `logger` with log levels

### Frontend
- **Framework**: Next.js 16 (App Router)
- **Styling**: Tailwind CSS, `recharts` for charts
- **State management**: React hooks, Context (auth)
- **WebSocket hooks**: `useTicketWebsocket`, `useSessionWebsocket`
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
- Queue `hold.expired.queue` → consumer `hold-consumer` (log hold expiration)
- DLX `tickets.dlx` with 5min TTL → automatic retry of failed messages
- Dead-letter queues: `order.confirmed.dlq`, `hold.expired.dlq`

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
- Hardcoded: 5 attempts per 15 minutes (not configurable via env)

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
- `GET /api/v1/tickets` – list tickets
- `GET /api/v1/tickets/:id` – ticket detail
- `POST /api/v1/holds` – create reservation
- `GET /api/v1/holds/session/:sessionId` – list holds by session
- `GET /api/v1/holds/:id` – get hold detail
- `DELETE /api/v1/holds/:id` – release reservation
- `POST /api/v1/orders` – create order from holds
- `GET /api/v1/orders/:id` – order detail
- `GET /api/v1/events/groups` – list events grouped by period
- `GET /api/v1/events` – list events by date range (startYear, endYear, page, limit)
- `POST /api/v1/auth/login` – login (JWT)
- `POST /api/v1/auth/signup` – sign up
- `POST /api/v1/auth/refresh` – token refresh
- `GET /api/v1/auth/me` – get current user
- `POST /api/v1/auth/logout` – logout

### Admin
- `GET /api/v1/admin/stats/overview` – statistics overview (revenue, sold tickets)
- `GET /api/v1/admin/stats/top-selling` – top selling tickets
- `GET /api/v1/admin/stats/least-selling` – least selling tickets
- `GET /api/v1/admin/filters/ticket-types` – ticket types for filtering
- `GET /api/v1/admin/filters/ticket-events` – ticket events for filtering
- `POST /api/v1/admin/reset-login-limit` – reset login rate limit for IP
- `GET /api/v1/admin/orders` – list orders with filters
- `GET /api/v1/admin/orders/:id` – order detail
- `POST /api/v1/admin/orders/:id/cancel` – cancel order
- `PATCH /api/v1/admin/orders/:id/total-price` – update order total price
- `GET /api/v1/admin/ticket-types` – CRUD for ticket types
- `POST /api/v1/admin/ticket-types` – create ticket type
- `GET /api/v1/admin/ticket-types/:id` – get ticket type
- `PUT /api/v1/admin/ticket-types/:id` – update ticket type
- `DELETE /api/v1/admin/ticket-types/:id` – delete ticket type
- `DELETE /api/v1/admin/ticket-types/:id/force` – force delete ticket type
- `GET /api/v1/admin/ticket-types/:id/has-events` – check if ticket type has events
- `GET /api/v1/admin/ticket-events` – CRUD for ticket events
- `POST /api/v1/admin/ticket-events` – create ticket event
- `GET /api/v1/admin/ticket-events/:id` – get ticket event
- `PUT /api/v1/admin/ticket-events/:id` – update ticket event
- `DELETE /api/v1/admin/ticket-events/:id` – delete ticket event
- `DELETE /api/v1/admin/ticket-events/:id/force` – force delete ticket event
- `GET /api/v1/admin/ticket-events/:id/has-holds-or-orders` – check if event has holds or orders
- `POST /api/v1/admin/image-assets/upload` – upload image

---

## WebSocket Events

### Connection
`ws://localhost:3000/ws/v1`

### Authentication
- WebSocket connections can be authenticated via `auth_token` cookie
- Authenticated clients receive order status updates and can subscribe to user-specific channels

### Subscription
After connection, client sends:
```json
{
  "type": "subscribe",
  "channels": ["tickets", "ticket:<ticketId>", "session.<sessionId>"]
}
```

### Channel Types
- `tickets` – global ticket availability updates
- `ticket:<ticketId>` – updates for specific ticket
- `session.<sessionId>` – hold updates for specific session

### Received Events
```json
{
  "type": "ticket.availability.updated",
  "ticketId": "uuid",
  "availableQuantity": 5,
  "soldQuantity": 10,
  "activeHolds": 3,
  "timestamp": "2026-03-26T16:40:00Z"
}
```

```json
{
  "type": "ticket.hold.expired",
  "ticketId": "uuid",
  "holdId": "uuid",
  "timestamp": "2026-03-26T16:40:00Z"
}
```

```json
{
  "type": "order.status.updated",
  "orderId": "uuid",
  "status": "confirmed",
  "timestamp": "2026-03-26T16:40:00Z"
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
    "expiresAt": "2026-03-26T16:45:00Z"
  },
  "timestamp": "2026-03-26T16:40:00Z"
}
```

```json
{
  "type": "connection.ready",
  "isAuthenticated": true,
  "timestamp": "2026-03-26T16:40:00Z"
}
```

```json
{
  "type": "pong",
  "timestamp": "2026-03-26T16:40:00Z"
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
| `events:groups` | Cache for events grouped by period | 60s |
| `events:range:{startYear}-{endYear}:p{page}:l{limit}` | Cache for paginated events by date range | 60s |
| `admin:stats:*` | Cache for admin statistics (overview, top-selling, least-selling) | 300s |
| `admin:filters:*` | Cache for admin filter options (ticket-types, ticket-events) | 3600s |
| `rate_limit:{ip}:login` | Rate limit for login (5 attempts per 15 minutes) | 900s |

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

This command starts **only the infrastructure containers** (Postgres, Redis, RabbitMQ). The API and web frontend are excluded by default (they are behind the `app` profile). If you want to run the full application stack in Docker (including API and web), use:

```bash
docker compose --profile app up -d
```

Useful commands:
- `docker compose ps` — shows container status and healthchecks (Postgres/RabbitMQ/Redis have healthchecks configured)
- `docker compose logs -f postgres` — follow Postgres logs
- `docker compose down` — stop containers
- `docker compose down -v` — stop containers and remove named volumes (useful to reset DB data)

**Troubleshooting port conflicts**
If you see `EADDRINUSE: address already in use :::3000` when running `npm run dev`, it's likely because the Docker API container is already occupying port 3000. Stop the Docker stack or remove the API container:

```bash
docker compose down
```

Then you can run `npm run dev` again.

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

### Initial Setup
```bash
npm run db:init            # creates schema and seeds initial data (infra/sql/000_init_and_seed.sql)
npm run db:seed            # seeds demo data (infra/sql/001_seed.sql)
```

### Migrations
```bash
npm run db:migrate         # runs database migrations from infra/migrations/
```

### Reset & Recreate
```bash
npm run db:reset           # drops and recreates schema + seed
npm run db:seed:generate   # regenerates seed from Rick and Morty API
npm run db:drop            # drops all tables
```

### NPM Scripts Cheatsheet
```bash
# Development
npm run dev                # start both API and web
npm run dev:api            # start API only
npm run dev:web            # start web only

# Database
npm run db:init            # initialize database
npm run db:migrate         # run migrations
npm run db:seed            # seed demo data
npm run db:reset           # reset database

# Testing
npm test                   # run all unit tests
npm run test:e2e           # run E2E tests
npm run lint               # lint all projects
npm run typecheck          # type check all projects

# Demo scenarios
npm run demo:a             # scenario A: load test
npm run demo:b             # scenario B: race condition
npm run demo:c             # scenario C: hold expiration
npm run demo:d             # scenario D: async processing
npm run demo:all           # run all scenarios
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
npm test                    # runs all unit tests (api + web)
npm run test:unit:api       # backend unit tests only
npm --prefix apps/web run test:unit  # frontend unit tests only
```

### E2E Tests (Playwright)
```bash
npm run test:e2e            # runs Playwright E2E tests
```

### Linting & Type Checking
```bash
npm run lint                # lint all projects
npm run typecheck           # type check all projects
```

---

## Admin Dashboard


Login: `admin@tickets.local` / `Admin123!`

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

```env
# Database
POSTGRES_URL=postgresql://postgres:postgres@localhost:5439/tickets
POSTGRES_POOL_MAX=20
POSTGRES_POOL_IDLE_TIMEOUT_MS=30000
REDIS_URL=redis://localhost:6380
RABBITMQ_URL=amqp://guest:guest@localhost:5672

# Application
PORT=3000
NEXT_PUBLIC_API_BASE_URL=http://localhost:3000
NEXT_PUBLIC_WS_BASE_URL=ws://localhost:3000
WEB_BASE_URL=http://localhost:3001
ALLOWED_ORIGINS=http://localhost:3001,http://localhost:3000

# Auth
JWT_SECRET=your-secret-key
JWT_REFRESH_SECRET=your-refresh-secret-key
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# Ticket holds
HOLD_TTL_SECONDS=300

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