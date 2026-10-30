import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import {
  Store,
  Shield,
  User,
  Lock,
  Wifi,
  WifiOff,
  Sun,
  Moon,
  PlusCircle,
  FileSpreadsheet,
  ChevronDown,
  ChevronRight,
  ShoppingBag,
  Shirt,
  Building2,
  Check,
  Bell,
  Code2,
  Users,
  CreditCard,
  FileText,
  Gift,
  LogOut,
  HelpCircle,
  History,
  ArrowLeft,
} from 'lucide-react';
import { LekhoLogo } from '../common/LekhoLogo';
import {
  canAccessSettingsTab,
  canManageOperators,
  resolveAuthorizedSettingsTab,
} from '../../utils/securityPolicy';

interface NavbarProps {
  onOpenOnboarding: () => void;
  onOpenZReport: () => void;
  onOpenPinModal: () => void;
  onNavigate?: (tab: string, subtab?: string) => void;
  activeTab?: string;
  pageTitle?: string;
  onBack?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  onOpenOnboarding,
  onOpenZReport,
  onOpenPinModal,
  onNavigate,
  activeTab,
  pageTitle,
  onBack,
}) => {
  const {
    currentTenant,
    tenants,
    switchTenant,
    role,
    switchRole,
    isOffline,
    toggleSimulatedOffline,
    theme,
    toggleTheme,
    showToast,
    logout,
    language,
    setLanguage,
    pickText,
  } = useApp();

  const [storeMenuOpen, setStoreMenuOpen] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);

  const showDeveloperApi = canAccessSettingsTab(role, 'api');
  const showManageOperators = canManageOperators(role);
  const showPayments = canAccessSettingsTab(role, 'payments');
  const showProfile = canAccessSettingsTab(role, 'profile');

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return (
          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-400 dark:border-emerald-800/60 shrink-0">
            Active
          </span>
        );
      case 'grace':
        return (
          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/50 dark:text-amber-400 dark:border-amber-800/60 shrink-0">
            Grace
          </span>
        );
      default:
        return (
          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-950/50 dark:text-rose-400 dark:border-rose-800/60 shrink-0">
            Expired
          </span>
        );
    }
  };

  const getCategoryIcon = (category: string) => {
    if (category === 'jersey') return <Shirt className="w-3.5 h-3.5 text-[#1f8a5b] dark:text-emerald-400 shrink-0" strokeWidth={1.75} />;
    if (category === 'clothing') return <ShoppingBag className="w-3.5 h-3.5 text-[#164e3f] dark:text-emerald-400 shrink-0" strokeWidth={1.75} />;
    return <Building2 className="w-3.5 h-3.5 text-[#1f8a5b] dark:text-emerald-400 shrink-0" strokeWidth={1.75} />;
  };

  const handleProfileMenuItemClick = (tab: string, subtab?: string) => {
    setProfileMenuOpen(false);
    if (onNavigate) {
      onNavigate(tab, subtab);
    }
  };

  return (
    <header
      className={`${
        activeTab === 'pos' ? 'hidden md:block' : ''
      } sticky top-0 z-40 border-b border-slate-200/80 dark:border-zinc-800/90 bg-white/95 dark:bg-zinc-950/95 backdrop-blur-md text-slate-800 dark:text-zinc-100 select-none transition-colors duration-150`}
    >
      <div className="max-w-7xl mx-auto px-3.5 sm:px-5 lg:px-6 h-14 sm:h-16 flex items-center justify-between gap-2">
        {/* MOBILE SUB-PAGE HEADER: Clean back arrow, section title, and context action */}
        {activeTab && activeTab !== 'home' ? (
          <div className="flex md:hidden items-center justify-between w-full py-1 gap-2">
            <div className="flex items-center gap-2.5 min-w-0">
              <button
                type="button"
                onClick={onBack || (() => onNavigate && onNavigate('home'))}
                className="w-9 h-9 rounded-full bg-[#ebf4f0] hover:bg-[#dcece5] dark:bg-zinc-800 dark:hover:bg-zinc-750 text-slate-900 dark:text-white flex items-center justify-center transition cursor-pointer active:scale-95 shrink-0 border border-emerald-200/70 dark:border-zinc-700"
                title="Back to Previous Page"
                aria-label="Back"
              >
                <ArrowLeft className="w-4 h-4 text-slate-800 dark:text-white" strokeWidth={2.2} />
              </button>
              <div className="min-w-0">
                <h1 className="text-base font-extrabold text-slate-900 dark:text-white truncate tracking-tight">
                  {pageTitle || currentTenant.name}
                </h1>
              </div>
            </div>

            {activeTab === 'invoices' && onNavigate && (
              <button
                type="button"
                onClick={() => onNavigate('pos')}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-[#0d5c3e] hover:bg-[#094730] text-white text-xs font-bold shadow-2xs transition cursor-pointer shrink-0 active:scale-95"
              >
                <PlusCircle className="w-3.5 h-3.5" strokeWidth={2.2} />
                <span>Create Order</span>
              </button>
            )}
          </div>
        ) : null}

        {/* DESKTOP NAVBAR (and mobile when on home) */}
        <div className={`${activeTab && activeTab !== 'home' ? 'hidden md:flex' : 'flex'} items-center justify-between w-full gap-2`}>
          {/* Official LEKHO Brand Lockup (Left Branding Area) */}
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <div
              onClick={() => onNavigate && onNavigate('home')}
              className="flex items-center gap-2 shrink-0 cursor-pointer group"
              title="Return to LEKHO Home Hub"
            >
              <LekhoLogo size="sm" showSubtitle={false} />
            </div>
          </div>

        {/* Right controls - clean on mobile, full utility bar on desktop */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {/* Verified Role Badge (Desktop) — Role changes require PIN or Authenticated Login */}
          <div className="hidden lg:flex items-center gap-1.5 bg-slate-100 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-zinc-200">
            {role === 'shop_owner' ? (
              <>
                <Store className="w-3.5 h-3.5 text-[#1f8a5b] dark:text-emerald-400" strokeWidth={1.75} />
                <span>Owner</span>
              </>
            ) : role === 'manager' ? (
              <>
                <Shield className="w-3.5 h-3.5 text-[#164e3f] dark:text-emerald-400" strokeWidth={1.75} />
                <span>Manager</span>
              </>
            ) : role === 'super_admin' ? (
              <>
                <Shield className="w-3.5 h-3.5 text-[#164e3f] dark:text-emerald-400" strokeWidth={1.75} />
                <span>Platform Admin</span>
              </>
            ) : (
              <>
                <User className="w-3.5 h-3.5 text-[#1f8a5b] dark:text-emerald-400" strokeWidth={1.75} />
                <span>Salesman</span>
              </>
            )}
          </div>

          {/* Notifications Bell with Unread Dot (Matches Demo Screenshots) */}
          <div className="relative">
            <button
              onClick={() => setNotificationsOpen(!notificationsOpen)}
              className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-zinc-900 text-slate-700 dark:text-zinc-200 transition cursor-pointer relative"
              title="Notifications"
            >
              <Bell className="w-4 h-4 sm:w-[18px] sm:h-[18px]" strokeWidth={1.9} />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-amber-500 rounded-full ring-2 ring-white dark:ring-zinc-950" />
            </button>

            {notificationsOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setNotificationsOpen(false)} />
                <div className="absolute right-0 mt-2 w-60 sm:w-64 max-w-[calc(100vw-24px)] bg-white/80 dark:bg-zinc-900/80 backdrop-blur-xl rounded-2xl shadow-xl shadow-black/15 p-2.5 z-50 animate-in fade-in zoom-in-95 space-y-1.5 text-xs">
                  <div className="font-bold text-slate-900 dark:text-white pb-1 flex justify-between items-center text-[11px]">
                    <span>Notifications</span>
                    <span className="text-[10px] text-[#1f8a5b] dark:text-emerald-400 font-bold">3 New</span>
                  </div>
                  <div className="space-y-1.5 max-h-56 overflow-y-auto">
                    <div className="p-2 rounded-xl bg-black/4 dark:bg-white/5">
                      <strong className="text-slate-900 dark:text-white block text-[11px]">Low Stock Alert</strong>
                      <span className="text-[10px] text-slate-500 dark:text-zinc-400 leading-tight block mt-0.5">৪টি জার্সি আইটেম স্টক শেষ হতে চলেছে।</span>
                    </div>
                    <div className="p-2 rounded-xl bg-black/4 dark:bg-white/5">
                      <strong className="text-slate-900 dark:text-white block text-[11px]">Heat-Press Queue</strong>
                      <span className="text-[10px] text-slate-500 dark:text-zinc-400 leading-tight block mt-0.5">৪টি কাস্টম অর্ডার প্রিন্টের জন্য অপেক্ষায়।</span>
                    </div>
                    <div className="p-2 rounded-xl bg-black/4 dark:bg-white/5">
                      <strong className="text-slate-900 dark:text-white block text-[11px]">Daily Z-Report Ready</strong>
                      <span className="text-[10px] text-slate-500 dark:text-zinc-400 leading-tight block mt-0.5">আজকের ক্যাশ ও ডিজিটাল ব্যালেন্স অডিট প্রস্তুত।</span>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Quick Fast PIN switch (Desktop) */}
          <button
            onClick={onOpenPinModal}
            className="hidden lg:flex items-center gap-1 bg-slate-100 hover:bg-slate-200/80 dark:bg-zinc-900 dark:hover:bg-zinc-800 border border-slate-200 dark:border-zinc-800 text-slate-700 dark:text-zinc-200 px-2.5 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer shrink-0"
            title="Fast 4-Digit PIN Switch (Shift Change / Cashier Login)"
          >
            <Lock className="w-3.5 h-3.5 text-amber-500" strokeWidth={1.75} />
            <span>PIN</span>
          </button>

          {/* Z-Report button (Desktop) */}
          <button
            onClick={onOpenZReport}
            className="hidden lg:flex items-center gap-1 bg-slate-100 hover:bg-slate-200/80 dark:bg-zinc-900 dark:hover:bg-zinc-800 border border-slate-200 dark:border-zinc-800 text-slate-700 dark:text-zinc-200 px-2.5 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer shrink-0"
            title="End of Day Shift Handover (Z-Report)"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-[#1f8a5b] dark:text-emerald-400" strokeWidth={1.75} />
            <span>Z-Report</span>
          </button>

          {/* Offline / Cloud indicator (Desktop) */}
          <button
            onClick={toggleSimulatedOffline}
            className={`hidden md:flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-semibold border transition cursor-pointer shrink-0 ${
              isOffline
                ? 'bg-amber-50 text-amber-700 border-amber-300 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800'
                : 'bg-[#e6f4ea] text-[#1f8a5b] border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800'
            }`}
            title="Click to simulate offline network cut or reconnect"
          >
            {isOffline ? <WifiOff className="w-3.5 h-3.5" strokeWidth={1.75} /> : <Wifi className="w-3.5 h-3.5" strokeWidth={1.75} />}
            <span>{isOffline ? 'Offline' : 'Cloud'}</span>
          </button>

          {/* Language Switcher (বাংলা / EN) */}
          <button
            type="button"
            onClick={() => {
              const next = language === 'bn' ? 'en' : 'bn';
              setLanguage(next);
              showToast(
                next === 'bn' ? 'ভাষা: বাংলা সক্রিয় হয়েছে' : 'Language: English active',
                'info'
              );
            }}
            className="px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200/80 dark:bg-zinc-900 dark:hover:bg-zinc-800 border border-slate-200 dark:border-zinc-800 text-xs font-extrabold text-slate-700 dark:text-zinc-200 transition cursor-pointer shrink-0"
            title="Switch Language (বাংলা / English)"
          >
            {language === 'bn' ? 'বাংলা / EN' : 'EN / বাংলা'}
          </button>

          {/* Dark / Light Mode Toggle */}
          <button
            onClick={toggleTheme}
            className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-zinc-900 text-slate-700 dark:text-zinc-200 transition cursor-pointer shrink-0"
            title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} Mode`}
            aria-label="Toggle Theme"
          >
            {theme === 'dark' ? (
              <Sun className="w-4 h-4 sm:w-[18px] sm:h-[18px] text-amber-400" strokeWidth={1.9} />
            ) : (
              <Moon className="w-4 h-4 sm:w-[18px] sm:h-[18px] text-slate-700" strokeWidth={1.9} />
            )}
          </button>

          {/* Merchant Profile Badge & Dropdown */}
          <div className="relative shrink-0">
            <button
              onClick={() => setProfileMenuOpen(!profileMenuOpen)}
              className="flex items-center gap-1.5 sm:gap-2 p-1 sm:px-2.5 sm:py-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-zinc-900 sm:bg-slate-100 sm:dark:bg-zinc-900 sm:border sm:border-slate-200 sm:dark:border-zinc-800 text-slate-800 dark:text-zinc-200 transition cursor-pointer group"
              title="Merchant User Profile & Management"
            >
              <div className="w-7 h-7 sm:w-6 sm:h-6 rounded-xl sm:rounded-lg bg-[#e6f4ea] text-[#1f8a5b] dark:bg-emerald-950 dark:text-emerald-300 text-xs font-extrabold flex items-center justify-center shrink-0">
                {currentTenant.name.charAt(0)}
              </div>
              <div className="text-left hidden md:block">
                <div className="text-xs font-bold leading-tight truncate max-w-[110px] text-slate-900 dark:text-white">
                  {currentTenant.name.split(' ')[0]}
                </div>
                <div className="text-[9px] text-slate-400 dark:text-zinc-500 capitalize leading-none">
                  {role === 'shop_owner' ? 'Merchant' : role}
                </div>
              </div>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 dark:text-zinc-500 hidden sm:block group-hover:text-slate-700 dark:group-hover:text-zinc-300 transition-transform duration-150" />
            </button>

            {/* Profile Dropdown Menu */}
            {profileMenuOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setProfileMenuOpen(false)} />
                <div className="absolute right-0 mt-2 w-64 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl shadow-2xl p-2 z-50 animate-in fade-in zoom-in-95 space-y-1 text-xs">
                  {/* Top user summary badge */}
                  <div className="px-3 py-2 bg-[#f4f7f5] dark:bg-zinc-950 rounded-xl">
                    <div className="font-bold text-slate-900 dark:text-white text-xs truncate">
                      {currentTenant.name}
                    </div>
                    <div className="flex items-center justify-between text-[10px] text-slate-500 dark:text-zinc-400 mt-0.5">
                      <span>ID: {currentTenant.merchantId || '190832'}</span>
                      <span className="text-[#1f8a5b] dark:text-emerald-400 font-semibold uppercase">
                        {role === 'shop_owner' ? 'Owner' : role}
                      </span>
                    </div>
                  </div>

                  <div className="pt-1">
                    {/* 0. Categories & Pricing (Always accessible) */}
                    <button
                      onClick={() => handleProfileMenuItemClick('settings', 'categories')}
                      className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-slate-700 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800 transition cursor-pointer"
                    >
                      <div className="flex items-center gap-2">
                        <ShoppingBag className="w-3.5 h-3.5 text-[#1f8a5b] dark:text-emerald-400" />
                        <span>Categories & Price</span>
                      </div>
                      <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                    </button>

                    {/* 1. Issue History */}
                    <button
                      onClick={() => {
                        handleProfileMenuItemClick('dashboard');
                        showToast('Activity log & system issue audit view', 'info');
                      }}
                      className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-slate-700 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800 transition cursor-pointer"
                    >
                      <div className="flex items-center gap-2">
                        <History className="w-3.5 h-3.5 text-slate-500 dark:text-zinc-400" />
                        <span>Issue History</span>
                      </div>
                      <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                    </button>

                    {/* 2. Developer's API (Owner Only) */}
                    {showDeveloperApi && (
                      <button
                        onClick={() => handleProfileMenuItemClick('settings', 'api')}
                        className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-slate-700 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800 transition cursor-pointer"
                      >
                        <div className="flex items-center gap-2">
                          <Code2 className="w-3.5 h-3.5 text-[#164e3f] dark:text-emerald-400" />
                          <span>Developer's API</span>
                        </div>
                        <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                      </button>
                    )}

                    {/* 3. Manage Operators (Owner Only) */}
                    {showManageOperators && (
                      <button
                        onClick={() => handleProfileMenuItemClick('settings', 'operators')}
                        className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-slate-700 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800 transition cursor-pointer"
                      >
                        <div className="flex items-center gap-2">
                          <Users className="w-3.5 h-3.5 text-[#1f8a5b] dark:text-emerald-400" />
                          <span>Manage Operators</span>
                        </div>
                        <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                      </button>
                    )}

                    {/* 4. Payment Information (Owner Only) */}
                    {showPayments && (
                      <button
                        onClick={() => handleProfileMenuItemClick('settings', 'payments')}
                        className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-slate-700 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800 transition cursor-pointer"
                      >
                        <div className="flex items-center gap-2">
                          <CreditCard className="w-3.5 h-3.5 text-[#164e3f] dark:text-emerald-400" />
                          <span>Payment Information</span>
                        </div>
                        <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                      </button>
                    )}

                    {/* 5. Profile */}
                    {showProfile && (
                      <button
                        onClick={() => handleProfileMenuItemClick('settings', resolveAuthorizedSettingsTab(role, 'profile'))}
                        className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-slate-700 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800 transition cursor-pointer"
                      >
                        <div className="flex items-center gap-2">
                          <Store className="w-3.5 h-3.5 text-[#1f8a5b] dark:text-emerald-400" />
                          <span>Profile & Store</span>
                        </div>
                        <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                      </button>
                    )}

                    {/* 6. Invoices & Billing */}
                    <button
                      onClick={() => handleProfileMenuItemClick('invoices')}
                      className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-slate-700 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800 transition cursor-pointer"
                    >
                      <div className="flex items-center gap-2">
                        <FileText className="w-3.5 h-3.5 text-[#164e3f] dark:text-emerald-400" />
                        <span>Invoices & Accounts</span>
                      </div>
                      <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                    </button>

                    {/* 7. Help Center & Policies */}
                    <button
                      onClick={() => handleProfileMenuItemClick('help')}
                      className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-slate-700 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800 transition cursor-pointer"
                    >
                      <div className="flex items-center gap-2">
                        <HelpCircle className="w-3.5 h-3.5 text-[#1f8a5b] dark:text-emerald-400" />
                        <span>{pickText('হেল্প সেন্টার ও পলিসি', 'Help Center & Policies')}</span>
                      </div>
                      <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                    </button>

                    {/* 7.5 All Settings Hub */}
                    <button
                      onClick={() => handleProfileMenuItemClick('settings', 'hub')}
                      className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-slate-700 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800 transition cursor-pointer"
                    >
                      <div className="flex items-center gap-2">
                        <Gift className="w-3.5 h-3.5 text-[#164e3f] dark:text-emerald-400" />
                        <span>{pickText('সব সেটিংস তালিকা', 'All Store Settings')}</span>
                      </div>
                      <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                    </button>
                  </div>

                  {/* 8. Logout & Lock */}
                  <div className="pt-1 border-t border-slate-100 dark:border-zinc-800 space-y-1">
                    <button
                      onClick={() => {
                        setProfileMenuOpen(false);
                        logout();
                      }}
                      className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition cursor-pointer font-semibold"
                    >
                      <div className="flex items-center gap-2">
                        <LogOut className="w-3.5 h-3.5" />
                        <span>Logout / Sign In Screen</span>
                      </div>
                    </button>
                    <button
                      onClick={() => {
                        setProfileMenuOpen(false);
                        onOpenPinModal();
                      }}
                      className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/30 transition cursor-pointer font-semibold"
                    >
                      <div className="flex items-center gap-2">
                        <Lock className="w-3.5 h-3.5" />
                        <span>Lock Shift (PIN Code)</span>
                      </div>
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  </header>
);
};
