import React, { useState } from "react";
import {
  LayoutDashboard,
  Layers3,
  ArrowDownToLine,
  Factory,
  Package,
  Users,
  Trash2,
  Menu,
  X,
  Boxes,
  CircleHelp,
  LogOut,
  Loader2,
  Truck,
  BookOpen,
  Plus,
  Receipt,
} from "lucide-react";

import { AuthProvider, useAuth } from "./context/AuthContext";

// Page Imports
import LoginPage from "./pages/Auth/LoginPage";
import ReelStockPage from "./pages/ReelStock/ReelStockPage";
import StockInwardPage from "./pages/StockInward/StockInwardPage";
import ProductionPage from "./pages/Production/ProductionPage";
import ConversionPage from "./pages/Conversion/ConversionPage";
import PartyMasterPage from "./pages/Parties/PartyMasterPage";
import StockLedgerPage from "./pages/Reports/StockLedgerPage";
import DispatchPage from "./pages/Operations/DispatchPage";
import Overview from "./pages/Overview";
import WasteRegisterPage from "./pages/Reports/WasteRegisterPage";
import SalesInvoicesPage from "./pages/Sales/SalesInvoicesPage";
import CreateInvoicePage from "./pages/Sales/CreateInvoicePage";

// UPDATED NAVIGATION SCHEMA
const navigationGroups = [
  {
    group: "MAIN",
    items: [
      { label: "Overview", icon: LayoutDashboard },
      { label: "Party Master", icon: Users },
    ],
  },
  {
    group: "FINANCE",
    items: [{ label: "Sales Invoices", icon: Receipt }],
  },
  {
    group: "INVENTORY",
    items: [
      { label: "Reel Stock", icon: Layers3 },
      { label: "Stock Inward", icon: ArrowDownToLine },
    ],
  },
  {
    group: "OPERATIONS",
    items: [
      { label: "Production", icon: Factory },
      { label: "Finished Goods", icon: Package },
      { label: "Box Dispatch", icon: Truck },
    ],
  },
  {
    group: "REPORTS",
    items: [
      { label: "Waste Register", icon: Trash2 },
      { label: "Stock Ledger", icon: BookOpen },
    ],
  },
];

// NEW SAAS SHELL
function DashboardShell() {
  const { user, logout } = useAuth();
  const [page, setPage] = useState("Overview");
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  function selectPage(label) {
    setPage(label);
    setMobileNavOpen(false);
  }

  function SidebarContent() {
    return (
      <div className="flex h-full flex-col bg-[#0B1120] text-slate-300">
        <div className="flex items-center gap-3 px-6 py-6">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-white shadow-lg shadow-blue-900/20">
            <Boxes size={24} />
          </div>
          <div>
            <h1 className="text-base font-bold text-white tracking-wide">
              SK Packaging
            </h1>
            <p className="text-[11px] text-slate-400">Inventory management</p>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto px-4 py-2 custom-scrollbar">
          {navigationGroups.map((section, idx) => (
            <div key={idx} className="mb-6">
              <h2 className="mb-2 px-3 text-[10px] font-bold uppercase tracking-widest text-slate-500">
                {section.group}
              </h2>
              <div className="space-y-1">
                {section.items.map((item) => {
                  const isActive = page === item.label;
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.label}
                      onClick={() => selectPage(item.label)}
                      className={`group relative flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all ${
                        isActive
                          ? "bg-blue-600 text-white shadow-md"
                          : "text-slate-400 hover:bg-slate-800 hover:text-slate-100"
                      }`}
                    >
                      <Icon
                        size={18}
                        className={
                          isActive
                            ? "text-white"
                            : "text-slate-500 group-hover:text-slate-300"
                        }
                      />
                      {item.label}
                      {isActive && (
                        <span className="absolute right-3 h-1.5 w-1.5 rounded-full bg-white shadow-[0_0_8px_rgba(255,255,255,0.8)]"></span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className="mt-auto border-t border-slate-800 p-4">
          <button className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium text-slate-400 transition hover:bg-slate-800 hover:text-slate-100 mb-2">
            <CircleHelp size={18} /> Help & support
          </button>
          <div className="flex items-center gap-3 rounded-xl bg-slate-800/50 p-3 border border-slate-800">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-900/50 text-blue-400 font-bold text-sm border border-blue-800">
              {user?.name ? user.name.substring(0, 2).toUpperCase() : "SK"}
            </div>
            <div className="flex-1 overflow-hidden">
              <p className="truncate text-sm font-semibold text-slate-200">
                {user?.name || "Admin User"}
              </p>
              <p className="truncate text-[11px] text-slate-500 capitalize">
                {user?.role || "Production"} Workspace
              </p>
            </div>
            <button
              onClick={logout}
              className="text-slate-500 hover:text-slate-300 transition p-1 rounded-md hover:bg-slate-700"
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-full bg-slate-50 font-sans text-slate-900 overflow-hidden">
      {/* Mobile Nav Overlay */}
      {mobileNavOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            onClick={() => setMobileNavOpen(false)}
            className="absolute inset-0 bg-slate-950/50"
          />
          <aside className="relative flex h-full w-[280px] flex-col bg-[#0B1120]">
            <button
              onClick={() => setMobileNavOpen(false)}
              className="absolute right-3 top-6 z-10 rounded-lg p-2 text-slate-300 hover:bg-slate-800"
            >
              <X size={18} />
            </button>
            <SidebarContent />
          </aside>
        </div>
      )}

      {/* Desktop Sidebar */}
      <aside className="hidden h-full w-72 flex-col lg:flex shrink-0">
        <SidebarContent />
      </aside>

      {/* Main Content Area */}
      <main className="flex flex-1 flex-col overflow-hidden">
        {/* Top Action Header */}
        <header className="flex h-16 shrink-0 items-center justify-between border-b border-slate-200 bg-white px-4 sm:px-8">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => setMobileNavOpen(true)}
              className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 lg:hidden"
            >
              <Menu size={20} />
            </button>
            <h1 className="text-lg font-bold text-slate-900 hidden sm:block">
              {page}
            </h1>
            <span className="hidden sm:inline-flex rounded bg-blue-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-blue-600 border border-blue-100">
              DEMO
            </span>
            <span className="truncate text-sm text-slate-400 sm:pl-2 sm:border-l border-slate-200">
              SK Packaging / {page}
            </span>
          </div>

          <div className="flex items-center gap-1 sm:gap-2 overflow-x-auto no-scrollbar">
            {/* CORRECTED: Now routes accurately to Sales Invoices */}
            <button
              onClick={() => selectPage("Sales Invoices")}
              className="whitespace-nowrap flex items-center gap-1.5 rounded-lg px-2 sm:px-3 py-1.5 text-xs sm:text-sm font-medium text-blue-600 transition hover:bg-blue-50"
            >
              <Plus size={14} /> Add Sale
            </button>

            {/* Delivery Challan Shortcut */}
            <button
              onClick={() => selectPage("Box Dispatch")}
              className="whitespace-nowrap flex items-center gap-1.5 rounded-lg px-2 sm:px-3 py-1.5 text-xs sm:text-sm font-medium text-cyan-600 transition hover:bg-cyan-50"
            >
              <Truck size={14} /> Delivery Challan
            </button>

            {/* Add Purchase */}
            <button
              onClick={() => selectPage("Stock Inward")}
              className="whitespace-nowrap flex items-center gap-1.5 rounded-lg px-2 sm:px-3 py-1.5 text-xs sm:text-sm font-medium text-purple-600 transition hover:bg-purple-50"
            >
              <Plus size={14} /> Add Purchase
            </button>

            {/* Log Production */}
            <button
              onClick={() => selectPage("Production")}
              className="whitespace-nowrap flex items-center gap-1.5 rounded-lg px-2 sm:px-3 py-1.5 text-xs sm:text-sm font-medium text-emerald-600 transition hover:bg-emerald-50"
            >
              <Factory size={14} /> Log Production
            </button>

            <div className="hidden sm:block ml-2 h-6 w-px bg-slate-200"></div>
            <div className="hidden sm:block text-right pr-2">
              <p className="text-[11px] font-medium text-slate-700">
                Development mode
              </p>
              <p className="text-[9px] text-slate-400">Sample data only</p>
            </div>
          </div>
        </header>

        {/* Page Content Rendering */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-8">
          <div className="mx-auto max-w-[1600px]">
            {page === "Overview" ? (
              <Overview setPage={setPage} />
            ) : page === "Party Master" ? (
              <PartyMasterPage />
            ) : page === "Sales Invoices" ? (
              <SalesInvoicesPage setPage={setPage} />
            ) : page === "Create GST Invoice" ? (
              <CreateInvoicePage setPage={setPage} />
            ) : page === "Reel Stock" ? (
              <ReelStockPage />
            ) : page === "Stock Inward" ? (
              <StockInwardPage />
            ) : page === "Production" ? (
              <ProductionPage />
            ) : page === "Finished Goods" ? (
              <ConversionPage />
            ) : page === "Stock Ledger" ? (
              <StockLedgerPage />
            ) : page === "Box Dispatch" ? (
              <DispatchPage />
            ) : page === "Waste Register" ? (
              <WasteRegisterPage />
            ) : (
              <div className="flex h-64 flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50">
                <p className="text-lg font-medium text-slate-500">
                  {page} Module
                </p>
                <p className="text-sm text-slate-400">
                  Development in progress...
                </p>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

function AppRoot() {
  const { user, loading } = useAuth();
  if (loading)
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <Loader2 className="animate-spin text-blue-600" size={32} />
      </div>
    );
  return user ? <DashboardShell /> : <LoginPage />;
}

export default function App() {
  return (
    <AuthProvider>
      <AppRoot />
    </AuthProvider>
  );
}
