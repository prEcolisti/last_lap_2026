-- =============================================================================
-- 0001_initial_schema.sql
--
-- Initial schema for "The Last Lap".
-- Applied by scripts/migrate.sh inside ONE transaction (psql --single-transaction),
-- so this file must not contain BEGIN/COMMIT. NEVER edit it after it has been
-- applied anywhere: scripts/migrate.sh checks a checksum. Add 0002_*.sql instead.
--
-- Source of truth for the shapes below: see docs/ANALYSIS.md (confirmed vs assumed).
-- =============================================================================
SET client_encoding = 'UTF8';

-- ---- Preconditions (fail loudly with a helpful message) ---------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'last_lap_app') THEN
    RAISE EXCEPTION 'Role last_lap_app does not exist. Run scripts/bootstrap.sh before migrating.';
  END IF;
  IF (SELECT pg_encoding_to_char(encoding) FROM pg_database WHERE datname = current_database()) <> 'UTF8' THEN
    RAISE EXCEPTION 'Database % must use UTF8 encoding (case title is Cyrillic).', current_database();
  END IF;
END $$;

-- ---- Helper functions --------------------------------------------------------
CREATE FUNCTION set_updated_at() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END $$;

-- True only for a JSON array whose elements are all JSON strings.
CREATE FUNCTION is_json_string_array(j jsonb) RETURNS boolean
LANGUAGE plpgsql IMMUTABLE PARALLEL SAFE AS $$
BEGIN
  IF j IS NULL OR jsonb_typeof(j) <> 'array' THEN
    RETURN false;
  END IF;
  RETURN NOT EXISTS (
    SELECT 1 FROM jsonb_array_elements(j) AS e(value) WHERE jsonb_typeof(e.value) <> 'string'
  );
END $$;

-- ---- users -------------------------------------------------------------------
-- Frontend contract (src/api/types.ts): User { id: string, nickname, createdAt }.
-- Registration is nickname + password only (no e-mail, by the case rules).
CREATE TABLE users (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  nickname      text        NOT NULL,
  password_hash text        NOT NULL,
  is_active     boolean     NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT users_nickname_format
    CHECK (nickname ~ '^[A-Za-z0-9_]{3,32}$'),
  CONSTRAINT users_password_hash_length
    CHECK (length(password_hash) BETWEEN 1 AND 255)
);
-- Case-insensitive uniqueness, like the frontend mock (nickname.toLowerCase()).
CREATE UNIQUE INDEX users_nickname_lower_key ON users (lower(nickname));
CREATE TRIGGER users_set_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

COMMENT ON TABLE  users IS 'Player accounts. Rows are never deleted by the application role; use is_active = false.';
COMMENT ON COLUMN users.nickname IS 'Login name, original case preserved. Frontend enforces 3-16 chars, legacy backend 3-32; DB accepts 3-32.';
COMMENT ON COLUMN users.password_hash IS 'Opaque password hash produced by the backend (never plaintext). Format is the backend''s choice.';
COMMENT ON COLUMN users.is_active IS 'false = account disabled; data is kept.';

-- ---- game_cases ----------------------------------------------------------------
-- Only a stable identifier registry: the story content itself (clues, suspects,
-- dialogues) is bundled in the frontend and is deliberately NOT duplicated here.
CREATE TABLE game_cases (
  id          smallint    GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  slug        text        NOT NULL,
  title       text        NOT NULL,
  description text,
  is_active   boolean     NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT game_cases_slug_key UNIQUE (slug),
  CONSTRAINT game_cases_slug_format CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  CONSTRAINT game_cases_title_not_empty CHECK (length(title) > 0)
);
CREATE TRIGGER game_cases_set_updated_at BEFORE UPDATE ON game_cases
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

COMMENT ON TABLE game_cases IS 'Registry of playable cases. Reference data owned by migrations, read-only for the application role.';

-- Reference data needed by the foreign key below. 'case-001' is the id used by the
-- legacy backend (saves.case_id DEFAULT) and its story file; the title is from that file.
INSERT INTO game_cases (slug, title) VALUES ('case-001', 'Последний круг');

-- ---- game_saves ------------------------------------------------------------------
-- One row per (user, case). The progress object mirrors src/game/progress.ts:
--   { introSeen: boolean, examined: string[], asked: string[] }
-- Extra keys are allowed on purpose (the finale/accusation stage is "next step" in the frontend README).
CREATE TABLE game_saves (
  id             bigint      GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id        uuid        NOT NULL REFERENCES users (id)      ON DELETE RESTRICT,
  game_case_id   smallint    NOT NULL REFERENCES game_cases (id) ON DELETE RESTRICT,
  progress       jsonb       NOT NULL DEFAULT '{"introSeen": false, "examined": [], "asked": []}'::jsonb,
  schema_version smallint    NOT NULL DEFAULT 1,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT game_saves_user_case_key UNIQUE (user_id, game_case_id),
  CONSTRAINT game_saves_schema_version_positive CHECK (schema_version > 0),
  CONSTRAINT game_saves_progress_is_object CHECK (jsonb_typeof(progress) = 'object'),
  CONSTRAINT game_saves_progress_introseen
    CHECK (NOT (progress ? 'introSeen') OR jsonb_typeof(progress -> 'introSeen') = 'boolean'),
  CONSTRAINT game_saves_progress_examined
    CHECK (NOT (progress ? 'examined') OR is_json_string_array(progress -> 'examined')),
  CONSTRAINT game_saves_progress_asked
    CHECK (NOT (progress ? 'asked') OR is_json_string_array(progress -> 'asked')),
  CONSTRAINT game_saves_progress_size CHECK (octet_length(progress::text) <= 65536)
);
CREATE INDEX game_saves_game_case_id_idx ON game_saves (game_case_id);
CREATE TRIGGER game_saves_set_updated_at BEFORE UPDATE ON game_saves
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

COMMENT ON TABLE  game_saves IS 'Player progress. A missing row means "new player": the application returns the default progress.';
COMMENT ON COLUMN game_saves.progress IS 'Frontend Progress object. See docs/SCHEMA.md for valid ids.';
COMMENT ON COLUMN game_saves.schema_version IS 'Version of the progress JSON layout (1 = introSeen/examined/asked).';

-- ---- sessions --------------------------------------------------------------------
-- The frontend keeps a Bearer token in localStorage and calls GET /auth/me on reload;
-- the legacy backend kept sessions in a Python dict (lost on restart) and says so.
CREATE TABLE sessions (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid        NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
  token_hash text        NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  CONSTRAINT sessions_token_hash_key UNIQUE (token_hash),
  CONSTRAINT sessions_token_hash_format CHECK (token_hash ~ '^[0-9a-f]{64}$'),
  CONSTRAINT sessions_expiry_after_creation CHECK (expires_at > created_at),
  CONSTRAINT sessions_revoked_after_creation CHECK (revoked_at IS NULL OR revoked_at >= created_at)
);
CREATE INDEX sessions_user_id_idx    ON sessions (user_id);
CREATE INDEX sessions_expires_at_idx ON sessions (expires_at);

COMMENT ON TABLE  sessions IS 'Server-side sessions. Only a SHA-256 hash of the bearer token is stored, never the token.';
COMMENT ON COLUMN sessions.token_hash IS 'Lowercase hex SHA-256 (64 chars) of the opaque token handed to the client.';

-- ---- Atomic save helper -----------------------------------------------------------
-- Single-statement upsert that SHALLOW-MERGES a patch into the stored progress,
-- mirroring the frontend: saveProgress() does { ...current, ...patch }.
-- Returns 0 rows if the case slug is unknown/inactive, otherwise the saved row.
CREATE FUNCTION save_game_progress(p_user_id uuid, p_case_slug text, p_patch jsonb)
RETURNS SETOF game_saves
LANGUAGE sql
SET search_path = public, pg_catalog
AS $$
  INSERT INTO game_saves (user_id, game_case_id, progress)
  SELECT p_user_id, c.id,
         '{"introSeen": false, "examined": [], "asked": []}'::jsonb || p_patch
  FROM game_cases c
  WHERE c.slug = p_case_slug AND c.is_active
  ON CONFLICT (user_id, game_case_id)
  DO UPDATE SET progress = game_saves.progress || p_patch
  RETURNING *;
$$;

COMMENT ON FUNCTION save_game_progress(uuid, text, jsonb) IS
  'Atomic upsert with shallow JSON merge (arrays are replaced, not unioned). Caller must have authorised p_user_id.';

-- ---- Privileges for the runtime role (least privilege) --------------------------
-- Objects are owned by the migrator. The app role may NOT: delete users/saves/cases,
-- change nicknames or ownership columns, run DDL, or read schema_migrations.
GRANT SELECT, INSERT ON users TO last_lap_app;
GRANT UPDATE (password_hash, is_active) ON users TO last_lap_app;

GRANT SELECT ON game_cases TO last_lap_app;

GRANT SELECT, INSERT ON game_saves TO last_lap_app;
GRANT UPDATE (progress, schema_version) ON game_saves TO last_lap_app;

GRANT SELECT, INSERT, DELETE ON sessions TO last_lap_app;   -- DELETE = purge expired sessions
GRANT UPDATE (revoked_at) ON sessions TO last_lap_app;

REVOKE ALL ON FUNCTION save_game_progress(uuid, text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION save_game_progress(uuid, text, jsonb) TO last_lap_app;
