"""Stock profile & earnings history API routes."""

from __future__ import annotations

import json
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession

from ..db.database import get_db
from ..db.redis import redis_client
from ..models.event import Event
from ..services.stock_profile import fetch_stock_profile

router = APIRouter(prefix="/api/stock", tags=["stock"])

CACHE_TTL_PROFILE = 60 * 60       # 1 hour
CACHE_TTL_EARNINGS_HIST = 6 * 60 * 60  # 6 hours


# --- Response schemas ---

class StockProfileResponse(BaseModel):
    ticker: str
    company_name: str
    long_name: Optional[str] = None
    sector: Optional[str] = None
    industry: Optional[str] = None
    country: Optional[str] = None
    website: Optional[str] = None
    description: Optional[str] = None

    current_price: Optional[float] = None
    previous_close: Optional[float] = None
    market_cap: Optional[int] = None
    currency: str = "USD"

    price_change: Optional[float] = None
    price_change_percent: Optional[float] = None

    pe_ratio: Optional[float] = None
    forward_pe: Optional[float] = None
    eps_ttm: Optional[float] = None
    dividend_yield: Optional[float] = None
    beta: Optional[float] = None
    fifty_two_week_high: Optional[float] = None
    fifty_two_week_low: Optional[float] = None
    avg_volume: Optional[int] = None

    earnings_date: Optional[str] = None


class EarningsHistoryItem(BaseModel):
    event_date: str
    eps_estimate: Optional[float] = None
    eps_actual: Optional[float] = None
    revenue_estimate: Optional[int] = None
    revenue_actual: Optional[int] = None
    beat: Optional[bool] = None
    surprise_percent: Optional[float] = None
    status: str


class EarningsHistoryResponse(BaseModel):
    ticker: str
    history: List[EarningsHistoryItem]
    beat_rate: Optional[float] = None
    total_quarters: int


# --- Routes ---

@router.get("/{ticker}/profile", response_model=StockProfileResponse)
async def get_stock_profile(ticker: str):
    """Get stock profile with company info, price, and key stats."""
    ticker = ticker.upper().strip()

    cache_key = f"stock:profile:{ticker}"
    cached = await redis_client.get(cache_key)
    if cached:
        return json.loads(cached)

    profile = fetch_stock_profile(ticker)
    if not profile:
        raise HTTPException(status_code=404, detail=f"Could not find stock: {ticker}")

    await redis_client.setex(cache_key, CACHE_TTL_PROFILE, json.dumps(profile, default=str))
    return profile


@router.get("/{ticker}/earnings-history", response_model=EarningsHistoryResponse)
async def get_earnings_history(
    ticker: str,
    limit: int = Query(default=8, le=20, description="Number of quarters to return"),
    db: AsyncSession = Depends(get_db),
):
    """Get historical earnings data for a stock (beat/miss trend)."""
    ticker = ticker.upper().strip()

    cache_key = f"stock:earnings_hist:{ticker}"
    cached = await redis_client.get(cache_key)
    if cached:
        return json.loads(cached)

    # Query completed earnings events for this ticker
    result = await db.execute(
        select(Event)
        .where(
            and_(
                Event.ticker == ticker,
                Event.event_type == "earnings",
                Event.status == "completed",
            )
        )
        .order_by(Event.event_date.desc())
        .limit(limit)
    )
    events = result.scalars().all()

    history = []
    beats = 0
    total_with_data = 0

    for e in events:
        eps_est = float(e.eps_estimate) if e.eps_estimate is not None else None
        eps_act = float(e.eps_actual) if e.eps_actual is not None else None

        beat = None
        surprise_pct = None

        if eps_act is not None and eps_est is not None:
            beat = eps_act >= eps_est
            if eps_est != 0:
                surprise_pct = round((eps_act - eps_est) / abs(eps_est) * 100, 2)
            if beat:
                beats += 1
            total_with_data += 1

        history.append(EarningsHistoryItem(
            event_date=e.event_date.isoformat(),
            eps_estimate=eps_est,
            eps_actual=eps_act,
            revenue_estimate=e.revenue_estimate,
            revenue_actual=e.revenue_actual,
            beat=beat,
            surprise_percent=surprise_pct,
            status=e.status,
        ))

    beat_rate = round(beats / total_with_data * 100, 1) if total_with_data > 0 else None

    response = EarningsHistoryResponse(
        ticker=ticker,
        history=history,
        beat_rate=beat_rate,
        total_quarters=len(history),
    )

    resp_dict = response.model_dump()
    await redis_client.setex(cache_key, CACHE_TTL_EARNINGS_HIST, json.dumps(resp_dict, default=str))
    return response
