import React, { useEffect, useState } from 'react';
import { Building2, Save, RefreshCw } from 'lucide-react';
import axiosClient from '../../api/axiosClient';
const initial = { legalName:'', tradeName:'', gstin:'', stateCode:'', registeredAddress:'', city:'', stateName:'', pincode:'', phone:'', email:'', invoicePrefix:'', signatoryName:'', invoiceTerms:'', logoUrl:'' };
const input = 'mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500';
export default function CompanyProfilePage({ company='sk' }) {
  const nsb = company === 'nsb';
  const endpoint = nsb ? '/nsb/company-profile' : '/company-profile';
  const [form,setForm] = useState(initial);
  const [loading,setLoading] = useState(true);
  const [saving,setSaving] = useState(false);
  const [message,setMessage] = useState('');
  const [error,setError] = useState('');
  const set = (key,value) => setForm(old=>({...old,[key]:value}));
  const load = async () => { setLoading(true); setError(''); try { const {data}=await axiosClient.get(endpoint); setForm({...initial,...(data.profile||{})}); } catch(e) { setError(e.response?.data?.message||'Unable to load company details.'); } finally { setLoading(false); } };
  useEffect(()=>{load();},[endpoint]);
  const submit = async e => { e.preventDefault(); setSaving(true); setError(''); setMessage(''); try { const {data}=await axiosClient.put(endpoint,form); setForm({...initial,...data.profile}); setMessage('Company profile saved successfully.'); } catch(e) { setError(e.response?.data?.message||'Unable to save company profile.'); } finally { setSaving(false); } };
  const field = (label,key,opts={}) => <label className="block text-sm font-medium text-slate-700">{label}<input className={input} value={form[key]||''} onChange={e=>set(key,e.target.value)} maxLength={opts.max||undefined} placeholder={opts.placeholder||''} /></label>;
  if(loading) return <div className="py-16 text-center text-sm text-slate-500">Loading firm details…</div>;
  return <div className="mx-auto max-w-5xl space-y-6">
    <div className="flex flex-wrap items-center justify-between gap-3"><div className="flex items-center gap-3"><div className="rounded-xl bg-blue-50 p-3 text-blue-700"><Building2/></div><div><h1 className="text-2xl font-bold text-slate-900">Firm / Company Profile</h1><p className="mt-1 text-sm text-slate-500">{nsb?'NSB Industrial Solutions':'S.K Packaging'} · Legal, GST and invoice details</p></div></div><button onClick={load} className="inline-flex items-center gap-2 rounded-lg border bg-white px-3 py-2 text-sm"><RefreshCw size={15}/>Refresh</button></div>
    {error&&<div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
    {message&&<div role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">{message}</div>}
    <form onSubmit={submit} className="space-y-6">
      <section className="rounded-xl border bg-white p-5"><h2 className="mb-4 font-semibold">Business identity</h2><div className="grid gap-4 sm:grid-cols-2">{field('Legal / registered name','legalName')}{field('Trade / display name','tradeName')}{field('Invoice prefix','invoicePrefix',{max:10,placeholder:nsb?'NSB':'SK'})}{field('Authorised signatory','signatoryName')}</div></section>
      <section className="rounded-xl border bg-white p-5"><h2 className="mb-4 font-semibold">GST registration</h2><div className="grid gap-4 sm:grid-cols-2">{field('GSTIN','gstin',{max:15,placeholder:'15-character GSTIN'})}{field('GST state code','stateCode',{max:2,placeholder:'e.g. 23'})}</div><p className="mt-2 text-xs text-slate-500">GSTIN and state code must agree. The state code is used to calculate CGST/SGST versus IGST.</p></section>
      <section className="rounded-xl border bg-white p-5"><h2 className="mb-4 font-semibold">Registered address</h2><div className="grid gap-4 sm:grid-cols-2">{field('Address','registeredAddress')}{field('City','city')}{field('State','stateName')}{field('PIN code','pincode',{max:6})}</div></section>
      <section className="rounded-xl border bg-white p-5"><h2 className="mb-4 font-semibold">Contact & invoice presentation</h2><div className="grid gap-4 sm:grid-cols-2">{field('Business phone','phone')}{field('Business email','email')}{field('Logo URL','logoUrl')}</div><label className="mt-4 block text-sm font-medium text-slate-700">Invoice terms<textarea className={input} rows={4} value={form.invoiceTerms||''} onChange={e=>set('invoiceTerms',e.target.value)} /></label></section>
      <div className="flex justify-end"><button disabled={saving} className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50"><Save size={16}/>{saving?'Saving…':'Save company details'}</button></div>
    </form>
  </div>;
}
