-- JSONB progress tests: real frontend-shaped progress, validation, and the atomic save function.
-- Rolled back at the end.
BEGIN;

WITH ins AS (INSERT INTO users (nickname, password_hash) VALUES ('prog_user_a', 'h') RETURNING id)
SELECT id AS ua FROM ins \gset
WITH ins AS (INSERT INTO users (nickname, password_hash) VALUES ('prog_user_b', 'h') RETURNING id)
SELECT id AS ub FROM ins \gset

-- 1. Store and read back the real progress shape (src/game/progress.ts), including ids from the frontend.
INSERT INTO game_saves (user_id, game_case_id, progress)
SELECT :'ua'::uuid, id,
  '{"introSeen": true, "examined": ["no-skid", "wreck", "vip-box"], "asked": ["pilot:friend", "pilot:envy", "mechanic:custody"]}'::jsonb
FROM game_cases WHERE slug = 'case-001';

SELECT t.assert_true(
  (SELECT progress FROM game_saves WHERE user_id = :'ua'::uuid)
    = '{"asked": ["pilot:friend", "pilot:envy", "mechanic:custody"], "examined": ["no-skid", "wreck", "vip-box"], "introSeen": true}'::jsonb,
  'progress JSONB round-trips unchanged (key order irrelevant)');
SELECT t.assert_true(
  (SELECT (progress ->> 'introSeen')::boolean FROM game_saves WHERE user_id = :'ua'::uuid) = true
  AND (SELECT jsonb_array_length(progress -> 'examined') FROM game_saves WHERE user_id = :'ua'::uuid) = 3
  AND (SELECT progress -> 'asked' ->> 0 FROM game_saves WHERE user_id = :'ua'::uuid) = 'pilot:friend',
  'JSON fields have the expected types and order');

-- 2. Legacy empty object and extra keys are accepted (frontend merges defaults / may grow new fields).
UPDATE game_saves SET progress = '{}'::jsonb WHERE user_id = :'ua'::uuid;
SELECT t.assert_true((SELECT progress FROM game_saves WHERE user_id = :'ua'::uuid) = '{}'::jsonb,
  'legacy empty progress {} is accepted');
UPDATE game_saves SET progress = '{"introSeen": true, "futureField": {"accused": "sponsor"}}'::jsonb WHERE user_id = :'ua'::uuid;
SELECT t.assert_true((SELECT progress #>> '{futureField,accused}' FROM game_saves WHERE user_id = :'ua'::uuid) = 'sponsor',
  'unknown extra keys are preserved (room for the finale stage)');

-- 3. Invalid shapes are rejected.
SELECT t.assert_raises(format('UPDATE game_saves SET progress = %L::jsonb WHERE user_id = %L::uuid', '[]', :'ua'),
  '23514', 'progress must be a JSON object');
SELECT t.assert_raises(format('UPDATE game_saves SET progress = %L::jsonb WHERE user_id = %L::uuid', '{"examined": "wreck"}', :'ua'),
  '23514', 'examined must be an array');
SELECT t.assert_raises(format('UPDATE game_saves SET progress = %L::jsonb WHERE user_id = %L::uuid', '{"examined": [1, 2]}', :'ua'),
  '23514', 'examined must contain strings only');
SELECT t.assert_raises(format('UPDATE game_saves SET progress = %L::jsonb WHERE user_id = %L::uuid', '{"asked": null}', :'ua'),
  '23514', 'asked must not be null');
SELECT t.assert_raises(format('UPDATE game_saves SET progress = %L::jsonb WHERE user_id = %L::uuid', '{"introSeen": "yes"}', :'ua'),
  '23514', 'introSeen must be a boolean');
SELECT t.assert_raises(format('UPDATE game_saves SET progress = jsonb_build_object(''blob'', repeat(''x'', 70000)) WHERE user_id = %L::uuid', :'ua'),
  '23514', 'progress larger than 64 KiB rejected');
SELECT t.assert_raises(format('UPDATE game_saves SET progress = NULL WHERE user_id = %L::uuid', :'ua'),
  '23502', 'progress must not be NULL');

-- 4. save_game_progress: create-on-first-save, shallow merge, arrays replaced, single row per user/case.
SELECT t.assert_true(
  (SELECT progress FROM save_game_progress(:'ub'::uuid, 'case-001', '{"introSeen": true}'))
    = '{"introSeen": true, "examined": [], "asked": []}'::jsonb,
  'first save creates the row and fills defaults for missing keys');
SELECT t.assert_true(
  (SELECT progress FROM save_game_progress(:'ub'::uuid, 'case-001', '{"examined": ["wreck"]}'))
    = '{"introSeen": true, "examined": ["wreck"], "asked": []}'::jsonb,
  'patch merges: introSeen kept, examined updated, asked untouched');
SELECT t.assert_true(
  (SELECT progress FROM save_game_progress(:'ub'::uuid, 'case-001', '{"examined": ["wreck", "barrier"], "asked": ["sponsor:grief"]}'))
    = '{"introSeen": true, "examined": ["wreck", "barrier"], "asked": ["sponsor:grief"]}'::jsonb,
  'arrays are replaced by the patch (same as frontend saveProgress)');
SELECT t.assert_true((SELECT count(*) FROM game_saves WHERE user_id = :'ub'::uuid) = 1,
  'repeated saves keep a single row per (user, case)');
SELECT t.assert_true((SELECT count(*) FROM save_game_progress(:'ub'::uuid, 'no-such-case', '{}')) = 0,
  'unknown case slug returns no row and writes nothing');
SELECT t.assert_raises(format('SELECT * FROM save_game_progress(%L::uuid, %L, %L::jsonb)', :'ub', 'case-001', '[1]'),
  '23514', 'non-object patch is rejected by the table constraints');
SELECT t.assert_raises($q$SELECT * FROM save_game_progress(gen_random_uuid(), 'case-001', '{}')$q$,
  '23503', 'save for an unknown user is rejected');

-- 5. Users are isolated from each other.
SELECT t.assert_true(
  (SELECT progress -> 'examined' FROM game_saves WHERE user_id = :'ub'::uuid) = '["wreck", "barrier"]'::jsonb
  AND (SELECT progress #>> '{futureField,accused}' FROM game_saves WHERE user_id = :'ua'::uuid) = 'sponsor',
  'two users have independent saves');

ROLLBACK;
