#!/bin/bash
set -euo pipefail

# ═══════════════════════════════════════════════════════════════════
# CONFIGURAÇÃO
# ═══════════════════════════════════════════════════════════════════

BACKUP_DIR="${BACKUP_DIR:-/backups}"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-7}"
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="${BACKUP_DIR}/urlfy_${DATE}.sql.gz"
INCLUDE_ANALYTICS="${INCLUDE_ANALYTICS:-0}"

# ═══════════════════════════════════════════════════════════════════
# FUNÇÕES
# ═══════════════════════════════════════════════════════════════════

log() {
  echo "[$(date +'%Y-%m-%d %H:%M:%S')] $1"
}

cleanup_old_backups() {
  log "Removendo backups com mais de ${RETENTION_DAYS} dias..."
  find "${BACKUP_DIR}" -name "urlfy_*.sql.gz" -mtime +${RETENTION_DAYS} -delete
  log "Cleanup concluído"
}

perform_backup() {
  log "Iniciando backup do PostgreSQL..."
  
  # Opções de exclusão
  EXCLUDE_TABLES=""
  if [ "$INCLUDE_ANALYTICS" != "1" ]; then
    log "Excluindo tabelas de analytics (eventos brutos)..."
    EXCLUDE_TABLES="--exclude-table-data=analytics_events --exclude-table-data=analytics_events_*"
  fi
  
  # Executa pg_dump
  pg_dump \
    --format=plain \
    --no-owner \
    --no-acl \
    --verbose \
    $EXCLUDE_TABLES \
    | gzip > "${BACKUP_FILE}"
  
  BACKUP_SIZE=$(du -h "${BACKUP_FILE}" | cut -f1)
  log "Backup concluído: ${BACKUP_FILE} (${BACKUP_SIZE})"
}

verify_backup() {
  log "Verificando integridade do backup..."
  
  if gzip -t "${BACKUP_FILE}"; then
    log "✅ Backup verificado com sucesso"
  else
    log "❌ Erro: Backup corrompido!"
    exit 1
  fi
}

# ═══════════════════════════════════════════════════════════════════
# EXECUÇÃO
# ═══════════════════════════════════════════════════════════════════

log "=== Iniciando processo de backup ==="

# Cria diretório se não existir
mkdir -p "${BACKUP_DIR}"

# Executa backup
perform_backup

# Verifica integridade
verify_backup

# Remove backups antigos
cleanup_old_backups

log "=== Backup finalizado com sucesso ==="
