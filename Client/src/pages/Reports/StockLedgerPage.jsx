import React, { useEffect, useMemo, useState } from 'react';
import {
  Package, Layers, Boxes, FileSpreadsheet, ClipboardList, Search, ChevronDown,
  ChevronRight, RefreshCw, CalendarDays, Loader2, ArrowDownRight, ArrowUpRight,
  BookOpen, Factory, Warehouse, PackageOpen
} from 'lucide-react';
import { inventoryService } from '../../services/inventoryService';
import { ledgerService } from '../../services/ledgerService';
import DateRangeFilter from '../../components/DateRangeFilter';

const number = value => Number(value?.$numberDecimal ?? value ?? 0);
const qty = value => number(value).toLocaleString('en-IN', { maximumFractionDigits: 3 });
const weight = value => number(value).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const shortDate = value => value ? new Date(value).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
const materialLabel = value => ({
  printed: 'Printed',
  printed_laminated: 'Printed + laminated',
  khaki: 'Khaki',
  duplex: 'Duplex'
}[value] || String(value || 'Other').replaceAll('_', ' '));
const groupBy = (rows, keyFor, labelFor) => {
  const grouped = new Map();
  rows.forEach(row => {
    const key = keyFor(row);
    if (!grouped.has(key)) grouped.set(key, { key, label: labelFor(row), rows: [] });
    grouped.get(key).rows.push(row);
  });
  return Array.from(grouped.values()).sort((a, b) => a.label.localeCompare(b.label, undefined, { numeric: true }));
};

export default function StockLedgerPage() {
  const [tab, setTab] = useState('stock');
  const [stock, setStock] = useState({ reels: [], corrugatedSheets: [], cutSheetBatches: [], facingMaterials: [], finishedGoods: [], rawMaterials: [] });
  const [stockLoading, setStockLoading] = useState(true);
  const [stockError, setStockError] = useState('');
  const [search, setSearch] = useState('');
  const [expandedSections, setExpandedSections] = useState({});
  const [expandedGroups, setExpandedGroups] = useState({});
  const [movements, setMovements] = useState([]);
  const [movementLoading, setMovementLoading] = useState(false);
  const [movementLoaded, setMovementLoaded] = useState(false);
  const [movementError, setMovementError] = useState('');
  const [filter, setFilter] = useState('all');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const loadStock = async () => {
    setStockLoading(true);
    setStockError('');
    try {
      const data = await inventoryService.getStockRegisterOverview();
      setStock(data || {});
    } catch (error) {
      setStockError(error.response?.data?.message || error.message || 'Unable to load live stock register.');
    } finally {
      setStockLoading(false);
    }
  };

  const loadMovements = async (params = {}) => {
    setMovementLoading(true);
    setMovementError('');
    try {
      setMovements(await ledgerService.getLedger(params));
      setMovementLoaded(true);
    } catch (error) {
      setMovementError(error.response?.data?.message || error.message || 'Unable to load movement history.');
    } finally {
      setMovementLoading(false);
    }
  };

  useEffect(() => { loadStock(); }, []);
  useEffect(() => {
    if (tab === 'movements' && !movementLoaded) loadMovements();
  }, [tab, movementLoaded]);

  const query = search.trim().toLowerCase();
  const matches = (row, values) => !query || values.some(value => String(value ?? '').toLowerCase().includes(query));

  const sections = useMemo(() => {
    const reels = (stock.reels || []).filter(row => matches(row, [row.reelCode, row.reelWidthInches, row.bf, row.gsm, row.quality, row.supplierId?.name, row.batchReference]));
    const corrugated = (stock.corrugatedSheets || []).filter(row => matches(row, [row.ply, row.lengthInches, row.widthInches, row.productionRunId?.runNumber, row.pastingRunId?.runNumber]));
    const cutSheets = (stock.cutSheetBatches || []).filter(row => matches(row, [row.batchNumber, row.lengthInches, row.widthInches, ...(row.sourceReels || []).map(item => item.reelCode)]));
    const facing = (stock.facingMaterials || []).filter(row => matches(row, [materialLabel(row.materialType), row.batchNumber, row.lengthInches, row.widthInches, row.supplierName]));
    const finished = (stock.finishedGoods || []).filter(row => matches(row, [row.batchNumber, row.itemName, row.customerId?.name, row.ply, row.dimensions?.length, row.dimensions?.width, row.dimensions?.height]));
    const raw = (stock.rawMaterials || []).filter(row => matches(row, [row.code, row.name, row.category, row.uom]));

    const reelGroups = groupBy(reels, row => [row.reelWidthInches, row.bf, row.gsm, row.quality].join('|'),
      row => row.reelWidthInches + ' inch · BF ' + row.bf + ' · ' + row.gsm + ' GSM · ' + row.quality);
    reelGroups.forEach(group => {
      group.quantity = group.rows.length;
      group.weightKg = group.rows.reduce((sum, row) => sum + number(row.remainingWeightKg), 0);
    });

    const corrugatedGroups = groupBy(corrugated, row => [row.ply, row.lengthInches, row.widthInches].join('|'),
      row => row.ply + '-ply · ' + row.lengthInches + ' × ' + row.widthInches + ' in');
    corrugatedGroups.forEach(group => {
      group.quantity = group.rows.reduce((sum, row) => sum + Number(row.sheetCount || 0), 0);
      group.weightKg = group.rows.reduce((sum, row) => sum + number(row.totalWeightKg), 0);
    });

    const cutGroups = groupBy(cutSheets, row => [row.lengthInches, row.widthInches].join('|'),
      row => row.lengthInches + ' × ' + row.widthInches + ' in cut sheets');
    cutGroups.forEach(group => {
      group.quantity = group.rows.reduce((sum, row) => sum + Number(row.remainingSheets || 0), 0);
      group.weightKg = group.rows.reduce((sum, row) => sum + number(row.remainingWeightKg), 0);
    });

    const facingGroups = groupBy(facing, row => [row.materialType, row.lengthInches, row.widthInches].join('|'),
      row => materialLabel(row.materialType) + ' · ' + row.lengthInches + ' × ' + row.widthInches + ' in');
    facingGroups.forEach(group => {
      group.quantity = group.rows.reduce((sum, row) => sum + Number(row.remainingSheets || 0), 0);
      group.weightKg = group.rows.reduce((sum, row) => sum + number(row.remainingWeightKg), 0);
    });

    const boxGroups = groupBy(finished, row => [
      row.customerId?._id || row.customerId || '', row.itemName, row.ply,
      row.dimensions?.length, row.dimensions?.width, row.dimensions?.height
    ].join('|'), row => (row.itemName || 'Unnamed product') + ' · ' + (row.customerId?.name || 'No customer') + ' · ' + row.ply + '-ply');
    boxGroups.forEach(group => {
      group.quantity = group.rows.reduce((sum, row) => sum + Number(row.quantityAvailable || 0), 0);
      group.weightKg = 0;
      group.subLabel = group.rows[0]?.dimensions
        ? [group.rows[0].dimensions.length, group.rows[0].dimensions.width, group.rows[0].dimensions.height].join(' × ') + ' in'
        : '';
    });

    const rawGroups = groupBy(raw, row => row.category || 'other', row => String(row.category || 'Other').replaceAll('_', ' '));
    rawGroups.forEach(group => {
      group.quantity = group.rows.length;
      group.weightKg = 0;
    });

    return [
      {
        key: 'reels', title: 'Reel stock', description: 'Individual paper reels grouped by width, BF, GSM and quality.',
        icon: Package, groups: reelGroups, totalQuantity: reels.length,
        totalWeight: reels.reduce((sum, row) => sum + number(row.remainingWeightKg), 0),
        quantityLabel: 'reels', weightLabel: 'remaining paper'
      },
      {
        key: 'corrugated', title: 'Intermediate corrugated sheets', description: 'Sheets currently available from corrugation and pasting.',
        icon: Layers, groups: corrugatedGroups, totalQuantity: corrugated.reduce((sum, row) => sum + Number(row.sheetCount || 0), 0),
        totalWeight: corrugated.reduce((sum, row) => sum + number(row.totalWeightKg), 0),
        quantityLabel: 'sheets', weightLabel: 'remaining weight'
      },
      {
        key: 'cutSheets', title: 'Reel-cut sheet batches', description: 'Pre-cut sheet batches produced by the in-house reel cutter.',
        icon: FileSpreadsheet, groups: cutGroups, totalQuantity: cutSheets.reduce((sum, row) => sum + Number(row.remainingSheets || 0), 0),
        totalWeight: cutSheets.reduce((sum, row) => sum + number(row.remainingWeightKg), 0),
        quantityLabel: 'sheets', weightLabel: 'remaining weight'
      },
      {
        key: 'facing', title: 'Printed, khaki & Duplex sheets', description: 'Pre-cut facing material, shown separately by material type and sheet size.',
        icon: ClipboardList, groups: facingGroups, totalQuantity: facing.reduce((sum, row) => sum + Number(row.remainingSheets || 0), 0),
        totalWeight: facing.reduce((sum, row) => sum + number(row.remainingWeightKg), 0),
        quantityLabel: 'sheets', weightLabel: 'remaining weight'
      },
      {
        key: 'finished', title: 'Finished boxes', description: 'Box batches grouped by product, customer and ply specification.',
        icon: Boxes, groups: boxGroups, totalQuantity: finished.reduce((sum, row) => sum + Number(row.quantityAvailable || 0), 0),
        totalWeight: 0, quantityLabel: 'boxes', weightLabel: ''
      },
      {
        key: 'raw', title: 'Raw materials & consumables', description: 'Glue and other factory consumables with live balances.',
        icon: Warehouse, groups: rawGroups, totalQuantity: raw.length,
        totalWeight: 0, quantityLabel: 'items', weightLabel: ''
      }
    ];
  }, [stock, query]);

  const toggleSection = key => setExpandedSections(current => ({ ...current, [key]: !current[key] }));
  const toggleGroup = key => setExpandedGroups(current => ({ ...current, [key]: !current[key] }));

  const movementFiltered = movements.filter(row => {
    if (filter === 'all') return true;
    if (filter === 'inward') return row.movementType === 'inward_receipt';
    if (filter === 'production') return ['production_issue', 'sheet_cutting', 'sheet_pasting'].includes(row.movementType);
    if (filter === 'conversion') return ['adjustment', 'dispatch'].includes(row.movementType);
    return true;
  });

  const renderGroupDetails = (sectionKey, group) => {
    if (sectionKey === 'reels') return (
      <div className="overflow-x-auto">
        <table className="w-full min-w-[850px] text-left text-xs">
          <thead className="bg-slate-50 uppercase tracking-wide text-slate-500"><tr><th className="px-4 py-2.5">Reel code</th><th className="px-4 py-2.5">Supplier / source</th><th className="px-4 py-2.5">Received</th><th className="px-4 py-2.5 text-right">Original kg</th><th className="px-4 py-2.5 text-right">Balance kg</th><th className="px-4 py-2.5 text-right">Rate / kg</th><th className="px-4 py-2.5">Status</th></tr></thead>
          <tbody className="divide-y divide-slate-100">{group.rows.map(row => <tr key={row._id} className="hover:bg-white"><td className="px-4 py-3 font-semibold text-slate-800">{row.reelCode}</td><td className="px-4 py-3">{row.supplierId?.name || row.inwardReceiptId?.receiptNumber || (row.sourceType === 'opening_balance' ? 'Opening stock' : '—')}</td><td className="px-4 py-3">{shortDate(row.inwardReceiptId?.receiptDate || row.openingStockAdjustmentId?.adjustmentDate || row.createdAt)}</td><td className="px-4 py-3 text-right tabular-nums">{weight(row.originalWeightKg)}</td><td className="px-4 py-3 text-right font-semibold tabular-nums">{weight(row.remainingWeightKg)}</td><td className="px-4 py-3 text-right tabular-nums">₹{weight(row.landedRatePerKg || row.ratePerKg)}</td><td className="px-4 py-3"><span className="rounded-full bg-emerald-50 px-2 py-1 font-semibold text-emerald-700">{row.status}</span></td></tr>)}</tbody>
        </table>
      </div>
    );

    if (sectionKey === 'corrugated') return (
      <div className="overflow-x-auto"><table className="w-full min-w-[720px] text-left text-xs">
        <thead className="bg-slate-50 uppercase tracking-wide text-slate-500"><tr><th className="px-4 py-2.5">Ply / size</th><th className="px-4 py-2.5">Source run</th><th className="px-4 py-2.5 text-right">Sheets</th><th className="px-4 py-2.5 text-right">Weight kg</th><th className="px-4 py-2.5 text-right">Cost / kg</th><th className="px-4 py-2.5">Costing</th><th className="px-4 py-2.5">Created</th></tr></thead>
        <tbody className="divide-y divide-slate-100">{group.rows.map(row => <tr key={row._id}><td className="px-4 py-3 font-semibold text-slate-800">{row.ply}-ply · {row.lengthInches} × {row.widthInches} in</td><td className="px-4 py-3">{row.productionRunId?.runNumber || row.pastingRunId?.runNumber || '—'}</td><td className="px-4 py-3 text-right tabular-nums">{qty(row.sheetCount)}</td><td className="px-4 py-3 text-right tabular-nums">{weight(row.totalWeightKg)}</td><td className="px-4 py-3 text-right tabular-nums">₹{weight(row.unitCostPerKg)}</td><td className="px-4 py-3 capitalize">{row.costingStatus || '—'}</td><td className="px-4 py-3">{shortDate(row.createdAt)}</td></tr>)}</tbody>
      </table></div>
    );

    if (sectionKey === 'cutSheets') return (
      <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left text-xs">
        <thead className="bg-slate-50 uppercase tracking-wide text-slate-500"><tr><th className="px-4 py-2.5">Batch</th><th className="px-4 py-2.5">Cut date</th><th className="px-4 py-2.5 text-right">Sheets left</th><th className="px-4 py-2.5 text-right">Weight kg</th><th className="px-4 py-2.5 text-right">Cost / kg</th><th className="px-4 py-2.5">Source reels</th><th className="px-4 py-2.5">Status</th></tr></thead>
        <tbody className="divide-y divide-slate-100">{group.rows.map(row => <tr key={row._id}><td className="px-4 py-3 font-semibold text-slate-800">{row.batchNumber}</td><td className="px-4 py-3">{shortDate(row.cutDate)}</td><td className="px-4 py-3 text-right tabular-nums">{qty(row.remainingSheets)}</td><td className="px-4 py-3 text-right tabular-nums">{weight(row.remainingWeightKg)}</td><td className="px-4 py-3 text-right tabular-nums">₹{weight(row.unitCostPerKg)}</td><td className="px-4 py-3">{(row.sourceReels || []).map(item => item.reelCode).join(', ') || '—'}</td><td className="px-4 py-3 capitalize">{row.status}</td></tr>)}</tbody>
      </table></div>
    );

    if (sectionKey === 'facing') return (
      <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left text-xs">
        <thead className="bg-slate-50 uppercase tracking-wide text-slate-500"><tr><th className="px-4 py-2.5">Batch</th><th className="px-4 py-2.5">Material</th><th className="px-4 py-2.5">Received</th><th className="px-4 py-2.5 text-right">Sheets left</th><th className="px-4 py-2.5 text-right">Kg left</th><th className="px-4 py-2.5 text-right">Rate / kg</th><th className="px-4 py-2.5">Supplier</th></tr></thead>
        <tbody className="divide-y divide-slate-100">{group.rows.map(row => <tr key={row._id}><td className="px-4 py-3 font-semibold text-slate-800">{row.batchNumber}</td><td className="px-4 py-3">{materialLabel(row.materialType)}</td><td className="px-4 py-3">{shortDate(row.inwardDate)}</td><td className="px-4 py-3 text-right tabular-nums">{qty(row.remainingSheets)}</td><td className="px-4 py-3 text-right tabular-nums">{weight(row.remainingWeightKg)}</td><td className="px-4 py-3 text-right tabular-nums">₹{weight(row.ratePerKg)}</td><td className="px-4 py-3">{row.supplierName || '—'}</td></tr>)}</tbody>
      </table></div>
    );

    if (sectionKey === 'finished') return (
      <div className="overflow-x-auto"><table className="w-full min-w-[880px] text-left text-xs">
        <thead className="bg-slate-50 uppercase tracking-wide text-slate-500"><tr><th className="px-4 py-2.5">Batch</th><th className="px-4 py-2.5">Manufactured</th><th className="px-4 py-2.5 text-right">Produced</th><th className="px-4 py-2.5 text-right">Available</th><th className="px-4 py-2.5">QC status</th><th className="px-4 py-2.5 text-right">Cost / box</th><th className="px-4 py-2.5">Costing</th></tr></thead>
        <tbody className="divide-y divide-slate-100">{group.rows.map(row => <tr key={row._id}><td className="px-4 py-3 font-semibold text-slate-800">{row.batchNumber}</td><td className="px-4 py-3">{shortDate(row.manufacturedAt)}</td><td className="px-4 py-3 text-right tabular-nums">{qty(row.quantityProduced)}</td><td className="px-4 py-3 text-right font-semibold tabular-nums">{qty(row.quantityAvailable)}</td><td className="px-4 py-3 capitalize">{(row.qualityStatus || 'pending').replaceAll('_', ' ')}</td><td className="px-4 py-3 text-right tabular-nums">₹{number(row.costPerBox).toFixed(2)}</td><td className="px-4 py-3 capitalize">{row.costingStatus || '—'}</td></tr>)}</tbody>
      </table></div>
    );

    return (
      <div className="overflow-x-auto"><table className="w-full min-w-[680px] text-left text-xs">
        <thead className="bg-slate-50 uppercase tracking-wide text-slate-500"><tr><th className="px-4 py-2.5">Code</th><th className="px-4 py-2.5">Material</th><th className="px-4 py-2.5">Category</th><th className="px-4 py-2.5 text-right">Available</th><th className="px-4 py-2.5 text-right">Reorder at</th><th className="px-4 py-2.5 text-right">Average rate</th><th className="px-4 py-2.5">Status</th></tr></thead>
        <tbody className="divide-y divide-slate-100">{group.rows.map(row => {
          const current = number(row.currentQty);
          const reorder = number(row.reorderLevel);
          const low = current <= reorder;
          return <tr key={row._id}><td className="px-4 py-3 font-semibold text-slate-800">{row.code}</td><td className="px-4 py-3 font-medium">{row.name}</td><td className="px-4 py-3 capitalize">{row.category}</td><td className="px-4 py-3 text-right font-semibold tabular-nums">{qty(current)} {row.uom}</td><td className="px-4 py-3 text-right tabular-nums">{qty(reorder)} {row.uom}</td><td className="px-4 py-3 text-right tabular-nums">₹{number(row.averageRate).toFixed(2)}</td><td className="px-4 py-3">{low ? <span className="rounded-full bg-amber-50 px-2 py-1 font-semibold text-amber-800">Reorder</span> : <span className="rounded-full bg-emerald-50 px-2 py-1 font-semibold text-emerald-700">Available</span>}</td></tr>;
        })}</tbody>
      </table></div>
    );
  };

  const movementFilteredSearch = movementFiltered.filter(row => !query || [
    row.specificationSummary, row.notes, row.itemType, row.movementType, row.performedBy?.name
  ].some(value => String(value || '').toLowerCase().includes(query)));

  const formatType = type => String(type || '').split('_').map(part => part.charAt(0).toUpperCase() + part.slice(1)).join(' ');
  const movementIcon = change => change > 0
    ? <ArrowDownRight size={15} className="text-emerald-600"/>
    : change < 0 ? <ArrowUpRight size={15} className="text-amber-600"/> : null;

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-blue-700">Inventory control</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">Stock Register</h1>
          <p className="mt-1 text-sm text-slate-500">Explore available stock by material, specification and individual batch.</p>
        </div>
        <button type="button" onClick={() => tab === 'stock' ? loadStock() : loadMovements({ from, to })} className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50">
          <RefreshCw size={16}/> Refresh
        </button>
      </div>

      <div className="flex gap-2 border-b border-slate-200">
        <button type="button" onClick={() => setTab('stock')} className={'border-b-2 px-4 py-3 text-sm font-semibold transition ' + (tab === 'stock' ? 'border-blue-700 text-blue-700' : 'border-transparent text-slate-500 hover:text-slate-800')}><PackageOpen size={15} className="mr-2 inline"/>Stock on hand</button>
        <button type="button" onClick={() => setTab('movements')} className={'border-b-2 px-4 py-3 text-sm font-semibold transition ' + (tab === 'movements' ? 'border-blue-700 text-blue-700' : 'border-transparent text-slate-500 hover:text-slate-800')}><BookOpen size={15} className="mr-2 inline"/>Movement history</button>
      </div>

      <div className="relative">
        <Search size={17} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"/>
        <input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search reel code, batch, product, material or specification…" className="w-full rounded-xl border border-slate-200 bg-white py-3 pl-10 pr-4 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"/>
      </div>

      {tab === 'stock' ? (
        stockLoading ? <div className="flex h-64 items-center justify-center rounded-2xl border border-slate-200 bg-white"><Loader2 className="animate-spin text-blue-600" size={30}/></div> :
        <>
          {stockError && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{stockError}</div>}
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {sections.map(section => {
              const Icon = section.icon;
              return <button type="button" key={section.key} onClick={() => toggleSection(section.key)} className={'rounded-2xl border bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ' + (expandedSections[section.key] ? 'border-blue-300 ring-1 ring-blue-100' : 'border-slate-200')}>
                <div className="flex items-start justify-between gap-3"><span className="rounded-xl bg-slate-100 p-2.5 text-slate-700"><Icon size={20}/></span><span className="text-slate-400">{expandedSections[section.key] ? <ChevronDown size={18}/> : <ChevronRight size={18}/>}</span></div>
                <h2 className="mt-3 font-semibold text-slate-900">{section.title}</h2>
                <p className="mt-1 min-h-9 text-xs leading-5 text-slate-500">{section.description}</p>
                <div className="mt-3 flex items-end justify-between gap-2 border-t border-slate-100 pt-3">
                  <div><p className="text-xs text-slate-500">{section.quantityLabel} available</p><p className="text-xl font-bold tabular-nums text-slate-900">{qty(section.totalQuantity)}</p></div>
                  <div className="text-right"><p className="text-xs text-slate-500">{section.key === 'finished' ? 'Active groups' : section.key === 'raw' ? 'Material groups' : section.weightLabel + ' (kg)'}</p><p className="text-sm font-semibold tabular-nums text-slate-700">{section.weightLabel ? weight(section.totalWeight) : section.groups.length}</p></div>
                </div>
                <div className="mt-2 text-xs font-semibold text-blue-700">{section.groups.length} specification / material groups</div>
              </button>;
            })}
          </div>

          {sections.filter(section => expandedSections[section.key]).map(section => {
            const Icon = section.icon;
            return <section key={section.key} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="flex items-start justify-between gap-3 border-b border-slate-100 bg-slate-50/70 p-5">
                <div className="flex items-start gap-3"><span className="rounded-xl bg-white p-2.5 text-slate-700 shadow-sm"><Icon size={19}/></span><div><h2 className="font-semibold text-slate-900">{section.title}</h2><p className="mt-1 text-xs text-slate-500">{section.description}</p></div></div>
                <div className="text-right"><p className="text-sm font-bold tabular-nums text-slate-900">{qty(section.totalQuantity)} {section.quantityLabel}</p>{section.weightLabel && <p className="text-xs text-slate-500">{weight(section.totalWeight)} kg</p>}</div>
              </div>
              <div className="divide-y divide-slate-100">
                {section.groups.map(group => {
                  const groupKey = section.key + ':' + group.key;
                  const opened = Boolean(expandedGroups[groupKey]);
                  return <div key={groupKey}>
                    <button type="button" onClick={() => toggleGroup(groupKey)} className="flex w-full flex-wrap items-center justify-between gap-3 px-5 py-4 text-left transition hover:bg-slate-50">
                      <div className="flex min-w-0 items-center gap-3"><span className="text-slate-400">{opened ? <ChevronDown size={17}/> : <ChevronRight size={17}/>}</span><div className="min-w-0"><p className="truncate text-sm font-semibold text-slate-800">{group.label}</p>{group.subLabel && <p className="mt-0.5 text-xs text-slate-500">{group.subLabel}</p>}<p className="mt-0.5 text-xs text-slate-400">{group.rows.length} {section.key === 'reels' || section.key === 'finished' || section.key === 'raw' ? 'records' : 'batches'}</p></div></div>
                      <div className="flex items-center gap-5 text-right">{section.key !== 'raw' && <div><p className="text-[11px] text-slate-500">Available</p><p className="text-sm font-bold tabular-nums text-slate-900">{qty(group.quantity)}</p></div>}{group.weightKg > 0 && <div><p className="text-[11px] text-slate-500">Weight</p><p className="text-sm font-semibold tabular-nums text-slate-700">{weight(group.weightKg)} kg</p></div>}</div>
                    </button>
                    {opened && <div className="border-t border-slate-100 bg-slate-50/60">{renderGroupDetails(section.key, group)}</div>}
                  </div>;
                })}
                {section.groups.length === 0 && <div className="px-5 py-10 text-center"><PackageOpen size={26} className="mx-auto mb-2 text-slate-300"/><p className="text-sm font-medium text-slate-600">{query ? 'No stock matches this search.' : 'No live stock in this section.'}</p><p className="mt-1 text-xs text-slate-400">This section will populate as inward and production transactions are posted.</p></div>}
              </div>
            </section>;
          })}
          <p className="text-xs text-slate-400">Only live remaining quantities are shown here. Opening workbook snapshots remain available separately as historical baseline references.</p>
        </>
      ) : (
        <div className="space-y-5">
          <DateRangeFilter from={from} to={to} onFromChange={setFrom} onToChange={setTo} onApply={() => loadMovements({ from, to })} onReset={() => { setFrom(''); setTo(''); loadMovements({}); }} loading={movementLoading} label="Stock movement date range"/>
          <div className="flex flex-wrap gap-2">{['all', 'inward', 'production', 'conversion'].map(value => <button key={value} type="button" onClick={() => setFilter(value)} className={'rounded-full px-4 py-2 text-xs font-semibold transition ' + (filter === value ? 'bg-slate-900 text-white' : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50')}>{value === 'all' ? 'All movements' : value.charAt(0).toUpperCase() + value.slice(1)}</button>)}</div>
          {movementError && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{movementError}</div>}
          {movementLoading ? <div className="flex h-48 items-center justify-center rounded-2xl border border-slate-200 bg-white"><Loader2 className="animate-spin text-blue-600" size={28}/></div> :
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="overflow-x-auto"><table className="w-full min-w-[1000px] text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-5 py-3">Date & time</th><th className="px-5 py-3">Movement</th><th className="px-5 py-3">Stock type</th><th className="px-5 py-3">Specification / notes</th><th className="px-5 py-3 text-right">Qty change</th><th className="px-5 py-3 text-right">Weight change</th><th className="px-5 py-3">Operator</th></tr></thead>
                <tbody className="divide-y divide-slate-100">{movementFilteredSearch.map(row => <tr key={row._id} className="hover:bg-slate-50"><td className="whitespace-nowrap px-5 py-4 text-slate-600">{new Date(row.movementDate || row.createdAt).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</td><td className="whitespace-nowrap px-5 py-4 font-medium text-slate-900">{formatType(row.movementType)}</td><td className="px-5 py-4 capitalize text-slate-600">{String(row.itemType || '').replaceAll('_', ' ')}</td><td className="px-5 py-4 text-slate-700">{row.specificationSummary}<p className="mt-0.5 text-xs text-slate-400">{row.notes}</p></td><td className="px-5 py-4 text-right font-semibold tabular-nums"><span className="inline-flex items-center justify-end gap-1">{movementIcon(row.quantityChange)}{number(row.quantityChange) > 0 ? '+' : ''}{qty(row.quantityChange)}</span></td><td className="px-5 py-4 text-right font-semibold tabular-nums">{number(row.weightChangeKg) > 0 ? '+' : ''}{weight(row.weightChangeKg)} kg</td><td className="px-5 py-4 text-slate-600">{row.performedBy?.name || 'System'}</td></tr>)}
                {movementFilteredSearch.length === 0 && <tr><td colSpan="7" className="px-5 py-12 text-center text-slate-500">No movement records match these filters.</td></tr>}</tbody>
              </table></div>
            </div>}
        </div>
      )}
    </div>
  );
}
