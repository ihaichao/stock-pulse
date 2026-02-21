"""Event query API routes."""

from __future__ import annotations

import json
import uuid
from datetime import datetime, timezone, timedelta
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Header, Query
from pydantic import BaseModel
from sqlalchemy import select, and_, or_
from sqlalchemy.ext.asyncio import AsyncSession

from ..db.database import get_db
from ..db.redis import redis_client
from ..models.event import Event
from ..models.portfolio import PortfolioItem
from ..models.user import User
from ..api.portfolio import get_or_create_user
from ..services.ai_explain import generate_event_detail

router = APIRouter(prefix="/api/events", tags=["events"])

CACHE_TTL_UPCOMING = 30 * 60   # 30 min
CACHE_TTL_TODAY = 15 * 60      # 15 min
CACHE_TTL_STOCK = 60 * 60      # 1 hour


# --- Response schemas ---

class EventResponse(BaseModel):
    id: str
    ticker: Optional[str]
    event_type: str
    event_date: str
    title: str
    description: Optional[str] = None
    importance: str
    status: str
    eps_estimate: Optional[float] = None
    eps_actual: Optional[float] = None
    revenue_estimate: Optional[int] = None
    revenue_actual: Optional[int] = None
    report_time: Optional[str] = None
    macro_event_name: Optional[str] = None
    consensus: Optional[str] = None
    actual_value: Optional[str] = None
    previous_value: Optional[str] = None
    filing_type: Optional[str] = None
    filing_url: Optional[str] = None
    analyst_firm: Optional[str] = None
    from_rating: Optional[str] = None
    to_rating: Optional[str] = None
    target_price: Optional[float] = None
    ai_summary: Optional[str] = None

    class Config:
        from_attributes = True


class EventDetailResponse(EventResponse):
    ai_detail: Optional[str] = None


def _event_to_response(e: Event) -> dict:
    return {
        "id": str(e.id),
        "ticker": e.ticker,
        "event_type": e.event_type,
        "event_date": e.event_date.isoformat(),
        "title": e.title,
        "description": e.description,
        "importance": e.importance,
        "status": e.status,
        "eps_estimate": float(e.eps_estimate) if e.eps_estimate is not None else None,
        "eps_actual": float(e.eps_actual) if e.eps_actual is not None else None,
        "revenue_estimate": e.revenue_estimate,
        "revenue_actual": e.revenue_actual,
        "report_time": e.report_time,
        "macro_event_name": e.macro_event_name,
        "consensus": e.consensus,
        "actual_value": e.actual_value,
        "previous_value": e.previous_value,
        "filing_type": e.filing_type,
        "filing_url": e.filing_url,
        "analyst_firm": getattr(e, "analyst_firm", None),
        "from_rating": getattr(e, "from_rating", None),
        "to_rating": getattr(e, "to_rating", None),
        "target_price": float(e.target_price) if getattr(e, "target_price", None) is not None else None,
        "ai_summary": e.ai_summary,
    }


async def _get_user_tickers(db: AsyncSession, user: User) -> List[str]:
    result = await db.execute(
        select(PortfolioItem.ticker).where(PortfolioItem.user_id == user.id)
    )
    return [row[0] for row in result.all()]


# --- Routes ---


@router.get("/upcoming", response_model=List[EventResponse])
async def get_upcoming_events(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_or_create_user),
):
    """Get all upcoming events related to user's portfolio + all macro events."""
    cache_key = f"events:upcoming:{user.id}"
    cached = await redis_client.get(cache_key)
    if cached:
        return json.loads(cached)

    tickers = await _get_user_tickers(db, user)
    now = datetime.now(timezone.utc)

    conditions = [
        Event.event_date >= now,
    ]

    if tickers:
        # User's stocks + all macro events
        conditions.append(
            or_(
                Event.ticker.in_(tickers),
                Event.ticker.is_(None),  # macro events
            )
        )
    else:
        # No portfolio: only show macro events
        conditions.append(Event.ticker.is_(None))

    result = await db.execute(
        select(Event)
        .where(and_(*conditions))
        .order_by(Event.event_date.asc(), Event.importance.desc())
    )
    events = result.scalars().all()
    response = [_event_to_response(e) for e in events]

    await redis_client.setex(cache_key, CACHE_TTL_UPCOMING, json.dumps(response, default=str))
    return response


@router.get("/today", response_model=List[EventResponse])
async def get_today_events(
    db: AsyncSession = Depends(get_db),
):
    """Get all events for today (preview). No auth required."""
    cached = await redis_client.get("events:today")
    if cached:
        return json.loads(cached)

    now = datetime.now(timezone.utc)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    today_end = today_start + timedelta(days=1)

    result = await db.execute(
        select(Event)
        .where(
            and_(
                Event.event_date >= today_start,
                Event.event_date < today_end,
            )
        )
        .order_by(Event.importance.desc(), Event.event_date.asc())
    )
    events = result.scalars().all()
    response = [_event_to_response(e) for e in events]

    await redis_client.setex("events:today", CACHE_TTL_TODAY, json.dumps(response, default=str))
    return response


@router.get("/yesterday", response_model=List[EventResponse])
async def get_yesterday_events(
    db: AsyncSession = Depends(get_db),
):
    """Get yesterday's events (recap). No auth required."""
    now = datetime.now(timezone.utc)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    yesterday_start = today_start - timedelta(days=1)

    result = await db.execute(
        select(Event)
        .where(
            and_(
                Event.event_date >= yesterday_start,
                Event.event_date < today_start,
            )
        )
        .order_by(Event.importance.desc(), Event.event_date.asc())
    )
    events = result.scalars().all()
    return [_event_to_response(e) for e in events]


@router.get("/stock/{ticker}", response_model=List[EventResponse])
async def get_stock_events(
    ticker: str,
    limit: int = Query(default=50, le=200),
    db: AsyncSession = Depends(get_db),
):
    """Get all events for a specific stock. No auth required (SEO-friendly)."""
    ticker = ticker.upper().strip()
    cache_key = f"stock:events:{ticker}"
    cached = await redis_client.get(cache_key)
    if cached:
        return json.loads(cached)

    result = await db.execute(
        select(Event)
        .where(Event.ticker == ticker)
        .order_by(Event.event_date.desc())
        .limit(limit)
    )
    events = result.scalars().all()
    response = [_event_to_response(e) for e in events]

    await redis_client.setex(cache_key, CACHE_TTL_STOCK, json.dumps(response, default=str))
    return response


@router.get("/{event_id}", response_model=EventDetailResponse)
async def get_event_detail(
    event_id: str,
    db: AsyncSession = Depends(get_db),
):
    """Get a single event with detailed AI explanation."""
    try:
        eid = uuid.UUID(event_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid event ID")

    result = await db.execute(select(Event).where(Event.id == eid))
    event = result.scalar_one_or_none()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")

    # Generate AI detail on demand if not cached
    if event.ai_detail is None:
        event_data = _event_to_response(event)
        detail = await generate_event_detail(event_data)
        if detail:
            event.ai_detail = detail
            await db.commit()

    resp = _event_to_response(event)
    resp["ai_detail"] = event.ai_detail
    return resp
