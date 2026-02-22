from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func
from pydantic import BaseModel
from datetime import datetime, timedelta
from typing import Optional

from ..config import get_settings
from ..database import get_db
from ..models import User, Order, Dish, CalorieCache, HealthInsightsCache

router = APIRouter()
settings = get_settings()


class DoDMetric(BaseModel):
    """Day-over-Day metric with change percentage."""
    today: int
    yesterday: int
    change_pct: float  # Positive = growth, negative = decline


class AdminStatsResponse(BaseModel):
    """Admin statistics response."""
    total_users: int
    total_orders: int
    total_dishes: int
    total_calories_cached: int
    users_last_24h: int
    users_last_7d: int
    orders_last_24h: int
    orders_last_7d: int
    avg_orders_per_user: float
    top_restaurants: list[dict]
    recent_signups: list[dict]
    # Day-over-Day metrics
    dod_signups: DoDMetric
    dod_orders: DoDMetric
    dod_active_users: DoDMetric


@router.get("/stats", response_model=AdminStatsResponse)
async def get_admin_stats(
    admin_key: str = Query(..., description="Admin secret key"),
    db: Session = Depends(get_db)
):
    """
    Get admin statistics. Requires admin_key query parameter.

    Usage: GET /admin/stats?admin_key=your-secret-key
    """
    # Simple auth check - use your secret_key from config
    if admin_key != settings.secret_key:
        raise HTTPException(status_code=403, detail="Invalid admin key")

    now = datetime.utcnow()
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    yesterday_start = today_start - timedelta(days=1)
    day_ago = now - timedelta(days=1)
    two_days_ago = now - timedelta(days=2)
    week_ago = now - timedelta(days=7)

    # Basic counts
    total_users = db.query(User).count()
    total_orders = db.query(Order).count()
    total_dishes = db.query(Dish).count()
    total_calories_cached = db.query(CalorieCache).count()

    # Recent activity
    users_last_24h = db.query(User).filter(User.created_at >= day_ago).count()
    users_last_7d = db.query(User).filter(User.created_at >= week_ago).count()
    orders_last_24h = db.query(Order).filter(Order.created_at >= day_ago).count()
    orders_last_7d = db.query(Order).filter(Order.created_at >= week_ago).count()

    # Average orders per user
    avg_orders_per_user = total_orders / total_users if total_users > 0 else 0

    # Top 5 restaurants
    top_restaurants_query = (
        db.query(Order.restaurant_name, func.count(Order.id).label('count'))
        .group_by(Order.restaurant_name)
        .order_by(func.count(Order.id).desc())
        .limit(5)
        .all()
    )
    top_restaurants = [
        {"name": r[0], "order_count": r[1]}
        for r in top_restaurants_query
    ]

    # Recent 10 signups (email partially masked for privacy)
    recent_users = (
        db.query(User)
        .order_by(User.created_at.desc())
        .limit(10)
        .all()
    )
    recent_signups = [
        {
            "email": mask_email(u.email),
            "created_at": u.created_at.isoformat() if u.created_at else None,
            "order_count": db.query(Order).filter(Order.user_id == u.id).count()
        }
        for u in recent_users
    ]

    # Day-over-Day calculations
    # Signups today vs yesterday
    signups_today = db.query(User).filter(User.created_at >= today_start).count()
    signups_yesterday = db.query(User).filter(
        User.created_at >= yesterday_start,
        User.created_at < today_start
    ).count()

    # Orders (syncs) today vs yesterday
    orders_today = db.query(Order).filter(Order.created_at >= today_start).count()
    orders_yesterday = db.query(Order).filter(
        Order.created_at >= yesterday_start,
        Order.created_at < today_start
    ).count()

    # Active users (users who synced) today vs yesterday
    active_today = db.query(func.count(func.distinct(Order.user_id))).filter(
        Order.created_at >= today_start
    ).scalar() or 0
    active_yesterday = db.query(func.count(func.distinct(Order.user_id))).filter(
        Order.created_at >= yesterday_start,
        Order.created_at < today_start
    ).scalar() or 0

    def calc_change_pct(today_val: int, yesterday_val: int) -> float:
        if yesterday_val == 0:
            return 100.0 if today_val > 0 else 0.0
        return round(((today_val - yesterday_val) / yesterday_val) * 100, 1)

    dod_signups = DoDMetric(
        today=signups_today,
        yesterday=signups_yesterday,
        change_pct=calc_change_pct(signups_today, signups_yesterday)
    )
    dod_orders = DoDMetric(
        today=orders_today,
        yesterday=orders_yesterday,
        change_pct=calc_change_pct(orders_today, orders_yesterday)
    )
    dod_active_users = DoDMetric(
        today=active_today,
        yesterday=active_yesterday,
        change_pct=calc_change_pct(active_today, active_yesterday)
    )

    return AdminStatsResponse(
        total_users=total_users,
        total_orders=total_orders,
        total_dishes=total_dishes,
        total_calories_cached=total_calories_cached,
        users_last_24h=users_last_24h,
        users_last_7d=users_last_7d,
        orders_last_24h=orders_last_24h,
        orders_last_7d=orders_last_7d,
        avg_orders_per_user=round(avg_orders_per_user, 2),
        top_restaurants=top_restaurants,
        recent_signups=recent_signups,
        dod_signups=dod_signups,
        dod_orders=dod_orders,
        dod_active_users=dod_active_users
    )


def mask_email(email: str) -> str:
    """Mask email for privacy: john.doe@gmail.com -> j***e@gmail.com"""
    if not email or '@' not in email:
        return email
    local, domain = email.split('@', 1)
    if len(local) <= 2:
        masked = local[0] + '***'
    else:
        masked = local[0] + '***' + local[-1]
    return f"{masked}@{domain}"
