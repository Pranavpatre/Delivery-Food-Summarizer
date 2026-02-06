import { useState, useEffect, useMemo } from 'react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isToday, getDay, subMonths, isBefore } from 'date-fns';
import { calendarApi, syncApi } from '../api/client';
import { useAuth } from '../App';
import type { CalendarMonthResponse, CalendarDayData, Order } from '../types';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const LOOKBACK_MONTHS = 6;

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

  // Calculate date boundaries for navigation (last 6 months only)
  const { canGoPrevious, canGoNext } = useMemo(() => {
    const now = new Date();
    const maxDate = startOfMonth(now);
    const minDate = startOfMonth(subMonths(now, LOOKBACK_MONTHS - 1));
    const currentMonthStart = startOfMonth(currentDate);

    return {
      canGoPrevious: !isBefore(subMonths(currentMonthStart, 1), minDate),
      canGoNext: isBefore(currentMonthStart, maxDate),
    };
  }, [currentDate]);

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
    if (canGoPrevious) {
      setCurrentDate(new Date(year, month - 2, 1));
    }
  };

  const goToNextMonth = () => {
    if (canGoNext) {
      setCurrentDate(new Date(year, month, 1));
    }
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
    <div className="min-h-screen bg-gradient-to-b from-cream via-cream to-sage/30">
      {/* Header */}
      <header className="bg-olive sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {onGoToSummary && (
                <button
                  onClick={onGoToSummary}
                  className="p-1 hover:bg-cream/20 rounded-lg transition-colors"
                  title="Back to Summary"
                >
                  <svg className="w-5 h-5 text-cream" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
              )}
              <span className="text-2xl">🍽️</span>
              <h1 className="font-heading text-xl font-black text-cream">Bitewise</h1>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-sm text-cream/80">{user?.email}</span>
              <button
                onClick={logout}
                className="text-sm text-cream/60 hover:text-cream transition-colors"
              >
                Sign out
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6">
        {/* Monthly Summary Card */}
        <div className="bg-white/60 backdrop-blur border border-sage/30 rounded-xl p-6 mb-6 shadow-sm">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h2 className="text-sm text-olive/60 uppercase tracking-wide">Monthly Summary</h2>
              <p className="text-lg font-semibold text-dark mt-1">
                {format(currentDate, 'MMMM yyyy')}
              </p>
            </div>
            <div className="flex gap-8">
              <div className="text-center">
                <p className="text-2xl font-bold text-orange-500">
                  {calendarData?.monthly_calories?.toLocaleString() || 0}
                </p>
                <p className="text-sm text-olive/60">Total Calories</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-lime">
                  ₹{calendarData?.monthly_price?.toLocaleString() || 0}
                </p>
                <p className="text-sm text-olive/60">Total Spent</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-sage">
                  {Object.keys(calendarData?.days || {}).length}
                </p>
                <p className="text-sm text-olive/60">Days Ordered</p>
              </div>
            </div>
          </div>
        </div>

        {/* Calendar Controls */}
        <div className="bg-white/60 backdrop-blur border border-sage/30 rounded-xl p-4 mb-4 shadow-sm">
          <div className="flex items-center justify-between">
            <button
              onClick={goToPreviousMonth}
              disabled={!canGoPrevious}
              className={`p-2 rounded-lg transition-colors ${
                canGoPrevious
                  ? 'hover:bg-sage/30'
                  : 'opacity-30 cursor-not-allowed'
              }`}
              title={canGoPrevious ? 'Previous month' : 'Limited to last 6 months'}
            >
              <svg className={`w-5 h-5 ${canGoPrevious ? 'text-lime' : 'text-olive/30'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>

            <div className="text-center">
              <h2 className="text-xl font-bold text-dark">
                {format(currentDate, 'MMMM yyyy')}
              </h2>
              <p className="text-xs text-olive/60 mt-1">Daily values in kcal</p>
            </div>

            <button
              onClick={goToNextMonth}
              disabled={!canGoNext}
              className={`p-2 rounded-lg transition-colors ${
                canGoNext
                  ? 'hover:bg-sage/30'
                  : 'opacity-30 cursor-not-allowed'
              }`}
              title={canGoNext ? 'Next month' : 'Cannot go beyond current month'}
            >
              <svg className={`w-5 h-5 ${canGoNext ? 'text-lime' : 'text-olive/30'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>

          <div className="flex justify-center mt-3">
            <button
              onClick={handleSync}
              disabled={isSyncing}
              className="text-sm text-lime hover:text-lime/80 disabled:opacity-50 transition-colors font-medium"
            >
              {isSyncing ? 'Syncing...' : 'Sync Emails'}
            </button>
          </div>
        </div>

        {/* Calendar Grid */}
        <div className="bg-white/60 backdrop-blur border border-sage/30 rounded-xl p-4 shadow-sm">
          {isLoading ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-lime"></div>
            </div>
          ) : error ? (
            <div className="text-center py-12">
              <p className="text-red-600 mb-4">{error}</p>
              <button onClick={loadCalendarData} className="bg-sage/30 text-dark px-4 py-2 rounded-lg hover:bg-sage/50 transition-colors">
                Retry
              </button>
            </div>
          ) : (
            <>
              {/* Weekday headers */}
              <div className="grid grid-cols-7 gap-1 mb-2">
                {WEEKDAYS.map(day => (
                  <div key={day} className="text-center text-xs font-medium text-olive/60 py-2">
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
        <div className="flex justify-center gap-6 mt-4 text-xs text-olive/60">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-lime/20 border border-lime/40"></div>
            <span>Lighter days</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-orange-100 border border-orange-300"></div>
            <span>Moderate</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-red-100 border border-red-300"></div>
            <span>Heavy days</span>
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
      return 'bg-sage/10 border-sage/20';
    }
    const ratio = (calories - minCalories) / (maxCalories - minCalories);
    if (ratio < 0.33) return 'bg-lime/20 border-lime/40';
    if (ratio < 0.66) return 'bg-orange-100 border-orange-300';
    return 'bg-red-100 border-red-300';
  };

  const getCalorieTextColor = () => {
    if (!hasOrders || calories === 0 || maxCalories <= minCalories) {
      return 'text-olive/40';
    }
    const ratio = (calories - minCalories) / (maxCalories - minCalories);
    if (ratio < 0.33) return 'text-lime';
    if (ratio < 0.66) return 'text-orange-500';
    return 'text-red-500';
  };

  return (
    <button
      onClick={onClick}
      disabled={!hasOrders}
      className={`
        aspect-square p-1 rounded-lg border transition-all text-left
        ${getCalorieColor()}
        ${isTodayDate ? 'ring-2 ring-lime' : ''}
        ${hasOrders ? 'cursor-pointer hover:brightness-95' : 'cursor-default'}
        ${!isCurrentMonth ? 'opacity-50' : ''}
      `}
    >
      <div className="h-full flex flex-col">
        <span className={`text-xs font-medium ${isTodayDate ? 'text-lime' : 'text-dark/70'}`}>
          {dayNum}
        </span>
        {hasOrders && (
          <>
            <div className="flex-1 min-h-0">
              <p className="text-[10px] text-olive/60 truncate">
                {dayData.orders[0]?.dishes[0]?.name || dayData.orders[0]?.restaurant_name}
              </p>
              {dayData.orders.length > 1 && (
                <p className="text-[9px] text-olive/40">
                  +{dayData.orders.length - 1} more
                </p>
              )}
            </div>
            <div className="mt-auto">
              <p className={`text-xs font-bold ${getCalorieTextColor()}`}>
                {Math.round(calories).toLocaleString()}
              </p>
              {price > 0 && (
                <p className="text-[9px] text-olive/50">₹{Math.round(price)}</p>
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
    <div className="fixed inset-0 bg-dark/40 flex items-center justify-center p-4 z-50">
      <div className="bg-cream rounded-2xl max-w-lg w-full max-h-[90vh] overflow-hidden border border-sage/30 shadow-xl">
        <div className="sticky top-0 bg-cream border-b border-sage/30 px-6 py-4 flex justify-between items-center">
          <h2 className="text-xl font-bold text-dark">{format(date, 'EEEE, MMMM d')}</h2>
          <button onClick={onClose} className="text-olive hover:text-dark text-xl">
            ✕
          </button>
        </div>

        <div className="p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
          {/* Summary */}
          <div className="bg-sage/20 rounded-lg p-4 mb-6">
            <div className="flex justify-between">
              <div>
                <p className="text-2xl font-bold text-orange-500">
                  {Math.round(data.total_calories).toLocaleString()} kcal
                </p>
                <p className="text-sm text-olive/60">Total Calories</p>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold text-lime">
                  ₹{Math.round(data.total_price).toLocaleString()}
                </p>
                <p className="text-sm text-olive/60">Total Spent</p>
              </div>
            </div>
          </div>

          {/* Orders */}
          {data.orders.map((order) => (
            <OrderCard key={order.id} order={order} />
          ))}
        </div>

        <div className="sticky bottom-0 bg-cream border-t border-sage/30 px-6 py-4">
          <button onClick={onClose} className="w-full bg-olive hover:bg-olive/90 text-cream font-semibold py-3 rounded-xl transition-colors">
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
      <h3 className="font-semibold text-dark mb-2">{order.restaurant_name}</h3>
      <div className="space-y-2">
        {order.dishes.map((dish) => (
          <div key={dish.id} className="flex justify-between items-center text-sm">
            <div className="flex items-center gap-2">
              {dish.quantity > 1 && (
                <span className="text-olive/50">{dish.quantity}x</span>
              )}
              <span className="text-dark/80">{dish.name}</span>
            </div>
            <div className="flex items-center gap-4 text-right">
              {dish.price && (
                <span className="text-olive/60">₹{dish.price}</span>
              )}
              {dish.calories && (
                <span className="text-dark/70 font-medium">
                  {Math.round(dish.calories)} kcal
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
      <div className="mt-2 pt-2 border-t border-sage/30 flex justify-between text-sm font-medium">
        <span className="text-dark">Order Total</span>
        <div className="flex gap-4">
          {order.total_price && (
            <span className="text-lime">₹{Math.round(order.total_price)}</span>
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
