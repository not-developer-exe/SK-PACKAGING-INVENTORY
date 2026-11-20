import React, { useEffect, useState } from 'react';
import axiosClient from '../../api/axiosClient';
import { PackageCheck, RefreshCw, Loader2, CheckCircle2, XCircle, Clock3 } from 'lucide-react';

export default function FinishedGoodsPage() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState('');
  const [filter, setFilter] = useState('all');
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const { data } = await axiosClient.get('/conversion/finished-goods');
      setRows(data.finishedGoods || []);
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to load finished goods.');
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const updateQuality = async (row, qualityStatus) => {
    const qualityNotes = window.prompt(
      qualityStatus === 'approved'
        ? 'Inspection note (optional):'
        : 'Reason for rejecting this batch (required):',
      row.qualityNotes || ''
    );
    if (qualityNotes === null) return;
    if (qualityStatus === 'rejected' && !qualityNotes.trim()) {
      window.alert('Please enter the reason for rejection.');
      return;
    }
    setUpdating(row._id);
    try {
      await axiosClient.patch('/dispatch/finished-goods/' + row._id + '/quality', { qualityStatus, qualityNotes });
      await load();
    } catch (err) {
      window.alert(err.response?.data?.message || 'Unable to update inspection status.');
    } finally { setUpdating(''); }
  };

  const visible = rows.filter(row => filter === 'all' || (row.qualityStatus || 'pending') === filter);
  const totals = rows.reduce((acc, row) => {
    const status = row.qualityStatus || 'pending';
    const available = Math.max(0, Number(row.quantityAvailable) || 0);
    const produced = Math.max(0, Number(row.quantityProduced) || 0);
    acc.batches += 1;
    acc.produced += produced;
    acc.available += available;
    acc[status] = (acc[status] || 0) + available;
    return acc;
  }, { batches: 0, produced: 0, available: 0, pending: 0, approved: 0, rejected: 0 });

  const productTotals = Object.values(rows.reduce((acc, row) => {
    const dimensions = row.dimensions || {};
    const key = [row.customerId?._id || row.customerId || '', row.itemName || '', row.ply || '', dimensions.length || '', dimensions.width || '', dimensions.height || ''].join('|');
    if (!acc[key]) acc[key] = {
      key,
      customer: row.customerId?.name || '—',
      itemName: row.itemName || 'Unnamed item',
      ply: row.ply || '—',
      dimensions: [dimensions.length, dimensions.width, dimensions.height].filter(value => value !== undefined && value !== null).join(' × '),
      batches: 0,
      produced: 0,
      available: 0,
      ready: 0,
      pending: 0,
      rejected: 0
    };
    const item = acc[key];
    const available = Math.max(0, Number(row.quantityAvailable) || 0);
    item.batches += 1;
    item.produced += Math.max(0, Number(row.quantityProduced) || 0);
    item.available += available;
    const status = row.qualityStatus || 'pending';
    if (status === 'approved') item.ready += available;
    else if (status === 'pending') item.pending += available;
    else if (status === 'rejected') item.rejected += available;
    return acc;
  }, {})).sort((a, b) => a.itemName.localeCompare(b.itemName));

  const statusLabel = status => status === 'approved' ? 'Quality approved' : status === 'rejected' ? 'Rejected' : 'Awaiting inspection';

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Finished Goods Stock</h1>
          <p className="mt-1 text-sm text-slate-500">Completed box batches, quality inspection and ready-to-dispatch stock.</p>
        </div>
        <button onClick={load} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700"><RefreshCw size={16}/> Refresh</button>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <div className="rounded-xl border border-slate-200 bg-white p-4"><p className="text-xs text-slate-500">Total produced</p><p className="mt-1 text-2xl font-semibold tabular-nums">{totals.produced.toLocaleString('en-IN')}</p></div>
        <div className="rounded-xl border border-slate-200 bg-white p-4"><p className="text-xs text-slate-500">Physical stock</p><p className="mt-1 text-2xl font-semibold tabular-nums">{totals.available.toLocaleString('en-IN')}</p></div>
        <div className="rounded-xl border border-slate-200 bg-white p-4"><p className="text-xs text-slate-500">Ready to dispatch</p><p className="mt-1 text-2xl font-semibold text-emerald-700 tabular-nums">{totals.approved.toLocaleString('en-IN')}</p></div>
        <div className="rounded-xl border border-slate-200 bg-white p-4"><p className="text-xs text-slate-500">Awaiting QC</p><p className="mt-1 text-2xl font-semibold text-amber-700 tabular-nums">{totals.pending.toLocaleString('en-IN')}</p></div>
        <div className="rounded-xl border border-slate-200 bg-white p-4"><p className="text-xs text-slate-500">Rejected stock</p><p className="mt-1 text-2xl font-semibold text-red-700 tabular-nums">{totals.rejected.toLocaleString('en-IN')}</p></div>
      </div>
      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="border-b border-slate-100 px-4 py-3"><h2 className="font-semibold text-slate-900">Product-wise stock summary</h2><p className="text-xs text-slate-500">Quantities are boxes, grouped by customer and box specification.</p></div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="px-4 py-3">Customer / Product</th><th className="px-4 py-3">Specification</th><th className="px-4 py-3 text-right">Batches</th><th className="px-4 py-3 text-right">Produced</th><th className="px-4 py-3 text-right">Physical stock</th><th className="px-4 py-3 text-right">Ready</th><th className="px-4 py-3 text-right">Pending QC</th></tr></thead>
            <tbody className="divide-y divide-slate-100">
              {productTotals.map(item => <tr key={item.key}><td className="px-4 py-3"><div className="font-medium text-slate-900">{item.itemName}</div><div className="text-xs text-slate-500">{item.customer}</div></td><td className="px-4 py-3">{item.ply} ply · {item.dimensions || '—'}</td><td className="px-4 py-3 text-right tabular-nums">{item.batches}</td><td className="px-4 py-3 text-right tabular-nums">{item.produced.toLocaleString('en-IN')}</td><td className="px-4 py-3 text-right font-semibold tabular-nums">{item.available.toLocaleString('en-IN')}</td><td className="px-4 py-3 text-right text-emerald-700 tabular-nums">{item.ready.toLocaleString('en-IN')}</td><td className="px-4 py-3 text-right text-amber-700 tabular-nums">{item.pending.toLocaleString('en-IN')}</td></tr>)}
              {productTotals.length === 0 && <tr><td colSpan="7" className="px-4 py-8 text-center text-slate-500">No finished-goods quantities to summarise.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      <div className="flex flex-wrap items-center gap-2">
        {['all', 'pending', 'approved', 'rejected'].map(value => <button key={value} onClick={() => setFilter(value)} className={'rounded-full px-3 py-1.5 text-sm ' + (filter === value ? 'bg-slate-900 text-white' : 'border border-slate-200 bg-white text-slate-600')}>{value === 'all' ? 'All batches' : value === 'pending' ? 'Awaiting inspection' : value === 'approved' ? 'Approved' : 'Rejected'}</button>)}
      </div>

      {error && <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
      {loading ? <div className="flex h-40 items-center justify-center"><Loader2 className="animate-spin text-blue-600"/></div> :
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr>
                <th className="px-4 py-3">Batch / Date</th><th className="px-4 py-3">Customer</th><th className="px-4 py-3">Box specification</th><th className="px-4 py-3 text-right">Produced</th><th className="px-4 py-3 text-right">Available</th><th className="px-4 py-3">Inspection</th><th className="px-4 py-3">Action</th>
              </tr></thead>
              <tbody className="divide-y divide-slate-100">
                {visible.map(row => {
                  const status = row.qualityStatus || 'pending';
                  const busy = updating === row._id;
                  return <tr key={row._id}>
                    <td className="px-4 py-3"><div className="font-semibold text-slate-900">{row.batchNumber}</div><div className="text-xs text-slate-500">{row.manufacturedAt ? new Date(row.manufacturedAt).toLocaleDateString('en-IN') : '—'}</div></td>
                    <td className="px-4 py-3">{row.customerId?.name || '—'}</td>
                    <td className="px-4 py-3"><div className="font-medium">{row.itemName} · {row.ply} ply</div><div className="text-xs text-slate-500">{row.dimensions?.length} × {row.dimensions?.width} × {row.dimensions?.height}</div></td>
                    <td className="px-4 py-3 text-right tabular-nums">{row.quantityProduced}</td>
                    <td className="px-4 py-3 text-right font-semibold tabular-nums">{row.quantityAvailable}</td>
                    <td className="px-4 py-3"><span className={'inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs ' + (status === 'approved' ? 'bg-emerald-50 text-emerald-700' : status === 'rejected' ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-700')}>{status === 'approved' ? <CheckCircle2 size={13}/> : status === 'rejected' ? <XCircle size={13}/> : <Clock3 size={13}/>} {statusLabel(status)}</span>{row.qualityNotes && <div className="mt-1 max-w-48 text-xs text-slate-500">{row.qualityNotes}</div>}</td>
                    <td className="px-4 py-3">{status === 'pending' && row.quantityAvailable === row.quantityProduced ? <div className="flex gap-2"><button disabled={busy} onClick={() => updateQuality(row, 'approved')} className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50">{busy ? 'Saving…' : 'Pass QC'}</button><button disabled={busy} onClick={() => updateQuality(row, 'rejected')} className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-700 disabled:opacity-50">Reject</button></div> : status === 'approved' ? <span className="text-xs text-emerald-700">Eligible for dispatch</span> : <span className="text-xs text-slate-400">No action</span>}</td>
                  </tr>;
                })}
                {visible.length === 0 && <tr><td colSpan="7" className="px-4 py-12 text-center text-slate-500"><PackageCheck className="mx-auto mb-2" size={28}/>{rows.length ? 'No batches match this filter.' : 'No finished-goods batches recorded yet.'}</td></tr>}
              </tbody>
            </table>
          </div>
        </div>}
    </div>
  );
}
