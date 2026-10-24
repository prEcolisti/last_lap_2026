-- Test helpers (installed only into the disposable test database).
CREATE SCHEMA IF NOT EXISTS t;

CREATE OR REPLACE FUNCTION t.assert_true(cond boolean, msg text) RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
  IF cond IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'ASSERTION FAILED: %', msg;
  END IF;
  RAISE NOTICE 'ok - %', msg;
END $$;

-- Runs a statement and requires it to fail with exactly the given SQLSTATE.
CREATE OR REPLACE FUNCTION t.assert_raises(stmt text, expected_state text, msg text) RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
  BEGIN
    EXECUTE stmt;
  EXCEPTION WHEN OTHERS THEN
    IF SQLSTATE = expected_state THEN
      RAISE NOTICE 'ok - %', msg;
      RETURN;
    END IF;
    RAISE EXCEPTION 'ASSERTION FAILED: % (expected SQLSTATE %, got % - %)', msg, expected_state, SQLSTATE, SQLERRM;
  END;
  RAISE EXCEPTION 'ASSERTION FAILED: % (expected SQLSTATE %, but no error was raised)', msg, expected_state;
END $$;

GRANT USAGE ON SCHEMA t TO last_lap_app;
GRANT EXECUTE ON FUNCTION t.assert_true(boolean, text) TO last_lap_app;
GRANT EXECUTE ON FUNCTION t.assert_raises(text, text, text) TO last_lap_app;
