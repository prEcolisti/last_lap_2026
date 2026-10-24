
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from app.database import init_db
from app.routes import users, saves, game, connections, deductions


app = FastAPI(
    title="Последний круг API",
    version="0.1.0",
)

# Разрешаем запросы от локального frontend.
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://127.0.0.1:5500",
        "http://localhost:5500",
        "http://127.0.0.1:5173",
        "http://localhost:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def startup():
    init_db()


# API-маршруты
app.include_router(users.router, prefix="/api/auth", tags=["auth"])
app.include_router(saves.router, prefix="/api/saves", tags=["saves"])
app.include_router(game.router, prefix="/api/game", tags=["game"])
app.include_router(
    connections.router,
    prefix="/api/game/case-001/connections",
    tags=["connections"],
)
app.include_router(
    deductions.router,
    prefix="/api/game/case-001/deductions",
    tags=["deductions"],
)

@app.get("/api/health")
def health():
    return {"status": "ok"}


# Пути к старому frontend в папке C:\last_lap\frontend
PROJECT_DIR = Path(__file__).resolve().parents[2]
FRONTEND_DIR = PROJECT_DIR / "frontend"

# Статические файлы старого frontend
css_dir = FRONTEND_DIR / "css"
js_dir = FRONTEND_DIR / "js"

if css_dir.is_dir():
    app.mount(
        "/css",
        StaticFiles(directory=css_dir),
        name="css",
    )

if js_dir.is_dir():
    app.mount(
        "/js",
        StaticFiles(directory=js_dir),
        name="js",
    )


@app.get("/", include_in_schema=False)
def home():
    return FileResponse(FRONTEND_DIR / "index.html")


@app.get("/game.html", include_in_schema=False)
def game_page():
    return FileResponse(FRONTEND_DIR / "game.html")
