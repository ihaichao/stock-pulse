"""FastAPI application entry point for Stock Pulse."""

from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import settings
from .db.database import init_db
from .api.portfolio import router as portfolio_router
from .api.events import router as events_router
from .api.daily_summary import router as daily_summary_router
from .api.macro import router as macro_router
from .tasks.scheduler import setup_scheduler, scheduler


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup/shutdown lifecycle."""
    if settings.app_env == "development":
        await init_db()

    setup_scheduler()
    yield

    scheduler.shutdown(wait=False)


app = FastAPI(
    title="Stock Pulse API",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Routes ---
app.include_router(portfolio_router)
app.include_router(events_router)
app.include_router(daily_summary_router)
app.include_router(macro_router)


@app.get("/api/health")
async def health():
    return {"status": "ok"}
