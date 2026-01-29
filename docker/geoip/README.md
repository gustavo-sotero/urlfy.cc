# GeoIP MMDB Auto-Downloader

This service automatically downloads and refreshes the GeoLite2-City MMDB database from a public mirror, eliminating the need for MaxMind credentials.

## Features

- **Credential-free**: Uses public jsDelivr CDN mirror
- **Auto-refresh**: Runs monthly on the 1st day at 00:00 UTC
- **Smart caching**: Skips download if existing file is fresh
- **Atomic updates**: Safe file replacement without downtime
- **Retries & timeouts**: Robust download with error handling

## Configuration

Environment variables:

| Variable             | Default                                                                      | Description                                          |
| -------------------- | ---------------------------------------------------------------------------- | ---------------------------------------------------- |
| `GEOIP_DB_PATH`      | `/app/geoip/GeoLite2-City.mmdb`                                              | Path where MMDB file will be stored                  |
| `GEOIP_MAX_AGE_DAYS` | `25`                                                                         | Maximum age in days before re-downloading            |
| `GEOIP_MMDB_URL`     | `https://cdn.jsdelivr.net/npm/geolite2-city/GeoLite2-City.mmdb.gz` | URL of the MMDB mirror (compressed with gzip)        |

## Data Source

- **Package**: [wp-statistics/GeoLite2-City](https://www.npmjs.com/package/geolite2-city)
- **Mirror**: jsDelivr CDN (https://cdn.jsdelivr.net)
- **Update Frequency**: Tuesday & Friday at 06:00 UTC (per upstream)
- **License**: CC BY-SA 4.0 (MaxMind GeoLite2)
- **Attribution**: This product includes GeoLite2 data created by MaxMind, available from https://www.maxmind.com

## Usage

The service is automatically started by Docker Compose:

```bash
docker-compose up -d
```

## Logs

View refresh logs:

```bash
docker-compose logs -f geoip-downloader
```

## Manual Refresh

Force a refresh:

```bash
docker-compose exec geoip-downloader /usr/local/bin/geoip-refresh.sh
```

## Volume

The MMDB file is stored in a Docker volume shared with the main app:

- Volume: `geoip_data`
- Mount point (app): `/app/geoip:ro` (read-only)
- Mount point (downloader): `/app/geoip` (read-write)

## License Compliance

This service uses GeoLite2 data created by MaxMind. When using this data, you must:

1. Include attribution: "This product includes GeoLite2 data created by MaxMind, available from https://www.maxmind.com"
2. Comply with the Creative Commons Attribution-ShareAlike 4.0 International License
3. Not remove or obscure the MaxMind copyright notice

See: https://dev.maxmind.com/geoip/geolite2-free-geolocation-data

## Architecture

```
┌─────────────────────────────────────────┐
│      geoip-downloader (Alpine)          │
│                                         │
│  ┌───────────────────────────────────┐  │
│  │   Startup: geoip-entrypoint.sh    │  │
│  │   - Run geoip-refresh.sh once     │  │
│  │   - Start cron daemon             │  │
│  └───────────────────────────────────┘  │
│                                         │
│  ┌───────────────────────────────────┐  │
│  │   Cron: 0 0 1 * *                 │  │
│  │   - Check file age                │  │
│  │   - Download if > MAX_AGE_DAYS    │  │
│  │   - Decompress & atomic replace   │  │
│  └───────────────────────────────────┘  │
└─────────────────────────────────────────┘
                  │
                  ▼
         geoip_data volume
                  │
                  ▼
┌─────────────────────────────────────────┐
│              app (Next.js)              │
│     Reads: /app/geoip/*.mmdb (ro)       │
└─────────────────────────────────────────┘
```

## Troubleshooting

### File not downloading

Check logs for errors:

```bash
docker-compose logs geoip-downloader
```

Common issues:

- Network connectivity to jsDelivr CDN
- Insufficient disk space in volume
- Permission issues (should run as root in container)

### File is outdated

Check file age:

```bash
docker-compose exec geoip-downloader stat -c "%Y %n" /app/geoip/GeoLite2-City.mmdb
```

Force refresh:

```bash
docker-compose exec geoip-downloader /usr/local/bin/geoip-refresh.sh
```

### App cannot read MMDB

Verify volume mount:

```bash
docker-compose exec app ls -lh /app/geoip/
```

Expected output:

```
-rw-r--r-- 1 root root 60M Jan 1 00:00 GeoLite2-City.mmdb
```
