import React, { useState, useEffect } from 'react';
import { inwardService } from '../../services/inwardService';
import { partiesService } from '../../services/partiesService';
import DateRangeFilter from '../../components/DateRangeFilter';
import { ArrowDownToLine, Plus, ShieldCheck, CheckCircle2, FileText, Loader2, X } from 'lucide-react';

export default function StockInwardPage() {
  const [receipts, setReceipts] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [supplierFilter, setSupplierFilter] = useState('');

  // Form state
  const [supplierId, setSupplierId] = useState('');
  const [invoiceReference, setInvoiceReference] = useState('');
  const [receiptDate, setReceiptDate] = useState(new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState('');
  
  // Line items state
  const [lines, setLines] = useState([
    { reelWidthInches: '', bf: '', gsm: '', quality: 'Natural', reelCount: '', totalWeightKg: '', ratePerKg: '', freightCharges: 0, otherCharges: 0, supplierBatchRef: '' }
  ]);

  const fetchData = async (dateParams = {}) => {
    try {
      setLoading(true);
      const [recData, supData] = await Promise.all([
        inwardService.getReceipts(dateParams),
        partiesService.getSuppliers()
      ]);
      setReceipts(recData);
      setSuppliers(supData);
      if (supData.length > 0) setSupplierId(supData[0]._id);
    } catch (err) {
      console.error('Error loading inward data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleAddLine = () => {
    setLines([...lines, { reelWidthInches: '', bf: '', gsm: '', quality: 'Natural', reelCount: '', totalWeightKg: '', ratePerKg: '', freightCharges: 0, otherCharges: 0, supplierBatchRef: '' }]);
  };

  const handleLineChange = (index, field, value) => {
    const updated = [...lines];
    updated[index][field] = value;
    setLines(updated);
  };

  const handleRemoveLine = (index) => {
    if (lines.length === 1) return;
    setLines(lines.filter((_, i) => i !== index));
  };

  const handleSubmitDraft = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);

    try {
      // Validate lines
      for (const line of lines) {
        if (!line.reelWidthInches || !line.bf || !line.gsm || !line.reelCount || !line.totalWeightKg || !line.ratePerKg) {
          throw new Error('Please fill in all required fields for every line item.');
        }
      }

      await inwardService.createDraft({
        supplierId,
        invoiceReference,
        receiptDate,
        notes,
        lines: lines.map(l => ({
          ...l,
          reelWidthInches: Number(l.reelWidthInches),
          bf: Number(l.bf),
          gsm: Number(l.gsm),
          reelCount: Number(l.reelCount),
          totalWeightKg: Number(l.totalWeightKg),
          ratePerKg: Number(l.ratePerKg),
          freightCharges: Number(l.freightCharges || 0),
          otherCharges: Number(l.otherCharges || 0)
        }))
      });

      setShowModal(false);
      setInvoiceReference('');
      setNotes('');
      setLines([{ reelWidthInches: '', bf: '', gsm: '', quality: 'Natural', reelCount: '', totalWeightKg: '', ratePerKg: '', freightCharges: 0, otherCharges: 0, supplierBatchRef: '' }]);
      fetchData();
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to create draft');
    } finally {
      setSubmitting(false);
    }
  };

  const handlePostReceipt = async (id) => {
    if (!window.confirm('Are you sure you want to post this receipt? This will atomically generate physical reel units and update the stock ledger. This action cannot be undone.')) {
      return;
    }

    try {
      await inwardService.postReceipt(id);
      fetchData();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to post receipt');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Stock Inward</h1>
          <p className="mt-1 text-sm text-slate-500">Record supplier paper purchases, manage drafts, and post receipts to inventory.</p>
        </div>

        <button
          type="button"
          onClick={() => setShowModal(true)}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-800"
        >
          <Plus size={17} />
          New inward receipt
        </button>
      </div>

      <div className="flex flex-wrap items-end gap-3"><div className="min-w-56"><label className="mb-1 block text-xs font-medium text-slate-600">Supplier</label><select value={supplierFilter} onChange={e => setSupplierFilter(e.target.value)} className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"><option value="">All suppliers</option>{suppliers.map(supplier => <option key={supplier._id} value={supplier._id}>{supplier.name}</option>)}</select></div><div className="flex-1"><DateRangeFilter from={from} to={to} onFromChange={setFrom} onToChange={setTo} onApply={() => fetchData({ from, to, supplierId: supplierFilter })} onReset={() => { setFrom(''); setTo(''); setSupplierFilter(''); fetchData({}); }} loading={loading} label="Inward receipt date range" /></div></div>

      {/* Receipts Table */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <div className="border-b border-slate-100 p-5">
          <h2 className="text-base font-semibold text-slate-900">Receipt history</h2>
          <p className="text-sm text-slate-500">All draft and posted paper receipts from suppliers.</p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-5 py-3 font-semibold">Receipt #</th>
                <th className="px-5 py-3 font-semibold">Date</th>
                <th className="px-5 py-3 font-semibold">Supplier</th>
                <th className="px-5 py-3 font-semibold">Invoice Ref</th>
                <th className="px-5 py-3 text-right font-semibold">Lines</th>
                <th className="px-5 py-3 font-semibold">Status</th>
                <th className="px-5 py-3 text-right font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {receipts.map((rec) => (
                <tr key={rec._id} className="hover:bg-slate-50">
                  <td className="px-5 py-4 font-medium text-slate-900">{rec.receiptNumber}</td>
                  <td className="px-5 py-4 text-slate-700">{new Date(rec.receiptDate).toLocaleDateString('en-IN')}</td>
                  <td className="px-5 py-4 font-medium text-slate-800">{rec.supplierId?.name || 'Unknown Supplier'}</td>
                  <td className="px-5 py-4 text-slate-700">{rec.invoiceReference}</td>
                  <td className="px-5 py-4 text-right tabular-nums text-slate-700">{rec.lines.length}</td>
                  <td className="px-5 py-4">
                    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${rec.status === 'posted' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
                      {rec.status.toUpperCase()}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-right">
                    {rec.status === 'draft' ? (
                      <button
                        onClick={() => handlePostReceipt(rec._id)}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700"
                      >
                        <CheckCircle2 size={14} /> Post Receipt
                      </button>
                    ) : (
                      <span className="text-xs font-medium text-slate-400">Locked / Posted</span>
                    )}
                  </td>
                </tr>
              ))}
              {receipts.length === 0 && !loading && (
                <tr>
                  <td colSpan={7} className="px-5 py-12 text-center text-slate-500">
                    No inward receipts recorded yet. Click "New inward receipt" to begin.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Form */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/50 p-4">
          <div className="my-auto w-full max-w-4xl rounded-2xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-100 p-5">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">New Inward Receipt (Draft)</h2>
                <p className="mt-1 text-sm text-slate-500">Record paper reel purchases from verified suppliers.</p>
              </div>
              <button onClick={() => setShowModal(false)} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmitDraft} className="space-y-6 p-6">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">Supplier *</label>
                  <select
                    value={supplierId}
                    onChange={(e) => setSupplierId(e.target.value)}
                    required
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-400"
                  >
                    {suppliers.map(sup => (
                      <option key={sup._id} value={sup._id}>{sup.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">Invoice Reference *</label>
                  <input
                    type="text"
                    value={invoiceReference}
                    onChange={(e) => setInvoiceReference(e.target.value)}
                    placeholder="e.g. INV-2026-884"
                    required
                    className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-blue-400"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">Receipt Date *</label>
                  <input
                    type="date"
                    value={receiptDate}
                    onChange={(e) => setReceiptDate(e.target.value)}
                    required
                    className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-blue-400"
                  />
                </div>
              </div>

              {/* Line Items */}
              <div className="space-y-4 border-t border-slate-100 pt-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-slate-900">Receipt Line Items (Reel Specifications)</h3>
                  <button type="button" onClick={handleAddLine} className="text-xs font-semibold text-blue-700 hover:text-blue-900">+ Add another line</button>
                </div>

                {lines.map((line, idx) => (
                  <div key={idx} className="grid grid-cols-2 gap-3 rounded-xl border border-slate-200 bg-slate-50/50 p-4 sm:grid-cols-6">
                    <div>
                      <label className="mb-1 block text-xs font-medium text-slate-600">Width (in) *</label>
                      <input type="number" step="any" value={line.reelWidthInches} onChange={(e) => handleLineChange(idx, 'reelWidthInches', e.target.value)} placeholder="36" required className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm" />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-slate-600">BF *</label>
                      <input type="number" step="any" value={line.bf} onChange={(e) => handleLineChange(idx, 'bf', e.target.value)} placeholder="18" required className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm" />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-slate-600">GSM *</label>
                      <input type="number" step="any" value={line.gsm} onChange={(e) => handleLineChange(idx, 'gsm', e.target.value)} placeholder="140" required className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm" />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-slate-600">Quality *</label>
                      <select value={line.quality} onChange={(e) => handleLineChange(idx, 'quality', e.target.value)} className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm">
                        <option value="Natural">Natural</option>
                        <option value="GY">Golden Yellow (GY)</option>
                      </select>
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-slate-600">Reels Qty *</label>
                      <input type="number" min="1" value={line.reelCount} onChange={(e) => handleLineChange(idx, 'reelCount', e.target.value)} placeholder="5" required className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm" />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-slate-600">Total Wt (kg) *</label>
                      <input type="number" step="any" value={line.totalWeightKg} onChange={(e) => handleLineChange(idx, 'totalWeightKg', e.target.value)} placeholder="450" required className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm" />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="mb-1 block text-xs font-medium text-slate-600">Rate per kg (₹) *</label>
                      <input type="number" step="any" value={line.ratePerKg} onChange={(e) => handleLineChange(idx, 'ratePerKg', e.target.value)} placeholder="42.50" required className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm" />
                    </div>
                    <div className="sm:col-span-3 flex items-end">
                      {lines.length > 1 && (
                        <button type="button" onClick={() => handleRemoveLine(idx)} className="text-xs font-medium text-red-600 hover:text-red-800">Remove line</button>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {error && <div className="rounded-xl bg-red-50 p-3 text-sm text-red-600">{error}</div>}

              <div className="flex justify-end gap-3 border-t border-slate-100 pt-4">
                <button type="button" onClick={() => setShowModal(false)} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50">Cancel</button>
                <button type="submit" disabled={submitting} className="rounded-xl bg-blue-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-70">
                  {submitting ? <Loader2 className="animate-spin" size={18} /> : 'Save as draft'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}