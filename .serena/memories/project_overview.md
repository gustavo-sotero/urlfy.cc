Project purpose: urlfy.cc is a high-performance, self-hosted URL shortener with analytics, built for portfolio use. Core capabilities include short link creation, redirect engine, observability, GeoIP, and compliance.

Tech stack: Bun runtime, Next.js 16 App Router, ElysiaJS API, PostgreSQL 16 (Drizzle ORM), Redis 7 (Bun redis + ioredis for BullMQ), BullMQ queues, OpenTelemetry + SigNoz, TailwindCSS + Shadcn UI, TypeScript strict.

Architecture notes: API routes mounted via Elysia in src/app/api/[[...slugs]]/route.ts; server logic in src/server; db schemas in src/db/schema; middleware in src/server/middleware; shared utilities in src/lib.

Environment: Windows. Use Bun for scripts and package management.