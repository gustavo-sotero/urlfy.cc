# Getting Started with urlfy.cc Development

This guide will help you set up your development environment for the urlfy.cc project.

## Prerequisites

### Required Software

1. **Bun Runtime** (>= 1.0)

   ```bash
   # macOS/Linux
   curl -fsSL https://bun.sh/install | bash

   # Windows
   powershell -c "irm bun.sh/install.ps1 | iex"
   ```

2. **Docker & Docker Compose**

   - Download from [docker.com](https://www.docker.com/products/docker-desktop)
   - Verify installation:
     ```bash
     docker --version
     docker-compose --version
     ```

3. **MaxMind Account** (Free)
   - Sign up at [maxmind.com/en/geolite2/signup](https://www.maxmind.com/en/geolite2/signup)
   - Generate a license key
   - Save your Account ID and License Key

## Initial Setup

### 1. Clone the Repository

```bash
git clone https://github.com/yourusername/urlfy.cc.git
cd urlfy.cc
```

### 2. Install Dependencies

```bash
bun install
```

This will install all Node.js dependencies including:

- Next.js 16
- ElysiaJS
- Drizzle ORM
- BullMQ
- OpenTelemetry
- And more...

### 3. Configure Environment

```bash
# Copy the example environment file
cp .env.example .env
```

Edit `.env` and configure the following **required** variables:

```env
# MaxMind GeoIP (REQUIRED)
MAXMIND_ACCOUNT_ID=your_account_id_here
MAXMIND_LICENSE_KEY=your_license_key_here

# Admin API Key (REQUIRED for admin endpoints)
ADMIN_API_KEY=change_me_in_production
```

Other variables have sensible defaults for local development.

### 4. Start Docker Infrastructure

```bash
bun run docker:up
```

This command starts:

- **PostgreSQL 16**: Database (port 5432)
- **Redis 7**: Cache (port 6379)
- **SigNoz**: Observability platform (ports 3301, 4317, 4318)
- **GeoIP Updater**: MaxMind database sync
- **Backup Scheduler**: Automated database backups

Wait for all services to be healthy (about 1-2 minutes on first run).

### 5. Initialize Database

```bash
# Generate Drizzle migrations
bun run db:generate

# Apply migrations
bun run db:migrate
```

### 6. Start Development Server

```bash
bun dev
```

The application will be available at [http://localhost:3000](http://localhost:3000)

## Verify Installation

### 1. Check Services

```bash
# Check all Docker services are running
cd docker && docker-compose ps

# You should see all services as "Up" and "healthy"
```

### 2. Test Health Endpoints

```bash
# Simple health check
curl http://localhost:3000/api/v1/health
# Expected: {"status":"ok","timestamp":"..."}

# Readiness check (tests DB and Redis)
curl http://localhost:3000/api/v1/health/ready
# Expected: {"status":"ready","services":{"database":"ok","redis":"ok"}}

# Detailed health (requires admin API key)
curl -H "x-api-key: your_admin_key" http://localhost:3000/api/v1/health/detailed
# Expected: Detailed metrics for all services
```

### 3. Access SigNoz Dashboard

Open [http://localhost:3301](http://localhost:3301) in your browser.

You should see the SigNoz observability dashboard.

## Development Workflow

### Running the App

```bash
# Development mode with hot reload
bun dev

# Production build
bun run build

# Start production server
bun start
```

### Database Operations

```bash
# Generate new migration
bun run db:generate

# Apply migrations
bun run db:migrate

# Push schema directly (dev only, no migration files)
bun run db:push

# Open Drizzle Studio (database GUI)
bunx drizzle-kit studio
```

### Docker Operations

```bash
# Start all services
bun run docker:up

# Stop all services
bun run docker:down

# View logs (all services)
bun run docker:logs

# View logs (specific service)
cd docker && docker-compose logs -f postgres

# Restart app container only
bun run docker:restart

# Rebuild containers
bun run docker:build
```

### Code Quality

```bash
# Check for lint errors
bun run lint

# Auto-format code
bun run format
```

## Project Structure

```
urlfy.cc/
├── docker/                      # Docker configuration
│   ├── docker-compose.yml       # Service orchestration
│   ├── Dockerfile               # App container
│   └── ...
├── docs/                        # Documentation
│   ├── prd.md                   # Product requirements
│   ├── architecture/            # Architecture docs
│   ├── api/                     # API reference
│   └── modules/                 # Implementation guides
├── scripts/                     # Utility scripts
│   └── backup.sh                # Database backup
├── src/
│   ├── app/                     # Next.js App Router
│   │   ├── api/[[...slugs]]/   # ElysiaJS catch-all
│   │   ├── layout.tsx           # Root layout
│   │   └── page.tsx             # Home page
│   ├── db/                      # Database layer
│   │   ├── index.ts             # Drizzle instance
│   │   ├── schema.ts            # Schema exports
│   │   └── schema/              # Schema definitions
│   │       └── auth.ts          # Auth tables (Better-Auth)
│   ├── lib/                     # Shared utilities
│   │   ├── auth.ts              # Better-Auth config (runtime)
│   │   └── auth.cli.ts          # Better-Auth config (CLI)
│   └── server/                  # Backend logic
│       ├── api/                 # ElysiaJS routes
│       │   ├── index.ts         # API router
│       │   └── health.ts        # Health endpoints
│       ├── lib/                 # Server utilities
│       │   ├── db.ts            # Database connection
│       │   ├── redis.ts         # Redis client
│       │   ├── queue.ts         # BullMQ queues
│       │   ├── telemetry.ts    # OpenTelemetry
│       │   ├── metrics.ts       # Custom metrics
│       │   └── geoip.ts         # GeoIP lookup
│       └── init.ts              # Server initialization
└── ...
```

## Common Tasks

### Adding a New API Endpoint

1. Create a new route file in `src/server/api/`:

   ```typescript
   // src/server/api/example.ts
   import { Elysia } from 'elysia';

   export const exampleRoutes = new Elysia({ prefix: '/api/v1' }).get(
     '/example',
     () => {
       return { message: 'Hello World' };
     }
   );
   ```

2. Register in `src/server/api/index.ts`:

   ```typescript
   import { exampleRoutes } from './example';

   export const api = new Elysia({ prefix: '/api' })
     .use(healthRoutes)
     .use(exampleRoutes);
   ```

3. Test:
   ```bash
   curl http://localhost:3000/api/v1/example
   ```

### Adding a New Database Table

1. Create schema in `src/db/schema/`:

   ```typescript
   // src/db/schema/example.ts
   import { pgTable, text, timestamp } from 'drizzle-orm/pg-core';

   export const examples = pgTable('examples', {
     id: text('id').primaryKey(),
     name: text('name').notNull(),
     createdAt: timestamp('created_at').defaultNow().notNull()
   });
   ```

2. Export from `src/db/schema.ts`:

   ```typescript
   export * from './schema/example';
   ```

3. Generate and apply migration:
   ```bash
   bun run db:generate
   bun run db:migrate
   ```

### Viewing Logs

```bash
# Application logs
cd docker && docker-compose logs -f app

# PostgreSQL logs
cd docker && docker-compose logs -f postgres

# Redis logs
cd docker && docker-compose logs -f redis

# All logs
cd docker && docker-compose logs -f
```

### Backing Up Database Manually

```bash
# Trigger manual backup
docker exec urlfy-backup /backup.sh

# List backups
docker exec urlfy-backup ls -lh /backups

# Restore from backup
gunzip -c /path/to/backup.sql.gz | docker exec -i urlfy-postgres psql -U urlfy -d urlfy
```

## Troubleshooting

### Services Not Starting

```bash
# Check service status
cd docker && docker-compose ps

# Check logs for errors
cd docker && docker-compose logs

# Restart specific service
cd docker && docker-compose restart postgres

# Full restart
bun run docker:down
bun run docker:up
```

### Database Connection Issues

```bash
# Test database connection
docker exec urlfy-postgres psql -U urlfy -d urlfy -c "SELECT 1"

# Check database logs
cd docker && docker-compose logs postgres
```

### Redis Connection Issues

```bash
# Test Redis
docker exec urlfy-redis redis-cli ping

# Check Redis logs
cd docker && docker-compose logs redis
```

### Port Already in Use

If you see errors about ports being in use:

```bash
# Find process using port 3000 (example)
lsof -i :3000  # macOS/Linux
netstat -ano | findstr :3000  # Windows

# Kill the process or change the port in .env
PORT=3001 bun dev
```

### GeoIP Not Working

```bash
# Check if GeoIP database exists
docker exec urlfy-app ls -lh /app/geoip/

# Check GeoIP updater logs
cd docker && docker-compose logs geoipupdate

# Manually trigger update
cd docker && docker-compose restart geoipupdate
```

## Next Steps

1. ✅ **You're ready to develop!**
2. 📖 Read the [Architecture Overview](./docs/architecture/overview.md)
3. 🚀 Start implementing Module 2 (Authentication)
4. 📊 Explore SigNoz dashboards at http://localhost:3301

## Getting Help

- Check the [Documentation](./docs/)
- Review [Module 1 Status](./docs/modules/MODULE-01-STATUS.md)
- See [Implementation Plan](./docs/implementation-plan.md)

## Additional Resources

- [Next.js Documentation](https://nextjs.org/docs)
- [ElysiaJS Documentation](https://elysiajs.com/)
- [Drizzle ORM Documentation](https://orm.drizzle.team/)
- [BullMQ Documentation](https://docs.bullmq.io/)
- [SigNoz Documentation](https://signoz.io/docs/)

Happy coding! 🚀
