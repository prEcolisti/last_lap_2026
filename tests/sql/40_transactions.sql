-- Transaction tests. Autocommit mode on purpose; leaves no rows behind.

-- A failing statement inside a block undoes the earlier statements of that block.
DO $$
BEGIN
  BEGIN
    INSERT INTO users (nickname, password_hash) VALUES ('tx_rollback_user', 'h');
    INSERT INTO game_saves (user_id, game_case_id, progress)
      SELECT u.id, c.id, '{"examined": "not-an-array"}'::jsonb
      FROM users u, game_cases c WHERE u.nickname = 'tx_rollback_user' AND c.slug = 'case-001';
    RAISE EXCEPTION 'the invalid save should have been rejected';
  EXCEPTION WHEN check_violation THEN
    NULL;  -- expected; the sub-transaction rolls back the user insert as well
  END;
END $$;
SELECT t.assert_true(NOT EXISTS (SELECT 1 FROM users WHERE nickname = 'tx_rollback_user'),
  'failed multi-statement unit of work leaves no partial user row');

-- Explicit ROLLBACK.
BEGIN;
INSERT INTO users (nickname, password_hash) VALUES ('tx_explicit_rollback', 'h');
ROLLBACK;
SELECT t.assert_true(NOT EXISTS (SELECT 1 FROM users WHERE nickname = 'tx_explicit_rollback'),
  'explicit ROLLBACK discards the insert');

-- COMMIT makes data visible to later statements.
BEGIN;
INSERT INTO users (nickname, password_hash) VALUES ('tx_commit_user', 'h');
COMMIT;
SELECT t.assert_true(EXISTS (SELECT 1 FROM users WHERE nickname = 'tx_commit_user'),
  'COMMIT keeps the insert');
DELETE FROM users WHERE nickname = 'tx_commit_user';
