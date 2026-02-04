# CalLogs - iOS App

Native SwiftUI app with Google Sign-In for seamless Gmail access.

## Setup Instructions

### 1. Prerequisites

- Xcode 15+ (for iOS 17 support)
- macOS Sonoma or later
- Apple Developer account (for device testing)

### 2. Google Cloud Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project (or use existing)
3. Enable the **Gmail API**
4. Go to **APIs & Services → Credentials**
5. Click **Create Credentials → OAuth client ID**
6. Select **iOS** as application type
7. Enter your Bundle ID: `com.yourname.CalLogs`
8. Note the **Client ID**

### 3. Create Xcode Project

1. Open Xcode
2. **File → New → Project**
3. Select **iOS → App**
4. Configure:
   - Product Name: `CalLogs`
   - Organization Identifier: `com.yourname`
   - Interface: **SwiftUI**
   - Language: **Swift**
5. Click **Next** → Choose location → **Create**

### 4. Add Google Sign-In Package

1. **File → Add Package Dependencies**
2. Enter: `https://github.com/google/GoogleSignIn-iOS`
3. Click **Add Package**
4. Check both `GoogleSignIn` and `GoogleSignInSwift`
5. Click **Add Package**

### 5. Copy Source Files

1. Delete Xcode's default `ContentView.swift`
2. Drag these folders from `CalLogs/CalLogs/` into Xcode:
   - `Views/`
   - `Models/`
   - `Services/`
   - `CalLogsApp.swift`
3. Select **"Copy items if needed"**

### 6. Configure Info.plist

In Xcode: Click project → Target → **Info** tab → Add:

| Key | Type | Value |
|-----|------|-------|
| `GIDClientID` | String | `YOUR_CLIENT_ID.apps.googleusercontent.com` |

Add URL Types:
1. Click **+** under "URL Types"
2. URL Schemes: `com.googleusercontent.apps.YOUR_CLIENT_ID`

### 7. Update Config.swift

Open `Services/Config.swift`:
```swift
static let googleClientID = "YOUR_CLIENT_ID.apps.googleusercontent.com"
```

### 8. Run the Backend

```bash
cd ../backend
source venv/bin/activate
uvicorn app.main:app --reload --host 0.0.0.0
```

### 9. Run the App

1. Select an iOS Simulator (e.g., iPhone 15 Pro)
2. Press **⌘R**

## Project Structure

```
CalLogs/
├── CalLogsApp.swift                # App entry point
├── Models/
│   └── Models.swift                # Data models
├── Services/
│   ├── Config.swift                # API URL, Client ID
│   ├── AuthService.swift           # Google Sign-In
│   └── APIClient.swift             # Backend API calls
└── Views/
    ├── ContentView.swift           # Root view
    ├── LoginView.swift             # Sign-in screen
    ├── MainView.swift              # Main container
    ├── CalendarView.swift          # Monthly calendar
    └── DayCellView.swift           # Day cells
```

## Troubleshooting

### "Invalid Client ID"
- Verify Client ID in `Config.swift` matches Google Cloud Console
- Bundle ID must match what you registered

### Network Error on Simulator
- Backend must run with `--host 0.0.0.0`
- `apiBaseURL` should be `http://localhost:8000`

### Network Error on Device
- Update `apiBaseURL` to your Mac's IP: `http://192.168.x.x:8000`
- Mac and iPhone must be on same WiFi
