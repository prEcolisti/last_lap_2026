from fastapi import Header, HTTPException

from app.db import pool
from app.security import token_hash

EXPIRED = "Сессия истекла. Войдите снова."


def bearer(authorization: str | None) -> str:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail=EXPIRED)
    return authorization.removeprefix("Bearer ").strip()


def current_user(authorization: str | None = Header(default=None)) -> dict:
    token = bearer(authorization)
    with pool.connection() as conn:
        user = conn.execute(
            """
            SELECT u.id, u.nickname, u.created_at
            FROM sessions s JOIN users u ON u.id = s.user_id
            WHERE s.token_hash = %s AND s.revoked_at IS NULL AND s.expires_at > now() AND u.is_active
            """,
            (token_hash(token),),
        ).fetchone()
    if not user:
        raise HTTPException(status_code=401, detail=EXPIRED)
    return user
