# Disaster Recovery Guide - urlfy.cc

## Overview

This document describes the backup and disaster recovery procedures for the urlfy.cc application.

## Backup Strategy

### What is Backed Up

- **PostgreSQL Database:**

  - All application tables (links, users, sessions, etc.)
  - Analytics aggregation tables (link_clicks_daily)
  - Raw analytics events (optional, only in daily full backup)

- **Not Backed Up:**
  - Redis cache (ephemeral data, can be rebuilt)
  - Docker volumes (except postgres_data)
  - Application logs older than 7 days

### Backup Schedule

| Type   | Frequency  | Retention | Includes Analytics       |
| ------ | ---------- | --------- | ------------------------ |
| Hourly | Every hour | 7 days    | No (excludes raw events) |
| Daily  | 02:00 UTC  | 30 days   | Yes (full backup)        |

### Backup Location

Backups are stored in the `backup_data` Docker volume, mapped to `/backups` inside the backup container.

**Important:** For production, configure external backup storage (S3, rsync to remote server, etc.).

## Recovery Procedures

### RTO/RPO Targets

- **RTO (Recovery Time Objective):** < 1 hour
- **RPO (Recovery Point Objective):** < 1 hour (hourly backups)

### Full System Recovery

#### 1. Stop the Application

```bash
cd docker
docker-compose stop app
```

#### 2. Restore Database

```bash
# List available backups
docker exec urlfy-backup ls -lh /backups

# Restore from specific backup
docker exec -i urlfy-postgres psql -U urlfy -d urlfy < /path/to/backup.sql

# Or from compressed backup
gunzip -c urlfy_20260107_020000.sql.gz | docker exec -i urlfy-postgres psql -U urlfy -d urlfy
```

#### 3. Restart the Application

```bash
docker-compose start app

# Verify health
curl http://localhost:3000/api/v1/health/ready
```

### Partial Recovery (Specific Tables)

```bash
# Restore only specific table
pg_restore --table=links /backups/urlfy_20260107_020000.sql.gz
```

### Point-in-Time Recovery (PITR)

For production environments, consider implementing **pgBackRest** for PITR capabilities:

```bash
# Install pgBackRest
apt-get install pgbackrest

# Configure continuous archiving
# Update postgresql.conf:
# wal_level = replica
# archive_mode = on
# archive_command = 'pgbackrest --stanza=urlfy archive-push %p'

# Perform PITR to specific timestamp
pgbackrest --stanza=urlfy --type=time --target="2026-01-07 12:00:00" restore
```

## Testing Recovery

### Monthly Recovery Test

Perform a test recovery on the first day of each month:

1. Create a test database
2. Restore latest backup
3. Verify data integrity
4. Document results

```bash
# Create test database
docker exec urlfy-postgres createdb -U urlfy urlfy_test

# Restore backup
gunzip -c /backups/latest.sql.gz | docker exec -i urlfy-postgres psql -U urlfy -d urlfy_test

# Verify
docker exec urlfy-postgres psql -U urlfy -d urlfy_test -c "SELECT COUNT(*) FROM links;"

# Cleanup
docker exec urlfy-postgres dropdb -U urlfy urlfy_test
```

## Monitoring

### Backup Monitoring

- Check backup logs: `docker logs urlfy-backup`
- Verify backup file sizes
- Alert if backup fails (configure with your monitoring system)

### Health Checks

```bash
# Check backup service
docker exec urlfy-backup sh -c "ls -lh /backups | tail -5"

# Check disk space
docker exec urlfy-backup df -h /backups
```

## External Backup (Production)

For production, synchronize backups to external storage:

### Option 1: AWS S3

```bash
# Install AWS CLI in backup container
# Add to backup.sh:

aws s3 cp "${BACKUP_FILE}" "s3://your-bucket/backups/$(basename ${BACKUP_FILE})" \
  --storage-class STANDARD_IA

log "✅ Backup uploaded to S3"
```

### Option 2: rsync to Remote Server

```bash
# Add to backup.sh:

rsync -avz --progress \
  "${BACKUP_FILE}" \
  backup-user@remote-server:/backups/urlfy/

log "✅ Backup synced to remote server"
```

## Security

- Backups contain sensitive user data
- Encrypt backups at rest (use GPG or server-side encryption)
- Restrict access to backup files
- Rotate encryption keys annually

### Encryption Example

```bash
# Encrypt backup
gpg --symmetric --cipher-algo AES256 urlfy_backup.sql.gz

# Decrypt for restore
gpg --decrypt urlfy_backup.sql.gz.gpg | gunzip | psql ...
```

## Troubleshooting

### Backup Failed

```bash
# Check backup logs
docker logs urlfy-backup --tail 100

# Check disk space
docker exec urlfy-backup df -h

# Manual backup
docker exec urlfy-backup /backup.sh
```

### Restore Failed

- Verify backup file is not corrupted: `gzip -t backup.sql.gz`
- Check PostgreSQL logs: `docker logs urlfy-postgres`
- Ensure database exists and is empty before restore
- Check user permissions

## Appendix: Useful Commands

```bash
# View backup schedule
docker exec urlfy-backup crontab -l

# Manual backup with analytics
docker exec -e INCLUDE_ANALYTICS=1 urlfy-backup /backup.sh

# Check backup size
docker exec urlfy-backup du -sh /backups

# List all backups
docker exec urlfy-backup ls -lh /backups

# Delete old backups manually
docker exec urlfy-backup find /backups -name "*.sql.gz" -mtime +30 -delete
```
