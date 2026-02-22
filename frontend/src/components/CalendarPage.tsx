import { useState, useEffect, useMemo } from 'react';
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameMonth,
  isToday,
  getDay,
  subMonths,
  isBefore,
} from 'date-fns';
import { calendarApi, syncApi } from '../api/client';
import { useAuth } from '../App';
import type { CalendarMonthResponse, CalendarDayData, Order, DailyHealthScore } from '../types';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const LOOKBACK_MONTHS = 6;

interface CalendarPageProps {
  onGoToSummary?: () => void;
}

function CalendarPage({ onGoToSummary }: CalendarPageProps) {
  const { user, logout } = useAuth();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [calendarData, setCalendarData] = useState<CalendarMonthResponse | null>(null);
  const [healthScores, setHealthScores] = useState<Map<string, number>>(new Map());
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedDay, setSelectedDay] = useState<{
    date: Date;
    data: CalendarDayData;
  } | null>(null);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth() + 1;

  // Load health scores from summary on mount
  useEffect(() => {
    const loadHealthScores = async () => {
      try {
        const summary = await calendarApi.getSummary();
        if (summary.daily_health_scores) {
          const scoreMap = new Map<string, number>();
          summary.daily_health_scores.forEach((score: DailyHealthScore) => {
            scoreMap.set(score.date, score.health_index);
          });
          setHealthScores(scoreMap);
        }
      } catch (err) {
        console.error('Failed to load health scores:', err);
      }
    };
    loadHealthScores();
  }, []);

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
      await new Promise(resolve => setTimeout(resolve, 3000));
      await loadCalendarData();
    } catch (err) {
      console.error('Sync failed:', err);
    } finally {
      setIsSyncing(false);
    }
  };

  const goToPreviousMonth = () => {
    if (canGoPrevious) setCurrentDate(new Date(year, month - 2, 1));
  };

  const goToNextMonth = () => {
    if (canGoNext) setCurrentDate(new Date(year, month, 1));
  };

  const getHealthScoreForDate = (date: Date): number | undefined => {
    const dateStr = format(date, 'yyyy-MM-dd');
    return healthScores.get(dateStr);
  };

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });
  const startDayOfWeek = getDay(monthStart);
  const emptyCellsBefore = Array(startDayOfWeek).fill(null);

  const handleDayClick = (date: Date, dayData?: CalendarDayData) => {
    if (!dayData || dayData.orders.length === 0) return;

    // Toggle: click same day to close
    if (
      selectedDay &&
      format(selectedDay.date, 'yyyy-MM-dd') === format(date, 'yyyy-MM-dd')
    ) {
      setSelectedDay(null);
    } else {
      setSelectedDay({ date, data: dayData });
    }
  };

  return (
    <div className="min-h-screen bg-linen">
      {/* Header */}
      <header className="bg-ebony text-linen px-6 py-4 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            {onGoToSummary && (
              <button
                onClick={onGoToSummary}
                className="p-1 hover:bg-linen/10 rounded-lg transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
            )}
            <svg width="36" height="32" viewBox="5 5 150 90" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M15 15 L15 45 Q15 55 20 55 L20 85" stroke="white" strokeWidth="4" strokeLinecap="round"/><path d="M25 15 L25 45 Q25 55 20 55" stroke="white" strokeWidth="4" strokeLinecap="round"/><path d="M20 15 L20 40" stroke="white" strokeWidth="3" strokeLinecap="round"/><circle cx="80" cy="50" r="38" stroke="white" strokeWidth="4"/><circle cx="80" cy="50" r="28" stroke="white" strokeWidth="2.5"/><path d="M65 52 L75 62 L95 40" stroke="#84CC16" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round"/><ellipse cx="140" cy="30" rx="10" ry="20" stroke="white" strokeWidth="4"/><path d="M140 50 L140 85" stroke="white" strokeWidth="4" strokeLinecap="round"/></svg>
            <h1 className="font-heading text-xl font-black">Bitewise</h1>
          </div>
          <div className="flex items-center gap-4 text-sm">
            <span className="text-linen/80">{user?.email}</span>
            <button onClick={logout} className="hover:text-linen/70 transition-colors">
              Sign out
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-8 space-y-6">
        {/* Monthly Summary */}
        <div className="card">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <p className="text-xs text-sage uppercase tracking-wide">Monthly Summary</p>
              <p className="text-lg font-semibold text-ebony mt-1">
                {format(currentDate, 'MMMM yyyy')}
              </p>
            </div>
            <div className="flex gap-8">
              <div className="text-center">
                <p className="metric text-2xl text-amber">
                  {calendarData?.monthly_calories?.toLocaleString() || 0}
                </p>
                <p className="text-xs text-sage">Calories</p>
              </div>
              <div className="text-center">
                <p className="metric text-2xl text-lime">
                  ₹{calendarData?.monthly_price?.toLocaleString() || 0}
                </p>
                <p className="text-xs text-sage">Spent</p>
              </div>
              <div className="text-center">
                <p className="metric text-2xl text-ebony">
                  {Object.keys(calendarData?.days || {}).length}
                </p>
                <p className="text-xs text-sage">Days</p>
              </div>
            </div>
          </div>
        </div>

        {/* Calendar Controls */}
        <div className="card p-4">
          <div className="flex items-center justify-between">
            <button
              onClick={goToPreviousMonth}
              disabled={!canGoPrevious}
              className={`p-2 rounded-lg transition-colors ${
                canGoPrevious ? 'hover:bg-sage/10 text-ebony' : 'opacity-30 cursor-not-allowed'
              }`}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>

            <div className="text-center">
              <h2 className="text-xl font-bold text-ebony">
                {format(currentDate, 'MMMM yyyy')}
              </h2>
              <p className="text-xs text-sage mt-1">Click a day to view details</p>
            </div>

            <button
              onClick={goToNextMonth}
              disabled={!canGoNext}
              className={`p-2 rounded-lg transition-colors ${
                canGoNext ? 'hover:bg-sage/10 text-ebony' : 'opacity-30 cursor-not-allowed'
              }`}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
        <div className="card p-4">
          {isLoading ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-2 border-lime border-t-transparent"></div>
            </div>
          ) : error ? (
            <div className="text-center py-12">
              <p className="text-ebony mb-4">{error}</p>
              <button onClick={loadCalendarData} className="btn-secondary">
                Retry
              </button>
            </div>
          ) : (
            <>
              {/* Weekday headers */}
              <div className="grid grid-cols-7 gap-1 mb-2">
                {WEEKDAYS.map(day => (
                  <div key={day} className="text-center text-xs font-medium text-sage py-2">
                    {day}
                  </div>
                ))}
              </div>

              {/* Calendar days */}
              <div className="grid grid-cols-7 gap-1">
                {emptyCellsBefore.map((_, index) => (
                  <div key={`empty-${index}`} className="aspect-square" />
                ))}

                {daysInMonth.map(date => {
                  const dayNum = date.getDate();
                  const dayData = calendarData?.days[String(dayNum)];
                  const healthScore = getHealthScoreForDate(date);

                  return (
                    <DayCell
                      key={dayNum}
                      date={date}
                      dayData={dayData}
                      isCurrentMonth={isSameMonth(date, currentDate)}
                      isToday={isToday(date)}
                      healthScore={healthScore}
                      isSelected={
                        selectedDay !== null &&
                        format(selectedDay.date, 'yyyy-MM-dd') === format(date, 'yyyy-MM-dd')
                      }
                      onClick={() => handleDayClick(date, dayData)}
                    />
                  );
                })}
              </div>
            </>
          )}
        </div>

        {/* Legend */}
        <div className="flex justify-center gap-6 text-xs text-sage">
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm bg-lime/20 border border-lime/30"></span> Healthy
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm bg-lime/10 border border-lime/20"></span> Good
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm bg-amber/15 border border-amber/20"></span> Fair
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm bg-red-100 border border-red-200"></span> Poor
          </span>
        </div>

        {/* Day Detail Popup */}
        {selectedDay && (
          <div
            className="fixed inset-0 bg-ebony/40 flex items-center justify-center p-4 z-50"
            onClick={() => setSelectedDay(null)}
          >
            <div
              className="bg-linen rounded-2xl max-w-md w-full max-h-[80vh] overflow-y-auto shadow-2xl animate-fade-in"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-6 space-y-4">
                <div className="flex justify-between items-center">
                  <h3 className="text-lg font-semibold text-ebony">
                    {format(selectedDay.date, 'EEEE, MMMM d')}
                  </h3>
                  <button
                    onClick={() => setSelectedDay(null)}
                    className="text-sage hover:text-ebony text-xl transition-colors"
                  >
                    ×
                  </button>
                </div>

                {/* Day Summary */}
                <div className="flex gap-8 pb-4 border-b border-sage/10">
                  <div>
                    <p className="metric text-2xl text-amber">
                      {Math.round(selectedDay.data.total_calories).toLocaleString()}
                    </p>
                    <p className="text-xs text-sage">kcal</p>
                  </div>
                  <div>
                    <p className="metric text-2xl text-lime">
                      ₹{Math.round(selectedDay.data.total_price).toLocaleString()}
                    </p>
                    <p className="text-xs text-sage">spent</p>
                  </div>
                </div>

                {/* Orders */}
                <div className="space-y-4">
                  {selectedDay.data.orders.map(order => (
                    <OrderDetail key={order.id} order={order} />
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

function DayCell({
  date,
  dayData,
  isCurrentMonth,
  isToday: isTodayDate,
  healthScore,
  isSelected,
  onClick,
}: {
  date: Date;
  dayData?: CalendarDayData;
  isCurrentMonth: boolean;
  isToday: boolean;
  healthScore?: number;
  isSelected: boolean;
  onClick: () => void;
}) {
  const dayNum = date.getDate();
  const hasOrders = dayData && dayData.orders.length > 0;
  const calories = dayData?.total_calories || 0;
  const price = dayData?.total_price || 0;

  const getHealthBg = () => {
    if (!hasOrders) return '';
    if (healthScore === undefined) return 'bg-sage/10';
    if (healthScore >= 80) return 'bg-lime/20';
    if (healthScore >= 60) return 'bg-lime/10';
    if (healthScore >= 40) return 'bg-amber/15';
    return 'bg-red-100';
  };

  return (
    <button
      onClick={onClick}
      disabled={!hasOrders}
      className={`
        aspect-square p-1 rounded-xl border transition-all text-left
        ${hasOrders ? `cursor-pointer hover:border-sage/40 border-sage/20 ${getHealthBg()}` : 'border-transparent cursor-default'}
        ${isSelected ? 'ring-2 ring-lime border-lime/30 !bg-lime/20' : ''}
        ${isTodayDate && !isSelected ? 'ring-1 ring-sage/30' : ''}
        ${!isCurrentMonth ? 'opacity-40' : ''}
      `}
    >
      <div className="h-full flex flex-col">
        <span className={`text-xs font-medium ${isTodayDate ? 'text-lime' : hasOrders ? 'text-ebony' : 'text-ebony/40'}`}>
          {dayNum}
        </span>
        {hasOrders && (
          <div className="mt-auto">
            <p className="font-mono text-xs font-bold text-ebony/80">
              {Math.round(calories).toLocaleString()}
            </p>
            {price > 0 && (
              <p className="text-[9px] text-sage font-mono">₹{Math.round(price)}</p>
            )}
          </div>
        )}
      </div>
    </button>
  );
}

function OrderDetail({ order }: { order: Order }) {
  return (
    <div className="border-b border-sage/10 pb-4 last:border-0 last:pb-0">
      <h4 className="font-medium text-ebony mb-2">{order.restaurant_name}</h4>
      <div className="space-y-1.5">
        {order.dishes.map(dish => (
          <div key={dish.id} className="flex justify-between items-center text-sm">
            <div className="flex items-center gap-2">
              {dish.quantity > 1 && (
                <span className="text-sage">{dish.quantity}x</span>
              )}
              <span className="text-ebony/80">{dish.name}</span>
            </div>
            <div className="flex items-center gap-4 text-right font-mono text-xs">
              {dish.price && <span className="text-sage">₹{dish.price}</span>}
              {dish.calories && (
                <span className="text-ebony/70 font-medium">
                  {Math.round(dish.calories)} kcal
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
      <div className="mt-2 pt-2 border-t border-sage/10">
        <div className="flex justify-between text-sm font-medium font-mono">
          <span className="text-ebony">Bill Total</span>
          <div className="flex gap-4">
            {order.total_price && <span className="text-lime">₹{Math.round(order.total_price)}</span>}
            {order.total_calories && (
              <span className="text-amber">{Math.round(order.total_calories)} kcal</span>
            )}
          </div>
        </div>
        <p className="text-[10px] text-sage/60 mt-0.5">After discounts, incl. delivery, taxes & charges</p>
      </div>
    </div>
  );
}

export default CalendarPage;
