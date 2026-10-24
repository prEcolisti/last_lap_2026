-- Constraint tests: bad data is rejected with the right error. Rolled back at the end.
BEGIN;

-- users
WITH ins AS (INSERT INTO users (nickname, password_hash) VALUES ('Dup_User', 'test-hash') RETURNING id)
SELECT id AS uid FROM ins \gset
SELECT t.assert_true((SELECT nickname FROM users WHERE id = :'uid'::uuid) = 'Dup_User', 'valid user inserted, original case preserved');
SELECT t.assert_raises($q$INSERT INTO users (nickname, password_hash) VALUES ('Dup_User', 'x')$q$, '23505', 'duplicate nickname rejected');
SELECT t.assert_raises($q$INSERT INTO users (nickname, password_hash) VALUES ('dup_user', 'x')$q$, '23505', 'nickname uniqueness is case-insensitive');
SELECT t.assert_raises($q$INSERT INTO users (nickname, password_hash) VALUES ('ab', 'x')$q$, '23514', 'nickname shorter than 3 rejected');
SELECT t.assert_raises($q$INSERT INTO users (nickname, password_hash) VALUES (repeat('a', 33), 'x')$q$, '23514', 'nickname longer than 32 rejected');
SELECT t.assert_raises($q$INSERT INTO users (nickname, password_hash) VALUES ('bad name', 'x')$q$, '23514', 'nickname with a space rejected');
SELECT t.assert_raises($q$INSERT INTO users (nickname, password_hash) VALUES ('имя_игрока', 'x')$q$, '23514', 'non-Latin nickname rejected (frontend allows A-Za-z0-9_ only)');
SELECT t.assert_raises($q$INSERT INTO users (nickname, password_hash) VALUES ('empty_hash', '')$q$, '23514', 'empty password_hash rejected');
SELECT t.assert_raises($q$INSERT INTO users (nickname, password_hash) VALUES (NULL, 'x')$q$, '23502', 'NULL nickname rejected');
SELECT t.assert_raises($q$INSERT INTO users (nickname, password_hash) VALUES ('no_hash', NULL)$q$, '23502', 'NULL password_hash rejected');

-- game_cases
SELECT t.assert_raises($q$INSERT INTO game_cases (slug, title) VALUES ('case-001', 'dup')$q$, '23505', 'duplicate case slug rejected');
SELECT t.assert_raises($q$INSERT INTO game_cases (slug, title) VALUES ('Bad Slug', 'x')$q$, '23514', 'malformed case slug rejected');

-- game_saves
INSERT INTO game_saves (user_id, game_case_id)
SELECT :'uid'::uuid, id FROM game_cases WHERE slug = 'case-001';
SELECT t.assert_true(
  (SELECT progress FROM game_saves WHERE user_id = :'uid'::uuid) = '{"introSeen": false, "examined": [], "asked": []}'::jsonb,
  'a save created without progress gets the default empty progress');
SELECT t.assert_raises(
  format('INSERT INTO game_saves (user_id, game_case_id) SELECT %L::uuid, id FROM game_cases WHERE slug = %L', :'uid', 'case-001'),
  '23505', 'second save for the same (user, case) rejected');
SELECT t.assert_raises(
  $q$INSERT INTO game_saves (user_id, game_case_id) SELECT gen_random_uuid(), id FROM game_cases WHERE slug = 'case-001'$q$,
  '23503', 'save for a non-existent user rejected (foreign key)');
SELECT t.assert_raises(
  format('INSERT INTO game_saves (user_id, game_case_id) VALUES (%L::uuid, 32000)', :'uid'),
  '23503', 'save for a non-existent case rejected (foreign key)');

-- deletion rules: nothing cascades, nothing is lost silently
SELECT t.assert_raises(format('DELETE FROM users WHERE id = %L::uuid', :'uid'), '23503',
  'cannot delete a user who has a save (RESTRICT)');
SELECT t.assert_raises($q$DELETE FROM game_cases WHERE slug = 'case-001'$q$, '23503',
  'cannot delete a case that has saves (RESTRICT)');

-- sessions
SELECT t.assert_raises(
  format('INSERT INTO sessions (user_id, token_hash, expires_at) VALUES (%L::uuid, %L, now() + interval ''1 day'')', :'uid', 'not-a-sha256'),
  '23514', 'malformed token_hash rejected');
SELECT t.assert_raises(
  format('INSERT INTO sessions (user_id, token_hash, expires_at) VALUES (%L::uuid, repeat(''a'', 64), now())', :'uid'),
  '23514', 'session that expires at creation time rejected');
SELECT t.assert_raises(
  $q$INSERT INTO sessions (user_id, token_hash, expires_at) VALUES (gen_random_uuid(), repeat('b', 64), now() + interval '1 day')$q$,
  '23503', 'session for a non-existent user rejected (foreign key)');
INSERT INTO sessions (user_id, token_hash, expires_at) VALUES (:'uid'::uuid, repeat('c', 64), now() + interval '1 day');
SELECT t.assert_raises(
  format('INSERT INTO sessions (user_id, token_hash, expires_at) VALUES (%L::uuid, repeat(''c'', 64), now() + interval ''2 day'')', :'uid'),
  '23505', 'duplicate token_hash rejected');
SELECT t.assert_raises(format('DELETE FROM users WHERE id = %L::uuid', :'uid'), '23503',
  'cannot delete a user who has sessions/saves (RESTRICT)');

ROLLBACK;
