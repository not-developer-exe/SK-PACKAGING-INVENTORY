import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { dashboardService } from '../services/dashboardService';
import { Layers3, Factory, Package, ArrowRight, Loader2, Trash2, RefreshCw } from 'lucide-react';

const number = (value, digits = 0) => Number(value ?? 0).toLocaleString('en-IN', { maximumFractionDigits: digits });

export default function Overview() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchStats = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await dashboardService.getStats();
      setStats({
        reels: data?.reels ?? {},
        boxes: data?.boxes ?? {},
        waste: data?.waste ?? {},
        recentActivity: Array.isArray(data?.recentActivity) ? data.recentActivity : []
      });
    } catch (err) {
      setError(err.response?.data?.message || 'Could not load dashboard data. Check your connection and try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchStats(); }, [fetchStats]);

  if (loading && !stats) return <div className="flex h-64 items-center justify-center gap-3 text-slate-500"><Loader2 className="animate-spin text-blue-600" size={28} /><span>Loading factory overview…</span></div>;

  if (error && !stats) return (
    <section className="mx-auto mt-12 max-w-xl rounded-2xl border border-red-200 bg-white p-8 text-center shadow-sm">
      <h1 className="text-lg font-semibold text-slate-900">Dashboard unavailable</h1>
      <p className="mt-2 text-sm text-slate-600">{error}</p>
      <button onClick={fetchStats} className="mt-5 inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"><RefreshCw size={16} /> Retry</button>
    </section>
  );

  const cards = [
    { title: 'Raw Paper', value: number(stats?.reels?.weightKg, 1), unit: 'kg', detail: `Across ${number(stats?.reels?.count)} physical reels`, label: 'View Inventory', to: '/inventory/reels', icon: Layers3, tone: 'blue' },
    { title: 'Finished Boxes', value: number(stats?.boxes?.count), unit: '', detail: `In ${number(stats?.boxes?.batches)} warehouse batches`, label: 'Dispatch Stock', to: '/operations/dispatch', icon: Package, tone: 'emerald' },
    { title: 'Production', value: 'Recorded', unit: '', detail: 'Review production activity and consumption', label: 'View Production', to: '/operations/production', icon: Factory, tone: 'purple' },
    { title: 'Machine Waste', value: number(stats?.waste?.thisMonthKg, 1), unit: 'kg', detail: 'Generated this month', label: 'View Register', to: '/operations/waste', icon: Trash2, tone: 'amber' }
  ];

  const tones = {
    blue: 'text-blue-600 bg-blue-50',
    emerald: 'text-emerald-600 bg-emerald-50',
    purple: 'text-purple-600 bg-purple-50',
    amber: 'text-amber-600 bg-amber-50'
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Factory Overview</h1>
          <p className="mt-1 text-sm text-slate-500">Live metrics from your corrugation plant.</p>
        </div>
        <button onClick={fetchStats} disabled={loading} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-60"><RefreshCw size={15} className={loading ? 'animate-spin' : ''} /> Refresh</button>
      </div>

      {error && <div role="alert" className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">{error} Showing the last successfully loaded figures.</div>}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map(({ title, value, unit, detail, label, to, icon: Icon, tone }) => (
          <article key={title} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:shadow-md">
            <div className="flex items-center gap-3"><div className={`rounded-lg p-2 ${tones[tone]}`}><Icon size={20} /></div><h2 className="font-semibold text-slate-900">{title}</h2></div>
            <p className="mt-4 text-3xl font-bold text-slate-900">{value} {unit && <span className="text-base font-medium text-slate-500">{unit}</span>}</p>
            <p className="mt-1 text-sm text-slate-500">{detail}</p>
            <Link to={to} className="mt-5 inline-flex items-center gap-1 text-sm font-medium text-blue-600 hover:text-blue-700">{label} <ArrowRight size={16} /></Link>
          </article>
        ))}
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-6 py-4"><h3 className="font-semibold text-slate-900">Recent Dispatches</h3></div>
        <div className="divide-y divide-slate-100">
          {stats?.recentActivity?.length ? stats.recentActivity.map((dispatch) => (
            <div key={dispatch._id || dispatch.challanNumber} className="flex flex-wrap items-center justify-between gap-3 px-6 py-4 hover:bg-slate-50">
              <div><p className="font-medium text-slate-900">{dispatch.customerId?.name || 'Unknown Customer'}</p><p className="text-sm text-slate-500">Challan: {dispatch.challanNumber || '—'} | Vehicle: {dispatch.vehicleNumber || 'N/A'}</p></div>
              <time className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700">{dispatch.createdAt ? new Date(dispatch.createdAt).toLocaleDateString('en-IN') : 'Date unavailable'}</time>
            </div>
          )) : <p className="p-6 text-sm text-slate-500">No recent dispatches.</p>}
        </div>
      </section>
    </div>
  );
}