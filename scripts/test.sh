#!/usr/bin/env bash
# Runs the database test-suite against a DISPOSABLE database that it creates and drops itself.
#   bash scripts/test.sh
# Needs a reachable PostgreSQL (e.g. `docker compose up -d --wait postgres`) and the .env credentials.
# With Docker and no host PostgreSQL client:
#   docker compose run --rm tools bash scripts/test.sh
# The real database (POSTGRES_DB) is never touched: all work happens in last_lap_test_<id>.
set -euo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"
load_env
require_vars POSTGRES_DB POSTGRES_SUPERUSER POSTGRES_SUPERUSER_PASSWORD \
  LAST_LAP_MIGRATOR_USER LAST_LAP_MIGRATOR_PASSWORD LAST_LAP_APP_USER LAST_LAP_APP_PASSWORD

TEST_DB="last_lap_test_$(date +%s)_$$"
RESTORE_DB="${TEST_DB}_restored"
BACKUP_TMP="$(mktemp -d)"
PASSED=0

su_psql() { as_user "$POSTGRES_SUPERUSER" "$POSTGRES_SUPERUSER_PASSWORD" psql -X -q -v ON_ERROR_STOP=1 "$@"; }

cleanup() {
  local d
  for d in "$TEST_DB" "$RESTORE_DB"; do
    case "$d" in   # safety: only ever drop databases this script created
      last_lap_test_*) su_psql -d postgres -c "DROP DATABASE IF EXISTS \"$d\" WITH (FORCE)" >/dev/null 2>&1 || true ;;
    esac
  done
  rm -rf "$BACKUP_TMP"
}
trap cleanup EXIT

# Run one SQL file as the given role; print the "ok - ..." lines; fail loudly otherwise.
run_sql() {
  local who="$1" pw="$2" file="$3" out n
  echo "--- $(basename "$file") (as $who)"
  if ! out="$(as_user "$who" "$pw" psql -X -q -v ON_ERROR_STOP=1 -d "$TEST_DB" -f "$file" 2>&1)"; then
    echo "$out" >&2
    die "FAILED: $(basename "$file")"
  fi
  echo "$out" | sed -n 's/^.*NOTICE:  \(ok - .*\)$/  \1/p'
  n="$(echo "$out" | grep -c 'NOTICE:  ok - ' || true)"
  PASSED=$((PASSED + n))
}

check() { # check "description" command...
  local desc="$1"; shift
  if "$@" >/dev/null 2>&1; then echo "  ok - $desc"; PASSED=$((PASSED + 1)); else die "FAILED: $desc"; fi
}

echo "=== Disposable test database: $TEST_DB"
export POSTGRES_DB="$TEST_DB"

echo "=== 1. Bootstrap (roles + empty database)"
bash "$ROOT_DIR/scripts/bootstrap.sh"

echo "=== 2. Migrations on a clean database"
bash "$ROOT_DIR/scripts/migrate.sh" up
check "re-running migrate is a no-op" bash -c "bash '$ROOT_DIR/scripts/migrate.sh' up | grep -q 'up to date'"
check "migrate status reports current version 0001" bash -c "bash '$ROOT_DIR/scripts/migrate.sh' status | grep -q 'Current version: 0001'"
check "migrate current prints 0001" bash -c "[ \"\$(bash '$ROOT_DIR/scripts/migrate.sh' current)\" = 0001 ]"

echo "=== 3. SQL tests"
SU=("$POSTGRES_SUPERUSER" "$POSTGRES_SUPERUSER_PASSWORD")
APP=("$LAST_LAP_APP_USER" "$LAST_LAP_APP_PASSWORD")
T="$ROOT_DIR/tests/sql"
run_sql "${SU[@]}"  "$T/00_helpers.sql"
run_sql "${SU[@]}"  "$T/10_schema.sql"
run_sql "${SU[@]}"  "$T/20_constraints.sql"
run_sql "${SU[@]}"  "$T/30_progress_jsonb.sql"
run_sql "${SU[@]}"  "$T/40_transactions.sql"
run_sql "${SU[@]}"  "$T/45_triggers.sql"
run_sql "${APP[@]}" "$T/50_privileges_app.sql"
run_sql "${APP[@]}" "$T/60_persistence_write_app.sql"
run_sql "${APP[@]}" "$T/61_persistence_read_app.sql"   # separate connection = reconnection test

echo "=== 4. Backup and restore round-trip"
export BACKUP_DIR="$BACKUP_TMP"
bash "$ROOT_DIR/scripts/backup.sh"
dump="$(ls "$BACKUP_TMP"/*.dump | head -n 1)"
count_users() { as_user "$POSTGRES_SUPERUSER" "$POSTGRES_SUPERUSER_PASSWORD" psql -X -q -At -d "$1" -c "SELECT count(*) FROM users"; }
src_users="$(count_users "$TEST_DB")"
POSTGRES_DB="$RESTORE_DB" bash "$ROOT_DIR/scripts/restore.sh" "$dump" --db "$RESTORE_DB"
check "restored database has the same number of users ($src_users)" test "$(count_users "$RESTORE_DB")" = "$src_users"
check "restored progress JSON is identical" test "$(as_user "$POSTGRES_SUPERUSER" "$POSTGRES_SUPERUSER_PASSWORD" psql -X -q -At -d "$RESTORE_DB" -c "SELECT progress FROM game_saves s JOIN users u ON u.id=s.user_id WHERE u.nickname='persist_user'")" = \
  "$(as_user "$POSTGRES_SUPERUSER" "$POSTGRES_SUPERUSER_PASSWORD" psql -X -q -At -d "$TEST_DB" -c "SELECT progress FROM game_saves s JOIN users u ON u.id=s.user_id WHERE u.nickname='persist_user'")"
check "migration history survived the restore" bash -c "POSTGRES_DB='$RESTORE_DB' bash '$ROOT_DIR/scripts/migrate.sh' status | grep -q 'Current version: 0001'"
check "restore refuses to overwrite a non-empty database" bash -c "! POSTGRES_DB='$RESTORE_DB' bash '$ROOT_DIR/scripts/restore.sh' '$dump' --db '$RESTORE_DB'"

echo
echo "ALL TESTS PASSED ($PASSED assertions/checks)"
