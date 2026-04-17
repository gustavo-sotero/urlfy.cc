# Rollback Runbook (Monorepo Big Bang)

## Scope

This runbook defines rollback actions for the multi-service deployment:

- `web` (Next.js)
- `api` (Elysia)
- `worker` (Bun workers)
- `migrate` (one-shot migration job)

The goal is to restore the previous known-good release quickly when a critical regression is detected.

## Rollback Triggers

Trigger immediate rollback when one or more of these conditions happen after deploy:

- Redirect error rate exceeds SLO threshold.
- Redirect latency P99 is critically degraded.
- Auth/session cross-service flow fails for valid users.
- Same-origin `/api/*` routing cannot reach `api` service consistently.
- Worker lag grows and analytics ingestion stalls.

## Required Inputs

Before rollback, collect and store:

- Previous stable image tags for `web`, `api`, `worker`.
- Current failing image tags.
- Last successful commit SHA.
- Incident timestamp and observed symptoms.

## Fast Rollback Procedure

1. Scale down failing services in orchestrator (Dokploy/Compose target stack).
2. Re-point `web`, `api`, and `worker` to previous stable image tags.
3. Keep `migrate` disabled during rollback unless schema rollback is explicitly required.
4. Re-apply environment variables from the previous stable release (including internal URLs and auth secrets).
5. Start `api`, then `web`, then `worker`.
6. Validate health checks:
   - `GET /ops/health`
   - `GET /ops/health/ready`
   - `GET /api/health`
   - `GET /api/health/ready`
   - sample redirect request `/:code` (through `web`)
7. Confirm critical paths:
   - redirect hot path
   - sign-in/session validation
   - API key protected endpoint

## Data and Migration Safety

- Prefer forward-only migrations in production.
- If the failing release introduced schema changes, avoid destructive rollback SQL unless tested.
- If application rollback is compatible with current schema, rollback only service images.
- If schema incompatibility exists, perform controlled DB restore according to DR policy.

## Post-Rollback Verification Checklist

- `web` healthy and serving pages.
- `api` healthy and returning envelopes with `requestId`.
- Redirect path latency returns to baseline range.
- Worker consumers connected and processing streams.
- No spike in `5xx` after rollback.

## Communication Checklist

- Mark incident as mitigated with rollback timestamp.
- Record image tags rolled back to.
- Record root cause hypothesis and next fix window.
- Open follow-up issue for permanent fix before next deploy.

## Suggested Commands (Local Compose Validation)

```bash
# Stop current app stack
cd docker
docker compose -f docker-compose.prod.yml down

# Re-deploy previous tagged images (adjust compose or env as needed)
docker compose -f docker-compose.prod.yml up -d

# Check service health
docker compose -f docker-compose.prod.yml ps
```
