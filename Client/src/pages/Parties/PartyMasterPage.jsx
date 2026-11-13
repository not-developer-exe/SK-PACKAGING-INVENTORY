import React, { useState, useMemo } from 'react';
import { Search, Plus, Trash2, ArrowLeft, Phone, MapPin, Receipt, IndianRupee, User, Calendar, UserPlus, X, CheckCircle2, ArrowDownRight, ArrowUpRight, Save } from 'lucide-react';

export default function PartyMasterPage() {
  const [activeView, setActiveView] = useState('directory'); 
  const [selectedParty, setSelectedParty] = useState(null);
  
  const [parties, setParties] = useState([
    { _id: 'P01', name: 'Nano Fertilizers Private Ltd', type: 'Customer', phone: '+91 98765 43210', city: 'Gwalior', balance: 145000, openingBalance: 145000 },
    { _id: 'P02', name: 'Cheema Delta Mills', type: 'Supplier', phone: '+91 99887 76655', city: 'Indore', balance: -450000, openingBalance: -450000 },
    { _id: 'P03', name: 'Anvi Traders', type: 'Customer', phone: '+91 88776 65544', city: 'Bhopal', balance: 44333, openingBalance: 44333 },
    { _id: 'P05', name: 'Bahl Paper Mills', type: 'Both', phone: '+91 77665 54433', city: 'Delhi', balance: -25000, openingBalance: -25000 },
  ]);

  const [ledger, setLedger] = useState([
    { _id: 'L1', date: '2026-11-01', type: 'Opening Balance', ref: '-', debit: 0, credit: 0, balance: 22194 },
    { _id: 'L2', date: '2026-11-05', type: 'Tax Invoice', ref: 'INV-26-005', debit: 145000, credit: 0, balance: 167194 },
    { _id: 'L3', date: '2026-11-12', type: 'Payment Received', ref: 'NEFT', debit: 0, credit: 22194, balance: 145000 },
  ]);
  
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('All');
  const [monthFilter, setMonthFilter] = useState(new Date().toISOString().slice(0, 7));

  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentDirection, setPaymentDirection] = useState('in'); 
  const [payAmount, setPayAmount] = useState('');
  const [payMode, setPayMode] = useState('NEFT');
  const [payRef, setPayRef] = useState('');

  const [showPartyModal, setShowPartyModal] = useState(false);
  const [editingParty, setEditingParty] = useState(null);
  const [partyForm, setPartyForm] = useState({ name: '', type: 'Customer', phone: '', city: '', openingBalance: 0 });

  // UI Helpers for Type Colors
  const getTypeColors = (type) => {
    if (type === 'Supplier') return 'bg-purple-50 text-purple-700 border-purple-200';
    if (type === 'Both') return 'bg-amber-50 text-amber-700 border-amber-200';
    return 'bg-blue-50 text-blue-700 border-blue-200';
  };
  const getAvatarColors = (type) => {
    if (type === 'Supplier') return 'bg-purple-100 text-purple-700';
    if (type === 'Both') return 'bg-amber-100 text-amber-700';
    return 'bg-blue-100 text-blue-700';
  };

  const handleOpenAddModal = () => {
    setEditingParty(null);
    setPartyForm({ name: '', type: 'Customer', phone: '', city: '', openingBalance: 0 });
    setShowPartyModal(true);
  };

  const handleOpenEditModal = (party, e) => {
    e.stopPropagation();
    setEditingParty(party);
    setPartyForm({ 
      name: party.name, 
      type: party.type, 
      phone: party.phone, 
      city: party.city, 
      openingBalance: party.openingBalance || 0 
    });
    setShowPartyModal(true);
  };

  const handleSaveParty = (e) => {
    e.preventDefault();
    if (editingParty) {
      setParties(parties.map(p => p._id === editingParty._id ? { ...p, ...partyForm, openingBalance: Number(partyForm.openingBalance) } : p));
      if (selectedParty && selectedParty._id === editingParty._id) {
        setSelectedParty({ ...selectedParty, ...partyForm });
      }
    } else {
      const newParty = {
        _id: `P0${parties.length + 5}`, 
        ...partyForm,
        openingBalance: Number(partyForm.openingBalance),
        balance: Number(partyForm.openingBalance)
      };
      setParties([...parties, newParty]);
    }
    setShowPartyModal(false);
  };

  const handleDeleteParty = (party, e) => {
    e.stopPropagation(); 
    if (party.balance !== 0) return alert(`Cannot delete ${party.name}. Their balance must be settled to ₹0 first.`);
    if (window.confirm(`Are you sure you want to permanently delete ${party.name}?`)) {
      setParties(parties.filter(p => p._id !== party._id));
    }
  };

  const handleDeleteTransaction = (transaction) => {
    if (window.confirm(`Are you sure you want to delete transaction ${transaction.ref}? This will instantly recalculate the party's balance.`)) {
      setLedger(ledger.filter(t => t._id !== transaction._id));
      const balanceImpact = (transaction.credit || 0) - (transaction.debit || 0);
      const updatedParties = parties.map(p => {
        if (p._id === selectedParty._id) {
          const newBalance = p.balance + balanceImpact;
          setSelectedParty({ ...p, balance: newBalance });
          return { ...p, balance: newBalance };
        }
        return p;
      });
      setParties(updatedParties);
    }
  };

  const handleRecordPayment = (e) => {
    e.preventDefault();
    const amount = Number(payAmount);
    if (!amount || amount <= 0) return;

    const isPaymentIn = paymentDirection === 'in';
    const newBalance = isPaymentIn ? selectedParty.balance - amount : selectedParty.balance + amount;

    const newTxn = {
      _id: `L-${Date.now()}`,
      date: new Date().toISOString().split('T')[0],
      type: isPaymentIn ? 'Payment Received' : 'Payment Sent',
      ref: `${payMode}${payRef ? ' / ' + payRef : ''}`,
      debit: isPaymentIn ? 0 : amount,
      credit: isPaymentIn ? amount : 0,
      balance: newBalance
    };
    
    setLedger([...ledger, newTxn]);

    const updatedParties = parties.map(p => {
      if (p._id === selectedParty._id) {
        setSelectedParty({ ...p, balance: newBalance });
        return { ...p, balance: newBalance };
      }
      return p;
    });
    setParties(updatedParties);

    setPayAmount('');
    setPayRef('');
    setShowPaymentModal(false);
  };

  // Smart Filtering (Includes "Both" intelligently)
  const filteredParties = useMemo(() => {
    return parties.filter(p => {
      const matchesSearch = p.name.toLowerCase().includes(search.toLowerCase());
      const matchesType = typeFilter === 'All' 
        || p.type === typeFilter 
        || (typeFilter === 'Customer' && p.type === 'Both')
        || (typeFilter === 'Supplier' && p.type === 'Both');
      return matchesSearch && matchesType;
    });
  }, [search, typeFilter, parties]); 

  // --- LEDGER VIEW (KHATA) ---
  if (activeView === 'ledger' && selectedParty) {
    return (
      <div className="mx-auto max-w-5xl space-y-6 relative">
        <div className="flex items-center justify-between bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center gap-4">
            <button onClick={() => setActiveView('directory')} className="p-2 text-slate-400 hover:bg-slate-100 rounded-lg transition">
              <ArrowLeft size={20} />
            </button>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-slate-900">{selectedParty.name}</h1>
                <span className={`px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded border ${getTypeColors(selectedParty.type)}`}>
                  {selectedParty.type}
                </span>
              </div>
              <div className="flex gap-4 mt-1 text-sm text-slate-500">
                <span className="flex items-center gap-1"><Phone size={14}/> {selectedParty.phone}</span>
                <span className="flex items-center gap-1"><MapPin size={14}/> {selectedParty.city}</span>
              </div>
            </div>
          </div>
          <div className="text-right">
            <p className="text-sm font-medium text-slate-500">Current Outstanding</p>
            <p className={`text-2xl font-bold ${selectedParty.balance > 0 ? 'text-blue-600' : selectedParty.balance < 0 ? 'text-rose-600' : 'text-slate-900'}`}>
              {selectedParty.balance > 0 ? '+' : ''}₹{Math.abs(selectedParty.balance).toLocaleString('en-IN')}
            </p>
            <p className="text-[11px] text-slate-400 uppercase font-medium mt-0.5">{selectedParty.balance > 0 ? 'To Receive' : selectedParty.balance < 0 ? 'To Pay' : 'Settled'}</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-100 bg-slate-50 flex justify-between items-center overflow-x-auto gap-4">
            <h2 className="font-semibold text-slate-900 flex items-center gap-2 whitespace-nowrap">
              <Receipt size={18} className="text-slate-500" /> Account Statement (Khata)
            </h2>
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-lg px-2 sm:px-3 py-1.5">
                <Calendar size={16} className="text-slate-400" />
                <input 
                  type="month" 
                  value={monthFilter}
                  onChange={(e) => setMonthFilter(e.target.value)}
                  className="text-sm outline-none text-slate-700 font-medium cursor-pointer bg-transparent"
                />
              </div>
              <div className="h-6 w-px bg-slate-200 hidden sm:block"></div>
              
              <button 
                onClick={() => { setPaymentDirection('in'); setShowPaymentModal(true); }}
                className="flex items-center gap-1.5 rounded-lg bg-emerald-50 px-3 py-1.5 text-sm font-semibold text-emerald-700 hover:bg-emerald-100 transition border border-emerald-200 whitespace-nowrap"
              >
                <ArrowDownRight size={16} /> Payment In
              </button>
              <button 
                onClick={() => { setPaymentDirection('out'); setShowPaymentModal(true); }}
                className="flex items-center gap-1.5 rounded-lg bg-rose-50 px-3 py-1.5 text-sm font-semibold text-rose-700 hover:bg-rose-100 transition border border-rose-200 whitespace-nowrap"
              >
                <ArrowUpRight size={16} /> Payment Out
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-white text-xs uppercase tracking-wide text-slate-500 border-b border-slate-200">
                <tr>
                  <th className="px-5 py-3 font-semibold">Date</th>
                  <th className="px-5 py-3 font-semibold">Particulars</th>
                  <th className="px-5 py-3 font-semibold">Ref No.</th>
                  <th className="px-5 py-3 font-semibold text-right text-rose-600">Debit (Dr)</th>
                  <th className="px-5 py-3 font-semibold text-right text-emerald-600">Credit (Cr)</th>
                  <th className="px-5 py-3 font-semibold text-right text-blue-700">Balance</th>
                  <th className="px-5 py-3 font-semibold text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {ledger.map((txn) => (
                  <tr key={txn._id} className="hover:bg-slate-50 transition group">
                    <td className="px-5 py-4 text-slate-600">{new Date(txn.date).toLocaleDateString('en-IN')}</td>
                    <td className="px-5 py-4 font-medium text-slate-900">{txn.type}</td>
                    <td className="px-5 py-4 text-slate-500">{txn.ref}</td>
                    <td className="px-5 py-4 text-right font-medium text-slate-700">{txn.debit > 0 ? `₹${txn.debit.toLocaleString('en-IN')}` : '-'}</td>
                    <td className="px-5 py-4 text-right font-medium text-slate-700">{txn.credit > 0 ? `₹${txn.credit.toLocaleString('en-IN')}` : '-'}</td>
                    <td className="px-5 py-4 text-right font-bold text-slate-900">₹{txn.balance.toLocaleString('en-IN')}</td>
                    <td className="px-5 py-4 text-center">
                      {txn.type !== 'Opening Balance' && (
                        <button 
                          onClick={() => handleDeleteTransaction(txn)}
                          className="p-1.5 text-slate-300 hover:text-red-600 hover:bg-red-50 rounded-lg transition opacity-0 group-hover:opacity-100"
                          title="Delete Transaction"
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Dynamic Payment Modal */}
        {showPaymentModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm" onClick={() => setShowPaymentModal(false)}>
            <div className="relative w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl" onClick={e => e.stopPropagation()}>
              <div className={`flex items-center justify-between border-b px-6 py-4 ${paymentDirection === 'in' ? 'border-emerald-100 bg-emerald-50' : 'border-rose-100 bg-rose-50'}`}>
                <h3 className={`text-lg font-bold flex items-center gap-2 ${paymentDirection === 'in' ? 'text-emerald-900' : 'text-rose-900'}`}>
                  {paymentDirection === 'in' ? <ArrowDownRight size={18} className="text-emerald-600"/> : <ArrowUpRight size={18} className="text-rose-600"/>} 
                  {paymentDirection === 'in' ? 'Receive Payment-In' : 'Send Payment-Out'}
                </h3>
                <button onClick={() => setShowPaymentModal(false)} className="text-slate-400 hover:text-slate-700"><X size={20}/></button>
              </div>
              <form onSubmit={handleRecordPayment} className="p-6 space-y-4">
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Amount (₹) *</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 font-medium text-slate-400">₹</span>
                    <input 
                      type="number" 
                      required 
                      min="1" 
                      value={payAmount} 
                      onChange={e => setPayAmount(e.target.value)} 
                      className={`w-full rounded-xl border px-3 py-2.5 pl-8 outline-none font-semibold text-lg transition ${paymentDirection === 'in' ? 'border-slate-200 focus:border-emerald-500' : 'border-slate-200 focus:border-rose-500'}`} 
                      placeholder="0.00" 
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700">Mode *</label>
                    <select value={payMode} onChange={e => setPayMode(e.target.value)} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-slate-400">
                      <option value="NEFT">NEFT / RTGS</option>
                      <option value="UPI">UPI</option>
                      <option value="Cash">Cash</option>
                      <option value="Cheque">Cheque</option>
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700">Reference / UTR</label>
                    <input type="text" value={payRef} onChange={e => setPayRef(e.target.value.toUpperCase())} className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-slate-400 uppercase" placeholder="Optional" />
                  </div>
                </div>
                <div className="pt-4 mt-2 border-t border-slate-100 flex justify-end gap-3">
                  <button type="button" onClick={() => setShowPaymentModal(false)} className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 rounded-xl transition">Cancel</button>
                  <button type="submit" className={`flex items-center gap-2 text-white px-5 py-2 rounded-xl text-sm font-semibold transition shadow-sm ${paymentDirection === 'in' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-rose-600 hover:bg-rose-700'}`}>
                    <CheckCircle2 size={16}/> Save Transaction
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    );
  }

  // --- DIRECTORY VIEW ---
  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Party Master</h1>
          <p className="mt-1 text-sm text-slate-500">Manage customers, suppliers, and view their financial ledgers.</p>
        </div>
        <button 
          onClick={handleOpenAddModal}
          className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 shadow-sm"
        >
          <UserPlus size={16} /> Add New Party
        </button>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="flex flex-col sm:flex-row justify-between gap-4 border-b border-slate-100 p-4 bg-slate-50/50">
          <div className="relative w-full sm:w-96">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input 
              type="text" 
              placeholder="Search by party name..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm outline-none transition focus:border-blue-400 focus:ring-1 focus:ring-blue-400"
            />
          </div>
          <select 
            value={typeFilter} 
            onChange={(e) => setTypeFilter(e.target.value)}
            className="rounded-xl border border-slate-200 bg-white py-2 px-3 text-sm outline-none focus:border-blue-400"
          >
            <option value="All">All Parties</option>
            <option value="Customer">Customers Only</option>
            <option value="Supplier">Suppliers Only</option>
          </select>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-white text-xs uppercase tracking-wide text-slate-500 border-b border-slate-200">
              <tr>
                <th className="px-5 py-4 font-semibold">Party Details</th>
                <th className="px-5 py-4 font-semibold">Contact</th>
                <th className="px-5 py-4 font-semibold">Type</th>
                <th className="px-5 py-4 font-semibold text-right">Current Balance</th>
                <th className="px-5 py-4 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredParties.map((party) => (
                <tr 
                  key={party._id} 
                  onClick={() => {
                    setSelectedParty(party);
                    setActiveView('ledger');
                  }}
                  className="transition hover:bg-slate-50 cursor-pointer group"
                >
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <div className={`flex h-10 w-10 items-center justify-center rounded-full font-bold text-sm ${getAvatarColors(party.type)}`}>
                        {party.name.substring(0, 1)}
                      </div>
                      <div>
                        <p className="font-semibold text-slate-900">{party.name}</p>
                        <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5"><MapPin size={12}/> {party.city}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-4 text-slate-600">
                    <span className="flex items-center gap-1.5"><Phone size={14} className="text-slate-400"/> {party.phone}</span>
                  </td>
                  <td className="px-5 py-4">
                    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold border ${getTypeColors(party.type)}`}>
                      {party.type}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-right">
                    <p className={`font-bold ${party.balance > 0 ? 'text-blue-600' : party.balance < 0 ? 'text-rose-600' : 'text-slate-500'}`}>
                      {party.balance > 0 ? '+' : ''}₹{Math.abs(party.balance).toLocaleString('en-IN')}
                    </p>
                    <p className="text-[10px] text-slate-400 uppercase mt-0.5">{party.balance > 0 ? 'To Receive' : party.balance < 0 ? 'To Pay' : 'Settled'}</p>
                  </td>
                  <td className="px-5 py-4 text-right">
                    <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button 
                        onClick={(e) => handleOpenEditModal(party, e)} 
                        className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition" 
                        title="Edit Party"
                      >
                        <User size={16} />
                      </button>
                      <button 
                        onClick={(e) => handleDeleteParty(party, e)} 
                        className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition" 
                        title="Delete Party"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredParties.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-5 py-12 text-center text-slate-500">
                    No parties found. Click "Add New Party" to create one.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit Party Modal */}
      {showPartyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm" onClick={() => setShowPartyModal(false)}>
          <div className="relative w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 bg-slate-50">
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <UserPlus size={18} className="text-blue-600"/> {editingParty ? 'Edit Party Details' : 'Add New Party'}
              </h3>
              <button onClick={() => setShowPartyModal(false)} className="text-slate-400 hover:text-slate-700"><X size={20}/></button>
            </div>
            
            <form onSubmit={handleSaveParty} className="p-6 space-y-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">Firm Name *</label>
                <input 
                  type="text" 
                  required 
                  value={partyForm.name} 
                  onChange={e => setPartyForm({...partyForm, name: e.target.value})} 
                  className="w-full rounded-xl border border-slate-200 px-3 py-2.5 outline-none focus:border-blue-500" 
                  placeholder="e.g. SK Packaging" 
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">Type *</label>
                  <select 
                    value={partyForm.type} 
                    onChange={e => setPartyForm({...partyForm, type: e.target.value})} 
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-500"
                  >
                    <option value="Customer">Customer</option>
                    <option value="Supplier">Supplier</option>
                    <option value="Both">Both (Supplier & Customer)</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">Phone</label>
                  <input 
                    type="text" 
                    value={partyForm.phone} 
                    onChange={e => setPartyForm({...partyForm, phone: e.target.value})} 
                    className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-blue-500" 
                    placeholder="+91..." 
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">City</label>
                  <input 
                    type="text" 
                    value={partyForm.city} 
                    onChange={e => setPartyForm({...partyForm, city: e.target.value})} 
                    className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-blue-500" 
                    placeholder="e.g. Gwalior" 
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">
                    Opening Balance (₹) <span className="text-xs font-normal text-slate-400">(Use - for payable)</span>
                  </label>
                  <input 
                    type="number" 
                    required 
                    value={partyForm.openingBalance} 
                    onChange={e => setPartyForm({...partyForm, openingBalance: e.target.value})} 
                    className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-blue-500 font-medium" 
                    placeholder="0" 
                  />
                </div>
              </div>

              <div className="pt-4 mt-2 border-t border-slate-100 flex justify-end gap-3">
                <button type="button" onClick={() => setShowPartyModal(false)} className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 rounded-xl transition">Cancel</button>
                <button type="submit" className="flex items-center gap-2 bg-blue-600 text-white px-5 py-2 rounded-xl text-sm font-semibold hover:bg-blue-700 transition shadow-sm">
                  <Save size={16}/> {editingParty ? 'Save Changes' : 'Create Party'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}