import React, { useEffect, useState } from 'react';
import { Receipt, RefreshCw, Trash2, Pencil, Save, X } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import axiosClient from '../../api/axiosClient';
import DateRangeFilter from '../../components/DateRangeFilter';
import { toLocalDateInput } from '../../lib/date';

const blank = { expenseDate: toLocalDateInput(), category: 'electricity', amount: '', vendor: '', paymentMode: 'bank_transfer', reference: '', description: '', costTreatment: 'operating_expense' };
const categories = ['electricity', 'labour', 'rent', 'freight', 'repairs', 'admin', 'bank_charges', 'interest', 'miscellaneous'];
const money = value => '₹' + Number(value || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 });
const title = value => value.replaceAll('_', ' ').replace(/\b\w/g, c => c.toUpperCase());

export default function ExpensesPage() {
  const { user } = useAuth();
  const [form, setForm] = useState(blank);
  const [expenses, setExpenses] = useState([]);
  const [editing, setEditing] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const load = async (dateParams = {}) => {
    setLoading(true);
    try { const { data } = await axiosClient.get('/expenses', { params: dateParams }); setExpenses(data.expenses || []); setError(''); }
    catch (e) { setError(e.response?.data?.message || 'Unable to load expenses.'); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const submit = async event => {
    event.preventDefault(); setSaving(true); setError(''); setSuccess('');
    try {
      const payload = { ...form, amount: Number(form.amount) };
      if (editing) {
        const { data } = await axiosClient.patch('/expenses/' + editing, payload);
        setExpenses(current => current.map(item => item._id === editing ? data.expense : item));
        setSuccess('Expense updated.');
      } else {
        const { data } = await axiosClient.post('/expenses', payload);
        setExpenses(current => [data.expense, ...current]);
        setSuccess('Expense recorded.');
      }
      setForm(blank); setEditing(null);
    } catch (e) { setError(e.response?.data?.message || 'Unable to save expense.'); }
    finally { setSaving(false); }
  };

  const startEdit = item => {
    setEditing(item._id);
    setForm({ expenseDate: new Date(item.expenseDate).toISOString().slice(0, 10), category: item.category, amount: String(item.amount), vendor: item.vendor || '', paymentMode: item.paymentMode, reference: item.reference || '', description: item.description || '', costTreatment: item.costTreatment || 'operating_expense' });
  };
  const remove = async item => {
    if (!window.confirm('Delete this expense? The action will be written to the audit log.')) return;
    try { await axiosClient.delete('/expenses/' + item._id); setExpenses(current => current.filter(row => row._id !== item._id)); setSuccess('Expense deleted.'); }
    catch (e) { setError(e.response?.data?.message || 'Unable to delete expense.'); }
  };
  const total = expenses.reduce((sum, item) => sum + Number(item.amount || 0), 0);

  return <div className="mx-auto max-w-7xl space-y-6">
    <header><h1 className="text-2xl font-bold text-slate-900">Factory Expenses</h1><p className="mt-1 text-sm text-slate-500">Record operating costs, finance charges and freight treatment for accurate profitability.</p></header>
    {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
    {success && <p role="status" className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700">{success}</p>}
    <form onSubmit={submit} className="grid gap-3 rounded-2xl border bg-white p-5 sm:grid-cols-2 lg:grid-cols-4">
      <label className="text-sm">Date<input type="date" required value={form.expenseDate} onChange={e => setForm({...form, expenseDate:e.target.value})} className="mt-1 block w-full rounded-lg border px-3 py-2" /></label>
      <label className="text-sm">Category<select value={form.category} onChange={e => setForm({...form, category:e.target.value})} className="mt-1 block w-full rounded-lg border bg-white px-3 py-2">{categories.map(c => <option key={c} value={c}>{title(c)}</option>)}</select></label>
      <label className="text-sm">Amount (₹)<input type="number" min="0.01" step="0.01" required value={form.amount} onChange={e => setForm({...form, amount:e.target.value})} className="mt-1 block w-full rounded-lg border px-3 py-2" /></label>
      <label className="text-sm">Vendor / paid to<input maxLength="160" value={form.vendor} onChange={e => setForm({...form, vendor:e.target.value})} className="mt-1 block w-full rounded-lg border px-3 py-2" /></label>
      <label className="text-sm">Payment mode<select value={form.paymentMode} onChange={e => setForm({...form, paymentMode:e.target.value})} className="mt-1 block w-full rounded-lg border bg-white px-3 py-2">{['cash','upi','bank_transfer','cheque','card','other'].map(c => <option key={c} value={c}>{title(c)}</option>)}</select></label>
      <label className="text-sm">Cost treatment<select value={form.costTreatment} onChange={e => setForm({...form, costTreatment:e.target.value})} className="mt-1 block w-full rounded-lg border bg-white px-3 py-2"><option value="operating_expense">Operating expense</option><option value="finance_cost">Finance / interest cost</option><option value="stock_landed_cost">Inward freight / stock landed cost</option></select></label>
      <label className="text-sm">Reference<input maxLength="120" value={form.reference} onChange={e => setForm({...form, reference:e.target.value})} className="mt-1 block w-full rounded-lg border px-3 py-2" /></label>
      <label className="text-sm sm:col-span-2 lg:col-span-2">Description<input maxLength="1000" value={form.description} onChange={e => setForm({...form, description:e.target.value})} className="mt-1 block w-full rounded-lg border px-3 py-2" /></label>
      <div className="flex items-end gap-2"><button disabled={saving} className="rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{saving ? 'Saving…' : editing ? 'Save changes' : 'Record expense'}</button>{editing && <button type="button" onClick={() => {setEditing(null);setForm(blank);}} className="rounded-lg border px-4 py-2.5 text-sm">Cancel</button>}</div>
    </form>
    <DateRangeFilter from={from} to={to} onFromChange={setFrom} onToChange={setTo} onApply={() => load({ from, to })} onReset={() => { setFrom(''); setTo(''); load({}); }} loading={loading} label="Expense date range" />
    <section className="overflow-hidden rounded-2xl border bg-white">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b p-5"><div><h2 className="font-semibold text-slate-900">Expense register</h2><p className="text-xs text-slate-500">{expenses.length} records · latest 1,000</p></div><div className="flex items-center gap-3"><strong>{money(total)}</strong><button onClick={() => load({ from, to })} className="rounded-lg border p-2" title="Refresh"><RefreshCw size={16}/></button></div></div>
      {loading ? <p className="p-6 text-sm text-slate-500">Loading expenses…</p> : <div className="overflow-x-auto"><table className="w-full min-w-[900px] text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="p-3">Date</th><th className="p-3">Category</th><th className="p-3">Vendor / details</th><th className="p-3">Treatment</th><th className="p-3 text-right">Amount</th><th className="p-3">Mode</th><th className="p-3">Recorded by</th><th className="p-3">Actions</th></tr></thead><tbody className="divide-y">{expenses.map(item => <tr key={item._id}><td className="p-3">{new Date(item.expenseDate).toLocaleDateString('en-IN')}</td><td className="p-3 font-medium">{title(item.category)}</td><td className="p-3">{item.vendor || '—'}<div className="text-xs text-slate-500">{item.description || item.reference}</div></td><td className="p-3 text-xs">{title(item.costTreatment || 'operating_expense')}</td><td className="p-3 text-right font-semibold">{money(item.amount)}</td><td className="p-3">{title(item.paymentMode)}</td><td className="p-3">{item.recordedBy?.name || '—'}</td><td className="p-3"><div className="flex gap-2">{user?.role === 'admin' && <><button onClick={() => startEdit(item)} title="Edit" className="rounded border p-2"><Pencil size={14}/></button><button onClick={() => remove(item)} title="Delete" className="rounded border p-2 text-red-600"><Trash2 size={14}/></button></>}</div></td></tr>)}{!expenses.length && <tr><td colSpan="8" className="p-8 text-center text-slate-500">No expenses recorded.</td></tr>}</tbody></table></div>}
    </section>
    <p className="text-xs text-slate-500">Inbound freight already included in a reel's landed rate must be marked as stock landed cost here, not operating expense, to avoid double counting. Changes and deletions are audited.</p>
  </div>;
}
