import React, { useMemo, useState, useEffect } from "react";
import { Search, CalendarDays, Loader2 } from "lucide-react";
import { inventoryService } from "../../services/inventoryService";

export default function ReelStockPage() {
  const [reels, setReels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [quality, setQuality] = useState("All qualities");

  useEffect(() => {
    const fetchStock = async () => {
      try {
        setLoading(true);
        const stockData = await inventoryService.getReelStock();
        setReels(stockData);
      } catch (error) {
        console.error("Failed to load reel stock:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchStock();
  }, []);

  const totalReels = reels.reduce((total, item) => total + Number(item.reels || 0), 0);
  const totalWeight = reels.reduce((total, item) => total + Number(item.weight || 0), 0);
  const lowStockCount = reels.filter((item) => Number(item.reels) <= 3).length;

  const filteredReels = useMemo(() => {
    const query = search.trim().toLowerCase();
    return reels.filter((item) => {
      const matchesQuality = quality === "All qualities" || item.quality === quality;
      const searchableText = [item.id, item.width, item.bf, item.gsm, item.quality].join(" ").toLowerCase();
      const matchesSearch = !query || searchableText.includes(query);
      return matchesQuality && matchesSearch;
    });
  }, [reels, search, quality]);

  const qualityFilters = [
    { label: "All", value: "All qualities" },
    { label: "Natural", value: "Natural" },
    { label: "Golden Yellow (GY)", value: "GY" },
  ];

  if (loading) return <div className="flex h-64 items-center justify-center rounded-2xl border border-slate-200 bg-white"><Loader2 className="animate-spin text-blue-600" size={32} /></div>;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-5"><p className="text-sm font-medium text-slate-500">Total specifications</p><p className="mt-2 text-2xl font-bold text-slate-900">{reels.length}</p></div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5"><p className="text-sm font-medium text-slate-500">Reels available</p><p className="mt-2 text-2xl font-bold text-slate-900">{totalReels.toLocaleString("en-IN")}</p></div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5"><p className="text-sm font-medium text-slate-500">Paper weight on hand</p><p className="mt-2 text-2xl font-bold text-slate-900">{totalWeight.toLocaleString("en-IN", { maximumFractionDigits: 2 })} <span className="text-base text-slate-500">kg</span></p></div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5"><p className="text-sm font-medium text-slate-500">Low-stock items</p><p className="mt-2 text-2xl font-bold text-amber-700">{lowStockCount}</p></div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <div className="space-y-3 border-b border-slate-100 p-4">
          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="relative flex-1">
              <Search size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input type="text" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search width, BF, GSM, or quality..." className="w-full rounded-xl border border-slate-200 py-2.5 pl-10 pr-3 text-sm outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100" />
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {qualityFilters.map((option) => (
              <button key={option.value} onClick={() => setQuality(option.value)} className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${quality === option.value ? "border-blue-700 bg-blue-700 text-white" : "border-slate-200 bg-white text-slate-600 hover:bg-blue-50"}`}>{option.label}</button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[950px] text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-5 py-3 font-semibold">Specification</th><th className="px-5 py-3 font-semibold">BF</th><th className="px-5 py-3 font-semibold">GSM</th><th className="px-5 py-3 font-semibold">Quality</th><th className="px-5 py-3 text-right font-semibold">Reels</th><th className="px-5 py-3 text-right font-semibold">Weight (kg)</th><th className="px-5 py-3 font-semibold">Last Received</th><th className="px-5 py-3 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredReels.map((item) => (
                <tr key={item.id} className="transition hover:bg-slate-50">
                  <td className="whitespace-nowrap px-5 py-4 font-medium text-slate-900">{item.width} inch</td>
                  <td className="px-5 py-4 text-slate-700">{item.bf}</td><td className="px-5 py-4 text-slate-700">{item.gsm}</td>
                  <td className="px-5 py-4"><span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${item.quality === "GY" ? "bg-amber-100 text-amber-800" : "bg-slate-100 text-slate-700"}`}>{item.quality}</span></td>
                  <td className="px-5 py-4 text-right tabular-nums text-slate-700">{item.reels}</td>
                  <td className="px-5 py-4 text-right tabular-nums text-slate-700">{item.weight.toLocaleString("en-IN", { maximumFractionDigits: 2 })}</td>
                  <td className="whitespace-nowrap px-5 py-4 text-slate-700"><span className="inline-flex items-center gap-2"><CalendarDays size={14} className="text-slate-400" />{new Date(item.dateAdded).toLocaleDateString("en-IN")}</span></td>
                  <td className="px-5 py-4"><span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${item.reels <= 3 ? "bg-amber-100 text-amber-800" : "bg-emerald-100 text-emerald-800"}`}>{item.reels <= 3 ? "Low stock" : "In stock"}</span></td>
                </tr>
              ))}
              {filteredReels.length === 0 && (<tr><td colSpan={8} className="px-5 py-12 text-center text-slate-500">No physical reels found. Post an Inward Receipt to add stock.</td></tr>)}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}