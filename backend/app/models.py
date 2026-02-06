from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from datetime import datetime
from pydantic import BaseModel
from typing import Optional
from .database import Base


# SQLAlchemy Models (Database)

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True)
    google_access_token = Column(Text, nullable=True)
    google_refresh_token = Column(Text, nullable=True)
    token_expiry = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    orders = relationship("Order", back_populates="user")


class Order(Base):
    __tablename__ = "orders"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    email_id = Column(String, unique=True, index=True)  # Gmail message ID
    order_date = Column(DateTime, index=True)
    restaurant_name = Column(String)
    total_calories = Column(Float, nullable=True)
    total_price = Column(Float, nullable=True)  # Total order price in INR
    has_estimates = Column(Boolean, default=False)
    raw_email_subject = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="orders")
    dishes = relationship("Dish", back_populates="order", cascade="all, delete-orphan")


class Dish(Base):
    __tablename__ = "dishes"

    id = Column(Integer, primary_key=True, index=True)
    order_id = Column(Integer, ForeignKey("orders.id"))
    name = Column(String)
    quantity = Column(Integer, default=1)
    price = Column(Float, nullable=True)  # Price per item in INR
    calories = Column(Float, nullable=True)
    is_estimated = Column(Boolean, default=False)

    order = relationship("Order", back_populates="dishes")


class CalorieCache(Base):
    __tablename__ = "calorie_cache"

    id = Column(Integer, primary_key=True, index=True)
    dish_name = Column(String, index=True)
    restaurant_name = Column(String, nullable=True)
    calories = Column(Float)
    source_url = Column(String, nullable=True)
    is_estimated = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)


class HealthInsightsCache(Base):
    """Cache for health insights to avoid repeated Claude calls."""
    __tablename__ = "health_insights_cache"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), unique=True, index=True)
    health_insights_json = Column(Text)  # JSON string of HealthInsightsResponse
    last_order_count = Column(Integer)  # Order count when generated
    generated_at = Column(DateTime, default=datetime.utcnow)


# Pydantic Models (API Request/Response)

class UserCreate(BaseModel):
    email: str


class UserResponse(BaseModel):
    id: int
    email: str
    created_at: datetime

    class Config:
        from_attributes = True


class DishResponse(BaseModel):
    id: int
    name: str
    quantity: int
    price: Optional[float]
    calories: Optional[float]
    is_estimated: bool

    class Config:
        from_attributes = True


class OrderResponse(BaseModel):
    id: int
    email_id: str
    order_date: datetime
    restaurant_name: str
    total_calories: Optional[float]
    total_price: Optional[float]
    has_estimates: bool
    dishes: list[DishResponse]

    class Config:
        from_attributes = True


class CalendarDayData(BaseModel):
    orders: list[OrderResponse]
    total_calories: float
    total_price: float
    has_estimates: bool


class CalendarMonthResponse(BaseModel):
    year: int
    month: int
    days: dict[str, CalendarDayData]
    monthly_calories: float
    monthly_price: float


class SyncStatusResponse(BaseModel):
    status: str
    emails_processed: int
    orders_created: int
    errors: list[str]


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class SummaryResponse(BaseModel):
    """Summary stats for the last 6 months."""
    avg_monthly_spend: float
    avg_monthly_calories: float
    avg_days_ordered: float
    avg_order_count: float
    total_months_analyzed: int
    months_data: list[dict]  # Individual month breakdowns (includes short_month for charts)
    top_dish: Optional[str] = None  # Most frequently ordered dish
    top_dish_count: int = 0  # Number of times ordered


# Health Intelligence Models

class EatMoreOfItem(BaseModel):
    """Item in the 'eat more of' list with health indicator."""
    item: str
    is_healthy: bool


class HealthInsightsResponse(BaseModel):
    """Health intelligence insights."""
    health_index: int  # 0-100
    one_liner: str
    eat_more_of: list[EatMoreOfItem]
    lacking: list[str]
    monthly_narrative: str


class DailyHealthScore(BaseModel):
    """Health score for a single day."""
    date: str
    health_index: int


class ExtendedSummaryResponse(SummaryResponse):
    """Extended summary with health intelligence."""
    health_insights: Optional[HealthInsightsResponse] = None
    daily_health_scores: Optional[list[DailyHealthScore]] = None
