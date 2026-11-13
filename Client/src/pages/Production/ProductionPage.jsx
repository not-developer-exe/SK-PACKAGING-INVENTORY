import React, { useState, useEffect } from 'react';
import { inventoryService } from '../../services/inventoryService';
import { productionService } from '../../services/productionService';
import { Factory, Plus, Trash2, Loader2, Save } from 'lucide-react';

export default function ProductionPage() {
  const [availableReels, setAvailableReels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Form State
  const [shift, setShift] = useState('Day');
  const [operatorName, setOperatorName] = useState('');
  
  const [inputReels, setInputReels] = useState([
    { reelId: '', weightConsumedKg: '' }
  ]);
  
  const [outputSheets, setOutputSheets] = useState([
    { ply: 3, lengthInches: '', widthInches: '', sheetCount: '', totalWeightKg: '' }
  ]);

  useEffect(() => {
    fetchReels();
  }, []);

  const fetchReels = async () => {
    try {
      setLoading(true);
      const data = await inventoryService.getPhysicalReels();
      setAvailableReels(data);
    } catch (err) {
      console.error('Error fetching reels:', err);
    } finally {
      setLoading(false);
    }
  };

  // Calculations
  const totalInputWeight = inputReels.reduce((sum, r) => sum + Number(r.weightConsumedKg || 0), 0);
  const totalOutputWeight = outputSheets.reduce((sum, s) => sum + Number(s.totalWeightKg || 0), 0);
  const calculatedWaste = totalInputWeight - totalOutputWeight;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (calculatedWaste < 0) {
      setError('Output weight cannot be greater than input weight. Check your measurements.');
      return;
    }

    try {
      setSubmitting(true);
      const res = await productionService.recordRun({
        shift,
        operatorName,
        inputReels: inputReels.map(r => ({ ...r, weightConsumedKg: Number(r.weightConsumedKg) })),
        outputSheets: outputSheets.map(s => ({
          ...s,
          ply: Number(s.ply),
          lengthInches: Number(s.lengthInches),
          widthInches: Number(s.widthInches),
          sheetCount: Number(s.sheetCount),
          totalWeightKg: Number(s.totalWeightKg)
        }))
      });

      setSuccess(`Success! ${res.runNumber} recorded. Waste generated: ${res.wasteGeneratedKg}kg`);
      
      // Reset form
      setOperatorName('');
      setInputReels([{ reelId: '', weightConsumedKg: '' }]);
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
              <button type="button" onClick={() => setInputReels([...inputReels, { reelId: '', weightConsumedKg: '' }])} className="flex items-center gap-1 text-sm font-medium text-amber-700 hover:text-amber-900">
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
                  <div className="w-32">
                    <input type="number" step="any" required placeholder="Kg Used" value={input.weightConsumedKg} onChange={e => {
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
              <p className="text-xs text-slate-500 uppercase tracking-wider font-semibold">Machine Waste</p>
              <p className={`text-lg font-bold ${calculatedWaste < 0 ? 'text-red-600' : 'text-slate-800'}`}>
                {calculatedWaste.toFixed(2)} kg
              </p>
            </div>
          </div>

          <button type="submit" disabled={submitting} className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-blue-700 px-6 py-3 text-sm font-semibold text-white transition hover:bg-blue-800 disabled:opacity-70">
            {submitting ? <Loader2 className="animate-spin" size={18} /> : <><Factory size={18} /> Record Run & Issue Stock</>}
          </button>
        </div>
        
        {error && <div className="rounded-xl bg-red-50 p-4 text-sm font-medium text-red-700 border border-red-100">{error}</div>}
        {success && <div className="rounded-xl bg-emerald-50 p-4 text-sm font-medium text-emerald-700 border border-emerald-100">{success}</div>}
      </form>
    </div>
  );
}