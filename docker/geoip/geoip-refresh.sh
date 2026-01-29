#!/usr/bin/env sh
# ═══════════════════════════════════════════════════════════════════
# GeoIP MMDB Auto-Download and Refresh Script
# ═══════════════════════════════════════════════════════════════════
# 
# Downloads GeoLite2-City MMDB from public mirror (jsDelivr CDN)
# without requiring MaxMind credentials.
#
# Features:
# - Skips download if existing file is fresh (< MAX_AGE_DAYS)
# - Atomic file replacement (download to temp, then move)
# - Retries and timeout for reliability
# - Logs to stdout for container monitoring
#
# Source: https://cdn.jsdelivr.net/npm/geolite2-city/GeoLite2-City.mmdb.gz
# License: CC BY-SA 4.0 (MaxMind GeoLite2)
# ═══════════════════════════════════════════════════════════════════

set -euo pipefail

# ═══════════════════════════════════════════════════════════════════
# CONFIGURATION
# ═══════════════════════════════════════════════════════════════════

DB_PATH="${GEOIP_DB_PATH:-/app/geoip/GeoLite2-City.mmdb}"
MAX_AGE_DAYS="${GEOIP_MAX_AGE_DAYS:-25}"
MIRROR_URL="${GEOIP_MMDB_URL:-https://cdn.jsdelivr.net/npm/geolite2-city/GeoLite2-City.mmdb.gz}"

echo "═══════════════════════════════════════════════════════════════════"
echo "GeoIP MMDB Refresh Script"
echo "═══════════════════════════════════════════════════════════════════"
echo "Database Path: $DB_PATH"
echo "Max Age (days): $MAX_AGE_DAYS"
echo "Mirror URL: $MIRROR_URL"
echo "═══════════════════════════════════════════════════════════════════"

# ═══════════════════════════════════════════════════════════════════
# CREATE DIRECTORY
# ═══════════════════════════════════════════════════════════════════

mkdir -p "$(dirname "$DB_PATH")"

# ═══════════════════════════════════════════════════════════════════
# CHECK FILE FRESHNESS
# ═══════════════════════════════════════════════════════════════════

if [ -f "$DB_PATH" ]; then
  # Calculate file age in days
  NOW_TS=$(date +%s)
  FILE_TS=$(stat -c %Y "$DB_PATH" 2>/dev/null || stat -f %m "$DB_PATH" 2>/dev/null || echo 0)
  
  if [ "$FILE_TS" -gt 0 ]; then
    AGE_DAYS=$(( (NOW_TS - FILE_TS) / 86400 ))
    
    echo "Existing MMDB file found (age: $AGE_DAYS days)"
    
    if [ "$AGE_DAYS" -lt "$MAX_AGE_DAYS" ]; then
      echo "✅ GeoIP MMDB is fresh. Skipping download."
      exit 0
    fi
    
    echo "⚠️  MMDB file is outdated (age: $AGE_DAYS days, max: $MAX_AGE_DAYS days)"
  fi
fi

# ═══════════════════════════════════════════════════════════════════
# DOWNLOAD MMDB
# ═══════════════════════════════════════════════════════════════════

TMP_GZ_PATH="$DB_PATH.tmp.gz"
TMP_MMDB_PATH="$DB_PATH.tmp"

echo "📥 Downloading GeoIP MMDB from $MIRROR_URL..."

# Download with retries and timeout
if ! curl -fsSL \
  --retry 3 \
  --retry-delay 3 \
  --retry-max-time 180 \
  --connect-timeout 30 \
  --max-time 300 \
  -o "$TMP_GZ_PATH" \
  "$MIRROR_URL"; then
  echo "❌ Failed to download MMDB file"
  rm -f "$TMP_GZ_PATH"
  exit 1
fi

echo "📦 Download complete. Decompressing..."

# Decompress
if ! gzip -d -c "$TMP_GZ_PATH" > "$TMP_MMDB_PATH"; then
  echo "❌ Failed to decompress MMDB file"
  rm -f "$TMP_GZ_PATH" "$TMP_MMDB_PATH"
  exit 1
fi

# Verify file is not empty
if [ ! -s "$TMP_MMDB_PATH" ]; then
  echo "❌ Decompressed file is empty"
  rm -f "$TMP_GZ_PATH" "$TMP_MMDB_PATH"
  exit 1
fi

# Atomic replacement
mv "$TMP_MMDB_PATH" "$DB_PATH"
rm -f "$TMP_GZ_PATH"

FILE_SIZE=$(stat -c %s "$DB_PATH" 2>/dev/null || stat -f %z "$DB_PATH" 2>/dev/null || echo 0)
FILE_SIZE_MB=$((FILE_SIZE / 1024 / 1024))

echo "✅ GeoIP MMDB successfully updated"
echo "   Path: $DB_PATH"
echo "   Size: ${FILE_SIZE_MB} MB"
echo "   Timestamp: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
echo "═══════════════════════════════════════════════════════════════════"
