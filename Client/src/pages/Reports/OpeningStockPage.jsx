import React, { useEffect, useState } from 'react';
import axiosClient from '../../api/axiosClient';
import DateRangeFilter from '../../components/DateRangeFilter';

const blankLine = () => ({
  reelWidthInches: '', bf: '', gsm: '', quality: 'Natural',
  reelWeightsText: '', ratePerKg: ''
});

export default function OpeningStockPage() {
  const [date, setDate] = useState(() => {
    const now = new Date();
    return [now.getFullYear(), String(now.getMonth()+1).padStart(2,'0'), String(now.getDate()).padStart(2,'0')].join('-');
  });
  const [reason, setReason] = useState('Opening physical stock at system go-live');
  const [lines, setLines] = useState([blankLine()]);
  const [history, setHistory] = useState([]);
  const [audit, setAudit] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const load = async (dateParams = {}) => {
    setLoading(true);
    try {
      const [adjustments, auditLogs] = await Promise.all([
        axiosClient.get('/controls/opening-stock', { params: dateParams }),
        axiosClient.get('/controls/audit', { params: dateParams })
      ]);
      setHistory(adjustments.data.adjustments || []);
      setAudit(auditLogs.data.logs || []);
    } catch (err) {
      setError(err.response?.data?.message || 'Could not load opening stock history.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const updateLine = (index, field, value) => {
    setLines(current => current.map((line, i) => i === index ? { ...line, [field]: value } : line));
  };

  const submit = async (event) => {
    event.preventDefault();
    setError('');
    setSuccess('');
    const payloadLines = lines.map(line => ({
      reelWidthInches: Number(line.reelWidthInches),
      bf: Number(line.bf),
      gsm: Number(line.gsm),
      quality: line.quality,
      reelWeightsKg: line.reelWeightsText.split(',').map(value => Number(value.trim())),
      ratePerKg: Number(line.ratePerKg)
    }));
    if (payloadLines.some(line => !line.reelWeightsKg.length || line.reelWeightsKg.some(weight => !Number.isFinite(weight) || weight <= 0))) {
      setError('Enter each physical reel weight in kg, separated by commas. Example: 185.5, 192, 177.25');
      return;
    }
    setSaving(true);
    try {
      const result = await axiosClient.post('/controls/opening-stock', {
        adjustmentDate: date,
        reason,
        lines: payloadLines
      });
      setSuccess(result.data.message + ' Reference: ' + result.data.adjustment.adjustmentNumber);
      setLines([blankLine()]);
      await load({ from, to });
    } catch (err) {
      setError(err.response?.data?.message || 'Opening stock could not be posted.');
    } finally {
      setSaving(false);
    }
  };

  const totalReels = lines.reduce((sum, line) => sum + line.reelWeightsText.split(',').filter(x => x.trim()).length, 0);
  const totalWeight = lines.reduce((sum, line) => sum + line.reelWeightsText.split(',').reduce((s,x) => s + (Number(x.trim()) || 0), 0), 0);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-slate-900">Opening Stock & Audit</h1>
        <p className="mt-1 text-sm text-slate-500">Bring existing physical reels into the system without inventing a supplier purchase or party balance.</p>
      </header>

      <form onSubmit={submit} className="space-y-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="text-sm font-medium text-slate-700">Adjustment date
            <input type="date" required value={date} onChange={e => setDate(e.target.value)} className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2" />
          </label>
          <label className="text-sm font-medium text-slate-700">Reason
            <input required minLength={5} value={reason} onChange={e => setReason(e.target.value)} className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2" />
          </label>
        </div>

        {lines.map((line, index) => (
          <section key={index} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-semibold text-slate-800">Reel specification {index + 1}</h2>
              {lines.length > 1 && <button type="button" onClick={() => setLines(current => current.filter((_, i) => i !== index))} className="text-sm text-red-600">Remove</button>}
            </div>
            <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
              <label className="text-xs font-medium text-slate-600">Width (in)
                <input type="number" min="0.01" step="any" required value={line.reelWidthInches} onChange={e => updateLine(index,'reelWidthInches',e.target.value)} className="mt-1 w-full rounded-lg border px-2 py-2 text-sm" />
              </label>
              <label className="text-xs font-medium text-slate-600">BF
                <input type="number" min="0.01" step="any" required value={line.bf} onChange={e => updateLine(index,'bf',e.target.value)} className="mt-1 w-full rounded-lg border px-2 py-2 text-sm" />
              </label>
              <label className="text-xs font-medium text-slate-600">GSM
                <input type="number" min="0.01" step="any" required value={line.gsm} onChange={e => updateLine(index,'gsm',e.target.value)} className="mt-1 w-full rounded-lg border px-2 py-2 text-sm" />
              </label>
              <label className="text-xs font-medium text-slate-600">Quality
                <select value={line.quality} onChange={e => updateLine(index,'quality',e.target.value)} className="mt-1 w-full rounded-lg border bg-white px-2 py-2 text-sm">
                  <option value="Natural">Natural</option><option value="GY">GY</option>
                </select>
              </label>
              <label className="text-xs font-medium text-slate-600">Rate per kg (₹)
                <input type="number" min="0" step="0.01" required value={line.ratePerKg} onChange={e => updateLine(index,'ratePerKg',e.target.value)} className="mt-1 w-full rounded-lg border px-2 py-2 text-sm" />
              </label>
              <label className="text-xs font-medium text-slate-600 sm:col-span-2 lg:col-span-1">Physical reel weights (kg)
                <input required value={line.reelWeightsText} onChange={e => updateLine(index,'reelWeightsText',e.target.value)} placeholder="185.5, 192, 177.25" className="mt-1 w-full rounded-lg border px-2 py-2 text-sm" />
              </label>
            </div>
            <p className="mt-2 text-xs text-slate-500">Enter every reel weight individually, comma-separated. This preserves actual reel-level stock and valuation.</p>
          </section>
        ))}

        <div className="flex flex-wrap items-center justify-between gap-3">
          <button type="button" onClick={() => setLines(current => [...current, blankLine()])} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700">+ Add specification</button>
          <div className="text-right text-sm text-slate-600">{totalReels} reels · {totalWeight.toFixed(2)} kg estimated</div>
        </div>
        {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        {success && <p role="status" className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700">{success}</p>}
        <button disabled={saving} className="rounded-lg bg-blue-700 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60">{saving ? 'Posting...' : 'Post opening stock'}</button>
        <p className="text-xs text-slate-500">Admin-only. Posting is permanent and creates reel records, stock ledger movements and an audit entry in one database transaction. It does not create supplier payable or purchase invoice.</p>
      </form>

      <DateRangeFilter from={from} to={to} onFromChange={setFrom} onToChange={setTo} onApply={() => load({ from, to })} onReset={() => { setFrom(''); setTo(''); load({}); }} loading={loading} label="Opening stock / audit date range" />
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <div className="border-b p-5"><h2 className="font-semibold text-slate-900">Opening stock history</h2></div>
        {loading ? <p className="p-5 text-sm text-slate-500">Loading...</p> : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px] text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="px-4 py-3">Reference</th><th className="px-4 py-3">Date</th><th className="px-4 py-3">Reason</th><th className="px-4 py-3 text-right">Reels</th><th className="px-4 py-3 text-right">Weight</th><th className="px-4 py-3">Created by</th></tr></thead>
              <tbody className="divide-y">
                {history.map(item => <tr key={item._id}><td className="px-4 py-3 font-medium">{item.adjustmentNumber}</td><td className="px-4 py-3">{new Date(item.adjustmentDate).toLocaleDateString('en-IN')}</td><td className="px-4 py-3">{item.reason}</td><td className="px-4 py-3 text-right">{item.totalReels}</td><td className="px-4 py-3 text-right">{Number(item.totalWeightKg?.$numberDecimal || item.totalWeightKg || 0).toFixed(2)} kg</td><td className="px-4 py-3">{item.createdBy?.name || '—'}</td></tr>)}
                {!history.length && <tr><td colSpan="6" className="p-8 text-center text-slate-500">No opening stock adjustments yet.</td></tr>}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <div className="border-b p-5"><h2 className="font-semibold text-slate-900">Recent audit events</h2></div>
        <div className="divide-y">
          {audit.slice(0,30).map(item => <div key={item._id} className="flex flex-wrap justify-between gap-2 px-5 py-3 text-sm"><div><p className="font-medium text-slate-800">{item.summary}</p><p className="text-xs text-slate-500">{item.actorName} · {item.actorRole} · {item.entityLabel}</p></div><time className="text-xs text-slate-500">{new Date(item.createdAt).toLocaleString('en-IN')}</time></div>)}
          {!audit.length && !loading && <p className="p-5 text-sm text-slate-500">No audit events recorded yet.</p>}
        </div>
      </section>
    </div>
  );
}
