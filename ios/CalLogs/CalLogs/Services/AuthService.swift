import Foundation
import SwiftUI
import GoogleSignIn
import GoogleSignInSwift

@Observable
@MainActor
class AuthService {
    static let shared = AuthService()

    var isAuthenticated = false
    var isLoading = false
    var userEmail: String?
    var error: String?

    private var authToken: String? {
        didSet {
            isAuthenticated = authToken != nil
            if let token = authToken {
                UserDefaults.standard.set(token, forKey: Config.authTokenKey)
            } else {
                UserDefaults.standard.removeObject(forKey: Config.authTokenKey)
            }
        }
    }

    var token: String? { authToken }

    private init() {
        // Restore auth state
        if let savedToken = UserDefaults.standard.string(forKey: Config.authTokenKey) {
            self.authToken = savedToken
            self.isAuthenticated = true
            self.userEmail = UserDefaults.standard.string(forKey: Config.userEmailKey)
        }

        // Configure Google Sign-In
        configureGoogleSignIn()
    }

    private func configureGoogleSignIn() {
        guard let clientID = Bundle.main.object(forInfoDictionaryKey: "GIDClientID") as? String else {
            // Fallback to config if not in Info.plist
            GIDSignIn.sharedInstance.configuration = GIDConfiguration(clientID: Config.googleClientID)
            return
        }
        GIDSignIn.sharedInstance.configuration = GIDConfiguration(clientID: clientID)
    }

    /// Sign in with Google - presents the native Google Sign-In popup
    func signInWithGoogle() async {
        isLoading = true
        error = nil

        guard let windowScene = UIApplication.shared.connectedScenes.first as? UIWindowScene,
              let rootViewController = windowScene.windows.first?.rootViewController else {
            error = "Unable to get root view controller"
            isLoading = false
            return
        }

        do {
            // Request Gmail read scope along with basic profile
            let result = try await GIDSignIn.sharedInstance.signIn(
                withPresenting: rootViewController,
                hint: nil,
                additionalScopes: Config.googleScopes
            )

            guard let idToken = result.user.idToken?.tokenString else {
                throw AuthError.missingToken
            }

            let accessToken = result.user.accessToken.tokenString
            let refreshToken = result.user.refreshToken.tokenString

            // Exchange Google tokens for our backend JWT
            try await exchangeTokenWithBackend(
                idToken: idToken,
                accessToken: accessToken,
                refreshToken: refreshToken
            )

            // Save user email
            if let email = result.user.profile?.email {
                self.userEmail = email
                UserDefaults.standard.set(email, forKey: Config.userEmailKey)
            }

        } catch let error as AuthError {
            self.error = error.localizedDescription
        } catch {
            self.error = error.localizedDescription
        }

        isLoading = false
    }

    /// Exchange Google tokens with our backend
    private func exchangeTokenWithBackend(idToken: String, accessToken: String, refreshToken: String?) async throws {
        let url = URL(string: "\(Config.apiBaseURL)/auth/google/mobile")!
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")

        let authRequest = MobileAuthRequest(
            idToken: idToken,
            accessToken: accessToken,
            refreshToken: refreshToken
        )

        request.httpBody = try JSONEncoder().encode(authRequest)

        let (data, response) = try await URLSession.shared.data(for: request)

        guard let httpResponse = response as? HTTPURLResponse else {
            throw AuthError.invalidResponse
        }

        guard httpResponse.statusCode == 200 else {
            if let errorBody = String(data: data, encoding: .utf8) {
                throw AuthError.serverError(errorBody)
            }
            throw AuthError.serverError("Status code: \(httpResponse.statusCode)")
        }

        let tokenResponse = try JSONDecoder().decode(TokenResponse.self, from: data)
        self.authToken = tokenResponse.accessToken
    }

    /// Sign out
    func signOut() {
        GIDSignIn.sharedInstance.signOut()
        authToken = nil
        userEmail = nil
        UserDefaults.standard.removeObject(forKey: Config.userEmailKey)
    }

    /// Restore previous sign-in if available
    func restorePreviousSignIn() async {
        isLoading = true

        do {
            let user = try await GIDSignIn.sharedInstance.restorePreviousSignIn()

            // Refresh tokens if needed
            try await user.refreshTokensIfNeeded()

            if let idToken = user.idToken?.tokenString {
                try await exchangeTokenWithBackend(
                    idToken: idToken,
                    accessToken: user.accessToken.tokenString,
                    refreshToken: user.refreshToken.tokenString
                )

                if let email = user.profile?.email {
                    self.userEmail = email
                    UserDefaults.standard.set(email, forKey: Config.userEmailKey)
                }
            }
        } catch {
            // Silent fail - user needs to sign in again
            print("Could not restore sign-in: \(error)")
        }

        isLoading = false
    }
}

// MARK: - Auth Errors

enum AuthError: LocalizedError {
    case missingToken
    case invalidResponse
    case serverError(String)

    var errorDescription: String? {
        switch self {
        case .missingToken:
            return "Google Sign-In did not return required tokens"
        case .invalidResponse:
            return "Invalid response from server"
        case .serverError(let message):
            return "Server error: \(message)"
        }
    }
}
