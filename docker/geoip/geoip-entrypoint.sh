#!/usr/bin/env sh
# ═══════════════════════════════════════════════════════════════════
# GeoIP Downloader Container Entrypoint
# ═══════════════════════════════════════════════════════════════════

set -e

echo "═══════════════════════════════════════════════════════════════════"
echo "GeoIP MMDB Auto-Downloader"
echo "Starting at $(date -u +%Y-%m-%dT%H:%M:%SZ)"
echo "═══════════════════════════════════════════════════════════════════"

# Run refresh script once on startup
/usr/local/bin/geoip-refresh.sh

echo ""
echo "📅 Starting cron daemon for monthly updates..."
echo "   Schedule: 1st day of each month at 00:00 UTC"
echo "   Logs: /var/log/geoip-refresh.log"
echo "═══════════════════════════════════════════════════════════════════"

# Start crond in foreground
exec crond -f -l 2
