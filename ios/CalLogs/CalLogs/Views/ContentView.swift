import SwiftUI

struct ContentView: View {
    @Environment(AuthService.self) var authService

    var body: some View {
        Group {
            if authService.isLoading {
                LoadingView()
            } else if authService.isAuthenticated {
                MainView()
            } else {
                LoginView()
            }
        }
        .task {
            await authService.restorePreviousSignIn()
        }
    }
}

struct LoadingView: View {
    var body: some View {
        VStack(spacing: 16) {
            ProgressView()
                .scaleEffect(1.5)
            Text("Loading...")
                .foregroundColor(.secondary)
        }
    }
}

#Preview {
    ContentView()
        .environment(AuthService.shared)
}
