# AI Coding Agent Instructions for urlfy.cc

## 🧠 Project Architecture & Context

**urlfy.cc** is a high-performance, self-hosted URL shortener designed for scalability and speed.

- **Runtime**: [Bun](https://bun.sh) (v1.x+) - heavily leveraged for native APIs (SQL, Redis, Password hashing).
- **Frontend**: [Next.js 16+](https://nextjs.org) (App Router) - handles UI and localized routing.
- **API**: [ElysiaJS](https://elysiajs.com) - type-safe backend framework running _inside_ Next.js route handlers (`src/app/api/[[...slugs]]/route.ts`).
- **Database**: PostgreSQL 16 managed via [Drizzle ORM](https://orm.drizzle.team).
- **Cache**: Redis 7 (via `ioredis` / Bun native) for hot-path caching and rate limiting.
- **Async Processing**: [BullMQ](https://docs.bullmq.io) for analytics ingestion and background jobs.
- **Observability**: OpenTelemetry pushing to [SigNoz](https://signoz.io) (traces, metrics, logs).

## 🛠️ Critical Workflows

**Always use `bun`** for package management and scripts.

### 🐳 Docker & Infrastructure

- **Start Services**: `bun run docker:up` (Postgres, Redis, SigNoz).
- **Stop Services**: `bun run docker:down`.
- **Logs**: `bun run docker:logs`.

### 🗄️ Database Management

- **Generate Migrations**: `bun run db:generate` (after editing `src/db/schema/*.ts`).
- **Run Migrations**: `bun run db:migrate`.
- **Push Schema (Proto)**: `bun run db:push` (fast iteration, avoid in prod).
- **Seed Data**: `bun run db:seed`.

### 🧪 Testing

- **Unit Tests**: `bun test src/`.
- **Integration Tests**: `bun test tests/integration/`.
- **Security Check**: `bun run security:report`.

## 🧩 Code Patterns & Conventions

### 1. API Implementation (Elysia + Next.js)

- Define API routes in `src/server/api` using Elysia.
- The entry point is `src/app/api/[[...slugs]]/route.ts` which mounts the Elysia app.
- **Pattern**: Use Elysia for strict type safety and validation (TypeBox/Bun).
- **Do NOT** create traditional Next.js API Routes (`pages/api` or `route.ts` logic) unless specifically for Edge Middleware interop.

### 2. Database Access (Drizzle)

- **Schema**: Defined in `src/db/schema/` (split by domain: `auth.ts`, `links.ts`, etc.).
- **Access**: Import `db` from `@/db`.
- **Queries**: Prefer `db.query.tableName.findFirst` syntax for readability over raw SQL, unless performance dictates otherwise.

### 3. Asynchronous Workers (BullMQ)

- **Queues**: Defined in `src/server/lib/queue/`.
- **Workers**: Implemented in `src/server/workers/`.
- **Pattern**: Heavy writes (Analytics) must be offloaded to queues (`analytics-queue`).
- **Reliability**: Use "Dead Letter Queues" configuration for failed jobs.

### 4. Application Initialization

- **Server Init**: `src/server/init.ts` handles env validation and worker startup.
- **Environment**: Strict validation via `src/lib/env.ts` on startup.
- **Window Check**: Always check `if (typeof window === "undefined")` before initializing server-side heavy resources (DB/Redis connections) to prevent build-time crashes.

### 5. Authentication (Better-Auth)

- Configuration: `src/lib/auth.ts`.
- Adapters: Uses Drizzle adapter.
- **Pattern**: Use `auth.api.getSession` for server-side checks and `authClient` for client-side.

## 📂 Key Directories

- `src/app/api/[[...slugs]]`: The unified API gateway (Elysia integration).
- `src/db/schema`: Single source of truth for data models.
- `src/server`: Core backend logic (middleware, services, workers).
- `tests/integration`: End-to-end flow validation (critical for redirect engine).
- `.github/instructions`: Detailed module implementation plans.

## 🚫 Anti-Patterns

- **No Node.js APIs**: Prefer `Bun.*` APIs (e.g., `Bun.password`, `Bun.file`) where possible.
- **No Primitives in Components**: Extract logic to `src/lib` or `src/hooks`.
- **No Direct DB in UI Components**: Always fetch via the API layer or Server Actions (if applicable, but Elysia is preferred for this architecture).
