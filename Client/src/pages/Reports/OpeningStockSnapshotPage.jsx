import React, { useEffect, useState } from 'react';
import axiosClient from '../../api/axiosClient';

const money = value => Number(value || 0).toLocaleString('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 });
const number = value => value == null ? '—' : Number(value).toLocaleString('en-IN', { maximumFractionDigits: 3 });

export default function OpeningStockSnapshotPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  useEffect(() => {
    axiosClient.get('/opening-stock-snapshot', { params: { date: '2026-11-01' } })
      .then(response => setData(response.data))
      .catch(err => setError(err.response?.data?.message || 'Could not load the 1 November stock baseline.'))
      .finally(() => setLoading(false));
  }, []);
  return <div className="space-y-6">
    <header><h1 className="text-2xl font-bold text-slate-900">Opening Stock — 1 November 2026</h1>
      <p className="mt-1 text-sm text-slate-500">Imported workbook baseline. This is a reference snapshot, not a purchase or a stock movement.</p></header>
    {loading && <p className="text-sm text-slate-500">Loading opening stock…</p>}
    {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
    {data && <>
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border bg-white p-4"><p className="text-xs text-slate-500">Categories</p><p className="mt-1 text-2xl font-semibold">{data.totals.categories}</p></div>
        <div className="rounded-xl border bg-white p-4"><p className="text-xs text-slate-500">Recorded weight</p><p className="mt-1 text-2xl font-semibold">{number(data.totals.totalWeightKg)} kg</p></div>
        <div className="rounded-xl border bg-white p-4"><p className="text-xs text-slate-500">Workbook value</p><p className="mt-1 text-2xl font-semibold">{money(data.totals.totalAmount)}</p></div>
      </div>
      <div className="overflow-x-auto rounded-xl border bg-white">
        <table className="w-full min-w-[760px] text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500"><tr><th className="px-4 py-3">Category</th><th className="px-4 py-3">Source sheet</th><th className="px-4 py-3 text-right">Quantity</th><th className="px-4 py-3 text-right">Weight (kg)</th><th className="px-4 py-3 text-right">Amount</th><th className="px-4 py-3">Detail status</th></tr></thead>
          <tbody className="divide-y">{data.records.map(row => <tr key={row._id}><td className="px-4 py-3 font-medium">{row.categoryLabel}</td><td className="px-4 py-3">{row.sourceSheet}</td><td className="px-4 py-3 text-right">{number(row.totalQuantity)}</td><td className="px-4 py-3 text-right">{number(row.totalWeightKg)}</td><td className="px-4 py-3 text-right">{money(row.totalAmount)}</td><td className="px-4 py-3">{row.importStatus === 'detailed' ? 'Detailed rows' : 'Summary only'}</td></tr>)}</tbody>
        </table>
      </div>
      <p className="text-xs text-amber-700">This page displays the imported opening snapshot separately. It does not yet adjust live reel, roll, production or finished-goods balances.</p>
    </>}
  </div>;
}
