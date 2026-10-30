import React, { useState, useRef, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { dbService } from '../../services/db';
import { CustomersModal } from './CustomersModal';
import { UniversalSearchModal } from './UniversalSearchModal';
import { LekhoLogo } from '../common/LekhoLogo';
import { StoreSettings } from '../store/StoreSettings';
import {
  canAccessSettingsTab,
  canManageOperators,
  canViewBuyingPrice,
  getSettingsSidePanelClassName,
  isClothingShop,
  resolveAuthorizedSettingsTab,
  resolveSettingsSidePanelWidth,
  SettingsTabId,
} from '../../utils/securityPolicy';
import {
  Search,
  Bell,
  Sun,
  Moon,
  MoreVertical,
  Menu,
  Camera,
  ArrowRight,
  ChevronRight,
  X,
  CreditCard,
  User,
  Building2,
  Users,
  HelpCircle,
  TrendingUp,
  Settings,
  Calendar,
  FileText,
  ArrowLeftRight,
  MessageSquare,
  Info,
  Shield,
  Layers,
  Sparkles,
  ShoppingBag,
  Wallet,
  Receipt,
  Store,
  DollarSign,
  PlusCircle,
  CheckCircle,
  Flame,
  Scissors,
  Calculator,
  AlertTriangle,
  Upload,
  Image as ImageIcon,
  Check,
  Truck,
  Lock,
  LogOut,
  ChevronDown,
  Package,
  Pencil,
} from 'lucide-react';

interface HomeScreenHubProps {
  onNavigate: (tab: string, subtab?: string) => void;
  onOpenExchangeModal: () => void;
  onOpenZReportModal: () => void;
  onOpenPinModal: () => void;
  onOpenProfileModal: () => void;
}

const DEFAULT_HEADER_COVER_URL =
  'https://images.unsplash.com/photo-1574629810360-7efbbe195018?auto=format&fit=crop&w=1400&q=80';

// Curated Cover Banners (Official LEKHO Merchant & Fashion Retail)
const PRESET_BANNERS = [
  {
    id: 'preset_2',
    name: 'Jersey Craft & Print Studio',
    url: 'https://images.unsplash.com/photo-1574629810360-7efbbe195018?auto=format&fit=crop&w=1400&q=80',
  },
  {
    id: 'preset_1',
    name: 'Sports Stadium & Lights',
    url: 'https://images.unsplash.com/photo-1508098682722-e99c43a406b2?auto=format&fit=crop&w=1400&q=80',
  },
  {
    id: 'preset_3',
    name: 'Modern Streetwear Store',
    url: 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&w=1400&q=80',
  },
  {
    id: 'preset_lekho_official',
    name: 'LEKHO Merchant Official Banner',
    url: '/assets/aistudio/image_a4e83847.png',
  },
  {
    id: 'preset_4',
    name: 'Clean Emerald Wave Theme',
    url: '',
  },
];

export const HomeScreenHub: React.FC<HomeScreenHubProps> = ({
  onNavigate,
  onOpenExchangeModal,
  onOpenZReportModal,
  onOpenPinModal,
  onOpenProfileModal,
}) => {
  const {
    currentTenant,
    tenants,
    switchTenant,
    role,
    activeStaff,
    theme,
    toggleTheme,
    showToast,
    reloadShopData,
    logout,
    language,
    setLanguage,
    pickText,
  } = useApp();

  const isClothingStore = isClothingShop(currentTenant);
  const showBuyingPrice = canViewBuyingPrice(role);
  const showManageOperators = canManageOperators(role);
  const showPaymentAccounts = canAccessSettingsTab(role, 'payments');
  const showBusinessProfile = canAccessSettingsTab(role, 'profile');
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);
  const [showBalance, setShowBalance] = useState(false);
  const [isLangMenuOpen, setIsLangMenuOpen] = useState(false);
  const [isCustomersOpen, setIsCustomersOpen] = useState(false);
  const [isStoreMenuOpen, setIsStoreMenuOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [isCoverModalOpen, setIsCoverModalOpen] = useState(false);
  const [isOperationsModalOpen, setIsOperationsModalOpen] = useState(false);
  const [isSettingsSidePanelOpen, setIsSettingsSidePanelOpen] = useState(false);
  const [settingsPanelNavState, setSettingsPanelNavState] = useState<{
    showSettingsHub: boolean;
    activeSettingsTab: SettingsTabId;
  }>({
    showSettingsHub: true,
    activeSettingsTab: 'profile',
  });
  const [settingsHubOpenTrigger, setSettingsHubOpenTrigger] = useState(0);
  const settingsPanelScrollRef = useRef<HTMLDivElement>(null);

  const handleOpenSettingsSidePanel = () => {
    setSettingsPanelNavState((prev) => ({
      ...prev,
      showSettingsHub: true,
    }));
    setSettingsHubOpenTrigger((prev) => prev + 1);
    setIsSettingsSidePanelOpen(true);
  };

  const closeDrawer = () => {
    setIsSettingsSidePanelOpen(false);
  };

  useEffect(() => {
    if (settingsPanelScrollRef.current) {
      settingsPanelScrollRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [settingsPanelNavState.showSettingsHub, settingsPanelNavState.activeSettingsTab]);
  
  const [coverPhoto, setCoverPhoto] = useState<string | null>(
    () => currentTenant.coverPhoto || DEFAULT_HEADER_COVER_URL
  );
  const fileInputRef = useRef<HTMLInputElement>(null);
  const langMenuRef = useRef<HTMLDivElement>(null);

  // Global keyboard shortcut: Cmd+K / Ctrl+K opens search; Escape closes custom language dropdown
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsSearchModalOpen((prev) => !prev);
      } else if (e.key === 'Escape') {
        setIsLangMenuOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Close custom language menu when clicking outside
  useEffect(() => {
    if (!isLangMenuOpen) return;
    const handleOutsideClick = (e: MouseEvent | TouchEvent) => {
      if (langMenuRef.current && !langMenuRef.current.contains(e.target as Node)) {
        setIsLangMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('touchstart', handleOutsideClick);
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('touchstart', handleOutsideClick);
    };
  }, [isLangMenuOpen]);

  useEffect(() => {
    setCoverPhoto(currentTenant.coverPhoto || null);
  }, [currentTenant.id, currentTenant.coverPhoto]);

  const activeHeaderCoverPhoto =
    coverPhoto && coverPhoto !== '/assets/aistudio/image_a4e83847.png'
      ? coverPhoto
      : DEFAULT_HEADER_COVER_URL;

  // Financial aggregates for live balance indicator
  const drawers = dbService.getShopDrawers(currentTenant.id);
  const totalBalance = Object.values(drawers).reduce(
    (sum, val) => sum + (Number(val) || 0),
    0
  );

  const invoices = dbService.getInvoices(currentTenant.id);
  const dueInvoicesCount = invoices.filter((i) => (i.dueAmount || 0) > 0 && !i.isSoftDeleted).length;
  const shopInventory = dbService.getInventory(currentTenant.id, role);
  const totalInventoryPieces = shopInventory.reduce((sum, item) => sum + (Number(item.totalStock) || 0), 0);

  // Save cover photo persistently
  const handleSaveCoverPhoto = (url: string | null) => {
    setCoverPhoto(url);
    dbService.updateTenant(currentTenant.id, {
      coverPhoto: url || undefined,
    });
    reloadShopData();
    setIsCoverModalOpen(false);
    if (url) {
      showToast('দোকানের কভার ফটো সফলভাবে আপডেট করা হয়েছে!', 'success');
    } else {
      showToast('ডিফল্ট মিন্ট ওয়েভ কভার সক্রিয় করা হয়েছে', 'info');
    }
  };

  // Handle local file upload
  const handleCoverFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      showToast('ছবির সাইজ সর্বোচ্চ ৫ মেগাবাইট হতে পারবে', 'warning');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        handleSaveCoverPhoto(reader.result);
      }
    };
    reader.onerror = () => {
      showToast('ছবি পড়তে সমস্যা হয়েছে, আবার চেষ্টা করুন', 'error');
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="flex flex-col lg:flex-row min-h-screen bg-slate-50 dark:bg-zinc-950 text-slate-800 dark:text-zinc-100 transition-colors duration-150">
      {/* Hidden File Input for Cover Photo Upload */}
      <input
        type="file"
        ref={fileInputRef}
        accept="image/*"
        onChange={handleCoverFileChange}
        className="hidden"
      />

      {/* ========================================================================= */}
      {/* DESKTOP LEFT SIDEBAR                                                      */}
      {/* ========================================================================= */}
      <aside className="hidden lg:flex flex-col w-64 bg-white dark:bg-zinc-900 border-r border-slate-200/90 dark:border-zinc-800 p-4 shrink-0 select-none justify-between">
        <div className="space-y-6">
          {/* Brand Header (Official LEKHO Logo) */}
          <div className="px-2 pt-1">
            <LekhoLogo
              variant="header"
              onClick={() => onNavigate('home')}
            />
          </div>

          {/* Navigation Items Group 1 */}
          <nav className="space-y-1">
            {/* 1. Home (Active pill) */}
            <button
              onClick={() => onNavigate('home')}
              className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 font-bold text-xs transition cursor-pointer shadow-2xs border border-emerald-200/60 dark:border-emerald-800/60"
            >
              <div className="w-5 h-5 rounded-lg bg-emerald-600 dark:bg-emerald-500 text-white flex items-center justify-center">
                <Store className="w-3 h-3" />
              </div>
              <span>{pickText('হোম হাব', 'Home Hub')}</span>
            </button>

            {/* 2. Operations & Tools (Direct from sidebar!) */}
            <button
              onClick={() => setIsOperationsModalOpen(true)}
              className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-2xl text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-zinc-850 font-medium text-xs transition cursor-pointer"
            >
              <Layers className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span>{pickText('অপারেশন ও টুলস', 'Operations & Tools')}</span>
            </button>

            {/* 2.5 Categories & Pricing (Accessible to Staff & Owner) */}
            <button
              onClick={() => onNavigate('settings', 'categories')}
              className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-2xl text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-zinc-850 font-medium text-xs transition cursor-pointer"
            >
              <ShoppingBag className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span>{pickText('ক্যাটাগরি ও দাম', 'Categories & Price')}</span>
            </button>

            {/* 2.6 Inventory Management */}
            <button
              onClick={() => onNavigate('inventory')}
              className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-2xl text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-zinc-850 font-medium text-xs transition cursor-pointer"
            >
              <Package className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span>{pickText('ইনভেন্টরি ও স্টক', 'Inventory')}</span>
            </button>

            {/* 2.7 Offer Announcement */}
            <button
              onClick={() => onNavigate('customers', 'festive')}
              className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-2xl text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-zinc-850 font-medium text-xs transition cursor-pointer"
            >
              <Sparkles className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span>{pickText('অফার ও উৎসব বার্তা', 'Offer Announcement')}</span>
            </button>

            {/* 3. Business profile */}
            {showBusinessProfile && (
              <button
                onClick={() => onNavigate('settings', 'profile')}
                className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-2xl text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-zinc-850 font-medium text-xs transition cursor-pointer"
              >
                <Building2 className="w-4 h-4 text-slate-400 dark:text-zinc-500" />
                <span>{pickText('বিজনেস প্রোফাইল', 'Business Profile')}</span>
              </button>
            )}

            {/* 4. Payment methods */}
            {showPaymentAccounts && (
              <button
                onClick={() => onNavigate('settings', 'payments')}
                className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-2xl text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-zinc-850 font-medium text-xs transition cursor-pointer"
              >
                <CreditCard className="w-4 h-4 text-slate-400 dark:text-zinc-500" />
                <span>{pickText('পেমেন্ট একাউন্ট', 'Payment Accounts')}</span>
              </button>
            )}

            {/* 5. Operators / Staff */}
            {showManageOperators && (
              <button
                onClick={() => onNavigate('settings', 'operators')}
                className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-2xl text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-zinc-850 font-medium text-xs transition cursor-pointer"
              >
                <Users className="w-4 h-4 text-slate-400 dark:text-zinc-500" />
                <span>{pickText('অপারেটর ও স্টাফ', 'Operators & Staff')}</span>
              </button>
            )}
          </nav>

          {/* Divider */}
          <div className="border-t border-slate-100 dark:border-zinc-800 my-2" />

          {/* Navigation Items Group 2 */}
          <nav className="space-y-1">
            {/* 6. Dashboard / Summary */}
            <button
              onClick={() => onNavigate('dashboard')}
              className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-2xl text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-zinc-850 font-medium text-xs transition cursor-pointer"
            >
              <TrendingUp className="w-4 h-4 text-slate-400 dark:text-zinc-500" />
              <span>{pickText('সামারি ড্যাশবোর্ড', 'Summary Dashboard')}</span>
            </button>

            {/* 7. Settings */}
            <button
              onClick={() => onNavigate('settings', 'hub')}
              className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-2xl text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-zinc-850 font-medium text-xs transition cursor-pointer"
            >
              <Settings className="w-4 h-4 text-slate-400 dark:text-zinc-500" />
              <span>{pickText('স্টোর সেটিংস', 'Store Settings')}</span>
            </button>

            {/* 8. DTF & Print Pipeline (Sportswear) or Tailoring & Alteration (Clothing) */}
            {isClothingStore ? (
              <button
                onClick={() => onNavigate('alteration')}
                className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-2xl text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-zinc-850 font-medium text-xs transition cursor-pointer"
              >
                <Scissors className="w-4 h-4 text-slate-400 dark:text-zinc-500" />
                <span>{pickText('অল্টারেশন ও টেইলারিং', 'Tailoring & Alteration')}</span>
              </button>
            ) : (
              <button
                onClick={() => onNavigate('pipeline')}
                className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-2xl text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-zinc-850 font-medium text-xs transition cursor-pointer"
              >
                <Flame className="w-4 h-4 text-slate-400 dark:text-zinc-500" />
                <span>{pickText('জার্সি প্রিন্ট পাইপলাইন', 'Jersey Print Pipeline')}</span>
              </button>
            )}

            {/* 9. Billing & Ledger */}
            <button
              onClick={() => onNavigate('invoices')}
              className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-2xl text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-zinc-850 font-medium text-xs transition cursor-pointer"
            >
              <FileText className="w-4 h-4 text-slate-400 dark:text-zinc-500" />
              <span>{pickText('বিক্রয় ও ইনভয়েস', 'Transactions & Invoices')}</span>
            </button>

            {/* 10. Help Centre */}
            <button
              onClick={() => onNavigate('help')}
              className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-2xl text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-zinc-850 font-medium text-xs transition cursor-pointer"
            >
              <HelpCircle className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span>{pickText('হেল্প সেন্টার ও গাইড', 'Help Center')}</span>
            </button>
          </nav>
        </div>

        {/* Sidebar Footer */}
        <div className="pt-4 border-t border-slate-100 dark:border-zinc-800">
          <div className="px-3 py-2.5 rounded-2xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-100 dark:border-emerald-800/40">
            <div className="text-xs font-bold text-emerald-900 dark:text-emerald-300">
              LEKHO POS
            </div>
            <div className="text-[11px] text-slate-500 dark:text-zinc-400">
              {currentTenant.name}
            </div>
            <div className="w-8 h-1 bg-emerald-500 rounded-full mt-1.5" />
          </div>
        </div>
      </aside>

      {/* ========================================================================= */}
      {/* MAIN CONTENT AREA                                                         */}
      {/* ========================================================================= */}
      <div className="flex-1 flex flex-col min-w-0 pb-16 lg:pb-4 relative">
        {/* ======================================================================= */}
        {/* MOBILE & TABLET INTEGRATED COVER + FROSTED-GLASS NAVBAR (< lg)          */}
        {/* ======================================================================= */}
        <header
          className="lg:hidden relative w-full h-40 sm:h-44 bg-cover bg-[center_35%] select-none"
          style={{ backgroundImage: `url(${activeHeaderCoverPhoto})` }}
        >
          {/* Top-to-80% Progressive Blur & Soft Fade Overlay (No abrupt cutoff) */}
          <div
            aria-hidden="true"
            className="absolute inset-x-0 top-0 h-[82%] pointer-events-none z-10"
            style={{
              background:
                'linear-gradient(180deg, rgba(4, 42, 29, 0.72) 0%, rgba(5, 48, 33, 0.54) 45%, rgba(5, 48, 33, 0.18) 76%, rgba(5, 48, 33, 0) 100%)',
              backdropFilter: 'blur(12px)',
              WebkitBackdropFilter: 'blur(12px)',
              maskImage:
                'linear-gradient(180deg, rgba(0, 0, 0, 1) 0%, rgba(0, 0, 0, 0.94) 44%, rgba(0, 0, 0, 0.42) 74%, rgba(0, 0, 0, 0) 100%)',
              WebkitMaskImage:
                'linear-gradient(180deg, rgba(0, 0, 0, 1) 0%, rgba(0, 0, 0, 0.94) 44%, rgba(0, 0, 0, 0.42) 74%, rgba(0, 0, 0, 0) 100%)',
            }}
          />

          {/* Row 1: Top-Right Cover Photo Edit Icon (No circular background/border) */}
          <div className="absolute top-[max(0.45rem,env(safe-area-inset-top))] right-3.5 sm:right-5 z-30 flex justify-end">
            <button
              type="button"
              onClick={() => setIsCoverModalOpen(true)}
              aria-label="Edit cover photo"
              title="Edit Cover Photo"
              className="p-1 text-white hover:opacity-80 active:scale-95 transition cursor-pointer bg-transparent border-0"
            >
              <Pencil className="w-4 h-4 drop-shadow-xs" strokeWidth={2.3} />
            </button>
          </div>

          {/* Row 2: Navbar Row Centered in Cover Photo (Equal spacing between all 6 controls) */}
          <div className="absolute inset-x-0 top-[43%] -translate-y-1/2 z-30 px-3.5 sm:px-6">
            <div className="w-full max-w-2xl mx-auto py-1 flex items-center justify-between">
              {/* 1. LEKHO White Leaf Logo */}
              <button
                type="button"
                onClick={() => onNavigate('home')}
                aria-label="LEKHO Home"
                className="p-0.5 text-white hover:opacity-85 transition cursor-pointer bg-transparent border-0 shrink-0"
              >
                <svg
                  viewBox="0 0 48 48"
                  className="w-6 h-6 sm:w-6.5 sm:h-6.5 text-white"
                  fill="currentColor"
                  aria-hidden="true"
                >
                  <path d="M23.2 38.5C15.5 34.2 10 25.4 12.2 14.5C19.8 15.8 24.4 22.1 24.2 31.8C21.5 26.2 18.2 22.4 15.6 20.4C17.8 24.5 20.6 29.8 23.2 38.5Z" />
                  <path d="M24.8 38.5C25.2 26.8 29.8 16.5 38.5 11.2C39.6 22.8 34.2 32.8 24.8 38.5ZM27.4 31.2C30.6 26.5 33.4 21.2 35.1 16.8C32.1 20.4 29.2 25.4 27.4 31.2Z" />
                </svg>
              </button>

              {/* 2. Fixed-Size White Pill Balance Control (Larger balance & Details text, reduced side padding) */}
              {!showBalance ? (
                <button
                  type="button"
                  onClick={() => setShowBalance(true)}
                  className="w-[128px] sm:w-[138px] h-7.5 sm:h-8 px-1.5 rounded-full bg-white text-[#063b2a] inline-flex items-center justify-center text-[11px] sm:text-xs font-extrabold tracking-tight shadow-2xs cursor-pointer shrink-0 whitespace-nowrap transition active:scale-95"
                >
                  Tap for Balance
                </button>
              ) : (
                <div className="w-[128px] sm:w-[138px] h-7.5 sm:h-8 px-2 rounded-full bg-white text-[#063b2a] inline-flex items-center justify-between gap-1 font-extrabold tracking-tight shadow-2xs shrink-0 overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setShowBalance(false)}
                    title="Tap to hide balance"
                    className="font-mono text-[13px] sm:text-sm font-extrabold text-[#063b2a] cursor-pointer bg-transparent border-0 p-0 leading-none truncate"
                  >
                    ৳{totalBalance.toLocaleString()}
                  </button>
                  <span className="w-px h-3.5 bg-slate-200 shrink-0" aria-hidden="true" />
                  <button
                    type="button"
                    onClick={() => onNavigate('drawers')}
                    className="text-xs sm:text-[13px] font-extrabold text-[#0d6847] hover:text-[#063b2a] underline underline-offset-2 cursor-pointer bg-transparent border-0 p-0 leading-none shrink-0"
                  >
                    Details
                  </button>
                </div>
              )}

              {/* 3. Compact Custom Language Selector Dropdown Pill */}
              <div ref={langMenuRef} className="relative shrink-0">
                <button
                  type="button"
                  onClick={() => setIsLangMenuOpen((prev) => !prev)}
                  aria-haspopup="listbox"
                  aria-expanded={isLangMenuOpen}
                  aria-label="Select Language"
                  className="h-7 sm:h-7.5 px-2.5 sm:px-3 rounded-full bg-white text-[#063b2a] inline-flex items-center justify-center gap-1 text-[10px] sm:text-[11px] font-extrabold shadow-2xs cursor-pointer transition active:scale-95"
                >
                  <span>{language === 'bn' ? 'বাংলা' : 'EN'}</span>
                  <ChevronDown
                    className={`w-3 h-3 text-[#0d6847] stroke-[2.5] transition-transform duration-150 ${
                      isLangMenuOpen ? 'rotate-180' : ''
                    }`}
                  />
                </button>

                {isLangMenuOpen && (
                  <div
                    role="listbox"
                    aria-label="Language options"
                    className="absolute top-full mt-2 left-1/2 -translate-x-1/2 min-w-[128px] bg-white dark:bg-zinc-900 border border-slate-200/90 dark:border-zinc-800 rounded-2xl shadow-xl p-1.5 z-50 space-y-1 animate-in fade-in zoom-in-95 duration-150"
                  >
                    {[
                      { code: 'bn' as const, label: 'বাংলা' },
                      { code: 'en' as const, label: 'English' },
                    ].map((opt) => {
                      const isSelected = language === opt.code;
                      return (
                        <button
                          key={opt.code}
                          type="button"
                          role="option"
                          aria-selected={isSelected}
                          onClick={() => {
                            setLanguage(opt.code);
                            setIsLangMenuOpen(false);
                            showToast(
                              opt.code === 'bn'
                                ? 'ভাষা: বাংলা সক্রিয় হয়েছে'
                                : 'Language: English active',
                              'info'
                            );
                          }}
                          className={`w-full px-3 py-1.5 rounded-xl flex items-center justify-between text-xs transition cursor-pointer ${
                            isSelected
                              ? 'bg-[#eaf7f1] dark:bg-emerald-950/60 text-[#063b2a] dark:text-emerald-300 font-extrabold'
                              : 'text-slate-700 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800 font-semibold'
                          }`}
                        >
                          <span>{opt.label}</span>
                          {isSelected && (
                            <Check className="w-3.5 h-3.5 text-[#0d6847] dark:text-emerald-400 shrink-0" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* 4. Search Icon */}
              <button
                type="button"
                onClick={() => setIsSearchModalOpen(true)}
                aria-label="Search"
                title={pickText('খুঁজুন (কাস্টমার ও মেমো)', 'Search (Customer & Memo)')}
                className="p-1 text-white hover:opacity-80 active:scale-95 transition cursor-pointer bg-transparent border-0 shrink-0"
              >
                <Search className="w-4.5 h-4.5 sm:w-5 sm:h-5" strokeWidth={2.2} />
              </button>

              {/* 5. Notification Bell with Unread Red Dot */}
              <div className="relative shrink-0">
                <button
                  type="button"
                  onClick={() => setIsNotificationsOpen(!isNotificationsOpen)}
                  aria-label="Notifications"
                  title="Notifications"
                  className="p-1 text-white hover:opacity-80 active:scale-95 transition cursor-pointer bg-transparent border-0 relative"
                >
                  <Bell className="w-4.5 h-4.5 sm:w-5 sm:h-5" strokeWidth={2.2} />
                  <span className="w-2.5 h-2.5 rounded-full bg-[#f43f5e] absolute top-0.5 right-0.5" />
                </button>

                {isNotificationsOpen && (
                  <>
                    <div
                      className="fixed inset-0 z-40"
                      onClick={() => setIsNotificationsOpen(false)}
                    />
                    <div className="absolute right-0 mt-2 w-60 sm:w-64 max-w-[calc(100vw-24px)] bg-white/80 dark:bg-zinc-900/80 backdrop-blur-xl rounded-2xl shadow-xl shadow-black/15 p-2.5 z-50 space-y-1.5 text-xs animate-in fade-in zoom-in-95">
                      <div className="font-bold text-slate-900 dark:text-white pb-1 flex justify-between items-center text-[11px]">
                        <span>Live Notifications</span>
                        <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold">Active</span>
                      </div>
                      <div className="space-y-1.5">
                        <div className="p-2 rounded-xl bg-black/4 dark:bg-white/5">
                          <strong className="text-slate-900 dark:text-white block text-[11px]">
                            Daily Closing Audit
                          </strong>
                          <span className="text-[10px] text-slate-500 dark:text-zinc-400 leading-tight block mt-0.5">
                            আজকের ক্যাশ ও ডিজিটাল ব্যালেন্স অডিট প্রস্তুত।
                          </span>
                        </div>
                        {dueInvoicesCount > 0 && (
                          <div className="p-2 rounded-xl bg-amber-500/12 dark:bg-amber-500/15">
                            <strong className="text-amber-900 dark:text-amber-200 block text-[11px]">
                              Due List Alert
                            </strong>
                            <span className="text-[10px] text-amber-800 dark:text-amber-300 leading-tight block mt-0.5">
                              {dueInvoicesCount} টি ইনভয়েসে বাকি টাকা রয়েছে।
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </>
                )}
              </div>

              {/* 6. Three-Line Menu (Opens 85% Settings Side Panel) */}
              <button
                type="button"
                onClick={handleOpenSettingsSidePanel}
                aria-label="Open Settings Side Panel"
                title="Store Settings"
                className="p-1 text-white hover:opacity-80 active:scale-95 transition cursor-pointer bg-transparent border-0 shrink-0"
              >
                <Menu className="w-4.5 h-4.5 sm:w-5 sm:h-5" strokeWidth={2.2} />
              </button>
            </div>
          </div>
        </header>

        {/* ======================================================================= */}
        {/* DESKTOP TOP BAR                                                         */}
        {/* ======================================================================= */}
        <header className="hidden lg:flex items-center justify-between px-6 py-3.5 bg-white/90 dark:bg-zinc-900/90 backdrop-blur-md border-b border-slate-200/90 dark:border-zinc-800 gap-4 select-none relative z-30">
          {/* Search Input */}
          <div
            onClick={() => setIsSearchModalOpen(true)}
            className="relative max-w-md w-full cursor-pointer group"
          >
            <Search className="w-4 h-4 text-slate-400 group-hover:text-emerald-500 absolute left-3.5 top-1/2 -translate-y-1/2 transition-colors" />
            <input
              type="text"
              readOnly
              placeholder="Search anything... (POS, Invoices, Customers, Stock)"
              className="w-full bg-[#f1f6f4] dark:bg-zinc-950 border border-slate-200/80 dark:border-zinc-800 rounded-2xl pl-10 pr-12 py-2 text-xs text-slate-900 dark:text-white placeholder-slate-400 cursor-pointer group-hover:border-emerald-500 transition"
            />
            <kbd className="hidden sm:inline-block absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-mono bg-slate-200/80 dark:bg-zinc-800 text-slate-500 dark:text-zinc-400 px-1.5 py-0.5 rounded border border-slate-300 dark:border-zinc-700">
              ⌘K
            </kbd>
          </div>

          {/* Right Action Icons */}
          <div className="flex items-center gap-3">

            {/* Balance Pill Shortcut */}
            <button
              onClick={() => onNavigate('drawers')}
              className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#eaf7f1] dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/80 text-xs font-semibold hover:bg-emerald-100 transition cursor-pointer"
              title="Multi-Drawer Balances"
            >
              <Wallet className="w-3.5 h-3.5 text-emerald-600" />
              <span className="font-mono font-bold">
                ৳{totalBalance.toLocaleString()}
              </span>
            </button>

            {/* Notification Bell */}
            <div className="relative">
              <button
                onClick={() => setIsNotificationsOpen(!isNotificationsOpen)}
                className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-750 text-slate-600 dark:text-zinc-300 transition cursor-pointer relative"
                title="Notifications"
              >
                <Bell className="w-4 h-4" />
                <span className="w-2 h-2 rounded-full bg-rose-500 absolute top-1.5 right-1.5" />
              </button>

              {isNotificationsOpen && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setIsNotificationsOpen(false)}
                  />
                  <div className="absolute right-0 mt-2 w-60 sm:w-64 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-xl rounded-2xl shadow-xl shadow-black/15 p-2.5 z-50 space-y-1.5 text-xs animate-in fade-in zoom-in-95">
                    <div className="font-bold text-slate-900 dark:text-white pb-1 flex justify-between items-center text-[11px]">
                      <span>Live Notifications</span>
                      <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold">Active</span>
                    </div>
                    <div className="space-y-1.5">
                      <div className="p-2 rounded-xl bg-black/4 dark:bg-white/5">
                        <strong className="text-slate-900 dark:text-white block text-[11px]">
                          Daily Closing Audit
                        </strong>
                        <span className="text-[10px] text-slate-500 dark:text-zinc-400 leading-tight block mt-0.5">
                          আজকের ক্যাশ ও ডিজিটাল ব্যালেন্স অডিট প্রস্তুত।
                        </span>
                      </div>
                      {dueInvoicesCount > 0 && (
                        <div className="p-2 rounded-xl bg-amber-500/12 dark:bg-amber-500/15">
                          <strong className="text-amber-900 dark:text-amber-200 block text-[11px]">
                            Due List Alert
                          </strong>
                          <span className="text-[10px] text-amber-800 dark:text-amber-300 leading-tight block mt-0.5">
                            {dueInvoicesCount} টি ইনভয়েসে বাকি টাকা রয়েছে।
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>

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
              className="px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-750 text-xs font-extrabold text-slate-700 dark:text-zinc-200 border border-slate-200/80 dark:border-zinc-700 transition cursor-pointer"
              title="Switch App Language (বাংলা / English)"
            >
              {language === 'bn' ? 'বাংলা / EN' : 'EN / বাংলা'}
            </button>

            {/* Dark / Light Mode Toggle */}
            <button
              onClick={toggleTheme}
              className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-750 text-slate-600 dark:text-zinc-300 transition cursor-pointer"
              title="Toggle Theme"
            >
              {theme === 'dark' ? (
                <Sun className="w-4 h-4 text-amber-400" />
              ) : (
                <Moon className="w-4 h-4" />
              )}
            </button>

            {/* Unified Account & Store Profile Menu Button */}
            <button
              onClick={() => setIsStoreMenuOpen(!isStoreMenuOpen)}
              className="flex items-center gap-2.5 pl-1.5 pr-3 py-1 rounded-2xl bg-slate-100 hover:bg-slate-200/80 dark:bg-zinc-800 dark:hover:bg-zinc-750 border border-slate-200/80 dark:border-zinc-700 transition cursor-pointer"
              title="Account & Store Profile"
            >
              <div className="w-7 h-7 rounded-xl bg-[#0e382d] text-white font-black text-xs flex items-center justify-center shadow-2xs shrink-0">
                {(currentTenant.ownerName || currentTenant.name || 'S').charAt(0).toUpperCase()}
              </div>
              <div className="text-left hidden xl:block max-w-[150px]">
                <div className="text-xs font-bold text-slate-900 dark:text-white truncate leading-tight">
                  {currentTenant.name}
                </div>
                <div className="text-[10px] font-medium text-slate-500 dark:text-zinc-400 truncate leading-tight">
                  {role === 'salesman' ? activeStaff?.name || 'Counter Staff' : currentTenant.ownerName}
                </div>
              </div>
              <ChevronDown className="w-3.5 h-3.5 text-slate-500 dark:text-zinc-400 shrink-0" />
            </button>
          </div>
        </header>

        {/* ======================================================================= */}
        {/* UNIFIED ACCOUNT & STORE PROFILE MENU                                    */}
        {/* ======================================================================= */}
        {isStoreMenuOpen && (
          <div className="fixed inset-0 z-50 flex items-start justify-end sm:pt-14 sm:pr-6 p-4">
            <div
              className="fixed inset-0 bg-black/40 backdrop-blur-2xs transition-opacity"
              onClick={() => setIsStoreMenuOpen(false)}
            />
            <div className="relative z-50 w-full sm:w-72 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-3xl shadow-2xl p-3.5 space-y-2.5 text-xs animate-in fade-in zoom-in-95 text-slate-800 dark:text-zinc-100 max-h-[85vh] overflow-y-auto">
              {/* Authenticated Store Identity Card */}
              <div className="p-3 rounded-2xl bg-emerald-50/70 dark:bg-emerald-950/40 border border-emerald-200/70 dark:border-emerald-800/60 flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="font-black text-sm text-slate-900 dark:text-white truncate">
                    {currentTenant.name}
                  </div>
                  <div className="text-[11px] font-semibold text-emerald-800 dark:text-emerald-300 truncate mt-0.5">
                    {role === 'salesman' ? activeStaff?.name || 'Staff Member' : currentTenant.ownerName}
                  </div>
                  {(currentTenant.ownerEmail || currentTenant.email) && (
                    <div className="text-[10px] text-slate-500 dark:text-zinc-400 truncate mt-0.5">
                      {currentTenant.ownerEmail || currentTenant.email}
                    </div>
                  )}
                  <div className="inline-flex items-center gap-1.5 mt-1.5 px-2 py-0.5 rounded-md bg-white dark:bg-zinc-900 border border-emerald-200 dark:border-emerald-800 text-[10px] font-bold text-emerald-700 dark:text-emerald-400">
                    <span>{currentTenant.shopCategory || (currentTenant.category === 'jersey' ? 'SPORTS WEAR' : 'CLOTHING')}</span>
                    <span>•</span>
                    <span>{role === 'salesman' ? 'Cashier' : 'Owner'}</span>
                  </div>
                </div>
                <button
                  onClick={() => setIsStoreMenuOpen(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white shrink-0"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Store Switcher (only shown if user has multiple stores) */}
              {tenants.length > 1 && (
                <>
                  <div className="space-y-1">
                    <div className="text-[10px] font-bold text-slate-400 px-2 uppercase">Your Stores</div>
                    {tenants.map((t) => (
                      <button
                        key={t.id}
                        onClick={() => {
                          switchTenant(t.id);
                          setIsStoreMenuOpen(false);
                          showToast(`Switched to: ${t.name}`, 'success');
                        }}
                        className={`w-full text-left px-3 py-2 rounded-xl flex items-center justify-between text-xs transition cursor-pointer ${
                          t.id === currentTenant.id
                            ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 font-bold border border-emerald-200 dark:border-emerald-800'
                            : 'text-slate-700 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800'
                        }`}
                      >
                        <span className="truncate">{t.name}</span>
                        {t.id === currentTenant.id && (
                          <CheckCircle className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                        )}
                      </button>
                    ))}
                  </div>
                  <div className="border-t border-slate-100 dark:border-zinc-800 my-1" />
                </>
              )}

              {/* Account & Store Actions */}
              <div className="space-y-1">
                <button
                  onClick={() => {
                    setIsStoreMenuOpen(false);
                    onOpenProfileModal();
                  }}
                  className="w-full text-left px-3 py-2 rounded-xl text-slate-700 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800 flex items-center gap-2.5 cursor-pointer font-semibold"
                >
                  <User className="w-4 h-4 text-emerald-600" />
                  <span>Account & Shift Profile</span>
                </button>

                <button
                  onClick={() => {
                    setIsStoreMenuOpen(false);
                    onNavigate('settings', 'hub');
                  }}
                  className="w-full text-left px-3 py-2 rounded-xl text-slate-700 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800 flex items-center gap-2.5 cursor-pointer font-medium"
                >
                  <Settings className="w-4 h-4 text-emerald-600" />
                  <span>{pickText('স্টোর ও বিজনেস সেটিংস', 'Store & Business Settings')}</span>
                </button>

                <button
                  onClick={() => {
                    setIsStoreMenuOpen(false);
                    onNavigate('help');
                  }}
                  className="w-full text-left px-3 py-2 rounded-xl text-slate-700 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800 flex items-center gap-2.5 cursor-pointer font-medium"
                >
                  <HelpCircle className="w-4 h-4 text-emerald-600" />
                  <span>{pickText('হেল্প সেন্টার ও গাইড', 'LEKHO Help Center')}</span>
                </button>

                <button
                  onClick={() => {
                    setIsStoreMenuOpen(false);
                    setIsCoverModalOpen(true);
                  }}
                  className="w-full text-left px-3 py-2 rounded-xl text-slate-700 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800 flex items-center gap-2.5 cursor-pointer font-medium"
                >
                  <Camera className="w-4 h-4 text-emerald-600" />
                  <span>{pickText('কভার ফটো পরিবর্তন করুন', 'Change Store Cover Banner')}</span>
                </button>

                <button
                  onClick={() => {
                    setIsStoreMenuOpen(false);
                    onOpenPinModal();
                  }}
                  className="w-full text-left px-3 py-2 rounded-xl text-slate-700 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800 flex items-center gap-2.5 cursor-pointer font-medium"
                >
                  <Shield className="w-4 h-4 text-amber-500" />
                  <span>Switch Operator PIN / Lock</span>
                </button>

                <div className="border-t border-slate-100 dark:border-zinc-800 my-1" />

                <button
                  onClick={() => {
                    setIsStoreMenuOpen(false);
                    logout();
                  }}
                  className="w-full text-left px-3 py-2 rounded-xl text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 flex items-center gap-2.5 cursor-pointer font-bold"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Log Out ({currentTenant.name})</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ======================================================================= */}
        {/* MAIN BODY CONTAINER                                                     */}
        {/* ======================================================================= */}
        <main className="relative z-10 -mt-7 sm:-mt-8 lg:mt-0 rounded-t-[28px] sm:rounded-t-[32px] lg:rounded-none bg-slate-50 dark:bg-zinc-950 lg:bg-transparent pt-4 sm:pt-5 lg:pt-6 px-3 sm:px-5 lg:px-6 pb-3 sm:pb-4 lg:pb-6 space-y-4 max-w-7xl mx-auto w-full">
          {/* ===================================================================== */}
          {/* HERO COVER BANNER (Desktop >= 1024px Only)                            */}
          {/* ===================================================================== */}
          <div className="hidden lg:block relative overflow-hidden rounded-3xl border border-emerald-200/80 dark:border-zinc-800 shadow-xs">
            {coverPhoto ? (
              <div
                className="h-32 sm:h-48 w-full bg-cover bg-center relative group"
                style={{ backgroundImage: `url(${coverPhoto})` }}
              >
                {/* Top-Right Corner Button to Change Cover Photo (User Request 9) */}
                <button
                  type="button"
                  onClick={() => setIsCoverModalOpen(true)}
                  className="absolute top-2.5 right-2.5 sm:top-3 sm:right-3 z-20 flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/95 hover:bg-white dark:bg-zinc-900/95 dark:hover:bg-zinc-900 text-slate-800 dark:text-zinc-100 text-xs font-bold shadow-lg border border-slate-200/90 dark:border-zinc-700 transition cursor-pointer active:scale-95"
                  title="Change Cover Photo"
                >
                  <Camera className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  <span>Change Cover Photo</span>
                </button>
              </div>
            ) : (
              /* Soft Wave Mint Gradient Cover */
              <div
                className="h-32 sm:h-44 w-full bg-gradient-to-r from-[#d9f5ec] via-[#c6eee0] to-[#e4f8f1] dark:from-zinc-900 dark:via-zinc-850 dark:to-zinc-900 flex flex-col items-center justify-center relative p-4 text-center cursor-pointer group"
                onClick={() => setIsCoverModalOpen(true)}
              >
                {/* Top-Right Corner Button even when empty */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsCoverModalOpen(true);
                  }}
                  className="absolute top-2.5 right-2.5 sm:top-3 sm:right-3 z-20 flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/95 hover:bg-white dark:bg-zinc-900/95 dark:hover:bg-zinc-900 text-slate-800 dark:text-zinc-100 text-xs font-bold shadow-md border border-slate-200/90 dark:border-zinc-750 transition cursor-pointer active:scale-95"
                  title="Upload Cover Photo"
                >
                  <Camera className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  <span>Upload Cover</span>
                </button>
                {/* Subtle Decorative Wave */}
                <div className="absolute inset-0 opacity-40 pointer-events-none">
                  <svg className="w-full h-full" viewBox="0 0 1000 200" preserveAspectRatio="none">
                    <path
                      d="M0,100 C150,160 350,40 500,100 C650,160 850,40 1000,100 L1000,200 L0,200 Z"
                      fill="#b8ead8"
                      opacity="0.4"
                    />
                  </svg>
                </div>

                <div className="relative z-10 flex flex-col items-center space-y-1 sm:space-y-2">
                  <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-white/80 dark:bg-zinc-800/80 shadow-xs flex items-center justify-center text-emerald-700 dark:text-emerald-400 group-hover:scale-105 transition">
                    <Camera className="w-5 h-5 sm:w-6 sm:h-6 stroke-[1.75]" />
                  </div>
                  <div className="font-bold text-xs sm:text-sm text-emerald-950 dark:text-emerald-100">
                    Upload Cover Photo
                  </div>
                  <div className="text-[10px] text-emerald-800/70 dark:text-zinc-400">
                    {currentTenant.name} • {currentTenant.marketMallName}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* ===================================================================== */}
          {/* WORKFLOW ACTION CARDS                                                 */}
          {/* ===================================================================== */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 sm:gap-3.5">
            {/* CARD 1: POS Counter */}
            <button
              type="button"
              onClick={() => onNavigate('pos')}
              className="bg-white dark:bg-zinc-900 border border-emerald-100 dark:border-zinc-800 rounded-2xl p-3.5 sm:p-4 hover:shadow-md hover:border-emerald-400 dark:hover:border-emerald-600 transition-all cursor-pointer group flex items-center gap-3 text-left"
            >
              <div className="flex items-center justify-center text-[#0d6847] shrink-0">
                <CreditCard className="w-5 h-5 stroke-[2]" />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="font-extrabold text-xs sm:text-sm text-slate-900 dark:text-white leading-tight truncate">
                  {pickText('পিওএস কাউন্টার', 'POS Counter')}
                </h3>
              </div>
            </button>

            {/* CARD 2: Add Font (Sportswear) or Alterations (Clothing) */}
            <button
              type="button"
              onClick={() => onNavigate(isClothingStore ? 'alteration' : 'pipeline')}
              className="bg-white dark:bg-zinc-900 border border-emerald-100 dark:border-zinc-800 rounded-2xl p-3.5 sm:p-4 hover:shadow-md hover:border-emerald-400 dark:hover:border-emerald-600 transition-all cursor-pointer group flex items-center gap-3 text-left"
            >
              <div className="flex items-center justify-center text-[#0d6847] font-black text-base shrink-0">
                {isClothingStore ? <Scissors className="w-5 h-5 stroke-[2]" /> : 'Aa'}
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="font-extrabold text-xs sm:text-sm text-slate-900 dark:text-white leading-tight truncate">
                  {isClothingStore ? pickText('অল্টারেশন', 'Alterations') : pickText('ফন্ট যোগ', 'Add Font')}
                </h3>
              </div>
            </button>

            {/* CARD 3: Wholesale / Resell */}
            <button
              type="button"
              onClick={() => onNavigate('reseller')}
              className="bg-white dark:bg-zinc-900 border border-emerald-100 dark:border-zinc-800 rounded-2xl p-3.5 sm:p-4 hover:shadow-md hover:border-emerald-400 dark:hover:border-emerald-600 transition-all cursor-pointer group flex items-center gap-3 text-left"
            >
              <div className="flex items-center justify-center text-[#0d6847] shrink-0">
                <Building2 className="w-5 h-5 stroke-[2]" />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="font-extrabold text-xs sm:text-sm text-slate-900 dark:text-white leading-tight truncate">
                  {pickText('পাইকারি ও রিসেলার', 'Wholesale')}
                </h3>
              </div>
            </button>

            {/* CARD 4: Customers */}
            <button
              type="button"
              onClick={() => onNavigate('customers')}
              className="bg-white dark:bg-zinc-900 border border-emerald-100 dark:border-zinc-800 rounded-2xl p-3.5 sm:p-4 hover:shadow-md hover:border-emerald-400 dark:hover:border-emerald-600 transition-all cursor-pointer group flex items-center gap-3 text-left"
            >
              <div className="flex items-center justify-center text-[#0d6847] shrink-0">
                <Users className="w-5 h-5 stroke-[2]" />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="font-extrabold text-xs sm:text-sm text-slate-900 dark:text-white leading-tight truncate">
                  {pickText('কাস্টমার ও লয়্যালটি', 'Customers')}
                </h3>
              </div>
            </button>

            {/* CARD 5: Exchange */}
            <button
              type="button"
              onClick={() => onNavigate('size_exchange')}
              className="bg-white dark:bg-zinc-900 border border-emerald-100 dark:border-zinc-800 rounded-2xl p-3.5 sm:p-4 hover:shadow-md hover:border-emerald-400 dark:hover:border-emerald-600 transition-all cursor-pointer group flex items-center gap-3 text-left"
            >
              <div className="flex items-center justify-center text-[#0d6847] shrink-0">
                <ArrowLeftRight className="w-5 h-5 stroke-[2]" />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="font-extrabold text-xs sm:text-sm text-slate-900 dark:text-white leading-tight truncate">
                  {pickText('সাইজ এক্সচেঞ্জ', 'Exchange')}
                </h3>
              </div>
            </button>

            {/* CARD 6: Summary (Dashboard) */}
            <button
              type="button"
              onClick={() => onNavigate('dashboard')}
              className="bg-white dark:bg-zinc-900 border border-emerald-100 dark:border-zinc-800 rounded-2xl p-3.5 sm:p-4 hover:shadow-md hover:border-emerald-400 dark:hover:border-emerald-600 transition-all cursor-pointer group flex items-center gap-3 text-left"
            >
              <div className="flex items-center justify-center text-[#0d6847] shrink-0">
                <TrendingUp className="w-5 h-5 stroke-[2]" />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="font-extrabold text-xs sm:text-sm text-slate-900 dark:text-white leading-tight truncate">
                  {pickText('সামারি ড্যাশবোর্ড', 'Summary')}
                </h3>
              </div>
            </button>

            {/* CARD 7: Transactions */}
            <button
              type="button"
              onClick={() => onNavigate('invoices')}
              className="bg-white dark:bg-zinc-900 border border-emerald-100 dark:border-zinc-800 rounded-2xl p-3.5 sm:p-4 hover:shadow-md hover:border-emerald-400 dark:hover:border-emerald-600 transition-all cursor-pointer group flex items-center gap-3 text-left"
            >
              <div className="flex items-center justify-center text-[#0d6847] shrink-0">
                <FileText className="w-5 h-5 stroke-[2]" />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="font-extrabold text-xs sm:text-sm text-slate-900 dark:text-white leading-tight truncate">
                  {pickText('বিক্রয় ও ইনভয়েস', 'Transactions')}
                </h3>
              </div>
            </button>

            {/* CARD 8: Multi-Drawer */}
            <button
              type="button"
              onClick={() => onNavigate('drawers')}
              className="bg-white dark:bg-zinc-900 border border-emerald-100 dark:border-zinc-800 rounded-2xl p-3.5 sm:p-4 hover:shadow-md hover:border-emerald-400 dark:hover:border-emerald-600 transition-all cursor-pointer group flex items-center gap-3 text-left"
            >
              <div className="flex items-center justify-center text-[#0d6847] font-mono font-black text-lg leading-none w-5 h-5 shrink-0">
                ৳
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="font-extrabold text-xs sm:text-sm text-slate-900 dark:text-white leading-tight truncate">
                  {pickText('মাল্টি-ড্রয়ার ক্যাশ', 'Multi-Drawer')}
                </h3>
              </div>
            </button>

            {/* CARD 9: Daily Closing */}
            <button
              type="button"
              onClick={() => onNavigate('daily_closing')}
              className="bg-white dark:bg-zinc-900 border border-emerald-100 dark:border-zinc-800 rounded-2xl p-3.5 sm:p-4 hover:shadow-md hover:border-emerald-400 dark:hover:border-emerald-600 transition-all cursor-pointer group flex items-center gap-3 text-left"
            >
              <div className="flex items-center justify-center text-[#0d6847] shrink-0">
                <Calendar className="w-5 h-5 stroke-[2]" />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="font-extrabold text-xs sm:text-sm text-slate-900 dark:text-white leading-tight truncate">
                  {pickText('ডেইলি ক্লোজিং', 'Daily Closing')}
                </h3>
              </div>
            </button>

            {/* CARD 10: DUE LIST */}
            <button
              type="button"
              onClick={() => onNavigate('due_list')}
              className="bg-white dark:bg-zinc-900 border border-emerald-100 dark:border-zinc-800 rounded-2xl p-3.5 sm:p-4 hover:shadow-md hover:border-emerald-400 dark:hover:border-emerald-600 transition-all cursor-pointer group flex items-center gap-3 text-left"
            >
              <div className="flex items-center justify-center text-[#0d6847] shrink-0">
                <FileText className="w-5 h-5 stroke-[2]" />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="font-extrabold text-xs sm:text-sm text-slate-900 dark:text-white leading-tight truncate">
                  {pickText('বাকি খাতা', 'Due List')}
                </h3>
                {dueInvoicesCount > 0 && (
                  <p className="text-[10px] font-semibold text-amber-600 dark:text-amber-400 truncate">
                    {dueInvoicesCount} {pickText('টি বাকি', 'due')}
                  </p>
                )}
              </div>
            </button>

            {/* CARD 11: PRICING */}
            <button
              type="button"
              onClick={() =>
                showBuyingPrice ? onNavigate('lot_splitter') : onNavigate('settings', 'categories')
              }
              className="bg-white dark:bg-zinc-900 border border-emerald-100 dark:border-zinc-800 rounded-2xl p-3.5 sm:p-4 hover:shadow-md hover:border-emerald-400 dark:hover:border-emerald-600 transition-all cursor-pointer group flex items-center gap-3 text-left"
            >
              <div className="flex items-center justify-center text-[#0d6847] shrink-0">
                {showBuyingPrice ? (
                  <Calculator className="w-5 h-5 stroke-[2]" />
                ) : (
                  <ShoppingBag className="w-5 h-5 stroke-[2]" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="font-extrabold text-xs sm:text-sm text-slate-900 dark:text-white leading-tight truncate">
                  {showBuyingPrice ? pickText('প্রাইসিং', 'Pricing') : pickText('ক্যাটাগরি', 'Categories')}
                </h3>
              </div>
            </button>

            {/* CARD 12: EXPENSE */}
            <button
              type="button"
              onClick={() => onNavigate('expenses')}
              className="bg-white dark:bg-zinc-900 border border-emerald-100 dark:border-zinc-800 rounded-2xl p-3.5 sm:p-4 hover:shadow-md hover:border-emerald-400 dark:hover:border-emerald-600 transition-all cursor-pointer group flex items-center gap-3 text-left"
            >
              <div className="flex items-center justify-center text-[#0d6847] shrink-0">
                <Receipt className="w-5 h-5 stroke-[2]" />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="font-extrabold text-xs sm:text-sm text-slate-900 dark:text-white leading-tight truncate">
                  {pickText('দোকানের খরচ', 'Expense')}
                </h3>
              </div>
            </button>

            {/* CARD 13: INVENTORY */}
            <button
              type="button"
              onClick={() => onNavigate('inventory')}
              className="bg-white dark:bg-zinc-900 border border-emerald-100 dark:border-zinc-800 rounded-2xl p-3.5 sm:p-4 hover:shadow-md hover:border-emerald-400 dark:hover:border-emerald-600 transition-all cursor-pointer group flex items-center gap-3 text-left"
            >
              <div className="flex items-center justify-center text-[#0d6847] shrink-0">
                <Package className="w-5 h-5 stroke-[2]" />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="font-extrabold text-xs sm:text-sm text-slate-900 dark:text-white leading-tight truncate">
                  {pickText('ইনভেন্টরি ও স্টক', 'Inventory')}
                </h3>
                <p className="text-[10px] text-slate-500 dark:text-zinc-400 truncate">
                  {shopInventory.length} {pickText('টি আইটেম', 'items')} • {totalInventoryPieces} {pickText('পিস', 'pcs')}
                </p>
              </div>
            </button>

            {/* CARD 14: OFFER ANNOUNCEMENT */}
            <button
              type="button"
              onClick={() => onNavigate('customers', 'festive')}
              className="bg-white dark:bg-zinc-900 border border-emerald-100 dark:border-zinc-800 rounded-2xl p-3.5 sm:p-4 hover:shadow-md hover:border-emerald-400 dark:hover:border-emerald-600 transition-all cursor-pointer group flex items-center gap-3 text-left"
            >
              <div className="flex items-center justify-center text-[#0d6847] shrink-0">
                <Sparkles className="w-5 h-5 stroke-[2]" />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="font-extrabold text-xs sm:text-sm text-slate-900 dark:text-white leading-tight truncate">
                  {pickText('উৎসবের অফার বার্তা', 'Offer Announcement')}
                </h3>
              </div>
            </button>
          </div>
        </main>
      </div>

      {/* ========================================================================= */}
      {/* COVER PHOTO PICKER & UPLOAD MODAL                                         */}
      {/* ========================================================================= */}
      {isCoverModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/65 dark:bg-black/75 backdrop-blur-xs flex items-center justify-center p-2.5 sm:p-4 overflow-y-auto animate-in fade-in duration-150">
          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-3xl max-w-lg w-full p-4 sm:p-5 shadow-2xl text-slate-900 dark:text-zinc-100 relative my-auto max-h-[88dvh] flex flex-col overflow-hidden">
            <div className="flex items-center justify-between pb-2.5 border-b border-slate-200 dark:border-zinc-800 shrink-0">
              <h3 className="lekho-modal-title text-slate-900 dark:text-white truncate">
                দোকানের কভার ফটো পরিবর্তন
              </h3>
              <button
                onClick={() => setIsCoverModalOpen(false)}
                className="w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 text-slate-500 hover:text-slate-800 dark:hover:text-white flex items-center justify-center shrink-0 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3.5 py-3.5 overflow-y-auto flex-1 pr-0.5">
              {/* Direct Device Upload Button */}
              <div className="p-3.5 rounded-2xl bg-[#e6f4ea]/60 dark:bg-emerald-950/30 border-2 border-dashed border-emerald-300 dark:border-emerald-800 text-center space-y-2">
                <Upload className="w-6 h-6 text-[#164e3f] dark:text-emerald-400 mx-auto" />
                <div className="text-xs font-bold text-slate-900 dark:text-white">
                  ডিভাইস / মোবাইল গ্যালারি থেকে ছবি সিলেক্ট করুন
                </div>
                <p className="text-[11px] text-slate-500 dark:text-zinc-400">
                  JPG, PNG বা WebP ফরম্যাট (সর্বোচ্চ ৫ MB)
                </p>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="px-4 py-2 rounded-xl bg-[#164e3f] hover:bg-[#123e32] text-white font-bold text-xs transition cursor-pointer shadow-xs inline-flex items-center gap-2"
                >
                  <Camera className="w-3.5 h-3.5" />
                  <span>Upload From Device</span>
                </button>
              </div>

              {/* Preset Banners */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-700 dark:text-zinc-300 block">
                  বা প্রিসেট স্টোর ব্যানার পছন্দ করুন:
                </label>
                <div className="grid grid-cols-2 gap-2.5">
                  {PRESET_BANNERS.map((preset) => (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => handleSaveCoverPhoto(preset.url || null)}
                      className="p-2 rounded-2xl border border-slate-200 dark:border-zinc-800 hover:border-[#164e3f] transition text-left cursor-pointer group space-y-1 bg-slate-50 dark:bg-zinc-950"
                    >
                      <div
                        className="h-14 sm:h-16 w-full rounded-xl bg-cover bg-center border border-slate-200/50 dark:border-zinc-800"
                        style={
                          preset.url
                            ? { backgroundImage: `url(${preset.url})` }
                            : {
                                background:
                                  'linear-gradient(135deg, #d9f5ec 0%, #c6eee0 50%, #e4f8f1 100%)',
                              }
                        }
                      />
                      <div className="text-[11px] font-bold text-slate-800 dark:text-zinc-200 truncate group-hover:text-[#164e3f] dark:group-hover:text-emerald-400">
                        {preset.name}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Reset to Default */}
            <div className="pt-3 border-t border-slate-100 dark:border-zinc-800 flex justify-between items-center shrink-0">
              <button
                type="button"
                onClick={() => handleSaveCoverPhoto(null)}
                className="text-xs text-rose-600 hover:underline font-semibold cursor-pointer"
              >
                ডিফল্ট মিন্ট ওয়েভে রিসেট করুন
              </button>
              <button
                type="button"
                onClick={() => setIsCoverModalOpen(false)}
                className="px-4 py-1.5 rounded-xl bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 text-xs font-bold cursor-pointer"
              >
                বন্ধ করুন
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* OPERATIONS & TOOLS QUICK MODAL                                            */}
      {/* ========================================================================= */}
      {isOperationsModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/65 dark:bg-black/75 backdrop-blur-xs flex items-center justify-center p-2.5 sm:p-4 overflow-y-auto animate-in fade-in duration-150">
          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-3xl max-w-md w-full p-4 shadow-2xl text-slate-900 dark:text-zinc-100 relative my-auto max-h-[88dvh] flex flex-col overflow-hidden">
            <div className="flex items-center justify-between pb-2.5 border-b border-slate-200 dark:border-zinc-800 shrink-0">
              <h3 className="lekho-modal-title text-slate-900 dark:text-white truncate">
                Operations & Tools
              </h3>
              <button
                onClick={() => setIsOperationsModalOpen(false)}
                className="w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 text-slate-500 hover:text-slate-800 dark:hover:text-white flex items-center justify-center shrink-0 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-3 overflow-y-auto pr-0.5">
              <button
                onClick={() => {
                  setIsOperationsModalOpen(false);
                  onNavigate('reseller');
                }}
                className="p-3 rounded-2xl bg-[#e6f4ea] dark:bg-emerald-950/40 border border-[#1f8a5b] transition text-left cursor-pointer flex items-center gap-2.5"
              >
                <Truck className="w-4 h-4 text-[#1f8a5b] shrink-0" />
                <strong className="text-xs font-bold text-slate-900 dark:text-white truncate">
                  Reseller Counter
                </strong>
              </button>

              {!isClothingStore && (
                <button
                  onClick={() => {
                    setIsOperationsModalOpen(false);
                    onNavigate('pipeline');
                  }}
                  className="p-3 rounded-2xl bg-slate-50 dark:bg-zinc-950 border border-slate-200/80 dark:border-zinc-800 hover:border-emerald-500 transition text-left cursor-pointer flex items-center gap-2.5"
                >
                  <Flame className="w-4 h-4 text-emerald-600 shrink-0" />
                  <strong className="text-xs font-bold text-slate-900 dark:text-white truncate">
                    Heat-Press Pipeline
                  </strong>
                </button>
              )}

              {!isClothingStore && (
                <button
                  onClick={() => {
                    setIsOperationsModalOpen(false);
                    onNavigate('team');
                  }}
                  className="p-3 rounded-2xl bg-slate-50 dark:bg-zinc-950 border border-slate-200/80 dark:border-zinc-800 hover:border-emerald-500 transition text-left cursor-pointer flex items-center gap-2.5"
                >
                  <Users className="w-4 h-4 text-emerald-600 shrink-0" />
                  <strong className="text-xs font-bold text-slate-900 dark:text-white truncate">
                    Team Bulk Matrix
                  </strong>
                </button>
              )}

              <button
                onClick={() => {
                  setIsOperationsModalOpen(false);
                  onNavigate('alteration');
                }}
                className="p-3 rounded-2xl bg-slate-50 dark:bg-zinc-950 border border-slate-200/80 dark:border-zinc-800 hover:border-emerald-500 transition text-left cursor-pointer flex items-center gap-2.5"
              >
                <Scissors className="w-4 h-4 text-emerald-600 shrink-0" />
                <strong className="text-xs font-bold text-slate-900 dark:text-white truncate">
                  Alterations
                </strong>
              </button>

              {showBuyingPrice && (
                <button
                  onClick={() => {
                    setIsOperationsModalOpen(false);
                    onNavigate('lot_splitter');
                  }}
                  className="p-3 rounded-2xl bg-slate-50 dark:bg-zinc-950 border border-slate-200/80 dark:border-zinc-800 hover:border-emerald-500 transition text-left cursor-pointer flex items-center gap-2.5"
                >
                  <Calculator className="w-4 h-4 text-emerald-600 shrink-0" />
                  <strong className="text-xs font-bold text-slate-900 dark:text-white truncate">
                    Lot Cost Splitter
                  </strong>
                </button>
              )}

              <button
                onClick={() => {
                  setIsOperationsModalOpen(false);
                  onNavigate('dead_stock');
                }}
                className="p-3 rounded-2xl bg-slate-50 dark:bg-zinc-950 border border-slate-200/80 dark:border-zinc-800 hover:border-emerald-500 transition text-left cursor-pointer flex items-center gap-2.5"
              >
                <AlertTriangle className="w-4 h-4 text-emerald-600 shrink-0" />
                <strong className="text-xs font-bold text-slate-900 dark:text-white truncate">
                  Dead Stock
                </strong>
              </button>

              <button
                onClick={() => {
                  setIsOperationsModalOpen(false);
                  onNavigate('expenses');
                }}
                className="p-3 rounded-2xl bg-slate-50 dark:bg-zinc-950 border border-slate-200/80 dark:border-zinc-800 hover:border-emerald-500 transition text-left cursor-pointer flex items-center gap-2.5"
              >
                <Receipt className="w-4 h-4 text-emerald-600 shrink-0" />
                <strong className="text-xs font-bold text-slate-900 dark:text-white truncate">
                  Expenses
                </strong>
              </button>

              <button
                onClick={() => {
                  setIsOperationsModalOpen(false);
                  onNavigate('size_exchange');
                }}
                className="p-3 rounded-2xl bg-slate-50 dark:bg-zinc-950 border border-slate-200/80 dark:border-zinc-800 hover:border-emerald-500 transition text-left cursor-pointer flex items-center gap-2.5"
              >
                <ArrowLeftRight className="w-4 h-4 text-emerald-600 shrink-0" />
                <strong className="text-xs font-bold text-slate-900 dark:text-white truncate">
                  Size Exchange
                </strong>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Customers Modal */}
      <CustomersModal
        isOpen={isCustomersOpen}
        onClose={() => setIsCustomersOpen(false)}
      />

      {/* Universal Search Modal */}
      <UniversalSearchModal
        isOpen={isSearchModalOpen}
        onClose={() => setIsSearchModalOpen(false)}
        onNavigate={onNavigate}
        onOpenExchangeModal={onOpenExchangeModal}
        onOpenZReportModal={onOpenZReportModal}
      />

      {/* Settings Side Panel Backdrop (remaining 15% blur & light dark overlay) */}
      <div
        className={`fixed inset-0 z-50 transition-opacity duration-300 ${
          isSettingsSidePanelOpen && settingsPanelNavState.showSettingsHub
            ? 'opacity-100 pointer-events-auto'
            : 'opacity-0 pointer-events-none'
        }`}
        style={{
          backgroundColor: 'rgba(0, 0, 0, 0.4)',
          backdropFilter: 'blur(6px)',
          WebkitBackdropFilter: 'blur(6px)',
        }}
        onClick={closeDrawer}
        aria-hidden={!isSettingsSidePanelOpen}
      />

      {/* Settings Side Panel (85vw on Main Menu, Smooth 100vw Expansion on Option Page) */}
      <aside
        aria-label="Store Settings Side Panel"
        aria-hidden={!isSettingsSidePanelOpen}
        data-panel-width={resolveSettingsSidePanelWidth({
          showSettingsHub: settingsPanelNavState.showSettingsHub,
        })}
        style={{
          width: settingsPanelNavState.showSettingsHub ? '85vw' : '100vw',
          maxWidth: '100vw',
          transition: 'translate 320ms cubic-bezier(0.16, 1, 0.3, 1), transform 320ms cubic-bezier(0.16, 1, 0.3, 1), width 300ms cubic-bezier(0.16, 1, 0.3, 1)',
          willChange: 'translate, transform, width',
        }}
        className={`${getSettingsSidePanelClassName({
          isOpen: isSettingsSidePanelOpen,
          showSettingsHub: settingsPanelNavState.showSettingsHub,
        })} z-[51]`}
      >
        {/* Side Panel Header with Close Button in Top Left */}
        <div className="flex items-center justify-between p-3 bg-transparent shrink-0">
          <button
            type="button"
            onClick={closeDrawer}
            aria-label="Close Settings Panel"
            className="p-0 bg-transparent text-slate-900 dark:text-white transition cursor-pointer flex items-center gap-1.5 font-bold text-xs shrink-0"
          >
            <X className="w-5 h-5 text-slate-900 dark:text-white" strokeWidth={2.5} />
            <span>{pickText('বন্ধ করুন', 'Close')}</span>
          </button>
          <span className="text-xs sm:text-sm font-extrabold text-slate-900 dark:text-white uppercase tracking-wider truncate pl-2">
            {pickText('স্টোর সেটিংস', 'Store Settings')}
          </span>
        </div>

        {/* Full Settings Page Content Container */}
        <div
          ref={settingsPanelScrollRef}
          className="flex-1 overflow-y-auto overflow-x-hidden p-2.5 sm:p-5"
        >
          <StoreSettings
            openHubTrigger={settingsHubOpenTrigger}
            onBack={closeDrawer}
            onNavigationStateChange={setSettingsPanelNavState}
          />
        </div>
      </aside>
    </div>
  );
};
