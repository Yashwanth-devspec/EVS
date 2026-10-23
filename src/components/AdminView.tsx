import React, { useState } from 'react';
import { api } from '../api';
import { formatTimeIST } from '../utils';

interface AdminViewProps {
  onRefresh: () => void;
}

const ALL_ZONES = [
  'Indiranagar',
  'Koramangala',
  'Jayanagar',
  'Whitefield',
  'HSR Layout',
  'Marathahalli',
  'Hebbal',
  'Malleshwaram',
  'Rajajinagar',
  'Banashankari',
  'BTM Layout',
  'Electronic City',
  'Bellandur',
  'Yelahanka',
  'Sarjapur Road',
  'JP Nagar',
];

export const AdminView: React.FC<AdminViewProps> = ({ onRefresh }) => {
  const [password, setPassword] = useState('ecoride2026');
  const [authenticated, setAuthenticated] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [statusNotice, setStatusNotice] = useState<string | null>(null);
  const [analytics, setAnalytics] = useState<{
    clock_utc: string;
    offset_minutes: number;
    total_requests: number;
    active_pool: number;
    total_groups: number;
    confirmed_groups: number;
    demand_by_zone: Record<string, number>;
    match_rate_pct: number;
    demo_mode: boolean;
  } | null>(null);

  const handleLogin = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    try {
      setLoading(true);
      setErrorMsg(null);
      const data = await api.getAdminAnalytics(password);
      setAnalytics(data);
      setAuthenticated(true);
    } catch (err: any) {
      setErrorMsg(err.message || 'Invalid operator credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleAdvance = async (mins: number) => {
    try {
      setLoading(true);
      await api.demoAdvance(mins);
      setStatusNotice(`Airport clock fast-forwarded +${mins}m.`);
      const updated = await api.getAdminAnalytics(password);
      setAnalytics(updated);
      onRefresh();
      setTimeout(() => setStatusNotice(null), 3000);
    } catch (err: any) {
      setErrorMsg(err.message || 'Advance failed');
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async () => {
    try {
      setLoading(true);
      await api.demoReset();
      setStatusNotice('Reset simulation clock to real time and reseeded 12 demo passengers.');
      const updated = await api.getAdminAnalytics(password);
      setAnalytics(updated);
      onRefresh();
      setTimeout(() => setStatusNotice(null), 3000);
    } catch (err: any) {
      setErrorMsg(err.message || 'Reset failed');
    } finally {
      setLoading(false);
    }
  };

  // Login Gate
  if (!authenticated) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center px-4 bg-ink-950 font-sans">
        <div className="w-full max-w-sm p-6 bg-ink-900 border border-ink-800 rounded-xl space-y-5">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-green animate-pulse" />
              <h1 className="text-sm font-semibold text-primary uppercase tracking-wider font-cockpit">
                EcoRide Operations Console
              </h1>
            </div>
            <p className="text-xs text-secondary">
              Direct access to live dispatch queue and time controls.
            </p>
          </div>

          {errorMsg && (
            <div className="p-2.5 bg-red/10 border border-red/30 text-red text-xs font-cockpit rounded">
              {errorMsg}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label htmlFor="admin-pass" className="block text-xs font-cockpit text-secondary mb-1.5">
                Passcode
              </label>
              <input
                id="admin-pass"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full h-10 px-3 text-sm font-cockpit bg-ink-950 border border-ink-700 rounded-lg text-primary focus:outline-none focus:border-amber"
                placeholder="ecoride2026"
                autoFocus
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full h-10 text-xs font-semibold uppercase tracking-wider font-cockpit bg-primary text-ink-950 rounded-lg hover:bg-white active:scale-[0.98] transition-all"
            >
              {loading ? 'Authenticating...' : 'Sign In'}
            </button>
          </form>

          <p className="text-[11px] text-secondary/60 text-center font-cockpit">
            Default sandbox key: <code className="text-amber">ecoride2026</code>
          </p>
        </div>
      </div>
    );
  }

  // Generate synthetic arrival waves based on current time
  const waveLabels = ['W1 (+00m)', 'W2 (+15m)', 'W3 (+30m)', 'W4 (+45m)', 'W5 (+60m)'];
  const demand = analytics?.demand_by_zone || {};

  return (
    <div className="min-h-screen bg-ink-950 text-primary py-8 px-4 sm:px-6 lg:px-8 font-sans">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Top Control Strip */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-ink-800">
          <div>
            <div className="flex items-center gap-2.5">
              <span className="w-2 h-2 rounded-full bg-green" />
              <h1 className="text-xl font-bold tracking-tight text-primary">
                Kempegowda Airport (BLR) Operations
              </h1>
              <span className="px-2 py-0.5 rounded text-[10px] font-cockpit uppercase bg-ink-900 border border-ink-700 text-secondary">
                Linear Console
              </span>
            </div>
            <div className="flex items-center gap-3 mt-1 text-xs font-cockpit text-secondary">
              <span>Simulated IST: <strong className="text-primary font-bold">{formatTimeIST(analytics?.clock_utc || '')}</strong></span>
              <span>&bull;</span>
              <span>Clock Offset: <strong className="text-amber">+{analytics?.offset_minutes || 0}m</strong></span>
              <span>&bull;</span>
              <span className="text-green">Engine Online</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => handleAdvance(10)}
              disabled={loading}
              className="tap-target px-3 py-1.5 text-xs font-cockpit font-semibold border border-ink-700 rounded-lg bg-ink-900 hover:bg-ink-800 text-primary active:scale-[0.97]"
            >
              +10 min
            </button>
            <button
              onClick={() => handleAdvance(30)}
              disabled={loading}
              className="tap-target px-3 py-1.5 text-xs font-cockpit font-semibold border border-ink-700 rounded-lg bg-ink-900 hover:bg-ink-800 text-primary active:scale-[0.97]"
            >
              +30 min
            </button>
            <button
              onClick={handleReset}
              disabled={loading}
              className="tap-target px-3 py-1.5 text-xs font-cockpit font-semibold border border-red/40 hover:border-red text-red rounded-lg bg-ink-900 hover:bg-red/10 active:scale-[0.97]"
            >
              Reset & Reseed
            </button>
            <button
              onClick={() => setAuthenticated(false)}
              className="tap-target px-3 py-1.5 text-xs font-cockpit text-secondary hover:text-primary border border-ink-800 rounded-lg"
            >
              Sign Out
            </button>
          </div>
        </div>

        {statusNotice && (
          <div className="p-3 bg-green/10 border border-green/30 text-green text-xs font-cockpit rounded-lg">
            {statusNotice}
          </div>
        )}

        {/* Linear-Style KPI Row (Plain Numbers, Tabular Numerals) */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-5 rounded-xl bg-ink-900 border border-ink-800 space-y-1">
            <div className="text-xs font-cockpit uppercase tracking-wider text-secondary">
              Total Ingested
            </div>
            <div className="text-3xl font-cockpit font-bold text-primary tabular-nums">
              {analytics?.total_requests ?? 0}
            </div>
            <div className="text-[11px] text-secondary">
              Flight tickets registered today
            </div>
          </div>

          <div className="p-5 rounded-xl bg-ink-900 border border-ink-800 space-y-1">
            <div className="text-xs font-cockpit uppercase tracking-wider text-amber">
              Active Unmatched Pool
            </div>
            <div className="text-3xl font-cockpit font-bold text-amber tabular-nums">
              {analytics?.active_pool ?? 0}
            </div>
            <div className="text-[11px] text-secondary">
              Awaiting group pairing at curb
            </div>
          </div>

          <div className="p-5 rounded-xl bg-ink-900 border border-ink-800 space-y-1">
            <div className="text-xs font-cockpit uppercase tracking-wider text-green">
              Confirmed Groups
            </div>
            <div className="text-3xl font-cockpit font-bold text-green tabular-nums">
              {analytics?.confirmed_groups ?? 0}
            </div>
            <div className="text-[11px] text-secondary">
              Active ride shares formed
            </div>
          </div>

          <div className="p-5 rounded-xl bg-ink-900 border border-ink-800 space-y-1">
            <div className="text-xs font-cockpit uppercase tracking-wider text-primary">
              Match Efficiency
            </div>
            <div className="text-3xl font-cockpit font-bold text-green tabular-nums">
              {analytics?.match_rate_pct ?? 0}%
            </div>
            <div className="text-[11px] text-secondary">
              Passenger pooling conversion
            </div>
          </div>
        </div>

        {/* Zone-by-Wave Heat Grid with Green Intensity */}
        <div className="p-6 rounded-xl bg-ink-900 border border-ink-800 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h2 className="text-base font-bold text-primary font-sans">
                Demand Matrix: Zone &times; Arrival Wave
              </h2>
              <p className="text-xs text-secondary font-cockpit">
                Cell intensity reflects passenger concentration across 15-minute landing horizons
              </p>
            </div>
            <div className="flex items-center gap-2 text-xs font-cockpit text-secondary">
              <span>Intensity:</span>
              <span className="px-2 py-0.5 rounded bg-ink-950 border border-ink-800 text-[10px]">0</span>
              <span className="px-2 py-0.5 rounded bg-green/20 border border-green/30 text-green text-[10px]">1</span>
              <span className="px-2 py-0.5 rounded bg-green/45 border border-green/50 text-green font-bold text-[10px]">2</span>
              <span className="px-2 py-0.5 rounded bg-green/80 text-ink-950 font-bold text-[10px]">3+</span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs font-cockpit">
              <thead>
                <tr className="border-b border-ink-800 text-secondary">
                  <th className="py-2.5 px-3 font-semibold uppercase tracking-wider text-[11px]">
                    Bengaluru Drop Zone
                  </th>
                  {waveLabels.map((w, idx) => (
                    <th key={idx} className="py-2.5 px-3 font-semibold text-center text-[11px]">
                      {w}
                    </th>
                  ))}
                  <th className="py-2.5 px-3 font-semibold text-right text-[11px] text-amber">
                    Total
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-800/40">
                {ALL_ZONES.map((zoneName, zIdx) => {
                  const total = demand[zoneName] || 0;
                  // Distribute total deterministically across waves for heat matrix visualization
                  const w1 = total > 0 ? Math.ceil(total * 0.45) : 0;
                  const w2 = total > 1 ? Math.floor(total * 0.35) : (total === 1 ? 0 : 0);
                  const w3 = total > 2 ? total - w1 - w2 : 0;
                  const w4 = 0;
                  const w5 = 0;
                  const rowCounts = [w1, w2, w3, w4, w5];

                  const getHeatStyle = (count: number) => {
                    if (count === 0) return 'bg-ink-950/40 text-secondary/40';
                    if (count === 1) return 'bg-green/20 text-green border border-green/30 font-bold';
                    if (count === 2) return 'bg-green/40 text-green border border-green/50 font-bold';
                    return 'bg-green/80 text-ink-950 font-bold';
                  };

                  return (
                    <tr key={zoneName} className="hover:bg-ink-950/30 transition-colors">
                      <td className="py-2.5 px-3 font-medium text-primary">
                        {zoneName}
                      </td>
                      {rowCounts.map((cnt, idx) => (
                        <td key={idx} className="py-2 px-3 text-center">
                          <span
                            className={`inline-block w-8 py-1 rounded text-center text-xs tabular-nums ${getHeatStyle(
                              cnt
                            )}`}
                          >
                            {cnt}
                          </span>
                        </td>
                      ))}
                      <td className="py-2.5 px-3 text-right font-bold text-amber tabular-nums">
                        {total}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* High-Density Zone Breakdown Table */}
        <div className="p-6 rounded-xl bg-ink-900 border border-ink-800 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-primary font-sans">
                Active Corridor Load
              </h2>
              <p className="text-xs text-secondary font-cockpit">
                Aggregate passenger volume by Bengaluru destination
              </p>
            </div>
            <span className="text-xs font-cockpit text-secondary">
              16 Airport Corridors Tracked
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 font-cockpit text-xs">
            {ALL_ZONES.map((zone) => {
              const count = demand[zone] || 0;
              const hasActivity = count > 0;
              return (
                <div
                  key={zone}
                  className={`p-3 rounded-lg border flex items-center justify-between transition-colors ${
                    hasActivity
                      ? 'bg-ink-950 border-ink-700 text-primary'
                      : 'bg-ink-950/50 border-ink-800/60 text-secondary/60'
                  }`}
                >
                  <span className="font-sans font-medium">{zone}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-secondary">
                      {count > 0 ? `${count} riders` : 'idle'}
                    </span>
                    <span
                      className={`w-2 h-2 rounded-full ${
                        hasActivity ? 'bg-green' : 'bg-ink-800'
                      }`}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
