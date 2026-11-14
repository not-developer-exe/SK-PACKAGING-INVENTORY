import React, { useEffect, useState } from 'react';
import { RefreshCw, TrendingUp, Package, Factory, Truck, Receipt, Wallet, Trash2 } from 'lucide-react';
import axiosClient from '../../api/axiosClient';
import DateRangeFilter from '../../components/DateRangeFilter';

const money = value => '₹' + Number(value || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 });
const qty = value => Number(value || 0).toLocaleString('en-IN', { maximumFractionDigits: 3 });

export default function PeriodActivityPage() {
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [report, setReport] = useState(null);
  const [view, setView] = useState('daily');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = async (params = {}) => {
    setLoading(true);
    setError('');
    try {
      const { data } = await axiosClient.get('/reports/activity', { params });
      setReport(data);
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to load activity report.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const rows = view === 'daily' ? report?.daily || []
    : view === 'monthly' ? report?.monthly || []
    : view === 'party' ? report?.partyWise || []
    : view === 'vendors' ? report?.vendors || []
    : report?.scrapBuyers || [];

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Factory Activity Reports</h1>
          <p className="mt-1 text-sm text-slate-500">Daily, monthly and party-wise view of purchases, production, finished goods, dispatches, sales and expenses.</p>
        </div>
        <button onClick={() => load({ from, to })} disabled={loading} className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 disabled:opacity-60"><RefreshCw size={15} className="mr-2 inline" />Refresh</button>
      </header>

      <DateRangeFilter from={from} to={to} onFromChange={setFrom} onToChange={setTo} onApply={() => load({ from, to })} onReset={() => { setFrom(''); setTo(''); load({}); }} loading={loading} label="Factory activity date range" />

      {error && <p role="alert" className="rounded-lg border border-red-100 bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      {loading && !report ? <p className="rounded-xl border bg-white p-10 text-center text-sm text-slate-500">Generating activity report…</p> : report && (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Metric icon={Package} label="Paper inward" value={qty(report.summary.inwardWeightKg) + ' kg'} detail={report.summary.inwardReceipts + ' receipts · ' + qty(report.summary.inwardReels) + ' reels'} />
            <Metric icon={Factory} label="Production" value={report.summary.productionRuns + ' runs'} detail={qty(report.summary.inputWeightKg) + ' kg input · ' + qty(report.summary.sheetOutputWeightKg) + ' kg sheets'} />
            <Metric icon={Package} label="Finished goods" value={qty(report.summary.boxesProduced) + ' boxes'} detail={report.summary.finishedBatches + ' batches'} />
            <Metric icon={Truck} label="Dispatches" value={qty(report.summary.boxesDispatched) + ' boxes'} detail={report.summary.dispatches + ' challans'} />
            <Metric icon={Receipt} label="Sales (ex-GST)" value={money(report.summary.salesExGst)} detail={report.summary.invoices + ' invoices'} />
            <Metric icon={Wallet} label="Expenses recorded" value={money(report.summary.expenses)} detail={report.summary.expenseEntries + ' entries'} />
            <Metric icon={Trash2} label="Scrap sold" value={qty(report.summary.scrapWeightKg) + ' kg'} detail={money(report.summary.scrapRevenue) + ' proceeds · ' + report.summary.scrapSales + ' sales'} />
            <Metric icon={TrendingUp} label="Stock movements" value={qty(report.summary.stockMovements)} detail="Ledger movement entries" />
          </div>

          <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 p-4">
              <div>
                <h2 className="font-semibold text-slate-900">Activity breakdown</h2>
                <p className="text-xs text-slate-500">{report.period.from || 'All dates'} {report.period.to ? 'to ' + report.period.to : ''}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {[
                  ['daily', 'Daily'], ['monthly', 'Monthly'], ['party', 'Party-wise'],
                  ['vendors', 'Vendors'], ['scrap', 'Scrap buyers']
                ].map(([key, label]) => <button key={key} onClick={() => setView(key)} className={'rounded-lg px-3 py-2 text-sm font-medium ' + (view === key ? 'bg-blue-600 text-white' : 'border border-slate-200 text-slate-600 hover:bg-slate-50')}>{label}</button>)}
              </div>
            </div>
            <div className="overflow-x-auto">
              {view === 'daily' || view === 'monthly' ? (
                <table className="w-full min-w-[1250px] text-left text-sm">
                  <thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr>
                    <th className="px-3 py-3">{view === 'daily' ? 'Date' : 'Month'}</th>
                    <th className="px-3 py-3 text-right">Inward kg</th><th className="px-3 py-3 text-right">Reels</th>
                    <th className="px-3 py-3 text-right">Production runs</th><th className="px-3 py-3 text-right">Input kg</th><th className="px-3 py-3 text-right">Sheet kg</th>
                    <th className="px-3 py-3 text-right">Boxes made</th><th className="px-3 py-3 text-right">Dispatch boxes</th>
                    <th className="px-3 py-3 text-right">Invoices</th><th className="px-3 py-3 text-right">Sales</th>
                    <th className="px-3 py-3 text-right">Receivables</th><th className="px-3 py-3 text-right">Expenses</th>
                    <th className="px-3 py-3 text-right">Scrap kg</th><th className="px-3 py-3 text-right">Scrap revenue</th><th className="px-3 py-3 text-right">Stock moves</th>
                  </tr></thead>
                  <tbody className="divide-y">{rows.map(row => <tr key={row.key}>
                    <td className="px-3 py-3 font-semibold">{row.key}</td>
                    <td className="px-3 py-3 text-right">{qty(row.inwardWeightKg)}</td><td className="px-3 py-3 text-right">{qty(row.inwardReels)}</td>
                    <td className="px-3 py-3 text-right">{row.productionRuns}</td><td className="px-3 py-3 text-right">{qty(row.inputWeightKg)}</td><td className="px-3 py-3 text-right">{qty(row.sheetOutputWeightKg)}</td>
                    <td className="px-3 py-3 text-right">{qty(row.boxesProduced)}</td><td className="px-3 py-3 text-right">{qty(row.boxesDispatched)}</td>
                    <td className="px-3 py-3 text-right">{row.invoices}</td><td className="px-3 py-3 text-right font-medium">{money(row.salesExGst)}</td>
                    <td className="px-3 py-3 text-right">{money(row.receivables)}</td><td className="px-3 py-3 text-right">{money(row.expenses)}</td>
                    <td className="px-3 py-3 text-right">{qty(row.scrapWeightKg)}</td><td className="px-3 py-3 text-right">{money(row.scrapRevenue)}</td><td className="px-3 py-3 text-right">{row.stockMovements}</td>
                  </tr>)}{!rows.length && <EmptyRow colSpan={15} />}</tbody>
                </table>
              ) : view === 'party' ? (
                <table className="w-full min-w-[1100px] text-left text-sm">
                  <thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="p-3">Party</th><th className="p-3">Type</th><th className="p-3 text-right">Inward receipts</th><th className="p-3 text-right">Inward kg</th><th className="p-3 text-right">Finished batches</th><th className="p-3 text-right">Boxes made</th><th className="p-3 text-right">Dispatches</th><th className="p-3 text-right">Boxes sent</th><th className="p-3 text-right">Invoices</th><th className="p-3 text-right">Sales</th><th className="p-3 text-right">Receivables</th></tr></thead>
                  <tbody className="divide-y">{rows.map(row => <tr key={row.key}><td className="p-3 font-semibold">{row.partyName}</td><td className="p-3">{row.partyType}</td><td className="p-3 text-right">{row.inwardReceipts}</td><td className="p-3 text-right">{qty(row.inwardWeightKg)}</td><td className="p-3 text-right">{row.finishedBatches}</td><td className="p-3 text-right">{qty(row.boxesProduced)}</td><td className="p-3 text-right">{row.dispatches}</td><td className="p-3 text-right">{qty(row.boxesDispatched)}</td><td className="p-3 text-right">{row.invoices}</td><td className="p-3 text-right font-medium">{money(row.salesExGst)}</td><td className="p-3 text-right">{money(row.receivables)}</td></tr>)}{!rows.length && <EmptyRow colSpan={11} />}</tbody>
                </table>
              ) : view === 'vendors' ? (
                <table className="w-full text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="p-3">Vendor / paid to</th><th className="p-3 text-right">Entries</th><th className="p-3 text-right">Amount</th></tr></thead><tbody className="divide-y">{rows.map(row => <tr key={row.vendor}><td className="p-3 font-medium">{row.vendor}</td><td className="p-3 text-right">{row.entries}</td><td className="p-3 text-right font-semibold">{money(row.amount)}</td></tr>)}{!rows.length && <EmptyRow colSpan={3} />}</tbody></table>
              ) : (
                <table className="w-full text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="p-3">Scrap buyer</th><th className="p-3 text-right">Sales</th><th className="p-3 text-right">Weight (kg)</th><th className="p-3 text-right">Revenue</th></tr></thead><tbody className="divide-y">{rows.map(row => <tr key={row.buyer}><td className="p-3 font-medium">{row.buyer}</td><td className="p-3 text-right">{row.sales}</td><td className="p-3 text-right">{qty(row.weightKg)}</td><td className="p-3 text-right font-semibold">{money(row.revenue)}</td></tr>)}{!rows.length && <EmptyRow colSpan={4} />}</tbody></table>
              )}
            </div>
          </section>
          <p className="text-xs text-slate-500">This is an operational activity register, not a statutory accounting statement. Purchases are counted from inward receipts; sales are ex-GST; current stock balances are shown in their respective inventory modules.</p>
        </>
      )}
    </div>
  );
}

function Metric({ icon: Icon, label, value, detail }) {
  return <div className="rounded-2xl border border-slate-200 bg-white p-5"><p className="flex items-center gap-2 text-sm text-slate-500"><Icon size={15} />{label}</p><p className="mt-2 text-2xl font-bold text-slate-900">{value}</p><p className="mt-1 text-xs text-slate-500">{detail}</p></div>;
}

function EmptyRow({ colSpan }) {
  return <tr><td colSpan={colSpan} className="p-8 text-center text-slate-500">No activity found for this period.</td></tr>;
}
