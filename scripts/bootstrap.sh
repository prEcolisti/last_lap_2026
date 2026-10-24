#!/usr/bin/env bash
# Creates/updates roles and the database (idempotent). Also the way to ROTATE PASSWORDS:
# edit .env, then run this script again.
#   bash scripts/bootstrap.sh
# Needs the superuser credentials from .env. With Docker the first start does this
# automatically; run it by hand only for a non-Docker server or after changing passwords.
set -euo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"
load_env
require_vars POSTGRES_DB POSTGRES_SUPERUSER POSTGRES_SUPERUSER_PASSWORD \
  LAST_LAP_MIGRATOR_USER LAST_LAP_MIGRATOR_PASSWORD LAST_LAP_APP_USER LAST_LAP_APP_PASSWORD
validate_identifier POSTGRES_DB "$POSTGRES_DB"
validate_identifier LAST_LAP_MIGRATOR_USER "$LAST_LAP_MIGRATOR_USER"
validate_identifier LAST_LAP_APP_USER "$LAST_LAP_APP_USER"

# bootstrap.sql reads these through psql \getenv
export POSTGRES_DB LAST_LAP_MIGRATOR_USER LAST_LAP_MIGRATOR_PASSWORD LAST_LAP_APP_USER LAST_LAP_APP_PASSWORD

as_user "$POSTGRES_SUPERUSER" "$POSTGRES_SUPERUSER_PASSWORD" \
  psql -X -q -v ON_ERROR_STOP=1 -d postgres -f "$ROOT_DIR/database/bootstrap.sql"
echo "Bootstrap complete: database '$POSTGRES_DB', roles '$LAST_LAP_MIGRATOR_USER' (owner) and '$LAST_LAP_APP_USER' (runtime)."
