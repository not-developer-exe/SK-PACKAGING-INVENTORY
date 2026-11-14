import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ArrowDownRight, ArrowUpRight, MapPin, Phone, Receipt, Search, Trash2, UserPlus, X } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import axiosClient from '../../api/axiosClient';
import DateRangeFilter from '../../components/DateRangeFilter';
import { toLocalDateInput } from '../../lib/date';

const emptyForm = { name: '', type: 'Customer', phone: '', city: '', openingBalance: '0' };
const money = (value) => '₹' + Math.abs(Number(value || 0)).toLocaleString('en-IN', { maximumFractionDigits: 2 });

export default function PartyMasterPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [parties, setParties] = useState([]);
  const [selectedParty, setSelectedParty] = useState(null);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('All');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showPartyModal, setShowPartyModal] = useState(false);
  const [editingParty, setEditingParty] = useState(null);
  const [partyForm, setPartyForm] = useState(emptyForm);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentDirection, setPaymentDirection] = useState('in');
  const [payment, setPayment] = useState({ amount: '', mode: 'NEFT', ref: '', date: toLocalDateInput() });

  const loadParties = async () => {
    setLoading(true);
    setError('');
    try {
      const { data } = await axiosClient.get('/parties');
      setParties(Array.isArray(data) ? data : []);
      if (selectedParty) {
        const fresh = (Array.isArray(data) ? data : []).find((item) => item._id === selectedParty._id);
        setSelectedParty(fresh || null);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to load party records.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadParties(); }, []);

  const filteredParties = useMemo(() => parties.filter((party) => {
    const matchesSearch = party.name.toLowerCase().includes(search.toLowerCase());
    const matchesType = typeFilter === 'All' || party.type === typeFilter || party.type === 'Both';
    return matchesSearch && matchesType;
  }), [parties, search, typeFilter]);

  const openAdd = () => {
    setEditingParty(null);
    setPartyForm(emptyForm);
    setError('');
    setShowPartyModal(true);
  };

  const openEdit = (party) => {
    setEditingParty(party);
    setPartyForm({ name: party.name || '', type: party.type || 'Customer', phone: party.phone || '', city: party.city || '', openingBalance: '0' });
    setError('');
    setShowPartyModal(true);
  };

  const saveParty = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      if (editingParty) {
        const { data } = await axiosClient.patch('/parties/' + editingParty._id, {
          name: partyForm.name, type: partyForm.type, phone: partyForm.phone, city: partyForm.city
        });
        setParties((current) => current.map((item) => item._id === data._id ? data : item));
        if (selectedParty?._id === data._id) setSelectedParty(data);
        setSuccess('Party details updated.');
      } else {
        const { data } = await axiosClient.post('/parties', {
          name: partyForm.name, type: partyForm.type, phone: partyForm.phone, city: partyForm.city,
          openingBalance: Number(partyForm.openingBalance)
        });
        setParties((current) => [data, ...current]);
        setSuccess('Party created successfully.');
      }
      setShowPartyModal(false);
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to save party.');
    } finally {
      setSaving(false);
    }
  };

  const deleteParty = async (party) => {
    if (!window.confirm('Delete ' + party.name + '? This is allowed only when its balance and transaction history are clear.')) return;
    setError('');
    try {
      await axiosClient.delete('/parties/' + party._id);
      setParties((current) => current.filter((item) => item._id !== party._id));
      setSuccess('Party deleted.');
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to delete party.');
    }
  };

  const recordPayment = async (event) => {
    event.preventDefault();
    if (!selectedParty) return;
    setSaving(true);
    setError('');
    try {
      const { data } = await axiosClient.post('/parties/' + selectedParty._id + '/transaction', {
        amount: Number(payment.amount), mode: payment.mode, ref: payment.ref, direction: paymentDirection, date: payment.date
      });
      setParties((current) => current.map((item) => item._id === data._id ? data : item));
      setSelectedParty(data);
      setPayment({ amount: '', mode: 'NEFT', ref: '', date: toLocalDateInput() });
      setShowPaymentModal(false);
      setSuccess('Payment entry recorded.');
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to record payment.');
    } finally {
      setSaving(false);
    }
  };

  const deleteTransaction = async (txn) => {
    if (!isAdmin || !selectedParty) return;
    if (!window.confirm('Delete ledger entry ' + (txn.ref || txn.type) + '?')) return;
    setError('');
    try {
      const { data } = await axiosClient.delete('/parties/' + selectedParty._id + '/transaction/' + txn._id);
      setParties((current) => current.map((item) => item._id === data._id ? data : item));
      setSelectedParty(data);
      setSuccess('Ledger entry deleted and balance recalculated.');
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to delete ledger entry.');
    }
  };

  const ledgerRows = useMemo(() => {
    if (!selectedParty) return [];
    return [...(selectedParty.ledger || [])]
       .filter((txn) => {
        if (!txn.date) return !from && !to;
        const dateKey = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date(txn.date));
        return (!from || dateKey >= from) && (!to || dateKey <= to);
      })
      .sort((a, b) => new Date(a.date) - new Date(b.date));
  }, [selectedParty, from, to]);

  const balanceLabel = (balance) => Number(balance) > 0 ? 'To receive' : Number(balance) < 0 ? 'To pay' : 'Settled';

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Party Master</h1>
          <p className="mt-1 text-sm text-slate-500">Live customer and supplier records with account statements.</p>
        </div>
        {!selectedParty && <button onClick={openAdd} className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white"><UserPlus size={16} className="mr-2 inline" />Add New Party</button>}
      </div>

      {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      {success && <p role="status" className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700">{success}</p>}

      {selectedParty ? (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border bg-white p-5">
            <div className="flex items-center gap-3">
              <button onClick={() => { setSelectedParty(null); setFrom(''); setTo(''); }} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"><ArrowLeft size={20} /></button>
              <div>
                <h2 className="text-xl font-bold text-slate-900">{selectedParty.name}</h2>
                <p className="mt-1 text-sm text-slate-500"><Phone size={13} className="mr-1 inline" />{selectedParty.phone || 'No phone'} <MapPin size={13} className="ml-3 mr-1 inline" />{selectedParty.city || 'No city'} · {selectedParty.type}</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-xs uppercase text-slate-500">Current outstanding</p>
              <p className="text-2xl font-bold text-slate-900">{money(selectedParty.balance)}</p>
              <p className="text-xs text-slate-500">{balanceLabel(selectedParty.balance)}</p>
            </div>
          </div>

          <div className="overflow-hidden rounded-2xl border bg-white">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b bg-slate-50 p-4">
              <h3 className="font-semibold text-slate-900"><Receipt size={17} className="mr-2 inline" />Account Statement</h3>
              <div className="flex flex-wrap gap-2">
                <button onClick={() => { setPaymentDirection('in'); setShowPaymentModal(true); }} className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700"><ArrowDownRight size={15} className="mr-1 inline" />Payment In</button>
                <button onClick={() => { setPaymentDirection('out'); setShowPaymentModal(true); }} className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700"><ArrowUpRight size={15} className="mr-1 inline" />Payment Out</button>
              </div>
            </div>
            <div className="border-b border-slate-100 p-4"><DateRangeFilter from={from} to={to} onFromChange={setFrom} onToChange={setTo} onApply={() => {}} onReset={() => { setFrom(''); setTo(''); }} label="Account statement date range" /></div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[700px] text-left text-sm">
                <thead className="border-b text-xs uppercase text-slate-500"><tr><th className="px-4 py-3">Date</th><th className="px-4 py-3">Particulars</th><th className="px-4 py-3">Reference</th><th className="px-4 py-3 text-right">Debit</th><th className="px-4 py-3 text-right">Credit</th><th className="px-4 py-3 text-right">Balance</th><th className="px-4 py-3"> </th></tr></thead>
                <tbody className="divide-y">
                  {ledgerRows.map((txn) => <tr key={txn._id}>
                    <td className="px-4 py-3">{txn.date ? new Date(txn.date).toLocaleDateString('en-IN') : '—'}</td>
                    <td className="px-4 py-3 font-medium">{txn.type}</td>
                    <td className="px-4 py-3 text-slate-500">{txn.ref || '—'}</td>
                    <td className="px-4 py-3 text-right">{txn.debit ? money(txn.debit) : '—'}</td>
                    <td className="px-4 py-3 text-right">{txn.credit ? money(txn.credit) : '—'}</td>
                    <td className="px-4 py-3 text-right font-semibold">{money(txn.balance)}</td>
                    <td className="px-4 py-3 text-right">{isAdmin && txn.type !== 'Opening Balance' && <button onClick={() => deleteTransaction(txn)} title="Delete ledger entry" className="text-slate-400 hover:text-red-600"><Trash2 size={15} /></button>}</td>
                  </tr>)}
                  {!ledgerRows.length && <tr><td colSpan="7" className="p-8 text-center text-slate-500">No ledger entries for this period.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border bg-white">
          <div className="flex flex-wrap gap-3 border-b bg-slate-50 p-4">
            <div className="relative min-w-[220px] flex-1"><Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search party name..." className="w-full rounded-lg border bg-white py-2 pl-9 pr-3 text-sm" /></div>
            <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="rounded-lg border bg-white px-3 py-2 text-sm"><option>All</option><option>Customer</option><option>Supplier</option></select>
            <button onClick={loadParties} className="rounded-lg border bg-white px-3 py-2 text-sm">Refresh</button>
          </div>
          {loading ? <p className="p-8 text-center text-sm text-slate-500">Loading parties...</p> : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[700px] text-left text-sm">
                <thead className="border-b text-xs uppercase text-slate-500"><tr><th className="px-5 py-4">Party</th><th className="px-5 py-4">Contact</th><th className="px-5 py-4">Type</th><th className="px-5 py-4 text-right">Balance</th><th className="px-5 py-4 text-right">Actions</th></tr></thead>
                <tbody className="divide-y">
                  {filteredParties.map((party) => <tr key={party._id} onClick={() => setSelectedParty(party)} className="cursor-pointer hover:bg-slate-50">
                    <td className="px-5 py-4"><p className="font-semibold text-slate-900">{party.name}</p><p className="text-xs text-slate-500">{party.city || '—'}</p></td>
                    <td className="px-5 py-4">{party.phone || '—'}</td>
                    <td className="px-5 py-4">{party.type}</td>
                    <td className="px-5 py-4 text-right font-semibold">{money(party.balance)} <span className="block text-xs font-normal text-slate-500">{balanceLabel(party.balance)}</span></td>
                    <td className="px-5 py-4 text-right" onClick={(e) => e.stopPropagation()}>
                      <button onClick={() => openEdit(party)} className="mr-3 text-sm font-medium text-blue-700">Edit</button>
                      {isAdmin && <button onClick={() => deleteParty(party)} className="text-sm font-medium text-red-600">Delete</button>}
                    </td>
                  </tr>)}
                  {!filteredParties.length && <tr><td colSpan="5" className="p-8 text-center text-slate-500">No party records found. Add your first customer or supplier.</td></tr>}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {showPartyModal && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4" onClick={() => setShowPartyModal(false)}>
        <form onSubmit={saveParty} onClick={(e) => e.stopPropagation()} className="w-full max-w-lg space-y-4 rounded-2xl bg-white p-6 shadow-xl">
          <div className="flex items-center justify-between"><h2 className="text-lg font-bold">{editingParty ? 'Edit party details' : 'Create party'}</h2><button type="button" onClick={() => setShowPartyModal(false)}><X size={19} /></button></div>
          <label className="block text-sm">Firm name<input required minLength="2" value={partyForm.name} onChange={(e) => setPartyForm({ ...partyForm, name: e.target.value })} className="mt-1 w-full rounded-lg border px-3 py-2" /></label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block text-sm">Type<select value={partyForm.type} onChange={(e) => setPartyForm({ ...partyForm, type: e.target.value })} className="mt-1 w-full rounded-lg border bg-white px-3 py-2"><option>Customer</option><option>Supplier</option><option>Both</option></select></label>
            <label className="block text-sm">Phone<input value={partyForm.phone} onChange={(e) => setPartyForm({ ...partyForm, phone: e.target.value })} className="mt-1 w-full rounded-lg border px-3 py-2" /></label>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <label className="block text-sm">City<input value={partyForm.city} onChange={(e) => setPartyForm({ ...partyForm, city: e.target.value })} className="mt-1 w-full rounded-lg border px-3 py-2" /></label>
            {!editingParty && <label className="block text-sm">Opening balance (₹)<input type="number" step="0.01" required value={partyForm.openingBalance} onChange={(e) => setPartyForm({ ...partyForm, openingBalance: e.target.value })} className="mt-1 w-full rounded-lg border px-3 py-2" /><span className="text-xs text-slate-500">Negative = payable; positive = receivable.</span></label>}
          </div>
          {editingParty && <p className="text-xs text-slate-500">Opening balance is immutable after creation. Use a separately audited adjustment process for corrections.</p>}
          <div className="flex justify-end gap-2"><button type="button" onClick={() => setShowPartyModal(false)} className="rounded-lg border px-4 py-2 text-sm">Cancel</button><button disabled={saving} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{saving ? 'Saving...' : 'Save party'}</button></div>
        </form>
      </div>}

      {showPaymentModal && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4" onClick={() => setShowPaymentModal(false)}>
        <form onSubmit={recordPayment} onClick={(e) => e.stopPropagation()} className="w-full max-w-md space-y-4 rounded-2xl bg-white p-6 shadow-xl">
          <div className="flex items-center justify-between"><h2 className="text-lg font-bold">{paymentDirection === 'in' ? 'Record payment received' : 'Record payment sent'}</h2><button type="button" onClick={() => setShowPaymentModal(false)}><X size={19} /></button></div>
          <label className="block text-sm">Payment date<input type="date" required value={payment.date} onChange={(e) => setPayment({ ...payment, date: e.target.value })} className="mt-1 w-full rounded-lg border px-3 py-2" /></label>
          <label className="block text-sm">Amount (₹)<input type="number" min="0.01" step="0.01" required value={payment.amount} onChange={(e) => setPayment({ ...payment, amount: e.target.value })} className="mt-1 w-full rounded-lg border px-3 py-2" /></label>
          <div className="grid grid-cols-2 gap-3"><label className="block text-sm">Mode<select value={payment.mode} onChange={(e) => setPayment({ ...payment, mode: e.target.value })} className="mt-1 w-full rounded-lg border bg-white px-3 py-2"><option>NEFT</option><option>RTGS</option><option>UPI</option><option>Cash</option><option>Cheque</option></select></label><label className="block text-sm">UTR / Reference<input value={payment.ref} onChange={(e) => setPayment({ ...payment, ref: e.target.value })} className="mt-1 w-full rounded-lg border px-3 py-2" /></label></div>
          <div className="flex justify-end gap-2"><button type="button" onClick={() => setShowPaymentModal(false)} className="rounded-lg border px-4 py-2 text-sm">Cancel</button><button disabled={saving} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{saving ? 'Saving...' : 'Post payment'}</button></div>
        </form>
      </div>}
    </div>
  );
}
