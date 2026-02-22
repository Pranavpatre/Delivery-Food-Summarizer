from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
from .config import get_settings

settings = get_settings()


def create_db_engine():
    """Create database engine with appropriate settings for SQLite or PostgreSQL."""
    db_url = settings.database_url

    # Check if using SQLite (needs special connect_args)
    if db_url.startswith("sqlite"):
        return create_engine(
            db_url,
            connect_args={
                "check_same_thread": False,  # Needed for SQLite
                "timeout": 30  # Wait up to 30 seconds for database lock
            }
        )
    else:
        # PostgreSQL or other databases
        return create_engine(
            db_url,
            pool_size=5,
            max_overflow=10,
            pool_pre_ping=True  # Verify connections before using
        )


engine = create_db_engine()

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


def get_db():
    """Dependency to get database session."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    """Initialize database tables."""
    Base.metadata.create_all(bind=engine)
