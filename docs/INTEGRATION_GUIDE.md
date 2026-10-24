# Future integration guide (documentation only - nothing here has been done)

This explains how **you** can connect this database to your existing project later.
No file of the original frontend or backend was changed, and none of the steps below were performed.

## 1. Connection settings

| Item | Value |
|---|---|
| Database | `last_lap_db` (`POSTGRES_DB`) |
| Runtime user | `last_lap_user` (`LAST_LAP_APP_USER`) - use **this** in the backend |
| Password | from your local `.env` (`LAST_LAP_APP_PASSWORD`); keep it in the backend's own secret/env config only |
| Server | `localhost:5432` from the host; `postgres:5432` from another container on the same compose network |

```text
postgresql://last_lap_user:<password>@localhost:5432/last_lap_db            # libpq / node-pg / asyncpg / most drivers
postgresql+psycopg://last_lap_user:<password>@localhost:5432/last_lap_db    # SQLAlchemy 2 + psycopg 3
postgresql+psycopg2://last_lap_user:<password>@localhost:5432/last_lap_db   # SQLAlchemy + psycopg2
```
URL-encode special characters in the password (or generate it with `openssl rand -hex 24`).
Never use the migrator or superuser credentials in the backend, and never put any of them in the frontend (`VITE_*` variables are public).

Another container reaching this database: either put both compose projects on one external network and use host `postgres`,
or use host `host.docker.internal` with the published port. Do not publish the port on `0.0.0.0` unless you know why.

## 2. Table <-> game concept map
| Existing concept | Table / column |
|---|---|
| Frontend `User { id, nickname, createdAt }` | `users (id, nickname, created_at)` |
| Legacy backend `users(id INT, username, password_hash)` | `users (id UUID, nickname, password_hash)` |
| Case `case-001` ("Последний круг") | `game_cases` row, referenced by `game_saves.game_case_id` |
| Frontend `Progress {introSeen, examined, asked}` / legacy `saves.progress_json` | `game_saves.progress` (JSONB, same field names and types) |
| Legacy in-memory `SESSIONS` dict / frontend Bearer token | `sessions (token_hash, expires_at, revoked_at)` |
| Story text, clues, suspects, dialogues | **not in the DB** - they stay in the frontend |

## 3. Progress fields stored in JSONB
```json
{ "introSeen": true,
  "examined": ["no-skid", "wreck", "vip-box"],
  "asked": ["pilot:friend", "mechanic:count"] }
```
Valid ids are listed in `docs/SCHEMA.md`. The DB checks only shape/types; **validate the ids in the backend** so a client cannot store junk.
New fields (e.g. the future accusation) can be added without a migration; bump `schema_version` if you change existing fields' meaning.

## 4. Ready-to-use SQL (parameterized; `$1` style shown)
```sql
-- Register (23505 unique_violation -> HTTP 409 "nickname taken")
INSERT INTO users (nickname, password_hash) VALUES ($1, $2) RETURNING id, nickname, created_at;

-- Login lookup (case-insensitive, uses the lower(nickname) index); verify the hash in the backend
SELECT id, nickname, password_hash, is_active, created_at FROM users WHERE lower(nickname) = lower($1);

-- Create session (store sha256(token) as lowercase hex, never the token)
INSERT INTO sessions (user_id, token_hash, expires_at) VALUES ($1, $2, now() + interval '30 days');

-- Authenticate a request / GET /auth/me
SELECT u.id, u.nickname, u.created_at
FROM sessions s JOIN users u ON u.id = s.user_id
WHERE s.token_hash = $1 AND s.revoked_at IS NULL AND s.expires_at > now() AND u.is_active;

-- Logout
UPDATE sessions SET revoked_at = now() WHERE token_hash = $1 AND revoked_at IS NULL;

-- Housekeeping (cron)
DELETE FROM sessions WHERE expires_at < now() - interval '7 days' OR revoked_at < now() - interval '7 days';

-- Load progress; zero rows = new player -> return {"introSeen": false, "examined": [], "asked": []}
SELECT s.progress, s.updated_at
FROM game_saves s JOIN game_cases c ON c.id = s.game_case_id
WHERE s.user_id = $1 AND c.slug = $2;

-- Save progress: atomic create-or-merge (patch semantics = frontend saveProgress)
SELECT progress, updated_at FROM save_game_progress($1, 'case-001', $2::jsonb);

-- Reset progress (irreversible overwrite!)
UPDATE game_saves s SET progress = '{"introSeen": false, "examined": [], "asked": []}'::jsonb
FROM game_cases c WHERE c.id = s.game_case_id AND s.user_id = $1 AND c.slug = $2;
```

## 5. Application-level checks the database cannot do
1. **Authenticate every save/load request** and take `user_id` from the session lookup - never from the URL/body.
2. A user may read/write **only their own** save. The DB will happily store a save for any valid user id you pass.
3. Verify the password hash in the backend (Argon2id recommended for new accounts; legacy `salt$digest` PBKDF2 hashes can be stored as-is and re-hashed on next login).
4. Generate tokens with a CSPRNG (>= 32 bytes), hash with SHA-256 before storing, set/send over HTTPS only.
5. Validate `examined`/`asked` ids against the known lists; cap payload size (the DB caps at 64 KiB as a last resort).
6. Rate-limit login/registration; the schema has no lockout.
7. Check `is_active` and `expires_at`/`revoked_at` (see the authenticate query).
8. Return `401` vs `403` consistently with the frontend's `ApiError` handling.

## 6. Transformations you will likely need
- DB `created_at` (timestamptz) -> frontend `createdAt` (ISO string); `nickname` stays `nickname`.
- Frontend expects `{ token, user }` from login/register and `{message}` on errors; the legacy backend returns `{id, username}` + a cookie. Pick one and adapt.
- Frontend `User.id` is a string: send the UUID as text.
- Legacy `GET /saves/current` returned `{case_id, progress, updated_at}`; map `case_id` <- `game_cases.slug`.
- The frontend currently reads/writes progress **only in localStorage** (`src/game/progress.ts`). To sync, `loadProgress`/`saveProgress` will have to call a new API. That is a future frontend change and is not part of this deliverable.
- Optional one-time migration of local progress: on first login after the switch, send the localStorage progress to the save endpoint if the server has no row.

## 7. Applying migrations during/after integration
```bash
bash scripts/migrate.sh status        # what is applied
bash scripts/migrate.sh up            # apply pending
```
Add changes as `migrations/0002_<name>.sql` (never edit an applied file; the runner detects checksum changes).
Every new table needs explicit `GRANT`s to `last_lap_app` in its migration (there are deliberately no default privileges).

## 8. Recommended order
1. Start PostgreSQL, run migrations, run `scripts/test.sh` (see README).
2. Decide the API contract (frontend's `/auth/*` + Bearer is the least work on the frontend side).
3. Add a DB layer to the backend using the **runtime** credentials; implement register/login/logout/me on `users` + `sessions`.
4. Add the saves endpoint (load + `save_game_progress`), with the authorization checks above.
5. Point `VITE_API_URL` at the backend; switch `progress.ts` to the API (keep localStorage as an offline fallback if wanted).
6. Optional: import legacy SQLite users/saves (below).
7. Set up scheduled backups (`scripts/backup.sh`) and a session-purge job; review credentials/rotation.

## 9. Importing legacy SQLite data (sketch; no SQLite file was provided)
- `users.username -> nickname` (case-insensitive duplicates would now conflict - resolve beforehand; `username` longer than 32 is impossible, > 16 is allowed by the DB).
- Generate a UUID per user; keep a temporary old-id -> uuid map. Copy `password_hash` unchanged.
- `saves.progress_json` -> `game_saves.progress`; `case_id` -> `game_cases.id` via slug. Legacy `{}` progress is valid.
- `created_at/updated_at` in SQLite are UTC text; cast to `timestamptz` explicitly.
- Run inside one transaction against a restored copy first. Legacy sessions are in memory and cannot be migrated: everyone logs in again.
