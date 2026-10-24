-- Persistence phase A (runtime login, autocommit): write data, then the session ends.
WITH ins AS (INSERT INTO users (nickname, password_hash) VALUES ('persist_user', 'persist-hash') RETURNING id)
SELECT id AS uid FROM ins \gset
SELECT t.assert_true((SELECT count(*) FROM save_game_progress(
  :'uid'::uuid, 'case-001',
  '{"introSeen": true, "examined": ["no-skid", "debris"], "asked": ["sponsor:photo"]}')) = 1,
  'phase A wrote a user and a save');
