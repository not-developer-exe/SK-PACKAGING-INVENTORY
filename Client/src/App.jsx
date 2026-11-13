import React from 'react';
import { Routes, Route, Link, useLocation, Navigate, Outlet, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Users, FileText, Package, ArrowDownToLine, Factory,
  Scissors, Truck, LogOut, FilePlus2, BookOpen, Trash2, ShieldCheck
} from 'lucide-react';

import { useAuth } from './context/AuthContext';
import LoginPage from './pages/Auth/LoginPage';
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
import OpeningStockPage from './pages/Reports/OpeningStockPage';
import UserManagementPage from './pages/Reports/UserManagementPage';

function RequireAuth() {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <div className="flex min-h-screen items-center justify-center text-sm text-slate-500">Checking your session…</div>;
  return user ? <Outlet /> : <Navigate to="/login" replace state={{ from: location }} />;
}

function Sidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [signingOut, setSigningOut] = React.useState(false);
  const navigation = [
    { group: 'Overview', items: [{ name: 'Dashboard', path: '/', icon: LayoutDashboard }] },
    { group: 'Finance & Sales', items: [
      { name: 'Party Master', path: '/parties', icon: Users },
      { name: 'Sales Invoices', path: '/sales', icon: FileText },
      { name: 'New GST Invoice', path: '/sales/new', icon: FilePlus2 }
    ] },
    { group: 'Inventory', items: [
      { name: 'Reel Stock', path: '/inventory/reels', icon: Package },
      { name: 'Stock Inward', path: '/inventory/inward', icon: ArrowDownToLine },
      { name: 'Stock Ledger', path: '/inventory/ledger', icon: BookOpen }
    ] },
    ...(user?.role === 'admin' ? [{ group: 'Administration', items: [
      { name: 'Opening Stock & Audit', path: '/admin/opening-stock', icon: ShieldCheck },
      { name: 'User Management', path: '/admin/users', icon: Users }
    ] }] : []),
    { group: 'Factory Operations', items: [
      { name: 'Production', path: '/operations/production', icon: Factory },
      { name: 'Conversion', path: '/operations/conversion', icon: Scissors },
      { name: 'Box Dispatch', path: '/operations/dispatch', icon: Truck },
      { name: 'Waste Register', path: '/operations/waste', icon: Trash2 }
    ] }
  ];

  const handleLogout = async () => {
    if (signingOut) return;
    setSigningOut(true);
    try { await logout(); } finally { navigate('/login', { replace: true }); setSigningOut(false); }
  };

  return (
    <aside className="flex h-screen w-64 shrink-0 flex-col border-r border-slate-200 bg-slate-900 text-slate-300">
      <div className="flex h-16 items-center border-b border-slate-800 px-6"><h1 className="text-lg font-bold tracking-wide text-white">SK PACKAGING</h1></div>
      <nav className="flex-1 overflow-y-auto py-4">
        {navigation.map((section) => <div key={section.group} className="mb-6">
          <h2 className="mb-2 px-6 text-xs font-bold uppercase tracking-wider text-slate-500">{section.group}</h2>
          <div className="space-y-1">{section.items.map((item) => {
            const Icon = item.icon;
            const active = item.path === '/' ? location.pathname === '/' : location.pathname === item.path || location.pathname.startsWith(item.path + '/');
            return <Link key={item.path} to={item.path} aria-current={active ? 'page' : undefined} className={`flex items-center gap-3 px-6 py-2.5 text-sm font-medium transition-colors ${active ? 'border-r-4 border-white bg-blue-600 text-white' : 'hover:bg-slate-800 hover:text-white'}`}><Icon size={18} />{item.name}</Link>;
          })}</div>
        </div>)}
      </nav>
      <div className="border-t border-slate-800 p-4">
        <div className="mb-3 truncate px-2 text-xs text-slate-400">{user?.name || user?.email} · {user?.role}</div>
        <button onClick={handleLogout} disabled={signingOut} className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-sm font-medium text-slate-400 transition-colors hover:bg-slate-800 hover:text-red-300 disabled:opacity-60"><LogOut size={18} />{signingOut ? 'Signing out…' : 'Sign Out'}</button>
      </div>
    </aside>
  );
}

function AppLayout() {
  return <div className="flex min-h-screen overflow-hidden bg-slate-50 font-sans"><Sidebar /><main className="min-w-0 flex-1 overflow-y-auto p-4 sm:p-8"><Outlet /></main></div>;
}

export default function App() {
  const { user, loading } = useAuth();
  return (
    <Routes>
      <Route path="/login" element={loading ? <div className="flex min-h-screen items-center justify-center text-sm text-slate-500">Checking your session…</div> : user ? <Navigate to="/" replace /> : <LoginPage />} />
      <Route element={<RequireAuth />}>
        <Route element={<AppLayout />}>
          <Route index element={<Overview />} />
          <Route path="parties" element={<PartyMasterPage />} />
          <Route path="sales" element={<SalesInvoicesPage />} />
          <Route path="sales/new" element={<CreateInvoicePage />} />
          <Route path="inventory/reels" element={<ReelStockPage />} />
          <Route path="inventory/inward" element={<StockInwardPage />} />
          <Route path="inventory/ledger" element={<StockLedgerPage />} />
          <Route path="operations/production" element={<ProductionPage />} />
          <Route path="operations/conversion" element={<ConversionPage />} />
          <Route path="operations/dispatch" element={<DispatchPage />} />
          <Route path="operations/waste" element={<WasteRegisterPage />} />
          <Route path="admin/opening-stock" element={user?.role === 'admin' ? <OpeningStockPage /> : <Navigate to="/" replace />} />
          <Route path="admin/users" element={user?.role === 'admin' ? <UserManagementPage /> : <Navigate to="/" replace />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to={user ? '/' : '/login'} replace />} />
    </Routes>
  );
}