#!/bin/sh
# Restaura um backup no banco de produção (APAGA os dados atuais).
# Uso (na raiz do projeto, no servidor):
#   sh infra/production/restore.sh campusconnect-20261108T030000Z.dump
set -eu

if [ $# -ne 1 ]; then
  echo "Uso: sh infra/production/restore.sh <arquivo.dump da pasta de backups>" >&2
  exit 1
fi

ENV_FILE="${CC_ENV_FILE:-.env.production}"
PROJECT="${CC_PROJECT:-campusconnect-prod}"
COMPOSE="docker compose --env-file $ENV_FILE -f infra/production/compose.yaml -p $PROJECT"

if [ ! -f "infra/production/backups/$1" ]; then
  echo "Arquivo não encontrado: infra/production/backups/$1" >&2
  exit 1
fi

printf "Isso vai SUBSTITUIR o banco de produção por %s. Digite RESTAURAR para continuar: " "$1"
read -r answer
[ "$answer" = "RESTAURAR" ] || { echo "Cancelado."; exit 1; }

$COMPOSE stop app cleanup
$COMPOSE exec -T backup sh -c \
  "pg_restore --clean --if-exists --no-owner --role=\"\$PGUSER\" --dbname=\"\$PGDATABASE\" \"/backups/$1\""
$COMPOSE start app cleanup
echo "✓ Backup restaurado."
