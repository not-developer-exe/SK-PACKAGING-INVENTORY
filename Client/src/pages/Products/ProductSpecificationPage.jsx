import React, { useEffect, useMemo, useState } from 'react';
import { Archive, ClipboardList, Pencil, Plus, RefreshCw, Save, X } from 'lucide-react';
import { partiesService } from '../../services/partiesService';
import { productSpecificationService } from '../../services/productSpecificationService';

const emptyForm = {
  customerId: '', productName: '', ply: '3',
  dimensions: { length: '', width: '', height: '' },
  sheetSpecification: { lengthInches: '', widthInches: '' },
  sheetsPerBox: '1', expectedKgPerBox: '', notes: ''
};

const number = (value, digits = 3) => Number(value?.$numberDecimal ?? value ?? 0).toFixed(digits);

export default function ProductSpecificationPage() {
  const [products, setProducts] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editing, setEditing] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const [productRows, customerRows] = await Promise.all([
        productSpecificationService.getAll(),
        partiesService.getCustomers()
      ]);
      setProducts(productRows);
      setCustomers(customerRows);
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to load product specifications.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const grouped = useMemo(() => products, [products]);
  const setField = (key, value) => setForm(current => ({ ...current, [key]: value }));
  const setNested = (group, key, value) => setForm(current => ({ ...current, [group]: { ...current[group], [key]: value } }));

  const edit = product => {
    setEditing(product._id);
    setForm({
      customerId: product.customerId?._id || product.customerId || '',
      productName: product.productName,
      ply: String(product.ply),
      dimensions: {
        length: String(product.dimensions?.length || ''),
        width: String(product.dimensions?.width || ''),
        height: String(product.dimensions?.height || '')
      },
      sheetSpecification: {
        lengthInches: String(product.sheetSpecification?.lengthInches || ''),
        widthInches: String(product.sheetSpecification?.widthInches || '')
      },
      sheetsPerBox: String(product.sheetsPerBox),
      expectedKgPerBox: number(product.expectedKgPerBox),
      notes: product.notes || ''
    });
    setError('');
    setSuccess('');
  };

  const reset = () => { setEditing(null); setForm(emptyForm); };

  const submit = async event => {
    event.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      const payload = {
        ...form,
        ply: Number(form.ply),
        dimensions: Object.fromEntries(Object.entries(form.dimensions).map(([key, value]) => [key, Number(value)])),
        sheetSpecification: Object.fromEntries(Object.entries(form.sheetSpecification).map(([key, value]) => [key, Number(value)])),
        sheetsPerBox: Number(form.sheetsPerBox),
        expectedKgPerBox: Number(form.expectedKgPerBox)
      };
      if (editing) await productSpecificationService.update(editing, payload);
      else await productSpecificationService.create(payload);
      setSuccess(editing ? 'Product specification updated.' : 'Product specification created.');
      reset();
      await load();
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to save product specification.');
    } finally {
      setSaving(false);
    }
  };

  const archive = async product => {
    if (!window.confirm('Archive ' + product.productName + '? Existing production and finished-goods records will be retained.')) return;
    setError('');
    setSuccess('');
    try {
      await productSpecificationService.archive(product._id);
      setProducts(current => current.filter(row => row._id !== product._id));
      setSuccess('Product specification archived.');
      if (editing === product._id) reset();
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to archive product specification.');
    }
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Product Specifications & BOM</h1>
          <p className="mt-1 text-sm text-slate-500">Maintain customer-wise box specifications and standard material consumption.</p>
        </div>
        <button type="button" onClick={load} disabled={loading} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 disabled:opacity-60"><RefreshCw size={15} /> Refresh</button>
      </div>

      <form onSubmit={submit} className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900"><ClipboardList size={19} /> {editing ? 'Edit product specification' : 'Add product specification'}</h2>
          {editing && <button type="button" onClick={reset} className="inline-flex items-center gap-1 text-sm text-slate-500"><X size={15} /> Cancel edit</button>}
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <label className="text-sm font-medium text-slate-700">Customer *
            <select required value={form.customerId} onChange={e => setField('customerId', e.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2">
              <option value="">Select customer</option>
              {customers.map(customer => <option key={customer._id} value={customer._id}>{customer.name}</option>)}
            </select>
          </label>
          <label className="text-sm font-medium text-slate-700">Product / Box name *
            <input required minLength="2" maxLength="120" value={form.productName} onChange={e => setField('productName', e.target.value)} placeholder="e.g. 5kg Apple Box" className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2" />
          </label>
          <label className="text-sm font-medium text-slate-700">Ply *
            <select value={form.ply} onChange={e => setField('ply', e.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2">
              {[3,5,7,9].map(value => <option key={value} value={value}>{value} Ply</option>)}
            </select>
          </label>
          <label className="text-sm font-medium text-slate-700">Sheets per box *
            <input type="number" min="0.0001" step="0.0001" required value={form.sheetsPerBox} onChange={e => setField('sheetsPerBox', e.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2" />
          </label>
        </div>

        <div className="grid gap-4 rounded-xl bg-slate-50 p-4 sm:grid-cols-3">
          <div className="sm:col-span-3 text-xs font-bold uppercase tracking-wide text-slate-500">Finished box dimensions (inches)</div>
          {['length','width','height'].map(key => <label key={key} className="text-sm font-medium capitalize text-slate-700">{key} *
            <input type="number" min="0.01" step="0.01" required value={form.dimensions[key]} onChange={e => setNested('dimensions',key,e.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2" />
          </label>)}
        </div>

        <div className="grid gap-4 rounded-xl bg-slate-50 p-4 sm:grid-cols-3">
          <div className="sm:col-span-3 text-xs font-bold uppercase tracking-wide text-slate-500">Corrugated sheet specification (inches)</div>
          <label className="text-sm font-medium text-slate-700">Sheet length *
            <input type="number" min="0.01" step="0.01" required value={form.sheetSpecification.lengthInches} onChange={e => setNested('sheetSpecification','lengthInches',e.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2" />
          </label>
          <label className="text-sm font-medium text-slate-700">Sheet width *
            <input type="number" min="0.01" step="0.01" required value={form.sheetSpecification.widthInches} onChange={e => setNested('sheetSpecification','widthInches',e.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2" />
          </label>
          <label className="text-sm font-medium text-slate-700">Expected kg per box *
            <input type="number" min="0.0001" step="0.0001" required value={form.expectedKgPerBox} onChange={e => setField('expectedKgPerBox',e.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2" />
          </label>
        </div>
        <label className="block text-sm font-medium text-slate-700">Notes
          <textarea maxLength="500" rows="2" value={form.notes} onChange={e => setField('notes',e.target.value)} placeholder="Optional manufacturing notes" className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2" />
        </label>

        {error && <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        {success && <p className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">{success}</p>}
        <button disabled={saving} className="inline-flex items-center gap-2 rounded-lg bg-blue-700 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60"><Save size={16} /> {saving ? 'Saving…' : editing ? 'Update specification' : 'Save specification'}</button>
      </form>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <div><h2 className="font-semibold text-slate-900">Active product specifications</h2><p className="text-xs text-slate-500">{grouped.length} active products</p></div>
          <span className="text-xs text-slate-500">{loading ? 'Loading…' : 'Customer-wise BOM register'}</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1050px] text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr>
              <th className="px-4 py-3">Customer / Product</th><th className="px-4 py-3">Box spec</th><th className="px-4 py-3">Sheet spec</th><th className="px-4 py-3 text-right">Sheets / box</th><th className="px-4 py-3 text-right">Expected kg / box</th><th className="px-4 py-3 text-right">Actions</th>
            </tr></thead>
            <tbody className="divide-y divide-slate-100">
              {products.map(product => <tr key={product._id}>
                <td className="px-4 py-3"><div className="font-semibold text-slate-900">{product.productName}</div><div className="text-xs text-slate-500">{product.customerId?.name || '—'} · {product.ply} Ply</div></td>
                <td className="px-4 py-3">{product.dimensions?.length} × {product.dimensions?.width} × {product.dimensions?.height}</td>
                <td className="px-4 py-3">{product.sheetSpecification?.lengthInches} × {product.sheetSpecification?.widthInches}</td>
                <td className="px-4 py-3 text-right tabular-nums">{number(product.sheetsPerBox,4)}</td>
                <td className="px-4 py-3 text-right tabular-nums">{number(product.expectedKgPerBox,4)} kg</td>
                <td className="px-4 py-3"><div className="flex justify-end gap-2">
                  <button type="button" onClick={() => edit(product)} className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-700"><Pencil size={13} /> Edit</button>
                  <button type="button" onClick={() => archive(product)} className="inline-flex items-center gap-1 rounded-md border border-amber-200 px-2.5 py-1.5 text-xs font-medium text-amber-800"><Archive size={13} /> Archive</button>
                </div></td>
              </tr>)}
              {!products.length && <tr><td colSpan="6" className="px-4 py-10 text-center text-sm text-slate-500">{loading ? 'Loading product specifications…' : 'No product specifications yet. Add the first BOM above.'}</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
