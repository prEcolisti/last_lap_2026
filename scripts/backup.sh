#!/usr/bin/env bash
# Logical backup (pg_dump custom format) of POSTGRES_DB into backups/.
#   bash scripts/backup.sh
# Backups contain player data and password hashes: the file is created mode 600; keep it private.
# Requires pg_dump/pg_restore >= the server's major version (or use the docker "tools" service).
set -euo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"
load_env
require_vars POSTGRES_DB LAST_LAP_MIGRATOR_USER LAST_LAP_MIGRATOR_PASSWORD

out_dir="${BACKUP_DIR:-$ROOT_DIR/backups}"
mkdir -p "$out_dir"
file="$out_dir/${POSTGRES_DB}_$(date -u +%Y%m%dT%H%M%SZ).dump"

umask 077
as_user "$LAST_LAP_MIGRATOR_USER" "$LAST_LAP_MIGRATOR_PASSWORD" \
  pg_dump --format=custom -d "$POSTGRES_DB" -f "$file"
# Sanity check: the archive must be readable.
pg_restore --list "$file" > /dev/null
echo "Backup written: $file"
