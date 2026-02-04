import Foundation

enum Config {
    // MARK: - API Configuration

    /// Base URL for the backend API
    /// For simulator: use localhost
    /// For device: use your Mac's local IP (e.g., http://192.168.1.100:8000)
    static let apiBaseURL = "http://localhost:8000"

    // MARK: - Google Sign-In Configuration

    /// Google OAuth Client ID for iOS
    /// Get this from Google Cloud Console -> APIs & Services -> Credentials
    /// Create an OAuth 2.0 Client ID for iOS application
    /// Bundle ID should be: com.yourname.CalLogs
    static let googleClientID = "YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com"

    /// Scopes required for Gmail access
    static let googleScopes = [
        "https://www.googleapis.com/auth/gmail.readonly",
        "https://www.googleapis.com/auth/userinfo.email"
    ]

    // MARK: - Storage Keys

    static let authTokenKey = "auth_token"
    static let userEmailKey = "user_email"
}
