#!/usr/bin/env bash
# Operational test: starts a THROW-AWAY PostgreSQL via docker compose (own project name, own
# volume, own random passwords, port 55432), checks health, migrations, connectivity and that
# data survives a container restart, then deletes everything (containers + volume).
#   bash scripts/test-operational.sh
# Requires Docker with the compose plugin. Does not use or touch your .env or your real volume.
set -euo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"
command -v docker >/dev/null 2>&1 || die "docker not found"
cd "$ROOT_DIR"

rand() { head -c 16 /dev/urandom | od -An -tx1 | tr -d ' \n'; }
TMP="$(mktemp -d)"
ENVF="$TMP/ops.env"
PORT="${OPS_TEST_PORT:-55432}"
cat > "$ENVF" <<EOT
POSTGRES_IMAGE=${POSTGRES_IMAGE:-postgres:17}
POSTGRES_DB=last_lap_ops_db
POSTGRES_HOST=localhost
POSTGRES_PORT=$PORT
POSTGRES_BIND_ADDRESS=127.0.0.1
POSTGRES_SUPERUSER=ops_admin
POSTGRES_SUPERUSER_PASSWORD=$(rand)
LAST_LAP_MIGRATOR_USER=ops_migrator
LAST_LAP_MIGRATOR_PASSWORD=$(rand)
LAST_LAP_APP_USER=ops_app
LAST_LAP_APP_PASSWORD=$(rand)
EOT
export COMPOSE_PROJECT_NAME=last_lap_ops_test
dc() { docker compose --env-file "$ENVF" "$@"; }
cleanup() { dc down -v --remove-orphans >/dev/null 2>&1 || true; rm -rf "$TMP"; }
trap cleanup EXIT

ok() { echo "  ok - $1"; }
app_psql() { dc run --rm -T tools bash -c 'PGPASSWORD="$LAST_LAP_APP_PASSWORD" psql -X -q -At -h postgres -U "$LAST_LAP_APP_USER" -d "$POSTGRES_DB" -c "$0"' "$1"; }

echo "=== Start PostgreSQL and wait for the health check"
dc up -d --wait postgres
health="$(docker inspect --format '{{.State.Health.Status}}' "$(dc ps -q postgres)")"
[ "$health" = "healthy" ] || die "container health is '$health', expected 'healthy'"; ok "container reports healthy"

echo "=== Migrate from a clean volume"
dc run --rm -T tools bash scripts/migrate.sh up
dc run --rm -T tools bash scripts/migrate.sh status | grep -q "Current version: 0001" || die "migration status"; ok "migrations applied, version 0001"

echo "=== Connect with the documented settings"
[ "$(app_psql 'SELECT 1')" = "1" ] || die "app role cannot connect"; ok "runtime role connects (container network, host 'postgres')"
if command -v pg_isready >/dev/null 2>&1; then
  pg_isready -h 127.0.0.1 -p "$PORT" >/dev/null || die "host port $PORT not reachable"; ok "host machine reaches 127.0.0.1:$PORT"
else
  echo "  skip - pg_isready not installed on the host (host-port check skipped)"
fi

echo "=== Persistence across a container restart"
app_psql "INSERT INTO users (nickname, password_hash) VALUES ('ops_marker', 'h')" >/dev/null
dc restart postgres
dc up -d --wait postgres
[ "$(app_psql "SELECT count(*) FROM users WHERE nickname = 'ops_marker'")" = "1" ] || die "marker row lost after restart"; ok "data survived 'docker compose restart'"

dc stop postgres
dc up -d --wait postgres
[ "$(app_psql "SELECT count(*) FROM users WHERE nickname = 'ops_marker'")" = "1" ] || die "marker row lost after stop/start"; ok "data survived stop/start (named volume)"

echo
echo "OPERATIONAL TESTS PASSED"
