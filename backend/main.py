"""FastAPI application entry point for Stock Pulse."""

from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import settings
from .db.database import init_db
from .api.portfolio import router as portfolio_router
from .tasks.scheduler import setup_scheduler, scheduler


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup/shutdown lifecycle."""
    # On startup
    if settings.app_env == "development":
        await init_db()

    setup_scheduler()
    yield

    # Shutdown
    scheduler.shutdown(wait=False)


app = FastAPI(
    title="Stock Pulse API",
    version="0.1.0",
    lifespan=lifespan,
)

# CORS (allow frontend dev server)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Tighten in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# --- Routes ---

app.include_router(portfolio_router)


@app.get("/api/health")
async def health():
    return {"status": "ok"}
