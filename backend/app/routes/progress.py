import re

from fastapi import APIRouter, Depends, HTTPException
from psycopg.types.json import Jsonb
from pydantic import BaseModel, Field

from app.db import pool
from app.session import current_user

router = APIRouter()

CASE = "case-001"
DEFAULT = {"introSeen": False, "examined": [], "asked": []}
ITEM = re.compile(r"^[a-z0-9][a-z0-9:_-]{0,63}$")


class ProgressPatch(BaseModel):
    introSeen: bool | None = None
    examined: list[str] | None = Field(default=None, max_length=200)
    asked: list[str] | None = Field(default=None, max_length=200)


def shaped(progress: dict | None) -> dict:
    merged = {**DEFAULT, **(progress or {})}
    return {key: merged[key] for key in DEFAULT}


@router.get("")
def load(user: dict = Depends(current_user)):
    with pool.connection() as conn:
        row = conn.execute(
            "SELECT s.progress FROM game_saves s JOIN game_cases c ON c.id = s.game_case_id WHERE s.user_id = %s AND c.slug = %s",
            (user["id"], CASE),
        ).fetchone()
    return shaped(row["progress"] if row else None)


@router.put("")
def save(patch: ProgressPatch, user: dict = Depends(current_user)):
    data = patch.model_dump(exclude_none=True)
    for key in ("examined", "asked"):
        if key in data:
            if any(not ITEM.match(item) for item in data[key]):
                raise HTTPException(status_code=400, detail="Неизвестные данные в прогрессе")
            data[key] = list(dict.fromkeys(data[key]))
    if not data:
        return load(user)
    with pool.connection() as conn:
        row = conn.execute(
            "SELECT progress FROM save_game_progress(%s, %s, %s)",
            (user["id"], CASE, Jsonb(data)),
        ).fetchone()
    return shaped(row["progress"] if row else None)
