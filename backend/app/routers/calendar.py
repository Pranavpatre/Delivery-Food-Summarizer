from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import datetime
from dateutil.relativedelta import relativedelta
from collections import defaultdict

from ..database import get_db
from ..models import User, Order, OrderResponse, DishResponse, CalendarDayData, CalendarMonthResponse, SummaryResponse
from ..routers.auth import get_current_user

router = APIRouter()


@router.get("/calendar/{year}/{month}", response_model=CalendarMonthResponse)
async def get_calendar_month(
    year: int,
    month: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get calendar data for a specific month."""
    # Validate month
    if month < 1 or month > 12:
        month = datetime.now().month
    if year < 2020 or year > 2030:
        year = datetime.now().year

    # Get start and end of month
    start_date = datetime(year, month, 1)
    if month == 12:
        end_date = datetime(year + 1, 1, 1)
    else:
        end_date = datetime(year, month + 1, 1)

    # Query orders for this month
    orders = db.query(Order).filter(
        Order.user_id == current_user.id,
        Order.order_date >= start_date,
        Order.order_date < end_date
    ).all()

    # Group orders by day
    days_data = defaultdict(lambda: {"orders": [], "total_calories": 0, "total_price": 0, "has_estimates": False})

    monthly_calories = 0
    monthly_price = 0

    for order in orders:
        day = str(order.order_date.day)

        # Build order response with dishes
        dishes = [
            DishResponse(
                id=dish.id,
                name=dish.name,
                quantity=dish.quantity,
                price=dish.price,
                calories=dish.calories,
                is_estimated=dish.is_estimated
            )
            for dish in order.dishes
        ]

        order_response = OrderResponse(
            id=order.id,
            email_id=order.email_id,
            order_date=order.order_date,
            restaurant_name=order.restaurant_name,
            total_calories=order.total_calories,
            total_price=order.total_price,
            has_estimates=order.has_estimates,
            dishes=dishes
        )

        days_data[day]["orders"].append(order_response)
        if order.total_calories:
            days_data[day]["total_calories"] += order.total_calories
            monthly_calories += order.total_calories
        if order.total_price:
            days_data[day]["total_price"] += order.total_price
            monthly_price += order.total_price
        if order.has_estimates:
            days_data[day]["has_estimates"] = True

    # Convert to CalendarDayData
    days = {}
    for day, data in days_data.items():
        days[day] = CalendarDayData(
            orders=data["orders"],
            total_calories=data["total_calories"],
            total_price=data["total_price"],
            has_estimates=data["has_estimates"]
        )

    response = CalendarMonthResponse(
        year=year,
        month=month,
        days=days,
        monthly_calories=monthly_calories,
        monthly_price=monthly_price
    )
    print(f"[CALENDAR] Returning {year}/{month}: {len(days)} days, {monthly_calories} kcal, ₹{monthly_price}")
    for day, data in days.items():
        print(f"[CALENDAR]   Day {day}: {len(data.orders)} orders, {data.total_calories} kcal, ₹{data.total_price}")
    return response


@router.get("/orders")
async def get_orders(
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get all orders for the current user with pagination."""
    orders = db.query(Order).filter(
        Order.user_id == current_user.id
    ).order_by(Order.order_date.desc()).offset(offset).limit(limit).all()

    total = db.query(Order).filter(Order.user_id == current_user.id).count()

    result = []
    for order in orders:
        dishes = [
            DishResponse(
                id=dish.id,
                name=dish.name,
                quantity=dish.quantity,
                calories=dish.calories,
                is_estimated=dish.is_estimated
            )
            for dish in order.dishes
        ]
        result.append(OrderResponse(
            id=order.id,
            email_id=order.email_id,
            order_date=order.order_date,
            restaurant_name=order.restaurant_name,
            total_calories=order.total_calories,
            has_estimates=order.has_estimates,
            dishes=dishes
        ))

    return {
        "orders": result,
        "total": total,
        "limit": limit,
        "offset": offset
    }


@router.get("/summary", response_model=SummaryResponse)
async def get_summary(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get summary stats for the previous 2 months."""
    now = datetime.now()
    months_data = []

    # Calculate stats for each of the previous 2 months
    for i in range(1, 3):  # 1 month ago and 2 months ago
        target_date = now - relativedelta(months=i)
        year = target_date.year
        month = target_date.month

        # Get start and end of that month
        start_date = datetime(year, month, 1)
        if month == 12:
            end_date = datetime(year + 1, 1, 1)
        else:
            end_date = datetime(year, month + 1, 1)

        # Query orders for this month
        orders = db.query(Order).filter(
            Order.user_id == current_user.id,
            Order.order_date >= start_date,
            Order.order_date < end_date
        ).all()

        # Calculate totals
        monthly_calories = sum(o.total_calories or 0 for o in orders)
        monthly_price = sum(o.total_price or 0 for o in orders)

        # Count unique days with orders
        days_ordered = len(set(o.order_date.day for o in orders))

        month_name = target_date.strftime("%B %Y")
        months_data.append({
            "month": month_name,
            "year": year,
            "month_num": month,
            "total_calories": monthly_calories,
            "total_price": monthly_price,
            "days_ordered": days_ordered,
            "order_count": len(orders)
        })

    # Calculate averages (only from months with data)
    months_with_data = [m for m in months_data if m["order_count"] > 0]
    num_months = len(months_with_data) if months_with_data else 1

    avg_monthly_spend = sum(m["total_price"] for m in months_data) / num_months if months_with_data else 0
    avg_monthly_calories = sum(m["total_calories"] for m in months_data) / num_months if months_with_data else 0
    avg_days_ordered = sum(m["days_ordered"] for m in months_data) / num_months if months_with_data else 0

    return SummaryResponse(
        avg_monthly_spend=round(avg_monthly_spend, 2),
        avg_monthly_calories=round(avg_monthly_calories, 2),
        avg_days_ordered=round(avg_days_ordered, 1),
        total_months_analyzed=len(months_data),
        months_data=months_data
    )
