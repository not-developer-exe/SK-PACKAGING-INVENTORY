import React, { useEffect, useState } from 'react';
import axiosClient from '../../api/axiosClient';

const today = () => new Date().toLocaleDateString('en-CA');
const blankLine = () => ({ reelId: '', weightConsumedKg: '' });

export default function ReelCuttingPage() {
  const [data, setData] = useState({ reels: [], batches: [] });
  const [form, setForm] = useState({ cutDate: today(), lengthInches: '', widthInches: '', sheetCount: '', outputWeightKg: '', recoverableWasteKg: '0', notes: '', inputs: [blankLine()] });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const load = async () => { const res = await axiosClient.get('/reel-cutting'); setData({ reels: res.data.reels || [], batches: res.data.batches || [] }); };
  useEffect(() => { load().catch(e => setError(e.response?.data?.message || e.message)).finally(() => setLoading(false)); }, []);
  const updateLine = (i, key, value) => setForm(f => ({ ...f, inputs: f.inputs.map((line, index) => index === i ? { ...line, [key]: value } : line) }));
  const addLine = () => setForm(f => f.inputs.length >= 10 ? f : ({ ...f, inputs: [...f.inputs, blankLine()] }));
  const removeLine = i => setForm(f => ({ ...f, inputs: f.inputs.length <= 1 ? f.inputs : f.inputs.filter((_, index) => index !== i) }));
  const totalInput = form.inputs.reduce((sum, line) => sum + Number(line.weightConsumedKg || 0), 0);
  const balance = totalInput - Number(form.outputWeightKg || 0) - Number(form.recoverableWasteKg || 0);
  const submit = async e => {
    e.preventDefault(); setBusy(true); setError('');
    try {
      await axiosClient.post('/reel-cutting', form);
      setForm({ cutDate: today(), lengthInches: '', widthInches: '', sheetCount: '', outputWeightKg: '', recoverableWasteKg: '0', notes: '', inputs: [blankLine()] });
      await load();
    } catch (e) { setError(e.response?.data?.message || e.message); }
    finally { setBusy(false); }
  };
  const inputClass = 'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm';
  return <div className="space-y-6">
    <header><h1 className="text-2xl font-bold text-slate-900">Reel-to-Cut-Sheet Conversion</h1><p className="mt-1 text-sm text-slate-500">Record paper reels issued to the in-house cutter and create traceable cut-sheet batches with weight, scrap and material costing.</p></header>
    {error && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
    <form onSubmit={submit} className="space-y-5 rounded-xl border bg-white p-5">
      <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="font-semibold">New cutting entry</h2><span className="text-xs text-slate-500">Up to 10 source reels per batch</span></div>
      <div className="grid gap-3 sm:grid-cols-4">
        <label className="text-xs text-slate-600">Cutting date<input className={inputClass+' mt-1'} type="date" required value={form.cutDate} onChange={e=>setForm({...form,cutDate:e.target.value})}/></label>
        <label className="text-xs text-slate-600">Sheet length (in)<input className={inputClass+' mt-1'} type="number" min="0.01" step="0.01" required value={form.lengthInches} onChange={e=>setForm({...form,lengthInches:e.target.value})}/></label>
        <label className="text-xs text-slate-600">Sheet width (in)<input className={inputClass+' mt-1'} type="number" min="0.01" step="0.01" required value={form.widthInches} onChange={e=>setForm({...form,widthInches:e.target.value})}/></label>
        <label className="text-xs text-slate-600">Number of sheets<input className={inputClass+' mt-1'} type="number" min="1" step="1" required value={form.sheetCount} onChange={e=>setForm({...form,sheetCount:e.target.value})}/></label>
      </div>
      <div className="space-y-3">
        <div className="flex items-center justify-between"><h3 className="text-sm font-semibold">Source reels and issued weight</h3><button type="button" onClick={addLine} disabled={form.inputs.length>=10} className="rounded-lg border px-3 py-1.5 text-xs font-semibold disabled:opacity-40">Add reel</button></div>
        {form.inputs.map((line,i)=><div key={i} className="grid gap-2 sm:grid-cols-[1fr_180px_auto]">
          <select required className={inputClass} value={line.reelId} onChange={e=>updateLine(i,'reelId',e.target.value)}><option value="">Select reel</option>{data.reels.filter(r=>r._id===line.reelId || !form.inputs.some((x,j)=>j!==i&&x.reelId===r._id)).map(r=><option key={r._id} value={r._id}>{r.reelCode} · {r.reelWidthInches}" · BF {r.bf} · GSM {r.gsm} · {Number(r.remainingWeightKg?.$numberDecimal || r.remainingWeightKg || 0).toFixed(2)} kg available</option>)}</select>
          <input required className={inputClass} type="number" min="0.001" step="0.001" placeholder="Weight issued (kg)" value={line.weightConsumedKg} onChange={e=>updateLine(i,'weightConsumedKg',e.target.value)}/>
          <button type="button" onClick={()=>removeLine(i)} disabled={form.inputs.length===1} className="rounded-lg border px-3 text-xs text-red-600 disabled:opacity-30">Remove</button>
        </div>)}
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="text-xs text-slate-600">Good cut-sheet weight (kg)<input className={inputClass+' mt-1'} type="number" min="0.001" step="0.001" required value={form.outputWeightKg} onChange={e=>setForm({...form,outputWeightKg:e.target.value})}/></label>
        <label className="text-xs text-slate-600">Recoverable scrap (kg)<input className={inputClass+' mt-1'} type="number" min="0" step="0.001" value={form.recoverableWasteKg} onChange={e=>setForm({...form,recoverableWasteKg:e.target.value})}/></label>
        <label className="text-xs text-slate-600">Notes<input className={inputClass+' mt-1'} maxLength="1000" value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})} placeholder="Optional"/></label>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-slate-50 p-3 text-sm"><span>Input: <b>{totalInput.toFixed(3)} kg</b></span><span>Unaccounted process loss: <b className={balance < -0.001 ? 'text-red-600' : 'text-slate-800'}>{balance.toFixed(3)} kg</b></span><button disabled={busy || loading || balance < -0.000001 || totalInput <= 0} className="rounded-lg bg-blue-700 px-5 py-2 font-semibold text-white disabled:opacity-50">{busy?'Saving…':'Save cutting entry'}</button></div>
    </form>
    <section className="overflow-hidden rounded-xl border bg-white"><div className="border-b p-4"><h2 className="font-semibold">Cut-sheet batch register</h2><p className="mt-1 text-xs text-slate-500">Every batch retains its source reel references and calculated material cost.</p></div><div className="overflow-x-auto"><table className="w-full min-w-[900px] text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="p-3">Batch</th><th className="p-3">Date</th><th className="p-3">Dimensions</th><th className="p-3 text-right">Sheets</th><th className="p-3 text-right">Available</th><th className="p-3 text-right">Weight</th><th className="p-3 text-right">Cost/kg</th><th className="p-3">Source reels</th></tr></thead><tbody className="divide-y">{data.batches.map(b=><tr key={b._id}><td className="p-3 font-semibold">{b.batchNumber}</td><td className="p-3">{new Date(b.cutDate).toLocaleDateString('en-IN')}</td><td className="p-3">{b.lengthInches} × {b.widthInches} in</td><td className="p-3 text-right">{b.sheetCount}</td><td className="p-3 text-right">{b.remainingSheets}</td><td className="p-3 text-right">{Number(b.totalWeightKg?.$numberDecimal || b.totalWeightKg || 0).toFixed(3)} kg</td><td className="p-3 text-right">₹{Number(b.unitCostPerKg?.$numberDecimal || b.unitCostPerKg || 0).toFixed(2)}</td><td className="p-3">{(b.sourceReels||[]).map(x=>x.reelCode).join(', ')}</td></tr>)}{!data.batches.length&&<tr><td colSpan="8" className="p-6 text-center text-slate-500">{loading?'Loading…':'No cut-sheet batches recorded yet.'}</td></tr>}</tbody></table></div></section>
  </div>;
}
