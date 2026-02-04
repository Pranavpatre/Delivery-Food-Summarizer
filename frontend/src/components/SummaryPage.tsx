import { useState, useEffect } from 'react';
import { calendarApi } from '../api/client';
import { useAuth } from '../App';
import type { SummaryResponse } from '../types';

interface SummaryPageProps {
  onGoToCalendar: () => void;
}

function SummaryPage({ onGoToCalendar }: SummaryPageProps) {
  const { user, logout } = useAuth();
  const [summaryData, setSummaryData] = useState<SummaryResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadSummary();
  }, []);

  const loadSummary = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await calendarApi.getSummary();
      setSummaryData(data);
    } catch (err) {
      setError('Failed to load summary data');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 to-amber-50">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
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

      <main className="max-w-4xl mx-auto px-4 py-8">
        {isLoading ? (
          <div className="flex justify-center py-20">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-orange-500"></div>
          </div>
        ) : error ? (
          <div className="text-center py-20">
            <p className="text-red-500 mb-4">{error}</p>
            <button onClick={loadSummary} className="btn-secondary">
              Retry
            </button>
          </div>
        ) : (
          <>
            {/* Title */}
            <div className="text-center mb-8">
              <h2 className="text-3xl font-bold text-gray-900 mb-2">
                Food Delivery Summarized
              </h2>
              <p className="text-gray-500">Your ordering patterns over the last 2 months</p>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              {/* Avg Monthly Spend */}
              <div className="card p-6 text-center">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-green-100 flex items-center justify-center">
                  <span className="text-3xl">💰</span>
                </div>
                <p className="text-4xl font-bold text-green-600 mb-1">
                  ₹{Math.round(summaryData?.avg_monthly_spend || 0).toLocaleString()}
                </p>
                <p className="text-gray-500 font-medium">Avg Monthly Spend</p>
              </div>

              {/* Avg Calories */}
              <div className="card p-6 text-center">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-orange-100 flex items-center justify-center">
                  <span className="text-3xl">🔥</span>
                </div>
                <p className="text-4xl font-bold text-orange-500 mb-1">
                  {Math.round(summaryData?.avg_monthly_calories || 0).toLocaleString()}
                </p>
                <p className="text-gray-500 font-medium">Avg Monthly Calories</p>
              </div>

              {/* Avg Days Ordered */}
              <div className="card p-6 text-center">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-blue-100 flex items-center justify-center">
                  <span className="text-3xl">📅</span>
                </div>
                <p className="text-4xl font-bold text-blue-600 mb-1">
                  {summaryData?.avg_days_ordered?.toFixed(1) || 0}
                </p>
                <p className="text-gray-500 font-medium">Avg Days Ordered</p>
              </div>
            </div>

            {/* Month Breakdown */}
            {summaryData?.months_data && summaryData.months_data.length > 0 && (
              <div className="card p-6 mb-8">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Monthly Breakdown</h3>
                <div className="space-y-4">
                  {summaryData.months_data.map((month) => (
                    <div key={`${month.year}-${month.month_num}`} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                      <div>
                        <p className="font-medium text-gray-900">{month.month}</p>
                        <p className="text-sm text-gray-500">{month.order_count} orders over {month.days_ordered} days</p>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-bold text-green-600">₹{Math.round(month.total_price).toLocaleString()}</p>
                        <p className="text-sm text-orange-500">{Math.round(month.total_calories).toLocaleString()} kcal</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* No Data Message */}
            {(!summaryData?.months_data || summaryData.months_data.every(m => m.order_count === 0)) && (
              <div className="card p-8 text-center mb-8">
                <span className="text-5xl mb-4 block">📭</span>
                <p className="text-gray-600 mb-2">No order data found for the last 2 months</p>
                <p className="text-sm text-gray-500">Sync your emails from the calendar page to see your stats</p>
              </div>
            )}

            {/* Go to Calendar Button */}
            <div className="text-center">
              <button
                onClick={onGoToCalendar}
                className="btn-primary text-lg px-8 py-3"
              >
                Go to Calendar →
              </button>
            </div>
          </>
        )}
      </main>
    </div>
  );
}

export default SummaryPage;
