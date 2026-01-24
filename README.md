# urlfy.cc - URL Shortener

A high-performance, self-hosted URL shortener built with Next.js 16, ElysiaJS, Bun runtime, and PostgreSQL.

## 🚀 Features

- ⚡ **High Performance**: Bun runtime with native APIs for SQL and Redis
- 🐳 **100% Containerized**: Complete Docker Compose setup
- 📊 **Observability**: OpenTelemetry + SigNoz for traces, metrics, and logs
- 🔒 **LGPD/GDPR Compliant**: IP anonymization and data retention policies
- 📍 **Geo-location**: Offline GeoIP lookup with MaxMind GeoLite2
- 🔄 **Event-Driven**: BullMQ for asynchronous processing
- 💾 **Automated Backups**: Hourly and daily database backups

## 📋 Prerequisites

- [Bun](https://bun.sh) >= 1.0
- [Docker](https://www.docker.com/) and Docker Compose
- [MaxMind Account](https://www.maxmind.com/en/geolite2/signup) (free)

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

- `MAXMIND_ACCOUNT_ID` and `MAXMIND_LICENSE_KEY` (required for GeoIP)
- `ADMIN_API_KEY` (temporary admin access)

### 3. Start Infrastructure

```bash
bun run docker:up
```

This will start:

- PostgreSQL 16
- Redis 7
- SigNoz (observability platform)
- GeoIP updater
- Backup scheduler

### 4. Run Database Migrations

```bash
bun run db:generate
bun run db:migrate
```

### 5. Start Development Server

```bash
bun dev
```

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

- URL: [http://localhost:3301](http://localhost:3301)
- Traces, metrics, and logs unified
- Pre-configured for application monitoring

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

