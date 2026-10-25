# The Last Lap - standalone PostgreSQL database

A self-contained PostgreSQL system (schema, migrations, Docker Compose, scripts, tests, docs) for the browser game
**"The Last Lap"**. It is **not integrated** with the existing frontend/backend, and none of their files were modified or copied here.
How the schema was derived: [`docs/ANALYSIS.md`](docs/ANALYSIS.md).

## What is in here
```
standalone-database/
├── docker-compose.yml        PostgreSQL (+ optional "tools" helper container)
├── .env.example              configuration template  ->  copy to .env
├── database/
│   ├── bootstrap.sql         roles + database + lockdown (idempotent; also used to rotate passwords)
│   └── sample_data/dev_seed.sql   fictional dev data (optional, manual)
├── migrations/0001_initial_schema.sql
├── scripts/                  bootstrap, migrate, backup, restore, seed-dev, test, test-operational
├── docker/initdb/            first-start hook that runs bootstrap.sql
├── tests/sql/                SQL test-suite (schema, constraints, JSONB, transactions, privileges, persistence)
├── docs/                     ANALYSIS, SCHEMA (+ER diagram), INTEGRATION_GUIDE
└── backups/                  dump files land here (git-ignored)
```
Tables: `users`, `game_cases`, `game_saves`, `sessions` (+ `schema_migrations`). Details and ER diagram: [`docs/SCHEMA.md`](docs/SCHEMA.md).

## PostgreSQL version
**PostgreSQL 17** (Docker image `postgres:17`, major version pinned in `.env`). It is a current stable major with community support well into 2029
(confirm on postgresql.org/support/versioning). The schema uses only core features (no extensions); `gen_random_uuid()` needs 13+, `\getenv` in
`bootstrap.sql` needs a **psql client 15+**. If you change to PostgreSQL 18+, check the image's data-directory layout before reusing the volume mount.

## Requirements
- Docker with the Compose plugin (recommended), **or** any PostgreSQL 15+ server you control.
- To run the scripts on the host: `bash` 4+ (Linux, WSL, Git Bash; macOS needs a newer bash from Homebrew) and the PostgreSQL client tools
  (`psql`, `pg_dump`, `pg_restore`, version 15+ and >= server major).
  **No host tools?** Use the `tools` container: replace `bash scripts/X.sh` with `docker compose run --rm tools bash scripts/X.sh`.

## Quick start
```bash
cp .env.example .env
# edit .env: replace every "replace_with_..." with a strong password (e.g. `openssl rand -hex 24`)

docker compose up -d --wait postgres                      # start; returns when the health check passes
docker compose run --rm tools bash scripts/migrate.sh up  # create the schema   (host: bash scripts/migrate.sh up)
docker compose run --rm tools bash scripts/migrate.sh status
docker compose run --rm tools bash scripts/test.sh        # test-suite on a disposable DB (host: bash scripts/test.sh)
```
- Stop (data kept): `docker compose down`  
- Start again: `docker compose up -d --wait postgres`  
- **Delete everything incl. data** (dev only): `docker compose down -v`

On the very first start of an empty volume `docker/initdb/10-bootstrap.sh` creates the roles. Without Docker, run
`bash scripts/bootstrap.sh` once against your server (needs the superuser credentials from `.env`).

## Configuration and security model
`.env` (git-ignored) holds all settings; `.env.example` documents them. Scripts refuse to run with placeholder passwords.

| Role | Used for | Can do |
|---|---|---|
| `last_lap_admin` (`POSTGRES_SUPERUSER`) | bootstrap, test DB create/drop | everything - never give to an app |
| `last_lap_migrator` | migrations, backup, restore | DDL on this database only |
| `last_lap_user` | **future backend** | read/write game data only; no DDL, no deletes of users/saves (see `docs/SCHEMA.md`) |

- The port is published on `127.0.0.1` only (`POSTGRES_BIND_ADDRESS`). Do not expose PostgreSQL publicly.
- `log_statement=none` is set so `ALTER ROLE ... PASSWORD` never reaches the server log; scripts pass passwords through environment variables, not command lines.
- Database constraints guarantee integrity, **not authorization**; the backend must still check who may access which save.

## Connection strings
```text
postgresql://last_lap_user:<password>@localhost:5432/last_lap_db            # standard URL (most drivers)
postgresql+psycopg://last_lap_user:<password>@localhost:5432/last_lap_db    # SQLAlchemy / psycopg 3
host=localhost port=5432 dbname=last_lap_db user=last_lap_user password=<password>   # libpq key/value
```
- **From the host machine:** host `localhost`, port = `POSTGRES_PORT` (default 5432).
- **From another Docker container:** host `postgres` (the service name) and port **5432** (the container port, not the published one) - only if that container
  shares a Docker network with this compose project; otherwise use `host.docker.internal:<POSTGRES_PORT>`.
- Inspect: `psql "postgresql://last_lap_user:<password>@localhost:5432/last_lap_db"`, or any client (pgAdmin, DBeaver). No admin UI is bundled on purpose.

## Migrations
Plain, forward-only SQL files in `migrations/` (`NNNN_name.sql`), applied by `scripts/migrate.sh`:
```bash
bash scripts/migrate.sh status    # applied / pending / changed
bash scripts/migrate.sh current   # e.g. 0001
bash scripts/migrate.sh up        # apply pending ones
```
Each migration runs in one transaction together with its bookkeeping row; applied files are checksummed (editing one is an error). There are no
"down" scripts and nothing drops or recreates the schema by itself. Add `0002_*.sql` with explicit `GRANT`s for new tables.

## Tests
```bash
bash scripts/test.sh               # schema, constraints, JSONB, transactions, triggers, privileges, persistence, backup/restore
bash scripts/test-operational.sh   # Docker only: throw-away stack - health check, migrate, connect, data survives restart
```
`test.sh` creates `last_lap_test_<id>` (and one `_restored` twin), runs everything there and drops them. It never touches `POSTGRES_DB`.
`test-operational.sh` uses its own compose project name, volume, random passwords and port 55432, and removes all of it afterwards.

## Backup and restore
```bash
bash scripts/backup.sh                                        # -> backups/last_lap_db_<UTC timestamp>.dump (mode 600)
bash scripts/restore.sh backups/<file>.dump                   # into an EMPTY database (created if missing)
bash scripts/restore.sh backups/<file>.dump --db other_db     # into a different database
bash scripts/restore.sh backups/<file>.dump --recreate        # DROPS the target database first, then restores
```
Backups hold player data and password hashes: keep them private, copy them off the machine, and test a restore periodically.
The dump includes `schema_migrations`, so `migrate.sh status` is correct after a restore.
Without host tools: `docker compose exec -T postgres pg_dump -U <migrator> -Fc <db> > backup.dump` (password via `PGPASSWORD`); restore with `pg_restore` in the same way.
Data persistence itself comes from the named volume `last_lap_pgdata`; `docker compose down` keeps it, `down -v` deletes it.

## Rotating credentials
1. Edit the password(s) in `.env`.
2. `bash scripts/bootstrap.sh` (re-sets the role passwords; safe to repeat; the superuser's own password changes via `ALTER ROLE` in psql and in `.env`).
3. Update the backend's secret and restart it. Restart the DB container only if you changed ports/image.
Changing `.env` alone does **not** change the passwords inside an already-initialised database.

## Sample data
`bash scripts/seed-dev.sh --yes` loads three fictional accounts (unusable password hashes) with realistic progress. Development databases only.

## Integrating later
See [`docs/INTEGRATION_GUIDE.md`](docs/INTEGRATION_GUIDE.md).

## Verification status
See the final report delivered with this archive. Summary of what was actually run when this was built (an offline sandbox without PostgreSQL or Docker):

| Check | Status |
|---|---|
| Original archives inspected read-only; originals unchanged (SHA-256 audit) | done |
| `bash -n` syntax check of every script; `docker-compose.yml` parsed as YAML | done |
| Migrations applied to a clean database | **NOT executed** (no PostgreSQL available) |
| SQL test-suite (`scripts/test.sh`) | **NOT executed** |
| Docker Compose start / health check / restart persistence (`scripts/test-operational.sh`) | **NOT executed** |
| Backup / restore round-trip | **NOT executed** (part of `test.sh`) |

Please run `bash scripts/test.sh` and `bash scripts/test-operational.sh` once; any failure points at the exact assertion.
