import React, { useState, useEffect } from 'react';
import { dispatchService } from '../../services/dispatchService';
import DateRangeFilter from '../../components/DateRangeFilter';
import { toLocalDateInput } from '../../lib/date';
import { partiesService } from '../../services/partiesService';
import { Truck, Plus, Trash2, Loader2, FileText, Printer, Download, X } from 'lucide-react';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

export default function DispatchPage() {
  const [activeTab, setActiveTab] = useState('new');
  const [customers, setCustomers] = useState([]);
  const [availableBoxes, setAvailableBoxes] = useState([]);
  const [dispatches, setDispatches] = useState([]); 
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  
  const [selectedChallan, setSelectedChallan] = useState(null);

  // Added dispatchDate and uppercase handlers
  const [dispatchDate, setDispatchDate] = useState(toLocalDateInput());
  const [customerId, setCustomerId] = useState('');
  const [vehicleNumber, setVehicleNumber] = useState('');
  const [driverName, setDriverName] = useState('');
  const [dispatchBoxes, setDispatchBoxes] = useState([{ boxId: '', dispatchQuantity: '' }]);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [customerFilter, setCustomerFilter] = useState('');

  const fetchData = async (dateParams = {}) => {
    try {
      setLoading(true);
      const [customersData, boxesData, historyData] = await Promise.all([
        partiesService.getCustomers(),
        dispatchService.getAvailableBoxes(),
        dispatchService.getDispatches(dateParams) 
      ]);
      setCustomers(customersData);
      setAvailableBoxes(boxesData);
      setDispatches(historyData);
    } catch (err) {
      console.error('Error fetching data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const customerBoxes = availableBoxes.filter(box => box.customerId?._id === customerId);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      const res = await dispatchService.recordDispatch({
        dispatchDate, // Sent to backend
        customerId,
        vehicleNumber: vehicleNumber.trim(),
        driverName: driverName.trim(),
        boxes: dispatchBoxes.map(b => ({
          boxId: b.boxId,
          dispatchQuantity: Number(b.dispatchQuantity)
        }))
      });

      // Clear form
      setCustomerId('');
      setVehicleNumber('');
      setDriverName('');
      setDispatchDate(toLocalDateInput());
      setDispatchBoxes([{ boxId: '', dispatchQuantity: '' }]);
      
      const [historyData, boxesData] = await Promise.all([
        dispatchService.getDispatches({ from, to, customerId: customerFilter }),
        dispatchService.getAvailableBoxes()
      ]);
      setDispatches(historyData);
      setAvailableBoxes(boxesData);

      const newChallan = historyData.find(d => d.challanNumber === res.challanNumber);
      if (newChallan) setSelectedChallan(newChallan);
      
      setActiveTab('history');
    } catch (err) {
      alert(err.response?.data?.message || 'Error recording dispatch');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDownloadPDF = async () => {
    const element = document.getElementById('challan-document');
    if (!element) return;
    
    setIsDownloading(true);
    try {
      const canvas = await html2canvas(element, { scale: 2, useCORS: true });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(`${selectedChallan.challanNumber}_SK_Packaging.pdf`);
    } catch (error) {
      alert('Failed to generate PDF.');
    } finally {
      setIsDownloading(false);
    }
  };

  if (loading) return <div className="flex h-64 items-center justify-center"><Loader2 className="animate-spin text-blue-600" size={32} /></div>;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Box Dispatch (Outward)</h1>
        <p className="mt-1 text-sm text-slate-500">Generate delivery challans and view dispatch history.</p>
      </div>

      <div className="flex gap-2 border-b border-slate-200 pb-2">
        <button onClick={() => setActiveTab('new')} className={`px-4 py-2 text-sm font-medium transition ${activeTab === 'new' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-slate-500 hover:text-slate-800'}`}>New Dispatch</button>
        <button onClick={() => setActiveTab('history')} className={`px-4 py-2 text-sm font-medium transition ${activeTab === 'history' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-slate-500 hover:text-slate-800'}`}>Challan History</button>
      </div>

      {activeTab === 'new' ? (
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-lg font-semibold text-slate-900 flex items-center gap-2">
              <Truck size={20} className="text-blue-600" /> Logistics Details
            </h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
              {/* NEW: Date Field */}
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Date *</label>
                <input type="date" required value={dispatchDate} onChange={e => setDispatchDate(e.target.value)} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-400" />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Customer *</label>
                <select required value={customerId} onChange={e => { setCustomerId(e.target.value); setDispatchBoxes([{ boxId: '', dispatchQuantity: '' }]); }} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-400">
                  <option value="">Select...</option>
                  {customers.map(c => (
                    <option key={c._id} value={c._id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Vehicle No.</label>
                {/* FORCE UPPERCASE */}
                <input type="text" placeholder="e.g. MP07AB1234" value={vehicleNumber} onChange={e => setVehicleNumber(e.target.value.toUpperCase())} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-400" />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Driver Name</label>
                {/* FORCE UPPERCASE */}
                <input type="text" placeholder="Driver name..." value={driverName} onChange={e => setDriverName(e.target.value.toUpperCase())} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-400" />
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-blue-200 bg-blue-50/30 p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-blue-900">Finished Goods to Dispatch</h2>
              <button type="button" onClick={() => setDispatchBoxes([...dispatchBoxes, { boxId: '', dispatchQuantity: '' }])} className="flex items-center gap-1 text-sm font-medium text-blue-700 hover:text-blue-900">
                <Plus size={16} /> Add Item
              </button>
            </div>

            {!customerId ? (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">Please select a customer above to view their available box stock.</div>
            ) : customerBoxes.length === 0 ? (
              <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">No finished boxes are currently in stock for this customer.</div>
            ) : (
              <div className="space-y-3">
                {dispatchBoxes.map((item, idx) => (
                  <div key={idx} className="flex items-start gap-3">
                    <div className="flex-1">
                      <select required value={item.boxId} onChange={e => { const newB = [...dispatchBoxes]; newB[idx].boxId = e.target.value; setDispatchBoxes(newB); }} className="w-full rounded-xl border border-blue-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-400">
                        <option value="">Select box batch...</option>
                        {customerBoxes.map(b => (
                          <option key={b._id} value={b._id}>
                            {b.batchNumber} - {b.itemName} ({b.quantityAvailable} available)
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="w-40">
                      <input type="number" min="1" required placeholder="Qty" value={item.dispatchQuantity} onChange={e => { const newB = [...dispatchBoxes]; newB[idx].dispatchQuantity = e.target.value; setDispatchBoxes(newB); }} className="w-full rounded-xl border border-blue-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-400" />
                    </div>
                    {dispatchBoxes.length > 1 && (
                      <button type="button" onClick={() => setDispatchBoxes(dispatchBoxes.filter((_, i) => i !== idx))} className="mt-2.5 text-red-500 hover:text-red-700"><Trash2 size={18} /></button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex justify-end pt-2">
            <button type="submit" disabled={submitting || customerBoxes.length === 0} className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-700 px-6 py-3 text-sm font-semibold text-white transition hover:bg-blue-800 disabled:opacity-70">
              {submitting ? <Loader2 className="animate-spin" size={18} /> : <><Truck size={18} /> Generate Challan</>}
            </button>
          </div>
        </form>
      ) : (
        <div className="space-y-4">
          <div className="flex flex-wrap items-end gap-3"><div className="min-w-56"><label className="mb-1 block text-xs font-medium text-slate-600">Customer</label><select value={customerFilter} onChange={e => setCustomerFilter(e.target.value)} className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"><option value="">All customers</option>{customers.map(customer => <option key={customer._id} value={customer._id}>{customer.name}</option>)}</select></div><div className="flex-1"><DateRangeFilter from={from} to={to} onFromChange={setFrom} onToChange={setTo} onApply={() => fetchData({ from, to, customerId: customerFilter })} onReset={() => { setFrom(''); setTo(''); setCustomerFilter(''); fetchData({}); }} loading={loading} label="Dispatch date range" /></div></div>
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-5 py-3 font-semibold">Challan No.</th>
                <th className="px-5 py-3 font-semibold">Date</th>
                <th className="px-5 py-3 font-semibold">Customer</th>
                <th className="px-5 py-3 font-semibold">Items Dispatched</th>
                <th className="px-5 py-3 font-semibold">Vehicle & Driver</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {dispatches.map((dispatch) => (
                <tr key={dispatch._id} onClick={() => setSelectedChallan(dispatch)} className="hover:bg-blue-50 cursor-pointer transition">
                  <td className="px-5 py-4 font-medium text-blue-700"><div className="flex items-center gap-2"><FileText size={16} /> {dispatch.challanNumber}</div></td>
                  <td className="px-5 py-4 text-slate-600">{new Date(dispatch.dispatchDate || dispatch.createdAt).toLocaleDateString('en-IN')}</td>
                  <td className="px-5 py-4 font-medium text-slate-900">{dispatch.customerId?.name}</td>
                  <td className="px-5 py-4 text-slate-700">
                    <ul className="list-disc pl-4 space-y-1">
                      {dispatch.boxes.map((b, i) => (
                        <li key={i}><span className="font-medium">{b.dispatchQuantity}</span> x {b.boxId?.itemName || 'Finished Box'}</li>
                      ))}
                    </ul>
                  </td>
                  <td className="px-5 py-4 text-slate-600">
                    <div>{dispatch.vehicleNumber || '-'}</div>
                    <div className="text-xs text-slate-400">{dispatch.driverName || '-'}</div>
                  </td>
                </tr>
              ))}
              {dispatches.length === 0 && (<tr><td colSpan={5} className="p-8 text-center text-slate-500">No dispatches recorded yet.</td></tr>)}
            </tbody>
          </table>
          </div>
        </div>
      )}

      {selectedChallan && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm" onClick={() => setSelectedChallan(null)}>
          <div className="relative w-full max-w-3xl overflow-hidden rounded-2xl bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-end gap-3 border-b border-slate-100 bg-slate-50 px-6 py-3">
              <button onClick={handleDownloadPDF} disabled={isDownloading} className="flex items-center gap-2 rounded-lg bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-100 disabled:opacity-50">
                {isDownloading ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />} {isDownloading ? 'Generating...' : 'Download PDF'}
              </button>
              <button onClick={() => window.print()} className="flex items-center gap-2 rounded-lg bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700 transition hover:bg-blue-100"><Printer size={16} /> Print</button>
              <div className="h-6 w-px bg-slate-300 mx-2"></div>
              <button onClick={() => setSelectedChallan(null)} className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-200 hover:text-slate-700"><X size={20} /></button>
            </div>

            <div className="max-h-[80vh] overflow-y-auto bg-slate-100">
              <div id="challan-document" className="p-10 bg-white">
                <div className="mb-10 flex flex-col items-center text-center border-b-2 border-slate-900 pb-6">
                  <h2 className="text-4xl font-extrabold tracking-tight text-slate-900">SK PACKAGING</h2>
                  <p className="mt-1 text-sm font-medium text-slate-500 uppercase tracking-widest">Corrugated Box Manufacturers</p>
                  <div className="mt-6 inline-block rounded border border-slate-900 px-6 py-1.5">
                    <span className="text-lg font-bold uppercase tracking-wider text-slate-900">Delivery Challan</span>
                  </div>
                </div>

                <div className="mb-8 flex justify-between text-sm">
                  <div className="space-y-1.5">
                    <p className="text-slate-500 font-medium">Billed To:</p>
                    <p className="text-xl font-bold text-slate-900">{selectedChallan.customerId?.name}</p>
                  </div>
                  <div className="space-y-1.5 text-right">
                    <p><span className="text-slate-500 font-medium mr-2">Challan No:</span> <span className="font-bold text-slate-900">{selectedChallan.challanNumber}</span></p>
                    <p><span className="text-slate-500 font-medium mr-2">Date:</span> <span className="font-semibold text-slate-900">{new Date(selectedChallan.dispatchDate || selectedChallan.createdAt).toLocaleDateString('en-IN')}</span></p>
                    <p><span className="text-slate-500 font-medium mr-2">Vehicle:</span> <span className="font-semibold text-slate-900">{selectedChallan.vehicleNumber || 'N/A'}</span></p>
                    {selectedChallan.driverName && <p><span className="text-slate-500 font-medium mr-2">Driver:</span> <span className="font-semibold text-slate-900">{selectedChallan.driverName}</span></p>}
                  </div>
                </div>

                <table className="w-full text-left text-sm border-collapse">
                  <thead>
                    <tr className="border-b-2 border-slate-900">
                      <th className="py-3 font-bold text-slate-900">S.No</th>
                      <th className="py-3 font-bold text-slate-900">Description of Goods</th>
                      <th className="py-3 font-bold text-slate-900">Batch Code</th>
                      <th className="py-3 text-right font-bold text-slate-900">Quantity</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {selectedChallan.boxes.map((b, i) => (
                      <tr key={i}>
                        <td className="py-4 text-slate-700">{i + 1}</td>
                        <td className="py-4 font-semibold text-slate-900">
                          {b.boxId?.itemName || 'Finished Box'}
                          <div className="text-xs font-normal text-slate-500 mt-0.5">Size: {b.boxId?.dimensions?.length}" x {b.boxId?.dimensions?.width}" x {b.boxId?.dimensions?.height}"</div>
                        </td>
                        <td className="py-4 text-slate-600">{b.boxId?.batchNumber}</td>
                        <td className="py-4 text-right text-lg font-bold text-slate-900">{b.dispatchQuantity}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                <div className="mt-24 flex justify-between text-sm font-semibold text-slate-900">
                  <div className="text-center w-48 border-t-2 border-slate-300 pt-3">Receiver's Signature</div>
                  <div className="text-center w-48 border-t-2 border-slate-300 pt-3">For SK PACKAGING</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}