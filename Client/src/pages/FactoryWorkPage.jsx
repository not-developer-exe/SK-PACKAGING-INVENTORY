import React from 'react';
import { Link } from 'react-router-dom';
import { Factory, Layers, Printer, Scissors, PackageCheck, Truck, Recycle, ClipboardList } from 'lucide-react';

const steps = [
  { title: 'Corrugation & Sheet Cutting', detail: 'Use reels to make corrugated sheets and record sheet sizes and quantities.', path: '/operations/production', icon: Factory },
  { title: 'Printing & Pasting', detail: 'Record in-house pasting and receive pre-cut facing or duplex material.', path: '/operations/pasting', icon: Layers },
  { title: 'Outside Printing', detail: 'Send duplex or other sheets to an outside printer and record returned quantities.', path: '/operations/job-work', icon: Printer },
  { title: 'Sheet Cutting & Box Making', detail: 'Record final sheet conversion and finished box production.', path: '/operations/conversion', icon: Scissors },
  { title: 'Finished Goods', detail: 'See total boxes, box-wise stock and inspection status.', path: '/operations/finished-goods', icon: PackageCheck },
  { title: 'Dispatch', detail: 'Create delivery challans and review dispatch history.', path: '/operations/dispatch', icon: Truck },
  { title: 'Scrap & Thak Sale', detail: 'Record scrap lots only when they are sold.', path: '/operations/waste', icon: Recycle },
  { title: 'Production Plans & Reports', detail: 'Review planned jobs, production progress and reports.', path: '/operations/production-intelligence', icon: ClipboardList }
];

export default function FactoryWorkPage() {
  return <div className="mx-auto max-w-6xl space-y-6">
    <header><h1 className="text-2xl font-bold tracking-tight text-slate-900">Factory Work</h1><p className="mt-1 text-sm text-slate-500">Follow the material from corrugation through finished boxes and dispatch. Choose the activity you need.</p></header>
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {steps.map(({title,detail,path,icon:Icon}) => <Link key={path} to={path} className="group rounded-xl border border-slate-200 bg-white p-4 transition hover:border-blue-300 hover:shadow-sm">
        <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100 text-slate-700 group-hover:bg-blue-50 group-hover:text-blue-700"><Icon size={20}/></div>
        <h2 className="font-semibold text-slate-900">{title}</h2><p className="mt-1 text-sm leading-5 text-slate-500">{detail}</p><span className="mt-3 inline-block text-sm font-medium text-blue-700">Open activity →</span>
      </Link>)}
    </div>
  </div>;
}
