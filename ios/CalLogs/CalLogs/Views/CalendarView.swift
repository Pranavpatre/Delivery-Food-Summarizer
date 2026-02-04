import SwiftUI

@Observable
@MainActor
class CalendarViewModel {
    var currentDate = Date()
    var calendarData: CalendarMonthResponse?
    var isLoading = false
    var isSyncing = false
    var error: String?
    var selectedDay: DayInfo?

    private let apiClient = APIClient.shared
    private let calendar = Calendar.current

    var year: Int {
        calendar.component(.year, from: currentDate)
    }

    var month: Int {
        calendar.component(.month, from: currentDate)
    }

    var monthTitle: String {
        let formatter = DateFormatter()
        formatter.dateFormat = "MMMM yyyy"
        return formatter.string(from: currentDate)
    }

    var monthlyTotal: Double {
        calendarData?.days.values.reduce(0) { $0 + $1.totalCalories } ?? 0
    }

    var hasAnyEstimates: Bool {
        calendarData?.days.values.contains { $0.hasEstimates } ?? false
    }

    func loadCurrentMonth() async {
        isLoading = true
        error = nil

        do {
            calendarData = try await apiClient.getCalendarMonth(year: year, month: month)
        } catch {
            self.error = error.localizedDescription
        }

        isLoading = false
    }

    func previousMonth() {
        if let newDate = calendar.date(byAdding: .month, value: -1, to: currentDate) {
            currentDate = newDate
            Task {
                await loadCurrentMonth()
            }
        }
    }

    func nextMonth() {
        if let newDate = calendar.date(byAdding: .month, value: 1, to: currentDate) {
            currentDate = newDate
            Task {
                await loadCurrentMonth()
            }
        }
    }

    func goToToday() {
        currentDate = Date()
        Task {
            await loadCurrentMonth()
        }
    }

    func syncEmails() async {
        isSyncing = true
        do {
            _ = try await apiClient.triggerSync()
            // Wait a bit for sync to process
            try await Task.sleep(nanoseconds: 3_000_000_000)
            await loadCurrentMonth()
        } catch {
            self.error = error.localizedDescription
        }
        isSyncing = false
    }

    func dataForDay(_ day: Int) -> CalendarDayData? {
        calendarData?.days[String(day)]
    }
}

struct DayInfo: Identifiable {
    let id = UUID()
    let date: Date
    let data: CalendarDayData
}

struct CalendarView: View {
    @Bindable var viewModel: CalendarViewModel
    private let calendar = Calendar.current
    private let weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]

    var body: some View {
        VStack(spacing: 0) {
            // Header with month navigation
            CalendarHeader(viewModel: viewModel)

            // Weekday labels
            HStack(spacing: 0) {
                ForEach(weekdays, id: \.self) { day in
                    Text(day)
                        .font(.caption)
                        .fontWeight(.medium)
                        .foregroundColor(.secondary)
                        .frame(maxWidth: .infinity)
                }
            }
            .padding(.vertical, 8)

            // Calendar grid
            if viewModel.isLoading {
                Spacer()
                ProgressView()
                Spacer()
            } else if let error = viewModel.error {
                Spacer()
                VStack(spacing: 8) {
                    Image(systemName: "exclamationmark.triangle")
                        .font(.largeTitle)
                        .foregroundColor(.orange)
                    Text(error)
                        .font(.caption)
                        .foregroundColor(.secondary)
                        .multilineTextAlignment(.center)
                    Button("Retry") {
                        Task {
                            await viewModel.loadCurrentMonth()
                        }
                    }
                    .buttonStyle(.bordered)
                }
                .padding()
                Spacer()
            } else {
                CalendarGrid(viewModel: viewModel)
            }
        }
        .sheet(item: $viewModel.selectedDay) { dayInfo in
            DayDetailView(date: dayInfo.date, data: dayInfo.data)
        }
    }
}

struct CalendarHeader: View {
    @Bindable var viewModel: CalendarViewModel

    var body: some View {
        VStack(spacing: 8) {
            HStack {
                Button(action: viewModel.previousMonth) {
                    Image(systemName: "chevron.left")
                        .font(.title3)
                        .foregroundColor(.orange)
                }

                Spacer()

                VStack(spacing: 2) {
                    Text(viewModel.monthTitle)
                        .font(.title2)
                        .fontWeight(.bold)

                    HStack(spacing: 4) {
                        Text("\(Int(viewModel.monthlyTotal).formatted()) kcal")
                            .font(.caption)
                            .foregroundColor(.secondary)

                        if viewModel.hasAnyEstimates {
                            Text("(includes estimates)")
                                .font(.caption2)
                                .foregroundColor(.orange)
                        }
                    }
                }

                Spacer()

                Button(action: viewModel.nextMonth) {
                    Image(systemName: "chevron.right")
                        .font(.title3)
                        .foregroundColor(.orange)
                }
            }
            .padding(.horizontal)

            Button("Today") {
                viewModel.goToToday()
            }
            .font(.caption)
            .buttonStyle(.bordered)
            .tint(.orange)
        }
        .padding(.vertical, 8)
        .background(Color(.systemBackground))
    }
}

struct CalendarGrid: View {
    @Bindable var viewModel: CalendarViewModel
    private let calendar = Calendar.current
    private let columns = Array(repeating: GridItem(.flexible(), spacing: 4), count: 7)

    var days: [Date?] {
        let firstOfMonth = calendar.date(from: DateComponents(
            year: viewModel.year,
            month: viewModel.month,
            day: 1
        ))!

        let firstWeekday = calendar.component(.weekday, from: firstOfMonth)
        let daysInMonth = calendar.range(of: .day, in: .month, for: firstOfMonth)!.count

        var days: [Date?] = []

        // Empty cells before first day
        for _ in 1..<firstWeekday {
            days.append(nil)
        }

        // Days of month
        for day in 1...daysInMonth {
            if let date = calendar.date(from: DateComponents(
                year: viewModel.year,
                month: viewModel.month,
                day: day
            )) {
                days.append(date)
            }
        }

        // Fill remaining cells
        while days.count % 7 != 0 {
            days.append(nil)
        }

        return days
    }

    var body: some View {
        LazyVGrid(columns: columns, spacing: 4) {
            ForEach(Array(days.enumerated()), id: \.offset) { _, date in
                if let date = date {
                    let day = calendar.component(.day, from: date)
                    let data = viewModel.dataForDay(day)
                    let isToday = calendar.isDateInToday(date)

                    DayCellView(
                        date: date,
                        day: day,
                        data: data,
                        isToday: isToday
                    ) {
                        if let data = data, !data.orders.isEmpty {
                            viewModel.selectedDay = DayInfo(date: date, data: data)
                        }
                    }
                } else {
                    Color.clear
                        .frame(height: 80)
                }
            }
        }
        .padding(.horizontal, 4)
    }
}

#Preview {
    CalendarView(viewModel: CalendarViewModel())
}
