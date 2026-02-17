"""Macro economic calendar data.

Uses Finnhub economic calendar API (free tier) supplemented by
a manually maintained list of major known events (FOMC, CPI, NFP, GDP).

Finnhub docs: https://finnhub.io/docs/api/economic-calendar
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone, timedelta
from typing import Any, Dict, List

import httpx

from ..config import settings

logger = logging.getLogger(__name__)

FINNHUB_BASE = "https://finnhub.io/api/v1"

# Importance mapping for known event names
MACRO_IMPORTANCE: Dict[str, str] = {
    "FOMC": "high",
    "Fed Interest Rate Decision": "high",
    "CPI": "high",
    "Consumer Price Index": "high",
    "Core CPI": "high",
    "Non-Farm Payrolls": "high",
    "Nonfarm Payrolls": "high",
    "GDP": "high",
    "Gross Domestic Product": "high",
    "PPI": "medium",
    "Producer Price Index": "medium",
    "Initial Jobless Claims": "medium",
    "PMI": "medium",
    "ISM Manufacturing PMI": "medium",
    "ISM Services PMI": "medium",
    "Consumer Confidence": "low",
    "Retail Sales": "medium",
    "Durable Goods Orders": "low",
    "PCE Price Index": "high",
    "Core PCE": "high",
}


async def fetch_macro_events(
    from_date: datetime | None = None,
    to_date: datetime | None = None,
) -> List[Dict[str, Any]]:
    """Fetch macro economic events from Finnhub.

    Defaults to current month + next month if no dates provided.
    """
    if from_date is None:
        from_date = datetime.now(timezone.utc).replace(day=1)
    if to_date is None:
        # End of next month
        next_month = from_date.replace(day=28) + timedelta(days=35)
        to_date = next_month.replace(day=1)

    if not settings.finnhub_api_key:
        logger.warning("FINNHUB_API_KEY not set, returning empty macro calendar")
        return []

    events: List[Dict[str, Any]] = []

    try:
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                f"{FINNHUB_BASE}/calendar/economic",
                params={
                    "from": from_date.strftime("%Y-%m-%d"),
                    "to": to_date.strftime("%Y-%m-%d"),
                    "token": settings.finnhub_api_key,
                },
                timeout=15,
            )
            resp.raise_for_status()
            data = resp.json()

        for item in data.get("economicCalendar", []):
            event_name = item.get("event", "")
            country = item.get("country", "")

            # Only US events for now
            if country and country.upper() != "US":
                continue

            date_str = item.get("time", item.get("date", ""))
            try:
                if "T" in str(date_str):
                    event_date = datetime.fromisoformat(
                        str(date_str).replace("Z", "+00:00")
                    )
                else:
                    event_date = datetime.strptime(
                        str(date_str), "%Y-%m-%d"
                    ).replace(tzinfo=timezone.utc)
            except (ValueError, TypeError):
                continue

            importance = _classify_importance(event_name)
            consensus = item.get("estimate")
            previous = item.get("prev")
            actual = item.get("actual")

            status = "completed" if actual is not None else "upcoming"

            events.append({
                "ticker": None,
                "event_type": "macro",
                "event_date": event_date,
                "title": event_name,
                "description": _build_macro_desc(event_name, consensus, previous, actual),
                "importance": importance,
                "status": status,
                "macro_event_name": event_name,
                "consensus": str(consensus) if consensus is not None else None,
                "actual_value": str(actual) if actual is not None else None,
                "previous_value": str(previous) if previous is not None else None,
                "source": "finnhub",
                "raw_data": item,
            })

    except Exception as e:
        logger.warning(f"Macro calendar fetch failed: {e}")

    return events


def _classify_importance(event_name: str) -> str:
    """Classify importance based on event name keywords."""
    name_upper = event_name.upper()
    for keyword, importance in MACRO_IMPORTANCE.items():
        if keyword.upper() in name_upper:
            return importance
    return "low"


def _build_macro_desc(
    name: str,
    consensus: Any,
    previous: Any,
    actual: Any,
) -> str:
    parts = [f"{name}."]
    if consensus is not None:
        parts.append(f"Consensus: {consensus}.")
    if previous is not None:
        parts.append(f"Previous: {previous}.")
    if actual is not None:
        parts.append(f"Actual: {actual}.")
    return " ".join(parts)
