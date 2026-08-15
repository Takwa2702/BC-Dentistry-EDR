#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
migration="$repo_root/database/migrations/2026-08-15-administrator-totp-mfa.sql"

if [[ ! -f "$repo_root/.env" ]]; then
  echo "Missing $repo_root/.env" >&2
  exit 1
fi
if ! grep -Eq '^MFA_SECRET_ENCRYPTION_KEY=[A-Za-z0-9+/]+={0,2}$' "$repo_root/.env"; then
  echo "MFA_SECRET_ENCRYPTION_KEY is missing or is not base64 in $repo_root/.env" >&2
  exit 1
fi

cd "$repo_root"
docker compose exec -T mysql sh -c \
  'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" mysql --protocol=TCP -h 127.0.0.1 -uroot "$MYSQL_DATABASE"' \
  < "$migration"

docker compose exec -T mysql sh -c \
  'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" mysql --protocol=TCP -h 127.0.0.1 -uroot "$MYSQL_DATABASE" --batch --skip-column-names -e "SELECT IF((SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME IN ('\''Auth_MFA_Credential'\'','\''Auth_MFA_Recovery_Code'\'','\''Auth_MFA_Challenge'\''))=3 AND EXISTS(SELECT 1 FROM Schema_Migration WHERE Migration_ID='\''2026-08-15-administrator-totp-mfa'\''),'\''MFA_SCHEMA_OK'\'','\''MFA_SCHEMA_ERROR'\'')"'
