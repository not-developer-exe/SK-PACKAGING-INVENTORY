import React, { useEffect, useState } from 'react';
import axiosClient from '../../api/axiosClient';

const blank = { code: '', name: '', category: 'consumable', uom: 'pcs', reorderLevel: '0' };
const movementBlank = { materialId: '', movementType: 'inward', quantity: '', rate: '0', movementDate: new Date().toLocaleDateString('en-CA'), reference: '', notes: '' };

export default function RawMaterialPage() {
  const [materials, setMaterials] = useState([]);
  const [movements, setMovements] = useState([]);
  const [form, setForm] = useState(blank);
  const [movement, setMovement] = useState(movementBlank);
  const [showNew, setShowNew] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const [a,b] = await Promise.all([axiosClient.get('/raw-materials'), axiosClient.get('/raw-materials/movements')]);
    setMaterials(a.data.materials || []);
    setMovements(b.data.movements || []);
  };
  useEffect(() => { load().catch(e => setError(e.message)); }, []);

  const create = async e => {
    e.preventDefault(); setBusy(true); setError('');
    try { await axiosClient.post('/raw-materials', form); setForm(blank); setShowNew(false); await load(); }
    catch (e) { setError(e.response?.data?.message || e.message); } finally { setBusy(false); }
  };
  const postMovement = async e => {
    e.preventDefault(); setBusy(true); setError('');
    try { await axiosClient.post('/raw-materials/movements', movement); setMovement({...movementBlank, materialId: movement.materialId}); await load(); }
    catch (e) { setError(e.response?.data?.message || e.message); } finally { setBusy(false); }
  };

  return <div className="space-y-6">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><h1 className="text-2xl font-bold text-slate-900">Raw Material Stock</h1><p className="mt-1 text-sm text-slate-500">Consumables, adhesives, packing and printing materials.</p></div><button onClick={()=>setShowNew(v=>!v)} className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white">{showNew ? 'Close' : 'Add material'}</button></div>
    {error && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
    {showNew && <form onSubmit={create} className="grid gap-3 rounded-xl border bg-white p-4 sm:grid-cols-5">
      <input required placeholder="Code" value={form.code} onChange={e=>setForm({...form,code:e.target.value})} className="rounded-lg border px-3 py-2 text-sm"/>
      <input required placeholder="Material name" value={form.name} onChange={e=>setForm({...form,name:e.target.value})} className="rounded-lg border px-3 py-2 text-sm"/>
      <select value={form.category} onChange={e=>setForm({...form,category:e.target.value})} className="rounded-lg border px-3 py-2 text-sm"><option value="adhesive">Adhesive</option><option value="packing">Packing</option><option value="printing">Printing</option><option value="consumable">Consumable</option><option value="other">Other</option></select>
      <select value={form.uom} onChange={e=>setForm({...form,uom:e.target.value})} className="rounded-lg border px-3 py-2 text-sm">{['kg','g','litre','ml','pcs','roll','box','bundle'].map(v=><option key={v}>{v}</option>)}</select>
      <input type="number" min="0" step="0.001" placeholder="Reorder level" value={form.reorderLevel} onChange={e=>setForm({...form,reorderLevel:e.target.value})} className="rounded-lg border px-3 py-2 text-sm"/>
      <button disabled={busy} className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50 sm:col-span-5">Save material</button>
    </form>}
    <form onSubmit={postMovement} className="grid gap-3 rounded-xl border bg-white p-4 sm:grid-cols-4">
      <h2 className="font-semibold text-slate-900 sm:col-span-4">Record stock movement</h2>
      <select required value={movement.materialId} onChange={e=>setMovement({...movement,materialId:e.target.value})} className="rounded-lg border px-3 py-2 text-sm"><option value="">Select material</option>{materials.filter(m=>m.isActive).map(m=><option key={m._id} value={m._id}>{m.code} — {m.name}</option>)}</select>
      <select value={movement.movementType} onChange={e=>setMovement({...movement,movementType:e.target.value})} className="rounded-lg border px-3 py-2 text-sm"><option value="inward">Inward</option><option value="issue">Issue / Consumption</option><option value="adjustment_in">Adjustment +</option><option value="adjustment_out">Adjustment −</option></select>
      <input required type="number" min="0.000001" step="0.001" placeholder="Quantity" value={movement.quantity} onChange={e=>setMovement({...movement,quantity:e.target.value})} className="rounded-lg border px-3 py-2 text-sm"/>
      <input type="number" min="0" step="0.01" placeholder="Rate per unit" value={movement.rate} onChange={e=>setMovement({...movement,rate:e.target.value})} className="rounded-lg border px-3 py-2 text-sm"/>
      <input type="date" value={movement.movementDate} onChange={e=>setMovement({...movement,movementDate:e.target.value})} className="rounded-lg border px-3 py-2 text-sm"/>
      <input placeholder="Reference (bill / production)" value={movement.reference} onChange={e=>setMovement({...movement,reference:e.target.value})} className="rounded-lg border px-3 py-2 text-sm"/>
      <input placeholder="Notes" value={movement.notes} onChange={e=>setMovement({...movement,notes:e.target.value})} className="rounded-lg border px-3 py-2 text-sm"/>
      <button disabled={busy || !materials.length} className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">Post movement</button>
    </form>
    <section className="overflow-hidden rounded-xl border bg-white"><div className="border-b p-4 font-semibold">Current material balances</div><div className="overflow-x-auto"><table className="w-full min-w-[650px] text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="p-3">Code</th><th className="p-3">Material</th><th className="p-3">Category</th><th className="p-3">Unit</th><th className="p-3 text-right">Available</th><th className="p-3 text-right">Reorder at</th></tr></thead><tbody className="divide-y">{materials.map(m=><tr key={m._id}><td className="p-3 font-medium">{m.code}</td><td className="p-3">{m.name}</td><td className="p-3 capitalize">{m.category}</td><td className="p-3">{m.uom}</td><td className="p-3 text-right tabular-nums">{Number(m.currentQty||0).toLocaleString('en-IN')}</td><td className="p-3 text-right tabular-nums">{m.reorderLevel}</td></tr>)}{!materials.length && <tr><td colSpan="6" className="p-6 text-center text-slate-500">No raw materials added yet.</td></tr>}</tbody></table></div></section>
    <section className="overflow-hidden rounded-xl border bg-white"><div className="border-b p-4 font-semibold">Movement history</div><div className="overflow-x-auto"><table className="w-full min-w-[700px] text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="p-3">Date</th><th className="p-3">Material</th><th className="p-3">Movement</th><th className="p-3 text-right">Quantity</th><th className="p-3 text-right">Balance after</th><th className="p-3">Reference</th></tr></thead><tbody className="divide-y">{movements.map(m=><tr key={m._id}><td className="p-3">{new Date(m.movementDate).toLocaleDateString('en-IN')}</td><td className="p-3">{m.materialId?.name || 'Material'}</td><td className="p-3 capitalize">{m.movementType.replaceAll('_',' ')}</td><td className="p-3 text-right tabular-nums">{m.quantity} {m.materialId?.uom}</td><td className="p-3 text-right tabular-nums">{m.balanceAfter}</td><td className="p-3">{m.reference || '—'}</td></tr>)}{!movements.length && <tr><td colSpan="6" className="p-6 text-center text-slate-500">No movements recorded yet.</td></tr>}</tbody></table></div></section>
  </div>;
}
