import React, { useState, useEffect } from 'react';
import { AppProvider, useApp } from './context/AppContext';
import {
  canAccessAppRoute,
  canViewBuyingPrice,
  getDefaultSettingsTabForRole,
  isClothingShop,
  isSportswearShop,
  resolveAuthorizedSettingsTab,
  sanitizeNavigationTabForShop,
  SettingsTabId,
} from './utils/securityPolicy';
import {
  buildUrlForTab,
  normalizeAppTab,
  parseTabFromLocation,
} from './utils/themeTokens';
import { Navbar } from './components/layout/Navbar';
import { ImpersonationBanner } from './components/layout/ImpersonationBanner';
import { HomeScreenHub } from './components/home/HomeScreenHub';
import { UserProfileModal } from './components/profile/UserProfileModal';
import { InvoiceLedgerView } from './components/invoices/InvoiceLedgerView';
import { POSCounter } from './components/pos/POSCounter';
import { PrintPipelineBoard } from './components/jersey/PrintPipelineBoard';
import { TeamBulkOrderMatrix } from './components/jersey/TeamBulkOrderMatrix';
import { ResellerCounter } from './components/jersey/ResellerCounter';
import { AlterationTracker } from './components/apparel/AlterationTracker';
import { WholesaleLotSplitter } from './components/apparel/WholesaleLotSplitter';
import { DeadStockAlerts } from './components/apparel/DeadStockAlerts';
import { SizeExchangeModal } from './components/apparel/SizeExchangeModal';
import { MultiDrawerManager } from './components/financials/MultiDrawerManager';
import { ExpenseLedger } from './components/financials/ExpenseLedger';
import { ZReportModal } from './components/financials/ZReportModal';
import { DailyClosingPage } from './components/financials/DailyClosingPage';
import { DueListView } from './components/financials/DueListView';
import { CustomersView } from './components/home/CustomersView';
import { SuperAdminDashboard } from './components/admin/SuperAdminDashboard';
import { StoreAdminDashboard } from './components/dashboard/StoreAdminDashboard';
import { StoreSettings } from './components/store/StoreSettings';
import { StoreOnboardingModal } from './components/onboarding/StoreOnboardingModal';
import { PinLockModal } from './components/auth/PinLockModal';
import { AuthPage } from './components/auth/AuthPage';
import {
  Home,
  LayoutDashboard,
  ShoppingCart,
  Flame,
  Trophy,
  Truck,
  Scissors,
  Calculator,
  AlertTriangle,
  ArrowRightLeft,
  Wallet,
  Receipt,
  Settings,
  Shield,
  WifiOff,
  ChevronDown,
  Layers,
  FileText,
  X,
  CheckCircle2,
  Package,
  Sparkles,
  HelpCircle,
} from 'lucide-react';
import { ProductVariantCatalogManager } from './components/inventory/ProductVariantCatalogManager';
import { LekhoHelpCenter } from './components/help/LekhoHelpCenter';

export type MainTabType =
  | 'home'
  | 'dashboard'
  | 'pos'
  | 'inventory'
  | 'offer_announcement'
  | 'pipeline'
  | 'team'
  | 'reseller'
  | 'alteration'
  | 'lot_splitter'
  | 'dead_stock'
  | 'size_exchange'
  | 'drawers'
  | 'expenses'
  | 'settings'
  | 'invoices'
  | 'due_list'
  | 'customers'
  | 'daily_closing'
  | 'help'
  | 'auth';

const MainLayout: React.FC = () => {
  const {
    currentTenant,
    role,
    activeStaff,
    isOffline,
    toast,
    dismissToast,
    isAuthenticated,
    setIsAuthenticated,
    showToast,
    pickText,
  } = useApp();

  // Navigation tab state initialized from URL query/path/hash (defaults to 'home')
  const [activeTab, setActiveTab] = useState<MainTabType>(() => {
    if (typeof window === 'undefined') return 'home';
    const parsed = parseTabFromLocation(
      window.location.search,
      window.location.pathname,
      window.location.hash
    );
    const safeTab = sanitizeNavigationTabForShop(parsed.tab, currentTenant);
    if (!canAccessAppRoute(role, safeTab, currentTenant)) return 'home';
    return safeTab as MainTabType;
  });
  const [settingsSubtab, setSettingsSubtab] = useState<SettingsTabId | 'hub'>(() => {
    if (typeof window !== 'undefined') {
      const parsed = parseTabFromLocation(
        window.location.search,
        window.location.pathname,
        window.location.hash
      );
      if (parsed.tab === 'settings') {
        if (!parsed.subtab || parsed.subtab === 'hub') return 'hub';
        return resolveAuthorizedSettingsTab(role, parsed.subtab);
      }
    }
    return 'hub';
  });
  const [customersSubtab, setCustomersSubtab] = useState<'directory' | 'festive'>(() => {
    if (typeof window !== 'undefined') {
      const parsed = parseTabFromLocation(
        window.location.search,
        window.location.pathname,
        window.location.hash
      );
      if (parsed.subtab === 'festive') return 'festive';
    }
    return 'directory';
  });

  // Dropdown states for uncluttered navigation
  const [isOperationsOpen, setIsOperationsOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Modals
  const [isOnboardingOpen, setIsOnboardingOpen] = useState(false);
  const [isZReportOpen, setIsZReportOpen] = useState(false);
  const [isPinModalOpen, setIsPinModalOpen] = useState(false);
  const [isExchangeModalOpen, setIsExchangeModalOpen] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);

  const isJerseyStore = isSportswearShop(currentTenant);
  const isClothingStore = isClothingShop(currentTenant);
  const isSalesman = role === 'salesman';
  const showBuyingPrice = canViewBuyingPrice(role);

  useEffect(() => {
    const safeTab = sanitizeNavigationTabForShop(activeTab, currentTenant);
    if (!canAccessAppRoute(role, safeTab, currentTenant)) {
      setActiveTab('home');
      return;
    }
    if (safeTab !== activeTab) {
      setActiveTab(safeTab as MainTabType);
    }
  }, [activeTab, currentTenant, role]);

  useEffect(() => {
    setSettingsSubtab((prev) => (prev === 'hub' ? 'hub' : resolveAuthorizedSettingsTab(role, prev)));
  }, [role]);

  // Sync browser URL with activeTab & support browser Back / Forward buttons
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const targetUrl = buildUrlForTab(
      activeTab,
      activeTab === 'settings' ? settingsSubtab : undefined,
      window.location.pathname
    );
    const currentUrl = `${window.location.pathname}${window.location.search}`;
    if (currentUrl !== targetUrl) {
      window.history.pushState({ tab: activeTab, subtab: settingsSubtab }, '', targetUrl);
    }
  }, [activeTab, settingsSubtab]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handlePopState = () => {
      const parsed = parseTabFromLocation(
        window.location.search,
        window.location.pathname,
        window.location.hash
      );
      const safeTab = sanitizeNavigationTabForShop(parsed.tab, currentTenant);
      if (canAccessAppRoute(role, safeTab, currentTenant)) {
        setActiveTab(safeTab as MainTabType);
        if (safeTab === 'settings') {
          setSettingsSubtab(
            !parsed.subtab || parsed.subtab === 'hub'
              ? 'hub'
              : resolveAuthorizedSettingsTab(role, parsed.subtab)
          );
        }
      } else {
        setActiveTab('home');
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [currentTenant, role]);

  const isOperationsActive = [
    'pipeline',
    'team',
    'alteration',
    'lot_splitter',
    'dead_stock',
    'size_exchange',
    'expenses',
  ].includes(activeTab);

  const getOperationsLabel = () => {
    switch (activeTab) {
      case 'pipeline':
        return 'Heat-Press Pipeline';
      case 'team':
        return 'Team Bulk Matrix';
      case 'alteration':
        return 'Tailoring Tracker';
      case 'lot_splitter':
        return 'Lot Cost Splitter';
      case 'dead_stock':
        return 'Dead-Stock Alerts';
      case 'size_exchange':
        return 'Size Exchange';
      case 'expenses':
        return 'Expense Ledger';
      default:
        return 'Operations & Tools';
    }
  };

  const getPageTitle = (tab: string) => {
    switch (tab) {
      case 'pos':
        return 'POS Counter';
      case 'inventory':
        return 'Inventory';
      case 'offer_announcement':
        return 'Festive Offers';
      case 'invoices':
        return 'Sales & Invoices';
      case 'customers':
        return customersSubtab === 'festive' ? 'Festive Offers' : 'Customers';
      case 'daily_closing':
        return 'Daily Closing';
      case 'due_list':
        return 'Due List';
      case 'reseller':
        return 'Wholesale & Reseller';
      case 'drawers':
        return 'Multi-Drawer';
      case 'expenses':
        return 'Expenses';
      case 'pipeline':
        return 'Jersey Print Center';
      case 'team':
        return 'Team Bulk Orders';
      case 'lot_splitter':
        return 'Lot Cost Splitter';
      case 'dead_stock':
        return 'Dead Stock';
      case 'size_exchange':
        return 'Size Exchange';
      case 'alteration':
        return 'Tailoring & Alteration';
      case 'dashboard':
        return 'Summary';
      case 'settings':
        return 'Store Settings';
      case 'help':
        return 'Help Center';
      default:
        return 'LEKHO POS';
    }
  };

  const handleNavigate = (tab: string, subtab?: string) => {
    if (tab === 'profile') {
      setIsProfileModalOpen(true);
      return;
    }
    if (tab === 'offer_announcement' || (tab === 'customers' && subtab === 'festive')) {
      setCustomersSubtab('festive');
      setActiveTab('customers');
      return;
    }
    if (tab === 'customers') {
      setCustomersSubtab(subtab === 'festive' ? 'festive' : 'directory');
    }
    const normalizedTab = normalizeAppTab(tab);
    const safeTab = sanitizeNavigationTabForShop(normalizedTab, currentTenant);
    if (!canAccessAppRoute(role, safeTab, currentTenant)) {
      showToast('এই পেজে শুধুমাত্র দোকানের মালিক (Shop Owner) প্রবেশ করতে পারবেন।', 'warning');
      setActiveTab('home');
      return;
    }
    if (safeTab === 'settings') {
      if (!subtab || subtab === 'hub') {
        setSettingsSubtab('hub');
      } else {
        setSettingsSubtab(resolveAuthorizedSettingsTab(role, subtab));
      }
    }
    setActiveTab(safeTab as MainTabType);
  };

  const topToastBanner = toast ? (
    <div
      role="status"
      aria-live="polite"
      className="fixed top-[max(0.75rem,env(safe-area-inset-top))] left-1/2 -translate-x-1/2 z-[90] w-auto max-w-[calc(100vw-2rem)] sm:max-w-sm pointer-events-none flex justify-center"
    >
      <div
        className={`pointer-events-auto flex items-center justify-between gap-2 px-3 py-1.5 rounded-full shadow-lg shadow-black/10 text-[11px] sm:text-xs font-semibold leading-tight transition-all animate-in fade-in slide-in-from-top-3 duration-150 backdrop-blur-xl ${
          toast.type === 'success'
            ? 'bg-[#e6f4ea]/80 dark:bg-zinc-900/85 text-[#164e3f] dark:text-emerald-300'
            : toast.type === 'error'
            ? 'bg-rose-50/80 dark:bg-zinc-900/85 text-rose-900 dark:text-rose-300'
            : toast.type === 'warning'
            ? 'bg-amber-50/80 dark:bg-zinc-900/85 text-amber-950 dark:text-amber-300'
            : 'bg-white/80 dark:bg-zinc-900/85 text-slate-900 dark:text-zinc-100'
        }`}
      >
        <div className="flex items-center gap-2 min-w-0">
          {toast.type === 'success' && (
            <CheckCircle2 className="w-3.5 h-3.5 text-[#1f8a5b] dark:text-emerald-400 shrink-0" />
          )}
          {toast.type === 'error' && (
            <AlertTriangle className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400 shrink-0" />
          )}
          {toast.type === 'warning' && (
            <AlertTriangle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
          )}
          {toast.type === 'info' && (
            <div className="w-2 h-2 rounded-full bg-[#164e3f] dark:bg-emerald-400 shrink-0" />
          )}
          <span className="truncate max-w-[230px] sm:max-w-xs">{toast.message}</span>
        </div>
        <button
          type="button"
          onClick={dismissToast}
          aria-label="Dismiss notification"
          className="p-0.5 rounded-full text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/10 transition cursor-pointer shrink-0 ml-1"
        >
          <X className="w-3 h-3" />
        </button>
      </div>
    </div>
  ) : null;

  // Dedicated Full-Screen Login / Sign In / Create Account Screen with Cover Photo
  if (!isAuthenticated || activeTab === 'auth') {
    return (
      <>
        {topToastBanner}
        <AuthPage
          onSuccess={() => {
            setIsAuthenticated(true);
            setActiveTab('home');
          }}
          onBypass={() => {
            setIsAuthenticated(true);
            setActiveTab('home');
          }}
        />
      </>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 dark:bg-zinc-950 dark:text-zinc-100 flex flex-col font-sans transition-colors duration-150 selection:bg-emerald-600 selection:text-white dark:selection:bg-emerald-500 dark:selection:text-zinc-950">
      {/* Super Admin Shadow Impersonation Banner */}
      <ImpersonationBanner />

      {/* Render dedicated full-screen HomeScreenHub on 'home' tab */}
      {activeTab === 'home' && role !== 'super_admin' ? (
        <HomeScreenHub
          onNavigate={handleNavigate}
          onOpenExchangeModal={() => handleNavigate('size_exchange')}
          onOpenZReportModal={() => setActiveTab('daily_closing')}
          onOpenPinModal={() => setIsPinModalOpen(true)}
          onOpenProfileModal={() => setIsProfileModalOpen(true)}
        />
      ) : (
        <>
          {/* Top Navbar for sub-screens */}
          <Navbar
            onOpenOnboarding={() => setIsOnboardingOpen(true)}
            onOpenZReport={() => setActiveTab('daily_closing')}
            onOpenPinModal={() => setIsPinModalOpen(true)}
            onNavigate={handleNavigate}
            activeTab={activeTab}
            pageTitle={getPageTitle(activeTab)}
            onBack={() => setActiveTab('home')}
          />

          {/* Offline Status Warning Bar */}
          {isOffline && (
            <div className="bg-amber-500 text-slate-950 text-xs font-bold px-4 py-2 flex items-center justify-between shadow-xs">
              <div className="flex items-center gap-2 max-w-7xl mx-auto w-full">
                <WifiOff className="w-4 h-4 shrink-0" strokeWidth={2} />
                <span>
                  <strong>Basement Offline Resilience Active:</strong> Local memory & IndexedDB storage running. All transactions will auto-sync when network returns.
                </span>
              </div>
            </div>
          )}

          {/* Main Container */}
          <main className="flex-1 max-w-7xl w-full mx-auto px-3 sm:px-4 lg:px-6 py-4 sm:py-6">
            {role === 'super_admin' ? (
              /* SUPER ADMIN VIEW */
              <SuperAdminDashboard />
            ) : (
              /* STORE ADMIN & SALESMAN VIEW */
              <div className="space-y-4 pb-20 lg:pb-6">
                {/* Desktop Secondary Navigation Toolbar (Hidden on Mobile where Bottom Nav is used) */}
                <div className="hidden lg:flex bg-white dark:bg-zinc-900 border border-slate-200/90 dark:border-zinc-800 rounded-2xl p-2 shadow-xs items-center justify-between gap-2 overflow-x-auto no-scrollbar">
                  {/* Desktop Nav Items */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    {/* 0. Home Hub Button */}
                    <button
                      onClick={() => setActiveTab('home')}
                      className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition cursor-pointer shrink-0 ${
                        activeTab === 'home'
                          ? 'bg-[#1f8a5b] text-white shadow-xs'
                          : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-zinc-800'
                      }`}
                      title="Main Home Screen"
                    >
                      <Home className="w-4 h-4" strokeWidth={1.75} />
                      <span>{pickText('হোম', 'Home')}</span>
                    </button>

                    {/* 1. Summary / Business Dashboard (Store Admin Only) */}
                    {!isSalesman && (
                      <button
                        onClick={() => setActiveTab('dashboard')}
                        className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition cursor-pointer shrink-0 ${
                          activeTab === 'dashboard'
                            ? 'bg-[#1f8a5b] text-white shadow-xs'
                            : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-zinc-800'
                        }`}
                        title="Summary Dashboard"
                      >
                        <LayoutDashboard className="w-4 h-4" strokeWidth={1.75} />
                        <span>{pickText('সারসংক্ষেপ', 'Summary')}</span>
                      </button>
                    )}

                    {/* 2. POS Billing Counter */}
                    <button
                      onClick={() => setActiveTab('pos')}
                      className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition cursor-pointer shrink-0 ${
                        activeTab === 'pos'
                          ? 'bg-[#1f8a5b] text-white shadow-xs'
                          : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-zinc-800'
                      }`}
                    >
                      <ShoppingCart className="w-4 h-4" strokeWidth={1.75} />
                      <span>{pickText('বিলিং কাউন্টার', 'POS Counter')}</span>
                    </button>

                    {/* 2.5 Inventory Management */}
                    <button
                      onClick={() => setActiveTab('inventory')}
                      className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition cursor-pointer shrink-0 ${
                        activeTab === 'inventory'
                          ? 'bg-[#1f8a5b] text-white shadow-xs'
                          : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-zinc-800'
                      }`}
                    >
                      <Package className="w-4 h-4" strokeWidth={1.75} />
                      <span>{pickText('ইনভেন্টরি', 'Inventory')}</span>
                    </button>

                    {/* 2.6 Offer Announcement */}
                    <button
                      onClick={() => handleNavigate('customers', 'festive')}
                      className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition cursor-pointer shrink-0 ${
                        activeTab === 'customers' && customersSubtab === 'festive'
                          ? 'bg-[#1f8a5b] text-white shadow-xs'
                          : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-zinc-800'
                      }`}
                    >
                      <Sparkles className="w-4 h-4" strokeWidth={1.75} />
                      <span>{pickText('অফার', 'Offers')}</span>
                    </button>

                    {/* 3. Invoices / Transactions Ledger */}
                    <button
                      onClick={() => setActiveTab('invoices')}
                      className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition cursor-pointer shrink-0 ${
                        activeTab === 'invoices'
                          ? 'bg-[#1f8a5b] text-white shadow-xs'
                          : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-zinc-800'
                      }`}
                      title="Transactions & Invoices"
                    >
                      <FileText className="w-4 h-4" strokeWidth={1.75} />
                      <span>{pickText('লেনদেন', 'Transactions')}</span>
                    </button>

                    {/* 4. Reseller Counter & Baki Khata */}
                    <button
                      onClick={() => setActiveTab('reseller')}
                      className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition cursor-pointer shrink-0 ${
                        activeTab === 'reseller'
                          ? 'bg-[#1f8a5b] text-white shadow-xs'
                          : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-zinc-800'
                      }`}
                      title="In-Store Wholesale Reseller Counter & Baki Khata"
                    >
                      <Truck className="w-4 h-4" strokeWidth={1.75} />
                      <span>{pickText('রিসেলার', 'Reseller')}</span>
                    </button>

                    {/* 5. Multi-Drawer Financials */}
                    <button
                      onClick={() => setActiveTab('drawers')}
                      className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition cursor-pointer shrink-0 ${
                        activeTab === 'drawers'
                          ? 'bg-[#1f8a5b] text-white shadow-xs'
                          : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-zinc-800'
                      }`}
                    >
                      <Wallet className="w-4 h-4" strokeWidth={1.75} />
                      <span>{pickText('মাল্টি-ড্রয়ার', 'Multi-Drawers')}</span>
                    </button>

                    {/* 6. Store & Product Settings */}
                    <button
                      onClick={() => handleNavigate('settings', 'hub')}
                      className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition cursor-pointer shrink-0 ${
                        activeTab === 'settings'
                          ? 'bg-[#1f8a5b] text-white shadow-xs'
                          : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-zinc-800'
                      }`}
                    >
                      <Settings className="w-4 h-4" strokeWidth={1.75} />
                      <span>{pickText('সেটিংস', 'Settings')}</span>
                    </button>

                    {/* 7. Help Center */}
                    <button
                      onClick={() => handleNavigate('help')}
                      className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition cursor-pointer shrink-0 ${
                        activeTab === 'help'
                          ? 'bg-[#1f8a5b] text-white shadow-xs'
                          : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-zinc-800'
                      }`}
                    >
                      <HelpCircle className="w-4 h-4" strokeWidth={1.75} />
                      <span>{pickText('হেল্প সেন্টার', 'Help Center')}</span>
                    </button>
                  </div>

                  {/* Right Side Utility Actions (Desktop) */}
                  <div className="flex items-center gap-2">
                    {/* 10s Size Exchange Full-Page Launcher */}
                    <button
                      onClick={() => handleNavigate('size_exchange')}
                      className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold border transition cursor-pointer shadow-2xs ${
                        activeTab === 'size_exchange'
                          ? 'bg-[#164e3f] text-white border-[#164e3f]'
                          : 'text-[#1f8a5b] dark:text-emerald-300 bg-[#e6f4ea] hover:bg-emerald-100 dark:bg-emerald-950/40 dark:hover:bg-emerald-900/50 border-emerald-200 dark:border-emerald-800/60'
                      }`}
                      title="10-Second Size Exchange Engine"
                    >
                      <ArrowRightLeft className="w-3.5 h-3.5" strokeWidth={1.75} />
                      <span>Size Exchange</span>
                    </button>

                    {/* Staff Session Badge */}
                    <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-zinc-400 pl-2 border-l border-slate-200 dark:border-zinc-800">
                      <span className="w-2 h-2 rounded-full bg-[#1f8a5b] animate-pulse" />
                      <span className="truncate max-w-[120px] font-medium text-slate-700 dark:text-zinc-300">
                        {activeStaff ? activeStaff.name.split(' ')[0] : 'Staff'}
                      </span>
                      {isSalesman && (
                        <span className="text-[10px] bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 px-1.5 py-0.2 rounded font-medium">
                          Blind
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Active Tab Component Rendering */}
                {activeTab === 'dashboard' && (
                  <StoreAdminDashboard onNavigate={(tab) => handleNavigate(tab as any)} />
                )}
                {activeTab === 'pos' && (
                  <POSCounter
                    onNavigateToReseller={() => setActiveTab('reseller')}
                    onNavigateHome={() => setActiveTab('home')}
                  />
                )}
                {activeTab === 'inventory' && (
                  <ProductVariantCatalogManager
                    mode="inventory_page"
                    onNavigate={handleNavigate}
                  />
                )}
                {activeTab === 'invoices' && (
                  <InvoiceLedgerView onNavigateToPOS={() => setActiveTab('pos')} />
                )}
                {activeTab === 'due_list' && (
                  <DueListView onNavigateToPOS={() => setActiveTab('pos')} />
                )}
                {(activeTab === 'customers' || activeTab === 'offer_announcement') && (
                  <CustomersView
                    initialSubTab={activeTab === 'offer_announcement' ? 'festive' : customersSubtab}
                    onNavigateToPOS={() => setActiveTab('pos')}
                    onBack={() => setActiveTab('home')}
                  />
                )}
                {activeTab === 'daily_closing' && (
                  <DailyClosingPage onBack={() => setActiveTab('home')} />
                )}
                {activeTab === 'pipeline' && isJerseyStore && <PrintPipelineBoard />}
                {activeTab === 'team' && isJerseyStore && <TeamBulkOrderMatrix />}
                {activeTab === 'reseller' && <ResellerCounter />}
                {activeTab === 'alteration' && <AlterationTracker />}
                {activeTab === 'lot_splitter' && (
                  <WholesaleLotSplitter onBack={() => setActiveTab('home')} />
                )}
                {activeTab === 'dead_stock' && <DeadStockAlerts />}
                {activeTab === 'size_exchange' && (
                  <SizeExchangeModal
                    isOpen={true}
                    mode="page"
                    onBack={() => handleNavigate('home')}
                    onClose={() => handleNavigate('home')}
                  />
                )}
                {activeTab === 'drawers' && <MultiDrawerManager />}
                {activeTab === 'expenses' && <ExpenseLedger />}
                {activeTab === 'settings' && (
                  <StoreSettings initialTab={settingsSubtab} onBack={() => setActiveTab('home')} />
                )}
                {activeTab === 'help' && (
                  <LekhoHelpCenter onBack={() => setActiveTab('home')} />
                )}

                {/* End of content */}
              </div>
            )}
          </main>
        </>
      )}

      {/* Clean Mobile Bottom Navigation Bar */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white dark:bg-zinc-900 border-t border-slate-200/80 dark:border-zinc-800 px-2 py-1.5 shadow-md">
        <div className="grid grid-cols-4 gap-1 max-w-md mx-auto">
          <button
            type="button"
            onClick={() => setActiveTab('home')}
            className="flex flex-col items-center justify-center py-1 gap-0.5 cursor-pointer"
          >
            <div
              className={`px-4 py-1 rounded-full transition ${
                activeTab === 'home'
                  ? 'bg-[#e6f4ea] text-[#1f8a5b] dark:bg-emerald-950/70 dark:text-emerald-400'
                  : 'text-slate-500 dark:text-zinc-400'
              }`}
            >
              <Home className="w-4 h-4" strokeWidth={2} />
            </div>
            <span
              className={`text-[10px] ${
                activeTab === 'home'
                  ? 'font-bold text-[#1f8a5b] dark:text-emerald-400'
                  : 'font-medium text-slate-500 dark:text-zinc-400'
              }`}
            >
              Home
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('pos')}
            className="flex flex-col items-center justify-center py-1 gap-0.5 cursor-pointer"
          >
            <div
              className={`px-4 py-1 rounded-full transition ${
                activeTab === 'pos'
                  ? 'bg-[#e6f4ea] text-[#1f8a5b] dark:bg-emerald-950/70 dark:text-emerald-400'
                  : 'text-slate-500 dark:text-zinc-400'
              }`}
            >
              <ShoppingCart className="w-4 h-4" strokeWidth={2} />
            </div>
            <span
              className={`text-[10px] ${
                activeTab === 'pos'
                  ? 'font-bold text-[#1f8a5b] dark:text-emerald-400'
                  : 'font-medium text-slate-500 dark:text-zinc-400'
              }`}
            >
              POS
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('invoices')}
            className="flex flex-col items-center justify-center py-1 gap-0.5 cursor-pointer"
          >
            <div
              className={`px-4 py-1 rounded-full transition ${
                activeTab === 'invoices'
                  ? 'bg-[#e6f4ea] text-[#1f8a5b] dark:bg-emerald-950/70 dark:text-emerald-400'
                  : 'text-slate-500 dark:text-zinc-400'
              }`}
            >
              <FileText className="w-4 h-4" strokeWidth={2} />
            </div>
            <span
              className={`text-[10px] ${
                activeTab === 'invoices'
                  ? 'font-bold text-[#1f8a5b] dark:text-emerald-400'
                  : 'font-medium text-slate-500 dark:text-zinc-400'
              }`}
            >
              Sales
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('expenses')}
            className="flex flex-col items-center justify-center py-1 gap-0.5 cursor-pointer"
          >
            <div
              className={`px-4 py-1 rounded-full transition ${
                activeTab === 'expenses'
                  ? 'bg-[#e6f4ea] text-[#1f8a5b] dark:bg-emerald-950/70 dark:text-emerald-400'
                  : 'text-slate-500 dark:text-zinc-400'
              }`}
            >
              <Receipt className="w-4 h-4" strokeWidth={2} />
            </div>
            <span
              className={`text-[10px] ${
                activeTab === 'expenses'
                  ? 'font-bold text-[#1f8a5b] dark:text-emerald-400'
                  : 'font-medium text-slate-500 dark:text-zinc-400'
              }`}
            >
              Expense
            </span>
          </button>
        </div>
      </nav>

      {/* Global Modals */}
      <StoreOnboardingModal
        isOpen={isOnboardingOpen}
        onClose={() => setIsOnboardingOpen(false)}
      />

      <ZReportModal
        isOpen={isZReportOpen}
        onClose={() => setIsZReportOpen(false)}
      />

      <PinLockModal
        isOpen={isPinModalOpen}
        onClose={() => setIsPinModalOpen(false)}
      />

      {isExchangeModalOpen && (
        <SizeExchangeModal
          isOpen={isExchangeModalOpen}
          mode="modal"
          onClose={() => setIsExchangeModalOpen(false)}
          onBack={() => setIsExchangeModalOpen(false)}
        />
      )}

      <UserProfileModal
        isOpen={isProfileModalOpen}
        onClose={() => setIsProfileModalOpen(false)}
        onNavigateToSettings={(subtab) => {
          setSettingsSubtab(resolveAuthorizedSettingsTab(role, subtab));
          setActiveTab('settings');
        }}
        onNavigateToInvoices={() => setActiveTab('invoices')}
        onOpenPinModal={() => setIsPinModalOpen(true)}
        onOpenZReport={() => setIsZReportOpen(true)}
      />

      {/* Global Operations & Specialized Tools Modal */}
      {isOperationsOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 dark:bg-black/75 backdrop-blur-xs flex items-center justify-center p-2.5 sm:p-4 overflow-y-auto animate-in fade-in duration-150">
          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-3xl max-w-md w-full p-4 shadow-2xl text-slate-900 dark:text-zinc-100 relative my-auto max-h-[88dvh] flex flex-col overflow-hidden">
            <div className="flex items-center justify-between pb-2.5 border-b border-slate-200 dark:border-zinc-800 shrink-0">
              <h3 className="lekho-modal-title text-slate-900 dark:text-white truncate">
                Operations & Tools
              </h3>
              <button
                onClick={() => setIsOperationsOpen(false)}
                className="w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 text-slate-500 hover:text-slate-800 dark:hover:text-white flex items-center justify-center cursor-pointer shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-3 overflow-y-auto pr-0.5">
              <button
                onClick={() => {
                  setActiveTab('reseller');
                  setIsOperationsOpen(false);
                }}
                className={`p-3 rounded-2xl border transition text-left cursor-pointer flex items-center gap-2.5 ${
                  activeTab === 'reseller'
                    ? 'bg-[#e6f4ea] dark:bg-emerald-950/40 border-[#1f8a5b]'
                    : 'bg-[#f4f7f5] dark:bg-zinc-950 border-slate-200/80 dark:border-zinc-800 hover:border-[#1f8a5b]'
                }`}
              >
                <Truck className="w-4 h-4 text-[#1f8a5b] shrink-0" />
                <strong className="text-xs font-bold text-slate-900 dark:text-white truncate">
                  Reseller Counter
                </strong>
              </button>

              {isJerseyStore && (
                <button
                  onClick={() => {
                    setActiveTab('pipeline');
                    setIsOperationsOpen(false);
                  }}
                  className={`p-3 rounded-2xl border transition text-left cursor-pointer flex items-center gap-2.5 ${
                    activeTab === 'pipeline'
                      ? 'bg-[#e6f4ea] dark:bg-emerald-950/40 border-[#1f8a5b]'
                      : 'bg-[#f4f7f5] dark:bg-zinc-950 border-slate-200/80 dark:border-zinc-800 hover:border-[#1f8a5b]'
                  }`}
                >
                  <Flame className="w-4 h-4 text-[#1f8a5b] shrink-0" />
                  <strong className="text-xs font-bold text-slate-900 dark:text-white truncate">
                    Print Pipeline
                  </strong>
                </button>
              )}

              {isJerseyStore && (
                <button
                  onClick={() => {
                    setActiveTab('team');
                    setIsOperationsOpen(false);
                  }}
                  className={`p-3 rounded-2xl border transition text-left cursor-pointer flex items-center gap-2.5 ${
                    activeTab === 'team'
                      ? 'bg-[#e6f4ea] dark:bg-emerald-950/40 border-[#1f8a5b]'
                      : 'bg-[#f4f7f5] dark:bg-zinc-950 border-slate-200/80 dark:border-zinc-800 hover:border-[#1f8a5b]'
                  }`}
                >
                  <Trophy className="w-4 h-4 text-[#1f8a5b] shrink-0" />
                  <strong className="text-xs font-bold text-slate-900 dark:text-white truncate">
                    Team Bulk Matrix
                  </strong>
                </button>
              )}

              <button
                onClick={() => {
                  setActiveTab('alteration');
                  setIsOperationsOpen(false);
                }}
                className={`p-3 rounded-2xl border transition text-left cursor-pointer flex items-center gap-2.5 ${
                  activeTab === 'alteration'
                    ? 'bg-[#e6f4ea] dark:bg-emerald-950/40 border-[#1f8a5b]'
                    : 'bg-[#f4f7f5] dark:bg-zinc-950 border-slate-200/80 dark:border-zinc-800 hover:border-[#1f8a5b]'
                }`}
              >
                <Scissors className="w-4 h-4 text-[#1f8a5b] shrink-0" />
                <strong className="text-xs font-bold text-slate-900 dark:text-white truncate">
                  Alterations
                </strong>
              </button>

              {showBuyingPrice && (
                <button
                  onClick={() => {
                    setActiveTab('lot_splitter');
                    setIsOperationsOpen(false);
                  }}
                  className={`p-3 rounded-2xl border transition text-left cursor-pointer flex items-center gap-2.5 ${
                    activeTab === 'lot_splitter'
                      ? 'bg-[#e6f4ea] dark:bg-emerald-950/40 border-[#1f8a5b]'
                      : 'bg-[#f4f7f5] dark:bg-zinc-950 border-slate-200/80 dark:border-zinc-800 hover:border-[#1f8a5b]'
                  }`}
                >
                  <Calculator className="w-4 h-4 text-[#1f8a5b] shrink-0" />
                  <strong className="text-xs font-bold text-slate-900 dark:text-white truncate">
                    Lot Cost Splitter
                  </strong>
                </button>
              )}

              <button
                onClick={() => {
                  setActiveTab('dead_stock');
                  setIsOperationsOpen(false);
                }}
                className={`p-3 rounded-2xl border transition text-left cursor-pointer flex items-center gap-2.5 ${
                  activeTab === 'dead_stock'
                    ? 'bg-[#e6f4ea] dark:bg-emerald-950/40 border-[#1f8a5b]'
                    : 'bg-[#f4f7f5] dark:bg-zinc-950 border-slate-200/80 dark:border-zinc-800 hover:border-[#1f8a5b]'
                }`}
              >
                <AlertTriangle className="w-4 h-4 text-[#1f8a5b] shrink-0" />
                <strong className="text-xs font-bold text-slate-900 dark:text-white truncate">
                  Dead Stock
                </strong>
              </button>

              <button
                onClick={() => {
                  setActiveTab('expenses');
                  setIsOperationsOpen(false);
                }}
                className={`p-3 rounded-2xl border transition text-left cursor-pointer flex items-center gap-2.5 ${
                  activeTab === 'expenses'
                    ? 'bg-[#e6f4ea] dark:bg-emerald-950/40 border-[#1f8a5b]'
                    : 'bg-[#f4f7f5] dark:bg-zinc-950 border-slate-200/80 dark:border-zinc-800 hover:border-[#1f8a5b]'
                }`}
              >
                <Receipt className="w-4 h-4 text-[#1f8a5b] shrink-0" />
                <strong className="text-xs font-bold text-slate-900 dark:text-white truncate">
                  Expenses
                </strong>
              </button>

              <button
                onClick={() => {
                  setIsOperationsOpen(false);
                  handleNavigate('size_exchange');
                }}
                className={`p-3 rounded-2xl border transition text-left cursor-pointer flex items-center gap-2.5 ${
                  activeTab === 'size_exchange'
                    ? 'bg-[#e6f4ea] dark:bg-emerald-950/40 border-[#1f8a5b]'
                    : 'bg-[#f4f7f5] dark:bg-zinc-950 border-slate-200/80 dark:border-zinc-800 hover:border-[#1f8a5b]'
                }`}
              >
                <ArrowRightLeft className="w-4 h-4 text-[#1f8a5b] shrink-0" />
                <strong className="text-xs font-bold text-slate-900 dark:text-white truncate">
                  Size Exchange
                </strong>
              </button>

              <button
                onClick={() => {
                  handleNavigate('settings', 'hub');
                  setIsOperationsOpen(false);
                }}
                className={`p-3 rounded-2xl border transition text-left cursor-pointer flex items-center gap-2.5 ${
                  activeTab === 'settings'
                    ? 'bg-[#e6f4ea] dark:bg-emerald-950/40 border-[#1f8a5b]'
                    : 'bg-[#f4f7f5] dark:bg-zinc-950 border-slate-200/80 dark:border-zinc-800 hover:border-[#1f8a5b]'
                }`}
              >
                <Settings className="w-4 h-4 text-[#1f8a5b] shrink-0" />
                <strong className="text-xs font-bold text-slate-900 dark:text-white truncate">
                  {pickText('স্টোর সেটিংস', 'Store Settings')}
                </strong>
              </button>

              <button
                onClick={() => {
                  handleNavigate('help');
                  setIsOperationsOpen(false);
                }}
                className={`p-3 rounded-2xl border transition text-left cursor-pointer flex items-center gap-2.5 ${
                  activeTab === 'help'
                    ? 'bg-[#e6f4ea] dark:bg-emerald-950/40 border-[#1f8a5b]'
                    : 'bg-[#f4f7f5] dark:bg-zinc-950 border-slate-200/80 dark:border-zinc-800 hover:border-[#1f8a5b]'
                }`}
              >
                <HelpCircle className="w-4 h-4 text-[#1f8a5b] shrink-0" />
                <strong className="text-xs font-bold text-slate-900 dark:text-white truncate">
                  {pickText('হেল্প সেন্টার', 'Help Center')}
                </strong>
              </button>

              <button
                onClick={() => {
                  setIsOperationsOpen(false);
                  setActiveTab('daily_closing');
                }}
                className="p-3 rounded-2xl border bg-[#f4f7f5] dark:bg-zinc-950 border-slate-200/80 dark:border-zinc-800 hover:border-[#1f8a5b] transition text-left cursor-pointer flex items-center gap-2.5"
              >
                <LayoutDashboard className="w-4 h-4 text-[#1f8a5b] shrink-0" />
                <strong className="text-xs font-bold text-slate-900 dark:text-white truncate">
                  Daily Closing
                </strong>
              </button>

              <button
                onClick={() => {
                  setIsOperationsOpen(false);
                  setActiveTab('auth');
                }}
                className="p-3 rounded-2xl border bg-emerald-50/70 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-850 hover:border-[#164e3f] transition text-left cursor-pointer flex items-center gap-2.5"
              >
                <Shield className="w-4 h-4 text-[#0e382d] dark:text-emerald-300 shrink-0" />
                <strong className="text-xs font-bold text-[#0e382d] dark:text-emerald-300 truncate">
                  Sign In Screen
                </strong>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Top-Positioned Toast Notification Container */}
      {topToastBanner}
    </div>
  );
};

export default function App() {
  return (
    <AppProvider>
      <MainLayout />
    </AppProvider>
  );
}
