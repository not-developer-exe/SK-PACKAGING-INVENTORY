import React, { useEffect, useMemo, useState } from 'react';
import axiosClient from '../../api/axiosClient';
import {
  PackageCheck, RefreshCw, Loader2, CheckCircle2, XCircle, Clock3,
  Search, ChevronDown, ChevronRight, Boxes, ClipboardCheck, AlertTriangle,
  X, CalendarDays, UserRound, Ruler, IndianRupee, Package
} from 'lucide-react';

const number = value => Number(value?.$numberDecimal ?? value ?? 0);
const qty = value => number(value).toLocaleString('en-IN', { maximumFractionDigits: 0 });
const money = value => '₹' + number(value).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const dateLabel = value => value ? new Date(value).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
const statusLabel = status => status === 'approved' ? 'Quality approved' : status === 'rejected' ? 'Rejected' : 'Awaiting inspection';

const statusStyle = status => status === 'approved'
  ? 'bg-emerald-50 text-emerald-700 ring-emerald-200'
  : status === 'rejected'
    ? 'bg-red-50 text-red-700 ring-red-200'
    : 'bg-amber-50 text-amber-800 ring-amber-200';

export default function FinishedGoodsPage() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState('');
  const [filter, setFilter] = useState('all');
  const [customerFilter, setCustomerFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState({});
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [qcDialog, setQcDialog] = useState(null);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const { data } = await axiosClient.get('/conversion/finished-goods');
      setRows(data.finishedGoods || []);
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to load finished goods.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const customers = useMemo(() => {
    const map = new Map();
    rows.forEach(row => {
      const id = row.customerId?._id || row.customerId || 'unassigned';
      map.set(id, row.customerId?.name || 'Unassigned customer');
    });
    return Array.from(map.entries()).map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
  }, [rows]);

  const totals = useMemo(() => rows.reduce((acc, row) => {
    const status = row.qualityStatus || 'pending';
    const available = Math.max(0, number(row.quantityAvailable));
    acc.batches += 1;
    acc.produced += Math.max(0, number(row.quantityProduced));
    acc.available += available;
    acc[status] = (acc[status] || 0) + available;
    return acc;
  }, { batches: 0, produced: 0, available: 0, pending: 0, approved: 0, rejected: 0 }), [rows]);

  const filteredRows = useMemo(() => rows.filter(row => {
    const status = row.qualityStatus || 'pending';
    const customerId = row.customerId?._id || row.customerId || 'unassigned';
    const matchesStatus = filter === 'all' || status === filter;
    const matchesCustomer = customerFilter === 'all' || customerId === customerFilter;
    const searchable = [
      row.batchNumber, row.itemName, row.customerId?.name, row.ply,
      row.dimensions?.length, row.dimensions?.width, row.dimensions?.height,
      row.qualityStatus, row.qualityNotes
    ].join(' ').toLowerCase();
    return matchesStatus && matchesCustomer && (!search.trim() || searchable.includes(search.trim().toLowerCase()));
  }), [rows, filter, customerFilter, search]);

  const productGroups = useMemo(() => {
    const map = new Map();
    filteredRows.forEach(row => {
      const dimensions = row.dimensions || {};
      const customerId = row.customerId?._id || row.customerId || 'unassigned';
      const key = [customerId, row.itemName || 'Unnamed item', row.ply || '', dimensions.length || '', dimensions.width || '', dimensions.height || ''].join('|');
      if (!map.has(key)) map.set(key, {
        key,
        customer: row.customerId?.name || 'Unassigned customer',
        itemName: row.itemName || 'Unnamed item',
        ply: row.ply || '—',
        dimensions: [dimensions.length, dimensions.width, dimensions.height].filter(value => value !== undefined && value !== null).join(' × '),
        rows: []
      });
      map.get(key).rows.push(row);
    });
    return Array.from(map.values()).map(group => {
      const stats = group.rows.reduce((acc, row) => {
        const available = Math.max(0, number(row.quantityAvailable));
        const status = row.qualityStatus || 'pending';
        acc.available += available;
        acc.produced += Math.max(0, number(row.quantityProduced));
        acc.batches += 1;
        acc[status] += available;
        return acc;
      }, { available: 0, produced: 0, batches: 0, approved: 0, pending: 0, rejected: 0 });
      return { ...group, ...stats, rows: group.rows.slice().sort((a, b) => new Date(b.manufacturedAt || b.createdAt) - new Date(a.manufacturedAt || a.createdAt)) };
    }).sort((a, b) => a.itemName.localeCompare(b.itemName));
  }, [filteredRows]);

  const openQualityDialog = (row, qualityStatus) => {
    setQcDialog({ row, qualityStatus, qualityNotes: row.qualityNotes || '' });
  };

  const updateQuality = async event => {
    event.preventDefault();
    if (!qcDialog) return;
    const { row, qualityStatus, qualityNotes } = qcDialog;
    if (qualityStatus === 'rejected' && !qualityNotes.trim()) {
      setError('Please enter a reason before rejecting this batch.');
      return;
    }
    setUpdating(row._id);
    setError('');
    setSuccess('');
    try {
      await axiosClient.patch('/dispatch/finished-goods/' + row._id + '/quality', { qualityStatus, qualityNotes });
      setQcDialog(null);
      setSuccess(row.batchNumber + ' inspection updated: ' + statusLabel(qualityStatus) + '.');
      await load();
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to update inspection status.');
    } finally {
      setUpdating('');
    }
  };

  const toggleGroup = key => setExpanded(current => ({ ...current, [key]: !current[key] }));

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-blue-700">Inventory · Dispatch readiness</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">Finished Goods</h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-500">Product-wise box stock, individual manufacturing batches and quality inspection in one place.</p>
        </div>
        <button type="button" onClick={load} disabled={loading} className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"><RefreshCw size={16}/> Refresh stock</button>
      </div>

      {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
      {success && <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{success}</div>}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><div className="flex items-center justify-between"><span className="rounded-xl bg-blue-50 p-2.5 text-blue-700"><Boxes size={20}/></span><span className="text-xs text-slate-400">{totals.batches} batches</span></div><p className="mt-3 text-xs font-medium text-slate-500">Boxes produced</p><p className="mt-1 text-2xl font-bold tabular-nums text-slate-900">{qty(totals.produced)}</p></div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><div className="flex items-center justify-between"><span className="rounded-xl bg-slate-100 p-2.5 text-slate-700"><Package size={20}/></span><span className="text-xs text-slate-400">Physical stock</span></div><p className="mt-3 text-xs font-medium text-slate-500">Available boxes</p><p className="mt-1 text-2xl font-bold tabular-nums text-slate-900">{qty(totals.available)}</p></div>
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/50 p-4"><div className="flex items-center justify-between"><span className="rounded-xl bg-white p-2.5 text-emerald-700"><CheckCircle2 size={20}/></span><span className="text-xs text-emerald-700">Dispatch eligible</span></div><p className="mt-3 text-xs font-medium text-emerald-800">Quality approved</p><p className="mt-1 text-2xl font-bold tabular-nums text-emerald-800">{qty(totals.approved)}</p></div>
        <div className="rounded-2xl border border-amber-200 bg-amber-50/50 p-4"><div className="flex items-center justify-between"><span className="rounded-xl bg-white p-2.5 text-amber-700"><Clock3 size={20}/></span><span className="text-xs text-amber-700">QC pending</span></div><p className="mt-3 text-xs font-medium text-amber-800">Awaiting inspection</p><p className="mt-1 text-2xl font-bold tabular-nums text-amber-800">{qty(totals.pending)}</p></div>
        <div className="rounded-2xl border border-red-200 bg-red-50/50 p-4"><div className="flex items-center justify-between"><span className="rounded-xl bg-white p-2.5 text-red-700"><AlertTriangle size={20}/></span><span className="text-xs text-red-700">Hold / review</span></div><p className="mt-3 text-xs font-medium text-red-800">Rejected stock</p><p className="mt-1 text-2xl font-bold tabular-nums text-red-800">{qty(totals.rejected)}</p></div>
      </div>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 p-5">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div><h2 className="font-semibold text-slate-900">Product stock explorer</h2><p className="mt-1 text-xs text-slate-500">Open a product group to inspect each finished-goods batch and its QC state.</p></div>
            <div className="grid gap-2 sm:grid-cols-[minmax(220px,1fr)_220px] lg:w-[560px]">
              <div className="relative"><Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search product, customer or batch…" className="w-full rounded-xl border border-slate-200 py-2.5 pl-9 pr-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"/></div>
              <select value={customerFilter} onChange={event => setCustomerFilter(event.target.value)} className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-blue-500">{<option value="all">All customers</option>}{customers.map(customer => <option key={customer.id} value={customer.id}>{customer.name}</option>)}</select>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 px-5 py-3">
          {[
            ['all', 'All batches', rows.length],
            ['pending', 'Awaiting QC', rows.filter(row => (row.qualityStatus || 'pending') === 'pending').length],
            ['approved', 'Approved', rows.filter(row => row.qualityStatus === 'approved').length],
            ['rejected', 'Rejected', rows.filter(row => row.qualityStatus === 'rejected').length]
          ].map(([value, label, count]) => <button type="button" key={value} onClick={() => setFilter(value)} className={'rounded-full px-3.5 py-2 text-xs font-semibold transition ' + (filter === value ? 'bg-slate-900 text-white' : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50')}>{label}<span className={'ml-2 ' + (filter === value ? 'text-slate-300' : 'text-slate-400')}>{count}</span></button>)}
          <span className="ml-auto text-xs text-slate-400">{filteredRows.length} matching batches</span>
        </div>

        {loading ? <div className="flex h-52 items-center justify-center"><Loader2 className="animate-spin text-blue-600" size={30}/></div> :
          <div className="divide-y divide-slate-100">
            {productGroups.map(group => {
              const opened = Boolean(expanded[group.key]);
              return <div key={group.key}>
                <button type="button" onClick={() => toggleGroup(group.key)} className="flex w-full flex-col gap-3 px-5 py-4 text-left transition hover:bg-slate-50 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex min-w-0 items-start gap-3">
                    <span className="mt-0.5 text-slate-400">{opened ? <ChevronDown size={18}/> : <ChevronRight size={18}/>}</span>
                    <span className="rounded-xl bg-slate-100 p-2.5 text-slate-700"><PackageCheck size={19}/></span>
                    <div className="min-w-0"><p className="font-semibold text-slate-900">{group.itemName}</p><p className="mt-0.5 text-xs text-slate-500">{group.customer} · {group.ply}-ply · {group.dimensions || 'Dimensions not recorded'} in</p><p className="mt-1 text-xs text-slate-400">{group.batches} batches · {qty(group.produced)} produced</p></div>
                  </div>
                  <div className="flex flex-wrap items-center gap-4 pl-9 sm:pl-0">
                    <div><p className="text-[11px] text-slate-500">Available</p><p className="text-lg font-bold tabular-nums text-slate-900">{qty(group.available)}</p></div>
                    <div><p className="text-[11px] text-slate-500">Ready</p><p className="text-sm font-semibold tabular-nums text-emerald-700">{qty(group.approved)}</p></div>
                    <div><p className="text-[11px] text-slate-500">Pending QC</p><p className="text-sm font-semibold tabular-nums text-amber-700">{qty(group.pending)}</p></div>
                    <div><p className="text-[11px] text-slate-500">Rejected</p><p className="text-sm font-semibold tabular-nums text-red-700">{qty(group.rejected)}</p></div>
                  </div>
                </button>
                {opened && <div className="border-t border-slate-100 bg-slate-50/60 p-4 sm:p-5">
                  <div className="grid gap-3 lg:grid-cols-2">
                    {group.rows.map(row => {
                      const status = row.qualityStatus || 'pending';
                      const busy = updating === row._id;
                      return <article key={row._id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div><p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Finished goods batch</p><h3 className="mt-1 text-base font-bold text-slate-900">{row.batchNumber}</h3><p className="mt-1 inline-flex items-center gap-1.5 text-xs text-slate-500"><CalendarDays size={13}/>{dateLabel(row.manufacturedAt)}</p></div>
                          <span className={'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-xs font-semibold ring-1 ring-inset ' + statusStyle(status)}>{status === 'approved' ? <CheckCircle2 size={13}/> : status === 'rejected' ? <XCircle size={13}/> : <Clock3 size={13}/>} {statusLabel(status)}</span>
                        </div>
                        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
                          <div className="rounded-lg bg-slate-50 p-2.5"><p className="text-[11px] text-slate-500">Produced</p><p className="mt-1 font-bold tabular-nums text-slate-900">{qty(row.quantityProduced)}</p></div>
                          <div className="rounded-lg bg-slate-50 p-2.5"><p className="text-[11px] text-slate-500">Available</p><p className="mt-1 font-bold tabular-nums text-slate-900">{qty(row.quantityAvailable)}</p></div>
                          <div className="rounded-lg bg-slate-50 p-2.5"><p className="text-[11px] text-slate-500">Cost / box</p><p className="mt-1 font-bold tabular-nums text-slate-900">{row.costingStatus === 'available' ? money(row.costPerBox) : '—'}</p></div>
                          <div className="rounded-lg bg-slate-50 p-2.5"><p className="text-[11px] text-slate-500">Costing</p><p className="mt-1 font-semibold capitalize text-slate-800">{row.costingStatus || 'Unavailable'}</p></div>
                        </div>
                        {row.qualityNotes && <div className="mt-3 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-xs text-slate-600"><strong>Inspection note:</strong> {row.qualityNotes}</div>}
                        {status === 'pending' ? <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-100 pt-3"><button type="button" disabled={busy} onClick={() => openQualityDialog(row, 'approved')} className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"><CheckCircle2 size={14}/> Pass QC</button><button type="button" disabled={busy} onClick={() => openQualityDialog(row, 'rejected')} className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-white px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50"><XCircle size={14}/> Reject batch</button></div> : <div className="mt-4 border-t border-slate-100 pt-3 text-xs text-slate-500">{status === 'approved' ? 'This batch is eligible for dispatch.' : 'This batch is marked rejected and should remain on hold.'}</div>}
                      </article>;
                    })}
                  </div>
                </div>}
              </div>;
            })}
            {!productGroups.length && <div className="px-5 py-14 text-center"><PackageCheck size={32} className="mx-auto mb-3 text-slate-300"/><p className="font-medium text-slate-700">{rows.length ? 'No batches match the selected filters.' : 'No finished-goods batches recorded yet.'}</p><p className="mt-1 text-xs text-slate-400">Completed box conversions will appear here, grouped by product and specification.</p></div>}
          </div>}
      </section>

      {qcDialog && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
        <form onSubmit={updateQuality} className="w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl">
          <div className="flex items-start justify-between border-b border-slate-100 p-5"><div><p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Quality inspection</p><h2 className="mt-1 text-lg font-bold text-slate-900">{qcDialog.qualityStatus === 'approved' ? 'Approve batch' : 'Reject batch'}</h2><p className="mt-1 text-sm text-slate-500">{qcDialog.row.batchNumber} · {qcDialog.row.itemName}</p></div><button type="button" onClick={() => setQcDialog(null)} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100" aria-label="Close"><X size={18}/></button></div>
          <div className="space-y-2 p-5"><label className="block text-sm font-semibold text-slate-700">{qcDialog.qualityStatus === 'approved' ? 'Inspection note (optional)' : 'Reason for rejection *'}</label><textarea rows="4" required={qcDialog.qualityStatus === 'rejected'} value={qcDialog.qualityNotes} onChange={event => setQcDialog(current => ({ ...current, qualityNotes: event.target.value }))} placeholder={qcDialog.qualityStatus === 'approved' ? 'Record any inspection observations…' : 'Explain why this batch failed inspection…'} className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"/></div>
          <div className="flex justify-end gap-2 border-t border-slate-100 p-5"><button type="button" onClick={() => setQcDialog(null)} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700">Cancel</button><button disabled={Boolean(updating)} className={'rounded-xl px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60 ' + (qcDialog.qualityStatus === 'approved' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-red-600 hover:bg-red-700')}>{updating ? 'Saving…' : qcDialog.qualityStatus === 'approved' ? 'Approve batch' : 'Confirm rejection'}</button></div>
        </form>
      </div>}
    </div>
  );
}
