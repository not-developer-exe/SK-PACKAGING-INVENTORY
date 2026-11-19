import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowDownLeft, ArrowLeftRight, ArrowUpRight, Landmark, Plus, Wallet, RefreshCw } from 'lucide-react';
import axiosClient from '../../api/axiosClient';
import { useAuth } from '../../context/AuthContext';

const today = () => { const d = new Date(); return [d.getFullYear(), String(d.getMonth()+1).padStart(2,'0'), String(d.getDate()).padStart(2,'0')].join('-'); };
const money = (v) => '₹' + Number(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const inputClass = 'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500';
export default function FinancePage({ company = 'sk' }) {
  const { user } = useAuth();
  const base = company === 'nsb' ? '/nsb/finance' : '/finance';
  const [accounts, setAccounts] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showAccount, setShowAccount] = useState(false);
  const [ifscLoading, setIfscLoading] = useState(false);
  const [form, setForm] = useState({ name:'', type:'bank', openingBalance:'0', bankName:'', accountHolder:'', accountNumber:'', ifsc:'', branch:'', branchAddress:'', bankCity:'', bankState:'', upiId:'', isDefaultForInvoice:true });
  const [tx, setTx] = useState({ date:today(), kind:'income', amount:'', fromAccountId:'', toAccountId:'', category:'', party:'', description:'', reference:'' });
  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const [a,t] = await Promise.all([axiosClient.get(base + '/accounts'), axiosClient.get(base + '/transactions')]);
      setAccounts(a.data.accounts || []); setTransactions(t.data.transactions || []);
    } catch (e) { setError(e.response?.data?.message || 'Unable to load finance data.'); }
    finally { setLoading(false); }
  }, [base]);
  useEffect(() => { load(); }, [load]);
  const total = useMemo(() => accounts.reduce((s,a)=>s+Number(a.balance||0),0),[accounts]);
  const activeAccounts = accounts.filter(a=>a.isActive);
  const lookupIfsc = async () => {
    const code = String(form.ifsc || '').trim().toUpperCase();
    if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(code)) { setError('Enter a valid 11-character IFSC code first.'); return; }
    setIfscLoading(true); setError('');
    try {
      const endpoint = company === 'nsb' ? '/nsb/lookups/ifsc/' : '/lookups/ifsc/';
      const { data } = await axiosClient.get(endpoint + encodeURIComponent(code));
      const b = data.bankDetails || {};
      setForm(old => ({ ...old, ifsc: code, bankName: b.bankName || old.bankName, branch: b.branch || old.branch, branchAddress: b.address || old.branchAddress, bankCity: b.city || old.bankCity, bankState: b.state || old.bankState }));
    } catch (e) { setError(e.response?.data?.message || 'Unable to fetch bank branch details.'); }
    finally { setIfscLoading(false); }
  };
  const submitAccount = async (e) => { e.preventDefault(); setError(''); try { await axiosClient.post(base+'/accounts',form); setShowAccount(false); setForm({name:'',type:'bank',openingBalance:'0',bankName:'',accountHolder:'',accountNumber:'',ifsc:'',branch:'',upiId:'',isDefaultForInvoice:true}); await load(); } catch(e) { setError(e.response?.data?.message||'Unable to save account.'); } };
  const submitTx = async (e) => { e.preventDefault(); setError(''); try { await axiosClient.post(base+'/transactions',tx); setTx({...tx,amount:'',category:'',party:'',description:'',reference:''}); await load(); } catch(e) { setError(e.response?.data?.message||'Unable to save transaction.'); } };
  const updateTx = (key,value) => setTx(old=>({...old,[key]:value}));
  return <div className="mx-auto max-w-7xl space-y-6">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><h1 className="text-2xl font-bold text-slate-900">Bank & Cash</h1><p className="mt-1 text-sm text-slate-500">Record money received, payments and transfers. Balances update automatically.</p></div><button onClick={load} className="inline-flex items-center gap-2 rounded-lg border bg-white px-3 py-2 text-sm"><RefreshCw size={16}/>Refresh</button></div>
    {error && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
    <div className="grid gap-4 sm:grid-cols-2"><div className="rounded-xl border bg-white p-5"><p className="text-sm text-slate-500">Combined balance</p><p className="mt-2 text-2xl font-bold">{money(total)}</p><p className="mt-1 text-xs text-slate-400">Sum of active and inactive accounts in this company</p></div><div className="rounded-xl border bg-white p-5"><p className="text-sm text-slate-500">Accounts</p><p className="mt-2 text-2xl font-bold">{accounts.length}</p><p className="mt-1 text-xs text-slate-400">Bank accounts and cash in hand</p></div></div>
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(360px,0.9fr)]">
      <section className="rounded-xl border bg-white p-5"><div className="mb-4 flex items-center justify-between"><h2 className="font-semibold">Your accounts</h2>{user?.role==='admin'&&<button onClick={()=>setShowAccount(!showAccount)} className="inline-flex items-center gap-1 rounded-lg bg-slate-900 px-3 py-2 text-sm text-white"><Plus size={15}/>Add account</button>}</div>
        {showAccount&&<form onSubmit={submitAccount} className="mb-5 grid gap-3 rounded-lg bg-slate-50 p-4 sm:grid-cols-2"><label className="text-xs font-medium">Account name<input required className={inputClass} value={form.name} onChange={e=>setForm({...form,name:e.target.value})} placeholder="e.g. HDFC Current Account"/></label><label className="text-xs font-medium">Type<select className={inputClass} value={form.type} onChange={e=>setForm({...form,type:e.target.value})}><option value="bank">Bank</option><option value="cash">Cash in hand</option></select></label><label className="text-xs font-medium">Opening balance (₹)<input required min="0" step="0.01" type="number" className={inputClass} value={form.openingBalance} onChange={e=>setForm({...form,openingBalance:e.target.value})}/></label>
          {form.type==='bank'&&<><label className="text-xs font-medium">Bank name<input required className={inputClass} value={form.bankName} onChange={e=>setForm({...form,bankName:e.target.value})}/></label><label className="text-xs font-medium">Account holder<input className={inputClass} value={form.accountHolder} onChange={e=>setForm({...form,accountHolder:e.target.value})}/></label><label className="text-xs font-medium">Account number<input required className={inputClass} value={form.accountNumber} onChange={e=>setForm({...form,accountNumber:e.target.value})}/></label><label className="text-xs font-medium">IFSC<div className="mt-1 flex gap-2"><input required className={inputClass} value={form.ifsc} maxLength={11} onChange={e=>setForm({...form,ifsc:e.target.value.toUpperCase()})} placeholder="e.g. HDFC0001234"/><button type="button" onClick={lookupIfsc} disabled={ifscLoading} className="shrink-0 rounded-lg border border-blue-200 bg-blue-50 px-3 text-xs font-semibold text-blue-700 disabled:opacity-50">{ifscLoading?'Fetching…':'Fetch details'}</button></div></label><label className="text-xs font-medium">Branch<input className={inputClass} value={form.branch} onChange={e=>setForm({...form,branch:e.target.value})}/></label><label className="text-xs font-medium sm:col-span-2">Branch address<input className={inputClass} value={form.branchAddress} onChange={e=>setForm({...form,branchAddress:e.target.value})}/></label><label className="text-xs font-medium">Branch city<input className={inputClass} value={form.bankCity} onChange={e=>setForm({...form,bankCity:e.target.value})}/></label><label className="text-xs font-medium">Branch state<input className={inputClass} value={form.bankState} onChange={e=>setForm({...form,bankState:e.target.value})}/></label><label className="text-xs font-medium">UPI ID<input className={inputClass} value={form.upiId} onChange={e=>setForm({...form,upiId:e.target.value})}/></label><label className="flex items-center gap-2 text-xs sm:col-span-2"><input type="checkbox" checked={form.isDefaultForInvoice} onChange={e=>setForm({...form,isDefaultForInvoice:e.target.checked})}/>Use these details on GST invoices</label></>}
          <div className="flex gap-2 sm:col-span-2"><button className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white">Save account</button><button type="button" onClick={()=>setShowAccount(false)} className="rounded-lg border px-4 py-2 text-sm">Cancel</button></div></form>}
        {loading?<p className="py-8 text-center text-sm text-slate-500">Loading accounts…</p>:<div className="space-y-3">{accounts.map(a=><div key={a._id} className="flex items-center justify-between gap-4 rounded-lg border p-4"><div className="flex min-w-0 items-center gap-3"><div className="rounded-lg bg-slate-100 p-2">{a.type==='cash'?<Wallet size={19}/>:<Landmark size={19}/>}</div><div className="min-w-0"><p className="truncate font-semibold">{a.name}</p><p className="text-xs text-slate-500">{a.type==='cash'?'Cash in hand':[a.bankName,a.accountNumber?'••••'+a.accountNumber.slice(-4):''].filter(Boolean).join(' · ')} {a.isDefaultForInvoice?' · Invoice default':''}</p></div></div><p className="whitespace-nowrap font-semibold tabular-nums">{money(a.balance)}</p></div>)}{!accounts.length&&<p className="py-8 text-center text-sm text-slate-500">No accounts yet. Add a cash account and your bank accounts to begin.</p>}</div>}
      </section>
      <section className="rounded-xl border bg-white p-5"><h2 className="mb-4 font-semibold">Record a transaction</h2><form onSubmit={submitTx} className="grid gap-3 sm:grid-cols-2">
        <label className="text-xs font-medium">Transaction type<select className={inputClass} value={tx.kind} onChange={e=>updateTx('kind',e.target.value)}><option value="income">Money received</option><option value="expense">Money paid / expense</option><option value="transfer">Transfer between accounts</option></select></label>
        <label className="text-xs font-medium">Date<input required type="date" className={inputClass} value={tx.date} onChange={e=>updateTx('date',e.target.value)}/></label>
        <label className="text-xs font-medium">Amount (₹)<input required min="0.01" step="0.01" type="number" className={inputClass} value={tx.amount} onChange={e=>updateTx('amount',e.target.value)} placeholder="0.00"/></label>
        {tx.kind!=='income'&&<label className="text-xs font-medium">Pay from<select required className={inputClass} value={tx.fromAccountId} onChange={e=>updateTx('fromAccountId',e.target.value)}><option value="">Select account</option>{activeAccounts.map(a=><option key={a._id} value={a._id}>{a.name} · {money(a.balance)}</option>)}</select></label>}
        {tx.kind!=='expense'&&<label className="text-xs font-medium">Deposit to<select required className={inputClass} value={tx.toAccountId} onChange={e=>updateTx('toAccountId',e.target.value)}><option value="">Select account</option>{activeAccounts.map(a=><option key={a._id} value={a._id}>{a.name} · {money(a.balance)}</option>)}</select></label>}
        <label className="text-xs font-medium">Category<input className={inputClass} value={tx.category} onChange={e=>updateTx('category',e.target.value)} placeholder="e.g. Milk, sales receipt"/></label><label className="text-xs font-medium">Party / Paid to / Received from<input className={inputClass} value={tx.party} onChange={e=>updateTx('party',e.target.value)}/></label>
        <label className="text-xs font-medium sm:col-span-2">Description<input className={inputClass} value={tx.description} onChange={e=>updateTx('description',e.target.value)} placeholder="Short note about this transaction"/></label><label className="text-xs font-medium sm:col-span-2">Reference / UTR / cheque no.<input className={inputClass} value={tx.reference} onChange={e=>updateTx('reference',e.target.value)}/></label>
        <button disabled={!accounts.length} className="rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50 sm:col-span-2">Save transaction</button>
      </form><p className="mt-3 text-xs text-slate-400">A transfer decreases the source and increases the destination. It does not change your combined balance.</p></section>
    </div>
    <section className="overflow-hidden rounded-xl border bg-white"><div className="border-b p-5"><h2 className="font-semibold">Recent transactions</h2></div><div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left text-sm"><thead className="bg-slate-50 text-xs text-slate-500"><tr><th className="p-3">Date</th><th className="p-3">Type</th><th className="p-3">Description</th><th className="p-3">From</th><th className="p-3">To</th><th className="p-3 text-right">Amount</th></tr></thead><tbody>{transactions.map(t=><tr key={t._id} className="border-t"><td className="p-3">{new Date(t.date).toLocaleDateString('en-IN')}</td><td className="p-3 capitalize">{t.kind}</td><td className="p-3">{[t.category,t.party,t.description,t.reference].filter(Boolean).join(' · ')||'—'}</td><td className="p-3">{t.fromAccountId?.name||'—'}</td><td className="p-3">{t.toAccountId?.name||'—'}</td><td className="p-3 text-right font-semibold">{money(t.amount)}</td></tr>)}</tbody></table>{!transactions.length&&<p className="p-8 text-center text-sm text-slate-500">No transactions recorded yet.</p>}</div></section>
  </div>;
}
