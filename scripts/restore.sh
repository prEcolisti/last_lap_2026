#!/usr/bin/env bash
# Restore a backup made by backup.sh into an EMPTY database.
#   bash scripts/restore.sh backups/last_lap_db_20260101T000000Z.dump [--db NAME] [--recreate]
#
#   --db NAME    target database (default: POSTGRES_DB from .env). Created if it does not exist.
#   --recreate   DROP the target database first (DESTROYS its current data), then restore.
# Without --recreate the script refuses to touch a database that already contains tables.
set -euo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"

[ $# -ge 1 ] || die "Usage: restore.sh <dump-file> [--db NAME] [--recreate]"
dump="$1"; shift
target_db=""; recreate=0
while [ $# -gt 0 ]; do
  case "$1" in
    --db) target_db="${2:-}"; shift 2 ;;
    --recreate) recreate=1; shift ;;
    *) die "Unknown option $1" ;;
  esac
done
[ -f "$dump" ] || die "Dump file not found: $dump"

load_env
[ -n "$target_db" ] && export POSTGRES_DB="$target_db"
require_vars POSTGRES_DB POSTGRES_SUPERUSER POSTGRES_SUPERUSER_PASSWORD \
  LAST_LAP_MIGRATOR_USER LAST_LAP_MIGRATOR_PASSWORD LAST_LAP_APP_USER LAST_LAP_APP_PASSWORD
validate_identifier POSTGRES_DB "$POSTGRES_DB"

su_psql() { as_user "$POSTGRES_SUPERUSER" "$POSTGRES_SUPERUSER_PASSWORD" psql -X -q -v ON_ERROR_STOP=1 "$@"; }

if [ "$recreate" -eq 1 ]; then
  echo "Dropping database '$POSTGRES_DB' (--recreate) ..."
  su_psql -d postgres -c "DROP DATABASE IF EXISTS \"$POSTGRES_DB\" WITH (FORCE)"
fi

# Creates roles/database if missing and applies the lockdown (idempotent).
bash "$ROOT_DIR/scripts/bootstrap.sh" >/dev/null

tables="$(as_user "$LAST_LAP_MIGRATOR_USER" "$LAST_LAP_MIGRATOR_PASSWORD" \
  psql -X -q -At -d "$POSTGRES_DB" -c "SELECT count(*) FROM pg_tables WHERE schemaname = 'public'")"
[ "$tables" = "0" ] || die "Database '$POSTGRES_DB' already contains $tables table(s). Use --recreate to replace it (destroys current data)."

as_user "$LAST_LAP_MIGRATOR_USER" "$LAST_LAP_MIGRATOR_PASSWORD" \
  pg_restore --single-transaction --exit-on-error --no-owner -d "$POSTGRES_DB" "$dump"
echo "Restored '$dump' into database '$POSTGRES_DB'."
