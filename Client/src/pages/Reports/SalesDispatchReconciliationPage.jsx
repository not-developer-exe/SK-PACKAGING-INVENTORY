import React, { useEffect, useState } from 'react';
import { RefreshCw, Truck, FileCheck2, AlertTriangle, IndianRupee } from 'lucide-react';
import axiosClient from '../../api/axiosClient';
import DateRangeFilter from '../../components/DateRangeFilter';

const money = value => '₹' + Number(value || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 });
const qty = value => Number(value || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 });

export default function SalesDispatchReconciliationPage() {
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = async (params = {}) => {
    setLoading(true); setError('');
    try {
      const response = await axiosClient.get('/reports/sales-dispatch-reconciliation', { params });
      setData(response.data);
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to load sales and dispatch reconciliation.');
    } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const totals = data?.totals;
  const rows = data?.rows || [];
  return <div className="mx-auto max-w-7xl space-y-6">
    <header className="flex flex-wrap items-center justify-between gap-3">
      <div><h1 className="text-2xl font-bold tracking-tight text-slate-900">Sales & Dispatch Reconciliation</h1>
        <p className="mt-1 text-sm text-slate-500">Match delivery challans to invoices, payments, customer ledger entries and recorded profit.</p></div>
      <button onClick={() => load({ from, to })} disabled={loading} className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 disabled:opacity-60"><RefreshCw size={15} className="mr-2 inline" />Refresh</button>
    </header>
    <DateRangeFilter from={from} to={to} onFromChange={setFrom} onToChange={setTo} onApply={() => load({ from, to })} onReset={() => { setFrom(''); setTo(''); load({}); }} loading={loading} label="Dispatch date range" />
    {error && <p role="alert" className="rounded-lg border border-red-100 bg-red-50 p-3 text-sm text-red-700">{error}</p>}
    {loading && !data ? <p className="rounded-xl border bg-white p-10 text-center text-sm text-slate-500">Reconciling challans and invoices…</p> : data && <>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Metric icon={Truck} label="Delivery challans" value={totals.dispatchCount} detail={qty(totals.dispatchedBoxes) + ' boxes dispatched'} />
        <Metric icon={FileCheck2} label="Invoiced challans" value={totals.invoicedDispatches} detail={totals.uninvoicedDispatches + ' active challans awaiting invoice'} />
        <Metric icon={IndianRupee} label="Taxable sales" value={money(totals.taxableSales)} detail={money(totals.gst) + ' GST · ' + money(totals.invoiceTotal) + ' invoice total'} />
        <Metric icon={AlertTriangle} label="Reconciliation exceptions" value={data.exceptionCount} detail={totals.cancelledDispatches + ' cancelled challans · ' + totals.deliveredDispatches + ' delivered'} />
        <Metric icon={IndianRupee} label="Payments recorded" value={money(totals.recordedPayments)} detail={money(totals.outstanding) + ' outstanding'} />
        <Metric icon={IndianRupee} label="Cost of goods" value={money(totals.costOfGoods)} detail={totals.costedInvoices + ' costed invoices'} />
        <Metric icon={IndianRupee} label="Recorded gross profit" value={money(totals.grossProfit)} detail={totals.uncostedInvoices + ' invoices pending costing'} />
        <Metric icon={FileCheck2} label="Costing coverage" value={totals.grossProfitCoveragePercent + '%'} detail="Invoices with a stored cost snapshot" />
      </div>
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <div className="border-b border-slate-100 p-4"><h2 className="font-semibold text-slate-900">Challan-wise reconciliation</h2><p className="text-xs text-slate-500">Selected period is based on dispatch date. Linked invoice dates may be outside this period.</p></div>
        <div className="overflow-x-auto"><table className="w-full min-w-[1450px] text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="p-3">Challan / date</th><th className="p-3">Customer</th><th className="p-3">Dispatch</th><th className="p-3 text-right">Boxes</th><th className="p-3">Invoice</th><th className="p-3 text-right">Taxable</th><th className="p-3 text-right">GST</th><th className="p-3 text-right">Invoice total</th><th className="p-3 text-right">Paid</th><th className="p-3 text-right">Due</th><th className="p-3 text-right">Gross profit</th><th className="p-3">Reconciliation</th></tr></thead>
          <tbody className="divide-y">{rows.map(row => <tr key={row.dispatchId}>
            <td className="p-3"><div className="font-semibold">{row.challanNumber}</div><div className="text-xs text-slate-500">{row.dispatchDate ? new Date(row.dispatchDate).toLocaleDateString('en-IN') : '—'}</div></td>
            <td className="p-3">{row.customer}</td><td className="p-3 capitalize">{row.dispatchStatus}</td><td className="p-3 text-right">{qty(row.dispatchedBoxes)}</td>
            <td className="p-3"><div>{row.invoiceNumber || 'Not invoiced'}</div><div className="text-xs text-slate-500">{row.invoiceStatus || ''}</div></td>
            <td className="p-3 text-right">{money(row.taxableSales)}</td><td className="p-3 text-right">{money(row.gst)}</td><td className="p-3 text-right">{money(row.invoiceTotal)}</td><td className="p-3 text-right">{money(row.payments)}</td><td className="p-3 text-right">{money(row.outstanding)}</td><td className="p-3 text-right">{row.grossProfit === null ? 'Pending' : money(row.grossProfit)}</td>
            <td className="p-3">{row.issues.length ? <div className="space-y-1 text-xs text-amber-700">{row.issues.map((issue, i) => <div key={i}>{issue}</div>)}</div> : <span className="text-xs text-emerald-700">Reconciled</span>}</td>
          </tr>)}{!rows.length && <tr><td colSpan={12} className="p-8 text-center text-slate-500">No delivery challans found for this period.</td></tr>}</tbody>
        </table></div>
      </section>
      <p className="text-xs text-slate-500">Gross profit is based on invoice-level cost snapshots. Invoices without recorded manufacturing cost are marked pending, not estimated. This report does not post accounting adjustments or change stock, invoices or party ledgers.</p>
    </>}
  </div>;
}

function Metric({ icon: Icon, label, value, detail }) {
  return <div className="rounded-2xl border border-slate-200 bg-white p-5"><p className="flex items-center gap-2 text-sm text-slate-500"><Icon size={15} />{label}</p><p className="mt-2 text-2xl font-bold text-slate-900">{value}</p><p className="mt-1 text-xs text-slate-500">{detail}</p></div>;
}
