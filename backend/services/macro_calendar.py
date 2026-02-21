"""Macro economic calendar data.

Uses a curated static list of major US economic events.
Falls back to static data since Finnhub economic calendar requires Premium tier.

Key events tracked:
  - FOMC meetings (8x/year)
  - CPI / Core CPI (monthly)
  - Non-Farm Payrolls (monthly, first Friday)
  - GDP (quarterly)
  - PCE Price Index (monthly)
  - Initial Jobless Claims (weekly, Thursday)
  - PPI (monthly)
  - ISM PMI (monthly, first business day)
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone, timedelta, date
from typing import Any, Dict, List

logger = logging.getLogger(__name__)


# ─── Importance mapping ───────────────────────────────────────────────
MACRO_IMPORTANCE: Dict[str, str] = {
    "FOMC": "high",
    "CPI": "high",
    "Core CPI": "high",
    "Non-Farm Payrolls": "high",
    "GDP": "high",
    "PCE Price Index": "high",
    "Core PCE": "high",
    "PPI": "medium",
    "Initial Jobless Claims": "medium",
    "ISM Manufacturing PMI": "medium",
    "ISM Services PMI": "medium",
    "Retail Sales": "medium",
    "Consumer Confidence": "low",
    "Durable Goods Orders": "low",
}

# ─── Chinese translation ─────────────────────────────────────────────
MACRO_NAME_ZH: Dict[str, str] = {
    "FOMC Meeting": "美联储利率决议 (FOMC)",
    "CPI": "消费者价格指数 (CPI)",
    "Core CPI": "核心 CPI",
    "Non-Farm Payrolls": "非农就业数据",
    "GDP": "国内生产总值 (GDP) 初值",
    "GDP Preliminary": "国内生产总值 (GDP) 修正值",
    "GDP Final": "国内生产总值 (GDP) 终值",
    "PCE Price Index": "PCE 价格指数",
    "Core PCE": "核心 PCE 价格指数",
    "PPI": "生产者价格指数 (PPI)",
    "Initial Jobless Claims": "首次申请失业救济人数",
    "ISM Manufacturing PMI": "ISM 制造业 PMI",
    "ISM Services PMI": "ISM 服务业 PMI",
    "Retail Sales": "零售销售数据",
    "Consumer Confidence": "消费者信心指数",
    "Durable Goods Orders": "耐用品订单",
    "Unemployment Rate": "失业率",
}


def translate_macro_name(name: str) -> str:
    """Translate macro event name to Chinese."""
    if name in MACRO_NAME_ZH:
        return MACRO_NAME_ZH[name]
    for en_name, zh_name in MACRO_NAME_ZH.items():
        if en_name.upper() in name.upper():
            return zh_name
    return name


# ─── Static 2025/2026 US Economic Calendar ────────────────────────────
# Source: Federal Reserve, BLS, BEA published schedules
# Only major market-moving events included

_STATIC_EVENTS = [
    # ── 2025 ──────────────────────────────────────────────────────
    # FOMC 2025
    ("FOMC Meeting", "2025-01-29", "high"),
    ("FOMC Meeting", "2025-03-19", "high"),
    ("FOMC Meeting", "2025-05-07", "high"),
    ("FOMC Meeting", "2025-06-18", "high"),
    ("FOMC Meeting", "2025-07-30", "high"),
    ("FOMC Meeting", "2025-09-17", "high"),
    ("FOMC Meeting", "2025-10-29", "high"),
    ("FOMC Meeting", "2025-12-10", "high"),

    # CPI 2025
    ("CPI", "2025-01-15", "high"),
    ("CPI", "2025-02-12", "high"),
    ("CPI", "2025-03-12", "high"),
    ("CPI", "2025-04-10", "high"),
    ("CPI", "2025-05-13", "high"),
    ("CPI", "2025-06-11", "high"),
    ("CPI", "2025-07-10", "high"),
    ("CPI", "2025-08-12", "high"),
    ("CPI", "2025-09-10", "high"),
    ("CPI", "2025-10-14", "high"),
    ("CPI", "2025-11-12", "high"),
    ("CPI", "2025-12-10", "high"),

    # Non-Farm Payrolls 2025
    ("Non-Farm Payrolls", "2025-01-10", "high"),
    ("Non-Farm Payrolls", "2025-02-07", "high"),
    ("Non-Farm Payrolls", "2025-03-07", "high"),
    ("Non-Farm Payrolls", "2025-04-04", "high"),
    ("Non-Farm Payrolls", "2025-05-02", "high"),
    ("Non-Farm Payrolls", "2025-06-06", "high"),
    ("Non-Farm Payrolls", "2025-07-03", "high"),
    ("Non-Farm Payrolls", "2025-08-01", "high"),
    ("Non-Farm Payrolls", "2025-09-05", "high"),
    ("Non-Farm Payrolls", "2025-10-03", "high"),
    ("Non-Farm Payrolls", "2025-11-07", "high"),
    ("Non-Farm Payrolls", "2025-12-05", "high"),

    # GDP 2025
    ("GDP", "2025-01-30", "high"),
    ("GDP Preliminary", "2025-02-27", "high"),
    ("GDP Final", "2025-03-27", "high"),
    ("GDP", "2025-04-30", "high"),
    ("GDP Preliminary", "2025-05-29", "high"),
    ("GDP Final", "2025-06-26", "high"),
    ("GDP", "2025-07-30", "high"),
    ("GDP Preliminary", "2025-08-28", "high"),
    ("GDP Final", "2025-09-25", "high"),
    ("GDP", "2025-10-30", "high"),
    ("GDP Preliminary", "2025-11-26", "high"),
    ("GDP Final", "2025-12-23", "high"),

    # PCE 2025
    ("PCE Price Index", "2025-01-31", "high"),
    ("PCE Price Index", "2025-02-28", "high"),
    ("PCE Price Index", "2025-03-28", "high"),
    ("PCE Price Index", "2025-04-30", "high"),
    ("PCE Price Index", "2025-05-30", "high"),
    ("PCE Price Index", "2025-06-27", "high"),
    ("PCE Price Index", "2025-07-31", "high"),
    ("PCE Price Index", "2025-08-29", "high"),
    ("PCE Price Index", "2025-09-26", "high"),
    ("PCE Price Index", "2025-10-31", "high"),
    ("PCE Price Index", "2025-11-26", "high"),
    ("PCE Price Index", "2025-12-23", "high"),

    # PPI 2025
    ("PPI", "2025-01-14", "medium"),
    ("PPI", "2025-02-13", "medium"),
    ("PPI", "2025-03-13", "medium"),
    ("PPI", "2025-04-11", "medium"),
    ("PPI", "2025-05-15", "medium"),
    ("PPI", "2025-06-12", "medium"),
    ("PPI", "2025-07-15", "medium"),
    ("PPI", "2025-08-14", "medium"),
    ("PPI", "2025-09-11", "medium"),
    ("PPI", "2025-10-09", "medium"),
    ("PPI", "2025-11-13", "medium"),
    ("PPI", "2025-12-11", "medium"),

    # ISM Manufacturing PMI 2025 (first business day of month)
    ("ISM Manufacturing PMI", "2025-01-03", "medium"),
    ("ISM Manufacturing PMI", "2025-02-03", "medium"),
    ("ISM Manufacturing PMI", "2025-03-03", "medium"),
    ("ISM Manufacturing PMI", "2025-04-01", "medium"),
    ("ISM Manufacturing PMI", "2025-05-01", "medium"),
    ("ISM Manufacturing PMI", "2025-06-02", "medium"),
    ("ISM Manufacturing PMI", "2025-07-01", "medium"),
    ("ISM Manufacturing PMI", "2025-08-01", "medium"),
    ("ISM Manufacturing PMI", "2025-09-02", "medium"),
    ("ISM Manufacturing PMI", "2025-10-01", "medium"),
    ("ISM Manufacturing PMI", "2025-11-03", "medium"),
    ("ISM Manufacturing PMI", "2025-12-01", "medium"),

    # Retail Sales 2025
    ("Retail Sales", "2025-01-16", "medium"),
    ("Retail Sales", "2025-02-14", "medium"),
    ("Retail Sales", "2025-03-17", "medium"),
    ("Retail Sales", "2025-04-16", "medium"),
    ("Retail Sales", "2025-05-15", "medium"),
    ("Retail Sales", "2025-06-17", "medium"),
    ("Retail Sales", "2025-07-16", "medium"),
    ("Retail Sales", "2025-08-15", "medium"),
    ("Retail Sales", "2025-09-17", "medium"),
    ("Retail Sales", "2025-10-17", "medium"),
    ("Retail Sales", "2025-11-14", "medium"),
    ("Retail Sales", "2025-12-16", "medium"),

    # ── 2026 ──────────────────────────────────────────────────────
    # FOMC 2026
    ("FOMC Meeting", "2026-01-28", "high"),
    ("FOMC Meeting", "2026-03-18", "high"),
    ("FOMC Meeting", "2026-04-29", "high"),
    ("FOMC Meeting", "2026-06-17", "high"),
    ("FOMC Meeting", "2026-07-29", "high"),
    ("FOMC Meeting", "2026-09-16", "high"),
    ("FOMC Meeting", "2026-10-28", "high"),
    ("FOMC Meeting", "2026-12-09", "high"),

    # CPI 2026 (estimated dates, typically mid-month)
    ("CPI", "2026-01-14", "high"),
    ("CPI", "2026-02-11", "high"),
    ("CPI", "2026-03-11", "high"),
    ("CPI", "2026-04-14", "high"),
    ("CPI", "2026-05-12", "high"),
    ("CPI", "2026-06-10", "high"),
    ("CPI", "2026-07-14", "high"),
    ("CPI", "2026-08-12", "high"),
    ("CPI", "2026-09-15", "high"),
    ("CPI", "2026-10-13", "high"),
    ("CPI", "2026-11-12", "high"),
    ("CPI", "2026-12-10", "high"),

    # Non-Farm Payrolls 2026 (first Friday of month)
    ("Non-Farm Payrolls", "2026-01-09", "high"),
    ("Non-Farm Payrolls", "2026-02-06", "high"),
    ("Non-Farm Payrolls", "2026-03-06", "high"),
    ("Non-Farm Payrolls", "2026-04-03", "high"),
    ("Non-Farm Payrolls", "2026-05-01", "high"),
    ("Non-Farm Payrolls", "2026-06-05", "high"),
    ("Non-Farm Payrolls", "2026-07-02", "high"),
    ("Non-Farm Payrolls", "2026-08-07", "high"),
    ("Non-Farm Payrolls", "2026-09-04", "high"),
    ("Non-Farm Payrolls", "2026-10-02", "high"),
    ("Non-Farm Payrolls", "2026-11-06", "high"),
    ("Non-Farm Payrolls", "2026-12-04", "high"),

    # GDP 2026
    ("GDP", "2026-01-29", "high"),
    ("GDP Preliminary", "2026-02-26", "high"),
    ("GDP Final", "2026-03-26", "high"),
    ("GDP", "2026-04-29", "high"),
    ("GDP Preliminary", "2026-05-28", "high"),
    ("GDP Final", "2026-06-25", "high"),
    ("GDP", "2026-07-30", "high"),
    ("GDP Preliminary", "2026-08-27", "high"),
    ("GDP Final", "2026-09-24", "high"),
    ("GDP", "2026-10-29", "high"),
    ("GDP Preliminary", "2026-11-25", "high"),
    ("GDP Final", "2026-12-22", "high"),

    # PCE 2026
    ("PCE Price Index", "2026-01-30", "high"),
    ("PCE Price Index", "2026-02-27", "high"),
    ("PCE Price Index", "2026-03-27", "high"),
    ("PCE Price Index", "2026-04-30", "high"),
    ("PCE Price Index", "2026-05-29", "high"),
    ("PCE Price Index", "2026-06-26", "high"),
    ("PCE Price Index", "2026-07-31", "high"),
    ("PCE Price Index", "2026-08-28", "high"),
    ("PCE Price Index", "2026-09-25", "high"),
    ("PCE Price Index", "2026-10-30", "high"),
    ("PCE Price Index", "2026-11-25", "high"),
    ("PCE Price Index", "2026-12-23", "high"),

    # PPI 2026
    ("PPI", "2026-01-15", "medium"),
    ("PPI", "2026-02-12", "medium"),
    ("PPI", "2026-03-12", "medium"),
    ("PPI", "2026-04-09", "medium"),
    ("PPI", "2026-05-14", "medium"),
    ("PPI", "2026-06-11", "medium"),
    ("PPI", "2026-07-14", "medium"),
    ("PPI", "2026-08-13", "medium"),
    ("PPI", "2026-09-15", "medium"),
    ("PPI", "2026-10-15", "medium"),
    ("PPI", "2026-11-12", "medium"),
    ("PPI", "2026-12-10", "medium"),

    # ISM Manufacturing PMI 2026
    ("ISM Manufacturing PMI", "2026-01-05", "medium"),
    ("ISM Manufacturing PMI", "2026-02-02", "medium"),
    ("ISM Manufacturing PMI", "2026-03-02", "medium"),
    ("ISM Manufacturing PMI", "2026-04-01", "medium"),
    ("ISM Manufacturing PMI", "2026-05-01", "medium"),
    ("ISM Manufacturing PMI", "2026-06-01", "medium"),
    ("ISM Manufacturing PMI", "2026-07-01", "medium"),
    ("ISM Manufacturing PMI", "2026-08-03", "medium"),
    ("ISM Manufacturing PMI", "2026-09-01", "medium"),
    ("ISM Manufacturing PMI", "2026-10-01", "medium"),
    ("ISM Manufacturing PMI", "2026-11-02", "medium"),
    ("ISM Manufacturing PMI", "2026-12-01", "medium"),

    # Retail Sales 2026
    ("Retail Sales", "2026-01-15", "medium"),
    ("Retail Sales", "2026-02-13", "medium"),
    ("Retail Sales", "2026-03-17", "medium"),
    ("Retail Sales", "2026-04-15", "medium"),
    ("Retail Sales", "2026-05-15", "medium"),
    ("Retail Sales", "2026-06-16", "medium"),
    ("Retail Sales", "2026-07-16", "medium"),
    ("Retail Sales", "2026-08-14", "medium"),
    ("Retail Sales", "2026-09-16", "medium"),
    ("Retail Sales", "2026-10-16", "medium"),
    ("Retail Sales", "2026-11-17", "medium"),
    ("Retail Sales", "2026-12-15", "medium"),
]


def _parse_static_events() -> List[Dict[str, Any]]:
    """Parse the static event list into event dicts."""
    events = []
    now = datetime.now(timezone.utc)

    for name, date_str, importance in _STATIC_EVENTS:
        try:
            event_date = datetime.strptime(date_str, "%Y-%m-%d").replace(
                tzinfo=timezone.utc
            )
        except ValueError:
            continue

        zh_name = translate_macro_name(name)
        status = "completed" if event_date < now else "upcoming"

        events.append({
            "ticker": None,
            "event_type": "macro",
            "event_date": event_date,
            "title": zh_name,
            "description": _build_macro_desc(zh_name, status),
            "importance": importance,
            "status": status,
            "macro_event_name": name,
            "source": "static_calendar",
            "raw_data": {"original_name": name, "date": date_str},
        })

    return events


async def fetch_macro_events(
    from_date: datetime | None = None,
    to_date: datetime | None = None,
) -> List[Dict[str, Any]]:
    """Fetch macro economic events from the static calendar.

    Filters events to the requested date range.
    Defaults to current month + next month.
    """
    if from_date is None:
        from_date = datetime.now(timezone.utc).replace(day=1)
    if to_date is None:
        next_month = from_date.replace(day=28) + timedelta(days=35)
        to_date = next_month.replace(day=1)

    all_events = _parse_static_events()

    # Filter to requested date range
    return [
        e for e in all_events
        if from_date <= e["event_date"] < to_date
    ]


def _build_macro_desc(zh_name: str, status: str) -> str:
    """Build description for a macro event."""
    if status == "upcoming":
        return f"{zh_name} 即将公布。"
    else:
        return f"{zh_name} 已公布。"
