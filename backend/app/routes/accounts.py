import re

from fastapi import APIRouter, Depends, Header, HTTPException, Response
from psycopg.errors import UniqueViolation
from pydantic import BaseModel

from app.db import pool
from app.security import hash_password, new_token, token_hash, verify_password
from app.session import bearer, current_user

router = APIRouter()

NICKNAME = re.compile(r"^[A-Za-z0-9_]{3,16}$")
PASSWORD_MIN = 8
PASSWORD_MAX = 128
SESSION_DAYS = 30


class Credentials(BaseModel):
    nickname: str
    password: str


def public(user: dict) -> dict:
    return {"id": str(user["id"]), "nickname": user["nickname"], "createdAt": user["created_at"].isoformat()}


def start_session(conn, user_id) -> str:
    token = new_token()
    conn.execute(
        "INSERT INTO sessions (user_id, token_hash, expires_at) VALUES (%s, %s, now() + make_interval(days => %s))",
        (user_id, token_hash(token), SESSION_DAYS),
    )
    return token


@router.post("/register", status_code=201)
def register(data: Credentials):
    nickname = data.nickname.strip()
    if not NICKNAME.match(nickname):
        raise HTTPException(status_code=400, detail="Никнейм: 3–16 символов, латиница, цифры, «_»")
    if len(data.password) < PASSWORD_MIN or len(data.password) > PASSWORD_MAX:
        raise HTTPException(status_code=400, detail=f"Пароль: от {PASSWORD_MIN} до {PASSWORD_MAX} символов")
    if not data.password.strip():
        raise HTTPException(status_code=400, detail="Пароль не может состоять из одних пробелов")
    with pool.connection() as conn:
        try:
            user = conn.execute(
                "INSERT INTO users (nickname, password_hash) VALUES (%s, %s) RETURNING id, nickname, created_at",
                (nickname, hash_password(data.password)),
            ).fetchone()
        except UniqueViolation:
            raise HTTPException(status_code=409, detail="Этот никнейм уже занят") from None
        token = start_session(conn, user["id"])
    return {"token": token, "user": public(user)}


@router.post("/login")
def login(data: Credentials):
    with pool.connection() as conn:
        user = conn.execute(
            "SELECT id, nickname, password_hash, is_active, created_at FROM users WHERE lower(nickname) = lower(%s)",
            (data.nickname.strip(),),
        ).fetchone()
        if not user or not user["is_active"] or not verify_password(data.password, user["password_hash"]):
            raise HTTPException(status_code=401, detail="Неверный никнейм или пароль")
        token = start_session(conn, user["id"])
    return {"token": token, "user": public(user)}


@router.get("/me")
def me(user: dict = Depends(current_user)):
    return public(user)


@router.post("/logout", status_code=204)
def logout(authorization: str | None = Header(default=None)):
    token = bearer(authorization)
    with pool.connection() as conn:
        conn.execute(
            "UPDATE sessions SET revoked_at = now() WHERE token_hash = %s AND revoked_at IS NULL",
            (token_hash(token),),
        )
    return Response(status_code=204)
