# ═══════════════════════════════════════════════════════════════════
# GeoIP MMDB Auto-Downloader Container
# ═══════════════════════════════════════════════════════════════════
#
# Lightweight Alpine-based container that:
# - Downloads GeoLite2-City MMDB on startup if missing or outdated
# - Runs monthly cron job to refresh the database
# - Requires no credentials (uses public jsDelivr CDN mirror)
#
# ═══════════════════════════════════════════════════════════════════

FROM alpine:3.23.4

# Install required packages
RUN apk add --no-cache \
    curl \
    gzip \
    dcron \
    tzdata

# Set timezone to UTC
ENV TZ=UTC

# Copy refresh script
COPY geoip-refresh.sh /usr/local/bin/geoip-refresh.sh
RUN chmod +x /usr/local/bin/geoip-refresh.sh

# Create cron job (1st day of month at midnight UTC)
RUN echo "0 0 1 * * /usr/local/bin/geoip-refresh.sh >> /var/log/geoip-refresh.log 2>&1" > /etc/crontabs/root

# Create log directory
RUN mkdir -p /var/log && touch /var/log/geoip-refresh.log

# Entrypoint: Run refresh once, then start cron
COPY geoip-entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

ENTRYPOINT ["/entrypoint.sh"]
