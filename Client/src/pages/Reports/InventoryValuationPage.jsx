import React, { useEffect, useState } from 'react';
import { RefreshCw, PackageCheck, AlertTriangle, CalendarDays, Layers3 } from 'lucide-react';
import axiosClient from '../../api/axiosClient';
import DateRangeFilter from '../../components/DateRangeFilter';

const money = value => '₹' + Number(value || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 });
const number = value => Number(value || 0).toLocaleString('en-IN', { maximumFractionDigits: 3 });

export default function InventoryValuationPage() {
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [groupBy, setGroupBy] = useState('day');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = async (params = {}) => {
    setLoading(true); setError('');
    try {
      const response = await axiosClient.get('/reports/inventory-valuation', { params: { ...params, groupBy: params.groupBy || groupBy } });
      setData(response.data);
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to load inventory valuation.');
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const valuation = data?.valuation;
  const rows = valuation?.lines || [];
  const movements = data?.dailyMonthlyMovements || [];

  return <div className="mx-auto max-w-7xl space-y-6">
    <header className="flex flex-wrap items-center justify-between gap-3">
      <div><h1 className="text-2xl font-bold tracking-tight text-slate-900">Inventory Valuation</h1>
        <p className="mt-1 text-sm text-slate-500">Current stock value with daily or monthly movement history.</p></div>
      <button onClick={() => load({ from, to })} disabled={loading} className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 disabled:opacity-60"><RefreshCw size={15} className="mr-2 inline" />Refresh</button>
    </header>

    <DateRangeFilter from={from} to={to} onFromChange={setFrom} onToChange={setTo} onApply={() => load({ from, to })} onReset={() => { setFrom(''); setTo(''); load({}); }} loading={loading} label="Movement date range" />
    {error && <p role="alert" className="rounded-lg border border-red-100 bg-red-50 p-3 text-sm text-red-700">{error}</p>}
    {loading && !data ? <p className="rounded-xl border bg-white p-10 text-center text-sm text-slate-500">Calculating stock valuation…</p> : data && <>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Metric icon={PackageCheck} label="Known stock value" value={money(valuation.knownStockValue)} detail="Only inventory with a usable cost rate" />
        <Metric icon={Layers3} label="Valued lines" value={valuation.valuedCategories} detail="Stock groups with a rate" />
        <Metric icon={AlertTriangle} label="Pending costing" value={valuation.pendingCategories} detail="Missing or zero rate; excluded from total" />
        <Metric icon={CalendarDays} label="As-of date" value={new Date(data.asOf).toLocaleDateString('en-IN')} detail="Live inventory snapshot" />
      </div>
      {!valuation.complete && <p className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">Valuation is incomplete. Some stock lines have no usable cost rate; these are listed as pending and are not included in the known stock value.</p>}
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <div className="border-b border-slate-100 p-4"><h2 className="font-semibold text-slate-900">Current stock valuation</h2><p className="text-xs text-slate-500">Quantity is current on-hand balance. Rates use recorded batch or average material costs.</p></div>
        <div className="overflow-x-auto"><table className="w-full min-w-[850px] text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="p-3">Stock category</th><th className="p-3 text-right">Quantity</th><th className="p-3">UOM</th><th className="p-3 text-right">Average rate</th><th className="p-3 text-right">Stock value</th><th className="p-3">Costing</th></tr></thead>
          <tbody className="divide-y">{rows.map((line, i) => <tr key={line.category + i}><td className="p-3 font-medium text-slate-800">{line.category}</td><td className="p-3 text-right tabular-nums">{number(line.quantity)}</td><td className="p-3">{line.unit}</td><td className="p-3 text-right">{line.averageRate === null ? '—' : money(line.averageRate)}</td><td className="p-3 text-right font-semibold">{line.stockValue === null ? '—' : money(line.stockValue)}</td><td className="p-3"><span className={line.costingStatus === 'available' ? 'text-emerald-700' : 'text-amber-700'}>{line.costingStatus === 'available' ? 'Available' : 'Pending'}</span></td></tr>)}
          {!rows.length && <tr><td colSpan={6} className="p-8 text-center text-slate-500">No current inventory found.</td></tr>}</tbody>
        </table></div>
      </section>
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 p-4"><div><h2 className="font-semibold text-slate-900">Daily / monthly stock movement</h2><p className="text-xs text-slate-500">Quantity and weight movements; this is not a historical closing valuation.</p></div>
          <div className="flex gap-2">{[['day','Daily'],['month','Monthly']].map(([value,label]) => <button key={value} onClick={() => { setGroupBy(value); load({ from, to, groupBy: value }); }} className={'rounded-lg px-3 py-2 text-sm font-medium ' + (groupBy === value ? 'bg-blue-600 text-white' : 'border border-slate-200 text-slate-600')}>{label}</button>)}</div>
        </div>
        <div className="overflow-x-auto"><table className="w-full min-w-[800px] text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="p-3">{groupBy === 'day' ? 'Date' : 'Month'}</th><th className="p-3 text-right">Stock movements</th><th className="p-3 text-right">Net weight change (kg)</th><th className="p-3 text-right">Net quantity change</th><th className="p-3 text-right">Raw material movements</th><th className="p-3 text-right">Raw material qty change</th><th className="p-3 text-right">Raw material movement value</th></tr></thead>
          <tbody className="divide-y">{movements.map(row => <tr key={row.key}><td className="p-3 font-medium">{row.key}</td><td className="p-3 text-right">{row.stockMovements}</td><td className="p-3 text-right">{number(row.weightInKg)}</td><td className="p-3 text-right">{number(row.quantityChange)}</td><td className="p-3 text-right">{row.rawMaterialMovements}</td><td className="p-3 text-right">{number(row.rawMaterialQuantity)}</td><td className="p-3 text-right">{money(row.rawMaterialValue)}</td></tr>)}
          {!movements.length && <tr><td colSpan={7} className="p-8 text-center text-slate-500">No stock movements found in this period.</td></tr>}</tbody>
        </table></div>
      </section>
      <p className="text-xs text-slate-500">Important: this report does not back-calculate historical opening or closing values. Legacy records with missing rates remain pending. Verify physical opening stock and historical rates before using any figure as a formal month-end valuation.</p>
    </>}
  </div>;
}

function Metric({ icon: Icon, label, value, detail }) {
  return <div className="rounded-2xl border border-slate-200 bg-white p-5"><p className="flex items-center gap-2 text-sm text-slate-500"><Icon size={15} />{label}</p><p className="mt-2 text-2xl font-bold text-slate-900">{value}</p><p className="mt-1 text-xs text-slate-500">{detail}</p></div>;
}
