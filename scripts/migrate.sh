#!/usr/bin/env bash
# Plain-SQL migration runner.
#   bash scripts/migrate.sh up       apply all pending migrations (default)
#   bash scripts/migrate.sh status   show applied / pending migrations
#   bash scripts/migrate.sh current  print the current version
# Each migration runs in ONE transaction together with its schema_migrations row.
# Applied migrations are checksummed: editing one afterwards is an error. Forward-only by design.
# Do not run two migrators at the same time.
set -euo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"
load_env
require_vars POSTGRES_DB LAST_LAP_MIGRATOR_USER LAST_LAP_MIGRATOR_PASSWORD

MIGRATIONS_DIR="$ROOT_DIR/migrations"
cmd="${1:-up}"

mpsql() {
  as_user "$LAST_LAP_MIGRATOR_USER" "$LAST_LAP_MIGRATOR_PASSWORD" \
    psql -X -q -v ON_ERROR_STOP=1 -d "$POSTGRES_DB" "$@"
}

mpsql -c "CREATE TABLE IF NOT EXISTS schema_migrations (
  version    text        PRIMARY KEY,
  name       text        NOT NULL,
  checksum   text        NOT NULL,
  applied_at timestamptz NOT NULL DEFAULT now(),
  applied_by text        NOT NULL DEFAULT current_user
)" -o /dev/null

shopt -s nullglob
files=("$MIGRATIONS_DIR"/[0-9][0-9][0-9][0-9]_*.sql)

declare -A applied=()
while IFS='|' read -r v c; do
  if [ -n "$v" ]; then applied["$v"]="$c"; fi
done < <(mpsql -At -F '|' -c "SELECT version, checksum FROM schema_migrations ORDER BY version")

case "$cmd" in
  up)
    count=0
    for f in "${files[@]}"; do
      name="$(basename "$f")"
      version="${name%%_*}"
      sum="$(sha256_of "$f")"
      if [ -n "${applied[$version]+x}" ]; then
        [ "${applied[$version]}" = "$sum" ] || die "Migration $name was modified after being applied (checksum mismatch). Never edit applied migrations; add a new one."
        continue
      fi
      echo "Applying $name ..."
      mpsql --single-transaction -o /dev/null \
        -c "SELECT pg_advisory_xact_lock(727401)" \
        -f "$f" \
        -c "INSERT INTO schema_migrations (version, name, checksum) VALUES ('$version', '$name', '$sum')"
      count=$((count + 1))
    done
    if [ "$count" -eq 0 ]; then echo "Database is up to date."; else echo "Applied $count migration(s)."; fi
    ;;
  status)
    echo "Database: $POSTGRES_DB"
    last="none"
    declare -A seen=()
    for f in "${files[@]}"; do
      name="$(basename "$f")"
      version="${name%%_*}"
      seen["$version"]=1
      if [ -n "${applied[$version]+x}" ]; then
        if [ "${applied[$version]}" = "$(sha256_of "$f")" ]; then echo "  [applied] $name"; else echo "  [CHANGED] $name (differs from what was applied!)"; fi
        last="$version"
      else
        echo "  [pending] $name"
      fi
    done
    for v in "${!applied[@]}"; do
      if [ -z "${seen[$v]+x}" ]; then echo "  [no file] version $v is recorded in the database but missing from migrations/"; fi
    done
    echo "Current version: $last"
    ;;
  current)
    last="none"
    for f in "${files[@]}"; do
      version="$(basename "$f")"; version="${version%%_*}"
      if [ -n "${applied[$version]+x}" ]; then last="$version"; fi
    done
    echo "$last"
    ;;
  *) die "Unknown command '$cmd' (use: up | status | current)" ;;
esac
