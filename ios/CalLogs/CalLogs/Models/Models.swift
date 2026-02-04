import Foundation

// MARK: - API Response Models

struct Dish: Codable, Identifiable {
    let id: Int
    let name: String
    let quantity: Int
    let calories: Double?
    let isEstimated: Bool

    enum CodingKeys: String, CodingKey {
        case id, name, quantity, calories
        case isEstimated = "is_estimated"
    }
}

struct Order: Codable, Identifiable {
    let id: Int
    let emailId: String
    let orderDate: Date
    let restaurantName: String
    let totalCalories: Double?
    let hasEstimates: Bool
    let dishes: [Dish]

    enum CodingKeys: String, CodingKey {
        case id
        case emailId = "email_id"
        case orderDate = "order_date"
        case restaurantName = "restaurant_name"
        case totalCalories = "total_calories"
        case hasEstimates = "has_estimates"
        case dishes
    }
}

struct CalendarDayData: Codable {
    let orders: [Order]
    let totalCalories: Double
    let hasEstimates: Bool

    enum CodingKeys: String, CodingKey {
        case orders
        case totalCalories = "total_calories"
        case hasEstimates = "has_estimates"
    }
}

struct CalendarMonthResponse: Codable {
    let year: Int
    let month: Int
    let days: [String: CalendarDayData]
}

struct User: Codable {
    let id: Int
    let email: String
    let createdAt: Date

    enum CodingKeys: String, CodingKey {
        case id, email
        case createdAt = "created_at"
    }
}

struct TokenResponse: Codable {
    let accessToken: String
    let tokenType: String

    enum CodingKeys: String, CodingKey {
        case accessToken = "access_token"
        case tokenType = "token_type"
    }
}

struct SyncStatusResponse: Codable {
    let status: String
    let emailsProcessed: Int
    let ordersCreated: Int
    let errors: [String]

    enum CodingKeys: String, CodingKey {
        case status
        case emailsProcessed = "emails_processed"
        case ordersCreated = "orders_created"
        case errors
    }
}

// MARK: - Auth Request

struct MobileAuthRequest: Codable {
    let idToken: String
    let accessToken: String
    let refreshToken: String?

    enum CodingKeys: String, CodingKey {
        case idToken = "id_token"
        case accessToken = "access_token"
        case refreshToken = "refresh_token"
    }
}
