import React, { useEffect, useState } from 'react';
import { KeyRound, ShieldCheck, UserPlus, Users } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import axiosClient from '../../api/axiosClient';

const blank = { name: '', email: '', password: '', role: 'accountant' };

export default function UserManagementPage() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [form, setForm] = useState(blank);
  const [passwords, setPasswords] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await axiosClient.get('/users');
      setUsers(data.users || []);
      setError('');
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to load user accounts.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const createUser = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      const { data } = await axiosClient.post('/users', form);
      setUsers((current) => [...current, data.user]);
      setForm(blank);
      setSuccess('User account created. Share the initial password securely with the user.');
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to create user.');
    } finally {
      setSaving(false);
    }
  };

  const update = async (id, payload, message) => {
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      const { data } = await axiosClient.patch('/users/' + id, payload);
      setUsers((current) => current.map((item) => item.id === id ? data.user : item));
      setPasswords((current) => ({ ...current, [id]: '' }));
      setSuccess(message);
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to update user.');
    } finally {
      setSaving(false);
    }
  };

  const activeAdmins = users.filter((item) => item.role === 'admin' && item.isActive).length;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-slate-900">User Management</h1>
        <p className="mt-1 text-sm text-slate-500">Create staff accounts and manage access to SK Packaging ERP.</p>
      </header>
      {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      {success && <p role="status" className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700">{success}</p>}

      <form onSubmit={createUser} className="space-y-4 rounded-2xl border bg-white p-5">
        <div className="flex items-center gap-2"><UserPlus size={18} /><h2 className="font-semibold">Create staff account</h2></div>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm">Full name<input required minLength="2" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="mt-1 w-full rounded-lg border px-3 py-2" /></label>
          <label className="text-sm">Email address<input required type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="mt-1 w-full rounded-lg border px-3 py-2" /></label>
          <label className="text-sm">Initial password<input required minLength="12" maxLength="128" type="password" autoComplete="new-password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className="mt-1 w-full rounded-lg border px-3 py-2" /><span className="text-xs text-slate-500">Minimum 12 characters.</span></label>
          <label className="text-sm">Role<select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} className="mt-1 w-full rounded-lg border bg-white px-3 py-2"><option value="accountant">Accountant</option><option value="admin">Administrator</option></select></label>
        </div>
        <button disabled={saving} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{saving ? 'Saving...' : 'Create account'}</button>
      </form>

      <section className="overflow-hidden rounded-2xl border bg-white">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b p-5">
          <div className="flex items-center gap-2"><Users size={18} /><h2 className="font-semibold">Existing accounts</h2></div>
          <div className="text-sm text-slate-500">{activeAdmins} active administrator{activeAdmins === 1 ? '' : 's'}</div>
        </div>
        {loading ? <p className="p-6 text-sm text-slate-500">Loading accounts...</p> : (
          <div className="divide-y">
            {users.map((item) => <article key={item.id} className="space-y-3 p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-slate-900">{item.name} {item.id === currentUser?.id && <span className="text-xs font-normal text-slate-500">(you)</span>}</p>
                  <p className="text-sm text-slate-500">{item.email}</p>
                  <p className="mt-1 text-xs text-slate-400">Created {new Date(item.createdAt).toLocaleDateString('en-IN')}</p>
                </div>
                <span className={'rounded-full px-3 py-1 text-xs font-semibold ' + (item.isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500')}>{item.isActive ? 'Active' : 'Deactivated'}</span>
              </div>
              <div className="flex flex-wrap items-end gap-3">
                <label className="text-xs text-slate-500">Role<select value={item.role} disabled={saving} onChange={(e) => update(item.id, { role: e.target.value }, 'Role updated for ' + item.email)} className="mt-1 block rounded-lg border bg-white px-3 py-2 text-sm text-slate-800"><option value="accountant">Accountant</option><option value="admin">Administrator</option></select></label>
                <button disabled={saving || (item.id === currentUser?.id && item.isActive)} onClick={() => update(item.id, { isActive: !item.isActive }, item.isActive ? 'Account deactivated.' : 'Account activated.')} className="rounded-lg border px-3 py-2 text-sm disabled:opacity-40">{item.isActive ? 'Deactivate account' : 'Activate account'}</button>
                <div className="flex min-w-[240px] flex-1 gap-2">
                  <input type="password" autoComplete="new-password" placeholder="New password (12+ chars)" value={passwords[item.id] || ''} onChange={(e) => setPasswords((current) => ({ ...current, [item.id]: e.target.value }))} className="min-w-0 flex-1 rounded-lg border px-3 py-2 text-sm" />
                  <button type="button" disabled={saving || (passwords[item.id] || '').length < 12} onClick={() => update(item.id, { password: passwords[item.id] }, 'Password reset for ' + item.email)} className="rounded-lg border px-3 py-2 text-sm disabled:opacity-40"><KeyRound size={15} className="mr-1 inline" />Reset</button>
                </div>
              </div>
            </article>)}
            {!users.length && <p className="p-8 text-center text-sm text-slate-500">No user accounts found.</p>}
          </div>
        )}
      </section>
      <p className="text-xs text-slate-500"><ShieldCheck size={14} className="mr-1 inline" />Only administrators can manage accounts. The last active administrator cannot be demoted or deactivated. User changes are written to the audit log.</p>
    </div>
  );
}
