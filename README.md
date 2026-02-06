# Bitewise

Native iOS app that automatically tracks calories from your Swiggy food orders by scanning your Gmail inbox and displaying the data on a calendar view.

## Features

- **Native Google Sign-In**: Seamless popup for Gmail access - no manual token sharing
- **Smart Filtering**: Automatically excludes Instamart/grocery orders
- **Calorie Lookup**: Web search + Claude AI for accurate calorie estimation
- **Calendar View**: Monthly calendar showing daily calorie intake
- **Visual Indicators**: Distinguish between verified and estimated calories

## Architecture

```
┌─────────────────┐         ┌─────────────────┐
│   iOS App       │         │   Backend       │
│   (SwiftUI)     │ ──────▶ │   (FastAPI)     │
│                 │         │                 │
│ • Google Sign-In│         │ • Gmail API     │
│ • Calendar UI   │         │ • Email Parser  │
│ • API Client    │         │ • Calorie Lookup│
└─────────────────┘         └─────────────────┘
```

## Quick Start

### Prerequisites

- **iOS App**: Xcode 15+, macOS Sonoma
- **Backend**: Python 3.11+
- **APIs**: Google Cloud project, Anthropic API key

### 1. Backend Setup

```bash
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
# Edit .env with your API keys
```

### 2. Google Cloud Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a project and enable **Gmail API**
3. Create **two OAuth Client IDs**:
   - **iOS**: For the mobile app (enter your Bundle ID: `com.yourname.Bitewise`)
   - **Web**: For backend token verification
4. Note both Client IDs

### 3. Configure

**Backend** (`.env`):
```env
GOOGLE_CLIENT_ID=your_ios_client_id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your_web_client_secret
ANTHROPIC_API_KEY=your_anthropic_key
SECRET_KEY=generate_with_openssl_rand_hex_32
```

**iOS** (`ios/Bitewise/Bitewise/Services/Config.swift`):
```swift
static let googleClientID = "your_ios_client_id.apps.googleusercontent.com"
```

### 4. Run

```bash
# Backend
cd backend
uvicorn app.main:app --reload --host 0.0.0.0

# iOS - Open in Xcode and run
```

## iOS App Setup

See [ios/README.md](ios/README.md) for detailed iOS setup instructions including:
- Creating the Xcode project
- Adding Google Sign-In SDK
- Configuring Info.plist
- Running on simulator/device

## Project Structure

```
├── backend/
│   ├── app/
│   │   ├── main.py              # FastAPI entry point
│   │   ├── routers/
│   │   │   ├── auth.py          # Mobile token exchange
│   │   │   ├── sync.py          # Email sync
│   │   │   └── calendar.py      # Calendar API
│   │   └── services/
│   │       ├── gmail.py         # Gmail API client
│   │       ├── email_parser.py  # Bill extraction
│   │       ├── instamart_filter.py
│   │       └── calorie_lookup.py
│   └── requirements.txt
└── ios/
    └── Bitewise/
        └── Bitewise/
            ├── Views/           # SwiftUI views
            ├── Models/          # Data models
            └── Services/        # Auth & API client
```

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/auth/google/mobile` | POST | Exchange Google tokens for JWT |
| `/auth/me` | GET | Current user info |
| `/api/sync` | POST | Trigger email sync |
| `/api/calendar/{year}/{month}` | GET | Calendar data |
| `/api/orders` | GET | All orders (paginated) |

## User Flow

1. **Open App** → Login screen appears
2. **Tap "Sign in with Google"** → Native Google Sign-In popup
3. **Grant Gmail Access** → User approves read-only Gmail scope
4. **Calendar Loads** → Shows any synced orders
5. **Tap Sync** → Fetches new Swiggy emails, calculates calories
6. **View Calendar** → Tap any day to see order details

## How It Works

1. **Auth**: iOS app uses Google Sign-In SDK → popup consent → tokens sent to backend
2. **Email Ingestion**: Backend fetches emails from `noreply@swiggy.in` since Dec 1, 2025
3. **Instamart Filter**: Excludes grocery/essentials orders
4. **Bill Parsing**: Extracts dishes using BeautifulSoup + Claude fallback
5. **Calorie Resolution**: Web search for data, Claude estimation as fallback
6. **Calendar Display**: iOS app shows monthly view with daily totals

## License

MIT
