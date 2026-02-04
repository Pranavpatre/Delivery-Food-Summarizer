import SwiftUI

struct DayCellView: View {
    let date: Date
    let day: Int
    let data: CalendarDayData?
    let isToday: Bool
    let onTap: () -> Void

    private var hasOrders: Bool {
        guard let data = data else { return false }
        return !data.orders.isEmpty
    }

    private var dishes: [Dish] {
        data?.orders.flatMap { $0.dishes } ?? []
    }

    var body: some View {
        Button(action: onTap) {
            VStack(alignment: .leading, spacing: 2) {
                // Day number
                HStack {
                    Text("\(day)")
                        .font(.caption)
                        .fontWeight(isToday ? .bold : .medium)
                        .foregroundColor(isToday ? .orange : .primary)
                    Spacer()
                }

                if hasOrders {
                    // Show first dish
                    if let firstDish = dishes.first {
                        Text(firstDish.name)
                            .font(.system(size: 9))
                            .lineLimit(1)
                            .foregroundColor(firstDish.isEstimated ? .orange : .green)
                    }

                    // Show more indicator
                    if dishes.count > 1 {
                        Text("+\(dishes.count - 1) more")
                            .font(.system(size: 8))
                            .foregroundColor(.secondary)
                    }

                    Spacer()

                    // Calorie total
                    HStack(spacing: 2) {
                        Text("\(Int(data?.totalCalories ?? 0))")
                            .font(.system(size: 10, weight: .semibold))
                        Text("kcal")
                            .font(.system(size: 8))
                    }
                    .foregroundColor(data?.hasEstimates == true ? .orange : .green)
                } else {
                    Spacer()
                }
            }
            .padding(6)
            .frame(height: 80)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(
                RoundedRectangle(cornerRadius: 8)
                    .fill(backgroundColor)
            )
            .overlay(
                RoundedRectangle(cornerRadius: 8)
                    .stroke(isToday ? Color.orange : Color.clear, lineWidth: 2)
            )
        }
        .buttonStyle(.plain)
    }

    private var backgroundColor: Color {
        if hasOrders {
            if data?.hasEstimates == true {
                return Color.orange.opacity(0.1)
            } else {
                return Color.green.opacity(0.1)
            }
        }
        return Color(.systemGray6)
    }
}

struct DayDetailView: View {
    let date: Date
    let data: CalendarDayData
    @Environment(\.dismiss) var dismiss

    private var dateFormatter: DateFormatter {
        let formatter = DateFormatter()
        formatter.dateFormat = "EEEE, MMMM d"
        return formatter
    }

    var body: some View {
        NavigationStack {
            List {
                // Summary section
                Section {
                    HStack {
                        Text("Total Calories")
                        Spacer()
                        Text("\(Int(data.totalCalories)) kcal")
                            .fontWeight(.semibold)
                            .foregroundColor(data.hasEstimates ? .orange : .green)
                    }

                    if data.hasEstimates {
                        HStack {
                            Image(systemName: "info.circle")
                                .foregroundColor(.orange)
                            Text("Some values are estimated")
                                .font(.caption)
                                .foregroundColor(.secondary)
                        }
                    }
                }

                // Orders section
                ForEach(data.orders) { order in
                    Section(header: Text(order.restaurantName)) {
                        ForEach(order.dishes) { dish in
                            HStack {
                                VStack(alignment: .leading, spacing: 2) {
                                    HStack(spacing: 4) {
                                        if dish.quantity > 1 {
                                            Text("\(dish.quantity)x")
                                                .font(.caption)
                                                .foregroundColor(.secondary)
                                        }
                                        Text(dish.name)
                                    }

                                    if dish.isEstimated {
                                        Text("Estimated")
                                            .font(.caption2)
                                            .foregroundColor(.orange)
                                    }
                                }

                                Spacer()

                                if let calories = dish.calories {
                                    Text("\(Int(calories)) kcal")
                                        .font(.subheadline)
                                        .foregroundColor(dish.isEstimated ? .orange : .green)
                                } else {
                                    Text("-")
                                        .foregroundColor(.secondary)
                                }
                            }
                        }
                    }
                }
            }
            .navigationTitle(dateFormatter.string(from: date))
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

#Preview {
    DayCellView(
        date: Date(),
        day: 15,
        data: CalendarDayData(
            orders: [],
            totalCalories: 520,
            hasEstimates: false
        ),
        isToday: true,
        onTap: {}
    )
    .frame(width: 50)
}
