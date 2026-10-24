-- =============================================================================
-- DEVELOPMENT SAMPLE DATA - fictional, never load into a real/production database.
-- Loaded only by hand:  bash scripts/seed-dev.sh --yes
-- The password hashes are deliberately unusable placeholders: these accounts cannot log in.
-- The ids used in "examined"/"asked" are the real ones from the frontend (see docs/SCHEMA.md).
-- Idempotent: running it twice changes nothing.
-- =============================================================================
SET client_encoding = 'UTF8';
BEGIN;

INSERT INTO users (nickname, password_hash) VALUES
  ('dev_rookie',    '!DEV-ONLY-UNUSABLE-HASH!'),
  ('dev_detective', '!DEV-ONLY-UNUSABLE-HASH!'),
  ('dev_veteran',   '!DEV-ONLY-UNUSABLE-HASH!')
ON CONFLICT DO NOTHING;

INSERT INTO game_saves (user_id, game_case_id, progress)
SELECT u.id, c.id, v.progress::jsonb
FROM (VALUES
  ('dev_rookie',    '{"introSeen": false, "examined": [], "asked": []}'),
  ('dev_detective', '{"introSeen": true, "examined": ["no-skid", "wreck", "barrier", "debris", "shift-board"], "asked": ["pilot:friend", "pilot:envy", "pilot:race"]}'),
  ('dev_veteran',   '{"introSeen": true,
                      "examined": ["no-skid", "wreck", "barrier", "debris", "shift-board", "fifth-uniform", "insulation-tools", "vip-box"],
                      "asked": ["pilot:friend", "pilot:envy", "pilot:race", "pilot:brakes",
                                "mechanic:custody", "mechanic:count", "mechanic:fifth", "mechanic:alibi",
                                "sponsor:grief", "sponsor:motive", "sponsor:stands", "sponsor:photo"]}')
) AS v(nickname, progress)
JOIN users u ON lower(u.nickname) = lower(v.nickname)
CROSS JOIN game_cases c
WHERE c.slug = 'case-001'
ON CONFLICT (user_id, game_case_id) DO NOTHING;

COMMIT;
