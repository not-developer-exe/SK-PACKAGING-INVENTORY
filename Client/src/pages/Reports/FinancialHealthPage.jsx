import React,{useEffect,useState} from 'react';
import {RefreshCw,Wallet,TrendingUp,TrendingDown,Users,Building2} from 'lucide-react';
import axiosClient from '../../api/axiosClient';
import {toLocalDateInput,localMonthStartInput} from '../../lib/date';
const money=v=>'₹'+Number(v||0).toLocaleString('en-IN',{maximumFractionDigits:2});
const today=toLocalDateInput();
export default function FinancialHealthPage(){
 const [from,setFrom]=useState(localMonthStartInput(new Date()));
 const [to,setTo]=useState(today);
 const [data,setData]=useState(null);
 const [loading,setLoading]=useState(false);
 const [error,setError]=useState('');
 const load=async(e)=>{e?.preventDefault();setLoading(true);setError('');try{const r=await axiosClient.get('/reports/financial-health',{params:{from,to}});setData(r.data);}catch(err){setError(err.response?.data?.message||'Unable to load financial report.');}finally{setLoading(false);}};
 useEffect(()=>{load();},[]);
 const card=(label,value,sub,Icon)=> <article className="rounded-2xl border bg-white p-5"><div className="flex items-center gap-2 text-sm text-slate-500"><Icon size={16}/>{label}</div><p className="mt-3 text-2xl font-bold text-slate-900">{money(value)}</p><p className="mt-1 text-xs text-slate-500">{sub}</p></article>;
 const table=(title,headers,rows,empty)=> <section className="rounded-2xl border bg-white p-5"><h2 className="mb-3 font-semibold">{title}</h2><div className="overflow-x-auto"><table className="w-full text-sm"><thead className="border-b text-left text-xs uppercase text-slate-500"><tr>{headers.map(h=><th key={h} className="py-2 pr-4">{h}</th>)}</tr></thead><tbody className="divide-y">{rows.length?rows.map((r,i)=><tr key={i}>{r.map((v,j)=><td key={j} className="py-2 pr-4">{v}</td>)}</tr>):<tr><td colSpan={headers.length} className="py-5 text-center text-slate-500">{empty}</td></tr>}</tbody></table></div></section>;
 return <div className="mx-auto max-w-7xl space-y-6">
 <header className="flex flex-wrap items-start justify-between gap-3"><div><h1 className="text-2xl font-bold text-slate-900">Cash Flow & Outstanding Dues</h1><p className="mt-1 text-sm text-slate-500">Track actual recorded collections, business outflows, receivables and supplier balances.</p></div><button onClick={()=>load()} disabled={loading} className="rounded-lg border bg-white px-3 py-2 text-sm"><RefreshCw size={15} className="mr-2 inline"/>{loading?'Refreshing…':'Refresh'}</button></header>
 <form onSubmit={load} className="flex flex-wrap items-end gap-3 rounded-2xl border bg-white p-4"><label className="text-sm text-slate-600">From<input type="date" required value={from} onChange={e=>setFrom(e.target.value)} className="mt-1 block rounded-lg border px-3 py-2"/></label><label className="text-sm text-slate-600">To<input type="date" required min={from} value={to} onChange={e=>setTo(e.target.value)} className="mt-1 block rounded-lg border px-3 py-2"/></label><button disabled={loading} className="rounded-lg bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white">{loading?'Loading…':'Apply period'}</button>{data&&<span className="text-xs text-slate-500">Period: {data.period.from} to {data.period.to}</span>}</form>
 {error&&<p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
 {data&&<><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{card('Total cash received',data.cashFlow.totalCashIn,'Customer collections + scrap receipts',TrendingUp)}{card('Total cash outflow',data.cashFlow.totalCashOut,'Supplier payments + recorded expenses',TrendingDown)}{card('Net cash movement',data.cashFlow.netCashFlow,'For selected period',Wallet)}{card('Outstanding customer invoices',data.receivables.total,data.receivables.invoiceCount+' unpaid / partly paid invoices',Users)}</div>
 <div className="grid gap-4 lg:grid-cols-2">{table('Receivables aging', ['Invoice age','Open invoices','Outstanding'],data.receivables.buckets.map(b=>[b.label,b.invoices,money(b.amount)]),'No outstanding invoices')}{table('Supplier balances', ['Supplier','Amount payable'],data.payables.suppliers.map(p=>[p.name,money(p.amount)]),'No supplier balances payable')}</div>
 {table('Customer-wise receivables',['Customer','Open invoices','Outstanding'],data.receivables.customers.map(c=>[c.name,c.invoices,money(c.amount)]),'No outstanding customer invoices')}
 {table('Monthly cash movement',['Month','Customer receipts','Scrap receipts','Expenses','Supplier payments','Net'],data.cashFlow.monthly.map(m=>[m.month,money(m.customerCollections),money(m.scrapReceipts),money(m.expenses),money(m.supplierPayments),money(m.net)]),'No cash movement in this period')}
 <section className="rounded-xl border bg-slate-50 p-4"><h2 className="text-sm font-semibold">How to interpret this report</h2><ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-slate-600">{data.notes.map((n,i)=><li key={i}>{n}</li>)}</ul><p className="mt-2 text-xs text-slate-600">Receivable aging basis: {data.receivables.agingBasis}.</p></section></>}
 </div>;
}