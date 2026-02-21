"""Unusual options activity data.

Fetches large or unusual options trades that may signal institutional moves.
Uses the CBOE options data / public aggregated sources.
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone, timedelta
from typing import Any, Dict, List

import httpx

logger = logging.getLogger(__name__)

# Finnhub option sentiment (free tier) — for unusual activity signals
FINNHUB_BASE = "https://finnhub.io/api/v1"


async def fetch_unusual_options(
    ticker: str,
    finnhub_api_key: str = "",
) -> List[Dict[str, Any]]:
    """Fetch options sentiment / unusual activity signals for a ticker.

    Uses Finnhub's free aggregate data (put/call ratio, implied volatility)
    to detect potentially unusual activity.
    """
    events: List[Dict[str, Any]] = []

    if not finnhub_api_key:
        return []

    try:
        async with httpx.AsyncClient() as client:
            # 1. Get option chain aggregate stats
            resp = await client.get(
                f"{FINNHUB_BASE}/stock/option-chain",
                params={
                    "symbol": ticker.upper(),
                    "token": finnhub_api_key,
                },
                timeout=15,
            )

            if resp.status_code == 403:
                logger.info(f"Options data not available for {ticker} (paid feature)")
                return []

            resp.raise_for_status()
            data = resp.json()

        options = data.get("data", [])
        if not options:
            return []

        # Analyze the nearest expiry for unusual signals
        nearest = options[0] if options else {}
        calls = nearest.get("options", {}).get("CALL", [])
        puts = nearest.get("options", {}).get("PUT", [])

        if not calls and not puts:
            return []

        # Calculate aggregate metrics
        total_call_volume = sum(c.get("volume", 0) or 0 for c in calls)
        total_put_volume = sum(p.get("volume", 0) or 0 for p in puts)
        total_call_oi = sum(c.get("openInterest", 0) or 0 for c in calls)
        total_put_oi = sum(p.get("openInterest", 0) or 0 for p in puts)

        # Detect unusual: volume/OI ratio > 2 on either side, or extreme put/call ratio
        total_volume = total_call_volume + total_put_volume
        total_oi = total_call_oi + total_put_oi

        if total_oi == 0 or total_volume < 1000:
            return []  # Not enough data

        vol_oi_ratio = total_volume / total_oi
        pc_ratio = total_put_volume / total_call_volume if total_call_volume > 0 else 0

        # Flag as unusual if volume/OI > 1.5 or put/call ratio extreme
        is_unusual = vol_oi_ratio > 1.5 or pc_ratio > 2.0 or pc_ratio < 0.3

        if not is_unusual:
            return []

        # Build event
        if pc_ratio > 2.0:
            signal = "看跌信号"
            desc = f"{ticker} 期权市场出现异常看跌活动：Put/Call 比率 {pc_ratio:.2f}，看跌期权成交量 {total_put_volume:,}，看涨期权成交量 {total_call_volume:,}。"
        elif pc_ratio < 0.3:
            signal = "看涨信号"
            desc = f"{ticker} 期权市场出现异常看涨活动：Put/Call 比率 {pc_ratio:.2f}，看涨期权成交量 {total_call_volume:,}，看跌期权成交量 {total_put_volume:,}。"
        else:
            signal = "异常活跃"
            desc = f"{ticker} 期权市场异常活跃：总成交量 {total_volume:,}，持仓量 {total_oi:,}，Vol/OI 比率 {vol_oi_ratio:.2f}。"

        events.append({
            "ticker": ticker.upper(),
            "event_type": "unusual_options",
            "event_date": datetime.now(timezone.utc),
            "title": f"{ticker} 异常期权活动 — {signal}",
            "description": desc,
            "importance": "high" if (pc_ratio > 2.0 or pc_ratio < 0.3) else "medium",
            "status": "completed",
            "source": "finnhub_options",
            "raw_data": {
                "call_volume": total_call_volume,
                "put_volume": total_put_volume,
                "call_oi": total_call_oi,
                "put_oi": total_put_oi,
                "vol_oi_ratio": round(vol_oi_ratio, 2),
                "pc_ratio": round(pc_ratio, 2),
            },
        })

    except Exception as e:
        logger.warning(f"Unusual options fetch failed for {ticker}: {e}")

    return events


async def fetch_unusual_options_batch(
    tickers: List[str],
    finnhub_api_key: str = "",
) -> List[Dict[str, Any]]:
    """Fetch unusual options for multiple tickers."""
    all_events: List[Dict[str, Any]] = []
    for t in tickers:
        all_events.extend(await fetch_unusual_options(t, finnhub_api_key))
    return all_events
