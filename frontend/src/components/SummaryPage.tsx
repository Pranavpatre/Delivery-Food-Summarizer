import { useState, useEffect, useMemo } from 'react';
import { calendarApi, syncApi } from '../api/client';
import { useAuth } from '../App';
import type { SummaryResponse, MonthData, EatMoreOfItem } from '../types';

interface SummaryPageProps {
  onGoToCalendar: () => void;
}

type ChartMetric = 'price' | 'orders' | 'calories';

const LOADING_STEPS = [
  { message: 'Syncing emails', icon: '📧' },
  { message: 'Searching ordered food', icon: '🔍' },
  { message: 'Calculating calories', icon: '🔥' },
  { message: 'Almost there', icon: '⏳' },
  { message: 'Pulling up Summary', icon: '📊' },
];

function SummaryPage({ onGoToCalendar }: SummaryPageProps) {
  const { user, logout } = useAuth();
  const [summaryData, setSummaryData] = useState<SummaryResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [loadingStep, setLoadingStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [activeMetric, setActiveMetric] = useState<ChartMetric>('price');

  // Cycle through loading messages
  useEffect(() => {
    if (!isSyncing) {
      setLoadingStep(0);
      return;
    }

    const interval = setInterval(() => {
      setLoadingStep((prev) => {
        if (prev < LOADING_STEPS.length - 1) {
          return prev + 1;
        }
        return prev;
      });
    }, 1200);

    return () => clearInterval(interval);
  }, [isSyncing]);

  useEffect(() => {
    syncAndLoadSummary();
  }, []);

  const syncAndLoadSummary = async () => {
    setIsLoading(true);
    setIsSyncing(true);
    setLoadingStep(0);
    setError(null);
    try {
      // Trigger sync to get latest emails for the 6-month window
      await syncApi.triggerSync();
      // Wait for sync to process (matches loading step timing: 5 steps × 1200ms = 6000ms)
      await new Promise(resolve => setTimeout(resolve, 5500));
      // Then load the summary
      const data = await calendarApi.getSummary();
      setSummaryData(data);
    } catch (err) {
      setError('Failed to load summary data');
      console.error(err);
    } finally {
      setIsLoading(false);
      setIsSyncing(false);
    }
  };

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

  // Reverse months_data so oldest is first (for chronological chart display)
  const chartData = useMemo(() => {
    if (!summaryData?.months_data) return [];
    return [...summaryData.months_data].reverse();
  }, [summaryData]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-cream via-cream to-sage/30">
      {/* Header */}
      <header className="bg-olive">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
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

      <main className="max-w-4xl mx-auto px-4 py-8">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20">
            {isSyncing ? (
              <div className="flex flex-col items-center gap-4">
                <span
                  className="text-5xl animate-bounce"
                  style={{ animationDuration: '1s' }}
                >
                  {LOADING_STEPS[loadingStep].icon}
                </span>
                <p className="text-lg font-medium text-dark">
                  {LOADING_STEPS[loadingStep].message}
                </p>
                <div className="flex gap-1.5 mt-2">
                  {LOADING_STEPS.map((_, index) => (
                    <div
                      key={index}
                      className={`w-2 h-2 rounded-full transition-all duration-300 ${
                        index <= loadingStep ? 'bg-lime' : 'bg-sage/50'
                      }`}
                    />
                  ))}
                </div>
              </div>
            ) : (
              <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-lime"></div>
            )}
          </div>
        ) : error ? (
          <div className="text-center py-20">
            <p className="text-red-600 mb-4">{error}</p>
            <button onClick={loadSummary} className="bg-sage/50 text-dark px-4 py-2 rounded-lg hover:bg-sage transition-colors">
              Retry
            </button>
          </div>
        ) : (
          <>
            {/* Title */}
            <div className="text-center mb-8">
              <h2 className="font-heading text-3xl font-black text-dark mb-2">
                Food Delivery Summarized
              </h2>
              <p className="text-olive/70">Your ordering patterns over the last 6 months</p>
            </div>

            {/* Health Index Circular Meter */}
            {summaryData?.health_insights && (
              <HealthIndexMeter
                healthIndex={summaryData.health_insights.health_index}
                oneLiner={summaryData.health_insights.one_liner}
              />
            )}

            {/* Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
              {/* Avg Monthly Spend */}
              <div className="bg-white/60 backdrop-blur border border-sage/30 rounded-xl p-5 text-center shadow-sm">
                <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-lime/20 flex items-center justify-center">
                  <span className="text-2xl">💰</span>
                </div>
                <p className="text-3xl font-bold text-lime mb-1">
                  ₹{Math.round(summaryData?.avg_monthly_spend || 0).toLocaleString()}
                </p>
                <p className="text-olive/70 text-sm font-medium">Avg Monthly Spend</p>
              </div>

              {/* Avg Calories */}
              <div className="bg-white/60 backdrop-blur border border-sage/30 rounded-xl p-5 text-center shadow-sm">
                <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-orange-100 flex items-center justify-center">
                  <span className="text-2xl">🔥</span>
                </div>
                <p className="text-3xl font-bold text-orange-500 mb-1">
                  {Math.round(summaryData?.avg_monthly_calories || 0).toLocaleString()}
                </p>
                <p className="text-olive/70 text-sm font-medium">Avg Monthly Calories</p>
              </div>

              {/* Avg Orders */}
              <div className="bg-white/60 backdrop-blur border border-sage/30 rounded-xl p-5 text-center shadow-sm">
                <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-sage/30 flex items-center justify-center">
                  <span className="text-2xl">🛒</span>
                </div>
                <p className="text-3xl font-bold text-sage mb-1">
                  {summaryData?.avg_order_count?.toFixed(1) || 0}
                </p>
                <p className="text-olive/70 text-sm font-medium">Avg Monthly Orders</p>
              </div>

              {/* Avg Days Ordered */}
              <div className="bg-white/60 backdrop-blur border border-sage/30 rounded-xl p-5 text-center shadow-sm">
                <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-olive/10 flex items-center justify-center">
                  <span className="text-2xl">📅</span>
                </div>
                <p className="text-3xl font-bold text-olive mb-1">
                  {summaryData?.avg_days_ordered?.toFixed(1) || 0}
                </p>
                <p className="text-olive/70 text-sm font-medium">Avg Days Ordered</p>
              </div>

              {/* Top Dish */}
              <div className="bg-white/60 backdrop-blur border border-sage/30 rounded-xl p-5 text-center shadow-sm col-span-2 md:col-span-1">
                <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-pink-100 flex items-center justify-center">
                  <span className="text-2xl">⭐</span>
                </div>
                <p className="text-2xl font-bold text-pink-500 mb-1 truncate" title={summaryData?.top_dish || 'No data'}>
                  {summaryData?.top_dish_count || 0}x
                </p>
                <p className="text-olive/70 text-sm font-medium truncate" title={summaryData?.top_dish || 'No data'}>
                  {summaryData?.top_dish || '—'}
                </p>
              </div>
            </div>

            {/* Nutrition Balance Card */}
            {summaryData?.health_insights && (
              <NutritionBalanceCard
                eatMoreOf={summaryData.health_insights.eat_more_of}
                lacking={summaryData.health_insights.lacking}
              />
            )}

            {/* MoM Trend Chart */}
            {chartData.length > 0 && chartData.some(m => m.order_count > 0) && (
              <div className="bg-white/60 backdrop-blur border border-sage/30 rounded-xl p-6 mb-8 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-dark">Monthly Trends</h3>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setActiveMetric('price')}
                      className={`px-3 py-1 text-sm rounded-full transition-colors ${
                        activeMetric === 'price'
                          ? 'bg-lime/20 text-lime font-medium'
                          : 'bg-sage/20 text-olive/70 hover:bg-sage/30'
                      }`}
                    >
                      Spend
                    </button>
                    <button
                      onClick={() => setActiveMetric('orders')}
                      className={`px-3 py-1 text-sm rounded-full transition-colors ${
                        activeMetric === 'orders'
                          ? 'bg-sage/40 text-dark font-medium'
                          : 'bg-sage/20 text-olive/70 hover:bg-sage/30'
                      }`}
                    >
                      Orders
                    </button>
                    <button
                      onClick={() => setActiveMetric('calories')}
                      className={`px-3 py-1 text-sm rounded-full transition-colors ${
                        activeMetric === 'calories'
                          ? 'bg-orange-100 text-orange-600 font-medium'
                          : 'bg-sage/20 text-olive/70 hover:bg-sage/30'
                      }`}
                    >
                      Calories
                    </button>
                  </div>
                </div>
                <TrendChart data={chartData} metric={activeMetric} />
              </div>
            )}

            {/* Health Narrative Card */}
            {summaryData?.health_insights?.monthly_narrative && (
              <HealthNarrativeCard narrative={summaryData.health_insights.monthly_narrative} />
            )}

            {/* Month Breakdown */}
            {summaryData?.months_data && summaryData.months_data.length > 0 && (
              <div className="bg-white/60 backdrop-blur border border-sage/30 rounded-xl p-6 mb-8 shadow-sm">
                <h3 className="text-lg font-semibold text-dark mb-4">Monthly Breakdown</h3>
                <div className="space-y-3">
                  {summaryData.months_data.map((month) => (
                    <div key={`${month.year}-${month.month_num}`} className="flex items-center justify-between p-4 bg-sage/10 rounded-lg">
                      <div>
                        <p className="font-medium text-dark">{month.month}</p>
                        <p className="text-sm text-olive/60">{month.order_count} orders over {month.days_ordered} days</p>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-bold text-lime">₹{Math.round(month.total_price).toLocaleString()}</p>
                        <p className="text-sm text-orange-500">{Math.round(month.total_calories).toLocaleString()} kcal</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* No Data Message */}
            {(!summaryData?.months_data || summaryData.months_data.every(m => m.order_count === 0)) && (
              <div className="bg-white/60 backdrop-blur border border-sage/30 rounded-xl p-8 text-center mb-8 shadow-sm">
                <span className="text-5xl mb-4 block">📭</span>
                <p className="text-dark mb-2">No order data found for the last 6 months</p>
                <p className="text-sm text-olive/60">Sync your emails from the calendar page to see your stats</p>
              </div>
            )}

            {/* Go to Calendar Button */}
            <div className="text-center">
              <button
                onClick={onGoToCalendar}
                className="bg-olive hover:bg-olive/90 text-cream font-semibold text-lg px-8 py-3 rounded-xl transition-colors shadow-lg"
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

interface TrendChartProps {
  data: MonthData[];
  metric: ChartMetric;
}

function TrendChart({ data, metric }: TrendChartProps) {
  const [animationStarted, setAnimationStarted] = useState(false);

  // Trigger animation on mount and when metric changes
  useEffect(() => {
    setAnimationStarted(false);
    const timer = setTimeout(() => setAnimationStarted(true), 50);
    return () => clearTimeout(timer);
  }, [metric]);

  const chartConfig = {
    price: {
      color: '#85CB33', // lime
      label: 'Order Value',
      getValue: (m: MonthData) => m.total_price,
      formatValue: (v: number) => `₹${Math.round(v).toLocaleString()}`,
    },
    orders: {
      color: '#A5CBC3', // sage
      label: 'Number of Orders',
      getValue: (m: MonthData) => m.order_count,
      formatValue: (v: number) => `${v} orders`,
    },
    calories: {
      color: '#f97316', // orange
      label: 'Calorie Count',
      getValue: (m: MonthData) => m.total_calories,
      formatValue: (v: number) => `${Math.round(v).toLocaleString()} kcal`,
    },
  };

  const config = chartConfig[metric];
  const values = data.map(config.getValue);
  const maxValue = Math.max(...values, 1);

  // Chart dimensions
  const chartHeight = 200;
  const barWidth = 100 / data.length;
  const padding = 4;

  return (
    <div className="relative">
      {/* Y-axis labels */}
      <div className="absolute left-0 top-0 bottom-8 w-16 flex flex-col justify-between text-xs text-olive/60 pr-2">
        <span className="text-right">{config.formatValue(maxValue)}</span>
        <span className="text-right">{config.formatValue(maxValue / 2)}</span>
        <span className="text-right">0</span>
      </div>

      {/* Chart area */}
      <div className="ml-16">
        <div className="relative" style={{ height: chartHeight }}>
          {/* Grid lines */}
          <div className="absolute inset-0 flex flex-col justify-between pointer-events-none">
            <div className="border-b border-sage/30"></div>
            <div className="border-b border-sage/30"></div>
            <div className="border-b border-sage/30"></div>
          </div>

          {/* Bars */}
          <div className="absolute inset-0 flex items-end justify-around px-2">
            {data.map((month, index) => {
              const value = config.getValue(month);
              // Calculate height in pixels instead of percentage
              const barHeightPx = maxValue > 0 ? (value / maxValue) * chartHeight : 0;
              const animatedHeight = animationStarted ? Math.max(barHeightPx, value > 0 ? 8 : 0) : 0;

              return (
                <div
                  key={`${month.year}-${month.month_num}`}
                  className="group relative flex items-end"
                  style={{ width: `${barWidth - padding}%`, height: '100%' }}
                >
                  {/* Tooltip */}
                  <div
                    className="absolute left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity bg-dark text-cream text-xs rounded px-2 py-1 whitespace-nowrap z-10 pointer-events-none"
                    style={{ bottom: Math.max(barHeightPx, 8) + 8 }}
                  >
                    {month.month}: {config.formatValue(value)}
                  </div>

                  {/* Bar with staggered animation */}
                  <div
                    className="w-full rounded-t-md hover:opacity-80"
                    style={{
                      height: animatedHeight,
                      backgroundColor: config.color,
                      transition: `height 0.5s ease-out ${index * 0.1}s`,
                    }}
                  />
                </div>
              );
            })}
          </div>
        </div>

        {/* X-axis labels */}
        <div className="flex justify-around mt-2">
          {data.map((month) => (
            <span
              key={`label-${month.year}-${month.month_num}`}
              className="text-xs text-olive/60"
              style={{ width: `${barWidth}%`, textAlign: 'center' }}
            >
              {month.short_month}
            </span>
          ))}
        </div>
      </div>

      {/* Legend */}
      <div className="flex justify-center mt-4">
        <div className="flex items-center gap-2 text-sm text-olive/70">
          <div
            className="w-3 h-3 rounded"
            style={{ backgroundColor: config.color }}
          />
          <span>{config.label}</span>
        </div>
      </div>
    </div>
  );
}

// Health Index Circular Meter Component - CRED-style
interface HealthIndexMeterProps {
  healthIndex: number;
  oneLiner: string;
}

function HealthIndexMeter({ healthIndex, oneLiner }: HealthIndexMeterProps) {
  const size = 180;
  const strokeWidth = 14;
  const radius = (size - strokeWidth) / 2;
  const centerX = size / 2;
  const centerY = size / 2;

  // Arc spans 240 degrees (from -210 to 30 degrees, leaving 120 degree gap at bottom)
  const startAngle = -210;
  const endAngle = 30;
  const totalArc = endAngle - startAngle; // 240 degrees

  // Convert angle to radians and get point on circle
  const polarToCartesian = (angle: number) => {
    const radians = (angle * Math.PI) / 180;
    return {
      x: centerX + radius * Math.cos(radians),
      y: centerY + radius * Math.sin(radians)
    };
  };

  // Create arc path
  const createArc = (start: number, end: number) => {
    const startPoint = polarToCartesian(start);
    const endPoint = polarToCartesian(end);
    const largeArc = end - start > 180 ? 1 : 0;
    return `M ${startPoint.x} ${startPoint.y} A ${radius} ${radius} 0 ${largeArc} 1 ${endPoint.x} ${endPoint.y}`;
  };

  // Calculate progress angle
  const progressAngle = startAngle + (healthIndex / 100) * totalArc;

  // Get tier info
  const getTier = (score: number) => {
    if (score >= 80) return { label: 'Excellent', color: '#22c55e' };
    if (score >= 60) return { label: 'Good', color: '#85CB33' };
    if (score >= 40) return { label: 'Fair', color: '#f59e0b' };
    return { label: 'Needs Work', color: '#ef4444' };
  };

  const tier = getTier(healthIndex);

  // Get score color based on value
  const getScoreColor = (score: number) => {
    if (score >= 80) return '#22c55e'; // green
    if (score >= 60) return '#85CB33'; // lime
    if (score >= 40) return '#f59e0b'; // amber
    if (score >= 20) return '#f97316'; // orange
    return '#ef4444'; // red
  };

  const scoreColor = getScoreColor(healthIndex);

  // Needle pointing from center to arc
  const needleLength = radius - 20;
  const needleEnd = {
    x: centerX + needleLength * Math.cos((progressAngle * Math.PI) / 180),
    y: centerY + needleLength * Math.sin((progressAngle * Math.PI) / 180)
  };

  return (
    <div className="bg-olive rounded-2xl p-6 pt-8 mb-8 shadow-xl">
      <div className="flex flex-col items-center">
        {/* Title */}
        <h3 className="text-cream text-2xl font-bold mb-4">Health Index</h3>

        {/* Circular Gauge */}
        <div className="relative" style={{ width: size, height: size - 40 }}>
          <svg
            width={size}
            height={size}
            viewBox={`0 0 ${size} ${size}`}
            style={{ overflow: 'visible', marginTop: '-20px' }}
          >
            <defs>
              {/* Main gradient for the arc */}
              <linearGradient id="gaugeGradient" x1="0%" y1="50%" x2="100%" y2="50%">
                <stop offset="0%" stopColor="#ef4444" />
                <stop offset="35%" stopColor="#f59e0b" />
                <stop offset="65%" stopColor="#85CB33" />
                <stop offset="100%" stopColor="#22c55e" />
              </linearGradient>

              {/* Glow filter */}
              <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
                <feMerge>
                  <feMergeNode in="coloredBlur"/>
                  <feMergeNode in="SourceGraphic"/>
                </feMerge>
              </filter>

              {/* Shadow for needle */}
              <filter id="needleShadow" x="-50%" y="-50%" width="200%" height="200%">
                <feDropShadow dx="0" dy="1" stdDeviation="2" floodColor="#000" floodOpacity="0.4"/>
              </filter>
            </defs>

            {/* Background track */}
            <path
              d={createArc(startAngle, endAngle)}
              fill="none"
              stroke="#1a1a1a"
              strokeWidth={strokeWidth}
              strokeLinecap="round"
            />

            {/* Colored gradient arc (full) - dimmed */}
            <path
              d={createArc(startAngle, endAngle)}
              fill="none"
              stroke="url(#gaugeGradient)"
              strokeWidth={strokeWidth}
              strokeLinecap="round"
              opacity="0.25"
            />

            {/* Progress arc with glow */}
            <path
              d={createArc(startAngle, progressAngle)}
              fill="none"
              stroke="url(#gaugeGradient)"
              strokeWidth={strokeWidth}
              strokeLinecap="round"
              filter="url(#glow)"
              style={{
                transition: 'all 1s ease-out',
              }}
            />

            {/* Center needle */}
            <line
              x1={centerX}
              y1={centerY}
              x2={needleEnd.x}
              y2={needleEnd.y}
              stroke={scoreColor}
              strokeWidth="3"
              strokeLinecap="round"
              filter="url(#needleShadow)"
              style={{ transition: 'all 1s ease-out' }}
            />

            {/* Needle center dot */}
            <circle
              cx={centerX}
              cy={centerY}
              r="8"
              fill={scoreColor}
              filter="url(#glow)"
            />
            <circle
              cx={centerX}
              cy={centerY}
              r="4"
              fill="#1a1a1a"
            />
          </svg>
        </div>

        {/* Score display */}
        <div className="text-center mt-1">
          <span
            className="text-4xl font-black tracking-tight"
            style={{ color: scoreColor }}
          >
            {healthIndex}
          </span>
          <span className="text-lg text-cream/40 font-medium">/100</span>
        </div>
        <div
          className="text-center text-sm font-semibold mt-2 px-4 py-1 rounded-full"
          style={{
            color: scoreColor,
            backgroundColor: `${scoreColor}20`
          }}
        >
          {tier.label}
        </div>

        {/* Tier labels */}
        <div className="flex justify-between w-full max-w-[180px] mt-3 px-2">
          <span className="text-xs text-red-400/80">Poor</span>
          <span className="text-xs text-amber-400/80">Fair</span>
          <span className="text-xs text-lime/80">Good</span>
          <span className="text-xs text-green-400/80">Great</span>
        </div>

        {/* One-liner insight */}
        <p className="text-center text-cream/70 mt-3 text-sm max-w-sm leading-relaxed">
          "{oneLiner}"
        </p>
      </div>
    </div>
  );
}

// Nutrition Balance Card Component
interface NutritionBalanceCardProps {
  eatMoreOf: EatMoreOfItem[];
  lacking: string[];
}

function NutritionBalanceCard({ eatMoreOf, lacking }: NutritionBalanceCardProps) {
  return (
    <div className="bg-white/60 backdrop-blur border border-olive/20 rounded-xl p-6 mb-8 shadow-sm">
      <h3 className="text-lg font-semibold text-olive mb-4 text-center">Diet Balance</h3>
      <div className="grid grid-cols-2 gap-6">
        {/* You Eat More Of */}
        <div>
          <h4 className="text-sm font-semibold text-olive/80 mb-3 flex items-center gap-2">
            <span className="text-lg">📊</span> You Eat More Of
          </h4>
          <ul className="space-y-2">
            {eatMoreOf.map((item, index) => (
              <li
                key={index}
                className={`flex items-center gap-2 text-sm ${
                  item.is_healthy ? 'text-lime' : 'text-red-500'
                }`}
              >
                <span>{item.is_healthy ? '✓' : '✗'}</span>
                <span className={item.is_healthy ? 'text-olive/80' : 'text-olive/80'}>
                  {item.item}
                </span>
              </li>
            ))}
          </ul>
        </div>

        {/* You're Lacking */}
        <div>
          <h4 className="text-sm font-semibold text-olive/80 mb-3 flex items-center gap-2">
            <span className="text-lg">🎯</span> You're Lacking
          </h4>
          <ul className="space-y-2">
            {lacking.map((item, index) => (
              <li key={index} className="flex items-center gap-2 text-sm text-lime">
                <span>+</span>
                <span className="text-olive/80">{item}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

// Health Narrative Card Component
interface HealthNarrativeCardProps {
  narrative: string;
}

function HealthNarrativeCard({ narrative }: HealthNarrativeCardProps) {
  return (
    <div className="bg-white/60 backdrop-blur border border-olive/20 rounded-xl p-6 mb-8 shadow-sm">
      <div className="flex items-start gap-4">
        <div className="w-10 h-10 rounded-full bg-olive/10 flex items-center justify-center flex-shrink-0">
          <span className="text-xl">💡</span>
        </div>
        <div>
          <h3 className="text-lg font-semibold text-olive mb-2">Health Snapshot</h3>
          <p className="text-olive/70 leading-relaxed">{narrative}</p>
          <p className="text-xs text-olive/40 mt-3">AI-generated insight based on your ordering patterns</p>
        </div>
      </div>
    </div>
  );
}

export default SummaryPage;
