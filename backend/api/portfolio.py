"""Portfolio management API routes."""

from __future__ import annotations

import uuid
from typing import List

from fastapi import APIRouter, Depends, HTTPException, Header, BackgroundTasks
from pydantic import BaseModel
from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession

from ..db.database import get_db
from ..models.user import User
from ..models.portfolio import PortfolioItem

router = APIRouter(prefix="/api/portfolio", tags=["portfolio"])


# --- Request/Response schemas ---


class AddTickerRequest(BaseModel):
    ticker: str
    notes: str | None = None


class PortfolioItemResponse(BaseModel):
    ticker: str
    notes: str | None
    added_at: str

    class Config:
        from_attributes = True


# --- Auth helper ---


async def get_or_create_user(
    db: AsyncSession = Depends(get_db),
    authorization: str = Header(...),
) -> User:
    """Extract user token from Authorization header; create user if new."""
    token = authorization.replace("Bearer ", "").strip()
    if not token:
        raise HTTPException(status_code=401, detail="Missing auth token")

    result = await db.execute(select(User).where(User.token == token))
    user = result.scalar_one_or_none()

    if user is None:
        user = User(token=token)
        db.add(user)
        await db.commit()
        await db.refresh(user)

    return user


# --- Routes ---


@router.get("", response_model=List[PortfolioItemResponse])
async def list_portfolio(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_or_create_user),
):
    result = await db.execute(
        select(PortfolioItem)
        .where(PortfolioItem.user_id == user.id)
        .order_by(PortfolioItem.added_at.desc())
    )
    items = result.scalars().all()
    return [
        PortfolioItemResponse(
            ticker=item.ticker,
            notes=item.notes,
            added_at=item.added_at.isoformat(),
        )
        for item in items
    ]


@router.post("", response_model=PortfolioItemResponse, status_code=201)
async def add_ticker(
    body: AddTickerRequest,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_or_create_user),
):
    ticker = body.ticker.upper().strip()
    if not ticker or len(ticker) > 16:
        raise HTTPException(status_code=400, detail="Invalid ticker")

    # Check if already exists
    existing = await db.execute(
        select(PortfolioItem).where(
            PortfolioItem.user_id == user.id,
            PortfolioItem.ticker == ticker,
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail=f"{ticker} already in portfolio")

    item = PortfolioItem(user_id=user.id, ticker=ticker, notes=body.notes)
    db.add(item)
    await db.commit()
    await db.refresh(item)

    # Trigger data fetch
    background_tasks.add_task(fetch_initial_data, ticker)

    return PortfolioItemResponse(
        ticker=item.ticker,
        notes=item.notes,
        added_at=item.added_at.isoformat(),
    )


@router.delete("/{ticker}", status_code=204)
async def remove_ticker(
    ticker: str,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_or_create_user),
):
    ticker = ticker.upper().strip()
    result = await db.execute(
        delete(PortfolioItem).where(
            PortfolioItem.user_id == user.id,
            PortfolioItem.ticker == ticker,
        )
    )
    if result.rowcount == 0:
        raise HTTPException(status_code=404, detail=f"{ticker} not found in portfolio")
    await db.commit()


async def fetch_initial_data(ticker: str) -> None:
    """Background task to fetch initial data for a new ticker."""
    from ..services.earnings import fetch_earnings_for_ticker
    from ..services.edgar import fetch_insider_transactions
    from ..services.event_aggregator import upsert_events
    from ..db.database import async_session
    import logging

    logger = logging.getLogger(__name__)
    logger.info(f"Starting initial data fetch for {ticker}")

    async with async_session() as db:
        # 1. Earnings (sync, blocks loop briefly but acceptable for single ticker)
        try:
            earnings_events = fetch_earnings_for_ticker(ticker)
            if earnings_events:
                await upsert_events(db, earnings_events)
                logger.info(f"Fetched {len(earnings_events)} earnings events for {ticker}")
        except Exception as e:
            logger.error(f"Failed to fetch initial earnings for {ticker}: {e}")

        # 2. Insider transactions (async)
        try:
            insider_events = await fetch_insider_transactions(ticker)
            if insider_events:
                await upsert_events(db, insider_events)
                logger.info(f"Fetched {len(insider_events)} insider events for {ticker}")
        except Exception as e:
            logger.error(f"Failed to fetch initial insider events for {ticker}: {e}")

    # 3. Invalidate Redis cache so dashboard shows fresh data
    try:
        from ..db.redis import redis_client
        keys_to_delete = await redis_client.keys("events:upcoming:*")
        keys_to_delete += await redis_client.keys("events:today")
        keys_to_delete.append(f"stock:events:{ticker}")
        if keys_to_delete:
            await redis_client.delete(*keys_to_delete)
            logger.info(f"Invalidated {len(keys_to_delete)} cache keys after fetching {ticker}")
    except Exception as e:
        logger.error(f"Failed to invalidate cache for {ticker}: {e}")
