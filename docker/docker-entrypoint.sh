#!/bin/sh
# ═══════════════════════════════════════════════════════════════════
# Docker Entrypoint - urlfy.cc
# ═══════════════════════════════════════════════════════════════════
# Runs database migrations before starting the application.
# Environment variables:
#   SKIP_MIGRATIONS=true  - Skip migrations (useful for rollback)
#   MIGRATION_ONLY=true   - Run migrations and exit (CI/CD use)
#   MIGRATION_TIMEOUT=30  - Max seconds to wait for DB (default: 30)
# ═══════════════════════════════════════════════════════════════════

set -e

MIGRATION_TIMEOUT="${MIGRATION_TIMEOUT:-30}"

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

  elapsed=0
  while [ "$elapsed" -lt "$MIGRATION_TIMEOUT" ]; do
    # Use bun to test the DB connection with a simple query
    if bun -e "
      const { SQL } = require('bun');
      try {
        const sql = new SQL({ url: process.env.DATABASE_URL, connectionTimeout: 3 });
        await sql.unsafe('SELECT 1');
        process.exit(0);
      } catch { process.exit(1); }
    " 2>/dev/null; then
      log_ok "Database is ready"
      return 0
    fi

    elapsed=$((elapsed + 2))
    sleep 2
  done

  log_error "Database not ready after ${MIGRATION_TIMEOUT}s"
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
