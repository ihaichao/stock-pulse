"""Analyst rating data fetching via yfinance.

Uses yfinance upgrades_downgrades data (free, no API key needed).
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone, timedelta
from typing import Any, Dict, List

import yfinance as yf

logger = logging.getLogger(__name__)


def fetch_analyst_ratings(
    ticker: str,
    days_back: int = 90,
) -> List[Dict[str, Any]]:
    """Fetch recent analyst rating changes for a ticker from yfinance.

    Returns event dicts ready for upserting into the events table.
    """
    events: List[Dict[str, Any]] = []
    cutoff = datetime.now(timezone.utc) - timedelta(days=days_back)

    try:
        stock = yf.Ticker(ticker)
        ud = stock.upgrades_downgrades

        if ud is None or ud.empty:
            logger.debug(f"No analyst data for {ticker}")
            return []

        for grade_date, row in ud.iterrows():
            # grade_date is the index (GradeDate)
            if not hasattr(grade_date, "year"):
                continue

            if isinstance(grade_date, datetime):
                event_date = grade_date.replace(tzinfo=timezone.utc) if grade_date.tzinfo is None else grade_date
            else:
                try:
                    event_date = datetime.combine(grade_date, datetime.min.time()).replace(tzinfo=timezone.utc)
                except Exception:
                    continue

            if event_date < cutoff:
                continue

            firm = row.get("Firm", "Unknown")
            from_grade = row.get("FromGrade", "")
            to_grade = row.get("ToGrade", "")
            action = row.get("Action", "")
            target_price = None
            current_target = row.get("currentPriceTarget")
            if current_target is not None and current_target != 0:
                try:
                    target_price = float(current_target)
                except (ValueError, TypeError):
                    pass

            action_zh = _translate_action(action)
            title = f"{ticker} {action_zh}: {firm}"
            description = _build_description(ticker, firm, action, from_grade, to_grade, target_price)
            importance = _classify_importance(action)

            events.append({
                "ticker": ticker.upper(),
                "event_type": "analyst_rating",
                "event_date": event_date,
                "title": title,
                "description": description,
                "importance": importance,
                "status": "completed",
                "analyst_firm": firm,
                "from_rating": from_grade if from_grade else None,
                "to_rating": to_grade if to_grade else None,
                "target_price": target_price,
                "source": "yfinance",
                "raw_data": {
                    "firm": firm,
                    "action": action,
                    "from_grade": from_grade,
                    "to_grade": to_grade,
                    "current_target": str(current_target) if current_target else None,
                },
            })

            # Limit to 20 most recent per ticker
            if len(events) >= 20:
                break

    except Exception as e:
        logger.warning(f"Analyst ratings fetch failed for {ticker}: {e}")

    return events


def fetch_analyst_ratings_batch(tickers: List[str]) -> List[Dict[str, Any]]:
    """Fetch analyst ratings for multiple tickers."""
    all_events: List[Dict[str, Any]] = []
    for t in tickers:
        all_events.extend(fetch_analyst_ratings(t))
    return all_events


def _translate_action(action: str) -> str:
    """Translate action to Chinese."""
    mapping = {
        "upgrade": "评级上调",
        "downgrade": "评级下调",
        "init": "首次覆盖",
        "reiterated": "维持评级",
        "main": "评级变动",
        "up": "评级上调",
        "down": "评级下调",
    }
    return mapping.get(action.lower(), f"评级变动({action})")


def _classify_importance(action: str) -> str:
    """Classify importance based on action type."""
    if action.lower() in ("upgrade", "downgrade", "up", "down"):
        return "medium"
    if action.lower() == "init":
        return "medium"
    return "low"


def _build_description(
    ticker: str,
    company: str,
    action: str,
    from_grade: str,
    to_grade: str,
    target_price: float | None = None,
) -> str:
    """Build a description for the analyst rating event."""
    action_zh = _translate_action(action)

    if from_grade and to_grade:
        desc = f"{company} 将 {ticker} 评级从 {from_grade} {action_zh}至 {to_grade}。"
    elif to_grade:
        desc = f"{company} 给予 {ticker} 评级 {to_grade}（{action_zh}）。"
    else:
        desc = f"{company} 对 {ticker} 发布了评级变动。"

    if target_price:
        desc += f" 目标价 ${target_price:.2f}。"

    return desc
