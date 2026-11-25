import React, { useState, useEffect } from 'react';
import { wasteService } from '../../services/wasteService';
import DateRangeFilter from '../../components/DateRangeFilter';
import { IndianRupee, Loader2 } from 'lucide-react';

const localToday = () => {
  const date = new Date();
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
};

export default function WasteRegisterPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState('sales');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [buyerFilter, setBuyerFilter] = useState('');

  const [buyerName, setBuyerName] = useState('');
  const [weightSoldKg, setWeightSoldKg] = useState('');
  const [ratePerKg, setRatePerKg] = useState('');
  const [saleType, setSaleType] = useState('scrap');
  const [saleDate, setSaleDate] = useState(localToday);
  const [thakEntryType, setThakEntryType] = useState('production');
  const [thakWeightKg, setThakWeightKg] = useState('');
  const [thakNotes, setThakNotes] = useState('');
  const [thakEntryDate, setThakEntryDate] = useState(localToday);

  const fetchData = async (dateParams = {}) => {
    try {
      setLoading(true);
      setData(await wasteService.getWasteData(dateParams));
    } catch (error) {
      console.error('Error fetching scrap and Thak data', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const refreshPeriod = () => fetchData({ from, to, buyerName: buyerFilter });

  const handleSaleSubmit = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    try {
      if (saleType === 'thak' && Number(weightSoldKg) > Number(data.currentThakInventory || 0)) {
        alert('Cannot sell more Thak than the available weighed stock.');
        return;
      }
      await wasteService.recordSale({ buyerName, weightSoldKg, ratePerKg, saleDate, saleType });
      setBuyerName('');
      setWeightSoldKg('');
      setRatePerKg('');
      await refreshPeriod();
    } catch (error) {
      alert(error.response?.data?.message || 'Error recording sale');
    } finally {
      setSubmitting(false);
    }
  };

  const handleThakSubmit = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    try {
      await wasteService.recordThakEntry({ entryDate: thakEntryDate, entryType: thakEntryType, weightKg: thakWeightKg, notes: thakNotes });
      setThakWeightKg('');
      setThakNotes('');
      await refreshPeriod();
    } catch (error) {
      alert(error.response?.data?.message || 'Error recording Thak stock');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading || !data) return <div className="flex h-64 items-center justify-center"><Loader2 className="animate-spin text-blue-600" size={32} /></div>;

  const sales = [...(data.scrapSales || []), ...(data.thakSales || [])]
    .sort((a, b) => new Date(b.saleDate) - new Date(a.saleDate));

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Scrap & Thak Register</h1>
        <p className="mt-1 text-sm text-slate-500">Normal scrap is recorded when sold. Moisture-damaged paper (Thak) is weighed into a separate stock ledger before sale.</p>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-56"><label className="mb-1 block text-xs font-medium text-slate-600">Buyer</label><input value={buyerFilter} onChange={event => setBuyerFilter(event.target.value)} placeholder="All buyers" className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm" /></div>
        <div className="flex-1"><DateRangeFilter from={from} to={to} onFromChange={setFrom} onToChange={setTo} onApply={refreshPeriod} onReset={() => { setFrom(''); setTo(''); setBuyerFilter(''); fetchData({}); }} loading={loading} label="Entry / sale date range" /></div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-5"><h2 className="text-sm font-semibold text-slate-600">Normal Scrap Sold</h2><p className="mt-2 text-3xl font-bold text-slate-900">{Number(data.totalScrapSold || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })} <span className="text-base font-medium">kg</span></p><p className="mt-1 text-xs text-slate-500">Selected period</p></div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5"><h2 className="text-sm font-semibold text-slate-600">Normal Scrap Proceeds</h2><p className="mt-2 text-3xl font-bold text-slate-900">₹{Number(data.totalScrapSalesAmount || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}</p><p className="mt-1 text-xs text-slate-500">Actual recorded sales</p></div>
        <div className="rounded-2xl border border-orange-200 bg-orange-50 p-5"><h2 className="text-sm font-semibold text-orange-800">Available Thak Stock</h2><p className="mt-2 text-3xl font-bold text-orange-900">{Number(data.currentThakInventory || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })} <span className="text-base font-medium">kg</span></p><p className="mt-1 text-xs text-orange-800">Weighed stock less Thak sold</p></div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5"><h2 className="text-sm font-semibold text-slate-600">Thak Sold</h2><p className="mt-2 text-3xl font-bold text-slate-900">{Number(data.totalThakSold || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })} <span className="text-base font-medium">kg</span></p><p className="mt-1 text-xs text-slate-500">₹{Number(data.totalThakSalesAmount || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })} proceeds in selected period</p></div>
      </div>

      <form onSubmit={handleThakSubmit} className="rounded-2xl border border-orange-200 bg-orange-50/40 p-6 shadow-sm">
        <h2 className="mb-2 text-sm font-semibold text-slate-900">Thak Stock Entry</h2>
        <p className="mb-4 text-xs text-slate-500">Post the opening balance once, then record each newly weighed Thak entry separately.</p>
        <div className="mb-4 inline-flex rounded-xl bg-orange-100 p-1">
          <button type="button" onClick={() => setThakEntryType('production')} className={'rounded-lg px-3 py-2 text-xs font-semibold ' + (thakEntryType === 'production' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600')}>New weighed entry</button>
          <button type="button" onClick={() => { setThakEntryType('opening_balance'); setThakEntryDate('2026-11-01'); setThakNotes('Opening Thak stock imported from STOCK oct.(3).xlsx'); setThakWeightKg('300'); }} className={'rounded-lg px-3 py-2 text-xs font-semibold ' + (thakEntryType === 'opening_balance' ? 'bg-white text-orange-800 shadow-sm' : 'text-slate-600')}>Opening balance</button>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
          <input type="date" required aria-label="Thak entry date" value={thakEntryDate} onChange={event => setThakEntryDate(event.target.value)} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm" />
          <input type="number" min="0.01" step="0.01" required placeholder="Thak weight (kg)" value={thakWeightKg} onChange={event => setThakWeightKg(event.target.value)} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm" />
          <input type="text" maxLength="500" placeholder="Notes (optional)" value={thakNotes} onChange={event => setThakNotes(event.target.value)} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm" />
          <button type="submit" disabled={submitting} className="rounded-xl bg-orange-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-60">{submitting ? 'Saving…' : thakEntryType === 'opening_balance' ? 'Post opening Thak' : 'Add Thak Stock'}</button>
        </div>
      </form>

      <form onSubmit={handleSaleSubmit} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-900"><IndianRupee size={18} className="text-emerald-600" />Record Scrap / Thak Sale</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-6">
          <select aria-label="Sale stock type" value={saleType} onChange={event => setSaleType(event.target.value)} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"><option value="scrap">Normal scrap</option><option value="thak">Thak</option></select>
          <input type="date" required aria-label="Sale date" value={saleDate} onChange={event => setSaleDate(event.target.value)} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" />
          <input type="text" required placeholder="Buyer name" value={buyerName} onChange={event => setBuyerName(event.target.value)} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" />
          <input type="number" min="0.01" step="0.01" required placeholder="Weight sold (kg)" value={weightSoldKg} onChange={event => setWeightSoldKg(event.target.value)} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" />
          <input type="number" min="0" step="0.01" required placeholder="Rate (₹/kg)" value={ratePerKg} onChange={event => setRatePerKg(event.target.value)} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" />
          <button type="submit" disabled={submitting || (saleType === 'thak' && Number(data.currentThakInventory || 0) <= 0)} className="w-full rounded-xl bg-emerald-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-60">{submitting ? 'Saving…' : saleType === 'thak' ? 'Sell Thak' : 'Sell Scrap'}</button>
        </div>
        {saleType === 'thak' && <p className="mt-2 text-xs text-slate-500">Available Thak: {Number(data.currentThakInventory || 0).toFixed(2)} kg. Normal scrap sales are recorded directly and do not depend on production-stage waste quantities.</p>}
      </form>

      <div className="flex gap-2 border-b border-slate-200 pb-2">
        <button onClick={() => setActiveTab('sales')} className={'px-4 py-2 text-sm font-medium ' + (activeTab === 'sales' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-slate-500')}>Sales History</button>
        <button onClick={() => setActiveTab('thak')} className={'px-4 py-2 text-sm font-medium ' + (activeTab === 'thak' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-slate-500')}>Thak Weighing Log</button>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        {activeTab === 'thak' ? (
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-5 py-3">Date</th><th className="px-5 py-3">Entry type</th><th className="px-5 py-3 text-right">Thak weighed (kg)</th><th className="px-5 py-3">Notes</th></tr></thead>
            <tbody className="divide-y divide-slate-100">{(data.thakEntries || []).map(entry => <tr key={entry._id}><td className="px-5 py-4">{new Date(entry.entryDate || entry.createdAt).toLocaleDateString('en-IN')}</td><td className="px-5 py-4">{entry.entryType === 'opening_balance' ? 'Opening balance' : 'Weighed entry'}</td><td className="px-5 py-4 text-right font-medium">{Number(entry.weightKg).toFixed(2)}</td><td className="px-5 py-4">{entry.notes || '—'}</td></tr>)}{!(data.thakEntries || []).length && <tr><td colSpan={4} className="p-6 text-center text-slate-500">No Thak stock entries recorded.</td></tr>}</tbody>
          </table>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-5 py-3">Date</th><th className="px-5 py-3">Category</th><th className="px-5 py-3">Buyer</th><th className="px-5 py-3 text-right">Weight sold</th><th className="px-5 py-3 text-right">Rate</th><th className="px-5 py-3 text-right">Amount</th></tr></thead>
            <tbody className="divide-y divide-slate-100">{sales.map(sale => <tr key={sale._id}><td className="px-5 py-4">{new Date(sale.saleDate || sale.createdAt).toLocaleDateString('en-IN')}</td><td className="px-5 py-4">{sale.saleType === 'thak' ? 'Thak' : 'Normal scrap'}</td><td className="px-5 py-4 font-medium">{sale.buyerName}</td><td className="px-5 py-4 text-right">{Number(sale.weightSoldKg).toFixed(2)} kg</td><td className="px-5 py-4 text-right">₹{Number(sale.ratePerKg).toFixed(2)}</td><td className="px-5 py-4 text-right font-medium">₹{Number(sale.totalAmount).toLocaleString('en-IN', { maximumFractionDigits: 2 })}</td></tr>)}{!sales.length && <tr><td colSpan={6} className="p-6 text-center text-slate-500">No sales recorded in this period.</td></tr>}</tbody>
          </table>
        )}
      </div>
    </div>
  );
}
