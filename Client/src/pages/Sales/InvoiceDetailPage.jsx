import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Printer, Loader2 } from 'lucide-react';
import axiosClient from '../../api/axiosClient';

const money = (value) => '₹' + Number(value || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const date = (value) => value ? new Date(value).toLocaleDateString('en-IN') : '—';

export default function InvoiceDetailPage({ company = 'sk' }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const apiBase = company === 'nsb' ? '/nsb/invoices' : '/invoices';
  const routeBase = company === 'nsb' ? '/nsb/sales' : '/sales';
  const [invoice, setInvoice] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [bankDetails, setBankDetails] = useState(null);

  useEffect(() => {
    let active = true;
    axiosClient.get((company === 'nsb' ? '/nsb/finance' : '/finance') + '/invoice-bank-details').then(({ data }) => { if (active) setBankDetails(data.bankDetails || null); }).catch(() => { if (active) setBankDetails(null); });
    axiosClient.get(apiBase + '/' + id).then(({ data }) => { if (active) setInvoice(data.invoice); })
      .catch((err) => { if (active) setError(err.response?.data?.message || 'Unable to load invoice.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [id, apiBase, company]);

  if (loading) return <div className="flex h-64 items-center justify-center text-slate-500"><Loader2 className="mr-2 animate-spin" />Loading invoice…</div>;
  if (error || !invoice) return <div className="mx-auto max-w-3xl rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">{error || 'Invoice not found.'}<button onClick={() => navigate(routeBase)} className="ml-3 underline">Back to invoices</button></div>;

  const party = invoice.customerId || {};
  const dispatch = invoice.dispatchId || {};
  const seller = invoice.sellerSnapshot || {};
  const buyer = invoice.buyerSnapshot || {};
  const taxLabel = invoice.taxType === 'IGST' ? 'IGST' : 'CGST + SGST';

  return <div className="mx-auto max-w-5xl space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
      <button onClick={() => navigate(routeBase)} className="rounded-lg border bg-white px-3 py-2 text-sm"><ArrowLeft className="mr-1 inline" size={16}/>Back to invoices</button>
      <button onClick={() => window.print()} className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white"><Printer className="mr-2 inline" size={16}/>Print / Save PDF</button>
    </div>
    <article className="invoice-paper mx-auto bg-white p-8 text-slate-900 shadow-sm sm:p-10">
      <div className="flex items-start justify-between gap-6 border-b-2 border-slate-900 pb-5">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">Tax Invoice</p>
          <h1 className="mt-2 text-2xl font-bold">{seller.legalName || 'Seller company profile required'}</h1>
          <p className="mt-2 max-w-sm whitespace-pre-line text-xs leading-5 text-slate-600">{seller.address || 'Registered business address to be configured'}</p>
          <p className="mt-1 text-xs text-slate-600">GSTIN: {seller.gstin || 'Not configured'} · Contact: {seller.phone || 'Not configured'}</p>
        </div>
        <div className="min-w-28 border border-slate-300 p-3 text-center text-xs font-semibold text-slate-400">COMPANY LOGO</div>
      </div>
      <div className="grid grid-cols-2 gap-6 border-b border-slate-200 py-5 text-sm">
        <section><h2 className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">Bill to</h2><p className="font-semibold">{buyer.name || party.name || '—'}</p><p className="mt-1 whitespace-pre-line text-xs leading-5 text-slate-600">{buyer.billingAddress || party.billingAddress || party.registeredAddress || party.address || party.city || 'Billing address not available in Party Master'}</p><p className="mt-1 text-xs text-slate-600">GSTIN: {buyer.gstin || party.gstin || '—'}</p><p className="text-xs text-slate-600">State code: {buyer.stateCode || party.stateCode || '—'}</p></section>
        <section className="grid grid-cols-2 gap-x-4 gap-y-3">
          <div><p className="text-xs text-slate-500">Invoice number</p><p className="font-semibold">{invoice.invoiceNumber}</p></div>
          <div><p className="text-xs text-slate-500">Invoice date</p><p className="font-semibold">{date(invoice.invoiceDate)}</p></div>
          <div><p className="text-xs text-slate-500">Delivery challan</p><p className="font-semibold">{dispatch.challanNumber || '—'}</p></div>
          <div><p className="text-xs text-slate-500">Place of supply</p><p className="font-semibold">{invoice.placeOfSupplyStateCode || '—'}</p></div>
        </section>
      </div>
      <div className="py-5">
        <table className="w-full border-collapse text-left text-xs">
          <thead><tr className="border-y border-slate-300 bg-slate-50"><th className="p-2">#</th><th className="p-2">Description</th><th className="p-2 text-right">Qty</th><th className="p-2 text-right">Rate</th><th className="p-2 text-right">Taxable value</th></tr></thead>
          <tbody>{(invoice.items || []).map((item, index) => <tr key={item._id || index} className="border-b border-slate-200"><td className="p-2">{index + 1}</td><td className="p-2 font-medium">{item.boxId?.itemName || item.itemName || 'Corrugated box'}</td><td className="p-2 text-right">{Number(item.quantity || 0).toLocaleString('en-IN')}</td><td className="p-2 text-right">{money(item.rate)}</td><td className="p-2 text-right">{money(item.taxableAmount)}</td></tr>)}</tbody>
        </table>
      </div>
      <div className="ml-auto max-w-xs space-y-2 border-b border-slate-200 pb-4 text-sm">
        <div className="flex justify-between"><span className="text-slate-600">Taxable subtotal</span><strong>{money(invoice.subTotal)}</strong></div>
        {invoice.taxType === 'IGST' ? <div className="flex justify-between"><span className="text-slate-600">IGST</span><strong>{money(invoice.igstAmount)}</strong></div> : <><div className="flex justify-between"><span className="text-slate-600">CGST</span><strong>{money(invoice.cgstAmount)}</strong></div><div className="flex justify-between"><span className="text-slate-600">SGST</span><strong>{money(invoice.sgstAmount)}</strong></div></>}
        <div className="flex justify-between border-t border-slate-300 pt-3 text-base"><strong>Grand total</strong><strong>{money(invoice.grandTotal)}</strong></div>
        <div className="flex justify-between text-xs"><span className="text-slate-500">Balance due</span><strong>{money(invoice.balanceDue)}</strong></div>
      </div>
      <div className="mt-5 rounded-lg bg-slate-50 p-3 text-xs"><strong>Terms &amp; Conditions</strong><ol className="mt-2 list-decimal space-y-1 pl-4 text-slate-600"><li>Payment is due as per mutually agreed terms.</li><li>Complaints regarding quantity, quality, damage or discrepancies must be communicated in writing within 48 hours of delivery, with supporting details and evidence.</li><li>Complaints received after this period may not be entertained, subject to applicable laws and statutory rights.</li><li>Returns require prior written approval.</li></ol></div>
      <div className="mt-6 grid grid-cols-2 gap-8 text-xs"><div><p className="font-semibold">Bank details</p>{bankDetails ? <div className="mt-2 space-y-1 text-slate-600"><p>{bankDetails.bankName}</p>{bankDetails.accountHolder && <p>Account holder: {bankDetails.accountHolder}</p>}<p>A/c No.: {bankDetails.accountNumber}</p><p>IFSC: {bankDetails.ifsc}</p>{bankDetails.branch && <p>Branch: {bankDetails.branch}</p>}{bankDetails.branchAddress && <p>{bankDetails.branchAddress}</p>}{(bankDetails.bankCity || bankDetails.bankState) && <p>{[bankDetails.bankCity, bankDetails.bankState].filter(Boolean).join(', ')}</p>}{bankDetails.upiId && <p>UPI: {bankDetails.upiId}</p>}</div> : <p className="mt-2 text-slate-500">No default invoice bank account configured. Add one in Bank & Cash.</p>}</div><div className="flex min-h-24 flex-col items-end justify-end text-right"><p className="font-semibold">For {seller.legalName || 'Seller company'}</p><div className="h-10"/><p className="border-t border-slate-400 pt-2">Authorized signatory</p></div></div>
      {invoice.status === 'Cancelled' && <p className="mt-6 border-2 border-red-600 py-2 text-center text-lg font-bold tracking-widest text-red-600">CANCELLED</p>}
      <p className="mt-6 border-t border-slate-200 pt-3 text-center text-[10px] text-slate-400">This invoice view is generated from the ERP invoice record.</p>
    </article>
    <style>{`@page { size: A4; margin: 12mm; } @media print { body { background: white !important; } .invoice-paper { box-shadow: none !important; padding: 0 !important; max-width: none !important; } main { padding: 0 !important; overflow: visible !important; } }`}</style>
  </div>;
}
