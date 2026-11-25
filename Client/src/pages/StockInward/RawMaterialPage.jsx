import React, { useEffect, useMemo, useState } from 'react';
import axiosClient from '../../api/axiosClient';
import { Plus, Search, ArrowDownToLine, ArrowUpFromLine, Package, AlertTriangle, Clock3, X, RefreshCw, Loader2 } from 'lucide-react';

const today = () => { const d = new Date(); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10); };
const blankMaterial = { code: '', name: '', category: 'consumable', uom: 'pcs', reorderLevel: '0' };
const blankMovement = { materialId: '', movementType: 'inward', quantity: '', rate: '0', movementDate: today(), reference: '', notes: '' };
const categories = ['adhesive', 'packing', 'printing', 'consumable', 'other'];

export default function RawMaterialPage() {
  const [materials, setMaterials] = useState([]);
  const [movements, setMovements] = useState([]);
  const [form, setForm] = useState(blankMaterial);
  const [movement, setMovement] = useState(blankMovement);
  const [showNew, setShowNew] = useState(false);
  const [showMovement, setShowMovement] = useState(false);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [movementFilter, setMovementFilter] = useState('all');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const [materialsResponse, movementsResponse] = await Promise.all([
        axiosClient.get('/raw-materials'),
        axiosClient.get('/raw-materials/movements')
      ]);
      setMaterials(materialsResponse.data.materials || []);
      setMovements(movementsResponse.data.movements || []);
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Unable to load raw material stock.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const lowStock = useMemo(
    () => materials.filter(material => material.isActive && Number(material.currentQty || 0) <= Number(material.reorderLevel || 0)),
    [materials]
  );
  const activeMaterials = useMemo(() => materials.filter(material => material.isActive), [materials]);
  const filteredMaterials = useMemo(() => materials.filter(material => {
    const matchesSearch = [material.code, material.name].some(value => String(value || '').toLowerCase().includes(search.toLowerCase()));
    const matchesCategory = categoryFilter === 'all' || material.category === categoryFilter;
    return matchesSearch && matchesCategory;
  }), [materials, search, categoryFilter]);
  const filteredMovements = useMemo(() => movements.filter(item => movementFilter === 'all' || item.movementType === movementFilter), [movements, movementFilter]);

  const create = async event => {
    event.preventDefault();
    setBusy(true); setError(''); setSuccess('');
    try {
      await axiosClient.post('/raw-materials', form);
      setForm(blankMaterial);
      setShowNew(false);
      setSuccess('Raw material master created.');
      await load();
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Unable to create raw material.');
    } finally { setBusy(false); }
  };

  const postMovement = async event => {
    event.preventDefault();
    setBusy(true); setError(''); setSuccess('');
    try {
      await axiosClient.post('/raw-materials/movements', movement);
      const selected = materials.find(material => material._id === movement.materialId);
      setSuccess((movement.movementType === 'inward' ? 'Received ' : 'Issued ') + (selected?.name || 'material') + ' successfully.');
      setMovement({ ...blankMovement, materialId: movement.materialId, movementDate: today() });
      setShowMovement(false);
      await load();
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Unable to post stock movement.');
    } finally { setBusy(false); }
  };

  const field = 'w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100';
  const label = 'mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500';
  const button = 'inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60';

  return <div className="mx-auto max-w-7xl space-y-6">
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div><p className="text-xs font-semibold uppercase tracking-widest text-blue-700">Inventory · Consumables</p><h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">Raw Material Stock</h1><p className="mt-1 text-sm text-slate-500">Manage glue, packing, printing and other production consumables with inward and issue history.</p></div>
      <div className="flex flex-wrap gap-2"><button type="button" onClick={() => { setError(''); setShowNew(true); }} className={button + ' border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'}><Plus size={16}/> Add material</button><button type="button" onClick={() => { setError(''); setMovement({ ...blankMovement, materialId: materials.find(material => material.isActive)?._id || '' }); setShowMovement(true); }} disabled={!activeMaterials.length} className={button + ' bg-blue-700 text-white hover:bg-blue-800'}><ArrowDownToLine size={16}/> Receive / issue stock</button></div>
    </div>

    {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
    {success && <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{success}</div>}

    <div className="grid gap-4 sm:grid-cols-3">
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><div className="flex items-center gap-3"><span className="rounded-xl bg-blue-50 p-2.5 text-blue-700"><Package size={20}/></span><div><p className="text-xs text-slate-500">Active materials</p><p className="text-2xl font-bold tabular-nums text-slate-900">{activeMaterials.length}</p></div></div><p className="mt-3 text-xs text-slate-500">Registered raw-material items</p></div>
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><div className="flex items-center gap-3"><span className="rounded-xl bg-amber-50 p-2.5 text-amber-700"><AlertTriangle size={20}/></span><div><p className="text-xs text-slate-500">At / below reorder level</p><p className="text-2xl font-bold tabular-nums text-slate-900">{lowStock.length}</p></div></div><p className="mt-3 text-xs text-slate-500">Materials that need a stock check</p></div>
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><div className="flex items-center gap-3"><span className="rounded-xl bg-violet-50 p-2.5 text-violet-700"><Clock3 size={20}/></span><div><p className="text-xs text-slate-500">Movements recorded</p><p className="text-2xl font-bold tabular-nums text-slate-900">{movements.length}</p></div></div><p className="mt-3 text-xs text-slate-500">Inward, issues and stock adjustments</p></div>
    </div>

    {lowStock.length > 0 && <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900"><strong>{lowStock.length} item(s)</strong> are at or below their reorder level. Review the balances before the next production run.</div>}

    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-col gap-3 border-b border-slate-100 p-5 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="font-semibold text-slate-900">Material register</h2><p className="mt-1 text-xs text-slate-500">Current available quantities and reorder thresholds.</p></div><button type="button" onClick={load} className="inline-flex items-center gap-2 self-start rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"><RefreshCw size={14}/> Refresh</button></div>
      <div className="grid gap-3 border-b border-slate-100 p-4 sm:grid-cols-[minmax(220px,1fr)_200px]">
        <div className="relative"><Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search by material code or name" className={field + ' pl-9'}/></div>
        <select value={categoryFilter} onChange={event => setCategoryFilter(event.target.value)} className={field}><option value="all">All categories</option>{categories.map(category => <option key={category} value={category}>{category[0].toUpperCase() + category.slice(1)}</option>)}</select>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-left text-sm"><thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-5 py-3">Code</th><th className="px-5 py-3">Material</th><th className="px-5 py-3">Category</th><th className="px-5 py-3">Unit</th><th className="px-5 py-3 text-right">Available</th><th className="px-5 py-3 text-right">Reorder level</th><th className="px-5 py-3">Stock status</th></tr></thead>
          <tbody className="divide-y divide-slate-100">{filteredMaterials.map(material => {
            const qty = Number(material.currentQty || 0);
            const isLow = material.isActive && qty <= Number(material.reorderLevel || 0);
            return <tr key={material._id} className="hover:bg-slate-50"><td className="px-5 py-4 font-semibold text-slate-800">{material.code}</td><td className="px-5 py-4 font-medium text-slate-900">{material.name}</td><td className="px-5 py-4 capitalize text-slate-600">{material.category}</td><td className="px-5 py-4 text-slate-600">{material.uom}</td><td className="px-5 py-4 text-right font-semibold tabular-nums">{qty.toLocaleString('en-IN', { maximumFractionDigits: 3 })}</td><td className="px-5 py-4 text-right tabular-nums text-slate-600">{Number(material.reorderLevel || 0).toLocaleString('en-IN')} {material.uom}</td><td className="px-5 py-4">{!material.isActive ? <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">Inactive</span> : isLow ? <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-800">Reorder</span> : <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">Available</span>}</td></tr>;
          })}{!filteredMaterials.length && <tr><td colSpan="7" className="px-5 py-10 text-center text-sm text-slate-500">{loading ? 'Loading materials…' : 'No materials match your search.'}</td></tr>}</tbody>
        </table>
      </div>
    </section>

    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-col gap-3 border-b border-slate-100 p-5 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="font-semibold text-slate-900">Movement history</h2><p className="mt-1 text-xs text-slate-500">Every inward or issue changes the live balance and is recorded here.</p></div><select value={movementFilter} onChange={event => setMovementFilter(event.target.value)} className={field + ' sm:max-w-56'}><option value="all">All movements</option><option value="inward">Inward</option><option value="issue">Issue / consumption</option><option value="adjustment_in">Adjustment +</option><option value="adjustment_out">Adjustment −</option></select></div>
      <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left text-sm"><thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-5 py-3">Date</th><th className="px-5 py-3">Material</th><th className="px-5 py-3">Movement</th><th className="px-5 py-3 text-right">Quantity</th><th className="px-5 py-3 text-right">Balance after</th><th className="px-5 py-3">Reference</th></tr></thead><tbody className="divide-y divide-slate-100">{filteredMovements.map(item => <tr key={item._id} className="hover:bg-slate-50"><td className="px-5 py-3">{new Date(item.movementDate).toLocaleDateString('en-IN')}</td><td className="px-5 py-3 font-medium text-slate-800">{item.materialId?.name || 'Material'}</td><td className="px-5 py-3 capitalize">{item.movementType.replaceAll('_', ' ')}</td><td className="px-5 py-3 text-right tabular-nums">{Number(item.quantity).toLocaleString('en-IN')} {item.materialId?.uom || ''}</td><td className="px-5 py-3 text-right tabular-nums">{Number(item.balanceAfter).toLocaleString('en-IN')}</td><td className="px-5 py-3">{item.reference || '—'}</td></tr>)}{!filteredMovements.length && <tr><td colSpan="6" className="px-5 py-10 text-center text-sm text-slate-500">No movements found.</td></tr>}</tbody></table></div>
    </section>

    {showNew && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4"><form onSubmit={create} className="w-full max-w-2xl rounded-2xl bg-white shadow-2xl"><div className="flex items-center justify-between border-b border-slate-100 p-5"><div><h2 className="font-bold text-slate-900">Add raw material</h2><p className="mt-1 text-xs text-slate-500">Create the item once, then record inward and consumption movements against it.</p></div><button type="button" onClick={() => setShowNew(false)} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"><X size={18}/></button></div>{error && <div role="alert" className="mx-5 mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}<div className="grid gap-3 p-5 sm:grid-cols-2">
      <div><label className={label}>Material code *</label><input required value={form.code} onChange={event => setForm({ ...form, code: event.target.value })} placeholder="e.g. GLU-001" className={field}/></div>
      <div><label className={label}>Material name *</label><input required value={form.name} onChange={event => setForm({ ...form, name: event.target.value })} placeholder="e.g. Starch glue" className={field}/></div>
      <div><label className={label}>Category *</label><select value={form.category} onChange={event => setForm({ ...form, category: event.target.value })} className={field}>{categories.map(category => <option key={category} value={category}>{category[0].toUpperCase() + category.slice(1)}</option>)}</select></div>
      <div><label className={label}>Unit of measure *</label><select value={form.uom} onChange={event => setForm({ ...form, uom: event.target.value })} className={field}>{['kg','g','litre','ml','pcs','roll','box','bundle'].map(unit => <option key={unit} value={unit}>{unit}</option>)}</select></div>
      <div className="sm:col-span-2"><label className={label}>Reorder level</label><input type="number" min="0" step="0.001" value={form.reorderLevel} onChange={event => setForm({ ...form, reorderLevel: event.target.value })} className={field}/></div>
    </div><div className="flex justify-end gap-2 border-t border-slate-100 p-5"><button type="button" onClick={() => setShowNew(false)} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700">Cancel</button><button disabled={busy} className="rounded-xl bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60">{busy ? 'Saving…' : 'Save material'}</button></div></form></div>}

    {showMovement && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4"><form onSubmit={postMovement} className="w-full max-w-2xl rounded-2xl bg-white shadow-2xl"><div className="flex items-center justify-between border-b border-slate-100 p-5"><div><h2 className="font-bold text-slate-900">Record raw material movement</h2><p className="mt-1 text-xs text-slate-500">Inward adds to available stock; issue reduces it for production or use.</p></div><button type="button" onClick={() => setShowMovement(false)} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"><X size={18}/></button></div>{error && <div role="alert" className="mx-5 mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}<div className="space-y-4 p-5">
      <div className="grid grid-cols-2 rounded-xl bg-slate-100 p-1"><button type="button" aria-pressed={movement.movementType === 'inward'} onClick={() => setMovement({ ...movement, movementType: 'inward' })} className={movement.movementType === 'inward' ? 'rounded-lg bg-white px-3 py-2.5 text-sm font-bold text-emerald-700 shadow-sm' : 'rounded-lg px-3 py-2.5 text-sm font-semibold text-slate-500'}><ArrowDownToLine size={15} className="mr-2 inline"/>Inward</button><button type="button" aria-pressed={movement.movementType === 'issue'} onClick={() => setMovement({ ...movement, movementType: 'issue' })} className={movement.movementType === 'issue' ? 'rounded-lg bg-white px-3 py-2.5 text-sm font-bold text-amber-700 shadow-sm' : 'rounded-lg px-3 py-2.5 text-sm font-semibold text-slate-500'}><ArrowUpFromLine size={15} className="mr-2 inline"/>Issue / consumption</button></div>
      <div><label className={label}>Material *</label><select required value={movement.materialId} onChange={event => setMovement({ ...movement, materialId: event.target.value })} className={field}><option value="">Select material</option>{activeMaterials.map(material => <option key={material._id} value={material._id}>{material.code} — {material.name} ({material.currentQty} {material.uom} available)</option>)}</select></div>
      <div className="grid gap-3 sm:grid-cols-3"><div><label className={label}>Quantity *</label><input required type="number" min="0.000001" step="any" value={movement.quantity} onChange={event => setMovement({ ...movement, quantity: event.target.value })} className={field}/></div><div><label className={label}>Rate per unit (₹)</label><input type="number" min="0" step="any" value={movement.rate} onChange={event => setMovement({ ...movement, rate: event.target.value })} className={field}/></div><div><label className={label}>Movement date *</label><input required type="date" value={movement.movementDate} onChange={event => setMovement({ ...movement, movementDate: event.target.value })} className={field}/></div></div>
      <div><label className={label}>Bill / reference</label><input value={movement.reference} onChange={event => setMovement({ ...movement, reference: event.target.value })} placeholder="Invoice number, production reference…" className={field}/></div><div><label className={label}>Notes</label><textarea rows="2" value={movement.notes} onChange={event => setMovement({ ...movement, notes: event.target.value })} className={field} placeholder="Optional notes"/></div>
    </div><div className="flex justify-end gap-2 border-t border-slate-100 p-5"><button type="button" onClick={() => setShowMovement(false)} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700">Cancel</button><button disabled={busy || !activeMaterials.length} className="inline-flex items-center gap-2 rounded-xl bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60">{busy && <Loader2 size={15} className="animate-spin"/>}{movement.movementType === 'inward' ? 'Post inward' : 'Post issue'}</button></div></form></div>}
  </div>;
}
