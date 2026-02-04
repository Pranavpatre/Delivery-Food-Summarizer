from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    # Google OAuth
    google_client_id: str = ""
    google_client_secret: str = ""
    google_redirect_uri: str = "http://localhost:8000/auth/google/callback"

    # Search API
    serpapi_key: str = ""

    # Anthropic API
    anthropic_api_key: str = ""

    # Application
    database_url: str = "sqlite:///./swiggy_calories.db"
    frontend_url: str = "http://localhost:5173"
    secret_key: str = "change-this-in-production"

    # JWT Settings
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 60 * 24 * 7  # 7 days

    # Email filtering
    swiggy_sender: str = "noreply@swiggy.in"
    date_filter_start: str = "2025-12-01"

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


@lru_cache()
def get_settings() -> Settings:
    return Settings()
