-- Privilege tests. MUST run as the runtime login role (last_lap_user), not as a superuser.
SELECT t.assert_true(NOT (SELECT rolsuper FROM pg_roles WHERE rolname = current_user), 'runtime role is not a superuser');
SELECT t.assert_true(NOT (SELECT rolcreaterole OR rolcreatedb FROM pg_roles WHERE rolname = current_user),
  'runtime role cannot create roles or databases');

-- Allowed: the normal application workflow.
WITH ins AS (INSERT INTO users (nickname, password_hash) VALUES ('priv_user', 'test-hash') RETURNING id)
SELECT id AS uid FROM ins \gset
SELECT t.assert_true((SELECT count(*) FROM game_cases) = 1, 'app can read game_cases');
SELECT t.assert_true((SELECT count(*) FROM save_game_progress(:'uid'::uuid, 'case-001', '{"introSeen": true}')) = 1,
  'app can save progress through save_game_progress');
UPDATE game_saves SET progress = '{"introSeen": true, "examined": ["wreck"]}'::jsonb WHERE user_id = :'uid'::uuid;
UPDATE users SET is_active = false, password_hash = 'new-hash' WHERE id = :'uid'::uuid;
INSERT INTO sessions (user_id, token_hash, expires_at) VALUES (:'uid'::uuid, repeat('d', 64), now() + interval '30 days');
UPDATE sessions SET revoked_at = now() WHERE user_id = :'uid'::uuid;
DELETE FROM sessions WHERE user_id = :'uid'::uuid;
SELECT t.assert_true(true, 'app can register a user, save, update password/status, create/revoke/purge sessions');

-- Forbidden: destructive or structural operations.
SELECT t.assert_raises(format('DELETE FROM users WHERE id = %L::uuid', :'uid'), '42501', 'app cannot DELETE users');
SELECT t.assert_raises(format('DELETE FROM game_saves WHERE user_id = %L::uuid', :'uid'), '42501', 'app cannot DELETE game_saves');
SELECT t.assert_raises($q$DELETE FROM game_cases$q$, '42501', 'app cannot DELETE game_cases');
SELECT t.assert_raises($q$INSERT INTO game_cases (slug, title) VALUES ('case-002', 'x')$q$, '42501', 'app cannot INSERT game_cases');
SELECT t.assert_raises($q$UPDATE game_cases SET title = 'x'$q$, '42501', 'app cannot UPDATE game_cases');
SELECT t.assert_raises(format('UPDATE users SET nickname = %L WHERE id = %L::uuid', 'hijacked_name', :'uid'), '42501', 'app cannot rename users');
SELECT t.assert_raises(format('UPDATE game_saves SET user_id = user_id WHERE user_id = %L::uuid', :'uid'), '42501', 'app cannot reassign a save to another user');
SELECT t.assert_raises(format('UPDATE sessions SET expires_at = now() WHERE user_id = %L::uuid', :'uid'), '42501', 'app cannot rewrite session expiry');
SELECT t.assert_raises($q$SELECT * FROM schema_migrations$q$, '42501', 'app cannot read schema_migrations');
SELECT t.assert_raises($q$CREATE TABLE public.evil (x int)$q$, '42501', 'app cannot create tables');
SELECT t.assert_raises($q$DROP TABLE public.users$q$, '42501', 'app cannot drop tables');
