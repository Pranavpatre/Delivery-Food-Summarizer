import Foundation

@MainActor
class APIClient {
    static let shared = APIClient()

    private let baseURL = Config.apiBaseURL
    private let decoder: JSONDecoder

    private init() {
        decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
    }

    private var authToken: String? {
        AuthService.shared.token
    }

    // MARK: - Generic Request

    private func makeRequest<T: Decodable>(
        endpoint: String,
        method: String = "GET",
        body: Data? = nil
    ) async throws -> T {
        guard let url = URL(string: "\(baseURL)\(endpoint)") else {
            throw APIError.invalidURL
        }

        var request = URLRequest(url: url)
        request.httpMethod = method
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")

        if let token = authToken {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }

        if let body = body {
            request.httpBody = body
        }

        let (data, response) = try await URLSession.shared.data(for: request)

        guard let httpResponse = response as? HTTPURLResponse else {
            throw APIError.invalidResponse
        }

        if httpResponse.statusCode == 401 {
            // Token expired - sign out
            AuthService.shared.signOut()
            throw APIError.unauthorized
        }

        guard (200...299).contains(httpResponse.statusCode) else {
            throw APIError.serverError(httpResponse.statusCode)
        }

        return try decoder.decode(T.self, from: data)
    }

    // MARK: - Calendar API

    func getCalendarMonth(year: Int, month: Int) async throws -> CalendarMonthResponse {
        try await makeRequest(endpoint: "/api/calendar/\(year)/\(month)")
    }

    // MARK: - Sync API

    func triggerSync() async throws -> SyncStatusResponse {
        try await makeRequest(endpoint: "/api/sync", method: "POST")
    }

    func getSyncStatus() async throws -> SyncStatusResponse {
        try await makeRequest(endpoint: "/api/sync/status")
    }

    // MARK: - User API

    func getCurrentUser() async throws -> User {
        try await makeRequest(endpoint: "/auth/me")
    }
}

// MARK: - API Errors

enum APIError: LocalizedError {
    case invalidURL
    case invalidResponse
    case unauthorized
    case serverError(Int)

    var errorDescription: String? {
        switch self {
        case .invalidURL:
            return "Invalid URL"
        case .invalidResponse:
            return "Invalid response from server"
        case .unauthorized:
            return "Session expired. Please sign in again."
        case .serverError(let code):
            return "Server error (code: \(code))"
        }
    }
}
