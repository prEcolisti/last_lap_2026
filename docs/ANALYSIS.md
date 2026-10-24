# Phase 1 - Read-only analysis of the existing project

Both archives were extracted into separate analysis directories and only **read**. Nothing was run
from them, no dependency was installed, no database was opened (there is no `.db` file in either archive).

## 1. What the two archives really are

| Archive | Contents | Role in this analysis |
|---|---|---|
| `hack2026-CI-front.zip` | Vite + React 19 + TypeScript app (125 files), **newest** (3 locations, interrogations, `asked` progress) | **Authoritative** for game data, progress format and the auth contract |
| `hack2026-CI-backend.zip` | `last_lap/backend/` = FastAPI + SQLite (the only real server code); plus, at the archive root, an **older snapshot** of the React app (no garage/VIP/interrogation pages, progress without `asked`) | Authoritative for the *existing server behaviour*; the React copy inside it was ignored |

`last_lap/README.md` mentions a plain HTML/JS `frontend/` folder served by FastAPI. **That folder is in neither archive**, so it could not be inspected.

## 2. Confirmed by source code

**Game (frontend)**
- One case, no chapters. Three locations (`LocationId`): `crash-site`, `garage`, `vip-box`.
- 8 clues in total (ids in `examined`): `no-skid`, `wreck`, `barrier`, `debris` (crash-site), `shift-board`, `fifth-uniform`, `insulation-tools` (garage), `vip-box` (VIP box).
- 3 suspects: `pilot`, `mechanic`, `sponsor`; 12 interrogation topics. Entries in `asked` are `"<suspectId>:<topicId>"`:
  `pilot:friend|envy|race|brakes`, `mechanic:custody|count|fifth|alibi`, `sponsor:grief|motive|stands|photo`.
- Story text, dialogues, clue positions and art are compiled into the frontend: **static, not DB data**.
- Final accusation stage is announced as "next step" in the README: the progress object will probably grow.

**Progress format** (`src/game/progress.ts`, `Progress` interface)
```ts
{ introSeen: boolean, examined: string[], asked: string[] }
```
Default `{ introSeen: false, examined: [], asked: [] }`. Stored as JSON in `localStorage` under `last-lap:progress:<userId>`;
loading does `{ ...empty, ...parsed }`, saving does `{ ...current, ...patch }` (shallow merge; arrays replaced).
Written by: `IntroPage` (`introSeen`), `LocationPage` (`examined`), `InterrogationPage` (`asked`).
There is **no** "new game", reset, save slot or multiple-playthrough feature anywhere in the code.

**Persistence mechanisms in the frontend** (localStorage only; no sessionStorage/IndexedDB):
`last-lap:token` (session token), `last-lap:progress:<userId>` (progress), and - mock only - `last-lap:mock-users`, `last-lap:mock-tokens`.

**Auth contract the frontend expects** (`src/api/types.ts`, `README.md`): `POST /auth/register`, `POST /auth/login`
with `{nickname, password}` -> `{token, user:{id: string, nickname, createdAt}}`; `GET /auth/me`; `POST /auth/logout`;
`Authorization: Bearer <token>`; errors `{message}`. Nickname `^[A-Za-z0-9_]{3,16}$`, case-insensitively unique (mock);
password min 8. "Registration without e-mail or phone, nickname and password only" (case rules).

**Existing backend** (`last_lap/backend/app`): FastAPI + `sqlite3`, no ORM, no migrations (`CREATE TABLE IF NOT EXISTS` at startup).
- `users(id INTEGER PK AUTOINCREMENT, username UNIQUE, password_hash, created_at)`
- `saves(id, user_id UNIQUE -> users ON DELETE CASCADE, case_id DEFAULT 'case-001', progress_json DEFAULT '{}', updated_at)`
- Routes: `POST /api/auth/{register,login,logout}`, `GET /api/auth/me`, `GET|PUT /api/saves/current`, `GET /api/game/case-001`, `GET /api/health`.
- Auth: cookie `session_token` (httponly, samesite=lax); sessions in an **in-memory dict** (lost on restart - the README says so).
- Passwords: PBKDF2-HMAC-SHA256, 310 000 iterations, 16-byte salt, stored as `<salt hex>$<digest hex>`.
- Validation: username `^[A-Za-z0-9_]+$` 3-32; password 8-128; `progress` is any JSON object.
- Behaviour: register also inserts an empty save; `GET /saves/current` with no row returns `{case_id:'case-001', progress:{}, updated_at:null}`; `PUT` upserts one row per user.

## 3. Discrepancies that matter for integration

| Topic | Frontend (authoritative) | Existing backend |
|---|---|---|
| Login name | `nickname`, 3-16 | `username`, 3-32 |
| User id | string (UUID in mock) | integer |
| Session | Bearer token in header, `{token,user}` response | cookie, `{id,username}` response |
| URL prefix | `/auth/...` (+ `VITE_API_URL`) | `/api/auth/...` |
| Story ids | `crash-site`/`garage`/`vip-box`; `pilot`/`mechanic`/`sponsor` | `case-001.json`: locations `garage`/`team_room`/`grandstand`, suspects `second_driver`/`chief_mechanic`/`sponsor`, other evidence ids |
| Progress | `{introSeen, examined, asked}` | opaque dict, default `{}` |
| Saves API | **none yet** - progress is still local | `GET/PUT /api/saves/current` |

`backend/story/case-001.json` is therefore an **earlier draft** of the story and was *not* modelled.

## 4. Entities chosen for PostgreSQL

| Entity | Table | Why |
|---|---|---|
| Account | `users` | Persistent accounts are required by the auth contract |
| Case registry | `game_cases` | Stable identifier for FK/versioning; one row (`case-001`). No story content stored (it is bundled in the frontend) |
| Progress | `game_saves` | One row per (user, case); progress as JSONB |
| Server session | `sessions` | Frontend restores the session from a stored token on every reload; the existing backend itself flags in-memory sessions as unsuitable |
| Migration bookkeeping | `schema_migrations` | Created by `scripts/migrate.sh` |

**Deliberately not created:** achievements, events, statistics, inventory, settings, save slots - nothing in the source needs them.

## 5. Confirmed vs. assumed

| Confirmed by code | Assumption (documented, easy to change) |
|---|---|
| Progress keys/types, default, merge semantics | Session lifetime (suggested 30 days); not in source |
| Nickname + password only, no e-mail | DB accepts nickname 3-32 (superset of both existing limits) |
| Case-insensitive nickname uniqueness (frontend mock) | `users.id` is a UUID (frontend treats ids as opaque strings) |
| One save per user, one case | `game_saves` allows several cases per user (unique on `(user, case)`) so a second case needs no migration |
| Case id `case-001`, title "Последний круг" | Token stored as SHA-256 hex; token format itself is the backend's choice |
| Existing hash format `salt$digest` (PBKDF2) | New hashes may use another algorithm (Argon2id recommended); DB treats the hash as opaque |

## 6. Decisions to remember when integrating
1. Which API contract wins (frontend's `/auth/*` Bearer, or the legacy backend's cookies) is **your** call; the schema supports either.
2. The frontend has no save-sync code yet; a saves endpoint and a frontend change are needed (see `INTEGRATION_GUIDE.md`).
3. Nothing from SQLite can be imported (no DB file provided). A legacy-import sketch is in the guide.
