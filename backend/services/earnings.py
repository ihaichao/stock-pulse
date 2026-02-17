"""Earnings data fetching via yfinance.

Fetches upcoming earnings dates, EPS estimates, and historical earnings
for a list of tickers. Results are normalised into Event-compatible dicts.
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

import yfinance as yf

logger = logging.getLogger(__name__)


def fetch_earnings_for_ticker(ticker: str) -> List[Dict[str, Any]]:
    """Fetch earnings-related events for a single ticker.

    Returns a list of event dicts ready to be upserted into the events table.
    """
    events: List[Dict[str, Any]] = []

    try:
        stock = yf.Ticker(ticker)
        info = stock.info or {}
        calendar = stock.calendar or {}

        # --- Upcoming earnings ---
        earnings_date = _extract_earnings_date(calendar)
        if earnings_date:
            eps_est = info.get("epsCurrentYear") or info.get("epsForward")
            rev_est = info.get("revenueEstimate") if "revenueEstimate" in info else None
            company_name = info.get("shortName", ticker)

            events.append({
                "ticker": ticker,
                "event_type": "earnings",
                "event_date": earnings_date,
                "title": f"{ticker} Earnings Release",
                "description": f"{company_name} is scheduled to report earnings.",
                "importance": "high",
                "status": "upcoming",
                "eps_estimate": float(eps_est) if eps_est else None,
                "revenue_estimate": int(rev_est) if rev_est else None,
                "report_time": _guess_report_time(calendar),
                "source": "yfinance",
                "raw_data": {"info_keys": list(info.keys())[:20]},
            })

        # --- Historical earnings (last 4 quarters) ---
        try:
            hist = stock.earnings_history
            if hist is not None and not hist.empty:
                for _, row in hist.iterrows():
                    q_date = row.name if hasattr(row.name, "isoformat") else None
                    if q_date is None:
                        continue
                    if not isinstance(q_date, datetime):
                        q_date = datetime.combine(q_date, datetime.min.time()).replace(
                            tzinfo=timezone.utc
                        )
                    events.append({
                        "ticker": ticker,
                        "event_type": "earnings",
                        "event_date": q_date,
                        "title": f"{ticker} Earnings (Historical)",
                        "description": _build_historical_desc(ticker, row),
                        "importance": "medium",
                        "status": "completed",
                        "eps_estimate": _safe_float(row.get("epsEstimate")),
                        "eps_actual": _safe_float(row.get("epsActual")),
                        "source": "yfinance",
                    })
        except Exception as e:
            logger.debug(f"Could not fetch earnings history for {ticker}: {e}")

    except Exception as e:
        logger.warning(f"Failed to fetch earnings for {ticker}: {e}")

    return events


def fetch_earnings_batch(tickers: List[str]) -> List[Dict[str, Any]]:
    """Fetch earnings events for multiple tickers."""
    all_events: List[Dict[str, Any]] = []
    for t in tickers:
        all_events.extend(fetch_earnings_for_ticker(t))
    return all_events


# --- Helpers ---


def _extract_earnings_date(calendar: dict) -> Optional[datetime]:
    """Try to extract next earnings date from yfinance calendar."""
    # yfinance returns different formats depending on version
    for key in ("Earnings Date", "earningsDate"):
        val = calendar.get(key)
        if val is None:
            continue
        if isinstance(val, list) and len(val) > 0:
            val = val[0]
        if isinstance(val, datetime):
            return val.replace(tzinfo=timezone.utc) if val.tzinfo is None else val
        if hasattr(val, "to_pydatetime"):
            dt = val.to_pydatetime()
            return dt.replace(tzinfo=timezone.utc) if dt.tzinfo is None else dt
    return None


def _guess_report_time(calendar: dict) -> Optional[str]:
    """Guess BMO/AMC from calendar data."""
    for key in ("Earnings Date", "earningsDate"):
        val = calendar.get(key)
        if isinstance(val, list) and len(val) >= 2:
            # Some sources encode [date, "BMO"/"AMC"] or [start, end]
            hint = str(val[-1]).upper()
            if "BMO" in hint or "BEFORE" in hint:
                return "BMO"
            if "AMC" in hint or "AFTER" in hint:
                return "AMC"
    return None


def _safe_float(val: Any) -> Optional[float]:
    if val is None:
        return None
    try:
        return float(val)
    except (ValueError, TypeError):
        return None


def _build_historical_desc(ticker: str, row) -> str:
    est = row.get("epsEstimate")
    actual = row.get("epsActual")
    parts = [f"{ticker} reported earnings."]
    if actual is not None and est is not None:
        diff = "beat" if float(actual) >= float(est) else "missed"
        parts.append(f"EPS: {actual} vs estimate {est} ({diff}).")
    return " ".join(parts)
