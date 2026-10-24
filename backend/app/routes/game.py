import json
from pathlib import Path
from fastapi import APIRouter

router = APIRouter()
STORY_PATH = Path(__file__).resolve().parents[2] / "story" / "case-001.json"

@router.get("/case-001")
def get_case():
    with open(STORY_PATH, encoding="utf-8") as f:
        return json.load(f)
