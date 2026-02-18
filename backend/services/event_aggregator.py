"""Event aggregator: merge events from all data sources into the database.

This service is called by scheduled tasks to:
1. Fetch events from all sources (earnings, EDGAR, macro)
2. Upsert them into the events table (avoid duplicates)
3. Optionally trigger AI summary generation for new events
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any, Dict, List

from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession

from ..models.event import Event
from ..models.portfolio import PortfolioItem

logger = logging.getLogger(__name__)


async def get_all_tracked_tickers(db: AsyncSession) -> List[str]:
    """Get unique tickers across all users' portfolios."""
    result = await db.execute(
        select(PortfolioItem.ticker).distinct()
    )
    return [row[0] for row in result.all()]


async def upsert_events(
    db: AsyncSession,
    event_dicts: List[Dict[str, Any]],
) -> int:
    """Upsert events into the database.

    Deduplication key: (ticker, event_type, event_date, title).
    Returns number of new events inserted.
    """
    inserted = 0

    for ed in event_dicts:
        ticker = ed.get("ticker")
        event_type = ed.get("event_type", "")
        event_date = ed.get("event_date")
        title = ed.get("title", "")

        if event_date is None:
            continue

        # Ensure timezone-aware
        if isinstance(event_date, datetime) and event_date.tzinfo is None:
            event_date = event_date.replace(tzinfo=timezone.utc)

        # Check for existing event
        conditions = [
            Event.event_type == event_type,
            Event.title == title,
        ]
        if ticker:
            conditions.append(Event.ticker == ticker)
        else:
            conditions.append(Event.ticker.is_(None))

        # Date match with some tolerance (same day)
        if isinstance(event_date, datetime):
            if event_date.tzinfo is None:
                event_date = event_date.replace(tzinfo=timezone.utc)
            day_start = event_date.replace(hour=0, minute=0, second=0, microsecond=0)
            day_end = day_start.replace(hour=23, minute=59, second=59)
            conditions.append(Event.event_date >= day_start)
            conditions.append(Event.event_date <= day_end)

        existing = await db.execute(select(Event).where(and_(*conditions)).limit(1))
        row = existing.scalar_one_or_none()

        if row:
            # Update mutable fields if event already exists
            _update_existing_event(row, ed)
        else:
            # Insert new event
            event = Event(
                ticker=ticker,
                event_type=event_type,
                event_date=event_date,
                title=title,
                description=ed.get("description"),
                importance=ed.get("importance", "medium"),
                status=ed.get("status", "upcoming"),
                eps_estimate=ed.get("eps_estimate"),
                eps_actual=ed.get("eps_actual"),
                revenue_estimate=ed.get("revenue_estimate"),
                revenue_actual=ed.get("revenue_actual"),
                report_time=ed.get("report_time"),
                macro_event_name=ed.get("macro_event_name"),
                consensus=ed.get("consensus"),
                actual_value=ed.get("actual_value"),
                previous_value=ed.get("previous_value"),
                filing_type=ed.get("filing_type"),
                filing_url=ed.get("filing_url"),
                source=ed.get("source"),
                raw_data=ed.get("raw_data"),
            )
            db.add(event)
            inserted += 1

    await db.commit()
    logger.info(f"Upserted events: {inserted} new, {len(event_dicts) - inserted} updated/skipped")
    return inserted


def _update_existing_event(event: Event, ed: Dict[str, Any]) -> None:
    """Update mutable fields on an existing event (e.g. actual EPS after earnings)."""
    if ed.get("eps_actual") is not None and event.eps_actual is None:
        event.eps_actual = ed["eps_actual"]
    if ed.get("revenue_actual") is not None and event.revenue_actual is None:
        event.revenue_actual = ed["revenue_actual"]
    if ed.get("actual_value") is not None and event.actual_value is None:
        event.actual_value = ed["actual_value"]
    if ed.get("status") == "completed" and event.status != "completed":
        event.status = "completed"
    if ed.get("description") and not event.description:
        event.description = ed["description"]
    event.updated_at = datetime.now(timezone.utc)
