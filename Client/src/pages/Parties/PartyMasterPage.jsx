import React, { useState, useEffect } from 'react';
import { partiesService } from '../../services/partiesService';
import { Users, Plus, Loader2 } from 'lucide-react';

export default function PartyMasterPage() {
  const [parties, setParties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  
  // Form State
  const [name, setName] = useState('');
  const [partyType, setPartyType] = useState('customer');
  const [gstin, setGstin] = useState('');
  const [phone, setPhone] = useState('');

  const fetchParties = async () => {
    try {
      setLoading(true);
      const data = await partiesService.getAllParties();
      setParties(data);
    } catch (err) {
      console.error('Error loading parties:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchParties();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await partiesService.createParty({ name, partyType, gstin, phone });
      setName('');
      setGstin('');
      setPhone('');
      fetchParties();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to create party');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div className="flex h-64 items-center justify-center"><Loader2 className="animate-spin text-blue-600" size={32} /></div>;

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Party Master</h1>
        <p className="mt-1 text-sm text-slate-500">Manage your suppliers and customers.</p>
      </div>

      {/* Create Party Form */}
      <form onSubmit={handleSubmit} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="mb-4 text-sm font-semibold text-slate-900">Add New Party</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-5">
          <div className="md:col-span-2">
            <input type="text" required placeholder="Company Name *" value={name} onChange={e => setName(e.target.value)} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-400" />
          </div>
          <div>
            <select value={partyType} onChange={e => setPartyType(e.target.value)} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-400 bg-white">
              <option value="customer">Customer</option>
              <option value="supplier">Supplier</option>
              <option value="both">Both</option>
            </select>
          </div>
          <div>
            <input type="text" placeholder="GSTIN" value={gstin} onChange={e => setGstin(e.target.value)} className="w-full uppercase rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-400" />
          </div>
          <div>
            <button type="submit" disabled={submitting} className="w-full inline-flex items-center justify-center gap-1.5 rounded-xl bg-blue-700 px-3 py-2 text-sm font-semibold text-white transition hover:bg-blue-800 disabled:opacity-70">
              {submitting ? <Loader2 className="animate-spin" size={16} /> : <><Plus size={16} /> Add</>}
            </button>
          </div>
        </div>
      </form>

      {/* Directory Table */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-5 py-3 font-semibold">Name</th>
              <th className="px-5 py-3 font-semibold">Type</th>
              <th className="px-5 py-3 font-semibold">GSTIN</th>
              <th className="px-5 py-3 font-semibold">Phone</th>
              <th className="px-5 py-3 font-semibold">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {parties.map((party) => (
              <tr key={party._id} className="hover:bg-slate-50">
                <td className="px-5 py-4 font-medium text-slate-900">{party.name}</td>
                <td className="px-5 py-4">
                  <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${
                    party.partyType === 'supplier' ? 'bg-amber-100 text-amber-800' : 
                    party.partyType === 'customer' ? 'bg-emerald-100 text-emerald-800' : 
                    'bg-blue-100 text-blue-800'
                  }`}>
                    {party.partyType.toUpperCase()}
                  </span>
                </td>
                <td className="px-5 py-4 text-slate-700">{party.gstin || '-'}</td>
                <td className="px-5 py-4 text-slate-700">{party.phone || '-'}</td>
                <td className="px-5 py-4">
                  <span className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${party.isActive ? 'text-emerald-600' : 'text-red-600'}`}>
                    {party.isActive ? 'Active' : 'Inactive'}
                  </span>
                </td>
              </tr>
            ))}
            {parties.length === 0 && (
              <tr>
                <td colSpan={5} className="px-5 py-8 text-center text-slate-500">No parties registered yet.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}