from __future__ import annotations

import asyncio
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import settings
from .db.database import init_db
from .api.portfolio import router as portfolio_router
from .api.events import router as events_router
from .api.daily_summary import router as daily_summary_router
from .api.macro import router as macro_router
from .api.stock import router as stock_router
from .tasks.scheduler import (
    setup_scheduler, scheduler,
    run_fetch_earnings, run_fetch_edgar, run_fetch_macro, run_fetch_analyst,
    run_fetch_congress, run_fetch_unusual_options,
)

logger = logging.getLogger(__name__)


async def _initial_data_sync():
    """Run all data fetchers once on startup (background, non-blocking)."""
    try:
        logger.info("Starting initial data sync...")
        await run_fetch_macro()
        await run_fetch_earnings()
        await run_fetch_edgar()
        await run_fetch_analyst()
        await run_fetch_congress()
        await run_fetch_unusual_options()
        logger.info("Initial data sync complete")
    except Exception as e:
        logger.error(f"Initial data sync failed: {e}")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup/shutdown lifecycle."""
    if settings.app_env == "development":
        await init_db()

    setup_scheduler()

    # Fire-and-forget initial data fetch
    asyncio.create_task(_initial_data_sync())

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
app.include_router(stock_router)


@app.get("/api/health")
async def health():
    return {"status": "ok"}
