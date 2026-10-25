from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

router = APIRouter()

CONNECTIONS = [
    {
        "id": "damage_and_pit_log",
        "evidence": ["car_damage", "pit_log"],
        "description": "Сопоставьте повреждение машины со временем осмотра в боксах.",
        "question": "Могло ли повреждение возникнуть или измениться во время пит-стопа?",
        "hint": (
            "Сравните характер повреждения и время работ. "
            "Совпадение по времени само по себе не доказывает вину механика."
        ),
    },
    {
        "id": "radio_and_schedule",
        "evidence": ["radio_log", "race_schedule"],
        "description": "Сопоставьте попытки связаться с пилотом с расписанием гонки.",
        "question": "В какой момент связь с пилотом была потеряна?",
        "hint": (
            "Используйте расписание, чтобы восстановить последовательность событий. "
            "Отсутствие ответа само по себе не устанавливает причину аварии."
        ),
    },
    {
        "id": "empty_seat_and_flash",
        "evidence": ["empty_seat_photo", "flash_photo"],
        "description": "Сравните две фотографии с трибуны.",
        "question": "Подтверждают ли фотографии, где находился спонсор?",
        "hint": (
            "Фотографии дают неполные сведения о местонахождении спонсора. "
            "Пустое место не доказывает, куда он ушёл и что делал."
        ),
    },
]


class ConnectionCheck(BaseModel):
    evidence: list[str] = Field(min_length=2, max_length=2)


@router.get("")
def get_connections():
    return {"connections": CONNECTIONS}


@router.get("/{connection_id}")
def get_connection(connection_id: str):
    for connection in CONNECTIONS:
        if connection["id"] == connection_id:
            return connection

    raise HTTPException(
        status_code=404,
        detail="Связь между уликами не найдена.",
    )


@router.post("/check")
def check_connection(payload: ConnectionCheck):
    selected = set(payload.evidence)

    for connection in CONNECTIONS:
        if selected == set(connection["evidence"]):
            return {
                "correct_pair": True,
                "connection_id": connection["id"],
                "description": connection["description"],
                "question": connection["question"],
                "hint": connection["hint"],
            }

    return {
        "correct_pair": False,
        "message": (
            "Эта пара не соответствует одной из заданных связей. "
            "Попробуйте сопоставить улики по времени и содержанию."
        ),
    }
