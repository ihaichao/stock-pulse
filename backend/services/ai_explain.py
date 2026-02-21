"""AI explanation service for stock/macro events.

Generates short summaries and detailed explanations via LLM.
"""

from __future__ import annotations

import json
import logging
from typing import Optional

import httpx

from ..config import settings

logger = logging.getLogger(__name__)


async def generate_event_summary(event_data: dict) -> Optional[str]:
    """Generate a 1-3 sentence Chinese summary for an event.

    Args:
        event_data: dict with event fields (type, ticker, title, etc.)

    Returns:
        Summary text or None if LLM is not configured / fails.
    """
    if not settings.stock_pulse_llm_endpoint:
        logger.debug("LLM endpoint not configured, skipping summary generation")
        return None

    event_type = event_data.get("event_type", "")
    prompt = _build_summary_prompt(event_type, event_data)

    return await _call_llm(prompt)


async def generate_event_detail(event_data: dict) -> Optional[str]:
    """Generate a detailed AI explanation for the event detail page."""
    if not settings.stock_pulse_llm_endpoint:
        return None

    event_type = event_data.get("event_type", "")
    prompt = _build_detail_prompt(event_type, event_data)

    return await _call_llm(prompt)


async def _call_llm(prompt: str) -> Optional[str]:
    """Call the LLM HTTP endpoint."""
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                settings.stock_pulse_llm_endpoint,
                json={"prompt": prompt},
                timeout=60,
            )
            resp.raise_for_status()
            data = resp.json()
            return data.get("text")
    except Exception as e:
        logger.warning(f"LLM call failed: {e}")
        return None


def _build_summary_prompt(event_type: str, data: dict) -> str:
    """Build a short summary prompt based on event type."""
    context = json.dumps(data, ensure_ascii=False, default=str)

    if event_type == "earnings":
        return f"""你是美股投资助手。请用1-3句简明中文总结以下财报事件，帮助普通投资者快速了解要点。不要给出买卖建议。

事件数据：
{context}

要求：
- 如果是即将发布的财报：说明预期EPS/营收，以及值得关注的点
- 如果是已发布的财报：说明实际vs预期，是beat还是miss，市场反应如何
- 语言简洁直观"""

    elif event_type == "macro":
        return f"""你是美股投资助手。请用1-2句简明中文总结以下宏观经济事件，帮助普通投资者理解其重要性。不要给出买卖建议。

事件数据：
{context}

要求：
- 说明这个数据为什么重要
- 如果有实际值：与预期对比，简述对市场的可能影响
- 语言简洁直观"""

    elif event_type == "insider":
        return f"""你是美股投资助手。请用1-2句简明中文总结以下内部人交易事件。不要给出买卖建议。

事件数据：
{context}

要求：
- 说明谁在买/卖，大概什么规模
- 简述内部人交易通常代表什么信号（但强调不确定性）
- 语言简洁直观"""

    elif event_type == "analyst_rating":
        return f"""你是美股投资助手。请用1-2句简明中文总结以下分析师评级变动事件。不要给出买卖建议。

事件数据：
{context}

要求：
- 说明哪家机构、从什么评级变到什么评级
- 如果有目标价变动也一并提及
- 语言简洁直观"""

    elif event_type == "congress_trade":
        return f"""你是美股投资助手。请用1-2句简明中文总结以下国会议员交易事件。不要给出买卖建议。

事件数据：
{context}

要求：
- 说明哪位议员、买入还是卖出、涉及金额范围
- 如果可能，简述此交易为何值得关注
- 语言简洁直观"""

    elif event_type == "unusual_options":
        return f"""你是美股投资助手。请用1-2句简明中文总结以下异常期权活动信号。不要给出买卖建议。

事件数据：
{context}

要求：
- 说明是看涨还是看跌信号
- 提及关键数据（Put/Call比率、成交量等）
- 强调这只是数据信号，不代表必然走势
- 语言简洁直观"""

    else:
        return f"""你是美股投资助手。请用1-2句简明中文总结以下事件。不要给出买卖建议。

事件数据：
{context}"""


def _build_detail_prompt(event_type: str, data: dict) -> str:
    """Build a detailed explanation prompt."""
    context = json.dumps(data, ensure_ascii=False, default=str)

    return f"""你是美股投资助手，面向有一定经验但非专业的普通投资者。请对以下事件做一份详细解读（3-5段）。

事件数据：
{context}

请按以下结构输出：

[事件概要]
用1-2句话概括事件核心内容。

[背景与上下文]
这个事件的背景是什么？比如历史表现趋势、行业环境、近期相关动态。

[可能影响]
对股价/市场可能有什么影响？分乐观和悲观两种情景分析。

[需要关注的风险]
投资者此时需要注意什么？有没有容易忽略的隐患？

注意：不要给出具体的买入/卖出建议，不要承诺未来会涨或会跌。使用简明中文。"""
