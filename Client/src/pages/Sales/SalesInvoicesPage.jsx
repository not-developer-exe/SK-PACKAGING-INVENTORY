import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Plus, Filter, RefreshCw, Ban } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import axiosClient from '../../api/axiosClient';
import DateRangeFilter from '../../components/DateRangeFilter';
import { useDialogs } from '../../context/DialogContext';

const money = (value) => '₹' + Number(value || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function SalesInvoicesPage({ company = 'sk', workspace = 'regular' }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { confirm, prompt } = useDialogs();
  const apiBase = company === 'nsb' ? '/nsb/invoices' : workspace === 'sk-b-sales' ? '/b-sales/invoices' : '/invoices';
  const partiesBase = company === 'nsb' ? '/nsb/parties' : '/parties';
  const routeBase = company === 'nsb' ? '/nsb/sales' : workspace === 'sk-b-sales' ? '/b-sales' : '/sales';
  const [invoices, setInvoices] = useState([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [customerFilter, setCustomerFilter] = useState('');
  const [customers, setCustomers] = useState([]);
  const [cancellingId, setCancellingId] = useState('');
  const [draftActionId, setDraftActionId] = useState('');

  const loadInvoices = async (dateParams = {}) => {
    setLoading(true);
    setError('');
    try {
      const { data } = await axiosClient.get(apiBase, { params: dateParams });
      setInvoices(data.invoices || []);
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to load invoices.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadInvoices(); axiosClient.get(partiesBase + '?type=customer').then(({ data }) => setCustomers(Array.isArray(data) ? data : [])).catch(() => setCustomers([])); }, []);

  const filteredInvoices = useMemo(() => invoices.filter((invoice) => {
    const partyName = invoice.customerId?.name || '';
    const invoiceNumber = invoice.invoiceNumber || '';
    const matchesSearch = partyName.toLowerCase().includes(search.toLowerCase()) ||
      invoiceNumber.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === 'All' || invoice.status === statusFilter;
    return matchesSearch && matchesStatus;
  }), [invoices, search, statusFilter]);


  const issueDraft = async (invoice) => {
    const approved = await confirm({ title: 'Issue invoice?', message: 'This assigns the next official invoice number and posts the customer ledger entry. The draft can no longer be deleted as a draft.', confirmLabel: 'Issue invoice' });
    if (!approved) return;
    setDraftActionId(invoice._id);
    try { await axiosClient.post(apiBase + '/' + invoice._id + '/issue'); await loadInvoices({ from, to, customerId: customerFilter }); }
    catch (err) { setError(err.response?.data?.message || 'Unable to issue draft.'); }
    finally { setDraftActionId(''); }
  };
  const deleteDraft = async (invoice) => {
    const approved = await confirm({ title: 'Delete draft?', message: 'Only this draft will be deleted. No official invoice number has been consumed.', confirmLabel: 'Delete draft', destructive: true });
    if (!approved) return;
    setDraftActionId(invoice._id);
    try { await axiosClient.delete(apiBase + '/' + invoice._id + '/draft'); await loadInvoices({ from, to, customerId: customerFilter }); }
    catch (err) { setError(err.response?.data?.message || 'Unable to delete draft.'); }
    finally { setDraftActionId(''); }
  };

  const cancelInvoice = async (invoice) => {
    const reason = await prompt({ title: 'Cancel invoice ' + invoice.invoiceNumber, message: 'Enter a cancellation reason (minimum 10 characters).', placeholder: 'Cancellation reason…', minLength: 10, confirmLabel: 'Continue', destructive: true });
    if (reason === null) return;
    const approved = await confirm({ title: 'Confirm invoice cancellation', message: 'Cancel this unpaid invoice and reverse its customer ledger debit? This action will be recorded in the audit log.', confirmLabel: 'Cancel invoice', destructive: true });
    if (!approved) return;
    setCancellingId(invoice._id); setError('');
    try {
      await axiosClient.patch(apiBase + '/' + invoice._id + '/cancel', { reason: reason.trim() });
      await loadInvoices({ from, to, customerId: customerFilter });
    } catch (err) { setError(err.response?.data?.message || 'Unable to cancel invoice.'); }
    finally { setCancellingId(''); }
  };

  const activeInvoices = invoices.filter((invoice) => !['Cancelled', 'Draft'].includes(invoice.status));
  const totalSales = activeInvoices.reduce((sum, invoice) => sum + Number(invoice.grandTotal || 0), 0);
  const totalBalance = activeInvoices.reduce((sum, invoice) => sum + Number(invoice.balanceDue || 0), 0);
  const totalReceived = totalSales - totalBalance;
  const costedInvoices = activeInvoices.filter((invoice) => invoice.costingStatus === 'available');
  const totalGrossProfit = costedInvoices.reduce((sum, invoice) => sum + Number(invoice.grossProfit || 0), 0);

  const statusStyle = {
    Draft: 'bg-slate-100 text-slate-700 border-slate-200',
    Paid: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    Pending: 'bg-amber-50 text-amber-700 border-amber-200',
    Overdue: 'bg-red-50 text-red-700 border-red-200',
    Cancelled: 'bg-slate-100 text-slate-600 border-slate-200'
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">{workspace === 'sk-b-sales' ? 'SK Packaging – B Sales' : 'Sales Invoices'}</h1>
          <p className="mt-1 text-sm text-slate-500">Live invoices, receipts allocated and customer receivables.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => loadInvoices({ from, to, customerId: customerFilter })} className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-600"><RefreshCw size={15} className="mr-1 inline" />Refresh</button>
          <button onClick={() => navigate(routeBase + '/new')} className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white"><Plus size={16} className="mr-1 inline" />{workspace === 'sk-b-sales' ? 'New B Sales Invoice' : 'New GST Invoice'}</button>
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-3"><div className="min-w-56"><label className="mb-1 block text-xs font-medium text-slate-600">Customer</label><select value={customerFilter} onChange={e => setCustomerFilter(e.target.value)} className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"><option value="">All customers</option>{customers.map(customer => <option key={customer._id} value={customer._id}>{customer.name}</option>)}</select></div><div className="flex-1"><DateRangeFilter from={from} to={to} onFromChange={setFrom} onToChange={setTo} onApply={() => loadInvoices({ from, to, customerId: customerFilter })} onReset={() => { setFrom(''); setTo(''); setCustomerFilter(''); loadInvoices({}); }} loading={loading} label="Invoice date range" /></div></div>

      {error && <p role="alert" className="rounded-lg border border-red-100 bg-red-50 p-3 text-sm text-red-700">{error}</p>}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-5"><p className="text-sm text-slate-500">Total Sales Amount</p><p className="mt-2 text-2xl font-bold text-slate-900">{money(totalSales)}</p></div>
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/50 p-5"><p className="text-sm text-emerald-700">Payment Received / Adjusted</p><p className="mt-2 text-2xl font-bold text-emerald-900">{money(totalReceived)}</p></div>
        <div className="rounded-2xl border border-amber-200 bg-amber-50/50 p-5"><p className="text-sm text-amber-700">Balance Due</p><p className="mt-2 text-2xl font-bold text-amber-900">{money(totalBalance)}</p></div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5"><p className="text-sm text-slate-500">Gross Profit (costed invoices)</p><p className="mt-2 text-2xl font-bold text-slate-900">{money(totalGrossProfit)}</p><p className="mt-1 text-xs text-slate-500">{costedInvoices.length} of {activeInvoices.length} invoices have cost data</p></div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <div className="flex flex-col justify-between gap-3 border-b border-slate-100 bg-slate-50/50 p-4 sm:flex-row">
          <div className="relative w-full sm:max-w-md"><Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search customer or invoice number..." className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm" /></div>
          <div className="flex items-center gap-2"><Filter size={16} className="text-slate-400" /><select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"><option>All</option><option>Draft</option><option>Paid</option><option>Pending</option><option>Overdue</option><option>Cancelled</option></select></div>
        </div>
        {loading ? <p className="p-10 text-center text-sm text-slate-500">Loading invoices...</p> : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="border-b bg-white text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-5 py-4">Date</th><th className="px-5 py-4">Invoice No.</th><th className="px-5 py-4">Customer</th><th className="px-5 py-4">Challan</th><th className="px-5 py-4 text-right">Invoice Total</th><th className="px-5 py-4 text-right">Balance Due</th><th className="px-5 py-4 text-right">Gross Profit</th><th className="px-5 py-4 text-center">Status</th><th className="px-5 py-4 text-center">Action</th></tr></thead>
              <tbody className="divide-y divide-slate-100">
                {filteredInvoices.map((invoice) => <tr key={invoice._id} onClick={() => navigate(routeBase + "/" + invoice._id)} onKeyDown={(event) => { if (event.key === "Enter") navigate(routeBase + "/" + invoice._id); }} tabIndex={0} role="link" aria-label={"Open invoice " + invoice.invoiceNumber} className="cursor-pointer hover:bg-blue-50/40 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500">
                  <td className="px-5 py-4 text-slate-600">{new Date(invoice.invoiceDate).toLocaleDateString('en-IN')}</td>
                  <td className="px-5 py-4 font-semibold text-blue-700">{invoice.invoiceNumber}</td>
                  <td className="px-5 py-4 font-medium text-slate-900">{invoice.customerId?.name || '—'}</td>
                  <td className="px-5 py-4 text-slate-600">{invoice.dispatchId?.challanNumber || '—'}</td>
                  <td className="px-5 py-4 text-right font-medium">{money(invoice.grandTotal)}</td>
                  <td className="px-5 py-4 text-right font-semibold text-amber-700">{money(invoice.balanceDue)}</td>
                  <td className="px-5 py-4 text-right font-semibold">{invoice.costingStatus === 'available' ? money(invoice.grossProfit) : 'Cost pending'}</td>
                  <td className="px-5 py-4 text-center"><span className={'inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ' + (statusStyle[invoice.status] || statusStyle.Pending)}>{invoice.status}</span></td><td className="px-5 py-4 text-center">{invoice.status === 'Draft' ? <div className="flex justify-center gap-2"><button disabled={draftActionId === invoice._id} onClick={(event) => { event.stopPropagation(); issueDraft(invoice); }} className="rounded-lg bg-blue-600 px-2.5 py-1.5 text-xs font-semibold text-white disabled:opacity-50">Issue</button>{user?.role === 'admin' && <button disabled={draftActionId === invoice._id} onClick={(event) => { event.stopPropagation(); deleteDraft(invoice); }} className="rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs disabled:opacity-50">Delete</button>}</div> : user?.role === 'admin' && invoice.status !== 'Cancelled' && invoice.balanceDue >= invoice.grandTotal - 0.005 && !(invoice.payments || []).length ? <button disabled={cancellingId === invoice._id} onClick={(event) => { event.stopPropagation(); cancelInvoice(invoice); }} className="inline-flex items-center gap-1 rounded-lg border border-red-200 px-2 py-1 text-xs text-red-700 disabled:opacity-50"><Ban size={13}/>{cancellingId === invoice._id ? 'Cancelling…' : 'Cancel'}</button> : <span className="text-xs text-slate-400">—</span>}</td>
                </tr>)}
                {!filteredInvoices.length && <tr><td colSpan={9} className="p-10 text-center text-slate-500">No invoices found for this filter.</td></tr>}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
