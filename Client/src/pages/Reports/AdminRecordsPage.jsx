import React, { useEffect, useState } from 'react';
import { Database, RefreshCw, Save, ShieldAlert, Search } from 'lucide-react';
import axiosClient from '../../api/axiosClient';

const entities = [
  ['parties', 'Parties'], ['reels', 'Paper reels'], ['sheets', 'Corrugated sheets'],
  ['finishedBoxes', 'Finished boxes'], ['productionRuns', 'Production runs'],
  ['dispatches', 'Dispatches'], ['invoices', 'Invoices'], ['inwardReceipts', 'Inward receipts'],
  ['scrapSales', 'Scrap sales'], ['wasteInventory', 'Waste inventory'],
  ['stockMovements', 'Stock movements'], ['openingStockAdjustments', 'Opening stock adjustments'],
  ['stockReconciliations', 'Stock reconciliations'], ['expenses', 'Expenses']
];

const pretty = value => {
  if (!value) return '—';
  if (typeof value === 'string') return value;
  return JSON.stringify(value);
};

export default function AdminRecordsPage() {
  const [entity, setEntity] = useState('parties');
  const [records, setRecords] = useState([]);
  const [selected, setSelected] = useState(null);
  const [json, setJson] = useState('');
  const [reason, setReason] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const load = async (requestedPage = page, keepId = null) => {
    setLoading(true); setError('');
    try {
      const { data } = await axiosClient.get('/admin-records/' + entity, { params: { page: requestedPage, limit: 50, search } });
      setRecords(data.records || []);
      setPage(data.page || requestedPage);
      setTotalPages(data.totalPages || 1);
      setTotalRecords(data.total || 0);
      const next = (data.records || []).find(item => String(item._id) === String(keepId));
      if (next) { setSelected(next); setJson(JSON.stringify(next, null, 2)); }
      else { setSelected(null); setJson(''); }
    } catch (e) { setError(e.response?.data?.message || 'Unable to load records.'); }
    finally { setLoading(false); }
  };
  useEffect(() => { setPage(1); load(1); }, [entity]);

  const selectRecord = record => {
    setSelected(record);
    setJson(JSON.stringify(record, null, 2));
    setReason('');
    setSuccess('');
  };

  const save = async () => {
    setError(''); setSuccess('');
    let document;
    try { document = JSON.parse(json); }
    catch { setError('The record editor contains invalid JSON.'); return; }
    if (!document || Array.isArray(document) || typeof document !== 'object') {
      setError('The record must be a JSON object.'); return;
    }
    if (reason.trim().length < 10) { setError('Enter a reason of at least 10 characters for the audit log.'); return; }
    if (!window.confirm('Apply these changes to the live ' + entity + ' record? This action is recorded in the audit log.')) return;
    setSaving(true);
    try {
      const { data } = await axiosClient.patch('/admin-records/' + entity + '/' + selected._id, { document, reason });
      setSuccess('Record updated. Changed fields: ' + (data.changedFields || []).join(', '));
      await load(page, selected._id);
    } catch (e) { setError(e.response?.data?.message || 'Unable to update record.'); }
    finally { setSaving(false); }
  };

  return <div className="mx-auto max-w-7xl space-y-6">
    <header><h1 className="text-2xl font-bold text-slate-900">Administrator Data Console</h1><p className="mt-1 text-sm text-slate-500">Inspect and correct schema fields across the ERP. Every override requires a reason and is written to the audit log.</p></header>
    <div className="flex flex-wrap items-center gap-3 rounded-2xl border bg-white p-4">
      <label className="text-sm font-medium">Record type<select value={entity} onChange={e => setEntity(e.target.value)} className="mt-1 block min-w-56 rounded-lg border bg-white px-3 py-2">{entities.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      <label className="min-w-56 flex-1 text-sm font-medium">Search all records<div className="mt-1 flex items-center gap-2 rounded-lg border px-3"><Search size={15} className="text-slate-400"/><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search fields or values" className="w-full py-2 outline-none"/></div></label>
      <button onClick={() => load(1)} disabled={loading} className="mt-5 rounded-lg border px-3 py-2 text-sm">Search</button><button onClick={() => load(page, selected?._id)} disabled={loading} className="mt-5 rounded-lg border px-3 py-2 text-sm"><RefreshCw size={15} className="mr-1 inline"/>Refresh</button>
    </div>
    {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
    {success && <p role="status" className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700">{success}</p>}
    <div className="grid gap-5 xl:grid-cols-[minmax(280px,0.8fr)_minmax(0,1.5fr)]">
      <section className="overflow-hidden rounded-2xl border bg-white">
        <div className="flex items-center justify-between border-b p-4"><h2 className="font-semibold"><Database size={16} className="mr-2 inline"/>Records</h2><span className="text-xs text-slate-500">{totalRecords} records · page {page} of {totalPages}</span></div>
        <div className="max-h-[680px] divide-y overflow-y-auto">
          {loading ? <p className="p-6 text-sm text-slate-500">Loading records…</p> : records.map(record => <button key={record._id} onClick={() => selectRecord(record)} className={'block w-full px-4 py-3 text-left hover:bg-slate-50 ' + (selected?._id === record._id ? 'bg-blue-50' : '')}><span className="block truncate text-sm font-medium text-slate-800">{record.name || record.invoiceNumber || record.reelCode || record.batchNumber || record.challanNumber || record.runNumber || record._id}</span><span className="mt-1 block truncate text-xs text-slate-500">{record._id} · {record.updatedAt ? new Date(record.updatedAt).toLocaleString('en-IN') : 'No update timestamp'}</span></button>)}
          {!loading && !records.length && <p className="p-6 text-sm text-slate-500">No matching records found.</p>}
        </div>
        <div className="flex items-center justify-between border-t p-3 text-xs text-slate-500">
          <button disabled={loading || page <= 1} onClick={() => load(page - 1)} className="rounded border px-3 py-2 disabled:opacity-40">Previous</button>
          <span>Page {page} / {totalPages}</span>
          <button disabled={loading || page >= totalPages} onClick={() => load(page + 1)} className="rounded border px-3 py-2 disabled:opacity-40">Next</button>
        </div>
      </section>
      <section className="space-y-3 rounded-2xl border bg-white p-5">
        <div><h2 className="font-semibold text-slate-900">Record editor</h2><p className="text-xs text-slate-500">Edit the JSON fields below. The record ID, timestamps and user password fields are protected.</p></div>
        {selected ? <>
          <textarea spellCheck="false" value={json} onChange={e => setJson(e.target.value)} rows={24} className="w-full rounded-xl border bg-slate-950 p-4 font-mono text-xs leading-5 text-emerald-100 outline-none focus:border-blue-500"/>
          <label className="block text-sm font-medium">Reason for correction (required)<textarea value={reason} onChange={e => setReason(e.target.value)} minLength={10} maxLength={500} rows={2} placeholder="Explain why this record needs correction…" className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"/></label>
          <div className="flex flex-wrap items-center justify-between gap-3"><span className="text-xs text-slate-500">Only fields defined in the selected model schema are persisted.</span><button onClick={save} disabled={saving} className="rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"><Save size={15} className="mr-2 inline"/>{saving ? 'Saving…' : 'Save admin override'}</button></div>
        </> : <div className="flex min-h-64 flex-col items-center justify-center text-center text-slate-500"><Database size={28} className="mb-3 opacity-40"/><p className="text-sm">Select a record to inspect and edit its fields.</p></div>}
      </section>
    </div>
    <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-900"><ShieldAlert size={15} className="mr-1 inline"/>Use this console for exceptional corrections, not routine stock or payment entries. Changing linked stock, invoice or ledger fields manually can break reconciliation. Use the normal module workflows whenever possible. All changes are audited with before/after values and your reason.</div>
  </div>;
}
