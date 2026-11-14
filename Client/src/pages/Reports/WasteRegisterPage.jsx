import React, { useState, useEffect } from 'react';
import { wasteService } from '../../services/wasteService';
import DateRangeFilter from '../../components/DateRangeFilter';
import { Trash2, IndianRupee, Loader2 } from 'lucide-react';

export default function WasteRegisterPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState('inventory');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState(''); // 'inventory' or 'sales'

  // Sale form state
  const [buyerName, setBuyerName] = useState('');
  const [weightSoldKg, setWeightSoldKg] = useState('');
  const [ratePerKg, setRatePerKg] = useState('');
  const [saleDate, setSaleDate] = useState(() => { const date = new Date(); return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 10); });

  const fetchData = async (dateParams = {}) => {
    try {
      setLoading(true);
      const res = await wasteService.getWasteData(dateParams);
      setData(res);
    } catch (error) {
      console.error('Error fetching waste data', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleSaleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (Number(weightSoldKg) > data.currentWasteInventory) {
        alert('Cannot sell more waste than currently available in inventory.');
        setSubmitting(false);
        return;
      }

      await wasteService.recordSale({ buyerName, weightSoldKg, ratePerKg, saleDate });
      setBuyerName('');
      setWeightSoldKg('');
      setRatePerKg('');
      fetchData({ from, to });
    } catch (error) {
      alert(error.response?.data?.message || 'Error recording sale');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading || !data) return <div className="flex h-64 items-center justify-center"><Loader2 className="animate-spin text-blue-600" size={32} /></div>;

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Waste Register</h1>
        <p className="mt-1 text-sm text-slate-500">Track corrugation machine waste and log scrap sales.</p>
      </div>

      <DateRangeFilter from={from} to={to} onFromChange={setFrom} onToChange={setTo} onApply={() => fetchData({ from, to })} onReset={() => { setFrom(''); setTo(''); fetchData({}); }} loading={loading} label="Waste / scrap date range" />

      {/* Top Metrics */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-amber-800">Current Scrap Inventory</h2>
          <p className="mt-2 text-3xl font-bold text-amber-900">{Number(data.currentWasteInventory || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })} <span className="text-base font-medium">kg</span></p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-600">Verified Scrap Generated</h2>
          <p className="mt-2 text-3xl font-bold text-slate-900">{Number(data.totalWasteGenerated || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })} <span className="text-base font-medium">kg</span></p>
        </div>
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-emerald-800">Total Scrap Sold</h2>
          <p className="mt-2 text-3xl font-bold text-emerald-900">{Number(data.totalWasteSold || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })} <span className="text-base font-medium">kg</span></p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-600">Legacy Unverified Variance</h2>
          <p className="mt-2 text-3xl font-bold text-slate-900">{Number(data.legacyUnverifiedWasteKg || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })} <span className="text-base font-medium">kg</span></p>
        </div>
      </div>

      {Number(data.legacyUnverifiedWasteKg || 0) > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          {Number(data.legacyUnverifiedWasteKg).toFixed(2)} kg of historical production variance is unverified. It is shown for reconciliation but is not counted as saleable scrap stock.
        </div>
      )}
      {Number(data.currentWasteInventory || 0) < 0 && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          Scrap stock is below zero by {Math.abs(Number(data.currentWasteInventory)).toFixed(2)} kg because historical scrap sales exceed verified scrap entries. New scrap sales are blocked until this is reconciled.
        </div>
      )}

      {/* Record Sale Form */}
      <form onSubmit={handleSaleSubmit} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-sm font-semibold text-slate-900 flex items-center gap-2">
          <IndianRupee size={18} className="text-emerald-600" /> Record Scrap Sale
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-5">
          <div>
            <input type="date" required aria-label="Scrap sale date" value={saleDate} onChange={e => setSaleDate(e.target.value)} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-400" />
          </div>
          <div>
            <input type="text" required placeholder="Buyer / Vendor Name" value={buyerName} onChange={e => setBuyerName(e.target.value)} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-400" />
          </div>
          <div>
            <input type="number" step="0.01" required placeholder="Weight Sold (kg)" value={weightSoldKg} onChange={e => setWeightSoldKg(e.target.value)} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-400" />
          </div>
          <div>
            <input type="number" step="0.01" required placeholder="Rate (₹ per kg)" value={ratePerKg} onChange={e => setRatePerKg(e.target.value)} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-400" />
          </div>
          <div>
            <button type="submit" disabled={submitting || data.currentWasteInventory <= 0} className="w-full inline-flex items-center justify-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-70">
              {submitting ? <Loader2 className="animate-spin" size={16} /> : 'Sell Scrap'}
            </button>
          </div>
        </div>
      </form>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-slate-200 pb-2">
        <button onClick={() => setActiveTab('inventory')} className={`px-4 py-2 text-sm font-medium transition ${activeTab === 'inventory' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-slate-500 hover:text-slate-800'}`}>Verified Scrap Log</button>
        <button onClick={() => setActiveTab('sales')} className={`px-4 py-2 text-sm font-medium transition ${activeTab === 'sales' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-slate-500 hover:text-slate-800'}`}>Scrap Sales History</button>
      </div>

      {/* Data Tables */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        {activeTab === 'inventory' ? (
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-5 py-3 font-semibold">Date</th>
                <th className="px-5 py-3 font-semibold">Source</th>
                <th className="px-5 py-3 text-right font-semibold">Recoverable Scrap (kg)</th>
                <th className="px-5 py-3 font-semibold">Operator</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.productionWaste.map((run) => (
                <tr key={run._id} className="hover:bg-slate-50">
                  <td className="px-5 py-4 text-slate-600">{new Date(run.runDate || run.createdAt).toLocaleString('en-IN')}</td>
                  <td className="px-5 py-4 font-medium text-slate-900">Run {run.runNumber}</td>
                  <td className="px-5 py-4 text-right font-medium text-amber-600">+{Number(run.recoverableWasteKg || 0).toFixed(2)}</td>
                  <td className="px-5 py-4 text-slate-700">{run.operatorName}</td>
                </tr>
              ))}
              {data.productionWaste.length === 0 && (<tr><td colSpan={4} className="p-6 text-center text-slate-500">No measured recoverable scrap recorded yet.</td></tr>)}
            </tbody>
          </table>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-5 py-3 font-semibold">Date</th>
                <th className="px-5 py-3 font-semibold">Buyer / Vendor</th>
                <th className="px-5 py-3 text-right font-semibold">Weight Sold</th>
                <th className="px-5 py-3 text-right font-semibold">Rate</th>
                <th className="px-5 py-3 text-right font-semibold">Total Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.scrapSales.map((sale) => (
                <tr key={sale._id} className="hover:bg-slate-50">
                  <td className="px-5 py-4 text-slate-600">{new Date(sale.saleDate || sale.createdAt).toLocaleDateString('en-IN')}</td>
                  <td className="px-5 py-4 font-medium text-slate-900">{sale.buyerName}</td>
                  <td className="px-5 py-4 text-right text-slate-700">{sale.weightSoldKg.toFixed(1)} kg</td>
                  <td className="px-5 py-4 text-right text-slate-700">₹{sale.ratePerKg.toFixed(2)}</td>
                  <td className="px-5 py-4 text-right font-medium text-emerald-600">₹{sale.totalAmount.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</td>
                </tr>
              ))}
              {data.scrapSales.length === 0 && (<tr><td colSpan={5} className="p-6 text-center text-slate-500">No scrap sales recorded yet.</td></tr>)}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}