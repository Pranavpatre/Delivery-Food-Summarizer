import { useState, useEffect } from 'react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isToday, getDay } from 'date-fns';
import { calendarApi, syncApi } from '../api/client';
import { useAuth } from '../App';
import type { CalendarMonthResponse, CalendarDayData, Order } from '../types';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

interface CalendarPageProps {
  onGoToSummary?: () => void;
}

function CalendarPage({ onGoToSummary }: CalendarPageProps) {
  const { user, logout } = useAuth();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [calendarData, setCalendarData] = useState<CalendarMonthResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedDay, setSelectedDay] = useState<{ date: Date; data: CalendarDayData } | null>(null);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth() + 1;

  useEffect(() => {
    loadCalendarData();
  }, [year, month]);

  const loadCalendarData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await calendarApi.getMonth(year, month);
      setCalendarData(data);
    } catch (err) {
      setError('Failed to load calendar data');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSync = async () => {
    setIsSyncing(true);
    try {
      await syncApi.triggerSync();
      // Wait for sync to process
      await new Promise(resolve => setTimeout(resolve, 3000));
      await loadCalendarData();
    } catch (err) {
      console.error('Sync failed:', err);
    } finally {
      setIsSyncing(false);
    }
  };

  const goToPreviousMonth = () => {
    setCurrentDate(new Date(year, month - 2, 1));
  };

  const goToNextMonth = () => {
    setCurrentDate(new Date(year, month, 1));
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  // Calculate min and max calories for color scaling
  const calorieValues = Object.values(calendarData?.days || {})
    .map(d => d.total_calories)
    .filter(c => c > 0);
  const minCalories = Math.min(...calorieValues, Infinity);
  const maxCalories = Math.max(...calorieValues, 0);

  // Generate calendar days
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });

  // Add empty cells for days before the month starts
  const startDayOfWeek = getDay(monthStart);
  const emptyCellsBefore = Array(startDayOfWeek).fill(null);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {onGoToSummary && (
                <button
                  onClick={onGoToSummary}
                  className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
                  title="Back to Summary"
                >
                  <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
              )}
              <span className="text-2xl">🍽️</span>
              <h1 className="text-xl font-bold text-gray-900">CalLogs</h1>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-sm text-gray-600">{user?.email}</span>
              <button
                onClick={logout}
                className="text-sm text-gray-500 hover:text-gray-700"
              >
                Sign out
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6">
        {/* Monthly Summary Card */}
        <div className="card p-6 mb-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h2 className="text-sm text-gray-500 uppercase tracking-wide">Monthly Summary</h2>
              <p className="text-lg font-semibold text-gray-900 mt-1">
                {format(currentDate, 'MMMM yyyy')}
              </p>
            </div>
            <div className="flex gap-8">
              <div className="text-center">
                <p className="text-2xl font-bold text-orange-500">
                  {calendarData?.monthly_calories?.toLocaleString() || 0}
                </p>
                <p className="text-sm text-gray-500">Total Calories</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-green-600">
                  ₹{calendarData?.monthly_price?.toLocaleString() || 0}
                </p>
                <p className="text-sm text-gray-500">Total Spent</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-blue-600">
                  {Object.keys(calendarData?.days || {}).length}
                </p>
                <p className="text-sm text-gray-500">Days Ordered</p>
              </div>
            </div>
          </div>
        </div>

        {/* Calendar Controls */}
        <div className="card p-4 mb-4">
          <div className="flex items-center justify-between">
            <button
              onClick={goToPreviousMonth}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <svg className="w-5 h-5 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>

            <div className="text-center">
              <h2 className="text-xl font-bold text-gray-900">
                {format(currentDate, 'MMMM yyyy')}
              </h2>
              <p className="text-xs text-gray-500 mt-1">Daily values in kcal</p>
            </div>

            <button
              onClick={goToNextMonth}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <svg className="w-5 h-5 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>

          <div className="flex justify-center mt-3">
            <button
              onClick={handleSync}
              disabled={isSyncing}
              className="text-sm text-orange-600 hover:underline disabled:opacity-50"
            >
              {isSyncing ? 'Syncing...' : 'Sync Emails'}
            </button>
          </div>
        </div>

        {/* Calendar Grid */}
        <div className="card p-4">
          {isLoading ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-orange-500"></div>
            </div>
          ) : error ? (
            <div className="text-center py-12">
              <p className="text-red-500 mb-4">{error}</p>
              <button onClick={loadCalendarData} className="btn-secondary">
                Retry
              </button>
            </div>
          ) : (
            <>
              {/* Weekday headers */}
              <div className="grid grid-cols-7 gap-1 mb-2">
                {WEEKDAYS.map(day => (
                  <div key={day} className="text-center text-xs font-medium text-gray-500 py-2">
                    {day}
                  </div>
                ))}
              </div>

              {/* Calendar days */}
              <div className="grid grid-cols-7 gap-1">
                {/* Empty cells before month start */}
                {emptyCellsBefore.map((_, index) => (
                  <div key={`empty-${index}`} className="aspect-square" />
                ))}

                {/* Actual days */}
                {daysInMonth.map(date => {
                  const dayNum = date.getDate();
                  const dayData = calendarData?.days[String(dayNum)];
                  const hasOrders = dayData && dayData.orders.length > 0;

                  return (
                    <DayCell
                      key={dayNum}
                      date={date}
                      dayData={dayData}
                      isCurrentMonth={isSameMonth(date, currentDate)}
                      isToday={isToday(date)}
                      minCalories={minCalories}
                      maxCalories={maxCalories}
                      onClick={() => {
                        if (hasOrders) {
                          setSelectedDay({ date, data: dayData });
                        }
                      }}
                    />
                  );
                })}
              </div>
            </>
          )}
        </div>

        {/* Legend */}
        <div className="flex justify-center gap-6 mt-4 text-xs text-gray-500">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-green-100 border border-green-300"></div>
            <span>Low calories</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-yellow-100 border border-yellow-300"></div>
            <span>Medium</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-red-100 border border-red-300"></div>
            <span>High calories</span>
          </div>
        </div>
      </main>

      {/* Day Detail Modal */}
      {selectedDay && (
        <DayDetailModal
          date={selectedDay.date}
          data={selectedDay.data}
          onClose={() => setSelectedDay(null)}
        />
      )}
    </div>
  );
}

function DayCell({
  date,
  dayData,
  isCurrentMonth,
  isToday: isTodayDate,
  minCalories,
  maxCalories,
  onClick,
}: {
  date: Date;
  dayData?: CalendarDayData;
  isCurrentMonth: boolean;
  isToday: boolean;
  minCalories: number;
  maxCalories: number;
  onClick: () => void;
}) {
  const dayNum = date.getDate();
  const hasOrders = dayData && dayData.orders.length > 0;
  const calories = dayData?.total_calories || 0;
  const price = dayData?.total_price || 0;

  // Calculate color based on calorie ratio
  const getCalorieColor = () => {
    if (!hasOrders || calories === 0 || maxCalories <= minCalories) {
      return 'bg-gray-50';
    }
    const ratio = (calories - minCalories) / (maxCalories - minCalories);
    if (ratio < 0.33) return 'bg-green-100 border-green-200';
    if (ratio < 0.66) return 'bg-yellow-100 border-yellow-200';
    return 'bg-red-100 border-red-200';
  };

  const getCalorieTextColor = () => {
    if (!hasOrders || calories === 0 || maxCalories <= minCalories) {
      return 'text-gray-400';
    }
    const ratio = (calories - minCalories) / (maxCalories - minCalories);
    if (ratio < 0.33) return 'text-green-700';
    if (ratio < 0.66) return 'text-yellow-700';
    return 'text-red-700';
  };

  return (
    <button
      onClick={onClick}
      disabled={!hasOrders}
      className={`
        aspect-square p-1 rounded-lg border transition-all text-left
        ${getCalorieColor()}
        ${isTodayDate ? 'ring-2 ring-orange-400' : ''}
        ${hasOrders ? 'cursor-pointer hover:shadow-md' : 'cursor-default'}
        ${!isCurrentMonth ? 'opacity-50' : ''}
      `}
    >
      <div className="h-full flex flex-col">
        <span className={`text-xs font-medium ${isTodayDate ? 'text-orange-600' : 'text-gray-700'}`}>
          {dayNum}
        </span>
        {hasOrders && (
          <>
            <div className="flex-1 min-h-0">
              <p className="text-[10px] text-gray-500 truncate">
                {dayData.orders[0]?.dishes[0]?.name || dayData.orders[0]?.restaurant_name}
              </p>
              {dayData.orders.length > 1 && (
                <p className="text-[9px] text-gray-400">
                  +{dayData.orders.length - 1} more
                </p>
              )}
            </div>
            <div className="mt-auto">
              <p className={`text-xs font-bold ${getCalorieTextColor()}`}>
                {Math.round(calories).toLocaleString()}
              </p>
              {price > 0 && (
                <p className="text-[9px] text-gray-500">₹{Math.round(price)}</p>
              )}
            </div>
          </>
        )}
      </div>
    </button>
  );
}

function DayDetailModal({
  date,
  data,
  onClose,
}: {
  date: Date;
  data: CalendarDayData;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl max-w-lg w-full max-h-[90vh] overflow-hidden">
        <div className="sticky top-0 bg-white border-b px-6 py-4 flex justify-between items-center">
          <h2 className="text-xl font-bold">{format(date, 'EEEE, MMMM d')}</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700 text-xl">
            ✕
          </button>
        </div>

        <div className="p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
          {/* Summary */}
          <div className="bg-gray-50 rounded-lg p-4 mb-6">
            <div className="flex justify-between">
              <div>
                <p className="text-2xl font-bold text-orange-500">
                  {Math.round(data.total_calories).toLocaleString()} kcal
                </p>
                <p className="text-sm text-gray-500">Total Calories</p>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold text-green-600">
                  ₹{Math.round(data.total_price).toLocaleString()}
                </p>
                <p className="text-sm text-gray-500">Total Spent</p>
              </div>
            </div>
          </div>

          {/* Orders */}
          {data.orders.map((order) => (
            <OrderCard key={order.id} order={order} />
          ))}
        </div>

        <div className="sticky bottom-0 bg-white border-t px-6 py-4">
          <button onClick={onClose} className="w-full btn-primary">
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

function OrderCard({ order }: { order: Order }) {
  return (
    <div className="mb-4 last:mb-0">
      <h3 className="font-semibold text-gray-900 mb-2">{order.restaurant_name}</h3>
      <div className="space-y-2">
        {order.dishes.map((dish) => (
          <div key={dish.id} className="flex justify-between items-center text-sm">
            <div className="flex items-center gap-2">
              {dish.quantity > 1 && (
                <span className="text-gray-400">{dish.quantity}x</span>
              )}
              <span className="text-gray-700">{dish.name}</span>
            </div>
            <div className="flex items-center gap-4 text-right">
              {dish.price && (
                <span className="text-gray-500">₹{dish.price}</span>
              )}
              {dish.calories && (
                <span className="text-gray-600 font-medium">
                  {Math.round(dish.calories)} kcal
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
      <div className="mt-2 pt-2 border-t flex justify-between text-sm font-medium">
        <span>Order Total</span>
        <div className="flex gap-4">
          {order.total_price && (
            <span className="text-green-600">₹{Math.round(order.total_price)}</span>
          )}
          {order.total_calories && (
            <span className="text-orange-500">{Math.round(order.total_calories)} kcal</span>
          )}
        </div>
      </div>
    </div>
  );
}

export default CalendarPage;
