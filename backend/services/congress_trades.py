"""Congressional trading data from Capitol Trades / House/Senate disclosures.

Fetches recent stock trades by US congress members.
Primary source: Capitol Trades public API (no key required for basic data).
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone, timedelta
from typing import Any, Dict, List

import httpx

logger = logging.getLogger(__name__)

# Capitol Trades public API
CAPITOL_TRADES_URL = "https://bff.capitoltrades.com/trades"


async def fetch_congress_trades(
    tickers: List[str] | None = None,
    days_back: int = 30,
    page_size: int = 96,
) -> List[Dict[str, Any]]:
    """Fetch recent congressional trades.

    If tickers is provided, only returns trades for those tickers.
    Otherwise returns all recent trades.
    """
    events: List[Dict[str, Any]] = []

    try:
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                CAPITOL_TRADES_URL,
                params={
                    "page": 1,
                    "pageSize": page_size,
                    "txDate": (
                        datetime.now(timezone.utc) - timedelta(days=days_back)
                    ).strftime("%Y-%m-%d"),
                },
                headers={"Accept": "application/json"},
                timeout=20,
            )
            resp.raise_for_status()
            data = resp.json()

        trades = data.get("data", [])
        if not trades:
            logger.info("No congressional trades found")
            return []

        ticker_set = set(t.upper() for t in tickers) if tickers else None

        for trade in trades:
            asset = trade.get("asset", {})
            ticker = asset.get("assetTickerSymbol", "")

            if not ticker:
                continue
            if ticker_set and ticker.upper() not in ticker_set:
                continue

            politician = trade.get("politician", {})
            pol_name = f"{politician.get('firstName', '')} {politician.get('lastName', '')}".strip()
            chamber = politician.get("chamber", "")
            party = politician.get("party", "")

            tx_type = trade.get("txType", "")
            tx_date_str = trade.get("txDate", "")
            tx_amount = trade.get("txAmount", "")

            try:
                event_date = datetime.strptime(tx_date_str[:10], "%Y-%m-%d").replace(
                    tzinfo=timezone.utc
                )
            except (ValueError, TypeError):
                continue

            # Translate action
            action_zh = "买入" if "purchase" in tx_type.lower() else "卖出" if "sale" in tx_type.lower() else tx_type
            chamber_zh = "参议员" if "senate" in chamber.lower() else "众议员" if "house" in chamber.lower() else chamber

            title = f"{ticker} 国会{chamber_zh}交易: {pol_name} {action_zh}"
            description = (
                f"{chamber_zh} {pol_name}（{party}）{action_zh} {ticker}，"
                f"金额范围 {tx_amount}。"
            )

            events.append({
                "ticker": ticker.upper(),
                "event_type": "congress_trade",
                "event_date": event_date,
                "title": title,
                "description": description,
                "importance": "medium",
                "status": "completed",
                "source": "capitoltrades",
                "raw_data": trade,
            })

    except httpx.HTTPStatusError as e:
        logger.warning(f"Capitol Trades API returned {e.response.status_code}")
    except Exception as e:
        logger.warning(f"Congressional trades fetch failed: {e}")

    logger.info(f"Fetched {len(events)} congressional trades")
    return events
