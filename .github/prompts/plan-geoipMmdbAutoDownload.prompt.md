# GeoIP MMDB Auto-Download Plan (No Credentials)

## Objective

Implement a credential-free, automated GeoIP MMDB download and refresh system that:

- Downloads the MMDB file automatically on `docker-compose up`.
- Uses a public GitHub mirror (no MaxMind credentials required).
- Skips download if the file already exists and is fresh.
- Performs a scheduled refresh on the 1st of each month.
- Re-downloads if the existing file age exceeds `GEOIP_MAX_AGE_DAYS`.
- Keeps existing MMDB reader intact, simply updates the path/env wiring.

## Non-Goals

- Do not modify the GeoIP lookup logic beyond path/env integration.
- Do not change analytics schema or behavior.
- Do not add MaxMind credentials support back into the stack.

## Constraints & Requirements

- Runtime: Bun + Next.js + Elysia.
- Compose files live under `docker/`.
- GeoIP database must be MMDB format.
- Config via `GEOIP_DB_PATH` and `GEOIP_MAX_AGE_DAYS`.
- No credentials or external auth required.
- Must be safe, idempotent, and reproducible.

## Proposed Public MMDB Source (Selected)

Use **wp-statistics/GeoLite2-City** via jsDelivr CDN. This source is actively maintained, updated multiple times per week, and does not require authentication.

**Direct download (compressed MMDB):**

```
https://cdn.jsdelivr.net/npm/geolite2-city/GeoLite2-City.mmdb.gz
```

**Why this source:**

- MMDB format (compatible with `@maxmind/geoip2-node`).
- Stable CDN URL (jsDelivr) suitable for automation.
- Updated Tuesday & Friday at 06:00 UTC (per repo documentation).
- No API keys required.
- License: CC BY-SA 4.0 + MaxMind attribution required.

**Usage requirements:**

- Download the `.mmdb.gz` file, then **decompress** to `GeoLite2-City.mmdb`.
- Store at `GEOIP_DB_PATH` (default `/app/geoip/GeoLite2-City.mmdb`).
- Include attribution in documentation or UI where appropriate (see license).

## Implementation Steps

### 1) Environment Variables & Validation

Update environment schema to include the new variables.

**Add or confirm:**

- `GEOIP_DB_PATH` (string, default `/app/geoip/GeoLite2-City.mmdb`).
- `GEOIP_MAX_AGE_DAYS` (number, default `25`).

**Type-safe env wiring**

- Validate `GEOIP_MAX_AGE_DAYS` as integer > 0.
- Ensure `GEOIP_DB_PATH` is a valid absolute path.

```ts
// Pseudocode
const env = {
  GEOIP_DB_PATH: z.string().default('/app/geoip/GeoLite2-City.mmdb'),
  GEOIP_MAX_AGE_DAYS: z.coerce.number().int().positive().default(25)
};
```

### 2) Downloader Container (Monthly Job)

Replace `geoipupdate` service with a custom downloader service in all compose files.

**Behavior:**

- On container start:
  - If `GEOIP_DB_PATH` exists and is newer than `GEOIP_MAX_AGE_DAYS`, exit successfully.
  - Otherwise download the MMDB file from the mirror URL.
- Schedule a monthly cron job at `0 0 1 * *` (1st day, midnight UTC) to run the same check.

**Implementation options:**

- **Alpine + curl + cron** (minimal image).
- **BusyBox + wget + crond**.

**Suggested shell script (download/refresh logic):**

```sh
#!/usr/bin/env sh
set -euo pipefail

DB_PATH="${GEOIP_DB_PATH:-/app/geoip/GeoLite2-City.mmdb}"
MAX_AGE_DAYS="${GEOIP_MAX_AGE_DAYS:-25}"
MIRROR_URL="${GEOIP_MMDB_URL:-https://cdn.jsdelivr.net/npm/geolite2-city/GeoLite2-City.mmdb.gz}"

mkdir -p "$(dirname "$DB_PATH")"

if [ -f "$DB_PATH" ]; then
  # Find age in days
  NOW_TS=$(date +%s)
  FILE_TS=$(date -r "$DB_PATH" +%s)
  AGE_DAYS=$(( (NOW_TS - FILE_TS) / 86400 ))

  if [ "$AGE_DAYS" -lt "$MAX_AGE_DAYS" ]; then
    echo "GeoIP MMDB is fresh ($AGE_DAYS days old). Skipping download."
    exit 0
  fi
fi

TMP_PATH="$DB_PATH.tmp.gz"

echo "Downloading GeoIP MMDB from $MIRROR_URL"
# Prefer curl with retries and timeout
curl -fsSL --retry 3 --retry-delay 3 --max-time 60 -o "$TMP_PATH" "$MIRROR_URL"

# Decompress and atomic replace
gzip -d -c "$TMP_PATH" > "$DB_PATH.tmp"
mv "$DB_PATH.tmp" "$DB_PATH"
rm -f "$TMP_PATH"

echo "GeoIP MMDB updated at $DB_PATH"
```

**Cron entry:**

```cron
0 0 1 * * /usr/local/bin/geoip-refresh.sh >> /var/log/geoip-refresh.log 2>&1
```

**Container entrypoint:**

- Run the script once at startup.
- Start cron in foreground.

### 3) Compose Integration

Apply changes in all compose variants:

- `docker/docker-compose.yml`
- `docker/docker-compose.dev.yml`
- `docker/docker-compose.prod.yml`

**Key changes:**

- Remove `geoipupdate` service and env variables (`MAXMIND_*`).
- Add `geoip-downloader` service with:
  - `GEOIP_DB_PATH`
  - `GEOIP_MAX_AGE_DAYS`
  - `GEOIP_MMDB_URL`
  - Volume mount: `geoip_data:/app/geoip`
- Ensure `app` service continues mounting `geoip_data:/app/geoip:ro`.

### 4) MMDB Reader Wiring

Keep the existing MMDB reader library; ensure it reads from `GEOIP_DB_PATH`.

- Confirm import/path usage in GeoIP reader module.
- Avoid hardcoded MaxMind filename if it conflicts.
- Use a single source of truth from env.

**Example:**

```ts
const dbPath = env.GEOIP_DB_PATH;
const reader = await Reader.open(dbPath);
```

### 5) Documentation Updates

Update docs to remove MaxMind credential requirements and describe the new flow.

**Targets:**

- `docs/architecture/overview.md`
- `docs/architecture/security.md`
- `docs/architecture/database-schema.md`
- `docs/prd.md`

**Doc changes:**

- Replace MaxMind credential references with mirror-based MMDB download.
- Document `GEOIP_MAX_AGE_DAYS` and the monthly update schedule.
- Mention the downloader container in the compose diagram/stack table.

## Configuration Summary

Add/confirm these env variables:

```env
GEOIP_DB_PATH=/app/geoip/GeoLite2-City.mmdb
GEOIP_MAX_AGE_DAYS=25
GEOIP_MMDB_URL=https://cdn.jsdelivr.net/npm/geolite2-city/GeoLite2-City.mmdb.gz
```

## Operational Considerations

- **Idempotency:** Script is safe to run repeatedly.
- **Atomicity:** Download to temp path then move.
- **Resilience:** Use retries and timeouts for download.
- **Observability:** Log refresh attempts and failures (stdout/stderr).

## Validation Checklist

- `docker-compose up` triggers MMDB download on first run.
- Existing MMDB file skips download if age < `GEOIP_MAX_AGE_DAYS`.
- Cron job runs monthly and refreshes if outdated.
- App can resolve GeoIP data successfully with new file.
- Docs no longer mention MaxMind credentials.

## Quality & Typing Guidance

- Use strict typing for env values (`number`, `string`).
- Validate `GEOIP_MAX_AGE_DAYS` as positive integer.
- Centralize env access in `env` module to avoid drift.
- Avoid magic paths in reader logic.

## Risks & Mitigations

- **Mirror URL volatility:** Pin to a stable release or add checksum validation.
- **License changes:** Document the mirror source and verify redistribution terms.
- **Clock skew:** Use container time in UTC for age calculation.

---

Ready for implementation: this plan defines the data flow, config, and file-level changes required while preserving the existing MMDB reader pipeline.
