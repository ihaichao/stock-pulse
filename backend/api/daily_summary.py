"""Daily summary API: "What you need to know today"."""

from __future__ import annotations

import json
from datetime import datetime, timezone, timedelta
from typing import List, Optional

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import select, and_, or_
from sqlalchemy.ext.asyncio import AsyncSession

from ..db.database import get_db
from ..db.redis import redis_client
from ..models.event import Event
from ..models.user import User
from ..api.portfolio import get_or_create_user
from ..api.events import _get_user_tickers, _event_to_response

router = APIRouter(prefix="/api/daily-summary", tags=["daily-summary"])

CACHE_TTL = 60 * 60  # 1 hour


class DailySummaryResponse(BaseModel):
    date: str
    total_events: int
    high_importance: int
    events: list
    macro_events: list
    portfolio_events: list


@router.get("", response_model=DailySummaryResponse)
async def get_daily_summary(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_or_create_user),
):
    """Get today's summary: portfolio-related events + macro events, sorted by importance."""
    cache_key = f"daily_summary:{user.id}"
    cached = await redis_client.get(cache_key)
    if cached:
        return json.loads(cached)

    tickers = await _get_user_tickers(db, user)

    now = datetime.now(timezone.utc)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    today_end = today_start + timedelta(days=1)

    # Fetch today's events relevant to user
    conditions = [
        Event.event_date >= today_start,
        Event.event_date < today_end,
    ]

    result = await db.execute(
        select(Event)
        .where(and_(*conditions))
        .order_by(Event.importance.desc(), Event.event_date.asc())
    )
    all_events = result.scalars().all()

    # Split into macro vs portfolio events
    macro_events = []
    portfolio_events = []
    other_events = []

    for e in all_events:
        resp = _event_to_response(e)
        if e.ticker is None:
            macro_events.append(resp)
        elif e.ticker in tickers:
            portfolio_events.append(resp)
        else:
            other_events.append(resp)

    # Combine: portfolio first, then macro
    combined = portfolio_events + macro_events

    high_count = sum(
        1 for e in combined if e.get("importance") == "high"
    )

    response = DailySummaryResponse(
        date=today_start.strftime("%Y-%m-%d"),
        total_events=len(combined),
        high_importance=high_count,
        events=combined,
        macro_events=macro_events,
        portfolio_events=portfolio_events,
    )

    response_dict = response.model_dump()
    await redis_client.setex(cache_key, CACHE_TTL, json.dumps(response_dict, default=str))
    return response
