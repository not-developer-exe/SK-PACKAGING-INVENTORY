import React, { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  Search,
  Plus,
  FileText,
  Download,
  Printer,
  Filter,
  MoreVertical,
  CheckCircle2,
  Clock,
  AlertCircle,
} from "lucide-react";

// Sample Data (To be replaced with API later)
const sampleInvoices = [
  {
    id: "INV-26-005",
    date: "2026-11-05",
    partyName: "Nano Fertilizers Private Ltd",
    type: "Sale",
    method: "NEFT",
    amount: 145000,
    balance: 0,
    dueDate: "2026-11-20",
    status: "Paid",
  },
  {
    id: "INV-26-004",
    date: "2026-11-01",
    partyName: "Anvi Traders",
    type: "Sale",
    method: "Pending",
    amount: 44333,
    balance: 44333,
    dueDate: "2026-11-15",
    status: "Pending",
  },
  {
    id: "INV-26-003",
    date: "2026-10-15",
    partyName: "Itokri Enterprises",
    type: "Sale",
    method: "UPI",
    amount: 38896,
    balance: 10000,
    dueDate: "2026-10-30",
    status: "Overdue",
  },
  {
    id: "INV-26-002",
    date: "2026-10-10",
    partyName: "Kalash Edible Oils Pvt. Ltd.",
    type: "Sale",
    method: "Cash",
    amount: 22194,
    balance: 0,
    dueDate: "2026-10-25",
    status: "Paid",
  },
  {
    id: "INV-26-001",
    date: "2026-10-05",
    partyName: "King Pop Confectionery",
    type: "Sale [Cancelled]",
    method: "-",
    amount: 0,
    balance: 0,
    dueDate: "-",
    status: "Cancelled",
  },
];

export default function SalesInvoicesPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");

  // Calculate top metrics
  const totalSales = sampleInvoices
    .filter((i) => i.status !== "Cancelled")
    .reduce((acc, curr) => acc + curr.amount, 0);
  const totalBalance = sampleInvoices
    .filter((i) => i.status !== "Cancelled")
    .reduce((acc, curr) => acc + curr.balance, 0);
  const totalReceived = totalSales - totalBalance;

  // Filter Logic
  const filteredInvoices = useMemo(() => {
    return sampleInvoices.filter((inv) => {
      const matchesSearch =
        inv.partyName.toLowerCase().includes(search.toLowerCase()) ||
        inv.id.toLowerCase().includes(search.toLowerCase());
      const matchesStatus =
        statusFilter === "All" || inv.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [search, statusFilter]);

  const StatusBadge = ({ status }) => {
    const styles = {
      Paid: "bg-emerald-50 text-emerald-700 border-emerald-200",
      Pending: "bg-amber-50 text-amber-700 border-amber-200",
      Overdue: "bg-red-50 text-red-700 border-red-200",
      Cancelled: "bg-slate-100 text-slate-600 border-slate-200",
    };

    const icons = {
      Paid: <CheckCircle2 size={12} className="mr-1" />,
      Pending: <Clock size={12} className="mr-1" />,
      Overdue: <AlertCircle size={12} className="mr-1" />,
      Cancelled: null,
    };

    return (
      <span
        className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${styles[status]}`}
      >
        {icons[status]} {status}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Sales Invoices
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Track outward billing, receivables, and payment statuses.
          </p>
        </div>
        <button
          onClick={() => navigate('/sales/new')}
          className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 shadow-sm"
        >
          <Plus size={16} /> New GST Invoice
        </button>
      </div>

      {/* Financial Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-medium text-slate-500">
            Total Sales Amount
          </p>
          <p className="mt-2 text-3xl font-bold text-slate-900">
            ₹{totalSales.toLocaleString("en-IN")}
          </p>
        </div>
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/50 p-5 shadow-sm">
          <p className="text-sm font-medium text-emerald-700">
            Payment Received
          </p>
          <p className="mt-2 text-3xl font-bold text-emerald-900">
            ₹{totalReceived.toLocaleString("en-IN")}
          </p>
        </div>
        <div className="rounded-2xl border border-amber-200 bg-amber-50/50 p-5 shadow-sm">
          <p className="text-sm font-medium text-amber-700">
            Balance Due (Receivables)
          </p>
          <p className="mt-2 text-3xl font-bold text-amber-900">
            ₹{totalBalance.toLocaleString("en-IN")}
          </p>
        </div>
      </div>

      {/* Ledger Section */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        {/* Filters */}
        <div className="flex flex-col sm:flex-row justify-between gap-4 border-b border-slate-100 p-4 bg-slate-50/50">
          <div className="relative w-full sm:w-96">
            <Search
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              type="text"
              placeholder="Search party name or invoice no..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm outline-none transition focus:border-blue-400 focus:ring-1 focus:ring-blue-400"
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter size={16} className="text-slate-400" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded-xl border border-slate-200 bg-white py-2 px-3 text-sm outline-none focus:border-blue-400"
            >
              <option value="All">All Statuses</option>
              <option value="Paid">Paid</option>
              <option value="Pending">Pending</option>
              <option value="Overdue">Overdue</option>
            </select>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-white text-xs uppercase tracking-wide text-slate-500 border-b border-slate-200">
              <tr>
                <th className="px-5 py-4 font-semibold">Date</th>
                <th className="px-5 py-4 font-semibold">Invoice No</th>
                <th className="px-5 py-4 font-semibold">Party Name</th>
                <th className="px-5 py-4 font-semibold text-right">Amount</th>
                <th className="px-5 py-4 font-semibold text-right">Balance</th>
                <th className="px-5 py-4 font-semibold">Due Date</th>
                <th className="px-5 py-4 font-semibold text-center">Status</th>
                <th className="px-5 py-4 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredInvoices.map((inv) => (
                <tr key={inv.id} className="transition hover:bg-slate-50 group">
                  <td className="px-5 py-4 text-slate-600">
                    {new Date(inv.date).toLocaleDateString("en-IN")}
                  </td>
                  <td className="px-5 py-4 font-semibold text-blue-700">
                    {inv.id}
                  </td>
                  <td className="px-5 py-4 font-medium text-slate-900">
                    {inv.partyName}
                  </td>
                  <td className="px-5 py-4 text-right font-medium text-slate-900">
                    {inv.amount > 0
                      ? `₹${inv.amount.toLocaleString("en-IN")}`
                      : "-"}
                  </td>
                  <td className="px-5 py-4 text-right font-medium text-amber-700">
                    {inv.balance > 0
                      ? `₹${inv.balance.toLocaleString("en-IN")}`
                      : "-"}
                  </td>
                  <td className="px-5 py-4 text-slate-500">
                    {inv.dueDate !== "-"
                      ? new Date(inv.dueDate).toLocaleDateString("en-IN")
                      : "-"}
                  </td>
                  <td className="px-5 py-4 text-center">
                    <StatusBadge status={inv.status} />
                  </td>
                  <td className="px-5 py-4 text-right">
                    <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition"
                        title="View PDF"
                      >
                        <FileText size={16} />
                      </button>
                      <button
                        className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition"
                        title="Print"
                      >
                        <Printer size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredInvoices.length === 0 && (
                <tr>
                  <td
                    colSpan={8}
                    className="px-5 py-12 text-center text-slate-500"
                  >
                    No invoices found matching your filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
