from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session
from google.oauth2 import id_token
from google.auth.transport import requests as google_requests
from jose import jwt
from datetime import datetime, timedelta
from pydantic import BaseModel
from urllib.parse import urlencode
import httpx

from ..config import get_settings
from ..database import get_db
from ..models import User, TokenResponse

router = APIRouter()
settings = get_settings()


def check_email_allowed(email: str):
    """Block sign-in if email is not on the beta allowlist."""
    if not settings.allowed_emails:
        return  # No allowlist configured — allow everyone
    allowed = [e.strip().lower() for e in settings.allowed_emails.split(",") if e.strip()]
    if email.lower() not in allowed:
        raise HTTPException(status_code=403, detail="You're not on the beta access list. Contact the team to request access.")


# Google OAuth URLs
GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v2/userinfo"


class MobileAuthRequest(BaseModel):
    """Request body for mobile Google Sign-In token exchange."""
    id_token: str  # Google ID token from Sign-In SDK
    access_token: str  # Google access token for Gmail API
    refresh_token: str | None = None  # Optional refresh token


def create_access_token(user_id: int, email: str) -> str:
    """Create JWT access token for the user."""
    expire = datetime.utcnow() + timedelta(minutes=settings.access_token_expire_minutes)
    payload = {
        "sub": str(user_id),
        "email": email,
        "exp": expire
    }
    return jwt.encode(payload, settings.secret_key, algorithm=settings.algorithm)


def get_current_user(request: Request, db: Session = Depends(get_db)) -> User:
    """Extract and verify user from JWT token."""
    auth_header = request.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Not authenticated")

    token = auth_header.split(" ")[1]
    try:
        payload = jwt.decode(token, settings.secret_key, algorithms=[settings.algorithm])
        user_id = int(payload.get("sub"))
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid token")

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=401, detail="User not found")

    return user


@router.post("/google/mobile", response_model=TokenResponse)
async def mobile_google_auth(auth_request: MobileAuthRequest, db: Session = Depends(get_db)):
    """
    Exchange Google Sign-In tokens from iOS app for our JWT.

    The iOS app uses Google Sign-In SDK which provides:
    - id_token: JWT containing user info (email, name, etc.)
    - access_token: For accessing Google APIs (Gmail)
    - refresh_token: For refreshing access (if offline access requested)
    """
    try:
        # Verify the Google ID token
        idinfo = id_token.verify_oauth2_token(
            auth_request.id_token,
            google_requests.Request(),
            settings.google_client_id
        )

        # Extract user email from verified token
        email = idinfo.get("email")
        if not email:
            raise HTTPException(status_code=400, detail="Could not get email from Google token")

        # Verify email is verified by Google
        if not idinfo.get("email_verified"):
            raise HTTPException(status_code=400, detail="Email not verified by Google")

        # Beta access check
        check_email_allowed(email)

        # Create or update user
        user = db.query(User).filter(User.email == email).first()
        if not user:
            user = User(email=email)
            db.add(user)

        # Store Google tokens for Gmail API access
        user.google_access_token = auth_request.access_token
        if auth_request.refresh_token:
            user.google_refresh_token = auth_request.refresh_token
        user.updated_at = datetime.utcnow()

        db.commit()
        db.refresh(user)

        # Create our app's JWT token
        access_token = create_access_token(user.id, user.email)

        return TokenResponse(access_token=access_token)

    except ValueError as e:
        # Invalid token
        raise HTTPException(status_code=401, detail=f"Invalid Google token: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Authentication error: {str(e)}")


@router.get("/me")
async def get_current_user_info(current_user: User = Depends(get_current_user)):
    """Get current authenticated user info."""
    return {
        "id": current_user.id,
        "email": current_user.email,
        "created_at": current_user.created_at
    }


@router.post("/logout")
async def logout(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Clear user's Google tokens."""
    current_user.google_access_token = None
    current_user.google_refresh_token = None
    current_user.token_expiry = None
    db.commit()
    return {"message": "Logged out successfully"}


# ============ Web OAuth Flow ============

@router.get("/google/login")
async def google_login():
    """
    Redirect to Google OAuth consent screen for web app.
    """
    params = {
        "client_id": settings.google_client_id,
        "redirect_uri": settings.google_redirect_uri,
        "response_type": "code",
        "scope": "openid email profile https://www.googleapis.com/auth/gmail.readonly",
        "access_type": "offline",
        "prompt": "consent",
    }
    auth_url = f"{GOOGLE_AUTH_URL}?{urlencode(params)}"
    return RedirectResponse(url=auth_url)


@router.get("/google/callback")
async def google_callback(code: str, db: Session = Depends(get_db)):
    """
    Handle Google OAuth callback for web app.
    Exchange authorization code for tokens and create user session.
    """
    try:
        # Exchange code for tokens
        async with httpx.AsyncClient() as client:
            token_response = await client.post(
                GOOGLE_TOKEN_URL,
                data={
                    "client_id": settings.google_client_id,
                    "client_secret": settings.google_client_secret,
                    "code": code,
                    "grant_type": "authorization_code",
                    "redirect_uri": settings.google_redirect_uri,
                },
            )
            token_data = token_response.json()

            if "error" in token_data:
                raise HTTPException(status_code=400, detail=token_data.get("error_description", "Token exchange failed"))

            access_token = token_data["access_token"]
            refresh_token = token_data.get("refresh_token")

            # Get user info from Google
            userinfo_response = await client.get(
                GOOGLE_USERINFO_URL,
                headers={"Authorization": f"Bearer {access_token}"},
            )
            userinfo = userinfo_response.json()

            email = userinfo.get("email")
            if not email:
                raise HTTPException(status_code=400, detail="Could not get email from Google")

        # Beta access check
        check_email_allowed(email)

        # Create or update user
        user = db.query(User).filter(User.email == email).first()
        if not user:
            user = User(email=email)
            db.add(user)

        # Store Google tokens for Gmail API access
        user.google_access_token = access_token
        if refresh_token:
            user.google_refresh_token = refresh_token
        user.updated_at = datetime.utcnow()

        db.commit()
        db.refresh(user)

        # Create our app's JWT token
        app_token = create_access_token(user.id, user.email)

        # Redirect to frontend with token
        frontend_url = settings.frontend_url
        return RedirectResponse(url=f"{frontend_url}?token={app_token}")

    except httpx.HTTPError as e:
        raise HTTPException(status_code=400, detail=f"Failed to communicate with Google: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Authentication error: {str(e)}")
