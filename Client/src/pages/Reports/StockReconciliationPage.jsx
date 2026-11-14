import React, { useEffect, useMemo, useState } from 'react';
import { ClipboardCheck, RefreshCw } from 'lucide-react';
import axiosClient from '../../api/axiosClient';
import DateRangeFilter from '../../components/DateRangeFilter';
import { toLocalDateInput } from '../../lib/date';

export default function StockReconciliationPage() {
  const [reels, setReels] = useState([]);
  const [counts, setCounts] = useState({});
  const [history, setHistory] = useState([]);
  const [date, setDate] = useState(toLocalDateInput());
  const [reason, setReason] = useState('Physical stock verification');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const load = async (dateParams = {}) => {
    setLoading(true);
    setError('');
    try {
      const [candidateResponse, historyResponse] = await Promise.all([
        axiosClient.get('/controls/stock-reconciliation/candidates'),
        axiosClient.get('/controls/stock-reconciliation', { params: dateParams })
      ]);
      setReels(candidateResponse.data.reels || []);
      setHistory(historyResponse.data.reconciliations || []);
      setCounts({});
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to load current reel stock.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const entered = useMemo(() => Object.entries(counts).filter(([, value]) => value !== '' && value !== undefined), [counts]);
  const estimatedVariance = entered.reduce((sum, [id, value]) => {
    const reel = reels.find((item) => item._id === id);
    return sum + (Number(value) - Number(reel?.remainingWeightKg || 0));
  }, 0);

  const submit = async (event) => {
    event.preventDefault();
    setError('');
    setSuccess('');
    if (!entered.length) {
      setError('Enter a physical count for at least one reel.');
      return;
    }
    setSaving(true);
    try {
      const { data } = await axiosClient.post('/controls/stock-reconciliation', {
        countedAt: date,
        reason,
        lines: entered.map(([reelId, countedWeightKg]) => ({ reelId, countedWeightKg: Number(countedWeightKg) }))
      });
      setSuccess(data.message + ' Reference: ' + data.reconciliation.reconciliationNumber);
      await load({ from, to });
    } catch (err) {
      setError(err.response?.data?.message || 'Stock reconciliation could not be posted.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div><h1 className="text-2xl font-bold text-slate-900">Physical Stock Reconciliation</h1><p className="mt-1 text-sm text-slate-500">Compare reel-level system weights with the actual weights on the factory floor.</p></div>
        <button onClick={load} disabled={loading} className="rounded-lg border bg-white px-3 py-2 text-sm"><RefreshCw size={15} className="mr-1 inline" />Refresh</button>
      </header>
      {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      {success && <p role="status" className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700">{success}</p>}

      <form onSubmit={submit} className="space-y-4 rounded-2xl border bg-white p-5">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm">Count date<input type="date" required value={date} onChange={(e) => setDate(e.target.value)} className="mt-1 block w-full rounded-lg border px-3 py-2" /></label>
          <label className="text-sm">Reason<input required minLength="5" value={reason} onChange={(e) => setReason(e.target.value)} className="mt-1 block w-full rounded-lg border px-3 py-2" /></label>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2"><div><h2 className="font-semibold text-slate-900">Active physical reels</h2><p className="text-xs text-slate-500">Leave a row blank to skip it. Enter 0 if the reel is physically missing or fully depleted.</p></div><div className="text-sm text-slate-600">{entered.length} of {reels.length} counted · estimated variance {estimatedVariance >= 0 ? '+' : ''}{estimatedVariance.toFixed(3)} kg</div></div>
        {loading ? <p className="p-8 text-center text-sm text-slate-500">Loading reels...</p> : (
          <div className="overflow-x-auto rounded-xl border">
            <table className="w-full min-w-[800px] text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="px-3 py-3">Reel ID</th><th className="px-3 py-3">Specification</th><th className="px-3 py-3 text-right">Original kg</th><th className="px-3 py-3 text-right">System kg</th><th className="px-3 py-3">Physical kg</th><th className="px-3 py-3 text-right">Variance kg</th></tr></thead>
              <tbody className="divide-y">
                {reels.map((reel) => {
                  const value = counts[reel._id];
                  const variance = value === '' || value === undefined ? null : Number(value) - reel.remainingWeightKg;
                  return <tr key={reel._id}>
                    <td className="px-3 py-3 font-medium">{reel.reelCode}</td>
                    <td className="px-3 py-3">{reel.reelWidthInches}" · BF {reel.bf} · {reel.gsm} GSM · {reel.quality}</td>
                    <td className="px-3 py-3 text-right">{reel.originalWeightKg.toFixed(3)}</td>
                    <td className="px-3 py-3 text-right">{reel.remainingWeightKg.toFixed(3)}</td>
                    <td className="px-3 py-2"><input type="number" min="0" max={reel.originalWeightKg} step="0.001" value={value ?? ''} onChange={(e) => setCounts((current) => ({ ...current, [reel._id]: e.target.value }))} placeholder="Enter kg" className="w-32 rounded-lg border px-2 py-1.5 text-right" /></td>
                    <td className={'px-3 py-3 text-right font-semibold ' + (variance === null ? 'text-slate-400' : variance < 0 ? 'text-rose-600' : variance > 0 ? 'text-emerald-700' : 'text-slate-500')}>{variance === null ? '—' : (variance > 0 ? '+' : '') + variance.toFixed(3)}</td>
                  </tr>;
                })}
                {!reels.length && <tr><td colSpan="6" className="p-8 text-center text-slate-500">No active reels available for counting.</td></tr>}
              </tbody>
            </table>
          </div>
        )}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="max-w-2xl text-xs text-slate-500">Posting changes the live remaining weight and writes a stock-ledger adjustment and audit entry in one database transaction. It does not alter the original reel weight or supplier purchase record.</p>
          <button disabled={saving || loading || !entered.length} className="rounded-lg bg-blue-700 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50"><ClipboardCheck size={16} className="mr-2 inline" />{saving ? 'Posting...' : 'Post reconciliation'}</button>
        </div>
      </form>

      <DateRangeFilter from={from} to={to} onFromChange={setFrom} onToChange={setTo} onApply={() => load({ from, to })} onReset={() => { setFrom(''); setTo(''); load({}); }} loading={loading} label="Reconciliation date range" />
      <section className="overflow-hidden rounded-2xl border bg-white">
        <div className="border-b p-5"><h2 className="font-semibold">Reconciliation history</h2></div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[700px] text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="px-4 py-3">Reference</th><th className="px-4 py-3">Date</th><th className="px-4 py-3">Reason</th><th className="px-4 py-3 text-right">Reels</th><th className="px-4 py-3 text-right">Net variance</th><th className="px-4 py-3">By</th></tr></thead>
            <tbody className="divide-y">
              {history.map((item) => <tr key={item._id}><td className="px-4 py-3 font-medium">{item.reconciliationNumber}</td><td className="px-4 py-3">{new Date(item.countedAt).toLocaleDateString('en-IN')}</td><td className="px-4 py-3">{item.reason}</td><td className="px-4 py-3 text-right">{item.lines?.length || 0}</td><td className="px-4 py-3 text-right">{Number(item.totalVarianceKg?.$numberDecimal || item.totalVarianceKg || 0).toFixed(3)} kg</td><td className="px-4 py-3">{item.createdBy?.name || '—'}</td></tr>)}
              {!history.length && <tr><td colSpan="6" className="p-8 text-center text-slate-500">No reconciliation history yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
