-- Schema tests: structure exists as designed. Read-only. Run as superuser.
DO $$
DECLARE tbl text;
BEGIN
  FOREACH tbl IN ARRAY ARRAY['users', 'game_cases', 'game_saves', 'sessions', 'schema_migrations'] LOOP
    PERFORM t.assert_true(to_regclass('public.' || tbl) IS NOT NULL, 'table exists: ' || tbl);
    PERFORM t.assert_true(
      EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = ('public.' || tbl)::regclass AND contype = 'p'),
      'primary key exists: ' || tbl);
  END LOOP;
END $$;

SELECT t.assert_true((SELECT count(*) FROM pg_tables WHERE schemaname = 'public') = 5,
  'no unexpected tables in public (exactly 5)');

-- Foreign keys exist and none cascade (valuable game data must not vanish silently).
SELECT t.assert_true(
  (SELECT count(*) FROM pg_constraint
    WHERE contype = 'f' AND connamespace = 'public'::regnamespace) = 3,
  'exactly 3 foreign keys (saves->users, saves->cases, sessions->users)');
SELECT t.assert_true(
  NOT EXISTS (SELECT 1 FROM pg_constraint
    WHERE contype = 'f' AND connamespace = 'public'::regnamespace AND confdeltype <> 'r'),
  'every foreign key is ON DELETE RESTRICT (no cascading deletes)');
SELECT t.assert_true(
  EXISTS (SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.game_saves'::regclass AND contype = 'f' AND confrelid = 'public.users'::regclass),
  'game_saves references users');
SELECT t.assert_true(
  EXISTS (SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.game_saves'::regclass AND contype = 'f' AND confrelid = 'public.game_cases'::regclass),
  'game_saves references game_cases');
SELECT t.assert_true(
  EXISTS (SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.sessions'::regclass AND contype = 'f' AND confrelid = 'public.users'::regclass),
  'sessions references users');

-- Indexes (unique + supporting).
DO $$
DECLARE idx text;
BEGIN
  FOREACH idx IN ARRAY ARRAY[
    'users_nickname_lower_key', 'game_cases_slug_key', 'game_saves_user_case_key',
    'game_saves_game_case_id_idx', 'sessions_token_hash_key', 'sessions_user_id_idx', 'sessions_expires_at_idx'
  ] LOOP
    PERFORM t.assert_true(
      EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = idx),
      'index exists: ' || idx);
  END LOOP;
END $$;

-- Reference data, function, encoding.
SELECT t.assert_true((SELECT count(*) FROM game_cases) = 1 AND EXISTS (SELECT 1 FROM game_cases WHERE slug = 'case-001'),
  'game_cases is seeded with exactly case-001');
SELECT t.assert_true((SELECT title FROM game_cases WHERE slug = 'case-001') = 'Последний круг',
  'Cyrillic case title round-trips (UTF-8)');
SELECT t.assert_true(to_regprocedure('public.save_game_progress(uuid,text,jsonb)') IS NOT NULL,
  'function save_game_progress exists');
SELECT t.assert_true(
  (SELECT pg_encoding_to_char(encoding) FROM pg_database WHERE datname = current_database()) = 'UTF8',
  'database encoding is UTF8');

-- Migration bookkeeping.
SELECT t.assert_true(EXISTS (SELECT 1 FROM schema_migrations WHERE version = '0001'),
  'migration 0001 is recorded in schema_migrations');
