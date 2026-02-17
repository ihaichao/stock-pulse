"""Stock/Macro event model."""

from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy import String, Text, DateTime, BigInteger, Numeric, Index
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import Mapped, mapped_column

from ..db.database import Base


class Event(Base):
    __tablename__ = "events"
    __table_args__ = (
        Index("idx_events_ticker", "ticker"),
        Index("idx_events_date", "event_date"),
        Index("idx_events_type", "event_type"),
        Index("idx_events_status", "status"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    ticker: Mapped[str | None] = mapped_column(String(16), nullable=True)
    event_type: Mapped[str] = mapped_column(String(32), nullable=False)
    event_date: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    title: Mapped[str] = mapped_column(String(512), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    importance: Mapped[str] = mapped_column(String(16), default="medium")
    status: Mapped[str] = mapped_column(String(16), default="upcoming")

    # Earnings fields
    eps_estimate: Mapped[float | None] = mapped_column(Numeric(10, 4), nullable=True)
    eps_actual: Mapped[float | None] = mapped_column(Numeric(10, 4), nullable=True)
    revenue_estimate: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    revenue_actual: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    report_time: Mapped[str | None] = mapped_column(String(16), nullable=True)

    # Macro fields
    macro_event_name: Mapped[str | None] = mapped_column(String(64), nullable=True)
    consensus: Mapped[str | None] = mapped_column(String(64), nullable=True)
    actual_value: Mapped[str | None] = mapped_column(String(64), nullable=True)
    previous_value: Mapped[str | None] = mapped_column(String(64), nullable=True)

    # SEC EDGAR fields
    filing_type: Mapped[str | None] = mapped_column(String(16), nullable=True)
    filing_url: Mapped[str | None] = mapped_column(Text, nullable=True)

    # AI
    ai_summary: Mapped[str | None] = mapped_column(Text, nullable=True)
    ai_detail: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Meta
    source: Mapped[str | None] = mapped_column(String(64), nullable=True)
    raw_data: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )
