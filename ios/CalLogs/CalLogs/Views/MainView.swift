import SwiftUI

struct MainView: View {
    @Environment(AuthService.self) var authService
    @State private var viewModel = CalendarViewModel()
    @State private var showingProfile = false

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                // Legend
                LegendView()
                    .padding(.horizontal)
                    .padding(.top, 8)

                // Calendar
                CalendarView(viewModel: viewModel)
                    .padding(.top, 8)
            }
            .navigationTitle("CalLogs")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarLeading) {
                    Button(action: { showingProfile = true }) {
                        Image(systemName: "person.circle")
                    }
                }

                ToolbarItem(placement: .navigationBarTrailing) {
                    Button(action: {
                        Task {
                            await viewModel.syncEmails()
                        }
                    }) {
                        if viewModel.isSyncing {
                            ProgressView()
                        } else {
                            Image(systemName: "arrow.clockwise")
                        }
                    }
                    .disabled(viewModel.isSyncing)
                }
            }
            .sheet(isPresented: $showingProfile) {
                ProfileView()
            }
        }
        .task {
            await viewModel.loadCurrentMonth()
        }
    }
}

struct ProfileView: View {
    @Environment(AuthService.self) var authService
    @Environment(\.dismiss) var dismiss

    var body: some View {
        NavigationStack {
            List {
                Section {
                    if let email = authService.userEmail {
                        HStack {
                            Image(systemName: "envelope.fill")
                                .foregroundColor(.orange)
                            Text(email)
                        }
                    }
                }

                Section {
                    Button(role: .destructive) {
                        authService.signOut()
                        dismiss()
                    } label: {
                        HStack {
                            Image(systemName: "rectangle.portrait.and.arrow.right")
                            Text("Sign Out")
                        }
                    }
                }
            }
            .navigationTitle("Profile")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button("Done") {
                        dismiss()
                    }
                }
            }
        }
    }
}

struct LegendView: View {
    var body: some View {
        HStack(spacing: 16) {
            HStack(spacing: 6) {
                Circle()
                    .fill(Color.green.opacity(0.3))
                    .frame(width: 12, height: 12)
                Text("Verified")
                    .font(.caption)
                    .foregroundColor(.secondary)
            }

            HStack(spacing: 6) {
                Circle()
                    .fill(Color.orange.opacity(0.3))
                    .frame(width: 12, height: 12)
                Text("Estimated")
                    .font(.caption)
                    .foregroundColor(.secondary)
            }

            Spacer()

            Text("Tap day for details")
                .font(.caption2)
                .foregroundColor(.secondary)
        }
        .padding(.vertical, 8)
        .padding(.horizontal, 12)
        .background(Color(.systemGray6))
        .cornerRadius(8)
    }
}

#Preview {
    MainView()
        .environment(AuthService.shared)
}
