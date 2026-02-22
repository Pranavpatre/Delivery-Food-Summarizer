import { useState } from 'react';

interface DoDMetric {
  today: number;
  yesterday: number;
  change_pct: number;
}

interface AdminStats {
  total_users: number;
  total_orders: number;
  total_dishes: number;
  total_calories_cached: number;
  users_last_24h: number;
  users_last_7d: number;
  orders_last_24h: number;
  orders_last_7d: number;
  avg_orders_per_user: number;
  top_restaurants: { name: string; order_count: number }[];
  recent_signups: { email: string; created_at: string; order_count: number }[];
  dod_signups: DoDMetric;
  dod_orders: DoDMetric;
  dod_active_users: DoDMetric;
}

function AdminPage() {
  const [adminKey, setAdminKey] = useState('');
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = async () => {
    if (!adminKey.trim()) {
      setError('Please enter the admin key');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/admin/stats?admin_key=${encodeURIComponent(adminKey)}`
      );

      if (!response.ok) {
        if (response.status === 403) throw new Error('Invalid admin key');
        throw new Error('Failed to fetch stats');
      }

      const data = await response.json();
      setStats(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch stats');
    } finally {
      setIsLoading(false);
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="min-h-screen bg-linen">
      {/* Header */}
      <header className="bg-ebony text-linen px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center gap-3">
          <svg width="36" height="32" viewBox="5 5 150 90" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M15 15 L15 45 Q15 55 20 55 L20 85" stroke="white" strokeWidth="4" strokeLinecap="round"/><path d="M25 15 L25 45 Q25 55 20 55" stroke="white" strokeWidth="4" strokeLinecap="round"/><path d="M20 15 L20 40" stroke="white" strokeWidth="3" strokeLinecap="round"/><circle cx="80" cy="50" r="38" stroke="white" strokeWidth="4"/><circle cx="80" cy="50" r="28" stroke="white" strokeWidth="2.5"/><path d="M65 52 L75 62 L95 40" stroke="#84CC16" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round"/><ellipse cx="140" cy="30" rx="10" ry="20" stroke="white" strokeWidth="4"/><path d="M140 50 L140 85" stroke="white" strokeWidth="4" strokeLinecap="round"/></svg>
          <h1 className="font-heading text-xl font-black">Bitewise Admin</h1>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-12 space-y-8">
        {/* Auth */}
        {!stats && (
          <div className="max-w-sm mx-auto card">
            <h2 className="font-heading text-lg font-bold text-ebony mb-4">Authentication</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-xs text-sage uppercase tracking-wide mb-1">
                  Admin Key
                </label>
                <input
                  type="password"
                  value={adminKey}
                  onChange={(e) => setAdminKey(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && fetchStats()}
                  placeholder="Enter your secret key"
                  className="w-full px-4 py-2.5 rounded-xl border border-sage/20 bg-linen focus:border-lime focus:ring-1 focus:ring-lime/50 outline-none transition-colors text-ebony"
                />
              </div>
              {error && <p className="text-red-500 text-sm">{error}</p>}
              <button
                onClick={fetchStats}
                disabled={isLoading}
                className="w-full btn-primary"
              >
                {isLoading ? 'Loading...' : 'View Stats'}
              </button>
            </div>
          </div>
        )}

        {/* Dashboard */}
        {stats && (
          <div className="space-y-8 animate-fade-in">
            {/* Overview */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatCard label="Total Users" value={stats.total_users} />
              <StatCard label="Total Orders" value={stats.total_orders} />
              <StatCard label="Total Dishes" value={stats.total_dishes} />
              <StatCard label="Cached Calories" value={stats.total_calories_cached} />
            </div>

            {/* DoD Metrics */}
            <div className="card">
              <h3 className="text-lg font-semibold text-ebony mb-4">Day-over-Day</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <DoDCard label="Signups" metric={stats.dod_signups} />
                <DoDCard label="Orders Synced" metric={stats.dod_orders} />
                <DoDCard label="Active Users" metric={stats.dod_active_users} />
              </div>
            </div>

            {/* Activity */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatCard label="Users (24h)" value={stats.users_last_24h} />
              <StatCard label="Users (7d)" value={stats.users_last_7d} />
              <StatCard label="Orders (24h)" value={stats.orders_last_24h} />
              <StatCard label="Orders (7d)" value={stats.orders_last_7d} />
            </div>

            {/* Avg Orders */}
            <div className="card flex items-center justify-between">
              <p className="text-sage text-sm">Average Orders per User</p>
              <p className="metric text-3xl text-ebony">{stats.avg_orders_per_user}</p>
            </div>

            {/* Two Column */}
            <div className="grid md:grid-cols-2 gap-6">
              {/* Top Restaurants - Table */}
              <div className="card">
                <h3 className="text-lg font-semibold text-ebony mb-4">Top Restaurants</h3>
                <table className="w-full text-sm">
                  <tbody>
                    {stats.top_restaurants.map((r, i) => (
                      <tr key={i} className="border-b border-sage/10 last:border-0">
                        <td className="py-2.5 text-sage w-6">{i + 1}</td>
                        <td className="py-2.5 text-ebony">{r.name}</td>
                        <td className="py-2.5 text-right font-mono text-sage">{r.order_count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Recent Signups */}
              <div className="card">
                <h3 className="text-lg font-semibold text-ebony mb-4">Recent Signups</h3>
                <div className="space-y-3">
                  {stats.recent_signups.map((user, i) => (
                    <div key={i} className="flex items-center justify-between border-b border-sage/10 pb-2.5 last:border-0">
                      <div>
                        <p className="text-sm text-ebony">{user.email}</p>
                        <p className="text-xs text-sage">{formatDate(user.created_at)}</p>
                      </div>
                      <span className="text-xs font-mono text-sage">
                        {user.order_count} orders
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Refresh */}
            <div className="text-center">
              <button
                onClick={fetchStats}
                disabled={isLoading}
                className="btn-secondary"
              >
                {isLoading ? 'Refreshing...' : 'Refresh Stats'}
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="card text-center p-4">
      <p className="text-xs text-sage uppercase tracking-wide mb-1">{label}</p>
      <p className="metric text-2xl text-ebony">{value.toLocaleString()}</p>
    </div>
  );
}

function DoDCard({ label, metric }: { label: string; metric: DoDMetric }) {
  const isPositive = metric.change_pct > 0;
  const isNeutral = metric.change_pct === 0;

  return (
    <div className="border border-sage/10 rounded-xl p-4">
      <p className="text-xs text-sage uppercase tracking-wide mb-3">{label}</p>
      <div className="flex items-end justify-between">
        <div>
          <div className="flex items-baseline gap-2">
            <span className="metric text-2xl text-ebony">{metric.today}</span>
            <span className="text-sage text-xs">today</span>
          </div>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="font-mono text-lg text-sage">{metric.yesterday}</span>
            <span className="text-sage/60 text-xs">yesterday</span>
          </div>
        </div>
        <span
          className={`font-mono text-sm font-semibold ${
            isNeutral ? 'text-sage' : isPositive ? 'text-lime' : 'text-red-500'
          }`}
        >
          {isNeutral ? '0%' : `${isPositive ? '+' : ''}${metric.change_pct}%`}
        </span>
      </div>
    </div>
  );
}

export default AdminPage;
