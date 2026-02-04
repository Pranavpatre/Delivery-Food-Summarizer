from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session

from ..config import get_settings
from ..database import get_db
from ..models import User, Order, Dish, SyncStatusResponse
from ..routers.auth import get_current_user
from ..services.gmail import GmailService
from ..services.email_parser import EmailParser
from ..services.instamart_filter import InstamrtFilter
from ..services.calorie_lookup import CalorieLookupService

router = APIRouter()
settings = get_settings()


async def process_emails(user_id: int, db: Session):
    """Background task to process user's Swiggy emails."""
    print(f"[SYNC] Starting email sync for user {user_id}")

    user = db.query(User).filter(User.id == user_id).first()
    if not user or not user.google_access_token:
        print(f"[SYNC] No user or access token found for user {user_id}")
        return

    gmail = GmailService(user.google_access_token, user.google_refresh_token)
    parser = EmailParser()
    instamart_filter = InstamrtFilter()
    calorie_service = CalorieLookupService()

    # Fetch emails from Swiggy
    print(f"[SYNC] Fetching emails from {settings.swiggy_sender} after {settings.date_filter_start}")
    try:
        emails = await gmail.fetch_swiggy_emails(
            sender=settings.swiggy_sender,
            after_date=settings.date_filter_start
        )
        print(f"[SYNC] Found {len(emails)} emails from Swiggy")
    except Exception as e:
        print(f"[SYNC] Error fetching emails: {e}")
        return

    for email_data in emails:
        print(f"[SYNC] Processing email: {email_data['subject'][:50]}...")

        # Skip if already processed
        if db.query(Order).filter(Order.email_id == email_data["id"]).first():
            print(f"[SYNC] Skipping - already processed")
            continue

        # Skip Instamart emails
        if instamart_filter.should_exclude(email_data["subject"], email_data["body"]):
            print(f"[SYNC] Skipping - Instamart/grocery email")
            continue

        # Parse the email for order data
        order_data = parser.parse_order_email(email_data["body"], email_data["subject"])
        if not order_data:
            print(f"[SYNC] Skipping - could not parse order data")
            continue

        print(f"[SYNC] Found order from {order_data['restaurant_name']} with {len(order_data['dishes'])} dishes")

        # Create order
        order = Order(
            user_id=user.id,
            email_id=email_data["id"],
            order_date=order_data["order_date"],
            restaurant_name=order_data["restaurant_name"],
            total_price=order_data.get("total_price"),
            raw_email_subject=email_data["subject"]
        )
        db.add(order)
        db.flush()

        # Process each dish
        total_calories = 0
        total_price = 0
        has_estimates = False

        for dish_data in order_data["dishes"]:
            # Look up calories
            calorie_info = await calorie_service.get_calories(
                dish_name=dish_data["name"],
                restaurant_name=order_data["restaurant_name"]
            )
            dish_price = dish_data.get("price")
            print(f"[SYNC]   - {dish_data['name']}: {calorie_info['calories']} cal, ₹{dish_price or 'N/A'} (estimated: {calorie_info['is_estimated']})")

            dish = Dish(
                order_id=order.id,
                name=dish_data["name"],
                quantity=dish_data["quantity"],
                price=dish_price,
                calories=calorie_info["calories"] * dish_data["quantity"] if calorie_info["calories"] else None,
                is_estimated=calorie_info["is_estimated"]
            )
            db.add(dish)

            if calorie_info["calories"]:
                total_calories += calorie_info["calories"] * dish_data["quantity"]
            if dish_price:
                total_price += dish_price * dish_data["quantity"]
            if calorie_info["is_estimated"]:
                has_estimates = True

        order.total_calories = total_calories if total_calories > 0 else None
        # Use parsed total_price if available, otherwise use calculated sum
        if not order.total_price and total_price > 0:
            order.total_price = total_price
        order.has_estimates = has_estimates
        print(f"[SYNC] Order saved: {order_data['restaurant_name']} - {total_calories} cal, ₹{order.total_price or 0}")

    db.commit()
    total_orders = db.query(Order).filter(Order.user_id == user_id).count()
    print(f"[SYNC] Sync complete. Total orders for user: {total_orders}")


@router.post("/sync", response_model=SyncStatusResponse)
async def sync_emails(
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Trigger email sync for the current user."""
    if not current_user.google_access_token:
        raise HTTPException(
            status_code=400,
            detail="No Google account linked. Please login with Google first."
        )

    # Run sync in background
    background_tasks.add_task(process_emails, current_user.id, db)

    return SyncStatusResponse(
        status="processing",
        emails_processed=0,
        orders_created=0,
        errors=[]
    )


@router.get("/sync/status", response_model=SyncStatusResponse)
async def sync_status(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get current sync status for the user."""
    order_count = db.query(Order).filter(Order.user_id == current_user.id).count()

    return SyncStatusResponse(
        status="complete",
        emails_processed=order_count,
        orders_created=order_count,
        errors=[]
    )
