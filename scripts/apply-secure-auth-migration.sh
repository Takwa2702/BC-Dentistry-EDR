#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
migration="$repo_root/database/migrations/2026-07-29-secure-auth-sessions.sql"

if [[ ! -f "$repo_root/.env" ]]; then
  echo "Missing $repo_root/.env" >&2
  exit 1
fi

cd "$repo_root"
docker compose exec -T mysql sh -c \
  'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" mysql --protocol=TCP -h 127.0.0.1 -uroot "$MYSQL_DATABASE"' \
  < "$migration"
docker compose exec -T mysql sh -c \
  'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" mysql --protocol=TCP -h 127.0.0.1 -uroot "$MYSQL_DATABASE" --batch --skip-column-names' \
  < "$repo_root/database/verify-secure-auth-schema.sql"
