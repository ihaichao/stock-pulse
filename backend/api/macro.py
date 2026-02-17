"""Macro economic calendar API."""

from __future__ import annotations

import json
from datetime import datetime, timezone, timedelta
from typing import List

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession

from ..db.database import get_db
from ..db.redis import redis_client
from ..models.event import Event
from ..api.events import EventResponse, _event_to_response

router = APIRouter(prefix="/api/macro", tags=["macro"])

CACHE_TTL = 6 * 60 * 60  # 6 hours


@router.get("/calendar", response_model=List[EventResponse])
async def get_macro_calendar(
    month: str = Query(
        default=None,
        description="Month in YYYY-MM format, defaults to current month",
    ),
    db: AsyncSession = Depends(get_db),
):
    """Get macro economic events for a given month."""
    # Parse month
    if month:
        try:
            year, mon = month.split("-")
            start = datetime(int(year), int(mon), 1, tzinfo=timezone.utc)
        except (ValueError, IndexError):
            start = datetime.now(timezone.utc).replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    else:
        start = datetime.now(timezone.utc).replace(day=1, hour=0, minute=0, second=0, microsecond=0)

    # End of month
    if start.month == 12:
        end = start.replace(year=start.year + 1, month=1)
    else:
        end = start.replace(month=start.month + 1)

    cache_key = f"macro:calendar:{start.strftime('%Y-%m')}"
    cached = await redis_client.get(cache_key)
    if cached:
        return json.loads(cached)

    result = await db.execute(
        select(Event)
        .where(
            and_(
                Event.event_type == "macro",
                Event.event_date >= start,
                Event.event_date < end,
            )
        )
        .order_by(Event.event_date.asc())
    )
    events = result.scalars().all()
    response = [_event_to_response(e) for e in events]

    await redis_client.setex(cache_key, CACHE_TTL, json.dumps(response, default=str))
    return response
