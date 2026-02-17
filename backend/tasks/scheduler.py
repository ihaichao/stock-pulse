"""Scheduled tasks for data fetching and AI summary generation.

Uses APScheduler to run periodic jobs:
- Fetch earnings data (2x daily)
- Fetch EDGAR filings (2x daily)
- Fetch macro calendar (1x daily)
- Generate AI summaries (1x daily, before market open)
"""

from __future__ import annotations

import logging

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger

logger = logging.getLogger(__name__)

scheduler = AsyncIOScheduler()


def setup_scheduler() -> None:
    """Configure and start all scheduled tasks."""

    # Fetch earnings data: UTC 06:00 and 18:00
    scheduler.add_job(
        run_fetch_earnings,
        CronTrigger(hour="6,18", minute=0),
        id="fetch_earnings",
        name="Fetch earnings data",
        replace_existing=True,
    )

    # Fetch EDGAR filings: UTC 07:00 and 19:00
    scheduler.add_job(
        run_fetch_edgar,
        CronTrigger(hour="7,19", minute=0),
        id="fetch_edgar",
        name="Fetch SEC EDGAR filings",
        replace_existing=True,
    )

    # Fetch macro calendar: UTC 06:00
    scheduler.add_job(
        run_fetch_macro,
        CronTrigger(hour=6, minute=30),
        id="fetch_macro",
        name="Fetch macro economic calendar",
        replace_existing=True,
    )

    # Generate AI summaries: UTC 12:00 (before US market open)
    scheduler.add_job(
        run_generate_summaries,
        CronTrigger(hour=12, minute=0),
        id="generate_summaries",
        name="Generate AI event summaries",
        replace_existing=True,
    )

    scheduler.start()
    logger.info("Scheduler started with %d jobs", len(scheduler.get_jobs()))


async def run_fetch_earnings() -> None:
    """Fetch earnings for all tracked tickers and upsert into DB."""
    from ..db.database import async_session
    from ..services.earnings import fetch_earnings_batch
    from ..services.event_aggregator import get_all_tracked_tickers, upsert_events

    logger.info("Starting earnings fetch job")
    async with async_session() as db:
        tickers = await get_all_tracked_tickers(db)
        if not tickers:
            logger.info("No tracked tickers, skipping earnings fetch")
            return
        events = fetch_earnings_batch(tickers)
        count = await upsert_events(db, events)
        logger.info(f"Earnings fetch done: {count} new events from {len(tickers)} tickers")


async def run_fetch_edgar() -> None:
    """Fetch EDGAR filings for all tracked tickers."""
    from ..db.database import async_session
    from ..services.edgar import fetch_edgar_batch
    from ..services.event_aggregator import get_all_tracked_tickers, upsert_events

    logger.info("Starting EDGAR fetch job")
    async with async_session() as db:
        tickers = await get_all_tracked_tickers(db)
        if not tickers:
            logger.info("No tracked tickers, skipping EDGAR fetch")
            return
        events = await fetch_edgar_batch(tickers)
        count = await upsert_events(db, events)
        logger.info(f"EDGAR fetch done: {count} new events from {len(tickers)} tickers")


async def run_fetch_macro() -> None:
    """Fetch macro economic calendar."""
    from ..db.database import async_session
    from ..services.macro_calendar import fetch_macro_events
    from ..services.event_aggregator import upsert_events

    logger.info("Starting macro calendar fetch job")
    async with async_session() as db:
        events = await fetch_macro_events()
        count = await upsert_events(db, events)
        logger.info(f"Macro fetch done: {count} new events")


async def run_generate_summaries() -> None:
    """Generate AI summaries for upcoming events that don't have one yet."""
    from ..db.database import async_session
    from ..services.ai_explain import generate_event_summary
    from ..models.event import Event
    from sqlalchemy import select, and_
    from datetime import datetime, timezone, timedelta

    logger.info("Starting AI summary generation job")
    async with async_session() as db:
        # Find upcoming events in next 7 days without AI summary
        now = datetime.now(timezone.utc)
        week_later = now + timedelta(days=7)

        result = await db.execute(
            select(Event).where(
                and_(
                    Event.event_date >= now,
                    Event.event_date <= week_later,
                    Event.ai_summary.is_(None),
                )
            )
        )
        events = result.scalars().all()

        generated = 0
        for event in events:
            event_data = {
                "ticker": event.ticker,
                "event_type": event.event_type,
                "title": event.title,
                "description": event.description,
                "importance": event.importance,
                "eps_estimate": float(event.eps_estimate) if event.eps_estimate else None,
                "eps_actual": float(event.eps_actual) if event.eps_actual else None,
                "macro_event_name": event.macro_event_name,
                "consensus": event.consensus,
                "previous_value": event.previous_value,
            }
            summary = await generate_event_summary(event_data)
            if summary:
                event.ai_summary = summary
                generated += 1

        await db.commit()
        logger.info(f"AI summary generation done: {generated}/{len(events)} events")
