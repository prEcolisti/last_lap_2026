-- Persistence phase B: a NEW connection must see the committed data from phase A.
SELECT t.assert_true(
  (SELECT s.progress FROM game_saves s JOIN users u ON u.id = s.user_id WHERE u.nickname = 'persist_user')
    = '{"introSeen": true, "examined": ["no-skid", "debris"], "asked": ["sponsor:photo"]}'::jsonb,
  'phase B (new connection) reads back the exact progress written in phase A');
