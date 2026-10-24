#!/usr/bin/env bash
# Loads FICTIONAL development data (database/sample_data/dev_seed.sql). Never for production.
#   bash scripts/seed-dev.sh --yes
set -euo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"
[ "${1:-}" = "--yes" ] || die "Refusing to load sample data without --yes (development databases only)."
load_env
require_vars POSTGRES_DB LAST_LAP_MIGRATOR_USER LAST_LAP_MIGRATOR_PASSWORD
as_user "$LAST_LAP_MIGRATOR_USER" "$LAST_LAP_MIGRATOR_PASSWORD" \
  psql -X -q -v ON_ERROR_STOP=1 -d "$POSTGRES_DB" -f "$ROOT_DIR/database/sample_data/dev_seed.sql"
echo "Sample development data loaded into '$POSTGRES_DB'."
