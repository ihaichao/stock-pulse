"""PostgreSQL async database connection via SQLAlchemy 2.0."""

from __future__ import annotations

from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.orm import DeclarativeBase

from ..config import settings

engine = create_async_engine(
    settings.database_url,
    echo=(settings.app_env == "development"),
    pool_size=10,
    max_overflow=20,
)

async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


async def get_db() -> AsyncSession:
    """FastAPI dependency that yields an async database session."""
    async with async_session() as session:
        try:
            yield session
        finally:
            await session.close()


async def init_db() -> None:
    """Create all tables. Used in development; in production use Alembic."""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
