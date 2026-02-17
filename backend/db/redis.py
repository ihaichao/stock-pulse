"""Redis connection for caching."""

from __future__ import annotations

import redis.asyncio as aioredis

from ..config import settings

redis_client = aioredis.from_url(
    settings.redis_url,
    encoding="utf-8",
    decode_responses=True,
)


async def get_redis() -> aioredis.Redis:
    """FastAPI dependency that returns the Redis client."""
    return redis_client
