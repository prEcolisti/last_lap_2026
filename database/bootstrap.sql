-- =============================================================================
-- Bootstrap: roles + database + lockdown. Run as a SUPERUSER, connected to the
-- maintenance database "postgres". Idempotent: safe to re-run (this is also how
-- passwords are rotated: edit .env, then run scripts/bootstrap.sh).
--
-- Reads its parameters from environment variables with psql's \getenv
-- (requires psql >= 15), so no password ever appears on a command line.
--
-- Role model
--   superuser (POSTGRES_SUPERUSER)  bootstrap only; never used by an application
--   last_lap_migrator               owns every object; runs migrations/backups (DDL)
--   last_lap_app (NOLOGIN group)    holds the runtime privileges (granted by migrations)
--   last_lap_user (LOGIN)           member of last_lap_app; what the future backend uses
-- =============================================================================
\set ON_ERROR_STOP on

\getenv db_name POSTGRES_DB
\getenv migrator_user LAST_LAP_MIGRATOR_USER
\getenv migrator_password LAST_LAP_MIGRATOR_PASSWORD
\getenv app_user LAST_LAP_APP_USER
\getenv app_password LAST_LAP_APP_PASSWORD

-- Group role that carries the runtime privileges. Migrations GRANT to it by name.
SELECT 'CREATE ROLE last_lap_app NOLOGIN'
WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'last_lap_app')
\gexec

-- Migration/owner role (no superuser, cannot create roles or databases).
SELECT format('CREATE ROLE %I LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION', :'migrator_user')
WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = :'migrator_user')
\gexec
SELECT format('ALTER ROLE %I WITH LOGIN NOSUPERUSER PASSWORD %L', :'migrator_user', :'migrator_password')
\gexec

-- Runtime login role (no superuser, no DDL; privileges come only via last_lap_app).
SELECT format('CREATE ROLE %I LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION', :'app_user')
WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = :'app_user')
\gexec
SELECT format('ALTER ROLE %I WITH LOGIN NOSUPERUSER PASSWORD %L', :'app_user', :'app_password')
\gexec
SELECT format('GRANT last_lap_app TO %I', :'app_user')
\gexec

-- Dedicated database (the official Docker image has already created it; plain servers have not).
SELECT format('CREATE DATABASE %I OWNER %I', :'db_name', :'migrator_user')
WHERE NOT EXISTS (SELECT 1 FROM pg_database WHERE datname = :'db_name')
\gexec
SELECT format('ALTER DATABASE %I OWNER TO %I', :'db_name', :'migrator_user')
\gexec
-- Nobody gets in by default; only the app group (and the owner/superuser) may connect.
SELECT format('REVOKE ALL ON DATABASE %I FROM PUBLIC', :'db_name')
\gexec
SELECT format('GRANT CONNECT ON DATABASE %I TO last_lap_app', :'db_name')
\gexec

-- Schema-level lockdown inside the target database.
\connect :db_name
SELECT format('ALTER SCHEMA public OWNER TO %I', :'migrator_user')
\gexec
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
GRANT USAGE ON SCHEMA public TO last_lap_app;
