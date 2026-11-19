import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, Receipt, ArrowLeft, CheckCircle2 } from 'lucide-react';
import { invoiceService } from '../../services/invoiceService';
import axiosClient from '../../api/axiosClient';
import { toLocalDateInput } from '../../lib/date';
import { useDialogs } from '../../context/DialogContext';

export default function CreateInvoicePage({ company = 'sk' }) {
  const navigate = useNavigate();
  const { alert } = useDialogs();
  const apiBase = company === 'nsb' ? '/nsb/invoices' : '/invoices';
  const partiesBase = company === 'nsb' ? '/nsb/parties' : '/parties';
  const routeBase = company === 'nsb' ? '/nsb/sales' : '/sales';
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  
  const [customers, setCustomers] = useState([]);
  const [companyStateCode, setCompanyStateCode] = useState('');
  const [taxContextConfigured, setTaxContextConfigured] = useState(false);
  const [uninvoicedChallans, setUninvoicedChallans] = useState([]);
  
  const [invoiceDate, setInvoiceDate] = useState(toLocalDateInput());
  const [customerId, setCustomerId] = useState('');
  const [placeOfSupplyStateCode, setPlaceOfSupplyStateCode] = useState('');
  const [dispatchId, setDispatchId] = useState('');
  const [gstPercent, setGstPercent] = useState(5);
  const [items, setItems] = useState([]);

  // Fetch Customers
  useEffect(() => {
    const fetchCustomers = async () => {
      try {
        const { data } = await axiosClient.get(partiesBase + '?type=customer');
        setCustomers(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error('Error fetching customers:', err);
        setCustomers([]);
      }
    };
    fetchCustomers();
    axiosClient.get(apiBase + '/tax-context').then(({ data }) => {
      setCompanyStateCode(data.companyStateCode || '');
      setTaxContextConfigured(Boolean(data.configured));
    }).catch(() => setTaxContextConfigured(false));
  }, []);

  // Fetch Live Uninvoiced Challans from DB
  useEffect(() => {
    const fetchChallans = async () => {
      if (!customerId) {
        setUninvoicedChallans([]);
        setPlaceOfSupplyStateCode('');
        setDispatchId('');
        setItems([]);
        return;
      }
      try {
        setLoading(true);
        const { data } = await axiosClient.get(apiBase + '/uninvoiced/' + encodeURIComponent(customerId));
        setUninvoicedChallans(Array.isArray(data) ? data : (data?.data || []));
        setDispatchId(''); 
        setItems([]);
      } catch (err) {
        console.error('Error fetching challans:', err);
        setUninvoicedChallans([]);
      } finally {
        setLoading(false);
      }
    };
    fetchChallans();
  }, [customerId]);

  useEffect(() => {
    const customer = customers.find((item) => item._id === customerId);
    setPlaceOfSupplyStateCode(customer?.stateCode || '');
  }, [customerId, customers]);

  const handleChallanSelect = (selectedId) => {
    setDispatchId(selectedId);
    const challan = uninvoicedChallans?.find(c => c._id === selectedId);
    
    if (challan) {
      const populatedItems = (challan.boxes || challan.items || []).map(b => ({
        boxId: b.boxId?._id || b.boxId,
        itemName: b.boxId?.itemName || b.itemName || 'Finished Box',
        quantity: b.dispatchQuantity || b.quantity || 0,
        rate: ''
      }));
      setItems(populatedItems);
    } else {
      setItems([]);
    }
  };

  const handleRateChange = (index, value) => {
    const newItems = [...items];
    newItems[index].rate = Number(value);
    setItems(newItems);
  };

  // Match the server's per-line and per-tax-component two-decimal rounding exactly.
  const taxableAmounts = (items || []).map((item) => Number(((item.quantity || 0) * (item.rate || 0)).toFixed(2)));
  const subTotal = Number(taxableAmounts.reduce((sum, amount) => sum + amount, 0).toFixed(2));
  const taxReady = taxContextConfigured && /^\d{2}$/.test(companyStateCode) && /^\d{2}$/.test(placeOfSupplyStateCode);
  const isIntraState = taxReady && companyStateCode === placeOfSupplyStateCode;
  const cgstAmount = isIntraState ? Number((subTotal * gstPercent / 200).toFixed(2)) : 0;
  const sgstAmount = isIntraState ? Number((subTotal * gstPercent / 200).toFixed(2)) : 0;
  const igstAmount = taxReady && !isIntraState ? Number((subTotal * gstPercent / 100).toFixed(2)) : 0;
  const grandTotal = Number((subTotal + cgstAmount + sgstAmount + igstAmount).toFixed(2));

  // Execute Live Transaction
  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await axiosClient.post(apiBase, {
        invoiceDate,
        customerId,
        dispatchId,
        items,
        gstPercent,
        subTotal,
        cgstAmount,
        sgstAmount,
        igstAmount,
        placeOfSupplyStateCode,
        grandTotal
      });
      navigate(routeBase);
    } catch (err) {
      await alert({ title: 'Invoice could not be created', message: err.response?.data?.message || 'Failed to generate GST Invoice' });
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex items-center gap-4">
        <button onClick={() => navigate('/sales')} className="rounded-lg p-2 text-slate-400 hover:bg-slate-200 hover:text-slate-700 transition">
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Create GST Invoice</h1>
          <p className="mt-1 text-sm text-slate-500">Convert an existing Delivery Challan into a Tax Invoice.</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-lg font-semibold text-slate-900 flex items-center gap-2">
              <Receipt size={20} className="text-blue-600" /> Mapping & Details
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Invoice Date *</label>
                <input type="date" required value={invoiceDate} onChange={e => setInvoiceDate(e.target.value)} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-400" />
              </div>
              
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Customer *</label>
                <select required value={customerId} onChange={e => setCustomerId(e.target.value)} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-400">
                  <option value="">Select customer...</option>
                  {customers?.map(c => <option key={c._id} value={c._id}>{c.name}</option>)}
                </select>
              </div>

              <div className="sm:col-span-2">
                <label className="mb-1 block text-sm font-medium text-slate-700">Select Un-billed Delivery Challan *</label>
                <select 
                  required 
                  disabled={!customerId || loading}
                  value={dispatchId} 
                  onChange={e => handleChallanSelect(e.target.value)} 
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-400 disabled:bg-slate-50"
                >
                  <option value="">{loading ? 'Loading challans...' : 'Select a challan to bill...'}</option>
                  {uninvoicedChallans?.map(c => (
                    <option key={c._id} value={c._id}>
                      Challan {c.challanNumber || c._id.slice(-6)} — {new Date(c.dispatchDate || c.createdAt).toLocaleDateString('en-IN')} ({(c.boxes || c.items || []).length} items)
                    </option>
                  ))}
                </select>
                {customerId && (!uninvoicedChallans || uninvoicedChallans.length === 0) && !loading && (
                  <p className="mt-1.5 text-xs font-medium text-amber-600">No pending challans found for this customer.</p>
                )}
              </div>
              <div className="sm:col-span-2 rounded-lg bg-slate-50 p-3 text-xs text-slate-600">
                Company GST state: <strong>{companyStateCode || 'Not configured'}</strong>
                <label className="mt-2 block text-sm text-slate-700">Place of supply state code<input inputMode="numeric" pattern="[0-9]{2}" maxLength="2" value={placeOfSupplyStateCode} onChange={(e) => setPlaceOfSupplyStateCode(e.target.value.replace(/\D/g, '').slice(0, 2))} placeholder="Two-digit state code" className="mt-1 w-full rounded-lg border bg-white px-3 py-2" /></label>
                {!taxContextConfigured && <p className="mt-1 text-amber-700">Set GST_STATE_CODE (or GSTIN) in the server environment before issuing invoices.</p>}
                {taxContextConfigured && !placeOfSupplyStateCode && <p className="mt-1 text-amber-700">Enter the delivery place-of-supply state code. The customer state is prefilled when available.</p>}
              </div>
            </div>
          </div>

          {items?.length > 0 && (
            <div className="rounded-2xl border border-blue-200 bg-blue-50/30 p-6">
              <h2 className="mb-4 text-lg font-semibold text-blue-900">Pricing Configuration</h2>
              <div className="space-y-4">
                {items?.map((item, idx) => (
                  <div key={idx} className="flex items-center gap-3 rounded-xl bg-white p-3 border border-blue-100 shadow-sm">
                    <div className="flex-1">
                      <p className="font-semibold text-slate-900">{item.itemName}</p>
                      <p className="text-xs text-slate-500">Dispatched: <span className="font-medium text-slate-700">{item.quantity} units</span></p>
                    </div>
                    <div className="w-40 relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 font-medium text-slate-500">₹</span>
                      <input 
                        type="number" min="0.1" step="0.01" required placeholder="Rate/Box" 
                        value={item.rate} onChange={e => handleRateChange(idx, e.target.value)} 
                        className="w-full rounded-xl border border-blue-200 bg-white py-2 pl-7 pr-3 text-sm outline-none focus:border-blue-500" 
                      />
                    </div>
                    <div className="w-32 text-right">
                      <p className="text-xs text-slate-500">Taxable Val</p>
                      <p className="font-semibold text-slate-900">₹{Number(((item.quantity || 0) * (item.rate || 0)).toFixed(2)).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="space-y-6">
          <div className="rounded-2xl border border-slate-900 bg-slate-900 p-6 text-white shadow-xl sticky top-24">
            <h3 className="mb-6 text-lg font-semibold text-slate-100 border-b border-slate-700 pb-3">Invoice Summary</h3>
            
            <div className="space-y-4 text-sm">
              <div className="flex justify-between text-slate-300">
                <span>Subtotal (Taxable)</span>
                <span className="font-medium text-white">₹{subTotal.toLocaleString('en-IN', {minimumFractionDigits: 2})}</span>
              </div>
              
              <div className="flex items-center justify-between border-t border-slate-700 pt-4">
                <span className="text-slate-300">GST %</span>
                <select 
                  value={gstPercent}
                  onChange={(e) => setGstPercent(Number(e.target.value))}
                  className="rounded-lg border border-slate-700 bg-slate-800 px-2 py-1 text-xs outline-none focus:border-blue-500"
                >
                  <option value={0}>0% (Nil)</option>
                  <option value={5}>5%</option>
                  <option value={12}>12%</option>
                  <option value={18}>18%</option>
                  <option value={28}>28%</option>
                  <option value={40}>40%</option>
                </select>
              </div>

              {isIntraState ? <>
              <div className="flex justify-between text-slate-400 text-xs">
                <span>CGST ({(gstPercent/2)}%)</span>
                <span>₹{cgstAmount.toLocaleString('en-IN', {minimumFractionDigits: 2})}</span>
              </div>
              <div className="flex justify-between text-slate-400 text-xs">
                <span>SGST ({(gstPercent/2)}%)</span>
                <span>₹{sgstAmount.toLocaleString('en-IN', {minimumFractionDigits: 2})}</span>
              </div>
              </> : <div className="flex justify-between text-slate-400 text-xs"><span>IGST ({gstPercent}%)</span><span>₹{igstAmount.toLocaleString('en-IN', {minimumFractionDigits: 2})}</span></div>}

              <div className="flex justify-between border-t border-slate-700 pt-4 text-lg font-bold text-emerald-400">
                <span>Grand Total</span>
                <span>₹{grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>
            </div>

            <button 
              type="submit" 
              disabled={submitting || !taxReady || !items || items.length === 0 || items.some(i => !i.rate)} 
              className="mt-8 flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3.5 text-sm font-semibold text-white transition hover:bg-blue-500 disabled:bg-slate-700 disabled:text-slate-500"
            >
              {submitting ? <Loader2 className="animate-spin" size={18} /> : <><CheckCircle2 size={18} /> Generate Invoice</>}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}