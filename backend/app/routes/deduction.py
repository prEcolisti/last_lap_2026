
from fastapi import APIRouter
from pydantic import BaseModel, Field

router = APIRouter()

class DeductionRequest(BaseModel):
    suspect: str
    evidence: list[str] = Field(min_length=1)

@router.post("/check")
def check_deduction(payload: DeductionRequest):
    selected_evidence = set(payload.evidence)

    known_suspects = {
        "second_driver",
        "chief_mechanic",
        "sponsor",
    }

    known_evidence = {
        "car_damage",
        "pit_log",
        "radio_log",
        "race_schedule",
        "empty_seat_photo",
        "flash_photo",
    }

    if payload.suspect not in known_suspects:
        return {
            "valid": False,
            "message": "Неизвестный подозреваемый.",
        }

    unknown = selected_evidence - known_evidence

    if unknown:
        return {
            "valid": False,
            "message": "В выборе есть неизвестные улики.",
            "unknown_evidence": sorted(unknown),
        }

    if len(selected_evidence) < 2:
        return {
            "valid": False,
            "message": "Для вывода нужно сопоставить хотя бы две улики.",
        }

    return {
        "valid": True,
        "suspect": payload.suspect,
        "evidence": sorted(selected_evidence),
        "conclusion": (
            "Улики приняты. Проверьте, подтверждают ли они "
            "вашу версию и исключают ли альтернативные объяснения."
        ),
        "confirmed_guilt": False,
    }
