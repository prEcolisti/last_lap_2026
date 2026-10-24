-- updated_at maintenance. Autocommit on purpose (now() is constant inside one transaction).
WITH ins AS (INSERT INTO users (nickname, password_hash) VALUES ('trigger_user', 'h') RETURNING id)
SELECT id AS uid FROM ins \gset
SELECT t.assert_true(updated_at = created_at, 'users: updated_at equals created_at on insert')
  FROM users WHERE id = :'uid'::uuid;
SELECT pg_sleep(0.05);
UPDATE users SET is_active = false WHERE id = :'uid'::uuid;
SELECT t.assert_true(updated_at > created_at, 'users: updated_at advances on update')
  FROM users WHERE id = :'uid'::uuid;

INSERT INTO game_saves (user_id, game_case_id)
SELECT :'uid'::uuid, id FROM game_cases WHERE slug = 'case-001';
SELECT pg_sleep(0.05);
UPDATE game_saves SET progress = '{"introSeen": true}'::jsonb WHERE user_id = :'uid'::uuid;
SELECT t.assert_true(updated_at > created_at, 'game_saves: updated_at advances on update')
  FROM game_saves WHERE user_id = :'uid'::uuid;

DELETE FROM game_saves WHERE user_id = :'uid'::uuid;
DELETE FROM users WHERE id = :'uid'::uuid;
