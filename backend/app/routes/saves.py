import json
from fastapi import APIRouter, Cookie
from app.database import get_connection
from app.routes.users import require_user
from app.schemas import ProgressPayload

router = APIRouter()

@router.get("/current")
def get_current_save(session_token: str | None = Cookie(default=None)):
    user_id = require_user(session_token)
    with get_connection() as conn:
        row = conn.execute("SELECT case_id, progress_json, updated_at FROM saves WHERE user_id = ?", (user_id,)).fetchone()
    if not row:
        return {"case_id": "case-001", "progress": {}, "updated_at": None}
    return {"case_id": row["case_id"], "progress": json.loads(row["progress_json"]), "updated_at": row["updated_at"]}

@router.put("/current")
def put_current_save(payload: ProgressPayload, session_token: str | None = Cookie(default=None)):
    user_id = require_user(session_token)
    progress_json = json.dumps(payload.progress, ensure_ascii=False)
    with get_connection() as conn:
        conn.execute(
            "INSERT INTO saves(user_id, case_id, progress_json, updated_at) VALUES (?, 'case-001', ?, CURRENT_TIMESTAMP) "
            "ON CONFLICT(user_id) DO UPDATE SET progress_json=excluded.progress_json, updated_at=CURRENT_TIMESTAMP",
            (user_id, progress_json)
        )
    return {"ok": True}
