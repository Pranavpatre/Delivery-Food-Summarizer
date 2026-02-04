import SwiftUI
import GoogleSignIn

@main
struct CalLogsApp: App {
    @State private var authService = AuthService.shared

    var body: some Scene {
        WindowGroup {
            ContentView()
                .environment(authService)
                .onOpenURL { url in
                    GIDSignIn.sharedInstance.handle(url)
                }
        }
    }
}
