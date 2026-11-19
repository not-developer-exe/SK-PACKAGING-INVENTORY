import React from 'react';
import { Link } from 'react-router-dom';
import { Building2, Wallet, Package, Receipt, Users, ShieldCheck } from 'lucide-react';

const metrics = [
  { title: 'Sales & Income', detail: 'NSB invoices and receipts', icon: Wallet },
  { title: 'Expenses', detail: 'NSB business expenses', icon: Receipt },
  { title: 'Stock & Purchases', detail: 'NSB-owned material and goods', icon: Package },
  { title: 'Customer & Supplier Dues', detail: 'NSB receivables and payables', icon: Users }
];

export default function NSBOverviewPage() {
  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <section className="rounded-2xl border border-slate-200 bg-gradient-to-r from-slate-900 to-slate-700 p-6 text-white sm:p-8">
        <div className="flex items-center gap-3 text-blue-200"><Building2 size={22} /><span className="text-sm font-semibold">Separate Business Workspace</span></div>
        <h1 className="mt-3 text-2xl font-bold sm:text-3xl">NSB Industrial Solutions</h1>
        <p className="mt-2 max-w-2xl text-sm text-slate-300">A dedicated place for NSB sales, expenses, stock, outstanding payments and business performance.</p>
      </section>

      <section className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        <div className="flex items-center gap-2 font-semibold"><ShieldCheck size={17} /> Separate accounts are being set up</div>
        <p className="mt-1">NSB figures are not connected yet. Existing records belong to S.K Packaging and are deliberately not shown here. No S.K balances or transactions are being reused as NSB data.</p>
      </section>

      <div>
        <h2 className="text-lg font-semibold text-slate-900">NSB business summary</h2>
        <p className="mt-1 text-sm text-slate-500">These sections will show live figures after separate NSB records and company-wise accounting are connected.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {metrics.map(({ title, detail, icon: Icon }) => (
          <article key={title} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-3"><span className="rounded-lg bg-blue-50 p-2 text-blue-700"><Icon size={19} /></span><h3 className="font-semibold text-slate-900">{title}</h3></div>
            {title === 'Expenses' ? <Link to="/nsb/expenses" className="mt-5 inline-flex text-sm font-semibold text-blue-700 hover:underline">Open expense register</Link> : title === 'Sales & Income' ? <Link to="/nsb/sales" className="mt-5 inline-flex text-sm font-semibold text-blue-700 hover:underline">Open NSB invoices</Link> : <p className="mt-5 text-xl font-semibold text-slate-400">Not connected</p>}
            <p className="mt-1 text-xs text-slate-500">{detail}</p>
          </article>
        ))}
      </div>
    </div>
  );
}
