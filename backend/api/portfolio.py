"""Portfolio management API routes."""

from __future__ import annotations

import uuid
from typing import List

from fastapi import APIRouter, Depends, HTTPException, Header
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
    db: AsyncSession,
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
