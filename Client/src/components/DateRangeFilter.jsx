import React from 'react';
import { CalendarDays, RotateCcw } from 'lucide-react';

export default function DateRangeFilter({ from, to, onFromChange, onToChange, onApply, onReset, loading = false, label = 'Filter records by date' }) {
  return (
    <form onSubmit={(event) => { event.preventDefault(); onApply(); }} className="flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-white p-4">
      <div className="mr-1 flex items-center gap-2 text-sm font-semibold text-slate-700">
        <CalendarDays size={16} className="text-slate-500" /> {label}
      </div>
      <label className="text-xs font-medium text-slate-600">
        From
        <input type="date" value={from} max={to || undefined} onChange={(event) => onFromChange(event.target.value)} className="mt-1 block rounded-lg border border-slate-200 px-3 py-2 text-sm" />
      </label>
      <label className="text-xs font-medium text-slate-600">
        To
        <input type="date" value={to} min={from || undefined} onChange={(event) => onToChange(event.target.value)} className="mt-1 block rounded-lg border border-slate-200 px-3 py-2 text-sm" />
      </label>
      <button type="submit" disabled={loading} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">{loading ? 'Loading…' : 'Apply'}</button>
      <button type="button" onClick={onReset} disabled={loading} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 disabled:opacity-60"><RotateCcw size={14} /> All dates</button>
    </form>
  );
}
