import React, { useState, useEffect } from 'react';
import { dashboardService } from '../services/dashboardService';
import { Layers3, Factory, Package, ArrowRight, Loader2, Trash2 } from 'lucide-react';

export default function Overview({ setPage }) {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const data = await dashboardService.getStats();
        setStats(data);
      } catch (error) {
        console.error('Failed to load dashboard:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, []);

  if (loading) return <div className="flex h-64 items-center justify-center"><Loader2 className="animate-spin text-blue-600" size={32} /></div>;

  // Fallback in case stats fail to load properly
  if (!stats) return <div className="p-6 text-red-500">Failed to load dashboard statistics.</div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Factory Overview</h1>
        <p className="mt-1 text-sm text-slate-500">Live metrics from your corrugation plant.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Raw Material Card */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:shadow-md">
          <div className="flex items-center gap-3 text-blue-600">
            <div className="rounded-lg bg-blue-50 p-2"><Layers3 size={20} /></div>
            <h2 className="font-semibold text-slate-900">Raw Paper</h2>
          </div>
          <div className="mt-4">
            <p className="text-3xl font-bold text-slate-900">{stats.reels.weightKg.toLocaleString('en-IN', { maximumFractionDigits: 0 })} <span className="text-base text-slate-500">kg</span></p>
            <p className="mt-1 text-sm text-slate-500">Across {stats.reels.count} physical reels</p>
          </div>
          <button onClick={() => setPage('Reel Stock')} className="mt-5 flex items-center gap-1 text-sm font-medium text-blue-600 hover:text-blue-700">
            View Inventory <ArrowRight size={16} />
          </button>
        </div>

        {/* Finished Goods Card */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:shadow-md">
          <div className="flex items-center gap-3 text-emerald-600">
            <div className="rounded-lg bg-emerald-50 p-2"><Package size={20} /></div>
            <h2 className="font-semibold text-slate-900">Finished Boxes</h2>
          </div>
          <div className="mt-4">
            <p className="text-3xl font-bold text-slate-900">{stats.boxes.count.toLocaleString('en-IN')}</p>
            <p className="mt-1 text-sm text-slate-500">In {stats.boxes.batches} warehouse batches</p>
          </div>
          <button onClick={() => setPage('Box Dispatch')} className="mt-5 flex items-center gap-1 text-sm font-medium text-emerald-600 hover:text-emerald-700">
            Dispatch Stock <ArrowRight size={16} />
          </button>
        </div>

        {/* Production Card */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:shadow-md">
          <div className="flex items-center gap-3 text-purple-600">
            <div className="rounded-lg bg-purple-50 p-2"><Factory size={20} /></div>
            <h2 className="font-semibold text-slate-900">Production</h2>
          </div>
          <div className="mt-4">
            <p className="text-3xl font-bold text-slate-900">Active</p>
            <p className="mt-1 text-sm text-slate-500">Corrugator operations online</p>
          </div>
          <button onClick={() => setPage('Production')} className="mt-5 flex items-center gap-1 text-sm font-medium text-purple-600 hover:text-purple-700">
            Run Machine <ArrowRight size={16} />
          </button>
        </div>

        {/* Waste Card */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:shadow-md">
          <div className="flex items-center gap-3 text-amber-600">
            <div className="rounded-lg bg-amber-50 p-2"><Trash2 size={20} /></div>
            <h2 className="font-semibold text-slate-900">Machine Waste</h2>
          </div>
          <div className="mt-4">
            <p className="text-3xl font-bold text-slate-900">{stats.waste.thisMonthKg.toLocaleString('en-IN', { maximumFractionDigits: 0 })} <span className="text-base text-slate-500">kg</span></p>
            <p className="mt-1 text-sm text-slate-500">Generated this month</p>
          </div>
          <button onClick={() => setPage('Waste Register')} className="mt-5 flex items-center gap-1 text-sm font-medium text-amber-600 hover:text-amber-700">
            View Register <ArrowRight size={16} />
          </button>
        </div>
      </div>

      {/* Recent Dispatches */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-6 py-4">
          <h3 className="font-semibold text-slate-900">Recent Dispatches</h3>
        </div>
        <div className="divide-y divide-slate-100">
          {stats.recentActivity.length === 0 ? (
            <p className="p-6 text-sm text-slate-500">No recent dispatches.</p>
          ) : (
            stats.recentActivity.map(dispatch => (
              <div key={dispatch._id} className="flex items-center justify-between px-6 py-4 hover:bg-slate-50 transition">
                <div>
                  <p className="font-medium text-slate-900">{dispatch.customerId?.name || 'Unknown Customer'}</p>
                  <p className="text-sm text-slate-500">Challan: {dispatch.challanNumber} | Vehicle: {dispatch.vehicleNumber || 'N/A'}</p>
                </div>
                <div className="text-right">
                  <span className="inline-flex rounded-full bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700">
                    {new Date(dispatch.createdAt).toLocaleDateString('en-IN')}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}