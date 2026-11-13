import React from 'react';
import { Routes, Route, Link, useLocation, Navigate, Outlet } from 'react-router-dom';
import { 
  LayoutDashboard, Users, FileText, Package, 
  ArrowDownToLine, Factory, Scissors, Truck, 
  Settings, LogOut, FilePlus2, BookOpen, Trash2 
} from 'lucide-react';

// --- IMPORT EVERY PAGE FROM YOUR FOLDERS ---
import Overview from './pages/Overview';
import PartyMasterPage from './pages/Parties/PartyMasterPage';
import SalesInvoicesPage from './pages/Sales/SalesInvoicesPage';
import CreateInvoicePage from './pages/Sales/CreateInvoicePage';
import ReelStockPage from './pages/ReelStock/ReelStockPage';
import StockInwardPage from './pages/StockInward/StockInwardPage';
import ProductionPage from './pages/Production/ProductionPage';
import ConversionPage from './pages/Conversion/ConversionPage';
import DispatchPage from './pages/Operations/DispatchPage';
import StockLedgerPage from './pages/Reports/StockLedgerPage';
import WasteRegisterPage from './pages/Reports/WasteRegisterPage';

// --- SIDEBAR COMPONENT ---
function Sidebar() {
  const location = useLocation();

  const navigation = [
    { group: 'Overview', items: [
      { name: 'Dashboard', path: '/', icon: LayoutDashboard }
    ]},
    { group: 'Finance & Sales', items: [
      { name: 'Party Master', path: '/parties', icon: Users },
      { name: 'Sales Invoices', path: '/sales', icon: FileText },
      { name: 'New GST Invoice', path: '/sales/new', icon: FilePlus2 }
    ]},
    { group: 'Inventory', items: [
      { name: 'Reel Stock', path: '/inventory/reels', icon: Package },
      { name: 'Stock Inward', path: '/inventory/inward', icon: ArrowDownToLine },
      { name: 'Stock Ledger', path: '/inventory/ledger', icon: BookOpen }
    ]},
    { group: 'Factory Operations', items: [
      { name: 'Production', path: '/operations/production', icon: Factory },
      { name: 'Conversion', path: '/operations/conversion', icon: Scissors },
      { name: 'Box Dispatch', path: '/operations/dispatch', icon: Truck },
      { name: 'Waste Register', path: '/operations/waste', icon: Trash2 }
    ]}
  ];

  return (
    <div className="flex h-screen w-64 flex-col border-r border-slate-200 bg-slate-900 text-slate-300">
      <div className="flex h-16 items-center px-6 border-b border-slate-800">
        <h1 className="text-lg font-bold text-white tracking-wide">SK PACKAGING</h1>
      </div>
      
      <div className="flex-1 overflow-y-auto py-4 scrollbar-hide">
        {navigation.map((section, idx) => (
          <div key={idx} className="mb-6">
            <h2 className="px-6 text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
              {section.group}
            </h2>
            <div className="space-y-1">
              {section.items.map((item) => {
                const Icon = item.icon;
                // Highlight if the current URL starts with this path (for sub-pages)
                const isActive = location.pathname === item.path || (item.path !== '/' && location.pathname.startsWith(item.path));
                return (
                  <Link 
                    key={item.name}
                    to={item.path}
                    className={`flex items-center gap-3 px-6 py-2.5 text-sm font-medium transition-colors ${
                      isActive 
                        ? 'bg-blue-600 text-white border-r-4 border-white' 
                        : 'hover:bg-slate-800 hover:text-white'
                    }`}
                  >
                    <Icon size={18} className={isActive ? 'text-white' : 'text-slate-400'} />
                    {item.name}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <div className="border-t border-slate-800 p-4 space-y-1">
        <button className="flex w-full items-center gap-3 px-2 py-2 text-sm font-medium text-slate-400 hover:text-white transition-colors">
          <Settings size={18} /> Settings
        </button>
        <button className="flex w-full items-center gap-3 px-2 py-2 text-sm font-medium text-slate-400 hover:text-red-400 transition-colors">
          <LogOut size={18} /> Sign Out
        </button>
      </div>
    </div>
  );
}

// --- MAIN LAYOUT SHELL ---
function AppLayout() {
  return (
    <div className="flex h-screen overflow-hidden bg-slate-50 font-sans">
      <Sidebar />
      <main className="flex-1 overflow-y-auto p-8">
        <Outlet /> 
      </main>
    </div>
  );
}

// --- ROUTER CONFIGURATION ---
export default function App() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route path="/" element={<Overview />} />
        
        <Route path="/parties" element={<PartyMasterPage />} />
        <Route path="/sales" element={<SalesInvoicesPage />} />
        <Route path="/sales/new" element={<CreateInvoicePage />} />
        
        <Route path="/inventory/reels" element={<ReelStockPage />} />
        <Route path="/inventory/inward" element={<StockInwardPage />} />
        <Route path="/inventory/ledger" element={<StockLedgerPage />} />
        
        <Route path="/operations/production" element={<ProductionPage />} />
        <Route path="/operations/conversion" element={<ConversionPage />} />
        <Route path="/operations/dispatch" element={<DispatchPage />} />
        <Route path="/operations/waste" element={<WasteRegisterPage />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}