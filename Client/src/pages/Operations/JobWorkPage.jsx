import React,{useEffect,useState} from 'react';
import axiosClient from '../../api/axiosClient';

const today=()=>new Date().toLocaleDateString('en-CA');
const issueBlank={jobWorkerName:'',processType:'offset_printing',inputBatchId:'',issueDate:today(),expectedReturnDate:'',issuedSheets:'',notes:''};
const returnBlank={orderId:'',returnDate:today(),sheetsReturned:'',weightReturnedKg:'',wastageSheets:'0',wastageWeightKg:'0',jobCharges:'0',outputMaterialType:'printed',notes:''};

export default function JobWorkPage(){
 const [batches,setBatches]=useState([]),[orders,setOrders]=useState([]),[issue,setIssue]=useState(issueBlank),[ret,setRet]=useState(returnBlank),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 const load=async()=>{const [a,b]=await Promise.all([axiosClient.get('/pasting/facing-material'),axiosClient.get('/job-work')]);setBatches(a.data.batches||[]);setOrders(b.data.orders||[]);};
 useEffect(()=>{load().catch(e=>setError(e.message));},[]);
 const submitIssue=async e=>{e.preventDefault();setBusy(true);setError('');try{await axiosClient.post('/job-work/issue',issue);setIssue(issueBlank);await load();}catch(e){setError(e.response?.data?.message||e.message);}finally{setBusy(false);}};
 const submitReturn=async e=>{e.preventDefault();setBusy(true);setError('');try{await axiosClient.post('/job-work/return',ret);setRet({...returnBlank,orderId:ret.orderId});await load();}catch(e){setError(e.response?.data?.message||e.message);}finally{setBusy(false);}};
 const openOrders=orders.filter(o=>['issued','partial_return'].includes(o.status));
 return <div className="space-y-6">
  <div><h1 className="text-2xl font-bold text-slate-900">External Job Work</h1><p className="mt-1 text-sm text-slate-500">Issue sheet material to printers/processors, receive processed stock, and record wastage and job charges. Job-workers are maintained separately from suppliers.</p></div>
  {error&&<div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
  <form onSubmit={submitIssue} className="grid gap-3 rounded-xl border bg-white p-4 sm:grid-cols-3">
   <h2 className="font-semibold sm:col-span-3">Issue material to job-worker</h2>
   <input required placeholder="Printer / job-worker name" value={issue.jobWorkerName} onChange={e=>setIssue({...issue,jobWorkerName:e.target.value})} className="rounded-lg border px-3 py-2 text-sm"/>
   <select value={issue.processType} onChange={e=>setIssue({...issue,processType:e.target.value})} className="rounded-lg border px-3 py-2 text-sm"><option value="offset_printing">Offset printing</option><option value="lamination">Lamination</option><option value="other">Other processing</option></select>
   <select required value={issue.inputBatchId} onChange={e=>setIssue({...issue,inputBatchId:e.target.value})} className="rounded-lg border px-3 py-2 text-sm"><option value="">Select stock batch</option>{batches.filter(b=>b.remainingSheets>0).map(b=><option key={b._id} value={b._id}>{b.batchNumber} · {b.materialType} · {b.remainingSheets} sheets</option>)}</select>
   <input required type="number" min="1" step="1" placeholder="Sheets to issue" value={issue.issuedSheets} onChange={e=>setIssue({...issue,issuedSheets:e.target.value})} className="rounded-lg border px-3 py-2 text-sm"/>
   <label className="text-xs text-slate-600">Issue date<input required type="date" value={issue.issueDate} onChange={e=>setIssue({...issue,issueDate:e.target.value})} className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"/></label>
   <label className="text-xs text-slate-600">Expected return<input type="date" value={issue.expectedReturnDate} onChange={e=>setIssue({...issue,expectedReturnDate:e.target.value})} className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"/></label>
   <input placeholder="Notes" value={issue.notes} onChange={e=>setIssue({...issue,notes:e.target.value})} className="rounded-lg border px-3 py-2 text-sm sm:col-span-2"/>
   <button disabled={busy} className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">Issue stock</button>
  </form>
  <form onSubmit={submitReturn} className="grid gap-3 rounded-xl border bg-white p-4 sm:grid-cols-4">
   <h2 className="font-semibold sm:col-span-4">Receive processed material</h2>
   <select required value={ret.orderId} onChange={e=>setRet({...ret,orderId:e.target.value})} className="rounded-lg border px-3 py-2 text-sm sm:col-span-2"><option value="">Select open job-work order</option>{openOrders.map(o=><option key={o._id} value={o._id}>{o.orderNumber} · {o.jobWorkerName} · {o.issuedSheets-o.returnedSheets-o.wastageSheets} sheets pending</option>)}</select>
   <label className="text-xs text-slate-600">Return date<input required type="date" value={ret.returnDate} onChange={e=>setRet({...ret,returnDate:e.target.value})} className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"/></label>
   <select value={ret.outputMaterialType} onChange={e=>setRet({...ret,outputMaterialType:e.target.value})} className="rounded-lg border px-3 py-2 text-sm"><option value="printed">Printed paper</option><option value="printed_laminated">Printed + laminated</option><option value="khaki">Khaki</option><option value="duplex">Duplex</option></select>
   <input required type="number" min="1" step="1" placeholder="Good sheets returned" value={ret.sheetsReturned} onChange={e=>setRet({...ret,sheetsReturned:e.target.value})} className="rounded-lg border px-3 py-2 text-sm"/>
   <input required type="number" min="0.001" step="0.001" placeholder="Returned weight kg" value={ret.weightReturnedKg} onChange={e=>setRet({...ret,weightReturnedKg:e.target.value})} className="rounded-lg border px-3 py-2 text-sm"/>
   <input type="number" min="0" step="1" placeholder="Wastage sheets" value={ret.wastageSheets} onChange={e=>setRet({...ret,wastageSheets:e.target.value})} className="rounded-lg border px-3 py-2 text-sm"/>
   <input type="number" min="0" step="0.001" placeholder="Wastage kg" value={ret.wastageWeightKg} onChange={e=>setRet({...ret,wastageWeightKg:e.target.value})} className="rounded-lg border px-3 py-2 text-sm"/>
   <input type="number" min="0" step="0.01" placeholder="Job charges ₹" value={ret.jobCharges} onChange={e=>setRet({...ret,jobCharges:e.target.value})} className="rounded-lg border px-3 py-2 text-sm"/>
   <input placeholder="Return notes" value={ret.notes} onChange={e=>setRet({...ret,notes:e.target.value})} className="rounded-lg border px-3 py-2 text-sm"/>
   <button disabled={busy||!openOrders.length} className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">Receive stock</button>
  </form>
  <section className="overflow-hidden rounded-xl border bg-white"><div className="border-b p-4 font-semibold">Job-work register</div><div className="overflow-x-auto"><table className="w-full min-w-[850px] text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="p-3">Order</th><th className="p-3">Job-worker</th><th className="p-3">Process</th><th className="p-3 text-right">Issued</th><th className="p-3 text-right">Returned</th><th className="p-3 text-right">Wastage</th><th className="p-3 text-right">Charges</th><th className="p-3">Status</th></tr></thead><tbody className="divide-y">{orders.map(o=><tr key={o._id}><td className="p-3 font-medium">{o.orderNumber}</td><td className="p-3">{o.jobWorkerName}</td><td className="p-3">{o.processType.replaceAll('_',' ')}</td><td className="p-3 text-right">{o.issuedSheets}</td><td className="p-3 text-right">{o.returnedSheets}</td><td className="p-3 text-right">{o.wastageSheets}</td><td className="p-3 text-right">₹{Number(o.jobCharges||0).toLocaleString('en-IN')}</td><td className="p-3 capitalize">{o.status.replaceAll('_',' ')}</td></tr>)}{!orders.length&&<tr><td colSpan="8" className="p-6 text-center text-slate-500">No job-work orders recorded.</td></tr>}</tbody></table></div></section>
 </div>;
}
