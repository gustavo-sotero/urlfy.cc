# urlfy.cc - URL Shortener

A high-performance, self-hosted URL shortener built with Next.js 16, ElysiaJS, Bun runtime, and PostgreSQL.

## 🚀 Features

- ⚡ **High Performance**: Bun runtime with native APIs for SQL and Redis
- 🐳 **100% Containerized**: Complete Docker Compose setup
- 📊 **Observability**: OpenTelemetry + SigNoz for traces, metrics, and logs
- 🔒 **LGPD/GDPR Compliant**: IP anonymization and data retention policies
- 📍 **Geo-location**: Credential-free GeoIP with auto-download (no MaxMind account needed)
- 🔄 **Event-Driven**: Redis Streams for asynchronous processing
- 💾 **Automated Backups**: Hourly and daily database backups

## 📋 Prerequisites

- [Bun](https://bun.sh) >= 1.0
- [Docker](https://www.docker.com/) and Docker Compose

## 🛠️ Quick Start

### 1. Clone and Install

```bash
git clone https://github.com/yourusername/urlfy.cc.git
cd urlfy.cc
bun install
```

### 2. Configure Environment

```bash
cp .env.example .env
```

Edit `.env` and configure:

- `BETTER_AUTH_SECRET` (generate with `openssl rand -base64 32`)
- `INTERNAL_API_SECRET` (generate with `openssl rand -hex 32`)
- `DATABASE_URL` (use strong password in production)

**Note:** GeoIP works automatically - no credentials needed!

### 3. Start Infrastructure

```bash
bun run docker:up
```

This will start:

- PostgreSQL 16
- Redis 7
- GeoIP updater
- Backup scheduler

**Optional: Enable Observability (SigNoz)**

For full observability with traces, metrics, and logs:

```bash
# 1. Clone SigNoz (one-time setup)
bun run signoz:clone

# 2. Start SigNoz stack
bun run signoz:up

# 3. Start urlfy with SigNoz integration
bun run docker:up:signoz
```

SigNoz dashboard will be available at [http://localhost:8080](http://localhost:8080).

For local development with SigNoz, ensure your `.env` has:

```ini
TELEMETRY_ENABLED=true
OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318
OTEL_SERVICE_NAME=urlfy-api-local
```

See [docs/architecture/signoz-setup.md](docs/architecture/signoz-setup.md) for detailed setup instructions.

### 4. Run Database Migrations

```bash
bun run db:generate
bun run db:migrate
```

### 5. Start Development Server

```bash
bun dev
```

This starts:

- **Next.js app** on http://localhost:3000 (with hot reload)
- **Worker processes** for analytics (with auto-reload)

Both run concurrently with color-coded logs.

Open [http://localhost:3000](http://localhost:3000)

## 🐳 Docker Commands

```bash
# Start all services
bun run docker:up

# Stop all services
bun run docker:down

# View logs
bun run docker:logs

# Rebuild containers
bun run docker:build

# Restart app only
bun run docker:restart
```

## 📊 Monitoring

### SigNoz Dashboard

If you've started SigNoz (see setup instructions above):

- **URL**: [http://localhost:8080](http://localhost:8080) (not 3301 - that's an old port)
- **Features**: Traces, metrics, and logs unified in one platform
- **Service Name**: `urlfy-api` (or `urlfy-api-local` for local dev)

To verify telemetry is working:

```bash
# Make a test request
curl http://localhost:3000/api/health

# Check if traces appear in SigNoz (wait 10-30 seconds)
# Navigate to Services → urlfy-api
```

### Health Endpoints

```bash
# Simple health check
curl http://localhost:3000/api/health

# Readiness check (dependencies)
curl http://localhost:3000/api/health/ready

# Detailed health (admin only)
curl -H "x-api-key: your_admin_key" \
  http://localhost:3000/api/health/detailed
```

### Worker Status (Redis Streams)

```bash
# Check stream lengths and consumer groups
curl -H "x-api-key: your_admin_key" \
  http://localhost:3000/api/admin/queues
```

## 🏗️ Architecture

### Components

- **Next.js 16+**: Server-side rendering and API routes
- **ElysiaJS**: Type-safe REST API framework
- **Bun Runtime**: Native Redis, SQL, and performance optimizations
- **PostgreSQL 16**: Primary database with partitioning
- **Redis 7**: Caching and event streaming (Streams API)
- **OpenTelemetry + SigNoz**: Distributed tracing and observability

### Event-Driven Processing

The application uses **Redis Streams** for asynchronous event processing:

```
User Request → API → Redis XADD → Stream
                                     ↓
                                  Worker ← XREADGROUP
                                     ↓
                                PostgreSQL
```

**Workers run in a separate process** (`src/workers.ts`) for:

- Click analytics processing
- Daily aggregations
- Cleanup jobs
- GDPR data deletions

See [REDIS-STREAMS-GUIDE.md](./docs/REDIS-STREAMS-GUIDE.md) for details.

## 📁 Project Structure

```
urlfy.cc/
├── docker/               # Docker configuration
│   ├── docker-compose.yml
│   ├── Dockerfile
│   └── ...
├── docs/                 # Documentation
│   ├── prd.md           # Product Requirements
│   ├── architecture/    # Architecture docs
│   └── modules/         # Implementation modules
├── scripts/             # Utility scripts
│   └── backup.sh
├── src/
│   ├── app/             # Next.js App Router
│   ├── db/              # Database schemas (Drizzle)
│   ├── lib/             # Shared utilities
│   └── server/          # Backend logic
│       ├── api/         # ElysiaJS routes
│       └── lib/         # Server utilities
└── ...
```

## 🔧 Development

### Database Operations

```bash
# Generate migration
bun run db:generate

# Apply migrations
bun run db:migrate

# Push schema (dev only)
bun run db:push
```

### Code Quality

```bash
# Lint and format check
bun run lint

# Auto-format
bun run format
```

## 📚 Documentation

- [PRD (Product Requirements)](./docs/prd.md)
- [Architecture Overview](./docs/architecture/overview.md)
- [Database Schema](./docs/architecture/database-schema.md)
- [Caching Strategy](./docs/architecture/caching-strategy.md)
- [Security](./docs/architecture/security.md)
- [API Reference](./docs/api/endpoints.md)
- [Disaster Recovery](./docs/architecture/disaster-recovery.md)

## 🗺️ Roadmap

- [x] **Module 1**: Infrastructure & Core Setup
- [ ] **Module 2**: Authentication & Identity (Better-Auth)
- [ ] **Module 3**: Links Management (CRUD)
- [ ] **Module 4**: Redirect Engine (Hot Path)
- [ ] **Module 5**: Analytics & Data Processing
- [ ] **Module 6**: Security & Compliance
- [ ] **Module 7**: User Interface

See [Implementation Plan](./docs/implementation-plan.md) for details.

## 🧪 Testing

```bash
# Unit tests (coming soon)
bun test

# E2E tests (coming soon)
bun test:e2e
```

## 📦 Production Deployment

### Build Production Image

```bash
cd docker
docker-compose -f docker-compose.yml build
```

### Environment Variables

Ensure the following are set in production:

- `NODE_ENV=production`
- Strong `ADMIN_API_KEY`
- Valid MaxMind credentials
- Secure database credentials
- External backup storage configuration

See [Disaster Recovery](./docs/architecture/disaster-recovery.md) for backup strategies.

## 🛡️ Security

- IP anonymization (SHA-256 with weekly salt rotation)
- Private IP detection
- LGPD/GDPR compliant data handling
- Automated backup retention
- Health check dependency validation

## 📝 License

MIT

## 🤝 Contributing

This is a portfolio project. Issues and PRs are welcome for learning purposes.

## 📧 Contact

Gustavo Sotero - [Your Contact]

---

**Status**: Module 1 (Infrastructure) - ✅ Complete  
**Next**: Module 2 (Authentication) - 🚧 In Progress
