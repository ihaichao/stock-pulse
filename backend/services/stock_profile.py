"""Stock profile data fetching via yfinance.

Fetches company info, current price, key stats for a given ticker.
Results are cached in Redis to avoid hammering yfinance.
"""

from __future__ import annotations

import logging
from typing import Any, Dict, Optional

import yfinance as yf

logger = logging.getLogger(__name__)


def fetch_stock_profile(ticker: str) -> Optional[Dict[str, Any]]:
    """Fetch stock profile for a single ticker.

    Returns a dict with company info or None if fetch fails.
    """
    try:
        stock = yf.Ticker(ticker)
        info = stock.info or {}

        if not info or info.get("trailingPegRatio") is None and info.get("shortName") is None:
            # yfinance sometimes returns minimal data for invalid tickers
            logger.warning(f"Minimal data returned for {ticker}, may be invalid")

        profile = {
            "ticker": ticker.upper(),
            "company_name": info.get("shortName") or info.get("longName") or ticker,
            "long_name": info.get("longName"),
            "sector": info.get("sector"),
            "industry": info.get("industry"),
            "country": info.get("country"),
            "website": info.get("website"),
            "description": info.get("longBusinessSummary"),

            # Price data
            "current_price": info.get("currentPrice") or info.get("regularMarketPrice"),
            "previous_close": info.get("previousClose") or info.get("regularMarketPreviousClose"),
            "market_cap": info.get("marketCap"),
            "currency": info.get("currency", "USD"),

            # Change
            "price_change": None,
            "price_change_percent": None,

            # Key stats
            "pe_ratio": info.get("trailingPE"),
            "forward_pe": info.get("forwardPE"),
            "eps_ttm": info.get("trailingEps"),
            "dividend_yield": info.get("dividendYield"),
            "beta": info.get("beta"),
            "fifty_two_week_high": info.get("fiftyTwoWeekHigh"),
            "fifty_two_week_low": info.get("fiftyTwoWeekLow"),
            "avg_volume": info.get("averageVolume"),

            # Earnings date
            "earnings_date": None,
        }

        # Calculate change
        current = profile["current_price"]
        prev = profile["previous_close"]
        if current is not None and prev is not None and prev != 0:
            profile["price_change"] = round(current - prev, 2)
            profile["price_change_percent"] = round((current - prev) / prev * 100, 2)

        # Next earnings date
        try:
            calendar = stock.calendar or {}
            for key in ("Earnings Date", "earningsDate"):
                val = calendar.get(key)
                if val is not None:
                    if isinstance(val, list) and len(val) > 0:
                        val = val[0]
                    if hasattr(val, "isoformat"):
                        profile["earnings_date"] = val.isoformat()
                    break
        except Exception:
            pass

        return profile

    except Exception as e:
        logger.warning(f"Failed to fetch profile for {ticker}: {e}")
        return None
