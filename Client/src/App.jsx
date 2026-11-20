import React from 'react';
import { Routes, Route, Link, useLocation, Navigate, Outlet, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Users, FileText, Package, ArrowDownToLine, Factory, ClipboardCheck,
  Scissors, Truck, LogOut, FilePlus2, BookOpen, Trash2, ShieldCheck, ChartNoAxesCombined, Receipt, Database, Wallet, Building2
} from 'lucide-react';

import { useAuth } from './context/AuthContext';
import LoginPage from './pages/Auth/LoginPage';
import Overview from './pages/Overview';
import PartyMasterPage from './pages/Parties/PartyMasterPage';
import SalesInvoicesPage from './pages/Sales/SalesInvoicesPage';
import CreateInvoicePage from './pages/Sales/CreateInvoicePage';
import InvoiceDetailPage from './pages/Sales/InvoiceDetailPage';
import ReelStockPage from './pages/ReelStock/ReelStockPage';
import StockInwardPage from './pages/StockInward/StockInwardPage';
import RawMaterialPage from './pages/StockInward/RawMaterialPage';
import ProductionPage from './pages/Production/ProductionPage';
import FactoryWorkPage from './pages/FactoryWorkPage';
import ConversionPage from './pages/Conversion/ConversionPage';
import SheetPastingPage from './pages/Production/SheetPastingPage';
import DispatchPage from './pages/Operations/DispatchPage';
import FinishedGoodsPage from './pages/Operations/FinishedGoodsPage';
import JobWorkPage from './pages/Operations/JobWorkPage';
import ReelCuttingPage from './pages/Operations/ReelCuttingPage';
import StockLedgerPage from './pages/Reports/StockLedgerPage';
import WasteRegisterPage from './pages/Reports/WasteRegisterPage';
import OpeningStockPage from './pages/Reports/OpeningStockPage';
import UserManagementPage from './pages/Reports/UserManagementPage';
import StockReconciliationPage from './pages/Reports/StockReconciliationPage';
import ProfitLossPage from './pages/Reports/ProfitLossPage';
import ExpensesPage from './pages/Reports/ExpensesPage';
import PeriodActivityPage from './pages/Reports/PeriodActivityPage';
import AdminRecordsPage from './pages/Reports/AdminRecordsPage';
import ProductSpecificationPage from './pages/Products/ProductSpecificationPage';
import ProductionIntelligencePage from './pages/Production/ProductionIntelligencePage';
import FinancialHealthPage from './pages/Reports/FinancialHealthPage';
import InventoryValuationPage from './pages/Reports/InventoryValuationPage';
import SalesDispatchReconciliationPage from './pages/Reports/SalesDispatchReconciliationPage';
import NSBOverviewPage from './pages/NSB/NSBOverviewPage';
import FinancePage from './pages/Finance/FinancePage';
import CompanyProfilePage from './pages/Settings/CompanyProfilePage';
import RouteErrorBoundary from './components/RouteErrorBoundary';
import { DialogProvider } from './context/DialogContext';

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
    { group: 'Accounts & Sales', items: [
      { name: 'Customers & Suppliers', path: '/parties', icon: Users },
      { name: 'Sales Invoices', path: '/sales', icon: FileText },
      { name: 'SK B Sales', path: '/b-sales', icon: Receipt },
      { name: 'Purchase & Stock Inward', path: '/inventory/inward', icon: ArrowDownToLine },
      { name: 'Expenses', path: '/expenses', icon: Receipt },
      { name: 'Bank & Cash', path: '/finance', icon: Wallet },
      ...(user?.role === 'admin' ? [{ name: 'Firm Details', path: '/settings/company', icon: Building2 }] : []),
      { name: 'Customer & Supplier Dues', path: '/reports/financial-health', icon: Wallet },
      { name: 'Profit & Loss', path: '/reports/profit-loss', icon: ChartNoAxesCombined },
      { name: 'Daily & Monthly Reports', path: '/reports/activity', icon: ChartNoAxesCombined },
      { name: 'Sales Reconciliation', path: '/reports/sales-reconciliation', icon: ClipboardCheck },
      { name: 'New GST Invoice', path: '/sales/new', icon: FilePlus2 }
    ] },
    { group: 'Stock', items: [
      { name: 'Reel Stock', path: '/inventory/reels', icon: Package },
      { name: 'Raw Material Stock', path: '/inventory/raw-materials', icon: ArrowDownToLine },
      { name: 'Stock Register', path: '/inventory/ledger', icon: BookOpen },
      { name: 'Inventory Valuation', path: '/reports/inventory-valuation', icon: ChartNoAxesCombined },
      { name: 'Finished Goods Stock', path: '/operations/finished-goods', icon: Package }
    ] },
    { group: 'Reports & Administration', items: [
      { name: 'Opening Stock', path: '/admin/opening-stock', icon: ShieldCheck },
      ...(user?.role === 'admin' ? [{ name: 'User Management', path: '/admin/users', icon: Users }] : []),
      { name: 'Stock Reconciliation', path: '/admin/stock-reconciliation', icon: ClipboardCheck },
      ...(user?.role === 'admin' ? [{ name: 'Data Console', path: '/admin/data', icon: Database }] : []),
      { name: 'Product Details', path: '/admin/products', icon: ClipboardCheck }
    ] },
    { group: 'Factory', items: [
      { name: 'Factory Work', path: '/factory', icon: Factory }
    ] },
    ...(user?.role === 'admin' ? [{ group: 'NSB Industrial Solutions', items: [
      { name: 'NSB Overview', path: '/nsb', icon: Building2 },
      { name: 'NSB Customers & Suppliers', path: '/nsb/parties', icon: Users },
      { name: 'NSB Expenses', path: '/nsb/expenses', icon: Receipt },
      { name: 'NSB Bank & Cash', path: '/nsb/finance', icon: Wallet },
      { name: 'NSB Firm Details', path: '/nsb/settings/company', icon: Building2 },
      { name: 'NSB Sales Invoices', path: '/nsb/sales', icon: FileText }
    ] }] : [])
  ];

  const handleLogout = async () => {
    if (signingOut) return;
    setSigningOut(true);
    try { await logout(); } finally { navigate('/login', { replace: true }); setSigningOut(false); }
  };

  return (
    <aside className="flex h-dvh w-64 shrink-0 flex-col border-r border-slate-200 bg-slate-900 text-slate-300">
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
  const location = useLocation();
  return (
    <div className="flex h-dvh min-h-0 overflow-hidden bg-slate-50 font-sans">
      <Sidebar />
      <main className="min-h-0 min-w-0 flex-1 overflow-y-auto p-4 sm:p-8">
        <RouteErrorBoundary key={location.pathname} pathname={location.pathname}>
          <Outlet />
        </RouteErrorBoundary>
      </main>
    </div>
  );
}

export default function App() {
  const { user, loading } = useAuth();
  return (
    <DialogProvider>
    <Routes>
      <Route path="/login" element={loading ? <div className="flex min-h-screen items-center justify-center text-sm text-slate-500">Checking your session…</div> : user ? <Navigate to="/" replace /> : <LoginPage />} />
      <Route element={<RequireAuth />}>
        <Route element={<AppLayout />}>
          <Route index element={<Overview />} />
          <Route path="factory" element={<FactoryWorkPage />} />
          <Route path="nsb" element={user?.role === 'admin' ? <NSBOverviewPage /> : <Navigate to="/" replace />} />
          <Route path="nsb/expenses" element={user?.role === 'admin' ? <ExpensesPage company="nsb" /> : <Navigate to="/" replace />} />
          <Route path="nsb/finance" element={user?.role === 'admin' ? <FinancePage company="nsb" /> : <Navigate to="/" replace />} />
          <Route path="nsb/settings/company" element={user?.role === 'admin' ? <CompanyProfilePage company="nsb" /> : <Navigate to="/" replace />} />
          <Route path="nsb/sales" element={user?.role === 'admin' ? <SalesInvoicesPage company="nsb" /> : <Navigate to="/" replace />} />
          <Route path="nsb/sales/new" element={user?.role === 'admin' ? <CreateInvoicePage company="nsb" /> : <Navigate to="/" replace />} />
          <Route path="nsb/sales/:id" element={user?.role === 'admin' ? <InvoiceDetailPage company="nsb" /> : <Navigate to="/" replace />} />
          <Route path="nsb/parties" element={user?.role === 'admin' ? <PartyMasterPage company="nsb" /> : <Navigate to="/" replace />} />
          <Route path="parties" element={<PartyMasterPage />} />
          <Route path="sales" element={<SalesInvoicesPage />} />
          <Route path="sales/new" element={<CreateInvoicePage />} />
          <Route path="sales/:id" element={<InvoiceDetailPage />} />
          <Route path="b-sales" element={<SalesInvoicesPage workspace="sk-b-sales" />} />
          <Route path="b-sales/new" element={<CreateInvoicePage workspace="sk-b-sales" />} />
          <Route path="b-sales/:id" element={<InvoiceDetailPage workspace="sk-b-sales" />} />
          <Route path="reports/profit-loss" element={<ProfitLossPage />} />
          <Route path="reports/financial-health" element={<FinancialHealthPage />} />
          <Route path="reports/activity" element={<PeriodActivityPage />} />
          <Route path="reports/inventory-valuation" element={<InventoryValuationPage />} />
          <Route path="reports/sales-reconciliation" element={<SalesDispatchReconciliationPage />} />
          <Route path="expenses" element={<ExpensesPage />} />
          <Route path="finance" element={<FinancePage />} />
          <Route path="settings/company" element={user?.role === 'admin' ? <CompanyProfilePage /> : <Navigate to="/" replace />} />
          <Route path="inventory/reels" element={<ReelStockPage />} />
          <Route path="inventory/inward" element={<StockInwardPage />} />
          <Route path="inventory/raw-materials" element={<RawMaterialPage />} />
          <Route path="inventory/inwards" element={<Navigate to="/inventory/inward" replace />} />
          <Route path="inventory/ledger" element={<StockLedgerPage />} />
          <Route path="operations/production" element={<ProductionPage />} />
          <Route path="operations/pasting" element={<SheetPastingPage />} />
          <Route path="operations/production-intelligence" element={<ProductionIntelligencePage />} />
          <Route path="operations/conversion" element={<ConversionPage />} />
          <Route path="operations/dispatch" element={<DispatchPage />} />
          <Route path="operations/finished-goods" element={<FinishedGoodsPage />} />
          <Route path="operations/reel-cutting" element={<ReelCuttingPage />} />
          <Route path="operations/job-work" element={<JobWorkPage />} />
          <Route path="operations/waste" element={<WasteRegisterPage />} />
          <Route path="admin/opening-stock" element={<OpeningStockPage />} />
          <Route path="admin/users" element={user?.role === 'admin' ? <UserManagementPage /> : <Navigate to="/" replace />} />
          <Route path="admin/stock-reconciliation" element={<StockReconciliationPage />} />
          <Route path="admin/data" element={user?.role === 'admin' ? <AdminRecordsPage /> : <Navigate to="/" replace />} />
          <Route path="admin/products" element={<ProductSpecificationPage />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to={user ? '/' : '/login'} replace />} />
    </Routes>
    </DialogProvider>
  );
}