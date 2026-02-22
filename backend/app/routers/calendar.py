import json
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import datetime
from dateutil.relativedelta import relativedelta
from collections import defaultdict

from ..database import get_db
from ..models import (
    User, Order, Dish, OrderResponse, DishResponse, CalendarDayData,
    CalendarMonthResponse, SummaryResponse, ExtendedSummaryResponse,
    HealthInsightsResponse, HabitItem, DailyHealthScore, HealthInsightsCache,
    NutrientLevel
)
from ..routers.auth import get_current_user
from ..services.health_intelligence import HealthIntelligenceService

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


@router.get("/summary", response_model=ExtendedSummaryResponse)
async def get_summary(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get summary stats with health intelligence for the previous 6 months."""
    now = datetime.now()
    months_data = []
    dish_counts = defaultdict(int)  # Track dish frequency
    dish_calories = {}  # Track calories per dish
    all_orders = []  # Collect all orders for health analysis
    daily_orders = defaultdict(list)  # Track orders by date for daily health scores
    late_night_count = 0  # Orders after 10pm or before 5am
    orders_with_time = 0  # Orders where we actually parsed the time

    # Calculate stats for each of the previous 6 months
    for i in range(1, 7):  # 1 month ago to 6 months ago
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

        all_orders.extend(orders)

        # Calculate totals and track dishes
        monthly_calories = sum(o.total_calories or 0 for o in orders)
        monthly_price = sum(o.total_price or 0 for o in orders)

        # Count dish frequencies and collect for health analysis
        for order in orders:
            date_str = order.order_date.strftime("%Y-%m-%d")
            order_hour = order.order_date.hour
            daily_orders[date_str].append({
                "calories": order.total_calories or 0,
                "dishes": [d.name for d in order.dishes],
                "hour": order_hour
            })
            # Track late night orders (after 10pm or before 5am)
            # Skip orders with exactly midnight time (00:00:00) - means time wasn't parsed
            has_real_time = not (order.order_date.hour == 0 and order.order_date.minute == 0 and order.order_date.second == 0)
            if has_real_time:
                orders_with_time += 1
                if order_hour >= 22 or order_hour < 5:
                    late_night_count += 1

            for dish in order.dishes:
                dish_name = dish.name.strip().lower()
                dish_counts[dish_name] += dish.quantity
                if dish_name not in dish_calories and dish.calories:
                    dish_calories[dish_name] = dish.calories

        # Count unique days with orders
        days_ordered = len(set(o.order_date.day for o in orders))

        month_name = target_date.strftime("%B %Y")
        short_month = target_date.strftime("%b")
        months_data.append({
            "month": month_name,
            "short_month": short_month,
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
    avg_order_count = sum(m["order_count"] for m in months_data) / num_months if months_with_data else 0

    # Find top dish
    top_dish = None
    top_dish_count = 0
    top_dishes = []
    if dish_counts:
        sorted_dishes = sorted(dish_counts.items(), key=lambda x: x[1], reverse=True)
        top_dish_name = sorted_dishes[0][0]
        top_dish_count = sorted_dishes[0][1]
        top_dish = top_dish_name.title()
        top_dishes = [name.title() for name, _ in sorted_dishes[:5]]

    # Calculate total orders for cache check
    total_order_count = len(all_orders)

    # Health Intelligence
    health_insights = None
    daily_health_scores = None

    # Calculate late night order percentage
    late_night_order_pct = (late_night_count / orders_with_time * 100) if orders_with_time > 0 else 0

    if total_order_count > 0:
        # Check cache first
        cached = db.query(HealthInsightsCache).filter(
            HealthInsightsCache.user_id == current_user.id
        ).first()

        if cached and cached.last_order_count == total_order_count:
            # Use cached insights
            try:
                cached_data = json.loads(cached.health_insights_json)
                # Parse nutrient levels from cache
                cached_nutrients = cached_data.get("nutrient_levels", [])
                nutrient_levels = [NutrientLevel(**n) for n in cached_nutrients] if cached_nutrients else None

                health_insights = HealthInsightsResponse(
                    health_index=cached_data["health_index"],
                    one_liner=cached_data["one_liner"],
                    good_habits=[HabitItem(**item) for item in cached_data.get("good_habits", [])],
                    bad_habits=[HabitItem(**item) for item in cached_data.get("bad_habits", [])],
                    lacking=cached_data.get("lacking", []),
                    best_dishes=cached_data.get("best_dishes", []),
                    worst_dishes=cached_data.get("worst_dishes", []),
                    narrative=cached_data.get("narrative", ""),
                    nutrient_levels=nutrient_levels,
                    late_night_pct=late_night_order_pct
                )
                # Recalculate daily scores (they're cheap)
                health_service = HealthIntelligenceService(db)
                daily_scores = health_service.calculate_daily_health_scores(
                    dict(daily_orders),
                    health_insights.health_index
                )
                daily_health_scores = [DailyHealthScore(**s) for s in daily_scores]
            except Exception as e:
                print(f"Cache parse error: {e}")
                cached = None

        if not cached or cached.last_order_count != total_order_count:
            # Generate new insights
            health_service = HealthIntelligenceService(db)

            # Prepare dish data for analysis
            dishes_with_frequency = [
                {
                    "name": name.title(),
                    "count": count,
                    "calories": dish_calories.get(name, 0)
                }
                for name, count in dish_counts.items()
            ]

            # Calculate average daily calories on order days
            total_days = len(daily_orders)
            total_cal = sum(
                sum(o["calories"] for o in orders)
                for orders in daily_orders.values()
            )
            avg_daily_calories = total_cal / total_days if total_days > 0 else 0

            # Generate insights
            insights = await health_service.generate_health_insights(
                dishes_with_frequency=dishes_with_frequency,
                total_orders=total_order_count,
                total_months=num_months,
                avg_daily_calories=avg_daily_calories,
                top_dishes=top_dishes,
                late_night_order_pct=late_night_order_pct
            )

            if insights:
                # Parse nutrient levels
                nutrient_levels = None
                if insights.nutrient_levels:
                    nutrient_levels = [
                        NutrientLevel(
                            name=n.get("name", ""),
                            level=n.get("level", "medium")
                        ) if isinstance(n, dict) else NutrientLevel(name=str(n), level="medium")
                        for n in insights.nutrient_levels
                    ]

                health_insights = HealthInsightsResponse(
                    health_index=insights.health_index,
                    one_liner=insights.one_liner,
                    good_habits=[HabitItem(item=h.get("item", ""), detail=h.get("detail", "")) if isinstance(h, dict) else HabitItem(item=str(h), detail="") for h in insights.good_habits],
                    bad_habits=[HabitItem(item=h.get("item", ""), detail=h.get("detail", "")) if isinstance(h, dict) else HabitItem(item=str(h), detail="") for h in insights.bad_habits],
                    lacking=insights.lacking,
                    best_dishes=insights.best_dishes,
                    worst_dishes=insights.worst_dishes,
                    narrative=insights.narrative,
                    nutrient_levels=nutrient_levels,
                    late_night_pct=late_night_order_pct
                )

                # Calculate daily health scores
                daily_scores = health_service.calculate_daily_health_scores(
                    dict(daily_orders),
                    insights.health_index
                )
                daily_health_scores = [DailyHealthScore(**s) for s in daily_scores]

                # Save to cache
                cache_data = {
                    "health_index": insights.health_index,
                    "one_liner": insights.one_liner,
                    "good_habits": [{"item": h.get("item", "") if isinstance(h, dict) else str(h), "detail": h.get("detail", "") if isinstance(h, dict) else ""} for h in insights.good_habits],
                    "bad_habits": [{"item": h.get("item", "") if isinstance(h, dict) else str(h), "detail": h.get("detail", "") if isinstance(h, dict) else ""} for h in insights.bad_habits],
                    "lacking": insights.lacking,
                    "best_dishes": insights.best_dishes,
                    "worst_dishes": insights.worst_dishes,
                    "narrative": insights.narrative,
                    "nutrient_levels": insights.nutrient_levels or []
                }

                if cached:
                    cached.health_insights_json = json.dumps(cache_data)
                    cached.last_order_count = total_order_count
                    cached.generated_at = datetime.utcnow()
                else:
                    new_cache = HealthInsightsCache(
                        user_id=current_user.id,
                        health_insights_json=json.dumps(cache_data),
                        last_order_count=total_order_count
                    )
                    db.add(new_cache)

                db.commit()

    return ExtendedSummaryResponse(
        avg_monthly_spend=round(avg_monthly_spend, 2),
        avg_monthly_calories=round(avg_monthly_calories, 2),
        avg_days_ordered=round(avg_days_ordered, 1),
        avg_order_count=round(avg_order_count, 1),
        total_months_analyzed=len(months_data),
        months_data=months_data,
        top_dish=top_dish,
        top_dish_count=top_dish_count,
        health_insights=health_insights,
        daily_health_scores=daily_health_scores,
        late_night_order_pct=round(late_night_order_pct, 1)
    )
