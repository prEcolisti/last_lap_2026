#!/usr/bin/env bash
# Shared helpers. SOURCE this file (do not execute it).

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

die() { echo "ERROR: $*" >&2; exit 1; }

# Loads .env once. Inside the docker "tools" container LAST_LAP_ENV_LOADED=1 is preset,
# so the host-oriented .env is ignored and the container's own environment is used.
load_env() {
  if [ "${LAST_LAP_ENV_LOADED:-0}" = "1" ]; then return 0; fi
  local env_file="${ENV_FILE:-$ROOT_DIR/.env}"
  [ -f "$env_file" ] || die "Env file not found: $env_file (copy .env.example to .env and edit it)"
  set -a
  # shellcheck disable=SC1090
  . "$env_file"
  set +a
  export LAST_LAP_ENV_LOADED=1
}

require_vars() {
  local v
  for v in "$@"; do
    [ -n "${!v:-}" ] || die "Variable $v is not set"
    case "${!v}" in
      replace_with_*) die "Variable $v still has the placeholder value from .env.example" ;;
    esac
  done
}

# Role/database names are interpolated into SQL as identifiers: keep them boring.
validate_identifier() {
  [[ "$2" =~ ^[a-z_][a-z0-9_]{0,62}$ ]] || die "$1 must match ^[a-z_][a-z0-9_]{0,62}\$ (got '$2')"
}

# Run an external command with libpq credentials in its environment only
# (never on the command line, so passwords do not show up in `ps`).
#   as_user USER PASSWORD command args...
as_user() {
  local user="$1" password="$2"; shift 2
  env PGHOST="${POSTGRES_HOST:-localhost}" PGPORT="${POSTGRES_PORT:-5432}" \
      PGUSER="$user" PGPASSWORD="$password" PGCLIENTENCODING=UTF8 "$@"
}

sha256_of() {
  if command -v sha256sum >/dev/null 2>&1; then sha256sum "$1" | cut -d' ' -f1
  else shasum -a 256 "$1" | cut -d' ' -f1
  fi
}
