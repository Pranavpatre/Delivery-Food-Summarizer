import { useState, useEffect, useMemo, useRef } from 'react';
import { calendarApi, syncApi } from '../api/client';
import { useAuth } from '../App';
import type { SummaryResponse, MonthData, HabitItem, NutrientLevel } from '../types';

interface SummaryPageProps {
  onGoToCalendar: () => void;
}

type ChartMetric = 'price' | 'calories' | 'orders';

function SummaryPage({ onGoToCalendar }: SummaryPageProps) {
  const { user, logout } = useAuth();
  const [summaryData, setSummaryData] = useState<SummaryResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [activeMetric, setActiveMetric] = useState<ChartMetric>('price');
  const syncAttempted = useRef(false);

  useEffect(() => {
    loadSummary();
  }, []);

  const hasNoData = (data: SummaryResponse | null) => {
    if (!data?.months_data) return true;
    return data.months_data.every(m => m.order_count === 0);
  };

  const loadSummary = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await calendarApi.getSummary();
      setSummaryData(data);

      // Auto-sync for new users with no data (only once)
      if (hasNoData(data) && !syncAttempted.current) {
        syncAttempted.current = true;
        await autoSync();
      }
    } catch (err) {
      setError('Failed to load data. Retry?');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const autoSync = async () => {
    setIsSyncing(true);
    setSyncMessage('Syncing your Swiggy emails...');
    try {
      await syncApi.triggerSync();

      // Poll sync status
      let attempts = 0;
      const maxAttempts = 60; // 5 minutes max
      while (attempts < maxAttempts) {
        await new Promise(r => setTimeout(r, 5000));
        attempts++;
        try {
          const status = await syncApi.getStatus();
          if (status.emails_processed > 0) {
            setSyncMessage(`Processed ${status.emails_processed} emails...`);
          }
          if (status.orders_created > 0) {
            setSyncMessage(`Found ${status.orders_created} orders so far...`);
          }
          if (status.status === 'completed' || status.status === 'idle') {
            setSyncMessage('Sync complete! Loading Order Health Summary...');
            // Reload summary with new data
            const freshData = await calendarApi.getSummary();
            setSummaryData(freshData);
            break;
          }
          if (status.status === 'error') {
            setSyncMessage('Sync encountered an issue. You can retry from the calendar page.');
            break;
          }
        } catch {
          // Ignore polling errors, keep trying
        }
      }
    } catch (err) {
      console.error('Auto-sync failed:', err);
      setSyncMessage('Could not sync automatically. Try syncing from the calendar page.');
    } finally {
      setIsSyncing(false);
    }
  };

  const chartData = useMemo(() => {
    if (!summaryData?.months_data) return [];
    return [...summaryData.months_data].reverse();
  }, [summaryData]);

  if (isLoading || isSyncing) {
    return (
      <div className="min-h-screen bg-linen flex flex-col items-center justify-center px-6">
        <div className="animate-spin rounded-full h-12 w-12 border-2 border-lime border-t-transparent mb-6"></div>
        <p className="text-ebony font-heading font-semibold text-lg mb-2">
          {isSyncing ? 'Setting things up' : 'Loading Order Health Summary'}
        </p>
        <p className="text-sage text-sm text-center max-w-xs">
          {isSyncing ? syncMessage : 'Fetching your order insights...'}
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-linen flex flex-col items-center justify-center px-6">
        <p className="text-ebony mb-4 text-center">{error}</p>
        <button onClick={loadSummary} className="btn-secondary">Retry</button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-linen">
      {/* Header */}
      <header className="bg-ebony text-linen px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <svg width="28" height="28" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="50" cy="50" r="45" stroke="white" strokeWidth="5"/><circle cx="50" cy="50" r="35" stroke="white" strokeWidth="3"/><path d="M35 52 L45 62 L65 40" stroke="#84CC16" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round"/></svg>
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

      <main className="max-w-4xl mx-auto px-6 py-12 space-y-12">
        {/* Hero Title */}
        <div className="text-center space-y-2 animate-fade-in">
          <h2 className="font-heading text-4xl font-black text-ebony uppercase">Order Health Summary</h2>
          <p className="text-sage">Last 6 months of Swiggy orders</p>
        </div>

        {/* Health Index & Key Metrics */}
        <div className="grid md:grid-cols-2 gap-8 animate-fade-in">
          {/* Health Index */}
          {summaryData?.health_insights && (
            <HealthIndexCard
              healthIndex={summaryData.health_insights.health_index}
              oneLiner={summaryData.health_insights.one_liner}
            />
          )}

          {/* Summary Cards - 2x2 */}
          <div className="grid grid-cols-2 gap-4">
            <MetricCard
              icon="💰"
              value={`₹${Math.round(summaryData?.avg_monthly_spend || 0).toLocaleString()}`}
              label="Monthly Spend"
            />
            <MetricCard
              icon="🔥"
              value={`${Math.round(summaryData?.avg_monthly_calories || 0).toLocaleString()}`}
              label="Monthly Calories"
              unit="kcal"
            />
            <MetricCard
              icon="🛒"
              value={summaryData?.avg_order_count?.toFixed(1) || '0'}
              label="Orders/Month"
            />
            <MetricCard
              icon="📅"
              value={summaryData?.avg_days_ordered?.toFixed(1) || '0'}
              label="Days Ordered"
            />
          </div>
        </div>

        {/* Quick Insights */}
        {summaryData?.health_insights && (
          <InsightsCard
            goodHabits={summaryData.health_insights.good_habits}
            badHabits={summaryData.health_insights.bad_habits}
            lacking={summaryData.health_insights.lacking}
            narrative={summaryData.health_insights.narrative}
          />
        )}

        {/* Your Order Mix */}
        {summaryData?.health_insights && (
          <FoodSnapshotCard
            bestDishes={summaryData.health_insights.best_dishes}
            worstDishes={summaryData.health_insights.worst_dishes}
          />
        )}

        {/* Nutrient Levels */}
        {summaryData?.health_insights?.nutrient_levels &&
          summaryData.health_insights.nutrient_levels.length > 0 && (
            <NutrientLevelsCard nutrientLevels={summaryData.health_insights.nutrient_levels} />
          )}

        {/* Late Night Eating */}
        {summaryData?.late_night_order_pct != null &&
          summaryData.late_night_order_pct > 0 ? (
            <LateNightCard lateNightPct={summaryData.late_night_order_pct} />
          ) : summaryData?.months_data && summaryData.months_data.some(m => m.order_count > 0) ? (
            <div className="card">
              <div className="flex items-start gap-4">
                <div className="text-3xl">🌙</div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-ebony mb-2">Late Night Orders</h3>
                  <p className="text-sm text-ebony/70 leading-relaxed">
                    Order timing data is not available for older syncs. Re-sync your emails from the calendar page to see your late-night ordering patterns.
                  </p>
                </div>
              </div>
            </div>
          ) : null}

        {/* Monthly Trends Chart */}
        {chartData.length > 1 && chartData.some(m => m.order_count > 0) && (
          <div className="card">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-semibold text-ebony">Monthly Trends</h3>
              <div className="flex gap-2">
                {(['price', 'calories', 'orders'] as ChartMetric[]).map(m => (
                  <button
                    key={m}
                    onClick={() => setActiveMetric(m)}
                    className={`px-3 py-1 text-sm rounded-full transition-colors ${
                      activeMetric === m
                        ? 'bg-lime/10 text-lime font-medium'
                        : 'text-sage hover:text-ebony'
                    }`}
                  >
                    {m === 'price' ? 'Spend' : m === 'calories' ? 'Calories' : 'Orders'}
                  </button>
                ))}
              </div>
            </div>
            <TrendChart data={chartData} metric={activeMetric} />
          </div>
        )}

        {/* No Data */}
        {hasNoData(summaryData) && (
          <div className="card text-center py-12">
            <p className="text-3xl mb-4">📭</p>
            <p className="text-ebony mb-2">No order data found for the last 6 months</p>
            <p className="text-sm text-sage mb-4">We couldn't find any Swiggy order emails. Make sure you're signed in with the right Google account.</p>
            <button onClick={() => { syncAttempted.current = false; loadSummary(); }} className="btn-primary">
              Try Syncing Again
            </button>
          </div>
        )}

        {/* CTA */}
        <div className="text-center">
          <button onClick={onGoToCalendar} className="btn-primary text-lg px-8">
            View Calendar →
          </button>
        </div>
      </main>
    </div>
  );
}

// --- Sub-components ---

function MetricCard({
  icon,
  value,
  label,
  unit,
}: {
  icon: string;
  value: string;
  label: string;
  unit?: string;
}) {
  return (
    <div className="card text-center p-4">
      <div className="text-2xl mb-2">{icon}</div>
      <div className="metric text-2xl md:text-3xl mb-1">
        {value}
        {unit && <span className="text-sm font-normal text-sage ml-1">{unit}</span>}
      </div>
      <p className="text-xs text-sage">{label}</p>
    </div>
  );
}

function HealthIndexCard({
  healthIndex,
  oneLiner,
}: {
  healthIndex: number;
  oneLiner: string;
}) {
  const getColor = (score: number) => {
    if (score >= 80) return 'text-lime';
    if (score >= 60) return 'text-lime/80';
    if (score >= 40) return 'text-amber';
    return 'text-red-500';
  };

  const getLabel = (score: number) => {
    if (score >= 80) return 'Excellent';
    if (score >= 60) return 'Good';
    if (score >= 40) return 'Fair';
    return 'Needs Work';
  };

  const getBgColor = (score: number) => {
    if (score >= 80) return 'bg-lime/10';
    if (score >= 60) return 'bg-lime/5';
    if (score >= 40) return 'bg-amber/10';
    return 'bg-red-50';
  };

  return (
    <div className="card flex flex-col items-center justify-center py-8">
      <h3 className="text-lg font-semibold text-ebony mb-6">Health Index</h3>
      <div className={`metric text-6xl ${getColor(healthIndex)}`}>
        {healthIndex}
      </div>
      <span className="text-sm text-sage mt-1">/100</span>
      <div
        className={`mt-4 px-4 py-1 rounded-full text-sm font-medium ${getBgColor(healthIndex)} ${getColor(healthIndex)}`}
      >
        {getLabel(healthIndex)}
      </div>
      <p className="text-sm text-sage mt-4 text-center leading-relaxed max-w-xs">
        "{oneLiner}"
      </p>
    </div>
  );
}

function InsightsCard({
  goodHabits,
  badHabits,
  lacking,
  narrative,
}: {
  goodHabits: HabitItem[];
  badHabits: HabitItem[];
  lacking: string[];
  narrative?: string;
}) {
  return (
    <div className="card space-y-6">
      <h3 className="text-lg font-semibold text-ebony">Quick Insights</h3>

      {narrative && (
        <p className="text-sm text-ebony/80 leading-relaxed border-b border-sage/10 pb-4">
          {narrative}
        </p>
      )}

      <div className="grid md:grid-cols-3 gap-6">
        <div>
          <h4 className="font-medium text-ebony mb-3">The Good</h4>
          <ul className="space-y-2 text-sm">
            {goodHabits.length > 0 ? (
              goodHabits.slice(0, 4).map((h, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="text-lime text-xs mt-1">●</span>
                  <span className="text-ebony/80">{h.item}</span>
                </li>
              ))
            ) : (
              <li className="text-sage italic">No strengths detected yet</li>
            )}
          </ul>
        </div>
        <div>
          <h4 className="font-medium text-amber mb-3">The Bad</h4>
          <ul className="space-y-2 text-sm">
            {badHabits.length > 0 ? (
              badHabits.slice(0, 4).map((h, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="text-amber text-xs mt-1">●</span>
                  <span className="text-ebony/80">{h.item}</span>
                </li>
              ))
            ) : (
              <li className="text-sage italic">No concerns detected</li>
            )}
          </ul>
        </div>
        <div>
          <h4 className="font-medium text-sage mb-3">The Missing</h4>
          <ul className="space-y-2 text-sm">
            {lacking.length > 0 ? (
              lacking.slice(0, 4).map((l, i) => (
                <li key={i} className="text-ebony/80">{l}</li>
              ))
            ) : (
              <li className="text-sage italic">Diet seems balanced</li>
            )}
          </ul>
        </div>
      </div>
    </div>
  );
}

function FoodSnapshotCard({
  bestDishes,
  worstDishes,
}: {
  bestDishes: string[];
  worstDishes: string[];
}) {
  if (bestDishes.length === 0 && worstDishes.length === 0) return null;

  return (
    <div className="card">
      <h3 className="text-lg font-semibold text-ebony mb-4">Order Mix</h3>
      <div className="grid grid-cols-2 gap-6">
        <div>
          <h4 className="text-sm font-medium text-lime mb-3">Nutritious Picks</h4>
          <ul className="space-y-2">
            {bestDishes.length > 0 ? (
              bestDishes.map((dish, i) => (
                <li key={i} className="text-sm text-ebony/80 flex items-center gap-2">
                  <span className="text-lime">●</span> {dish}
                </li>
              ))
            ) : (
              <li className="text-sm text-sage italic">No smart picks found</li>
            )}
          </ul>
        </div>
        <div>
          <h4 className="text-sm font-medium text-amber mb-3">Cheat Picks</h4>
          <ul className="space-y-2">
            {worstDishes.length > 0 ? (
              worstDishes.map((dish, i) => (
                <li key={i} className="text-sm text-ebony/80 flex items-center gap-2">
                  <span className="text-amber">●</span> {dish}
                </li>
              ))
            ) : (
              <li className="text-sm text-sage italic">No treat picks found</li>
            )}
          </ul>
        </div>
      </div>
    </div>
  );
}

function NutrientLevelsCard({ nutrientLevels }: { nutrientLevels: NutrientLevel[] }) {
  // These nutrients are unhealthy — "high" is bad, "low" is good (inverted colors)
  const UNHEALTHY_NUTRIENTS = ['refined carbs', 'fried foods', 'fried food', 'sugar', 'sodium', 'processed foods', 'saturated fat'];

  const isUnhealthy = (name: string) =>
    UNHEALTHY_NUTRIENTS.some(u => name.toLowerCase().includes(u));

  const getLevelStyle = (name: string, level: string) => {
    const inverted = isUnhealthy(name);
    switch (level) {
      case 'high':
        return inverted ? 'text-red-500' : 'text-lime';
      case 'medium':
        return 'text-amber';
      case 'low':
        return inverted ? 'text-lime' : 'text-red-500';
      default:
        return 'text-sage';
    }
  };

  return (
    <div className="card">
      <h3 className="text-lg font-semibold text-ebony mb-4">Nutrient Snapshot</h3>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {nutrientLevels.map((n, i) => (
          <div key={i} className="text-center p-3 border border-sage/10 rounded-xl">
            <p className="text-xs text-sage uppercase tracking-wide mb-1">{n.name}</p>
            <p className={`font-mono font-bold text-lg ${getLevelStyle(n.name, n.level)}`}>
              {n.level.toUpperCase()}
            </p>
          </div>
        ))}
      </div>
      <p className="text-xs text-sage mt-4 text-center">
        Based on analysis of your frequently ordered dishes
      </p>
    </div>
  );
}

function LateNightCard({ lateNightPct }: { lateNightPct: number }) {
  const isHigh = lateNightPct >= 40;
  const isModerate = lateNightPct >= 20;

  const getMessage = (pct: number) => {
    if (pct >= 40)
      return 'Late-night eating is linked to weight gain, poor sleep quality, and metabolic issues.';
    if (pct >= 20)
      return 'Some late-night orders detected. Occasional late eating is fine, but regular patterns can affect metabolism.';
    return 'Great job keeping late-night eating minimal! This supports better sleep and metabolic health.';
  };

  return (
    <div className="card">
      <div className="flex items-start gap-4">
        <div className="text-3xl">🌙</div>
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            <h3 className="text-lg font-semibold text-ebony">Late Night Orders</h3>
            <span
              className={`font-mono font-bold text-2xl ${
                isHigh ? 'text-red-500' : isModerate ? 'text-amber' : 'text-lime'
              }`}
            >
              {lateNightPct.toFixed(0)}%
            </span>
          </div>
          <p className="text-sm text-ebony/70 leading-relaxed">{getMessage(lateNightPct)}</p>
          <p className="text-xs text-sage mt-2">Orders after 10 PM or before 5 AM</p>
        </div>
      </div>
    </div>
  );
}

// --- Trend Chart ---

function TrendChart({ data, metric }: { data: MonthData[]; metric: ChartMetric }) {
  const getValue = (m: MonthData) => {
    if (metric === 'price') return m.total_price;
    if (metric === 'calories') return m.total_calories;
    return m.order_count;
  };

  const formatValue = (v: number) => {
    if (metric === 'price') return `₹${Math.round(v).toLocaleString()}`;
    if (metric === 'calories') return `${Math.round(v).toLocaleString()} kcal`;
    return `${v}`;
  };

  const values = data.map(getValue);
  const rawMax = Math.max(...values, 1);

  // Calculate nice round grid intervals
  const getNiceStep = (max: number) => {
    if (max <= 0) return 1;
    const roughStep = max / 4;
    const magnitude = Math.pow(10, Math.floor(Math.log10(roughStep)));
    const residual = roughStep / magnitude;
    if (residual <= 1) return magnitude;
    if (residual <= 2) return 2 * magnitude;
    if (residual <= 5) return 5 * magnitude;
    return 10 * magnitude;
  };

  const niceStep = getNiceStep(rawMax);
  const gridValues: number[] = [];
  for (let v = 0; v <= rawMax; v += niceStep) {
    gridValues.push(v);
  }
  // Ensure we have a line above the max
  if (gridValues[gridValues.length - 1] < rawMax) {
    gridValues.push(gridValues[gridValues.length - 1] + niceStep);
  }
  const chartMax = gridValues[gridValues.length - 1];

  return (
    <div className="relative">
      {/* Grid lines */}
      <div className="absolute inset-0 bottom-6 flex flex-col justify-between pointer-events-none">
        {[...gridValues].reverse().map((val, i) => (
          <div key={i} className="flex items-center gap-2 w-full">
            <span className="text-[10px] font-mono text-sage/60 w-16 text-right shrink-0">
              {metric === 'orders' ? val : metric === 'price' ? `₹${val.toLocaleString()}` : val.toLocaleString()}
            </span>
            <div className="flex-1 border-t border-sage/10" />
          </div>
        ))}
      </div>

      {/* Bars */}
      <div className="flex items-end gap-3 h-48 pl-[72px]">
        {data.map((month, i) => {
          const value = getValue(month);
          const heightPct = chartMax > 0 ? (value / chartMax) * 100 : 0;

          return (
            <div key={i} className="flex-1 flex flex-col items-center gap-2 h-full justify-end group">
              <span className="text-xs font-mono font-medium text-ebony opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                {formatValue(value)}
              </span>
              <div className="w-full flex justify-center" style={{ height: `${Math.max(heightPct, 3)}%` }}>
                <div
                  className="w-full max-w-[40px] rounded-t-lg transition-all duration-500 opacity-70 group-hover:opacity-100"
                  style={{ height: '100%', backgroundColor: '#3B341F' }}
                />
              </div>
              <span className="text-xs text-sage shrink-0">
                {month.short_month}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default SummaryPage;
