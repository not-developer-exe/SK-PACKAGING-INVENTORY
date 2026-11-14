import React, { useState, useEffect } from 'react';
import { conversionService } from '../../services/conversionService';
import { partiesService } from '../../services/partiesService';
import DateRangeFilter from '../../components/DateRangeFilter';
import { Package, Scissors, Loader2 } from 'lucide-react';

export default function ConversionPage() {
  const [sheets, setSheets] = useState([]);
  const [finishedGoods, setFinishedGoods] = useState([]);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [customerFilter, setCustomerFilter] = useState('');
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Form State
  const [sheetId, setSheetId] = useState('');
  const [conversionDate, setConversionDate] = useState(() => { const date = new Date(); return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 10); });
  const [sheetsConsumed, setSheetsConsumed] = useState('');
  const [customerId, setCustomerId] = useState('');
  const [itemName, setItemName] = useState('');
  const [dimensions, setDimensions] = useState({ length: '', width: '', height: '' });
  const [boxesProduced, setBoxesProduced] = useState('');

  const fetchData = async (dateParams = {}) => {
    try {
      setLoading(true);
      const [sheetData, customerData, finishedGoodsData] = await Promise.all([
        conversionService.getAvailableSheets(),
        partiesService.getCustomers(),
        conversionService.getFinishedGoods(dateParams)
      ]);
      setSheets(sheetData);
      setCustomers(customerData);
      setFinishedGoods(finishedGoodsData);
    } catch (err) {
      console.error('Error fetching conversion data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setSubmitting(true);

    try {
      const selectedSheet = sheets.find(s => s._id === sheetId);
      if (selectedSheet && Number(sheetsConsumed) > selectedSheet.sheetCount) {
        throw new Error(`You only have ${selectedSheet.sheetCount} sheets available in this batch.`);
      }

      const res = await conversionService.recordConversion({
        sheetId,
        conversionDate,
        sheetsConsumed: Number(sheetsConsumed),
        customerId,
        itemName,
        dimensions: {
          length: Number(dimensions.length),
          width: Number(dimensions.width),
          height: Number(dimensions.height)
        },
        boxesProduced: Number(boxesProduced)
      });

      setSuccess(`Success! Batch ${res.batchNumber} created with ${boxesProduced} boxes.`);
      
      // Reset form
      setSheetId('');
      setSheetsConsumed('');
      setCustomerId('');
      setItemName('');
      setDimensions({ length: '', width: '', height: '' });
      setBoxesProduced('');
      
      fetchData({ from, to, customerId: customerFilter }); // Refresh available sheets and filtered history
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Error recording conversion');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div className="flex h-64 items-center justify-center"><Loader2 className="animate-spin text-blue-600" size={32} /></div>;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Box Conversion (Finishing)</h1>
        <p className="mt-1 text-sm text-slate-500">Convert WIP corrugated sheets into finished boxes ready for dispatch.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Source Material */}
        <div className="rounded-2xl border border-blue-200 bg-blue-50/30 p-6">
          <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-blue-900">
            <Scissors size={20} /> Source Material (WIP Sheets)
          </h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="sm:col-span-2">
              <label className="mb-1 block text-sm font-medium text-slate-700">Select Corrugated Sheet *</label>
              <select required value={sheetId} onChange={e => setSheetId(e.target.value)} className="w-full rounded-xl border border-blue-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-400">
                <option value="">Select available WIP sheets...</option>
                {sheets.map(sheet => (
                  <option key={sheet._id} value={sheet._id}>
                    {sheet.ply}Ply | {sheet.lengthInches}" x {sheet.widthInches}" | {sheet.sheetCount} sheets · {Number(sheet.totalWeightKg?.$numberDecimal || sheet.totalWeightKg || 0).toFixed(2)} kg | {sheet.costingStatus === 'available' ? '₹' + Number(sheet.unitCostPerKg?.$numberDecimal || sheet.unitCostPerKg || 0).toFixed(2) + '/kg' : 'Cost pending'} | {sheet.productionRunId?.runNumber || 'Legacy batch'} · {sheet.productionRunId?.runDate ? new Date(sheet.productionRunId.runDate).toLocaleDateString('en-IN') : 'date unavailable'}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Sheets Consumed *</label>
              <input type="number" min="1" required value={sheetsConsumed} onChange={e => setSheetsConsumed(e.target.value)} placeholder="e.g. 500" className="w-full rounded-xl border border-blue-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-400" />
            </div>
          </div>
        </div>

        {/* Finished Box Details */}
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/30 p-6">
          <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-emerald-900">
            <Package size={20} /> Finished Product
          </h2>
          
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Customer *</label>
              <select required value={customerId} onChange={e => setCustomerId(e.target.value)} className="w-full rounded-xl border border-emerald-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-emerald-400">
                <option value="">Select customer...</option>
                {customers.map(c => (
                  <option key={c._id} value={c._id}>{c.name}</option>
                ))}
              </select>
              {customers.length === 0 && (
                <p className="mt-1 text-xs text-amber-600">No customers found. Add one in Party Master first.</p>
              )}
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Item / Box Name *</label>
              <input type="text" required value={itemName} onChange={e => setItemName(e.target.value)} placeholder="e.g. 5kg Apple Box" className="w-full rounded-xl border border-emerald-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-emerald-400" />
            </div>
          </div>

          <div className="mt-4 grid grid-cols-3 gap-4 sm:grid-cols-6">
            <div className="col-span-1 sm:col-span-2">
              <label className="mb-1 block text-xs font-medium text-slate-700">Length (in) *</label>
              <input type="number" step="any" required value={dimensions.length} onChange={e => setDimensions({...dimensions, length: e.target.value})} className="w-full rounded-xl border border-emerald-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-emerald-400" />
            </div>
            <div className="col-span-1 sm:col-span-2">
              <label className="mb-1 block text-xs font-medium text-slate-700">Width (in) *</label>
              <input type="number" step="any" required value={dimensions.width} onChange={e => setDimensions({...dimensions, width: e.target.value})} className="w-full rounded-xl border border-emerald-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-emerald-400" />
            </div>
            <div className="col-span-1 sm:col-span-2">
              <label className="mb-1 block text-xs font-medium text-slate-700">Height (in) *</label>
              <input type="number" step="any" required value={dimensions.height} onChange={e => setDimensions({...dimensions, height: e.target.value})} className="w-full rounded-xl border border-emerald-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-emerald-400" />
            </div>
          </div>

          <div className="mt-4 border-t border-emerald-200/50 pt-4">
            <label className="mb-1 block text-sm font-medium text-slate-700">Total Boxes Produced *</label>
            <input type="number" min="1" required value={boxesProduced} onChange={e => setBoxesProduced(e.target.value)} placeholder="e.g. 1500" className="w-full sm:w-1/3 rounded-xl border border-emerald-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-emerald-400" />
          </div>
        </div>

        {error && <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">{error}</div>}
        {success && <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-medium text-emerald-700">{success}</div>}

        <div className="flex justify-end pt-2">
          <button type="submit" disabled={submitting} className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-700 px-6 py-3 text-sm font-semibold text-white transition hover:bg-blue-800 disabled:opacity-70">
            {submitting ? <Loader2 className="animate-spin" size={18} /> : <><Package size={18} /> Record Finished Goods</>}
          </button>
        </div>
      </form>

      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Finished Goods History</h2>
          <p className="text-sm text-slate-500">Track manufactured box batches by conversion date and customer.</p>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-56">
            <label className="mb-1 block text-xs font-medium text-slate-600">Customer</label>
            <select value={customerFilter} onChange={e => setCustomerFilter(e.target.value)} className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm">
              <option value="">All customers</option>
              {customers.map(customer => <option key={customer._id} value={customer._id}>{customer.name}</option>)}
            </select>
          </div>
          <div className="flex-1">
            <DateRangeFilter from={from} to={to} onFromChange={setFrom} onToChange={setTo} onApply={() => fetchData({ from, to, customerId: customerFilter })} onReset={() => { setFrom(''); setTo(''); setCustomerFilter(''); fetchData({}); }} loading={loading} label="Manufacturing date range" />
          </div>
        </div>
        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
          <table className="w-full min-w-[950px] text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr><th className="px-4 py-3">Date</th><th className="px-4 py-3">Batch</th><th className="px-4 py-3">Customer</th><th className="px-4 py-3">Item</th><th className="px-4 py-3">Dimensions</th><th className="px-4 py-3 text-right">Produced</th><th className="px-4 py-3 text-right">Available</th><th className="px-4 py-3 text-right">Cost / box</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {finishedGoods.map(box => <tr key={box._id}>
                <td className="px-4 py-3 whitespace-nowrap">{new Date(box.manufacturedAt || box.createdAt).toLocaleDateString('en-IN')}</td>
                <td className="px-4 py-3 font-semibold text-blue-700">{box.batchNumber}</td>
                <td className="px-4 py-3">{box.customerId?.name || '—'}</td>
                <td className="px-4 py-3 font-medium">{box.itemName}</td>
                <td className="px-4 py-3">{box.dimensions?.length} × {box.dimensions?.width} × {box.dimensions?.height}</td>
                <td className="px-4 py-3 text-right">{Number(box.quantityProduced || 0).toLocaleString('en-IN')}</td>
                <td className="px-4 py-3 text-right font-semibold">{Number(box.quantityAvailable || 0).toLocaleString('en-IN')}</td>
                <td className="px-4 py-3 text-right">{box.costingStatus === 'available' ? '₹' + Number(box.costPerBox || 0).toFixed(2) : 'Pending'}</td>
              </tr>)}
              {!finishedGoods.length && <tr><td colSpan={8} className="p-8 text-center text-slate-500">No finished goods batches found for this period.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}