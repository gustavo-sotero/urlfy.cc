#!/bin/sh
# ═══════════════════════════════════════════════════════════════════
# Docker Entrypoint - urlfy.cc
# ═══════════════════════════════════════════════════════════════════
# 1. Replaces NEXT_PUBLIC_* build-time placeholders with runtime values
# 2. Runs database migrations before starting the application
#
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

# ─── Replace NEXT_PUBLIC_* build-time values with runtime env ─────
# Next.js inlines NEXT_PUBLIC_* at build time. If the runtime env
# differs from the build arg (e.g. same image, different domain),
# this step patches the built JS files so the app picks up the
# actual runtime value.
# ──────────────────────────────────────────────────────────────────

replace_next_public_env() {
  # Only run if NEXT_PUBLIC_APP_URL is set at runtime
  if [ -z "${NEXT_PUBLIC_APP_URL}" ]; then
    log_info "NEXT_PUBLIC_APP_URL not set — skipping runtime env replacement"
    return 0
  fi

  # Check if .next directory exists
  if [ ! -d /app/.next ]; then
    log_warn ".next directory not found — skipping runtime env replacement"
    return 0
  fi

  # Read the build-time value (written by Dockerfile during build)
  BUILD_URL=""
  if [ -f /app/.next/BUILD_NEXT_PUBLIC_APP_URL ]; then
    BUILD_URL=$(cat /app/.next/BUILD_NEXT_PUBLIC_APP_URL | tr -d '[:space:]')
  fi

  # If build-time value matches runtime value, skip replacement
  if [ "${BUILD_URL}" = "${NEXT_PUBLIC_APP_URL}" ]; then
    log_info "NEXT_PUBLIC_APP_URL matches build value — no replacement needed"
    return 0
  fi

  # Determine what to replace (build-time value or default localhost)
  if [ -n "${BUILD_URL}" ]; then
    SEARCH_PATTERN="${BUILD_URL}"
  else
    SEARCH_PATTERN="http://localhost:3000"
  fi

  log_info "Replacing '${SEARCH_PATTERN}' -> '${NEXT_PUBLIC_APP_URL}' in .next files..."

  count=$(grep -rl "${SEARCH_PATTERN}" /app/.next/ 2>/dev/null | wc -l || true)
  if [ "$count" -gt 0 ]; then
    grep -rl "${SEARCH_PATTERN}" /app/.next/ 2>/dev/null | while read -r file; do
      sed -i "s|${SEARCH_PATTERN}|${NEXT_PUBLIC_APP_URL}|g" "$file"
    done
    log_ok "Replaced NEXT_PUBLIC_APP_URL in ${count} files"
  else
    log_info "No files contained '${SEARCH_PATTERN}' — nothing to replace"
  fi
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

  # Step 0: Replace NEXT_PUBLIC_* build-time values with runtime env
  replace_next_public_env

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
