#!/bin/sh
# Backup diário do banco (formato custom do pg_dump, comprimido).
# Mantém os últimos BACKUP_KEEP_DAYS dias no volume de backups.
# IMPORTANTE: copie a pasta de backups para FORA do servidor (outro disco,
# outro provedor); um backup no mesmo disco não protege contra perda do servidor.
set -eu

KEEP_DAYS="${BACKUP_KEEP_DAYS:-14}"
INTERVAL="${BACKUP_INTERVAL_SECONDS:-86400}"

while true; do
  file="/backups/campusconnect-$(date -u +%Y%m%dT%H%M%SZ).dump"
  if pg_dump --format=custom --no-owner --file="$file.partial"; then
    mv "$file.partial" "$file"
    echo "[backup] ok: $file ($(du -h "$file" | cut -f1))"
  else
    rm -f "$file.partial"
    echo "[backup] FALHOU" >&2
  fi
  find /backups -name 'campusconnect-*.dump' -mtime "+$KEEP_DAYS" -delete
  sleep "$INTERVAL"
done
