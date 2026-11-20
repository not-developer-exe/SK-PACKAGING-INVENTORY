import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, Trash2, Receipt, Loader2 } from 'lucide-react';
import axiosClient from '../../api/axiosClient';
import { toLocalDateInput } from '../../lib/date';
import { useDialogs } from '../../context/DialogContext';
const money = (v) => '₹' + Number(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const emptyLine = () => ({ itemName: '', quantity: '1', unit: 'Nos', rate: '' });
export default function ManualInvoicePage({ company = 'sk', workspace = 'regular' }) {
 const navigate=useNavigate(); const {alert}=useDialogs();
 const apiBase=company==='nsb'?'/nsb/invoices':workspace==='sk-b-sales'?'/b-sales/invoices':'/invoices';
 const partiesBase=company==='nsb'?'/nsb/parties':'/parties';
 const routeBase=company==='nsb'?'/nsb/sales':workspace==='sk-b-sales'?'/b-sales':'/sales';
 const [customers,setCustomers]=useState([]),[invoiceDate,setInvoiceDate]=useState(toLocalDateInput()),[customerId,setCustomerId]=useState('');
 const [placeOfSupplyStateCode,setPlaceOfSupplyStateCode]=useState(''),[companyStateCode,setCompanyStateCode]=useState('');
 const [gstPercent,setGstPercent]=useState(18),[items,setItems]=useState([emptyLine()]),[submitting,setSubmitting]=useState(false),[taxConfigured,setTaxConfigured]=useState(false);
 useEffect(()=>{axiosClient.get(partiesBase+'?type=customer').then(({data})=>setCustomers(Array.isArray(data)?data:[])).catch(()=>setCustomers([]));axiosClient.get(apiBase+'/tax-context').then(({data})=>{setCompanyStateCode(data.companyStateCode||'');setTaxConfigured(Boolean(data.configured));}).catch(()=>setTaxConfigured(false));},[]);
 useEffect(()=>{const c=customers.find(x=>x._id===customerId);setPlaceOfSupplyStateCode(c?.stateCode||'');},[customerId,customers]);
 const updateLine=(i,k,v)=>setItems(cur=>cur.map((x,n)=>n===i?{...x,[k]:v}:x));
 const subTotal=useMemo(()=>Number(items.reduce((s,x)=>s+Number((Number(x.quantity||0)*Number(x.rate||0)).toFixed(2)),0).toFixed(2)),[items]);
 const intra=/^\d{2}$/.test(companyStateCode)&&companyStateCode===placeOfSupplyStateCode;
 const tax=Number((subTotal*gstPercent/100).toFixed(2)),cgst=intra?Number((tax/2).toFixed(2)):0,sgst=intra?Number((tax/2).toFixed(2)):0,igst=intra?0:tax,total=Number((subTotal+cgst+sgst+igst).toFixed(2));
 const valid=taxConfigured&&/^\d{2}$/.test(companyStateCode)&&/^\d{2}$/.test(placeOfSupplyStateCode)&&customerId&&items.length&&items.every(x=>x.itemName.trim()&&Number.isFinite(Number(x.quantity))&&Number(x.quantity)>0&&x.rate!==''&&Number.isFinite(Number(x.rate))&&Number(x.rate)>=0);
 const submit=async(saveAsDraft)=>{if(!valid)return;setSubmitting(true);try{await axiosClient.post(apiBase+'/manual',{invoiceDate,customerId,placeOfSupplyStateCode,gstPercent,saveAsDraft,items:items.map(x=>({...x,quantity:Number(x.quantity),rate:Number(x.rate)}))});navigate(routeBase);}catch(err){await alert({title:saveAsDraft?'Draft could not be saved':'Invoice could not be issued',message:err.response?.data?.message||'Unable to save manual invoice.'});setSubmitting(false);}};
 return <div className="mx-auto max-w-5xl space-y-6">
  <div className="flex items-center gap-3"><button onClick={()=>navigate(routeBase)} className="rounded-lg border bg-white p-2"><ArrowLeft size={18}/></button><div><h1 className="text-2xl font-bold text-slate-900">Standalone GST Invoice</h1><p className="text-sm text-slate-500">No delivery challan or Finished Goods stock movement.</p></div></div>
  <div className="grid gap-6 lg:grid-cols-[1fr_320px]"><div className="space-y-5">
   <section className="space-y-4 rounded-2xl border bg-white p-5"><h2 className="flex items-center gap-2 font-semibold"><Receipt size={18}/>Invoice details</h2><div className="grid gap-4 sm:grid-cols-2">
    <label className="text-sm font-medium">Invoice date<input type="date" required value={invoiceDate} onChange={e=>setInvoiceDate(e.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2"/></label>
    <label className="text-sm font-medium">Customer<select value={customerId} onChange={e=>setCustomerId(e.target.value)} className="mt-1 w-full rounded-lg border bg-white px-3 py-2"><option value="">Select customer</option>{customers.map(c=><option key={c._id} value={c._id}>{c.name}</option>)}</select></label>
    <label className="text-sm font-medium sm:col-span-2">Place of supply state code<input inputMode="numeric" maxLength={2} value={placeOfSupplyStateCode} onChange={e=>setPlaceOfSupplyStateCode(e.target.value.replace(/\D/g,'').slice(0,2))} placeholder="Two-digit GST state code" className="mt-1 w-full rounded-lg border px-3 py-2"/></label>
   </div><p className="text-xs text-slate-500">Seller GST state: {companyStateCode||'Not configured'}. {!taxConfigured&&'Configure GST_STATE_CODE or GSTIN before issuing.'}</p></section>
   <section className="space-y-4 rounded-2xl border bg-white p-5"><div className="flex items-center justify-between"><h2 className="font-semibold">Invoice items</h2><button type="button" onClick={()=>setItems(v=>[...v,emptyLine()])} className="rounded-lg border px-3 py-2 text-sm"><Plus size={15} className="mr-1 inline"/>Add line</button></div>
   {items.map((x,i)=><div key={i} className="grid gap-2 rounded-xl border border-slate-100 p-3 sm:grid-cols-[minmax(0,1fr)_90px_90px_120px_36px]">
    <label className="text-xs text-slate-500">Description<input value={x.itemName} onChange={e=>updateLine(i,'itemName',e.target.value)} placeholder="Goods / service description" className="mt-1 w-full rounded-lg border px-2 py-2 text-sm"/></label>
    <label className="text-xs text-slate-500">Quantity<input type="number" min="0.001" step="0.001" value={x.quantity} onChange={e=>updateLine(i,'quantity',e.target.value)} className="mt-1 w-full rounded-lg border px-2 py-2 text-sm"/></label>
    <label className="text-xs text-slate-500">Unit<input value={x.unit} onChange={e=>updateLine(i,'unit',e.target.value)} className="mt-1 w-full rounded-lg border px-2 py-2 text-sm"/></label>
    <label className="text-xs text-slate-500">Rate<input type="number" min="0" step="0.01" value={x.rate} onChange={e=>updateLine(i,'rate',e.target.value)} className="mt-1 w-full rounded-lg border px-2 py-2 text-sm"/></label>
    <button type="button" disabled={items.length===1} onClick={()=>setItems(v=>v.filter((_,n)=>n!==i))} className="self-end rounded-lg p-2 text-red-600 disabled:opacity-30" aria-label="Remove item"><Trash2 size={16}/></button>
   </div>)}</section>
  </div><aside className="h-fit rounded-2xl bg-slate-900 p-5 text-white lg:sticky lg:top-6"><h2 className="mb-4 font-semibold">Invoice summary</h2><div className="space-y-3 text-sm">
   <div className="flex justify-between"><span className="text-slate-300">Taxable subtotal</span><strong>{money(subTotal)}</strong></div>
   <label className="flex items-center justify-between gap-3"><span className="text-slate-300">GST rate</span><select value={gstPercent} onChange={e=>setGstPercent(Number(e.target.value))} className="rounded-lg bg-slate-800 px-2 py-1"><option value={0}>0%</option><option value={5}>5%</option><option value={12}>12%</option><option value={18}>18%</option><option value={28}>28%</option><option value={40}>40%</option></select></label>
   {intra?<><div className="flex justify-between text-slate-300"><span>CGST</span>{money(cgst)}</div><div className="flex justify-between text-slate-300"><span>SGST</span>{money(sgst)}</div></>:<div className="flex justify-between text-slate-300"><span>IGST</span>{money(igst)}</div>}
   <div className="flex justify-between border-t border-slate-700 pt-4 text-lg font-bold"><span>Total</span>{money(total)}</div>
  </div><button disabled={submitting||!valid} onClick={()=>submit(false)} className="mt-6 w-full rounded-xl bg-blue-600 px-4 py-3 font-semibold disabled:opacity-40">{submitting?<Loader2 className="mx-auto animate-spin" size={17}/>'Issue GST invoice'}</button><button disabled={submitting||!valid} onClick={()=>submit(true)} className="mt-2 w-full rounded-xl border border-slate-600 px-4 py-3 text-sm font-semibold disabled:opacity-40">Save as draft</button><p className="mt-4 text-xs text-slate-400">No stock deduction. Issued invoices post to the customer's receivable ledger.</p></aside></div>
 </div>;
}
