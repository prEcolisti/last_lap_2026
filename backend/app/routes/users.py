from fastapi import APIRouter, HTTPException, Response, Cookie
from pydantic import BaseModel, Field
from app.database import get_connection
from app.auth import hash_password, verify_password, issue_token

router = APIRouter()
# Starter demo: in-memory sessions reset when the server restarts.
# For deployment, use a persistent session store and HTTPS.
SESSIONS: dict[str, int] = {}

class AuthRequest(BaseModel):
    username: str = Field(min_length=3, max_length=32, pattern=r"^[A-Za-z0-9_]+$")
    password: str = Field(min_length=8, max_length=128)

@router.post("/register")
def register(data: AuthRequest, response: Response):
    with get_connection() as conn:
        exists = conn.execute("SELECT id FROM users WHERE username = ?", (data.username,)).fetchone()
        if exists:
            raise HTTPException(status_code=409, detail="Это имя пользователя уже занято")
        cur = conn.execute(
            "INSERT INTO users(username, password_hash) VALUES (?, ?)",
            (data.username, hash_password(data.password))
        )
        user_id = cur.lastrowid
        conn.execute("INSERT INTO saves(user_id, progress_json) VALUES (?, '{}')", (user_id,))
    token = issue_token()
    SESSIONS[token] = user_id
    response.set_cookie("session_token", token, httponly=True, samesite="lax")
    return {"id": user_id, "username": data.username}

@router.post("/login")
def login(data: AuthRequest, response: Response):
    with get_connection() as conn:
        user = conn.execute("SELECT * FROM users WHERE username = ?", (data.username,)).fetchone()
    if not user or not verify_password(data.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Неверный логин или пароль")
    token = issue_token()
    SESSIONS[token] = user["id"]
    response.set_cookie("session_token", token, httponly=True, samesite="lax")
    return {"id": user["id"], "username": user["username"]}

@router.post("/logout")
def logout(response: Response, session_token: str | None = Cookie(default=None)):
    if session_token:
        SESSIONS.pop(session_token, None)
    response.delete_cookie("session_token")
    return {"ok": True}

@router.get("/me")
def me(session_token: str | None = Cookie(default=None)):
    user_id = SESSIONS.get(session_token or "")
    if not user_id:
        raise HTTPException(status_code=401, detail="Нужно войти в аккаунт")
    with get_connection() as conn:
        user = conn.execute("SELECT id, username FROM users WHERE id = ?", (user_id,)).fetchone()
    if not user:
        raise HTTPException(status_code=401, detail="Пользователь не найден")
    return dict(user)

def require_user(session_token: str | None) -> int:
    user_id = SESSIONS.get(session_token or "")
    if not user_id:
        raise HTTPException(status_code=401, detail="Нужно войти в аккаунт")
    return user_id
