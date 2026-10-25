import os
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.db import pool
from app.routes import accounts, connections, deduction, game, progress


@asynccontextmanager
async def lifespan(_: FastAPI):
    pool.open(wait=True, timeout=30)
    yield
    pool.close()


app = FastAPI(title="Последний круг API", version="1.0.0", lifespan=lifespan)

origins = os.environ.get(
    "CORS_ORIGINS",
    "http://localhost:5173,http://127.0.0.1:5173,http://localhost:5174,http://localhost:4173",
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[origin.strip() for origin in origins.split(",") if origin.strip()],
    allow_methods=["GET", "POST", "PUT", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "Accept"],
)


@app.exception_handler(StarletteHTTPException)
async def http_error(_: Request, error: StarletteHTTPException):
    message = error.detail if isinstance(error.detail, str) else "Что-то пошло не так. Попробуйте ещё раз."
    return JSONResponse(status_code=error.status_code, content={"message": message}, headers=getattr(error, "headers", None))


@app.exception_handler(RequestValidationError)
async def validation_error(_: Request, __: RequestValidationError):
    return JSONResponse(status_code=400, content={"message": "Проверьте введённые данные"})


app.include_router(accounts.router, prefix="/auth", tags=["auth"])
app.include_router(progress.router, prefix="/progress", tags=["progress"])
app.include_router(game.router, prefix="/api/game", tags=["game"])
app.include_router(connections.router, prefix="/api/game/case-001/connections", tags=["connections"])
app.include_router(deduction.router, prefix="/api/game/case-001/deductions", tags=["deductions"])


@app.get("/health")
def health():
    try:
        with pool.connection() as conn:
            conn.execute("SELECT 1 FROM game_cases LIMIT 1")
    except Exception:
        raise HTTPException(status_code=503, detail="База данных недоступна") from None
    return {"status": "ok"}
