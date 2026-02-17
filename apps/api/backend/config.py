"""Application configuration via environment variables."""

from __future__ import annotations

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # Database
    database_url: str = "postgresql+asyncpg://sp:password@localhost:5432/stock_pulse"

    # Redis
    redis_url: str = "redis://localhost:6379/0"

    # LLM
    stock_pulse_llm_endpoint: str = ""

    # Data sources
    finnhub_api_key: str = ""

    # Firebase
    google_application_credentials: str = ""

    # App
    app_env: str = "development"
    app_port: int = 9002

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


settings = Settings()
