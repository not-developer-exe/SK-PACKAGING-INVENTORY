import React, { useState, useEffect } from 'react';
import { ledgerService } from '../../services/ledgerService';
import { BookOpen, ArrowUpRight, ArrowDownRight, Loader2 } from 'lucide-react';
import DateRangeFilter from '../../components/DateRangeFilter';

export default function StockLedgerPage() {
  const [movements, setMovements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  useEffect(() => {
    const fetchLedger = async (dateParams = {}) => {
      try {
        const data = await ledgerService.getLedger(dateParams);
        setMovements(data);
      } catch (error) {
        console.error('Failed to load ledger:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchLedger();
  }, []);

  const fetchFilteredLedger = async (dateParams) => {
    setLoading(true);
    try { setMovements(await ledgerService.getLedger(dateParams)); }
    catch (error) { console.error('Failed to load ledger:', error); }
    finally { setLoading(false); }
  };

  const filteredMovements = movements.filter(m => {
    if (filter === 'all') return true;
    if (filter === 'inward') return m.movementType === 'inward_receipt';
    if (filter === 'production') return ['production_issue', 'sheet_cutting'].includes(m.movementType);
    if (filter === 'conversion') return m.movementType === 'adjustment'; // Box conversion
    return true;
  });

  const getMovementIcon = (change) => {
    if (change > 0) return <ArrowDownRight size={16} className="text-emerald-500" />;
    if (change < 0) return <ArrowUpRight size={16} className="text-amber-500" />;
    return null;
  };

  const formatType = (type) => {
    return type.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  };

  if (loading) return <div className="flex h-64 items-center justify-center"><Loader2 className="animate-spin text-blue-600" size={32} /></div>;

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Stock Ledger</h1>
        <p className="mt-1 text-sm text-slate-500">Immutable audit trail of all inventory movements across the factory.</p>
      </div>

      <DateRangeFilter from={from} to={to} onFromChange={setFrom} onToChange={setTo} onApply={() => fetchFilteredLedger({ from, to })} onReset={() => { setFrom(''); setTo(''); fetchFilteredLedger({}); }} loading={loading} label="Stock movement date range" />

      <div className="flex gap-2 border-b border-slate-200 pb-4">
        {['all', 'inward', 'production', 'conversion'].map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
              filter === f ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1000px] text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-5 py-3 font-semibold">Date & Time</th>
                <th className="px-5 py-3 font-semibold">Type</th>
                <th className="px-5 py-3 font-semibold">Item Category</th>
                <th className="px-5 py-3 font-semibold">Specification Summary</th>
                <th className="px-5 py-3 text-right font-semibold">Qty Change</th>
                <th className="px-5 py-3 text-right font-semibold">Wt Change (kg)</th>
                <th className="px-5 py-3 font-semibold">Operator</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredMovements.map((m) => (
                <tr key={m._id} className="transition hover:bg-slate-50">
                  <td className="whitespace-nowrap px-5 py-4 text-slate-600">
                    {new Date(m.movementDate || m.createdAt).toLocaleString('en-IN', { 
                      day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' 
                    })}
                  </td>
                  <td className="whitespace-nowrap px-5 py-4 font-medium text-slate-900">
                    <span className="flex items-center gap-1.5">
                      <BookOpen size={14} className="text-slate-400" />
                      {formatType(m.movementType)}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-slate-700 capitalize">
                    {m.itemType.replace('_', ' ')}
                  </td>
                  <td className="px-5 py-4 text-slate-600">
                    {m.specificationSummary}
                    <p className="mt-0.5 text-xs text-slate-400">{m.notes}</p>
                  </td>
                  <td className="whitespace-nowrap px-5 py-4 text-right font-medium">
                    <span className="flex items-center justify-end gap-1">
                      {getMovementIcon(m.quantityChange)}
                      <span className={m.quantityChange > 0 ? 'text-emerald-700' : m.quantityChange < 0 ? 'text-amber-700' : 'text-slate-500'}>
                        {m.quantityChange > 0 ? '+' : ''}{m.quantityChange}
                      </span>
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-5 py-4 text-right font-medium">
                    <span className={`flex items-center justify-end gap-1 ${
                      parseFloat(m.weightChangeKg) > 0 ? 'text-emerald-700' : parseFloat(m.weightChangeKg) < 0 ? 'text-amber-700' : 'text-slate-500'
                    }`}>
                      {parseFloat(m.weightChangeKg) > 0 ? '+' : ''}{parseFloat(m.weightChangeKg).toFixed(2)}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-5 py-4 text-slate-700">
                    {m.performedBy?.name || 'System'}
                  </td>
                </tr>
              ))}
              {filteredMovements.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-5 py-12 text-center text-slate-500">
                    No records found in the ledger.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}