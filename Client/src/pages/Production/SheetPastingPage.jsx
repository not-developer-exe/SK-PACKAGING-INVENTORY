import React, { useEffect, useState } from 'react';
import axiosClient from '../../api/axiosClient';
import { pastingService } from '../../services/pastingService';
import { conversionService } from '../../services/conversionService';
import { Loader2, Layers, RefreshCw } from 'lucide-react';

const today = () => { const d = new Date(); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0,10); };
const kg = (v) => Number(v?.$numberDecimal || v || 0);

export default function SheetPastingPage() {
  const [sheets, setSheets] = useState([]);
  const [facing, setFacing] = useState([]);
  const [runs, setRuns] = useState([]);
  const [rawMaterials, setRawMaterials] = useState([]);
  const [rawMaterialConsumptions, setRawMaterialConsumptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [form, setForm] = useState({ runDate:today(), operatorName:'', machineName:'', sourceSheetId:'', facingBatchId:'', sheetsConsumed:'', facingSheetsConsumed:'', outputSheetCount:'', outputWeightKg:'', adhesiveWeightKg:'', wasteWeightKg:'0', notes:'' });

  const refresh = async () => {
    setLoading(true);
    try {
      const [allSheets, batches, history, materials] = await Promise.all([conversionService.getAvailableSheets(), pastingService.getFacingMaterial(), pastingService.getPastingRuns(), axiosClient.get('/raw-materials?activeOnly=true')]);
      setSheets(allSheets.filter(s => Number(s.ply) === 2 && Number(s.sheetCount) > 0));
      setFacing(batches.filter(b => ['available','partial'].includes(b.status) && Number(b.remainingSheets) > 0));
      setRuns(history);
      setRawMaterials(materials.data.materials || []);
    } catch (e) { setError(e.response?.data?.message || e.message || 'Unable to load pasting data.'); }
    finally { setLoading(false); }
  };
  useEffect(() => { refresh(); }, []);

  const submitPasting = async (e) => {
    e.preventDefault(); setSaving(true); setError(''); setSuccess('');
    try {
      const result = await pastingService.recordPasting({ ...form, sheetsConsumed:Number(form.sheetsConsumed), facingSheetsConsumed:Number(form.facingSheetsConsumed), outputSheetCount:Number(form.outputSheetCount), outputWeightKg:Number(form.outputWeightKg), adhesiveWeightKg:Number(form.adhesiveWeightKg || 0), wasteWeightKg:Number(form.wasteWeightKg || 0), rawMaterialConsumptions:rawMaterialConsumptions.filter(x=>x.materialId&&Number(x.quantity)>0).map(x=>({materialId:x.materialId,quantity:Number(x.quantity)})) });
      setSuccess('Pasting run ' + result.run.runNumber + ' recorded. New 3-ply batch is ready for box conversion.');
      setForm({ runDate:today(), operatorName:'', machineName:'', sourceSheetId:'', facingBatchId:'', sheetsConsumed:'', facingSheetsConsumed:'', outputSheetCount:'', outputWeightKg:'', adhesiveWeightKg:'', wasteWeightKg:'0', notes:'' }); setRawMaterialConsumptions([]); await refresh();
    } catch(e) { setError(e.response?.data?.message || e.message || 'Pasting failed.'); }
    finally { setSaving(false); }
  };

  if (loading) return <div className="flex h-64 items-center justify-center"><Loader2 className="animate-spin text-blue-600" size={32}/></div>;
  const field = 'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm';
  const label = 'mb-1 block text-xs font-semibold text-slate-600';
  return <div className="mx-auto max-w-6xl space-y-6">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><h1 className="text-2xl font-bold text-slate-900">Sheet Pasting</h1><p className="mt-1 text-sm text-slate-500">Worker 2 · Issue 2-ply sheets and Duplex stock received through Stock Inward to create 3-ply sheets.</p></div><button onClick={refresh} className="flex items-center gap-2 rounded-lg border bg-white px-3 py-2 text-sm"><RefreshCw size={15}/> Refresh</button></div>
    {error && <div role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>}
    {success && <div role="status" className="rounded-lg bg-green-50 p-3 text-sm text-green-700">{success}</div>}
    <section className="rounded-2xl border border-emerald-200 bg-emerald-50/40 p-5 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2"><div><h2 className="font-semibold text-emerald-900">Raw materials consumed in pasting</h2><p className="text-xs text-emerald-800">Optional · issue gum, silicate or other consumables in their registered UOM. Adhesive weight above remains a process measurement.</p></div><button type="button" onClick={()=>setRawMaterialConsumptions([...rawMaterialConsumptions,{materialId:'',quantity:''}])} className="rounded-lg border border-emerald-300 bg-white px-3 py-2 text-xs font-semibold text-emerald-800">+ Add material</button></div>
      {rawMaterialConsumptions.map((line,index)=>{const selected=rawMaterials.find(m=>m._id===line.materialId);return <div key={index} className="grid grid-cols-12 gap-2"><select value={line.materialId} onChange={e=>{const next=[...rawMaterialConsumptions];next[index]={...next[index],materialId:e.target.value};setRawMaterialConsumptions(next);}} className="col-span-7 rounded-lg border border-emerald-200 bg-white px-3 py-2 text-sm"><option value="">Select raw material</option>{rawMaterials.map(m=><option key={m._id} value={m._id}>{m.code} · {m.name} ({m.currentQty} {m.uom} available)</option>)}</select><div className="col-span-4"><input type="number" min="0.000001" step="any" required value={line.quantity} onChange={e=>{const next=[...rawMaterialConsumptions];next[index]={...next[index],quantity:e.target.value};setRawMaterialConsumptions(next);}} placeholder={selected?'Quantity ('+selected.uom+')':'Quantity'} className="w-full rounded-lg border border-emerald-200 bg-white px-3 py-2 text-sm"/><p className="mt-1 text-[11px] text-emerald-800">{selected?'Rate ₹'+Number(selected.averageRate||0).toFixed(2)+' / '+selected.uom:'Choose a material first'}</p></div><button type="button" onClick={()=>setRawMaterialConsumptions(rawMaterialConsumptions.filter((_,i)=>i!==index))} className="col-span-1 text-red-600">×</button></div>;})}
      {!rawMaterials.length&&<p className="text-xs text-amber-700">No active raw materials found. Add materials and inward stock first.</p>}
    </section>
<form onSubmit={submitPasting} className="grid gap-4 rounded-2xl border bg-white p-5 md:grid-cols-3">
      <div><label className={label}>Production date *</label><input className={field} type="date" required value={form.runDate} onChange={e=>setForm({...form,runDate:e.target.value})}/></div>
      <div><label className={label}>Worker / operator *</label><input className={field} required value={form.operatorName} onChange={e=>setForm({...form,operatorName:e.target.value})}/></div>
      <div><label className={label}>Machine / line</label><input className={field} value={form.machineName} onChange={e=>setForm({...form,machineName:e.target.value})}/></div>
      <div className="md:col-span-2"><label className={label}>2-ply cut sheet batch *</label><select className={field} required value={form.sourceSheetId} onChange={e=>setForm({...form,sourceSheetId:e.target.value})}><option value="">Select 2-ply stock</option>{sheets.map(s=><option key={s._id} value={s._id}>{s.lengthInches} × {s.widthInches} in · {s.sheetCount} sheets · {kg(s.totalWeightKg).toFixed(2)} kg</option>)}</select></div>
      <div><label className={label}>2-ply sheets consumed *</label><input className={field} type="number" min="1" step="1" required value={form.sheetsConsumed} onChange={e=>setForm({...form,sheetsConsumed:e.target.value})}/></div>
      <div className="md:col-span-2"><label className={label}>Facing material batch *</label><select className={field} required value={form.facingBatchId} onChange={e=>setForm({...form,facingBatchId:e.target.value})}><option value="">Select facing stock</option>{facing.map(b=><option key={b._id} value={b._id}>{b.materialType.replace('_',' + ')} · {b.lengthInches} × {b.widthInches} in · {b.remainingSheets} sheets · {kg(b.remainingWeightKg).toFixed(2)} kg · ₹{kg(b.ratePerKg)}/kg</option>)}</select></div>
      <div><label className={label}>Facing sheets consumed *</label><input className={field} type="number" min="1" step="1" required value={form.facingSheetsConsumed} onChange={e=>setForm({...form,facingSheetsConsumed:e.target.value})}/></div>
      <div><label className={label}>Output 3-ply sheets *</label><input className={field} type="number" min="1" step="1" required value={form.outputSheetCount} onChange={e=>setForm({...form,outputSheetCount:e.target.value})}/></div>
      <div><label className={label}>Output total weight (kg) *</label><input className={field} type="number" min="0.001" step="any" required value={form.outputWeightKg} onChange={e=>setForm({...form,outputWeightKg:e.target.value})}/></div>
      <div><label className={label}>Adhesive weight (kg)</label><input className={field} type="number" min="0" step="any" value={form.adhesiveWeightKg} onChange={e=>setForm({...form,adhesiveWeightKg:e.target.value})}/></div>
      <div><label className={label}>Measured waste (kg)</label><input className={field} type="number" min="0" step="any" value={form.wasteWeightKg} onChange={e=>setForm({...form,wasteWeightKg:e.target.value})}/></div>
      <div className="md:col-span-3"><label className={label}>Notes</label><input className={field} value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})}/></div>
      <div className="md:col-span-3 rounded-lg bg-blue-50 p-3 text-xs text-blue-800">This operation currently creates 3-ply constructed stock only. 5-ply and 7-ply recipes will be enabled once their exact layer arrangements are confirmed. Actual consumed kg is allocated from each batch's remaining weight proportionally by sheets issued.</div>
      <div className="md:col-span-3"><button disabled={saving} className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50"><Layers size={16} className="mr-2 inline"/>{saving?'Saving…':'Record pasting production'}</button></div>
    </form>
    <section className="rounded-2xl border bg-white p-5"><h2 className="mb-3 font-semibold text-slate-900">Recent pasting runs</h2><div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="border-b text-xs uppercase text-slate-500"><tr><th className="py-2">Run</th><th>Date</th><th>Worker</th><th>Output sheets</th><th>Weight</th><th>Material cost</th></tr></thead><tbody>{runs.map(r=><tr key={r._id} className="border-b last:border-0"><td className="py-2">{r.runNumber}</td><td>{new Date(r.runDate).toLocaleDateString('en-IN')}</td><td>{r.operatorName}</td><td>{r.outputSheetCount}</td><td>{kg(r.outputWeightKg).toFixed(2)} kg</td><td>₹{kg(r.materialCost).toFixed(2)}</td></tr>)}{!runs.length&&<tr><td colSpan="6" className="py-4 text-center text-slate-400">No pasting runs recorded</td></tr>}</tbody></table></div></section>
  </div>;
}
