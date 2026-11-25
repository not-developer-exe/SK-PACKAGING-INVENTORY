import React, { useEffect, useMemo, useState } from 'react';
import { Plus, RefreshCw, X, Package, Layers, ArrowDownToLine, FileText, Loader2 } from 'lucide-react';
import { inwardService } from '../../services/inwardService';
import { pastingService } from '../../services/pastingService';
import { partiesService } from '../../services/partiesService';
import DateRangeFilter from '../../components/DateRangeFilter';
import { toLocalDateInput } from '../../lib/date';

const blankReelLine = () => ({ reelWidthInches: '', bf: '', gsm: '', quality: 'Natural', reelCount: '', totalWeightKg: '', ratePerKg: '', freightCharges: 0, otherCharges: 0, supplierBatchRef: '', reelWeightsKg: '' });
const blankDuplex = () => ({ lengthInches: '', widthInches: '', sheetCount: '', totalWeightKg: '', ratePerKg: '', supplierName: '', inwardDate: toLocalDateInput(), notes: '' });
const kg = value => Number(value?.$numberDecimal ?? value ?? 0);

export default function StockInwardPage() {
  const [receipts, setReceipts] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [duplexBatches, setDuplexBatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [mode, setMode] = useState('reel');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [supplierFilter, setSupplierFilter] = useState('');
  const [supplierId, setSupplierId] = useState('');
  const [invoiceReference, setInvoiceReference] = useState('');
  const [receiptDate, setReceiptDate] = useState(toLocalDateInput());
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState([blankReelLine()]);
  const [duplex, setDuplex] = useState(blankDuplex());

  const load = async (dateParams = {}) => {
    setLoading(true);
    try {
      const [recData, supData, batches] = await Promise.all([
        inwardService.getReceipts(dateParams),
        partiesService.getSuppliers(),
        pastingService.getFacingMaterial()
      ]);
      setReceipts(recData || []);
      setSuppliers(supData || []);
      setDuplexBatches((batches || []).filter(batch => batch.materialType === 'duplex'));
      setSupplierId(current => current || supData?.[0]?._id || '');
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Unable to load stock inward data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const totalDuplexKg = useMemo(
    () => duplexBatches.reduce((sum, batch) => sum + kg(batch.remainingWeightKg), 0),
    [duplexBatches]
  );
  const totalDuplexSheets = useMemo(
    () => duplexBatches.reduce((sum, batch) => sum + Number(batch.remainingSheets || 0), 0),
    [duplexBatches]
  );

  const updateLine = (index, field, value) => {
    setLines(current => current.map((line, i) => i === index ? { ...line, [field]: value } : line));
  };

  const closeModal = () => {
    setShowModal(false);
    setError('');
  };

  const submitReel = async event => {
    event.preventDefault();
    setSubmitting(true);
    setError('');
    setSuccess('');
    try {
      if (!supplierId) throw new Error('Select a supplier before saving the reel receipt.');
      if (!invoiceReference.trim()) throw new Error('Enter the supplier invoice reference.');
      for (const line of lines) {
        if (!line.reelWidthInches || !line.bf || !line.gsm || !line.reelCount || !line.totalWeightKg || !line.ratePerKg) {
          throw new Error('Complete all required fields in each reel specification.');
        }
      }
      await inwardService.createDraft({
        supplierId,
        invoiceReference,
        receiptDate,
        notes,
        lines: lines.map(line => ({
          ...line,
          reelWidthInches: Number(line.reelWidthInches),
          bf: Number(line.bf),
          gsm: Number(line.gsm),
          reelCount: Number(line.reelCount),
          totalWeightKg: Number(line.totalWeightKg),
          ratePerKg: Number(line.ratePerKg),
          freightCharges: Number(line.freightCharges || 0),
          otherCharges: Number(line.otherCharges || 0),
          reelWeightsKg: line.reelWeightsKg.trim() ? line.reelWeightsKg.split(',').map(value => Number(value.trim())) : []
        }))
      });
      setSuccess('Reel inward saved as a draft. Post the receipt to add the reels to live stock.');
      setInvoiceReference('');
      setNotes('');
      setLines([blankReelLine()]);
      closeModal();
      await load({ from, to, supplierId: supplierFilter });
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Unable to save reel inward.');
    } finally {
      setSubmitting(false);
    }
  };

  const submitDuplex = async event => {
    event.preventDefault();
    setSubmitting(true);
    setError('');
    setSuccess('');
    try {
      const payload = {
        materialType: 'duplex',
        lengthInches: Number(duplex.lengthInches),
        widthInches: Number(duplex.widthInches),
        sheetCount: Number(duplex.sheetCount),
        totalWeightKg: Number(duplex.totalWeightKg),
        ratePerKg: Number(duplex.ratePerKg),
        supplierName: duplex.supplierName.trim(),
        inwardDate: duplex.inwardDate,
        notes: duplex.notes.trim()
      };
      if (!payload.lengthInches || !payload.widthInches || !payload.sheetCount || !payload.totalWeightKg || duplex.ratePerKg === '') {
        throw new Error('Complete the Duplex size, quantity, weight and rate.');
      }
      const batch = await pastingService.receiveFacingMaterial(payload);
      setSuccess('Duplex received into stock as batch ' + batch.batchNumber + '.');
      setDuplex(blankDuplex());
      closeModal();
      await load({ from, to, supplierId: supplierFilter });
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Unable to receive Duplex stock.');
    } finally {
      setSubmitting(false);
    }
  };

  const postReceipt = async id => {
    if (!window.confirm('Post this reel receipt? This creates individual reel units and updates the stock ledger.')) return;
    setError('');
    try {
      await inwardService.postReceipt(id);
      setSuccess('Reel receipt posted. Individual reels are now available in Reel Stock.');
      await load({ from, to, supplierId: supplierFilter });
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to post reel receipt.');
    }
  };

  const field = 'w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100';
  const label = 'mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500';
  const button = 'rounded-xl px-4 py-2.5 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60';

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-blue-700">Inventory · Incoming materials</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">Stock Inward</h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-500">Receive paper reels and pre-cut Duplex into their respective live stock registers.</p>
        </div>
        <button type="button" onClick={() => { setError(''); setMode('reel'); setShowModal(true); }} className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-800">
          <Plus size={17} /> New inward
        </button>
      </div>

      {error && !showModal && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
      {success && <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{success}</div>}

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-3"><span className="rounded-xl bg-blue-50 p-2.5 text-blue-700"><Package size={20}/></span><div><p className="text-xs font-medium text-slate-500">Reel receipts</p><p className="text-2xl font-bold tabular-nums text-slate-900">{receipts.length}</p></div></div>
          <p className="mt-3 text-xs text-slate-500">Draft and posted supplier receipts</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-3"><span className="rounded-xl bg-violet-50 p-2.5 text-violet-700"><Layers size={20}/></span><div><p className="text-xs font-medium text-slate-500">Duplex sheets available</p><p className="text-2xl font-bold tabular-nums text-slate-900">{totalDuplexSheets.toLocaleString('en-IN')}</p></div></div>
          <p className="mt-3 text-xs text-slate-500">{duplexBatches.length} batches · {totalDuplexKg.toLocaleString('en-IN', { maximumFractionDigits: 2 })} kg remaining</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-3"><span className="rounded-xl bg-amber-50 p-2.5 text-amber-700"><FileText size={20}/></span><div><p className="text-xs font-medium text-slate-500">Pending reel drafts</p><p className="text-2xl font-bold tabular-nums text-slate-900">{receipts.filter(receipt => receipt.status === 'draft').length}</p></div></div>
          <p className="mt-3 text-xs text-slate-500">Drafts do not affect available reel stock until posted</p>
        </div>
      </div>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-slate-100 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div><h2 className="font-semibold text-slate-900">Duplex stock</h2><p className="mt-1 text-xs text-slate-500">Received here; issued to sheet pasting from this stock balance.</p></div>
          <button type="button" onClick={() => load({ from, to, supplierId: supplierFilter })} className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"><RefreshCw size={14}/> Refresh</button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-5 py-3">Batch</th><th className="px-5 py-3">Received</th><th className="px-5 py-3">Size (in)</th><th className="px-5 py-3 text-right">Sheets left</th><th className="px-5 py-3 text-right">Kg left</th><th className="px-5 py-3 text-right">Rate / kg</th><th className="px-5 py-3">Supplier</th><th className="px-5 py-3">Status</th></tr></thead>
            <tbody className="divide-y divide-slate-100">
              {duplexBatches.map(batch => <tr key={batch._id} className="hover:bg-slate-50"><td className="px-5 py-3 font-semibold text-slate-800">{batch.batchNumber}</td><td className="px-5 py-3">{new Date(batch.inwardDate).toLocaleDateString('en-IN')}</td><td className="px-5 py-3">{batch.lengthInches} × {batch.widthInches}</td><td className="px-5 py-3 text-right tabular-nums">{Number(batch.remainingSheets).toLocaleString('en-IN')}</td><td className="px-5 py-3 text-right tabular-nums">{kg(batch.remainingWeightKg).toFixed(2)}</td><td className="px-5 py-3 text-right tabular-nums">₹{kg(batch.ratePerKg).toFixed(2)}</td><td className="px-5 py-3">{batch.supplierName || '—'}</td><td className="px-5 py-3"><span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">{batch.status}</span></td></tr>)}
              {!duplexBatches.length && <tr><td colSpan={8} className="px-5 py-10 text-center text-sm text-slate-500">No Duplex stock received yet. Use New inward → Duplex to add a batch.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 p-5"><h2 className="font-semibold text-slate-900">Reel receipt history</h2><p className="mt-1 text-xs text-slate-500">Reel receipts remain draft until posted to create individual reel records.</p></div>
        <div className="flex flex-wrap items-end gap-3 border-b border-slate-100 p-4">
          <div className="min-w-52"><label className={label}>Supplier filter</label><select value={supplierFilter} onChange={event => setSupplierFilter(event.target.value)} className={field}><option value="">All suppliers</option>{suppliers.map(supplier => <option key={supplier._id} value={supplier._id}>{supplier.name}</option>)}</select></div>
          <div className="min-w-[280px] flex-1"><DateRangeFilter from={from} to={to} onFromChange={setFrom} onToChange={setTo} onApply={() => load({ from, to, supplierId: supplierFilter })} onReset={() => { setFrom(''); setTo(''); setSupplierFilter(''); load({}); }} loading={loading} label="Receipt date range"/></div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[850px] text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-5 py-3">Receipt #</th><th className="px-5 py-3">Date</th><th className="px-5 py-3">Supplier</th><th className="px-5 py-3">Invoice ref</th><th className="px-5 py-3 text-right">Lines</th><th className="px-5 py-3">Status</th><th className="px-5 py-3 text-right">Action</th></tr></thead>
            <tbody className="divide-y divide-slate-100">
              {receipts.map(receipt => <tr key={receipt._id} className="hover:bg-slate-50"><td className="px-5 py-4 font-semibold text-slate-900">{receipt.receiptNumber}</td><td className="px-5 py-4">{new Date(receipt.receiptDate).toLocaleDateString('en-IN')}</td><td className="px-5 py-4">{receipt.supplierId?.name || '—'}</td><td className="px-5 py-4">{receipt.invoiceReference}</td><td className="px-5 py-4 text-right tabular-nums">{receipt.lines?.length || 0}</td><td className="px-5 py-4"><span className={receipt.status === 'posted' ? 'rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700' : 'rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700'}>{receipt.status}</span></td><td className="px-5 py-4 text-right">{receipt.status === 'draft' ? <button type="button" onClick={() => postReceipt(receipt._id)} className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700">Post receipt</button> : <span className="text-xs text-slate-400">Posted</span>}</td></tr>)}
              {!receipts.length && !loading && <tr><td colSpan={7} className="px-5 py-10 text-center text-slate-500">No reel receipts match these filters.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      {showModal && <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/50 p-3 sm:p-6">
        <div className="my-auto max-h-[94vh] w-full max-w-5xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
          <div className="sticky top-0 z-10 flex items-start justify-between border-b border-slate-100 bg-white p-5"><div><h2 className="text-lg font-bold text-slate-900">New stock inward</h2><p className="mt-1 text-sm text-slate-500">Choose the material category, then enter its purchase details.</p></div><button type="button" onClick={closeModal} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100" aria-label="Close"><X size={19}/></button></div>
          <div className="space-y-5 p-5">
            <div><p className={label}>Material type</p><div className="flex items-center gap-3">
              <span className={mode === 'reel' ? 'text-sm font-bold text-blue-700' : 'text-sm font-medium text-slate-400'}>Reel</span>
              <button type="button" role="switch" aria-label="Switch between Reel and Duplex inward" aria-checked={mode === 'duplex'} onClick={() => { setMode(mode === 'reel' ? 'duplex' : 'reel'); setError(''); }} className={'relative inline-flex h-8 w-14 shrink-0 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ' + (mode === 'duplex' ? 'bg-violet-700' : 'bg-blue-700')}>
                <span className={'inline-block h-6 w-6 transform rounded-full bg-white shadow-md transition-transform ' + (mode === 'duplex' ? 'translate-x-7' : 'translate-x-1')}/>
              </button>
              <span className={mode === 'duplex' ? 'text-sm font-bold text-violet-700' : 'text-sm font-medium text-slate-400'}>Duplex</span>
            </div></div>
            {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
            {mode === 'reel' ? <form onSubmit={submitReel} className="space-y-5">
              <div className="grid gap-3 sm:grid-cols-3">
                <div><label className={label}>Supplier *</label><select required value={supplierId} onChange={event => setSupplierId(event.target.value)} className={field}><option value="">Select supplier</option>{suppliers.map(supplier => <option key={supplier._id} value={supplier._id}>{supplier.name}</option>)}</select></div>
                <div><label className={label}>Invoice reference *</label><input required value={invoiceReference} onChange={event => setInvoiceReference(event.target.value)} placeholder="Supplier invoice number" className={field}/></div>
                <div><label className={label}>Receipt date *</label><input required type="date" value={receiptDate} onChange={event => setReceiptDate(event.target.value)} className={field}/></div>
              </div>
              <div className="space-y-3 border-t border-slate-100 pt-4">
                <div className="flex items-center justify-between"><div><h3 className="font-semibold text-slate-900">Reel specifications</h3><p className="mt-1 text-xs text-slate-500">Each row represents reels with the same width, BF, GSM, quality and rate.</p></div><button type="button" onClick={() => setLines(current => [...current, blankReelLine()])} className="rounded-lg border border-blue-200 px-3 py-2 text-xs font-semibold text-blue-700 hover:bg-blue-50">+ Add specification</button></div>
                {lines.map((line, index) => <div key={index} className="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
                  <div className="mb-3 flex items-center justify-between"><span className="text-xs font-bold uppercase tracking-wide text-slate-500">Specification {index + 1}</span>{lines.length > 1 && <button type="button" onClick={() => setLines(current => current.filter((_, i) => i !== index))} className="text-xs font-semibold text-red-600">Remove</button>}</div>
                  <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
                    <div><label className={label}>Width (in) *</label><input required type="number" min="0.01" step="any" value={line.reelWidthInches} onChange={event => updateLine(index, 'reelWidthInches', event.target.value)} placeholder="36" className={field}/></div>
                    <div><label className={label}>BF *</label><input required type="number" min="0.01" step="any" value={line.bf} onChange={event => updateLine(index, 'bf', event.target.value)} placeholder="18" className={field}/></div>
                    <div><label className={label}>GSM *</label><input required type="number" min="0.01" step="any" value={line.gsm} onChange={event => updateLine(index, 'gsm', event.target.value)} placeholder="140" className={field}/></div>
                    <div><label className={label}>Quality *</label><select value={line.quality} onChange={event => updateLine(index, 'quality', event.target.value)} className={field}><option value="Natural">Natural</option><option value="GY">Golden Yellow</option></select></div>
                    <div><label className={label}>Reel qty *</label><input required type="number" min="1" step="1" value={line.reelCount} onChange={event => updateLine(index, 'reelCount', event.target.value)} placeholder="5" className={field}/></div>
                    <div><label className={label}>Total kg *</label><input required type="number" min="0.001" step="any" value={line.totalWeightKg} onChange={event => updateLine(index, 'totalWeightKg', event.target.value)} placeholder="450" className={field}/></div>
                    <div className="sm:col-span-2"><label className={label}>Rate / kg (₹) *</label><input required type="number" min="0" step="any" value={line.ratePerKg} onChange={event => updateLine(index, 'ratePerKg', event.target.value)} placeholder="42.50" className={field}/></div>
                    <div><label className={label}>Freight (₹)</label><input type="number" min="0" step="any" value={line.freightCharges} onChange={event => updateLine(index, 'freightCharges', event.target.value)} className={field}/></div>
                    <div><label className={label}>Other (₹)</label><input type="number" min="0" step="any" value={line.otherCharges} onChange={event => updateLine(index, 'otherCharges', event.target.value)} className={field}/></div>
                    <div className="sm:col-span-2"><label className={label}>Reel batch ref</label><input value={line.supplierBatchRef} onChange={event => updateLine(index, 'supplierBatchRef', event.target.value)} placeholder="Optional" className={field}/></div>
                    <div className="sm:col-span-6"><label className={label}>Individual reel weights (optional)</label><input value={line.reelWeightsKg} onChange={event => updateLine(index, 'reelWeightsKg', event.target.value)} placeholder="150.5, 148.2, 151.3" className={field}/><p className="mt-1 text-xs text-slate-500">Enter one weight per reel. Leave blank to divide the total equally and mark the weights as estimated.</p></div>
                  </div>
                </div>)}
              </div>
              <div><label className={label}>Receipt notes</label><textarea rows="2" value={notes} onChange={event => setNotes(event.target.value)} className={field} placeholder="Optional notes for this receipt"/></div>
              <div className="flex flex-wrap justify-end gap-2 border-t border-slate-100 pt-4"><button type="button" onClick={closeModal} className={button + ' border border-slate-200 text-slate-700 hover:bg-slate-50'}>Cancel</button><button disabled={submitting} className={button + ' inline-flex items-center gap-2 bg-blue-700 text-white hover:bg-blue-800'}>{submitting && <Loader2 size={16} className="animate-spin"/>}Save reel draft</button></div>
            </form> : <form onSubmit={submitDuplex} className="space-y-5">
              <div className="rounded-xl border border-violet-100 bg-violet-50/60 p-4"><h3 className="font-semibold text-violet-950">Duplex paper inward</h3><p className="mt-1 text-xs text-violet-800">Enter pre-cut sheet dimensions and quantities. This batch will be available in Sheet Pasting for issue against production.</p></div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <div><label className={label}>Inward date *</label><input required type="date" value={duplex.inwardDate} onChange={event => setDuplex({ ...duplex, inwardDate: event.target.value })} className={field}/></div>
                <div><label className={label}>Supplier name</label><input value={duplex.supplierName} onChange={event => setDuplex({ ...duplex, supplierName: event.target.value })} placeholder="Supplier / mill" className={field}/></div>
                <div><label className={label}>Length (inches) *</label><input required type="number" min="0.1" step="any" value={duplex.lengthInches} onChange={event => setDuplex({ ...duplex, lengthInches: event.target.value })} placeholder="e.g. 40" className={field}/></div>
                <div><label className={label}>Width (inches) *</label><input required type="number" min="0.1" step="any" value={duplex.widthInches} onChange={event => setDuplex({ ...duplex, widthInches: event.target.value })} placeholder="e.g. 30" className={field}/></div>
                <div><label className={label}>Number of sheets *</label><input required type="number" min="1" step="1" value={duplex.sheetCount} onChange={event => setDuplex({ ...duplex, sheetCount: event.target.value })} placeholder="1000" className={field}/></div>
                <div><label className={label}>Total weight (kg) *</label><input required type="number" min="0.001" step="any" value={duplex.totalWeightKg} onChange={event => setDuplex({ ...duplex, totalWeightKg: event.target.value })} placeholder="260" className={field}/></div>
                <div><label className={label}>Purchase rate (₹ / kg) *</label><input required type="number" min="0" step="any" value={duplex.ratePerKg} onChange={event => setDuplex({ ...duplex, ratePerKg: event.target.value })} placeholder="45.00" className={field}/></div>
                <div><label className={label}>Total purchase value</label><div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-bold tabular-nums text-slate-900">₹{(Number(duplex.totalWeightKg || 0) * Number(duplex.ratePerKg || 0)).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div></div>
              </div>
              <div><label className={label}>Notes</label><textarea rows="2" value={duplex.notes} onChange={event => setDuplex({ ...duplex, notes: event.target.value })} className={field} placeholder="Optional purchase / batch details"/></div>
              <div className="flex flex-wrap justify-end gap-2 border-t border-slate-100 pt-4"><button type="button" onClick={closeModal} className={button + ' border border-slate-200 text-slate-700 hover:bg-slate-50'}>Cancel</button><button disabled={submitting} className={button + ' inline-flex items-center gap-2 bg-violet-700 text-white hover:bg-violet-800'}>{submitting && <Loader2 size={16} className="animate-spin"/>}Receive Duplex stock</button></div>
            </form>}
          </div>
        </div>
      </div>}
    </div>
  );
}
