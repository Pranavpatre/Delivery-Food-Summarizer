import SwiftUI
import GoogleSignInSwift

struct LoginView: View {
    @Environment(AuthService.self) var authService

    var body: some View {
        ZStack {
            // Background gradient
            LinearGradient(
                gradient: Gradient(colors: [Color.orange.opacity(0.1), Color.orange.opacity(0.2)]),
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )
            .ignoresSafeArea()

            VStack(spacing: 32) {
                Spacer()

                // Logo and title
                VStack(spacing: 16) {
                    Text("🍽️")
                        .font(.system(size: 80))

                    Text("CalLogs")
                        .font(.largeTitle)
                        .fontWeight(.bold)
                        .foregroundColor(.primary)

                    Text("Track calories from your food orders automatically")
                        .font(.subheadline)
                        .foregroundColor(.secondary)
                        .multilineTextAlignment(.center)
                        .padding(.horizontal, 32)
                }

                Spacer()

                // Features list
                VStack(alignment: .leading, spacing: 12) {
                    FeatureRow(icon: "envelope.fill", text: "Scans your food order emails")
                    FeatureRow(icon: "flame.fill", text: "Calculates calories for each dish")
                    FeatureRow(icon: "calendar", text: "Shows daily intake on a calendar")
                }
                .padding(.horizontal, 32)

                Spacer()

                // Sign in button
                VStack(spacing: 16) {
                    Button(action: {
                        Task {
                            await authService.signInWithGoogle()
                        }
                    }) {
                        HStack(spacing: 12) {
                            Image(systemName: "g.circle.fill")
                                .font(.title2)
                            Text("Sign in with Google")
                                .fontWeight(.semibold)
                        }
                        .frame(maxWidth: .infinity)
                        .padding()
                        .background(Color.orange)
                        .foregroundColor(.white)
                        .cornerRadius(12)
                    }
                    .disabled(authService.isLoading)

                    if authService.isLoading {
                        ProgressView()
                    }

                    if let error = authService.error {
                        Text(error)
                            .font(.caption)
                            .foregroundColor(.red)
                            .multilineTextAlignment(.center)
                    }

                    Text("We only read food order emails.\nYour data stays private.")
                        .font(.caption)
                        .foregroundColor(.secondary)
                        .multilineTextAlignment(.center)
                }
                .padding(.horizontal, 32)
                .padding(.bottom, 48)
            }
        }
    }
}

struct FeatureRow: View {
    let icon: String
    let text: String

    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: icon)
                .foregroundColor(.orange)
                .frame(width: 24)
            Text(text)
                .font(.subheadline)
                .foregroundColor(.secondary)
        }
    }
}

#Preview {
    LoginView()
        .environment(AuthService.shared)
}
