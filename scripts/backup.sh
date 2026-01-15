#!/bin/sh
set -euo pipefail

# ═══════════════════════════════════════════════════════════════════
# CONFIGURAÇÃO
# ═══════════════════════════════════════════════════════════════════

BACKUP_DIR="/backups"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-7}"
INCLUDE_ANALYTICS="${INCLUDE_ANALYTICS:-0}"
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="${BACKUP_DIR}/urlfy_${DATE}.sql.gz"

# ═══════════════════════════════════════════════════════════════════
# FUNÇÕES
# ═══════════════════════════════════════════════════════════════════

log() {
  echo "[$(date +'%Y-%m-%d %H:%M:%S')] $1"
}

cleanup_old_backups() {
  log "Removendo backups com mais de ${RETENTION_DAYS} dias..."
  find "${BACKUP_DIR}" -name "urlfy_*.sql.gz" -mtime +"${RETENTION_DAYS}" -delete
}

perform_backup() {
  log "Iniciando backup do PostgreSQL..."

  EXCLUDE_ANALYTICS=""
  if [ "${INCLUDE_ANALYTICS}" != "1" ]; then
    EXCLUDE_ANALYTICS="--exclude-table-data=analytics_events_*"
  fi

  pg_dump \
    --format=custom \
    --compress=9 \
    --verbose \
    --file="${BACKUP_FILE}" \
    ${EXCLUDE_ANALYTICS} \
    2>&1 | while read -r line; do log "  ${line}"; done

  BACKUP_SIZE=$(du -h "${BACKUP_FILE}" | cut -f1)
  log "Backup concluído: ${BACKUP_FILE} (${BACKUP_SIZE})"
}

verify_backup() {
  log "Verificando integridade do backup..."

  if pg_restore --list "${BACKUP_FILE}" > /dev/null 2>&1; then
    log "Verificação OK"
  else
    log "ERRO: Backup corrompido!"
    exit 1
  fi
}

# ═══════════════════════════════════════════════════════════════════
# EXECUÇÃO
# ═══════════════════════════════════════════════════════════════════

log "=== Iniciando processo de backup ==="

mkdir -p "${BACKUP_DIR}"

perform_backup
verify_backup
cleanup_old_backups

log "=== Backup finalizado com sucesso ==="
