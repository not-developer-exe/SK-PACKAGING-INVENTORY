
import { useMemo, useState } from 'react'
import {
  LayoutDashboard,
  Layers3,
  ArrowDownToLine,
  Factory,
  Package,
  Trash2,
  ClipboardList,
  Search,
  Bell,
  ChevronDown,
  Plus,
  ArrowUpRight,
  ArrowDownRight,
  Menu,
  X,
  Boxes,
  CircleHelp,
  Settings,
  ShieldCheck,
} from 'lucide-react'

const navigation = [
  { label: 'Overview', icon: LayoutDashboard, section: 'MAIN' },
  { label: 'Reel Stock', icon: Layers3, section: 'INVENTORY' },
  { label: 'Stock Inward', icon: ArrowDownToLine, section: 'INVENTORY' },
  { label: 'Production', icon: Factory, section: 'OPERATIONS' },
  { label: 'Finished Goods', icon: Package, section: 'OPERATIONS' },
  { label: 'Waste Register', icon: Trash2, section: 'OPERATIONS' },
  { label: 'Stock Ledger', icon: ClipboardList, section: 'REPORTS' },
]

const sampleReels = [
  { id: 'RL-001', size: '18 × 24', bf: 16, gsm: 120, quality: 'Natural', reels: 12, weight: 486, status: 'In stock' },
  { id: 'RL-002', size: '20 × 30', bf: 18, gsm: 140, quality: 'Natural', reels: 8, weight: 392, status: 'In stock' },
  { id: 'RL-003', size: '18 × 24', bf: 16, gsm: 120, quality: 'GY', reels: 6, weight: 241, status: 'In stock' },
  { id: 'RL-004', size: '22 × 28', bf: 20, gsm: 150, quality: 'Natural', reels: 4, weight: 186, status: 'Low stock' },
  { id: 'RL-005', size: '20 × 30', bf: 18, gsm: 140, quality: 'GY', reels: 10, weight: 508, status: 'In stock' },
  { id: 'RL-006', size: '16 × 22', bf: 14, gsm: 100, quality: 'Natural', reels: 3, weight: 112, status: 'Low stock' },
]

const activities = [
  { title: 'Sample stock receipt', detail: 'Natural paper · 20 × 30 · BF 18', time: 'Today, 10:30 AM', type: 'inward' },
  { title: 'Sample production run', detail: 'Corrugated boxes · 1,200 pieces', time: 'Today, 9:15 AM', type: 'production' },
  { title: 'Sample waste entry', detail: 'Paper trim waste · 8.5 kg', time: 'Yesterday', type: 'waste' },
]

function MetricCard({ title, value, unit, change, direction, icon: Icon, tint }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-slate-500">{title}</p>
          <div className="mt-3 flex flex-wrap items-baseline gap-1.5">
            <span className="text-3xl font-semibold tracking-tight text-slate-900">{value}</span>
            <span className="text-sm text-slate-500">{unit}</span>
          </div>
        </div>
        <div className={`rounded-xl p-3 ${tint}`}>
          <Icon size={20} />
        </div>
      </div>
      <div className="mt-4 flex items-center gap-1.5 text-xs text-slate-500">
        {direction === 'up'
          ? <ArrowUpRight size={15} className="text-emerald-600" />
          : <ArrowDownRight size={15} className="text-amber-600" />}
        <span className="font-medium text-slate-700">{change}</span>
        <span>sample data</span>
      </div>
    </div>
  )
}

function Badge({ children, tone = 'slate' }) {
  const styles = {
    slate: 'bg-slate-100 text-slate-600',
    green: 'bg-emerald-50 text-emerald-700',
    amber: 'bg-amber-50 text-amber-700',
    blue: 'bg-blue-50 text-blue-700',
  }
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${styles[tone]}`}>
      {children}
    </span>
  )
}

function Overview({ setPage }) {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard title="Paper on hand" value="1,925" unit="kg" change="6 specifications" direction="up" icon={Layers3} tint="bg-blue-50 text-blue-700" />
        <MetricCard title="Reels available" value="43" unit="reels" change="Across all qualities" direction="up" icon={Boxes} tint="bg-violet-50 text-violet-700" />
        <MetricCard title="Finished goods" value="8,450" unit="pieces" change="Sample balance" direction="up" icon={Package} tint="bg-emerald-50 text-emerald-700" />
        <MetricCard title="Waste recorded" value="24.5" unit="kg" change="Sample entries" direction="down" icon={Trash2} tint="bg-amber-50 text-amber-700" />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.5fr_1fr]">
        <section className="rounded-2xl border border-slate-200 bg-white">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 p-5">
            <div>
              <h2 className="font-semibold text-slate-900">Reel stock overview</h2>
              <p className="mt-1 text-sm text-slate-500">Illustrative balances by paper specification</p>
            </div>
            <button onClick={() => setPage('Reel Stock')} className="text-sm font-semibold text-blue-700 hover:text-blue-800">
              View all <span aria-hidden="true">→</span>
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-5 py-3 font-medium">Specification</th>
                  <th className="px-5 py-3 font-medium">Quality</th>
                  <th className="px-5 py-3 text-right font-medium">Reels</th>
                  <th className="px-5 py-3 text-right font-medium">Weight</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {sampleReels.slice(0, 4).map((reel) => (
                  <tr key={reel.id} className="hover:bg-slate-50">
                    <td className="px-5 py-4">
                      <div className="font-medium text-slate-800">{reel.size}</div>
                      <div className="mt-1 text-xs text-slate-500">BF {reel.bf} · {reel.gsm} GSM</div>
                    </td>
                    <td className="px-5 py-4"><Badge tone={reel.quality === 'GY' ? 'blue' : 'slate'}>{reel.quality === 'GY' ? 'Golden Yellow' : reel.quality}</Badge></td>
                    <td className="px-5 py-4 text-right tabular-nums text-slate-700">{reel.reels}</td>
                    <td className="px-5 py-4 text-right font-medium tabular-nums text-slate-900">{reel.weight} kg</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white">
          <div className="border-b border-slate-100 p-5">
            <h2 className="font-semibold text-slate-900">Recent activity</h2>
            <p className="mt-1 text-sm text-slate-500">Examples of inventory events</p>
          </div>
          <div className="divide-y divide-slate-100">
            {activities.map((activity) => (
              <div key={activity.title} className="flex gap-3 p-5">
                <div className={`mt-0.5 rounded-xl p-2.5 ${activity.type === 'inward' ? 'bg-blue-50 text-blue-700' : activity.type === 'production' ? 'bg-violet-50 text-violet-700' : 'bg-amber-50 text-amber-700'}`}>
                  {activity.type === 'inward' ? <ArrowDownToLine size={18} /> : activity.type === 'production' ? <Factory size={18} /> : <Trash2 size={18} />}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-800">{activity.title}</p>
                  <p className="mt-1 text-xs text-slate-500">{activity.detail}</p>
                  <p className="mt-2 text-xs text-slate-400">{activity.time}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

      <div className="flex flex-col gap-3 rounded-2xl border border-blue-100 bg-blue-50/70 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-3">
          <ShieldCheck className="mt-0.5 shrink-0 text-blue-700" size={21} />
          <div>
            <h3 className="font-semibold text-slate-900">Development mode</h3>
            <p className="mt-1 text-sm text-slate-600">All figures are illustrative. No live stock transactions have been made.</p>
          </div>
        </div>
        <Badge tone="blue">Sample data only</Badge>
      </div>
    </div>
  )
}



function ReelStock() {
  const [reels, setReels] = useState(sampleReels);
  const [search, setSearch] = useState('');
  const [quality, setQuality] = useState('All qualities');
  const [showAddForm, setShowAddForm] = useState(false);
  const [formError, setFormError] = useState('');

  const initialForm = {
    size: '',
    bf: '',
    gsm: '',
    quality: 'Natural',
    reelQty: '',
    weight: '',
  };

  const [form, setForm] = useState(initialForm);

  const totalReels = reels.reduce(
    (total, item) => total + Number(item.reels || 0),
    0
  );

  const totalWeight = reels.reduce(
    (total, item) => total + Number(item.weight || 0),
    0
  );

  const lowStockCount = reels.filter(
    (item) => Number(item.reels) <= 3
  ).length;

  const filteredReels = useMemo(() => {
    const query = search.trim().toLowerCase();

    return reels.filter((item) => {
      const matchesQuality =
        quality === 'All qualities' || item.quality === quality;

      const searchableText = [
        item.id,
        item.size,
        item.bf,
        item.gsm,
        item.quality,
        item.quality === 'GY' ? 'Golden Yellow' : '',
      ]
        .join(' ')
        .toLowerCase();

      const matchesSearch =
        !query || searchableText.includes(query);

      return matchesQuality && matchesSearch;
    });
  }, [reels, search, quality]);

  const openAddForm = () => {
    setForm(initialForm);
    setFormError('');
    setShowAddForm(true);
  };

  const closeAddForm = () => {
    setShowAddForm(false);
    setFormError('');
  };

  const handleAddSpecification = (event) => {
    event.preventDefault();
    setFormError('');

    const size = form.size.trim();
    const bf = Number(form.bf);
    const gsm = Number(form.gsm);
    const reelQty = Number(form.reelQty);
    const weight = Number(form.weight);

    if (!size || !form.bf || !form.gsm ||
        !form.reelQty || !form.weight) {
      setFormError('Please fill in all fields.');
      return;
    }

    if (
      !Number.isFinite(bf) ||
      !Number.isFinite(gsm) ||
      !Number.isFinite(reelQty) ||
      !Number.isFinite(weight) ||
      bf <= 0 ||
      gsm <= 0 ||
      reelQty <= 0 ||
      weight <= 0 ||
      !Number.isInteger(reelQty)
    ) {
      setFormError(
        'Enter valid positive values. Reel quantity must be a whole number.'
      );
      return;
    }

    const duplicate = reels.some(
      (item) =>
        item.size.trim().toLowerCase() === size.toLowerCase() &&
        Number(item.bf) === bf &&
        Number(item.gsm) === gsm &&
        item.quality === form.quality
    );

    if (duplicate) {
      setFormError(
        'This specification already exists. Natural and GY are treated separately.'
      );
      return;
    }

    const nextNumber =
      reels.reduce((max, item) => {
        const match = String(item.id).match(/(\d+)$/);
        return match ? Math.max(max, Number(match[1])) : max;
      }, 0) + 1;

    const newReel = {
      id: `SPEC-${String(nextNumber).padStart(3, '0')}`,
      size,
      bf,
      gsm,
      quality: form.quality,
      reels: reelQty,
      weight,
      status: reelQty <= 3 ? 'Low stock' : 'In stock',
    };

    setReels((current) => [...current, newReel]);
    setSearch('');
    setQuality('All qualities');
    setShowAddForm(false);
    setForm(initialForm);
    setFormError('');
  };

  const updateForm = (field, value) => {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  };

  const qualityFilters = [
    { label: 'All', value: 'All qualities' },
    { label: 'Natural', value: 'Natural' },
    { label: 'Golden Yellow (GY)', value: 'GY' },
  ];

  return (
    <div className="space-y-6">
      {/* Page heading */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Reel Stock
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Manage paper specifications, reel quantities and available weight.
          </p>
        </div>

        <button
          type="button"
          onClick={openAddForm}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-800"
        >
          <Plus size={17} />
          Add specification
        </button>
      </div>

      {/* Demo mode notice */}
      <div className="flex gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
        <ShieldCheck
          size={20}
          className="mt-0.5 shrink-0 text-amber-700"
        />
        <div>
          <p className="text-sm font-semibold text-amber-900">
            DEMO MODE
          </p>
          <p className="mt-1 text-sm text-amber-800">
            Changes are held in browser memory only. They are not saved
            to Supabase and will reset when the page reloads.
          </p>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <p className="text-sm font-medium text-slate-500">
            Total specifications
          </p>
          <p className="mt-2 text-2xl font-bold text-slate-900">
            {reels.length}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Distinct paper specifications
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <p className="text-sm font-medium text-slate-500">
            Reels available
          </p>
          <p className="mt-2 text-2xl font-bold text-slate-900">
            {totalReels.toLocaleString('en-IN')}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Total reel quantity
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <p className="text-sm font-medium text-slate-500">
            Paper weight on hand
          </p>
          <p className="mt-2 text-2xl font-bold text-slate-900">
            {totalWeight.toLocaleString('en-IN', {
              maximumFractionDigits: 2,
            })}{' '}
            <span className="text-base font-medium text-slate-500">
              kg
            </span>
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Combined recorded weight
          </p>
        </div>
      </div>

      {/* Stock table and filters */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <div className="flex flex-col gap-1 border-b border-slate-100 p-5">
          <h2 className="text-base font-semibold text-slate-900">
            Paper specifications
          </h2>
          <p className="text-sm text-slate-500">
            Search and filter your paper stock by specification and quality.
          </p>
        </div>

        {/* Search and filters */}
        <div className="space-y-3 border-b border-slate-100 p-4">
          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="relative flex-1">
              <Search
                size={17}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                type="text"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search code, size, BF, GSM or quality..."
                aria-label="Search paper specifications"
                className="w-full rounded-xl border border-slate-200 py-2.5 pl-10 pr-3 text-sm outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
              />
            </div>

            <select
              value={quality}
              onChange={(event) => setQuality(event.target.value)}
              aria-label="Filter by paper quality"
              className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-blue-400"
            >
              <option value="All qualities">All qualities</option>
              <option value="Natural">Natural</option>
              <option value="GY">Golden Yellow (GY)</option>
            </select>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="mr-1 text-xs font-medium text-slate-500">
              Paper quality:
            </span>

            {qualityFilters.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setQuality(option.value)}
                aria-pressed={quality === option.value}
                className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                  quality === option.value
                    ? 'border-blue-700 bg-blue-700 text-white'
                    : 'border-slate-200 bg-white text-slate-600 hover:border-blue-300 hover:bg-blue-50'
                }`}
              >
                {option.label}
              </button>
            ))}

            {(search || quality !== 'All qualities') && (
              <button
                type="button"
                onClick={() => {
                  setSearch('');
                  setQuality('All qualities');
                }}
                className="ml-auto text-xs font-medium text-blue-700 hover:text-blue-900"
              >
                Clear filters
              </button>
            )}
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-5 py-3 font-semibold">Item code</th>
                <th className="px-5 py-3 font-semibold">Size</th>
                <th className="px-5 py-3 font-semibold">BF</th>
                <th className="px-5 py-3 font-semibold">GSM</th>
                <th className="px-5 py-3 font-semibold">Quality</th>
                <th className="px-5 py-3 text-right font-semibold">
                  Reels
                </th>
                <th className="px-5 py-3 text-right font-semibold">
                  Weight (kg)
                </th>
                <th className="px-5 py-3 font-semibold">Status</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100">
              {filteredReels.map((item) => (
                <tr
                  key={item.id}
                  className="transition hover:bg-slate-50"
                >
                  <td className="whitespace-nowrap px-5 py-4 font-medium text-slate-900">
                    {item.id}
                  </td>

                  <td className="whitespace-nowrap px-5 py-4 text-slate-700">
                    {item.size}
                  </td>

                  <td className="px-5 py-4 text-slate-700">
                    {item.bf}
                  </td>

                  <td className="px-5 py-4 text-slate-700">
                    {item.gsm}
                  </td>

                  <td className="px-5 py-4">
                    <span
                      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${
                        item.quality === 'GY'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-slate-100 text-slate-700'
                      }`}
                    >
                      {item.quality === 'GY'
                        ? 'Golden Yellow (GY)'
                        : item.quality}
                    </span>
                  </td>

                  <td className="px-5 py-4 text-right tabular-nums text-slate-700">
                    {Number(item.reels).toLocaleString('en-IN')}
                  </td>

                  <td className="px-5 py-4 text-right tabular-nums text-slate-700">
                    {Number(item.weight).toLocaleString('en-IN', {
                      maximumFractionDigits: 2,
                    })}
                  </td>

                  <td className="px-5 py-4">
                    <span
                      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${
                        Number(item.reels) <= 3
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-emerald-100 text-emerald-800'
                      }`}
                    >
                      {Number(item.reels) <= 3
                        ? 'Low stock'
                        : 'In stock'}
                    </span>
                  </td>
                </tr>
              ))}

              {filteredReels.length === 0 && (
                <tr>
                  <td
                    colSpan={8}
                    className="px-5 py-12 text-center"
                  >
                    <p className="font-medium text-slate-700">
                      No matching specifications found
                    </p>
                    <p className="mt-1 text-sm text-slate-500">
                      Try another search or clear your filters.
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        setSearch('');
                        setQuality('All qualities');
                      }}
                      className="mt-3 text-sm font-semibold text-blue-700 hover:text-blue-900"
                    >
                      Clear filters
                    </button>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Table footer */}
        <div className="flex flex-col gap-1 border-t border-slate-100 px-5 py-3 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between">
          <span>
            Showing {filteredReels.length} of {reels.length} specifications
          </span>
          <span>
            Low-stock threshold: 3 reels or fewer (demo rule)
          </span>
        </div>
      </div>

      {/* Add specification modal */}
      {showAddForm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/40 p-4"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              closeAddForm();
            }
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="add-specification-title"
            className="my-auto w-full max-w-lg rounded-2xl bg-white shadow-xl"
          >
            <div className="flex items-center justify-between border-b border-slate-100 p-5">
              <div>
                <h2
                  id="add-specification-title"
                  className="text-lg font-semibold text-slate-900"
                >
                  Add paper specification
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Add a demo specification and its initial quantity.
                </p>
              </div>

              <button
                type="button"
                onClick={closeAddForm}
                aria-label="Close form"
                className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleAddSpecification} className="space-y-4 p-5">
              <div>
                <label
                  htmlFor="paper-size"
                  className="mb-1.5 block text-sm font-medium text-slate-700"
                >
                  Paper size
                </label>
                <input
                  id="paper-size"
                  type="text"
                  value={form.size}
                  onChange={(event) => updateForm('size', event.target.value)}
                  placeholder="e.g. 18 × 24"
                  required
                  className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label
                    htmlFor="paper-bf"
                    className="mb-1.5 block text-sm font-medium text-slate-700"
                  >
                    BF
                  </label>
                  <input
                    id="paper-bf"
                    type="number"
                    min="1"
                    step="any"
                    value={form.bf}
                    onChange={(event) => updateForm('bf', event.target.value)}
                    placeholder="e.g. 16"
                    required
                    className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                  />
                </div>

                <div>
                  <label
                    htmlFor="paper-gsm"
                    className="mb-1.5 block text-sm font-medium text-slate-700"
                  >
                    GSM
                  </label>
                  <input
                    id="paper-gsm"
                    type="number"
                    min="1"
                    step="any"
                    value={form.gsm}
                    onChange={(event) => updateForm('gsm', event.target.value)}
                    placeholder="e.g. 120"
                    required
                    className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="paper-quality"
                  className="mb-1.5 block text-sm font-medium text-slate-700"
                >
                  Paper quality
                </label>
                <select
                  id="paper-quality"
                  value={form.quality}
                  onChange={(event) =>
                    updateForm('quality', event.target.value)
                  }
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                >
                  <option value="Natural">Natural</option>
                  <option value="GY">Golden Yellow (GY)</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label
                    htmlFor="reel-quantity"
                    className="mb-1.5 block text-sm font-medium text-slate-700"
                  >
                    Reel quantity
                  </label>
                  <input
                    id="reel-quantity"
                    type="number"
                    min="1"
                    step="1"
                    value={form.reelQty}
                    onChange={(event) =>
                      updateForm('reelQty', event.target.value)
                    }
                    placeholder="e.g. 5"
                    required
                    className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                  />
                </div>

                <div>
                  <label
                    htmlFor="reel-weight"
                    className="mb-1.5 block text-sm font-medium text-slate-700"
                  >
                    Total weight (kg)
                  </label>
                  <input
                    id="reel-weight"
                    type="number"
                    min="0.01"
                    step="any"
                    value={form.weight}
                    onChange={(event) =>
                      updateForm('weight', event.target.value)
                    }
                    placeholder="e.g. 205"
                    required
                    className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                  />
                </div>
              </div>

              {formError && (
                <p
                  role="alert"
                  className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700"
                >
                  {formError}
                </p>
              )}

              <div className="flex justify-end gap-3 border-t border-slate-100 pt-4">
                <button
                  type="button"
                  onClick={closeAddForm}
                  className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="rounded-xl bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-800"
                >
                  Add specification
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}



export default function App() {
  const [page, setPage] = useState('Overview')
  const [mobileNavOpen, setMobileNavOpen] = useState(false)

  const pageDescriptions = {
    Overview: 'A quick view of your inventory and operations.',
    'Reel Stock': 'Track paper specifications, reel counts and remaining weight.',
    'Stock Inward': 'Record paper received from suppliers.',
    Production: 'Track production runs and paper consumption.',
    'Finished Goods': 'Monitor finished box quantities.',
    'Waste Register': 'Record and reconcile production waste.',
    'Stock Ledger': 'Review inventory movements and transaction history.',
  }

  function selectPage(label) {
    setPage(label)
    setMobileNavOpen(false)
  }

  function SidebarContent() {
    let currentSection = ''
    return (
      <>
        <div className="flex h-[76px] items-center gap-3 border-b border-slate-800 px-5">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-white">
            <Boxes size={22} />
          </div>
          <div>
            <p className="font-semibold tracking-tight text-white">SK Packaging</p>
            <p className="mt-0.5 text-xs text-slate-400">Inventory management</p>
          </div>
        </div>
        <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-5">
          {navigation.map((item) => {
            const Icon = item.icon
            const showSection = currentSection !== item.section
            currentSection = item.section
            return (
              <div key={item.label}>
                {showSection && <p className="mb-2 px-3 text-[10px] font-semibold tracking-[0.16em] text-slate-500">{item.section}</p>}
                <button onClick={() => selectPage(item.label)} className={`mb-1 flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition ${page === item.label ? 'bg-blue-600 font-medium text-white' : 'text-slate-300 hover:bg-slate-800 hover:text-white'}`}>
                  <Icon size={18} />
                  <span>{item.label}</span>
                  {page === item.label && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-white" />}
                </button>
              </div>
            )
          })}
        </nav>
        <div className="border-t border-slate-800 p-3">
          <div className="mb-3 flex items-center gap-3 rounded-xl px-3 py-3 text-slate-300">
            <CircleHelp size={18} />
            <span className="text-sm">Help & support</span>
          </div>
          <div className="flex items-center gap-3 rounded-xl bg-slate-800/80 p-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-100 text-sm font-semibold text-blue-800">SK</div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-white">Development user</p>
              <p className="text-xs text-slate-400">Sample workspace</p>
            </div>
            <Settings size={16} className="text-slate-400" />
          </div>
        </div>
      </>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {mobileNavOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button aria-label="Close navigation overlay" onClick={() => setMobileNavOpen(false)} className="absolute inset-0 bg-slate-950/50" />
          <aside className="relative flex h-full w-[280px] flex-col bg-slate-950">
            <button aria-label="Close navigation" onClick={() => setMobileNavOpen(false)} className="absolute right-3 top-6 z-10 rounded-lg p-2 text-slate-300 hover:bg-slate-800"><X size={18} /></button>
            <SidebarContent />
          </aside>
        </div>
      )}

      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[250px] flex-col bg-slate-950 lg:flex">
        <SidebarContent />
      </aside>

      <div className="min-h-screen lg:pl-[250px]">
        <header className="sticky top-0 z-20 flex h-[76px] items-center justify-between border-b border-slate-200 bg-white/95 px-4 backdrop-blur sm:px-7">
          <div className="flex min-w-0 items-center gap-3">
            <button onClick={() => setMobileNavOpen(true)} aria-label="Open navigation" className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 lg:hidden"><Menu size={20} /></button>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="truncate text-lg font-semibold tracking-tight text-slate-900">{page}</h1>
                <Badge tone="blue">DEMO</Badge>
              </div>
              <p className="hidden truncate text-xs text-slate-500 sm:block">SK Packaging / {page}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 sm:gap-4">
            <div className="hidden text-right sm:block">
              <p className="text-xs font-medium text-slate-700">Development workspace</p>
              <p className="mt-0.5 text-[11px] text-slate-400">Sample data only</p>
            </div>
            <button aria-label="Notifications" className="relative rounded-xl border border-slate-200 p-2.5 text-slate-600 hover:bg-slate-50">
              <Bell size={18} />
              <span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-blue-600" />
            </button>
            <button className="hidden items-center gap-1 rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-600 sm:flex">
              Demo <ChevronDown size={15} />
            </button>
          </div>
        </header>

        <main className="mx-auto max-w-[1600px] space-y-6 p-4 sm:p-7">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
            <div>
              <p className="text-sm font-medium text-blue-700">SK PACKAGING INVENTORY</p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">{page === 'Overview' ? 'Good morning' : page}</h2>
              <p className="mt-2 text-sm text-slate-500">{pageDescriptions[page]}</p>
            </div>
            <div className="flex items-center gap-2 self-start rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 sm:self-auto">
              <span className="h-2 w-2 rounded-full bg-amber-400" />
              Development mode
            </div>
          </div>

          {page === 'Overview' ? (
            <Overview setPage={setPage} />
          ) : page === 'Reel Stock' ? (
            <ReelStock />
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-500">
                {page === 'Stock Inward' ? <ArrowDownToLine size={25} /> : page === 'Production' ? <Factory size={25} /> : page === 'Finished Goods' ? <Package size={25} /> : page === 'Waste Register' ? <Trash2 size={25} /> : <ClipboardList size={25} />}
              </div>
              <h3 className="mt-4 text-lg font-semibold text-slate-900">{page} module</h3>
              <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">This screen is planned for a later development stage. No live inventory actions are available here yet.</p>
              <Badge tone="blue">Not implemented yet</Badge>
            </div>
          )}

          <footer className="flex flex-col gap-2 border-t border-slate-200 pt-5 text-xs text-slate-400 sm:flex-row sm:items-center sm:justify-between">
            <span>© SK Packaging Inventory · Development build</span>
            <span>Inventory figures shown are illustrative only.</span>
          </footer>
        </main>
      </div>
    </div>
  )
}
