#!/bin/sh
# ═══════════════════════════════════════════════════════════════════
# Docker Entrypoint - urlfy.cc
# ═══════════════════════════════════════════════════════════════════
# Runs database migrations before starting the application.
# Environment variables:
#   SKIP_MIGRATIONS=true  - Skip migrations (useful for rollback)
#   MIGRATION_ONLY=true   - Run migrations and exit (CI/CD use)
#   MIGRATION_TIMEOUT=30  - Max seconds to wait for DB (default: 30)
#   DB_CHECK_TIMEOUT=5    - Per-attempt DB connect timeout in seconds (default: 5)
#   DB_CHECK_SLEEP=2      - Seconds to sleep between attempts (default: 2)
# ═══════════════════════════════════════════════════════════════════

set -e

MIGRATION_TIMEOUT="${MIGRATION_TIMEOUT:-30}"
DB_CHECK_TIMEOUT="${DB_CHECK_TIMEOUT:-5}"
DB_CHECK_SLEEP="${DB_CHECK_SLEEP:-2}"

# ─── Helpers ──────────────────────────────────────────────────────

log_info() {
  echo "[entrypoint] ℹ️  $1"
}

log_ok() {
  echo "[entrypoint] ✅ $1"
}

log_warn() {
  echo "[entrypoint] ⚠️  $1"
}

log_error() {
  echo "[entrypoint] ❌ $1"
}

# ─── Wait for Database ────────────────────────────────────────────

wait_for_database() {
  log_info "Waiting for database to be ready (timeout: ${MIGRATION_TIMEOUT}s)..."

  start_ts=$(date +%s)
  deadline_ts=$((start_ts + MIGRATION_TIMEOUT))

  attempt=1
  last_error=""
  while [ "$(date +%s)" -lt "$deadline_ts" ]; do
    # Use a proper TypeScript file to test connectivity (avoids bun -e import issues)
    output=$(DB_CHECK_TIMEOUT="${DB_CHECK_TIMEOUT}" bun run /app/db-check.ts 2>&1) && {
      log_ok "Database is ready"
      return 0
    }

    last_error="$output"
    log_warn "Database not ready yet (attempt ${attempt})"
    attempt=$((attempt + 1))
    sleep "$DB_CHECK_SLEEP"
  done

  log_error "Database not ready after ${MIGRATION_TIMEOUT}s"
  if [ -n "$last_error" ]; then
    log_error "Last error: $last_error"
  fi
  return 1
}

# ─── Run Migrations ──────────────────────────────────────────────

run_migrations() {
  if [ "${SKIP_MIGRATIONS}" = "true" ]; then
    log_warn "SKIP_MIGRATIONS=true — skipping database migrations"
    return 0
  fi

  log_info "Running database migrations..."

  if bun run /app/migrate.ts; then
    log_ok "Migrations completed successfully"
    return 0
  else
    log_error "Migration failed!"
    return 1
  fi
}

# ─── Main ─────────────────────────────────────────────────────────

main() {
  log_info "Starting urlfy.cc entrypoint..."
  log_info "NODE_ENV=${NODE_ENV:-development}"

  # Step 1: Wait for database
  if ! wait_for_database; then
    log_error "Cannot proceed without database connection"
    exit 1
  fi

  # Step 2: Run migrations
  if ! run_migrations; then
    log_error "Cannot proceed with failed migrations"
    exit 1
  fi

  # Step 3: If MIGRATION_ONLY, exit now (used in CI/CD pipelines)
  if [ "${MIGRATION_ONLY}" = "true" ]; then
    log_ok "MIGRATION_ONLY=true — migrations done, exiting"
    exit 0
  fi

  # Step 4: Start the application
  log_info "Starting application..."
  exec "$@"
}

main "$@"
