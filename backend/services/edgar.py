"""SEC EDGAR data fetching.

Phase 1 focus: Form 4 (insider transactions).
Future: Form 8-K, 10-Q/10-K parsing.

SEC EDGAR API docs: https://www.sec.gov/search#/
Rate limit: ~10 requests/second, must include User-Agent with contact email.
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

import httpx

logger = logging.getLogger(__name__)

SEC_BASE = "https://data.sec.gov"
SEC_SEARCH = "https://efts.sec.gov/LATEST"
USER_AGENT = "StockPulse/1.0 (contact@stockpulse.dev)"

# CIK lookup cache (ticker -> CIK string)
_cik_cache: Dict[str, str] = {}


async def lookup_cik(ticker: str) -> Optional[str]:
    """Look up SEC CIK for a ticker symbol."""
    if ticker in _cik_cache:
        return _cik_cache[ticker]

    try:
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                f"{SEC_BASE}/submissions/CIK{ticker}.json",
                headers={"User-Agent": USER_AGENT},
                timeout=10,
            )
            # Direct ticker lookup may not work; try company tickers file
            if resp.status_code != 200:
                resp = await client.get(
                    "https://www.sec.gov/files/company_tickers.json",
                    headers={"User-Agent": USER_AGENT},
                    timeout=10,
                )
                resp.raise_for_status()
                data = resp.json()
                for entry in data.values():
                    if entry.get("ticker", "").upper() == ticker.upper():
                        cik = str(entry["cik_str"]).zfill(10)
                        _cik_cache[ticker] = cik
                        return cik
                return None

            data = resp.json()
            cik = str(data.get("cik", "")).zfill(10)
            _cik_cache[ticker] = cik
            return cik

    except Exception as e:
        logger.warning(f"CIK lookup failed for {ticker}: {e}")
        return None


async def fetch_insider_transactions(ticker: str) -> List[Dict[str, Any]]:
    """Fetch recent Form 4 filings (insider transactions) for a ticker.

    Returns event dicts ready for upserting into the events table.
    """
    cik = await lookup_cik(ticker)
    if not cik:
        logger.info(f"No CIK found for {ticker}, skipping EDGAR")
        return []

    events: List[Dict[str, Any]] = []

    try:
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                f"{SEC_BASE}/submissions/CIK{cik}.json",
                headers={"User-Agent": USER_AGENT},
                timeout=15,
            )
            resp.raise_for_status()
            data = resp.json()

        recent = data.get("filings", {}).get("recent", {})
        forms = recent.get("form", [])
        dates = recent.get("filingDate", [])
        accessions = recent.get("accessionNumber", [])
        descriptions = recent.get("primaryDocDescription", [])

        for i, form_type in enumerate(forms):
            if form_type != "4":
                continue
            if i >= len(dates):
                break

            filing_date = dates[i]
            accession = accessions[i] if i < len(accessions) else ""
            desc = descriptions[i] if i < len(descriptions) else ""

            try:
                event_date = datetime.strptime(filing_date, "%Y-%m-%d").replace(
                    tzinfo=timezone.utc
                )
            except ValueError:
                continue

            filing_url = (
                f"https://www.sec.gov/Archives/edgar/data/"
                f"{cik.lstrip('0')}/{accession.replace('-', '')}/{accession}-index.htm"
            )

            events.append({
                "ticker": ticker,
                "event_type": "insider",
                "event_date": event_date,
                "title": f"{ticker} 内部人交易（Form 4）",
                "description": desc or f"{ticker} 提交 Form 4 内部人交易报告",
                "importance": "medium",
                "status": "completed",
                "filing_type": "4",
                "filing_url": filing_url,
                "source": "edgar",
                "raw_data": {
                    "cik": cik,
                    "accession": accession,
                    "form": form_type,
                },
            })

            # Limit to recent 20 filings per ticker
            if len(events) >= 20:
                break

    except Exception as e:
        logger.warning(f"EDGAR fetch failed for {ticker} (CIK {cik}): {e}")

    return events


async def fetch_edgar_batch(tickers: List[str]) -> List[Dict[str, Any]]:
    """Fetch EDGAR events for multiple tickers."""
    all_events: List[Dict[str, Any]] = []
    for t in tickers:
        all_events.extend(await fetch_insider_transactions(t))
    return all_events
