import React, { useEffect, useState } from 'react';
import { CalendarDays, RefreshCw, TrendingUp, Receipt, Package, Wallet } from 'lucide-react';
import axiosClient from '../../api/axiosClient';

const money = (value) => '₹' + Number(value || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 });
const today = new Date();
const monthStart = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().slice(0, 10);
const todayValue = today.toISOString().slice(0, 10);

export default function ProfitLossPage() {
  const [from, setFrom] = useState(monthStart);
  const [to, setTo] = useState(todayValue);
  const [group, setGroup] = useState('monthly');
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const loadReport = async () => {
    setLoading(true);
    setError('');
    try {
      const { data } = await axiosClient.get('/reports/profit-loss', { params: { from, to } });
      setReport(data);
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to load the report.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadReport(); }, []);

  const rows = group === 'party' ? report?.partyWise || [] : group === 'daily' ? report?.daily || [] : report?.monthly || [];

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Profit & Loss Overview</h1>
          <p className="mt-1 text-sm text-slate-500">Manufacturing material cost, invoiced sales, receivables and scrap proceeds.</p>
        </div>
        <button onClick={loadReport} disabled={loading} className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 disabled:opacity-60"><RefreshCw size={15} className="mr-2 inline" />Refresh report</button>
      </div>

      <form onSubmit={(event) => { event.preventDefault(); loadReport(); }} className="flex flex-wrap items-end gap-3 rounded-2xl border border-slate-200 bg-white p-4">
        <label className="text-sm text-slate-600">From<input type="date" required value={from} onChange={(event) => setFrom(event.target.value)} className="mt-1 block rounded-lg border border-slate-200 px-3 py-2" /></label>
        <label className="text-sm text-slate-600">To<input type="date" required min={from} value={to} onChange={(event) => setTo(event.target.value)} className="mt-1 block rounded-lg border border-slate-200 px-3 py-2" /></label>
        <button type="submit" disabled={loading} className="rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60">{loading ? 'Generating…' : 'Apply period'}</button>
        {report && <span className="text-xs text-slate-500">Showing {report.period.from} to {report.period.to}</span>}
      </form>

      {error && <p role="alert" className="rounded-lg border border-red-100 bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      {loading && !report ? <p className="rounded-xl border bg-white p-10 text-center text-sm text-slate-500">Generating report…</p> : report && (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-2xl border border-slate-200 bg-white p-5"><p className="text-sm text-slate-500"><Receipt size={15} className="mr-1 inline" />Sales (ex-GST)</p><p className="mt-2 text-2xl font-bold text-slate-900">{money(report.summary.revenue)}</p><p className="mt-1 text-xs text-slate-500">{report.summary.invoiceCount} invoices</p></div>
            <div className="rounded-2xl border border-slate-200 bg-white p-5"><p className="text-sm text-slate-500"><Package size={15} className="mr-1 inline" />Cost of goods sold</p><p className="mt-2 text-2xl font-bold text-slate-900">{money(report.summary.costOfGoods)}</p><p className="mt-1 text-xs text-slate-500">{report.summary.costedInvoiceCount} costed · {report.summary.uncostedInvoiceCount} uncosted</p></div>
            <div className="rounded-2xl border border-slate-200 bg-white p-5"><p className="text-sm text-slate-500"><TrendingUp size={15} className="mr-1 inline" />Gross profit on costed invoices</p><p className="mt-2 text-2xl font-bold text-slate-900">{money(report.summary.grossProfit)}</p><p className="mt-1 text-xs text-slate-500">{report.summary.grossProfitCoveragePercent}% costing coverage</p></div>
            <div className="rounded-2xl border border-slate-200 bg-white p-5"><p className="text-sm text-slate-500"><Wallet size={15} className="mr-1 inline" />Receivables outstanding</p><p className="mt-2 text-2xl font-bold text-slate-900">{money(report.summary.balanceDue)}</p><p className="mt-1 text-xs text-slate-500">Scrap proceeds: {money(report.summary.scrapRevenue)}</p></div>
          </div>

          <section className="rounded-2xl border border-slate-200 bg-white p-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <h2 className="font-semibold text-slate-900">Breakdown</h2>
              <div className="flex gap-2">
                <button type="button" onClick={() => setGroup('daily')} className={'rounded-lg px-3 py-2 text-sm ' + (group === 'daily' ? 'bg-blue-600 text-white' : 'border border-slate-200 text-slate-600')}>Daily</button>
                <button type="button" onClick={() => setGroup('monthly')} className={'rounded-lg px-3 py-2 text-sm ' + (group === 'monthly' ? 'bg-blue-600 text-white' : 'border border-slate-200 text-slate-600')}>Monthly</button>
                <button type="button" onClick={() => setGroup('party')} className={'rounded-lg px-3 py-2 text-sm ' + (group === 'party' ? 'bg-blue-600 text-white' : 'border border-slate-200 text-slate-600')}>Party-wise</button>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead className="border-b text-xs uppercase text-slate-500"><tr><th className="py-3 pr-4">{group === 'party' ? 'Customer' : 'Period'}</th><th className="px-4 py-3 text-right">Invoices</th><th className="px-4 py-3 text-right">Sales</th><th className="px-4 py-3 text-right">Cost</th><th className="px-4 py-3 text-right">Gross profit*</th><th className="px-4 py-3 text-right">Balance due</th></tr></thead>
                <tbody className="divide-y">
                  {rows.map((row) => <tr key={row.key}>
                    <td className="py-3 pr-4 font-medium text-slate-800">{row.partyName || row.key}</td>
                    <td className="px-4 py-3 text-right">{row.invoiceCount}</td>
                    <td className="px-4 py-3 text-right">{money(row.revenue)}</td>
                    <td className="px-4 py-3 text-right">{money(row.costOfGoods)}</td>
                    <td className="px-4 py-3 text-right font-semibold">{money(row.grossProfit)}</td>
                    <td className="px-4 py-3 text-right">{money(row.balanceDue)}</td>
                  </tr>)}
                  {!rows.length && <tr><td colSpan="6" className="p-8 text-center text-slate-500">No invoice activity in this period.</td></tr>}
                </tbody>
              </table>
            </div>
            <p className="mt-3 text-xs text-slate-500">*Gross profit is calculated only for invoices with manufacturing cost snapshots.</p>
          </section>

          <section className="rounded-xl border border-amber-200 bg-amber-50/60 p-4">
            <h2 className="text-sm font-semibold text-amber-900">Important costing notes</h2>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-amber-900">
              {report.notes.map((note, index) => <li key={index}>{note}</li>)}
            </ul>
            <p className="mt-2 text-xs text-amber-900">Scrap sold: {Number(report.summary.scrapWeightKg || 0).toFixed(2)} kg · Scrap proceeds are separate from product gross profit.</p>
          </section>
        </>
      )}
    </div>
  );
}
