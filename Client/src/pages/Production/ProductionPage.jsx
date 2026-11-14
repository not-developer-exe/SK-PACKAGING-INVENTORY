import React, { useState, useEffect } from 'react';
import { inventoryService } from '../../services/inventoryService';
import { productionService } from '../../services/productionService';
import DateRangeFilter from '../../components/DateRangeFilter';
import { Factory, Plus, Trash2, Loader2, Save } from 'lucide-react';

export default function ProductionPage() {
  const [availableReels, setAvailableReels] = useState([]);
  const [productionRuns, setProductionRuns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  // Form State
  const [shift, setShift] = useState('Day');
  const [operatorName, setOperatorName] = useState('');
  const [recoverableWasteKg, setRecoverableWasteKg] = useState('');
  
  const [inputReels, setInputReels] = useState([
    { reelId: '', requestedWidthInches: '', weightConsumedKg: '' }
  ]);
  
  const [outputSheets, setOutputSheets] = useState([
    { ply: 3, lengthInches: '', widthInches: '', sheetCount: '', totalWeightKg: '' }
  ]);

  useEffect(() => {
    fetchReels();
  }, []);

  const fetchReels = async (dateParams = {}) => {
    try {
      setLoading(true);
      const [reels, runs] = await Promise.all([inventoryService.getPhysicalReels(), productionService.getRuns(dateParams)]);
      setAvailableReels(reels);
      setProductionRuns(runs);
    } catch (err) {
      console.error('Error fetching reels:', err);
    } finally {
      setLoading(false);
    }
  };

  // Calculations
  const totalInputWeight = inputReels.reduce((sum, r) => sum + Number(r.weightConsumedKg || 0), 0);
  const totalOutputWeight = outputSheets.reduce((sum, s) => sum + Number(s.totalWeightKg || 0), 0);
  const massDifference = totalInputWeight - totalOutputWeight;
  const measuredScrap = Number(recoverableWasteKg || 0);
  const calculatedProcessLoss = massDifference - measuredScrap;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (massDifference < 0) {
      setError('Output weight cannot be greater than input weight. Check your measurements.');
      return;
    }
    if (recoverableWasteKg === '') {
      setError('Enter the measured recoverable scrap weight, or enter 0 if no recoverable scrap was produced.');
      return;
    }
    if (!Number.isFinite(measuredScrap) || measuredScrap < 0 || measuredScrap > massDifference) {
      setError('Measured recoverable scrap must be non-negative and cannot exceed the input-output weight difference.');
      return;
    }

    try {
      setSubmitting(true);
      const res = await productionService.recordRun({
        shift,
        operatorName,
        recoverableWasteKg: measuredScrap,
        inputReels: inputReels.map(r => ({ ...r, requestedWidthInches: r.requestedWidthInches === '' ? undefined : Number(r.requestedWidthInches), weightConsumedKg: Number(r.weightConsumedKg) })),
        outputSheets: outputSheets.map(s => ({
          ...s,
          ply: Number(s.ply),
          lengthInches: Number(s.lengthInches),
          widthInches: Number(s.widthInches),
          sheetCount: Number(s.sheetCount),
          totalWeightKg: Number(s.totalWeightKg)
        }))
      });

      setSuccess(`Success! ${res.runNumber} recorded. Verified scrap: ${Number(res.recoverableWasteKg || 0).toFixed(2)}kg; process loss: ${Number(res.processLossKg || 0).toFixed(2)}kg.`);
      
      // Reset form
      setOperatorName('');
      setRecoverableWasteKg('');
      setInputReels([{ reelId: '', requestedWidthInches: '', weightConsumedKg: '' }]);
      setOutputSheets([{ ply: 3, lengthInches: '', widthInches: '', sheetCount: '', totalWeightKg: '' }]);
      fetchReels(); // Refresh physical reels drop-down

    } catch (err) {
      setError(err.response?.data?.message || 'Error recording production');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div className="flex h-64 items-center justify-center"><Loader2 className="animate-spin text-blue-600" size={32} /></div>;

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Corrugation & Sheet Cutting</h1>
        <p className="mt-1 text-sm text-slate-500">Record machine runs, consume paper reels, and generate WIP corrugated sheets.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Header Info */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 rounded-2xl border border-slate-200 bg-white p-5">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Shift</label>
            <select value={shift} onChange={e => setShift(e.target.value)} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-400">
              <option value="Day">Day Shift</option>
              <option value="Night">Night Shift</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Operator Name *</label>
            <input type="text" required value={operatorName} onChange={e => setOperatorName(e.target.value)} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-400" placeholder="e.g. Ramesh Kumar" />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Input Materials (Reels) */}
          <div className="rounded-2xl border border-amber-200 bg-amber-50/30 p-5">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-amber-900">Input Materials</h2>
              <button type="button" onClick={() => setInputReels([...inputReels, { reelId: '', requestedWidthInches: '', weightConsumedKg: '' }])} className="flex items-center gap-1 text-sm font-medium text-amber-700 hover:text-amber-900">
                <Plus size={16} /> Add Reel
              </button>
            </div>
            
            <div className="space-y-3">
              {inputReels.map((input, idx) => (
                <div key={idx} className="flex gap-2 items-start">
                  <div className="flex-1">
                    <select required value={input.reelId} onChange={e => {
                        const newReels = [...inputReels];
                        newReels[idx].reelId = e.target.value;
                        const selectedReel = availableReels.find(reel => reel._id === e.target.value);
                        if (selectedReel && !newReels[idx].requestedWidthInches) newReels[idx].requestedWidthInches = String(selectedReel.reelWidthInches);
                        setInputReels(newReels);
                      }}
                      className="w-full rounded-lg border border-amber-200 px-3 py-2 text-sm outline-none focus:border-amber-400 bg-white"
                    >
                      <option value="">Select a physical reel...</option>
                      {availableReels.map(reel => (
                        <option key={reel._id} value={reel._id}>
                          {reel.reelCode} - {reel.reelWidthInches}" | {reel.gsm} GSM ({reel.remainingWeightKg?.$numberDecimal || reel.remainingWeightKg}kg left)
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="w-24">
                    <label className="mb-1 block text-xs text-amber-800">Required width</label>
                    <input type="number" min="0.1" step="0.1" required placeholder="Inches" value={input.requestedWidthInches} onChange={e => {
                        const newReels = [...inputReels];
                        newReels[idx].requestedWidthInches = e.target.value;
                        setInputReels(newReels);
                      }} className="w-full rounded-lg border border-amber-200 px-2 py-2 text-sm outline-none focus:border-amber-400 bg-white" />
                  </div>
                  <div className="w-28">
                    <label className="mb-1 block text-xs text-amber-800">Consumed kg</label>
                    <input type="number" min="0.001" step="any" required placeholder="Kg Used" value={input.weightConsumedKg} onChange={e => {
                        const newReels = [...inputReels];
                        newReels[idx].weightConsumedKg = e.target.value;
                        setInputReels(newReels);
                      }}
                      className="w-full rounded-lg border border-amber-200 px-3 py-2 text-sm outline-none focus:border-amber-400 bg-white"
                    />
                  </div>
                  {inputReels.length > 1 && (
                    <button type="button" onClick={() => setInputReels(inputReels.filter((_, i) => i !== idx))} className="mt-2 text-red-500 hover:text-red-700">
                      <Trash2 size={18} />
                    </button>
                  )}
                </div>
              ))}
              <div className="rounded-lg bg-amber-100/70 p-3 text-xs text-amber-900">
                Enter the width you intended to use. The selected reel's actual width is captured separately; any difference is recorded as a width substitution.
              </div>
              <div className="pt-2 text-right text-sm font-semibold text-amber-800">
                Total Input: {totalInputWeight.toFixed(2)} kg
              </div>
            </div>
          </div>

          {/* Output Sheets */}
          <div className="rounded-2xl border border-blue-200 bg-blue-50/30 p-5">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-blue-900">Output Sheets</h2>
              <button type="button" onClick={() => setOutputSheets([...outputSheets, { ply: 3, lengthInches: '', widthInches: '', sheetCount: '', totalWeightKg: '' }])} className="flex items-center gap-1 text-sm font-medium text-blue-700 hover:text-blue-900">
                <Plus size={16} /> Add Size
              </button>
            </div>

            <div className="space-y-4">
              {outputSheets.map((out, idx) => (
                <div key={idx} className="grid grid-cols-5 gap-2 relative border-b border-blue-100 pb-3 last:border-0">
                  <div className="col-span-2 sm:col-span-1">
                    <label className="text-xs text-slate-500">Ply</label>
                    <select value={out.ply} onChange={e => { const newOut = [...outputSheets]; newOut[idx].ply = e.target.value; setOutputSheets(newOut); }} className="w-full rounded-lg border border-blue-200 px-2 py-1.5 text-sm bg-white outline-none focus:border-blue-400">
                      <option value="3">3 Ply</option>
                      <option value="5">5 Ply</option>
                      <option value="7">7 Ply</option>
                    </select>
                  </div>
                  <div className="col-span-3 sm:col-span-1">
                    <label className="text-xs text-slate-500">L x W (in)</label>
                    <div className="flex items-center gap-1">
                      <input type="number" required placeholder="L" value={out.lengthInches} onChange={e => { const newOut = [...outputSheets]; newOut[idx].lengthInches = e.target.value; setOutputSheets(newOut); }} className="w-full rounded-lg border border-blue-200 px-2 py-1.5 text-sm bg-white" />
                      <span className="text-slate-400 text-xs">x</span>
                      <input type="number" required placeholder="W" value={out.widthInches} onChange={e => { const newOut = [...outputSheets]; newOut[idx].widthInches = e.target.value; setOutputSheets(newOut); }} className="w-full rounded-lg border border-blue-200 px-2 py-1.5 text-sm bg-white" />
                    </div>
                  </div>
                  <div className="col-span-2 sm:col-span-1">
                    <label className="text-xs text-slate-500">Qty</label>
                    <input type="number" required placeholder="Sheets" value={out.sheetCount} onChange={e => { const newOut = [...outputSheets]; newOut[idx].sheetCount = e.target.value; setOutputSheets(newOut); }} className="w-full rounded-lg border border-blue-200 px-2 py-1.5 text-sm bg-white" />
                  </div>
                  <div className="col-span-2 sm:col-span-2 flex items-end gap-2">
                    <div className="flex-1">
                      <label className="text-xs text-slate-500">Total Wt (kg)</label>
                      <input type="number" step="any" required placeholder="Weight" value={out.totalWeightKg} onChange={e => { const newOut = [...outputSheets]; newOut[idx].totalWeightKg = e.target.value; setOutputSheets(newOut); }} className="w-full rounded-lg border border-blue-200 px-2 py-1.5 text-sm bg-white" />
                    </div>
                    {outputSheets.length > 1 && (
                      <button type="button" onClick={() => setOutputSheets(outputSheets.filter((_, i) => i !== idx))} className="mb-1 text-red-500 hover:text-red-700">
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                </div>
              ))}
              <div className="pt-2 text-right text-sm font-semibold text-blue-800">
                Total Output: {totalOutputWeight.toFixed(2)} kg
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-amber-200 bg-amber-50/50 p-5">
          <label className="mb-2 block text-sm font-semibold text-amber-900">Measured Recoverable Scrap (kg)</label>
          <input
            type="number"
            required
            min="0"
            max={Math.max(0, massDifference)}
            step="0.001"
            value={recoverableWasteKg}
            onChange={e => setRecoverableWasteKg(e.target.value)}
            placeholder="Enter only scrap physically weighed and recoverable"
            className="w-full max-w-sm rounded-xl border border-amber-200 bg-white px-3 py-2 text-sm outline-none focus:border-amber-400"
          />
          <p className="mt-2 text-xs text-amber-800">
            Do not enter the full input-output difference here. Moisture loss, dust, and other unaccounted process loss are tracked separately and are not available for scrap sale.
          </p>
          <p className="mt-1 text-sm font-medium text-slate-700">
            Remaining process loss / variance: {Number.isFinite(calculatedProcessLoss) ? calculatedProcessLoss.toFixed(2) : '—'} kg
          </p>
        </div>

        {/* Footer Summary & Submit */}
        <div className="flex flex-col sm:flex-row items-center justify-between rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex gap-6 mb-4 sm:mb-0">
            <div className="text-center">
              <p className="text-xs text-slate-500 uppercase tracking-wider font-semibold">Net Input</p>
              <p className="text-lg font-bold text-amber-600">{totalInputWeight.toFixed(2)} kg</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-slate-500 uppercase tracking-wider font-semibold">Net Output</p>
              <p className="text-lg font-bold text-blue-600">{totalOutputWeight.toFixed(2)} kg</p>
            </div>
            <div className="text-center border-l border-slate-200 pl-6">
              <p className="text-xs text-slate-500 uppercase tracking-wider font-semibold">Verified Scrap</p>
              <p className="text-lg font-bold text-amber-700">{measuredScrap.toFixed(2)} kg</p>
            </div>
            <div className="text-center border-l border-slate-200 pl-6">
              <p className="text-xs text-slate-500 uppercase tracking-wider font-semibold">Process Loss</p>
              <p className="text-lg font-bold text-slate-800">{calculatedProcessLoss.toFixed(2)} kg</p>
            </div>
          </div>

          <button type="submit" disabled={submitting} className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-blue-700 px-6 py-3 text-sm font-semibold text-white transition hover:bg-blue-800 disabled:opacity-70">
            {submitting ? <Loader2 className="animate-spin" size={18} /> : <><Factory size={18} /> Record Run & Issue Stock</>}
          </button>
        </div>
        
        {error && <div className="rounded-xl bg-red-50 p-4 text-sm font-medium text-red-700 border border-red-100">{error}</div>}
        {success && <div className="rounded-xl bg-emerald-50 p-4 text-sm font-medium text-emerald-700 border border-emerald-100">{success}</div>}
      </form>
      <DateRangeFilter from={from} to={to} onFromChange={setFrom} onToChange={setTo} onApply={() => fetchReels({ from, to })} onReset={() => { setFrom(''); setTo(''); fetchReels({}); }} loading={loading} label="Production date range" />
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Recent Production Runs</h2>
            <p className="text-sm text-slate-500">Latest 100 runs with reel-to-sheet traceability and width substitutions</p>
          </div>
          <button type="button" onClick={() => fetchReels({ from, to })} className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">Refresh</button>
        </div>
        {productionRuns.length === 0 ? (
          <p className="rounded-lg bg-slate-50 p-4 text-sm text-slate-500">No production runs recorded yet.</p>
        ) : (
          <div className="space-y-3">
            {productionRuns.map(run => (
              <details key={run._id} className="rounded-xl border border-slate-200 p-4">
                <summary className="flex cursor-pointer flex-wrap items-center justify-between gap-3 text-sm">
                  <span className="font-semibold text-slate-900">{run.runNumber} · {new Date(run.runDate).toLocaleDateString()}</span>
                  <span className="text-slate-600">{Number(run.totalInputWeightKg?.$numberDecimal || run.totalInputWeightKg || 0).toFixed(2)} kg input → {Number(run.totalOutputWeightKg?.$numberDecimal || run.totalOutputWeightKg || 0).toFixed(2)} kg sheets · ₹{Number(run.totalMaterialCost?.$numberDecimal || run.totalMaterialCost || 0).toFixed(2)} material cost</span>
                  <span className={run.widthSubstitutions?.length ? "rounded-full bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-800" : "rounded-full bg-emerald-100 px-2 py-1 text-xs font-semibold text-emerald-800"}>{run.widthSubstitutions?.length || 0} width substitutions</span>
                </summary>
                <div className="mt-4 grid gap-4 lg:grid-cols-2">
                  <div>
                    <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">Reels consumed</h3>
                    <div className="space-y-2">
                      {(run.inputReels || []).map((input, index) => (
                        <div key={input._id || input.reelId || index} className="rounded-lg bg-slate-50 p-3 text-sm">
                          <div className="font-medium text-slate-800">{input.reelCode || 'Reel'} · {Number(input.weightConsumedKg?.$numberDecimal || input.weightConsumedKg || 0).toFixed(2)} kg</div>
                          <div className="text-xs text-slate-500">Required {input.requestedWidthInches || '—'}" · Actual {input.actualWidthInches || '—'}" · Difference {Number(input.widthVarianceInches || 0) > 0 ? '+' : ''}{Number(input.widthVarianceInches || 0).toFixed(2)}"</div>
                          <div className="text-xs text-slate-500">Landed rate ₹{Number(input.landedRatePerKg?.$numberDecimal || input.landedRatePerKg || 0).toFixed(2)}/kg · Material ₹{Number(input.materialCost?.$numberDecimal || input.materialCost || 0).toFixed(2)}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div>
                    <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">Sheets produced</h3>
                    <div className="space-y-2">
                      {(run.outputSheets || []).map((sheet, index) => (
                        <div key={sheet._id || index} className="rounded-lg bg-slate-50 p-3 text-sm text-slate-700">
                          {sheet.ply} Ply · {sheet.lengthInches}" × {sheet.widthInches}" · {sheet.sheetCount} sheets · {Number(sheet.totalWeightKg?.$numberDecimal || sheet.totalWeightKg || 0).toFixed(2)} kg · ₹{Number(sheet.unitCostPerKg?.$numberDecimal || sheet.unitCostPerKg || 0).toFixed(2)}/kg
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </details>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}