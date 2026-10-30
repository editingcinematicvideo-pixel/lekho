import React, { useState, useMemo, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { Invoice, InventoryItem, MultiDrawerBalance, ResellerAccount } from '../../types';
import { dbService } from '../../services/db';
import {
  isClothingShop,
  canViewProfitMetrics,
  canManagePartners,
  canManageDrawersAndAudits,
} from '../../utils/securityPolicy';
import {
  computeAccurateShopBusinessReport,
  ReportDatePreset,
} from '../../utils/inventoryLoyaltyReportsEngine';
import { ReceiptModal } from '../pos/ReceiptModal';
import { BottomSheet } from '../ui/BottomSheet';
import {
  TrendingUp,
  DollarSign,
  ShoppingBag,
  ShoppingCart,
  Users,
  Package,
  AlertTriangle,
  CheckCircle,
  Search,
  Calendar,
  Sparkles,
  Flame,
  Truck,
  Zap,
  Bell,
  X,
  ShieldCheck,
  ChevronRight,
  ChevronDown,
  Check,
  SlidersHorizontal,
  Award,
  CreditCard,
  Layers,
  Shirt,
  BarChart3,
} from 'lucide-react';

interface StoreAdminDashboardProps {
  onNavigate?: (tab: string) => void;
}

const REPORT_PRESETS: Array<{
  id: ReportDatePreset;
  bn: string;
  en: string;
}> = [
  { id: 'all', bn: 'সকল সময়', en: 'All Time' },
  { id: 'today', bn: 'আজ', en: 'Today' },
  { id: 'yesterday', bn: 'গতকাল', en: 'Yesterday' },
  { id: 'last7days', bn: 'গত ৭ দিন', en: 'Last 7 Days' },
  { id: 'thisMonth', bn: 'এই মাস', en: 'This Month' },
  { id: 'custom', bn: 'কাস্টম', en: 'Custom' },
];

interface CustomAnalyticsDropdownProps {
  label: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange: (val: string) => void;
  icon: React.ComponentType<{ className?: string }>;
}

const CustomAnalyticsDropdown: React.FC<CustomAnalyticsDropdownProps> = ({
  label,
  value,
  options,
  onChange,
  icon: Icon,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent | TouchEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('touchstart', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [isOpen]);

  const selectedOpt = options.find((o) => o.value === value) || options[0];

  return (
    <div ref={dropdownRef} className="relative flex-1 w-full min-w-0">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full bg-[#f4f7f5] dark:bg-zinc-800/90 border border-slate-200/80 dark:border-zinc-700/80 hover:border-slate-300 dark:hover:border-zinc-600 rounded-2xl p-2.5 sm:p-3 text-left transition flex items-center justify-between cursor-pointer group shadow-2xs"
      >
        <div className="flex items-center gap-2 sm:gap-2.5 min-w-0 truncate">
          <div className="p-1.5 rounded-xl bg-white dark:bg-zinc-900 border border-slate-200/60 dark:border-zinc-700/60 text-[#164e3f] dark:text-emerald-400 shrink-0">
            <Icon className="w-4 h-4" />
          </div>
          <div className="truncate min-w-0">
            <span className="text-[10px] font-bold text-slate-400 dark:text-zinc-400 uppercase tracking-wider block leading-tight">
              {label}
            </span>
            <span className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white truncate block">
              {selectedOpt?.label || value}
            </span>
          </div>
        </div>
        <ChevronDown
          className={`w-4 h-4 text-slate-400 shrink-0 transition-transform duration-200 ${
            isOpen ? 'rotate-180 text-emerald-600 dark:text-emerald-400' : ''
          }`}
        />
      </button>

      {isOpen && (
        <div className="absolute left-0 right-0 top-full mt-1.5 z-40 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl shadow-xl py-1.5 max-h-60 overflow-y-auto animate-in fade-in slide-in-from-top-2 duration-150">
          {options.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => {
                onChange(opt.value);
                setIsOpen(false);
              }}
              className={`w-full text-left px-3.5 py-2 text-xs font-semibold flex items-center justify-between transition cursor-pointer ${
                opt.value === value
                  ? 'bg-[#e6f4ea] text-[#164e3f] dark:bg-emerald-950/50 dark:text-emerald-400 font-bold'
                  : 'text-slate-700 dark:text-zinc-300 hover:bg-slate-50 dark:hover:bg-zinc-800'
              }`}
            >
              <span className="truncate pr-2">{opt.label}</span>
              {opt.value === value && (
                <Check className="w-3.5 h-3.5 text-[#164e3f] dark:text-emerald-400 shrink-0" />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export const StoreAdminDashboard: React.FC<StoreAdminDashboardProps> = ({ onNavigate }) => {
  const { currentTenant, role, language, pickText } = useApp();
  const isClothingStore = isClothingShop(currentTenant);
  const showProfitMetrics = canViewProfitMetrics(role);
  const showPartners = canManagePartners(role);
  const showVaultReserves = canManageDrawersAndAudits(role);

  // Load shop data (re-synced when tenant changes)
  const [invoices, setInvoices] = useState<Invoice[]>(() =>
    dbService.getInvoices(currentTenant.id, role)
  );
  const [inventory, setInventory] = useState<InventoryItem[]>(() =>
    dbService.getInventory(currentTenant.id, role)
  );
  const [expenses, setExpenses] = useState(() =>
    dbService.getExpenses(currentTenant.id)
  );
  const [drawers, setDrawers] = useState<MultiDrawerBalance>(() =>
    dbService.getShopDrawers(currentTenant.id)
  );
  const [owners, setOwners] = useState(() =>
    dbService.getShopOwners(currentTenant.id, role)
  );
  const [resellers, setResellers] = useState<ResellerAccount[]>(() =>
    dbService.getResellers(currentTenant.id)
  );
  const [loyaltyTxs, setLoyaltyTxs] = useState(() =>
    dbService.getLoyaltyTransactions(currentTenant.id)
  );
  const [storeConfig, setStoreConfig] = useState(() =>
    dbService.getStoreConfig(currentTenant.id)
  );

  useEffect(() => {
    setInvoices(dbService.getInvoices(currentTenant.id, role));
    setInventory(dbService.getInventory(currentTenant.id, role));
    setExpenses(dbService.getExpenses(currentTenant.id));
    setDrawers(dbService.getShopDrawers(currentTenant.id));
    setOwners(dbService.getShopOwners(currentTenant.id, role));
    setResellers(dbService.getResellers(currentTenant.id));
    setLoyaltyTxs(dbService.getLoyaltyTransactions(currentTenant.id));
    setStoreConfig(dbService.getStoreConfig(currentTenant.id));
  }, [currentTenant.id, role]);

  // Report Date Range Filter (Phase 5)
  const [reportRange, setReportRange] = useState<ReportDatePreset>('all');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [rangeDropdownOpen, setRangeDropdownOpen] = useState(false);
  const rangeDropdownRef = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent | TouchEvent) => {
      if (rangeDropdownRef.current && !rangeDropdownRef.current.contains(e.target as Node)) {
        setRangeDropdownOpen(false);
      }
    };
    if (rangeDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('touchstart', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [rangeDropdownOpen]);

  // Dashboard Filters & View Controls
  const [chartPeriod, setChartPeriod] = useState<'7' | '14' | '30'>('14');
  const [showRevenue, setShowRevenue] = useState(true);
  const [showOrders, setShowOrders] = useState(true);
  const [orderSearch, setOrderSearch] = useState('');
  const [orderStatusFilter, setOrderStatusFilter] = useState<'all' | 'completed' | 'partial_due'>('all');
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table');
  const [quickOrderInvoice, setQuickOrderInvoice] = useState<Invoice | null>(null);
  const [alertFilter, setAlertFilter] = useState<'all' | 'today' | 'week'>('today');
  const [dismissedAlerts, setDismissedAlerts] = useState<string[]>([]);

  // Receipt Modal State
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);

  // Sales Analytics Section Controls & Calculations
  const [analyticsCategory, setAnalyticsCategory] = useState<string>('all');
  const [analyticsViewBy, setAnalyticsViewBy] = useState<'size' | 'color'>('size');

  // Available POS categories from inventory
  const categoryOptions = useMemo(() => {
    const catSet = new Set<string>();
    for (const item of inventory) {
      if (item.isSoftDeleted || item.shopId !== currentTenant.id) continue;
      const cat = item.clothingCategory || item.jerseyCategory || item.subCategory;
      if (cat) catSet.add(cat);
    }
    const defaultCats = ['Shirt', 'T-Shirt', 'Polo Shirt', 'Jeans', 'Pant / Trouser', 'Custom Jersey'];
    for (const c of defaultCats) {
      catSet.add(c);
    }
    const list = Array.from(catSet);
    return [
      { value: 'all', label: pickText('সকল ক্যাটাগরি', 'All Categories') },
      ...list.map((c) => ({ value: c, label: c })),
    ];
  }, [inventory, currentTenant.id, pickText]);

  const viewByOptions = useMemo(
    () => [
      { value: 'size', label: pickText('সাইজ অনুযায়ী বিক্রয়', 'Sales by Size') },
      { value: 'color', label: pickText('কালার / ধরন অনুযায়ী বিক্রয়', 'Sales by Color / Type') },
    ],
    [pickText]
  );

  const selectedCategoryLabel = useMemo(() => {
    return categoryOptions.find((c) => c.value === analyticsCategory)?.label || analyticsCategory;
  }, [categoryOptions, analyticsCategory]);

  // Compute graph data for selected Category and View By
  const aggregatedAnalytics = useMemo(() => {
    const activeInvoices = invoices.filter((inv) => {
      if (inv.isSoftDeleted || inv.shopId !== currentTenant.id || inv.status === 'returned') return false;
      const invDate = new Date(inv.createdAt);
      if (isNaN(invDate.getTime())) return true;
      const now = new Date();
      if (reportRange === 'today') return invDate.toDateString() === now.toDateString();
      if (reportRange === 'yesterday') {
        const y = new Date();
        y.setDate(now.getDate() - 1);
        return invDate.toDateString() === y.toDateString();
      }
      if (reportRange === 'last7days') {
        const cutoff = new Date();
        cutoff.setDate(now.getDate() - 7);
        return invDate >= cutoff;
      }
      if (reportRange === 'thisMonth') {
        return invDate.getMonth() === now.getMonth() && invDate.getFullYear() === now.getFullYear();
      }
      if (reportRange === 'custom') {
        if (customStartDate && invDate < new Date(customStartDate)) return false;
        if (customEndDate) {
          const end = new Date(customEndDate);
          end.setHours(23, 59, 59, 999);
          if (invDate > end) return false;
        }
      }
      return true;
    });

    const isSizeView = analyticsViewBy === 'size';
    const salesMap = new Map<string, { label: string; revenue: number; qtySold: number }>();

    // Seed standard labels
    const defaultLabels = isSizeView
      ? ['S', 'M', 'L', 'XL', 'XXL']
      : ['Black', 'Navy', 'White', 'Emerald', 'Red'];

    for (const lbl of defaultLabels) {
      salesMap.set(lbl, { label: lbl, revenue: 0, qtySold: 0 });
    }

    // Seed variants from inventory matching category
    for (const item of inventory) {
      if (item.isSoftDeleted || item.shopId !== currentTenant.id) continue;
      const itemCat = item.clothingCategory || item.jerseyCategory || item.subCategory || 'General';
      if (
        analyticsCategory !== 'all' &&
        itemCat.trim().toLowerCase() !== analyticsCategory.trim().toLowerCase()
      ) {
        continue;
      }
      for (const v of item.variants || []) {
        const key = isSizeView ? (v.size || 'STD').trim() : (v.color || 'Default').trim();
        if (key && !salesMap.has(key)) {
          salesMap.set(key, { label: key, revenue: 0, qtySold: 0 });
        }
      }
    }

    // Aggregate line item sales
    for (const inv of activeInvoices) {
      for (const line of inv.items || []) {
        const qty = Math.max(1, Number(line.quantity) || 1);
        const subtotal = Math.max(
          0,
          Number(line.subtotal) || (Number(line.rate) || 0) * qty
        );

        const matchedProd = inventory.find(
          (p) => p.id === line.productId || p.name.trim().toLowerCase() === line.title.trim().toLowerCase()
        );
        const prodCat =
          matchedProd?.clothingCategory ||
          matchedProd?.jerseyCategory ||
          matchedProd?.subCategory ||
          'General';

        if (analyticsCategory !== 'all') {
          const normSelected = analyticsCategory.trim().toLowerCase();
          const normCat = prodCat.trim().toLowerCase();
          const normTitle = (line.title || '').trim().toLowerCase();
          const normSub = (line.subDetail || '').trim().toLowerCase();

          const isMatch =
            normCat === normSelected ||
            normCat.includes(normSelected) ||
            normSelected.includes(normCat) ||
            normTitle.includes(normSelected) ||
            normSub.includes(normSelected);

          if (!isMatch) continue;
        }

        const key = isSizeView ? (line.size || 'STD').trim() : (line.color || 'Default').trim();
        const existing = salesMap.get(key) || { label: key, revenue: 0, qtySold: 0 };
        existing.revenue += subtotal;
        existing.qtySold += qty;
        salesMap.set(key, existing);
      }
    }

    const items = Array.from(salesMap.values());
    const totalRevenue = items.reduce((sum, i) => sum + i.revenue, 0);

    return {
      items,
      totalRevenue,
    };
  }, [
    invoices,
    inventory,
    currentTenant.id,
    reportRange,
    customStartDate,
    customEndDate,
    analyticsCategory,
    analyticsViewBy,
  ]);

  // Compute Y-axis scale ticks
  const analyticsScale = useMemo(() => {
    const maxRevenue = Math.max(...aggregatedAnalytics.items.map((i) => i.revenue), 100);
    const rawStep = maxRevenue / 4;
    let step = 500;
    if (rawStep <= 100) step = 100;
    else if (rawStep <= 250) step = 250;
    else if (rawStep <= 500) step = 500;
    else if (rawStep <= 1000) step = 1000;
    else if (rawStep <= 2500) step = 2500;
    else step = Math.ceil(rawStep / 1000) * 1000;

    const topTick = Math.max(step * 4, Math.ceil(maxRevenue / step) * step);
    const ticks = [0, step, step * 2, step * 3, topTick];

    return {
      maxVal: topTick,
      ticks: ticks.reverse(),
    };
  }, [aggregatedAnalytics.items]);

  // SVG Chart Hover Interaction State
  const [hoveredPoint, setHoveredPoint] = useState<{
    date: string;
    revenue: number;
    orders: number;
    x: number;
    y: number;
  } | null>(null);

  // Compute 100% accurate active-shop business report (Phase 5)
  const businessReport = useMemo(() => {
    return computeAccurateShopBusinessReport({
      shopId: currentTenant.id,
      role,
      invoices,
      inventory,
      expenses,
      loyaltyTransactions: loyaltyTxs,
      preset: reportRange,
      customStart: customStartDate,
      customEnd: customEndDate,
      lowStockThreshold: storeConfig.lowStockThreshold || 5,
    });
  }, [
    currentTenant.id,
    role,
    invoices,
    inventory,
    expenses,
    loyaltyTxs,
    reportRange,
    customStartDate,
    customEndDate,
    storeConfig.lowStockThreshold,
  ]);

  // Key Financial KPIs bound to accurate businessReport
  const totalSalesRevenue = businessReport.netSales;
  const totalOrdersCount = businessReport.invoiceCount;
  const averageOrderValue =
    totalOrdersCount > 0 ? Math.round(totalSalesRevenue / totalOrdersCount) : 0;
  const totalCostOfGoods = businessReport.totalCogs || 0;
  const totalExpensesAmount = businessReport.totalExpenses;
  const netEstimatedProfit = businessReport.netProfit || 0;
  const profitMarginPercent =
    totalSalesRevenue > 0 ? Math.round((netEstimatedProfit / totalSalesRevenue) * 100) : 0;

  // Generate dynamic daily chart series from real active-shop invoices (no fake fallback!)
  const chartData = useMemo(() => {
    const daysCount = parseInt(chartPeriod, 10);
    const result = [];
    const activeInvs = invoices.filter((inv) => !inv.isSoftDeleted && inv.shopId === currentTenant.id);
    const latestInvTime = activeInvs.reduce((max, inv) => {
      const t = new Date(inv.createdAt).getTime();
      return !isNaN(t) && t > max ? t : max;
    }, Date.now());
    const baseDate = new Date(latestInvTime);

    for (let i = daysCount - 1; i >= 0; i--) {
      const d = new Date(baseDate);
      d.setDate(baseDate.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      const label = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

      // Calculate actual revenue and orders from invoices matching this date
      const matchingInvoices = activeInvs.filter(
        (inv) => inv.createdAt.startsWith(dateStr) && inv.status !== 'returned'
      );
      const dayRevenue = matchingInvoices.reduce((acc, inv) => acc + (Number(inv.total) || 0), 0);
      const dayOrders = matchingInvoices.length;

      result.push({
        date: label,
        fullDate: dateStr,
        revenue: dayRevenue,
        orders: dayOrders,
      });
    }

    return result;
  }, [invoices, chartPeriod, currentTenant.id]);

  // Max values for chart scaling
  const maxRevenue = useMemo(() => {
    const max = Math.max(...chartData.map((d) => d.revenue), 1000);
    return Math.ceil(max / 5000) * 5000;
  }, [chartData]);

  const maxOrders = useMemo(() => {
    const max = Math.max(...chartData.map((d) => d.orders), 5);
    return Math.ceil(max / 5) * 5;
  }, [chartData]);

  // Filtered Orders for the Table
  const filteredInvoices = useMemo(() => {
    return invoices.filter((inv) => {
      if (inv.isSoftDeleted) return false;
      if (orderStatusFilter !== 'all' && inv.status !== orderStatusFilter) {
        return false;
      }
      if (orderSearch.trim()) {
        const query = orderSearch.toLowerCase().trim();
        const matchNo = inv.invoiceNo.toLowerCase().includes(query);
        const matchCustomer = inv.customerName.toLowerCase().includes(query);
        const matchPhone = inv.customerPhone.includes(query);
        const matchItem = inv.items.some((it) => it.title.toLowerCase().includes(query));
        if (!matchNo && !matchCustomer && !matchPhone && !matchItem) return false;
      }
      return true;
    });
  }, [invoices, orderStatusFilter, orderSearch]);

  // Operational Notification Alerts Stack
  const lowStockAlerts = businessReport.lowStockProducts;

  const pendingCustomPrints = useMemo(() => {
    return invoices.flatMap((inv) => inv.items).filter((it) => !!it.customization).length;
  }, [invoices]);

  const resellersWithDue = useMemo(
    () => resellers.filter((r) => r.currentDueBalance > 0),
    [resellers]
  );

  const handleOpenReceipt = (invoice: Invoice) => {
    setSelectedInvoice(invoice);
    setIsReceiptModalOpen(true);
  };

  const handleDismissAlert = (id: string) => {
    setDismissedAlerts((prev) => [...prev, id]);
  };

  const selectedPreset = REPORT_PRESETS.find((p) => p.id === reportRange);
  const selectedPresetLabel = selectedPreset
    ? language === 'bn'
      ? selectedPreset.bn
      : selectedPreset.en
    : language === 'bn'
    ? 'সকল সময়'
    : 'All Time';

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* 1B. BUSINESS REPORT DATE RANGE FILTER & FINANCIAL AUDIT STRIP (PHASE 5) */}
      <div className="bg-white dark:bg-zinc-900 border border-slate-200/90 dark:border-zinc-800 rounded-3xl p-4 sm:p-5 shadow-xs space-y-4">
        <div className="flex flex-col gap-2.5">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-[#164e3f] dark:text-emerald-400" />
            <h2 className="text-xs sm:text-sm font-extrabold text-slate-900 dark:text-white">
              {pickText('বিজনেস রিপোর্ট সময়সীমা', 'Business Report Period Filter')}
            </h2>
          </div>

          <div ref={rangeDropdownRef} className="w-full relative">
            {/* Custom Full-Width Drop Down Trigger Button */}
            <button
              type="button"
              onClick={() => setRangeDropdownOpen((prev) => !prev)}
              aria-haspopup="listbox"
              aria-expanded={rangeDropdownOpen}
              className="w-full h-11 px-4 rounded-2xl bg-[#f4f7f5] hover:bg-[#ebf2ee] dark:bg-zinc-800 dark:hover:bg-zinc-750 text-slate-800 dark:text-zinc-100 flex items-center justify-between text-xs font-bold border border-slate-200/80 dark:border-zinc-700/80 transition cursor-pointer shadow-2xs active:scale-[0.99]"
            >
              <div className="flex items-center gap-2.5 truncate">
                <Calendar className="w-4 h-4 text-[#164e3f] dark:text-emerald-400 shrink-0" />
                <span className="truncate">{selectedPresetLabel}</span>
              </div>
              <ChevronDown
                className={`w-4 h-4 text-slate-500 transition-transform duration-200 shrink-0 ${
                  rangeDropdownOpen ? 'rotate-180 text-[#164e3f] dark:text-emerald-400' : ''
                }`}
              />
            </button>

            {/* Custom Drop Down Menu */}
            {rangeDropdownOpen && (
              <>
                <div
                  className="fixed inset-0 z-30"
                  onClick={() => setRangeDropdownOpen(false)}
                />
                <div
                  role="listbox"
                  className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-zinc-900 border border-slate-200/90 dark:border-zinc-800 rounded-2xl shadow-xl p-1.5 z-40 space-y-1 animate-in fade-in zoom-in-95 duration-150 max-h-72 overflow-y-auto"
                >
                  {REPORT_PRESETS.map((p) => {
                    const isSelected = reportRange === p.id;
                    return (
                      <button
                        key={p.id}
                        type="button"
                        role="option"
                        aria-selected={isSelected}
                        onClick={() => {
                          setReportRange(p.id);
                          setRangeDropdownOpen(false);
                        }}
                        className={`w-full px-3.5 py-2.5 rounded-xl flex items-center justify-between text-xs transition cursor-pointer ${
                          isSelected
                            ? 'bg-[#164e3f] text-white font-extrabold shadow-2xs'
                            : 'text-slate-700 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800 font-semibold'
                        }`}
                      >
                        <span className="truncate">{language === 'bn' ? p.bn : p.en}</span>
                        {isSelected && (
                          <Check className="w-4 h-4 text-white shrink-0 ml-2" strokeWidth={2.5} />
                        )}
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        </div>

        {reportRange === 'custom' && (
          <div className="flex flex-col gap-2.5 pt-2 border-t border-slate-100 dark:border-zinc-800 text-xs w-full">
            <div className="flex flex-col gap-1 w-full">
              <span className="font-bold text-slate-600 dark:text-zinc-400">
                {pickText('শুরু:', 'From:')}
              </span>
              <input
                type="date"
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
                className="w-full bg-[#f4f7f5] dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl px-3 py-2 font-mono text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#164e3f]/20"
              />
            </div>
            <div className="flex flex-col gap-1 w-full">
              <span className="font-bold text-slate-600 dark:text-zinc-400">
                {pickText('শেষ:', 'To:')}
              </span>
              <input
                type="date"
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
                className="w-full bg-[#f4f7f5] dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl px-3 py-2 font-mono text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#164e3f]/20"
              />
            </div>
          </div>
        )}

        {/* Detailed Sales, Discounts, Returns, Dues & Loyalty Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-0 pt-1 text-xs">
          <div className="p-3 border border-slate-200/80 dark:border-zinc-800 rounded-tl-2xl sm:rounded-none">
            <span className="text-[10px] font-bold text-slate-500 uppercase block">
              {pickText('মোট গ্রস সেলস', 'Gross Sales')}
            </span>
            <strong className="text-sm font-mono font-black text-slate-900 dark:text-white">
              ৳{businessReport.grossSales.toLocaleString()}
            </strong>
          </div>
          <div className="p-3 border border-l-0 sm:border-l lg:border-l-0 border-slate-200/80 dark:border-zinc-800 rounded-tr-2xl sm:rounded-none">
            <span className="text-[10px] font-bold text-slate-500 uppercase block">
              {pickText('মোট ছাড়', 'Total Discounts')}
            </span>
            <strong className="text-sm font-mono font-black text-slate-900 dark:text-white">
              -৳{businessReport.totalDiscounts.toLocaleString()}
            </strong>
            {businessReport.loyaltyDiscountsGiven > 0 && (
              <span className="text-[9px] text-emerald-700 dark:text-emerald-400 block">
                {pickText(`(লয়্যালটি ছাড়: ৳${businessReport.loyaltyDiscountsGiven})`, `(Loyalty: ৳${businessReport.loyaltyDiscountsGiven})`)}
              </span>
            )}
          </div>
          <div className="p-3 border border-t-0 sm:border-t lg:border-l-0 border-slate-200/80 dark:border-zinc-800">
            <span className="text-[10px] font-bold text-slate-500 uppercase block">
              {pickText(`রিটার্ন / রিফান্ড (${businessReport.returnedInvoiceCount})`, `Returns & Refunds (${businessReport.returnedInvoiceCount})`)}
            </span>
            <strong className="text-sm font-mono font-black text-rose-600">
              ৳{businessReport.returnsAndRefundsAmount.toLocaleString()}
            </strong>
          </div>
          <div className="p-3 bg-[#e6f4ea]/60 dark:bg-emerald-950/30 border border-t-0 border-l-0 sm:border-t sm:border-l lg:border-l-0 border-slate-200/80 dark:border-zinc-800">
            <span className="text-[10px] font-bold text-[#164e3f] dark:text-emerald-300 uppercase block">
              {pickText('নিট বিক্রয়', 'Net Sales')}
            </span>
            <strong className="text-sm font-mono font-black text-[#164e3f] dark:text-emerald-400">
              ৳{businessReport.netSales.toLocaleString()}
            </strong>
          </div>
          <div className="p-3 border border-t-0 sm:border-t lg:border-l-0 border-slate-200/80 dark:border-zinc-800">
            <span className="text-[10px] font-bold text-slate-500 uppercase block">
              {pickText('আদায়কৃত টাকা', 'Collected Amount')}
            </span>
            <strong className="text-sm font-mono font-black text-[#1f8a5b]">
              ৳{businessReport.totalCollectedOnSales.toLocaleString()}
            </strong>
          </div>
          <div className="p-3 bg-rose-50/70 dark:bg-rose-950/20 border border-t-0 border-l-0 sm:border-t sm:border-l lg:border-l-0 border-slate-200/80 dark:border-zinc-800">
            <span className="text-[10px] font-bold text-rose-700 dark:text-rose-300 uppercase block">
              {pickText('কাস্টমার বাকি', 'Customer Due')}
            </span>
            <strong className="text-sm font-mono font-black text-rose-600 dark:text-rose-400">
              ৳{businessReport.totalActiveShopReceivable.toLocaleString()}
            </strong>
          </div>
          <div className="col-span-2 sm:col-span-1 p-3 border border-t-0 sm:border-t lg:border-l-0 border-slate-200/80 dark:border-zinc-800 rounded-b-2xl sm:rounded-none">
            {/* Mobile only: single line, full width, flex justify-between with label in place of '/' */}
            <div className="flex sm:hidden items-center justify-between w-full">
              <strong className="text-sm font-mono font-black text-[#164e3f] dark:text-emerald-400">
                +{businessReport.loyaltySummary.pointsEarnedInPeriod}
              </strong>
              <span className="text-[10px] font-bold text-slate-500 uppercase">
                {pickText('লয়্যালটি পয়েন্ট', 'Loyalty Points')}
              </span>
              <strong className="text-sm font-mono font-black text-[#164e3f] dark:text-emerald-400">
                -{businessReport.loyaltySummary.pointsRedeemedInPeriod}
              </strong>
            </div>

            {/* Computer / Desktop: keep present design */}
            <div className="hidden sm:block">
              <span className="text-[10px] font-bold text-slate-500 uppercase block">
                {pickText('লয়্যালটি পয়েন্ট', 'Loyalty Points')}
              </span>
              <strong className="text-sm font-mono font-black text-[#164e3f] dark:text-emerald-400">
                +{businessReport.loyaltySummary.pointsEarnedInPeriod} / -{businessReport.loyaltySummary.pointsRedeemedInPeriod}
              </strong>
            </div>
          </div>
        </div>
      </div>

      {/* 2. TOP METRIC CARDS (KPIs) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Card 1: Net Estimated Profit (Owner & Super Admin Only) */}
        {showProfitMetrics && (
          <div className="bg-white dark:bg-zinc-900 border border-slate-200/90 dark:border-zinc-800 rounded-3xl p-5 flex flex-col justify-between hover:border-slate-300 dark:hover:border-zinc-700 transition shadow-xs relative overflow-hidden group">
            <div className="flex items-start justify-between">
              <div>
                <span className="text-xs font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider block">
                  {pickText('আনুমানিক নিট লাভ', 'Net Estimated Profit')}
                </span>
                <div className="text-2xl sm:text-3xl font-black text-[#1f8a5b] dark:text-emerald-400 font-mono mt-1 tracking-tight">
                  ৳{netEstimatedProfit.toLocaleString()}
                </div>
              </div>
              <div className="p-2.5 rounded-2xl bg-[#e6f4ea] text-[#164e3f] dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/60">
                <ShieldCheck className="w-5 h-5" strokeWidth={1.75} />
              </div>
            </div>

            <div className="flex items-center justify-between mt-4 pt-3 border-t border-slate-100 dark:border-zinc-800 text-[11px] text-slate-500 dark:text-zinc-400">
              <span>COGS: <strong className="font-mono text-slate-800 dark:text-zinc-200">৳{totalCostOfGoods.toLocaleString()}</strong></span>
              <span>{pickText('মোট খরচ:', 'Expenses:')} <strong className="font-mono text-rose-600">৳{totalExpensesAmount.toLocaleString()}</strong></span>
              <span className="font-bold text-[#164e3f] dark:text-emerald-400">{profitMarginPercent}%</span>
            </div>
          </div>
        )}

        {/* Card 2: Orders Processed */}
        <div className="bg-white dark:bg-zinc-900 border border-slate-200/90 dark:border-zinc-800 rounded-3xl p-5 flex flex-col justify-between hover:border-slate-300 dark:hover:border-zinc-700 transition shadow-xs relative overflow-hidden group">
          <div className="flex items-start justify-between">
            <div>
              <span className="text-xs font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider block">
                {pickText('মোট সম্পন্ন অর্ডার', 'Orders Processed')}
              </span>
              <div className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white font-mono mt-1 tracking-tight">
                {totalOrdersCount.toLocaleString()}
              </div>
            </div>
            <div className="p-2.5 rounded-2xl bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400 border border-blue-200 dark:border-blue-800/60">
              <ShoppingBag className="w-5 h-5" strokeWidth={1.75} />
            </div>
          </div>

          <div className="flex items-center justify-between mt-4 pt-3 border-t border-slate-100 dark:border-zinc-800 text-xs">
            <span className="text-slate-500">
              {pickText('মোট পণ্য বিক্রয়:', 'Units Sold:')} <strong className="font-mono text-slate-900 dark:text-white">{businessReport.totalUnitsSold} pcs</strong>
            </span>
            <span className="text-rose-600 font-semibold">
              {pickText('রিটার্ন:', 'Returns:')} {businessReport.returnedInvoiceCount}
            </span>
          </div>
        </div>

        {/* Card 3: Average Order Value */}
        <div className="bg-white dark:bg-zinc-900 border border-slate-200/90 dark:border-zinc-800 rounded-3xl p-5 flex flex-col justify-between hover:border-slate-300 dark:hover:border-zinc-700 transition shadow-xs relative overflow-hidden group">
          <div className="flex items-start justify-between">
            <div>
              <span className="text-xs font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider block">
                {pickText('গড় মেমো মূল্য', 'Average Order Value')}
              </span>
              <div className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white font-mono mt-1 tracking-tight">
                ৳{averageOrderValue.toLocaleString()}
              </div>
            </div>
            <div className="p-2.5 rounded-2xl bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400 border border-amber-200 dark:border-amber-800/60">
              <TrendingUp className="w-5 h-5" strokeWidth={1.75} />
            </div>
          </div>

          <div className="flex items-center justify-between mt-4 pt-3 border-t border-slate-100 dark:border-zinc-800 text-xs">
            <span className="text-slate-500">
              {pickText('বকেয়া বাকি:', 'Receivable Due:')} <strong className="font-mono text-rose-600">৳{businessReport.totalActiveShopReceivable.toLocaleString()}</strong>
            </span>
          </div>
        </div>
      </div>

      {/* 3. SALES & ORDERS OVERVIEW DUAL CHART */}
      <div className="bg-white dark:bg-zinc-900 border border-slate-200/90 dark:border-zinc-800 rounded-3xl p-5 sm:p-6 shadow-xs space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-zinc-800">
          <div>
            <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-emerald-600 dark:text-emerald-400" strokeWidth={1.75} />
              Sales & Orders Overview
            </h2>
          </div>

          {/* Controls: Checkboxes & Period Selector */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 w-full sm:w-auto">
            <div className="flex items-center gap-3">
              {/* Show Revenue Checkbox */}
              <label className="flex items-center gap-1.5 text-xs text-slate-700 dark:text-zinc-300 font-semibold cursor-pointer">
                <input
                  type="checkbox"
                  checked={showRevenue}
                  onChange={(e) => setShowRevenue(e.target.checked)}
                  className="rounded accent-emerald-600 cursor-pointer"
                />
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-600" />
                <span>{pickText('রেভিনিউ (৳)', 'Revenue (৳)')}</span>
              </label>

              {/* Show Orders Checkbox */}
              <label className="flex items-center gap-1.5 text-xs text-slate-700 dark:text-zinc-300 font-semibold cursor-pointer">
                <input
                  type="checkbox"
                  checked={showOrders}
                  onChange={(e) => setShowOrders(e.target.checked)}
                  className="rounded accent-blue-600 cursor-pointer"
                />
                <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                <span>Orders (Qty)</span>
              </label>
            </div>

            {/* Period Selector - full width on mobile */}
            <select
              value={chartPeriod}
              onChange={(e) => setChartPeriod(e.target.value as any)}
              className="w-full sm:w-auto bg-slate-50 dark:bg-zinc-950 border border-slate-300 dark:border-zinc-800 text-slate-900 dark:text-white text-xs font-semibold rounded-xl px-3 py-2 sm:py-1.5 focus:outline-none focus:border-emerald-500 cursor-pointer text-center sm:text-left"
            >
              <option value="7">Last 7 Days</option>
              <option value="14">Last 14 Days</option>
              <option value="30">Last 30 Days</option>
            </select>
          </div>
        </div>

        {/* Dynamic Dual Axis SVG Graph */}
        <div className="relative pt-4 pb-2">
          {/* Tooltip Overlay */}
          {hoveredPoint && (
            <div
              className="absolute pointer-events-none z-20 bg-slate-900 dark:bg-zinc-950 text-white border border-slate-700 dark:border-zinc-700 p-3 rounded-2xl shadow-xl text-xs space-y-1 transform -translate-x-1/2 -translate-y-full transition-all duration-150 backdrop-blur-md"
              style={{
                left: `${hoveredPoint.x}%`,
                top: `${hoveredPoint.y - 12}px`,
              }}
            >
              <div className="font-bold text-center pb-1 border-b border-slate-800 dark:border-zinc-800">
                {hoveredPoint.date}
              </div>
              <div className="flex items-center justify-between gap-4 text-emerald-400 font-mono font-black">
                <span>Revenue:</span>
                <span>৳{hoveredPoint.revenue.toLocaleString()}</span>
              </div>
              <div className="flex items-center justify-between gap-4 text-blue-400 font-mono font-bold">
                <span>Orders:</span>
                <span>{hoveredPoint.orders} pcs</span>
              </div>
            </div>
          )}

          {/* SVG Chart Surface */}
          <div className="h-64 sm:h-72 w-full">
            <svg className="w-full h-full overflow-visible" viewBox="0 0 1000 240" preserveAspectRatio="none">
              <defs>
                {/* Bar Gradient */}
                <linearGradient id="revenueBarGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#10b981" stopOpacity="0.85" />
                  <stop offset="100%" stopColor="#10b981" stopOpacity="0.25" />
                </linearGradient>

                {/* Line glow filter */}
                <filter id="lineGlow" x="-20%" y="-20%" width="140%" height="140%">
                  <feGaussianBlur stdDeviation="2" result="blur" />
                  <feMerge>
                    <feMergeNode in="blur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
              </defs>

              {/* Grid Lines */}
              {[0, 60, 120, 180].map((y) => (
                <line
                  key={y}
                  x1="50"
                  y1={y}
                  x2="950"
                  y2={y}
                  stroke="currentColor"
                  className="text-slate-200 dark:text-zinc-800"
                  strokeDasharray="4 4"
                  strokeWidth="1"
                />
              ))}

              {/* BARS: Daily Revenue */}
              {showRevenue &&
                chartData.map((d, idx) => {
                  const totalBars = chartData.length;
                  const step = 900 / totalBars;
                  const barWidth = Math.max(8, step * 0.55);
                  const x = 50 + idx * step + step / 2 - barWidth / 2;
                  const barHeight = (d.revenue / maxRevenue) * 190;
                  const y = 200 - barHeight;

                  return (
                    <rect
                      key={`bar_${idx}`}
                      x={x}
                      y={y}
                      width={barWidth}
                      height={barHeight}
                      rx={barWidth / 3}
                      fill="url(#revenueBarGradient)"
                      className="transition-all duration-200 hover:opacity-100 opacity-90 cursor-pointer"
                      onMouseEnter={(e) => {
                        setHoveredPoint({
                          date: d.date,
                          revenue: d.revenue,
                          orders: d.orders,
                          x: ((50 + idx * step + step / 2) / 1000) * 100,
                          y: y,
                        });
                      }}
                      onMouseLeave={() => setHoveredPoint(null)}
                    />
                  );
                })}

              {/* LINE: Daily Orders Curve */}
              {showOrders && (() => {
                const totalPoints = chartData.length;
                const step = 900 / totalPoints;
                const points = chartData.map((d, idx) => {
                  const x = 50 + idx * step + step / 2;
                  const y = 200 - (d.orders / maxOrders) * 180;
                  return { x, y, data: d };
                });

                const pathString = points.reduce((acc, pt, idx, arr) => {
                  if (idx === 0) return `M ${pt.x},${pt.y}`;
                  const prev = arr[idx - 1];
                  const midX = (prev.x + pt.x) / 2;
                  return `${acc} C ${midX},${prev.y} ${midX},${pt.y} ${pt.x},${pt.y}`;
                }, '');

                return (
                  <g>
                    <path
                      d={pathString}
                      fill="none"
                      stroke="#3b82f6"
                      strokeWidth="3"
                      filter="url(#lineGlow)"
                    />
                    {points.map((pt, idx) => (
                      <circle
                        key={`pt_${idx}`}
                        cx={pt.x}
                        cy={pt.y}
                        r={4.5}
                        fill="#3b82f6"
                        stroke="#ffffff"
                        strokeWidth="2"
                        className="cursor-pointer hover:scale-150 transition-transform"
                        onMouseEnter={() => {
                          setHoveredPoint({
                            date: pt.data.date,
                            revenue: pt.data.revenue,
                            orders: pt.data.orders,
                            x: (pt.x / 1000) * 100,
                            y: pt.y,
                          });
                        }}
                        onMouseLeave={() => setHoveredPoint(null)}
                      />
                    ))}
                  </g>
                );
              })()}
            </svg>
          </div>

          {/* X Axis Labels */}
          <div className="flex justify-between items-center px-4 pt-2 text-[10px] sm:text-xs text-slate-400 dark:text-zinc-500 font-mono">
            {chartData.filter((_, i) => i % Math.ceil(chartData.length / 8) === 0).map((d, idx) => (
              <span key={idx}>{d.date}</span>
            ))}
          </div>
        </div>

        {/* Bottom Chart Summary Row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 border-t border-slate-200 dark:border-zinc-800 text-xs">
          <div className="p-2 sm:p-3">
            <span className="text-[10px] text-slate-500 dark:text-zinc-400 uppercase font-semibold">Peak Day Revenue</span>
            <div className="text-base font-black text-slate-900 dark:text-white font-mono mt-0.5">
              ৳{maxRevenue.toLocaleString()}
            </div>
          </div>

          <div className="p-2 sm:p-3">
            <span className="text-[10px] text-slate-500 dark:text-zinc-400 uppercase font-semibold">Peak Orders Volume</span>
            <div className="text-base font-black text-slate-900 dark:text-white font-mono mt-0.5">
              {maxOrders} Memos / Day
            </div>
          </div>

          {showVaultReserves && (
            <>
              <div className="p-2 sm:p-3">
                <span className="text-[10px] text-slate-500 dark:text-zinc-400 uppercase font-semibold">Vault Cash Reserves</span>
                <div className="text-base font-black text-slate-900 dark:text-white font-mono mt-0.5">
                  ৳{drawers.cash.toLocaleString()}
                </div>
              </div>

              <div className="p-2 sm:p-3">
                <span className="text-[10px] text-slate-500 dark:text-zinc-400 uppercase font-semibold">Digital Wallets Total</span>
                <div className="text-base font-black text-slate-900 dark:text-white font-mono mt-0.5">
                  ৳{(drawers.merchantBkash + drawers.personalBkash + drawers.nagad + drawers.bank).toLocaleString()}
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* 4. TWO-COLUMN SPLIT: ORDER LIST (LEFT) & NOTIFICATION CENTRE (RIGHT) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column (8 cols): Order List Table */}
        <div className="lg:col-span-8 bg-white dark:bg-zinc-900 border border-slate-200/90 dark:border-zinc-800 rounded-3xl p-5 sm:p-6 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-0 sm:pb-3 border-b-0 sm:border-b border-slate-200 dark:border-zinc-800">
            <div>
              <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <ShoppingBag className="w-4 h-4 text-emerald-600 dark:text-emerald-400" strokeWidth={1.75} />
                {pickText('অর্ডার লিস্ট ও কাস্টমার মেমো', 'Order List & Customer Memos')}
              </h3>
            </div>

            <div className="hidden sm:flex items-center gap-2">
              {/* Table / Cards View Toggle */}
              <button
                onClick={() => setViewMode(viewMode === 'table' ? 'cards' : 'table')}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 text-slate-700 dark:text-zinc-300 hover:text-slate-900 dark:hover:text-white cursor-pointer transition"
              >
                <SlidersHorizontal className="w-3.5 h-3.5 text-slate-400 dark:text-zinc-500" strokeWidth={1.75} />
                <span>{viewMode === 'table' ? 'Table View' : 'Card View'}</span>
              </button>
            </div>
          </div>

          {/* Search & Filter Bar */}
          <div className="flex flex-col sm:flex-row items-center gap-2.5">
            <div className="relative flex-1 w-full">
              <Search className="w-4 h-4 text-slate-400 dark:text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={orderSearch}
                onChange={(e) => setOrderSearch(e.target.value)}
                placeholder={
                  isClothingStore
                    ? 'Search by Order ID, Customer name or Clothing item...'
                    : 'Search by Order ID, Customer name or Jersey...'
                }
                className="w-full bg-slate-50 dark:bg-zinc-950 border border-slate-300 dark:border-zinc-800 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-zinc-500 focus:outline-none focus:border-emerald-500 transition"
              />
              {orderSearch && (
                <button
                  onClick={() => setOrderSearch('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 dark:hover:text-white"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <div className="flex items-center gap-1.5 w-full sm:w-auto">
              {(['all', 'completed', 'partial_due'] as const).map((st) => (
                <button
                  key={st}
                  onClick={() => setOrderStatusFilter(st)}
                  className={`flex-1 sm:flex-initial px-3 py-2 rounded-xl text-xs font-semibold capitalize transition cursor-pointer whitespace-nowrap text-center justify-center ${
                    orderStatusFilter === st
                      ? 'bg-emerald-600 text-white font-bold shadow-xs'
                      : 'bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  {st === 'all' && (language === 'bn' ? 'সকল' : 'All')}
                  {st === 'completed' && (language === 'bn' ? 'ডেলিভারড' : 'Delivered / Paid')}
                  {st === 'partial_due' && (language === 'bn' ? 'বকেয়া' : 'Partial Due')}
                </button>
              ))}
            </div>
          </div>

          {/* Mobile Compact Summary List (< 768px) — Always compact on mobile */}
          <div className="md:hidden border border-slate-200/90 dark:border-zinc-800 rounded-2xl overflow-hidden bg-white dark:bg-zinc-950 divide-y divide-slate-100 dark:divide-zinc-850">
            {filteredInvoices.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-400">
                কোন অর্ডার পাওয়া যায়নি
              </div>
            ) : (
              filteredInvoices.slice(0, 8).map((inv) => (
                <button
                  key={`m_dash_${inv.id}`}
                  type="button"
                  onClick={() => setQuickOrderInvoice(inv)}
                  className="w-full px-3.5 py-2.5 text-left flex items-center justify-between gap-2.5 hover:bg-slate-50/80 dark:hover:bg-zinc-900/70 transition cursor-pointer"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono font-bold text-xs text-slate-900 dark:text-white">
                        #{inv.invoiceNo}
                      </span>
                      <span className="font-semibold text-xs text-slate-700 dark:text-zinc-300 truncate">
                        {inv.customerName}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-400 mt-0.5">
                      {new Date(inv.createdAt).toLocaleDateString('en-GB')} • {inv.items.length}{' '}
                      {inv.items.length === 1 ? 'item' : 'items'}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <div className="text-right">
                      <div className="font-mono font-black text-xs text-slate-900 dark:text-white">
                        ৳{inv.total.toLocaleString()}
                      </div>
                      <div
                        className={`text-[10px] font-bold ${
                          inv.status === 'completed'
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : 'text-amber-600 dark:text-amber-400'
                        }`}
                      >
                        {inv.status === 'completed' ? 'Paid' : 'Partial Due'}
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
                  </div>
                </button>
              ))
            )}
          </div>

          {/* Desktop View (>= 768px): Table or Cards */}
          <div className="hidden md:block">
            {viewMode === 'table' ? (
              <div className="border border-slate-200/90 dark:border-zinc-800 rounded-2xl overflow-hidden bg-white dark:bg-zinc-950 shadow-xs">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs text-slate-700 dark:text-zinc-300">
                    <thead className="bg-slate-50 dark:bg-zinc-900 border-b border-slate-200 dark:border-zinc-800 text-[11px] uppercase font-bold text-slate-500 dark:text-zinc-400">
                      <tr>
                        <th className="p-3">Order ID</th>
                        <th className="p-3">Customer</th>
                        <th className="p-3">Items Ordered</th>
                        <th className="p-3">Date</th>
                        <th className="p-3">Total</th>
                        <th className="p-3 text-right">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-zinc-850">
                      {filteredInvoices.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="p-8 text-center text-slate-400 dark:text-zinc-500">
                            কোন অর্ডার পাওয়া যায়নি (No matching orders found)
                          </td>
                        </tr>
                      ) : (
                        filteredInvoices.slice(0, 8).map((inv) => (
                          <tr
                            key={inv.id}
                            onClick={() => setQuickOrderInvoice(inv)}
                            className="hover:bg-slate-50/80 dark:hover:bg-zinc-900/70 transition cursor-pointer group"
                          >
                            <td className="p-3 whitespace-nowrap font-mono font-bold text-slate-900 dark:text-white group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition">
                              #{inv.invoiceNo}
                            </td>

                            <td className="p-3 whitespace-nowrap">
                              <div className="font-semibold text-slate-900 dark:text-white">{inv.customerName}</div>
                              <div className="text-[10px] text-slate-500 dark:text-zinc-500 font-mono">{inv.customerPhone}</div>
                            </td>

                            <td className="p-3 max-w-[200px]">
                              <div className="truncate text-slate-800 dark:text-zinc-200">
                                {inv.items.map((i) => i.title).join(', ')}
                              </div>
                              <div className="text-[10px] text-slate-400 dark:text-zinc-500">
                                {inv.items.reduce((s, it) => s + it.quantity, 0)} pcs total
                              </div>
                            </td>

                            <td className="p-3 whitespace-nowrap text-slate-500 dark:text-zinc-400 text-[11px]">
                              {new Date(inv.createdAt).toLocaleDateString('en-US', {
                                month: 'short',
                                day: 'numeric',
                              })}
                            </td>

                            <td className="p-3 whitespace-nowrap font-mono font-black text-slate-900 dark:text-white">
                              ৳{inv.total.toLocaleString()}
                            </td>

                            <td className="p-3 whitespace-nowrap text-right">
                              <span
                                className={`text-[10px] font-bold px-2.5 py-1 rounded-full border inline-flex items-center gap-1 ${
                                  inv.status === 'completed'
                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/30'
                                    : inv.status === 'partial_due'
                                    ? 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/30'
                                    : 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-500/10 dark:text-rose-400 dark:border-rose-500/30'
                                }`}
                              >
                                <span className="w-1.5 h-1.5 rounded-full bg-current" />
                                {inv.status === 'completed' ? 'Delivered' : 'Partial Advance'}
                              </span>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              /* Cards View */
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {filteredInvoices.slice(0, 6).map((inv) => (
                  <div
                    key={inv.id}
                    onClick={() => setQuickOrderInvoice(inv)}
                    className="bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-2xl p-4 space-y-2 hover:border-slate-300 dark:hover:border-zinc-700 transition cursor-pointer"
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <span className="text-[10px] font-mono text-slate-500 dark:text-zinc-500">#{inv.invoiceNo}</span>
                        <div className="font-bold text-slate-900 dark:text-white text-xs">{inv.customerName}</div>
                        <div className="text-[10px] text-slate-500 dark:text-zinc-400 font-mono">{inv.customerPhone}</div>
                      </div>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          inv.status === 'completed'
                            ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400'
                            : 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400'
                        }`}
                      >
                        {inv.status === 'completed' ? 'Delivered' : 'Partial Due'}
                      </span>
                    </div>

                    <div className="text-xs text-slate-700 dark:text-zinc-300 truncate">
                      {inv.items.map((i) => i.title).join(', ')}
                    </div>

                    <div className="flex justify-between items-center pt-2 border-t border-slate-200 dark:border-zinc-850 text-xs">
                      <span className="text-slate-500 dark:text-zinc-500">{new Date(inv.createdAt).toLocaleDateString()}</span>
                      <strong className="font-mono text-emerald-600 dark:text-emerald-400 font-black">
                        ৳{inv.total.toLocaleString()}
                      </strong>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Column (4 cols): Notification & Operations Centre */}
        <div className="lg:col-span-4 bg-white dark:bg-zinc-900 border border-slate-200/90 dark:border-zinc-800 rounded-3xl p-5 sm:p-6 shadow-xs space-y-4 flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-zinc-800">
              <div className="flex items-center gap-2">
                <Bell className="w-4 h-4 text-emerald-600 dark:text-emerald-400" strokeWidth={1.75} />
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">Notification Centre</h3>
              </div>

              <select
                value={alertFilter}
                onChange={(e) => setAlertFilter(e.target.value as any)}
                className="bg-slate-50 dark:bg-zinc-950 border border-slate-300 dark:border-zinc-800 text-[11px] text-slate-700 dark:text-zinc-300 rounded-xl px-2.5 py-1 focus:outline-none cursor-pointer"
              >
                <option value="today">Today ▾</option>
                <option value="week">This Week</option>
                <option value="all">All Alerts</option>
              </select>
            </div>

            {/* Alert Cards Stack */}
            <div className="space-y-3">
              {/* Alert 1: Low Stock Warning */}
              {lowStockAlerts.length > 0 && !dismissedAlerts.includes('alert_stock') && (
                <div className="bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/50 rounded-2xl p-3.5 space-y-1 relative">
                  <button
                    onClick={() => handleDismissAlert('alert_stock')}
                    className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-700 dark:hover:text-white"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                  <div className="flex items-center gap-2 text-rose-700 dark:text-rose-400 text-xs font-bold">
                    <AlertTriangle className="w-4 h-4 shrink-0" strokeWidth={1.75} />
                    <span>Low Stock Alert ({lowStockAlerts.length} items)</span>
                  </div>
                  <p className="text-[11px] text-slate-700 dark:text-zinc-300">
                    {lowStockAlerts[0]?.name} has only{' '}
                    <strong className="text-rose-600 dark:text-rose-400 font-mono">{lowStockAlerts[0]?.totalStock} units</strong> remaining!
                  </p>
                  <span className="text-[10px] text-slate-400 dark:text-zinc-500 block pt-1">30 mins ago • Inventory Guard</span>
                </div>
              )}

              {/* Alert 2: Heat-Press DTF Print Waiting (Sportswear only) */}
              {!isClothingStore && pendingCustomPrints > 0 && !dismissedAlerts.includes('alert_press') && (
                <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/50 rounded-2xl p-3.5 space-y-1 relative">
                  <button
                    onClick={() => handleDismissAlert('alert_press')}
                    className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-700 dark:hover:text-white"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                  <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400 text-xs font-bold">
                    <Flame className="w-4 h-4 shrink-0" strokeWidth={1.75} />
                    <span>Heat-Press Print Queue</span>
                  </div>
                  <p className="text-[11px] text-slate-700 dark:text-zinc-300">
                    <strong className="text-slate-900 dark:text-white font-mono">{pendingCustomPrints} custom orders</strong> waiting for DTF name & number printing
                  </p>
                  <div className="flex justify-between items-center pt-1 text-[10px]">
                    <span className="text-slate-400 dark:text-zinc-500">2 hours ago</span>
                    <button
                      onClick={() => onNavigate && onNavigate('pipeline')}
                      className="text-amber-700 dark:text-amber-400 hover:underline font-bold"
                    >
                      Open Pipeline →
                    </button>
                  </div>
                </div>
              )}

              {/* Alert 3: Reseller Due Recovery Alert */}
              {resellersWithDue.length > 0 && !dismissedAlerts.includes('alert_reseller') && (
                <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900/50 rounded-2xl p-3.5 space-y-1 relative">
                  <button
                    onClick={() => handleDismissAlert('alert_reseller')}
                    className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-700 dark:hover:text-white"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                  <div className="flex items-center gap-2 text-blue-700 dark:text-blue-400 text-xs font-bold">
                    <Truck className="w-4 h-4 shrink-0" strokeWidth={1.75} />
                    <span>Reseller Baki Recovery Due</span>
                  </div>
                  <p className="text-[11px] text-slate-700 dark:text-zinc-300">
                    {resellersWithDue[0]?.name} has{' '}
                    <strong className="text-rose-600 dark:text-rose-400 font-mono">
                      ৳{resellersWithDue[0]?.currentDueBalance.toLocaleString()}
                    </strong>{' '}
                    balance due
                  </p>
                  <div className="flex justify-between items-center pt-1 text-[10px]">
                    <span className="text-slate-400 dark:text-zinc-500">Today</span>
                    <button
                      onClick={() => onNavigate && onNavigate('reseller')}
                      className="text-blue-700 dark:text-blue-400 hover:underline font-bold"
                    >
                      View Khata →
                    </button>
                  </div>
                </div>
              )}

              {/* Alert 4: Milestone Reached */}
              <div className="bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/50 rounded-2xl p-3.5 space-y-1 relative">
                <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400 text-xs font-bold">
                  <CheckCircle className="w-4 h-4 shrink-0" strokeWidth={1.75} />
                  <span>Target Milestone Active</span>
                </div>
                <p className="text-[11px] text-slate-700 dark:text-zinc-300">
                  Store generated <strong className="text-emerald-700 dark:text-emerald-400 font-mono">৳{totalSalesRevenue.toLocaleString()}</strong> in gross retail turnover
                </p>
                <span className="text-[10px] text-slate-400 dark:text-zinc-500 block pt-1">Automated System Audit</span>
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* 5. BUSINESS INTELLIGENCE REPORTS: BEST-SELLING PRODUCTS, VARIANT BREAKDOWN, STOCK & PAYMENT RECONCILIATION */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Panel A: Real Best-Selling Products */}
        <div className="bg-white dark:bg-zinc-900 border border-slate-200/90 dark:border-zinc-800 rounded-3xl p-5 space-y-3 shadow-xs">
          <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-zinc-800">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-zinc-200 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[#164e3f] dark:text-emerald-400" strokeWidth={1.75} />
              <span>{pickText('সর্বাধিক বিক্রিত পণ্য', 'Best-Selling Products')}</span>
            </h3>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#e6f4ea] text-[#164e3f]">
              {pickText('অ্যাক্টিভ শপ ডেটা', 'Active Shop Data')}
            </span>
          </div>

          {businessReport.bestSellingProducts.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-400">
              {pickText('নির্বাচিত সময়ে কোনো বিক্রয় রেকর্ড নেই', 'No sales records in selected period')}
            </div>
          ) : (
            <div className="space-y-4 sm:space-y-4.5 pt-1">
              {businessReport.bestSellingProducts.slice(0, 6).map((prod, idx) => {
                const topQty = Math.max(1, businessReport.bestSellingProducts[0]?.qtySold || 1);
                const pct = Math.min(100, Math.round((prod.qtySold / topQty) * 100));
                return (
                  <div key={idx} className="space-y-2">
                    <div className="flex justify-between items-center text-xs">
                      <div className="truncate pr-2">
                        <span className="text-slate-900 dark:text-white font-bold">{prod.title}</span>
                        <span className="text-[10px] text-slate-500 dark:text-zinc-400 ml-1.5 font-mono">
                          ({prod.qtySold} pcs)
                        </span>
                      </div>
                      <strong className="font-mono text-[#164e3f] dark:text-emerald-400 font-bold shrink-0">
                        ৳{prod.grossRevenue.toLocaleString()}
                      </strong>
                    </div>

                    <div className="h-2 w-full bg-slate-100 dark:bg-zinc-950 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-[#164e3f] rounded-full transition-all duration-300"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Panel B: Sales Analytics Graph Component */}
        <div className="bg-white dark:bg-zinc-900 border border-slate-200/90 dark:border-zinc-800 rounded-3xl p-5 sm:p-6 space-y-4 shadow-xs">
          {/* Section Header */}
          <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-zinc-800">
            <div>
              <h2 className="text-base sm:text-lg font-black text-[#164e3f] dark:text-emerald-400 tracking-tight">
                Sales Analytics
              </h2>
            </div>
            <span className="text-xs text-slate-400 dark:text-zinc-500 font-medium">
              Track your store performance
            </span>
          </div>

          {/* Two Custom Dropdowns Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <CustomAnalyticsDropdown
              label="POS Category"
              value={analyticsCategory}
              options={categoryOptions}
              onChange={setAnalyticsCategory}
              icon={Shirt}
            />
            <CustomAnalyticsDropdown
              label="View By"
              value={analyticsViewBy}
              options={viewByOptions}
              onChange={(val) => setAnalyticsViewBy(val as 'size' | 'color')}
              icon={BarChart3}
            />
          </div>

          {/* Chart Container */}
          <div className="pt-2">
            <div className="mb-4">
              <h3 className="text-sm sm:text-base font-bold text-[#164e3f] dark:text-emerald-400">
                {analyticsViewBy === 'size' ? 'Sales by Size' : 'Sales by Color'} ({selectedCategoryLabel})
              </h3>
              <p className="text-xs font-semibold text-slate-500 dark:text-zinc-400 mt-0.5 font-mono">
                Total Sales: <span className="text-slate-900 dark:text-white font-extrabold">৳{aggregatedAnalytics.totalRevenue.toLocaleString()}</span>
              </p>
            </div>

            {/* SVG Graph Component with horizontal scroll support when content expands */}
            {(() => {
              const itemArr = aggregatedAnalytics.items;
              const count = itemArr.length;
              // Provide comfortable minimum slot width per bar so labels and values never overlap or get crowded
              const minSlotWidth = 60;
              const computedSvgWidth = Math.max(500, 55 + count * minSlotWidth);
              const rightBoundary = computedSvgWidth - 15;

              return (
                <div className="w-full overflow-x-auto pb-2 focus:outline-none scrollbar-thin">
                  <div
                    style={{ minWidth: `${computedSvgWidth}px` }}
                    className="h-56 sm:h-64 relative"
                  >
                    <svg
                      className="w-full h-full overflow-visible"
                      viewBox={`0 0 ${computedSvgWidth} 220`}
                      preserveAspectRatio="none"
                    >
                      {/* Grid Lines & Ticks */}
                      {analyticsScale.ticks.map((tick) => {
                        const yRatio = tick / analyticsScale.maxVal;
                        const yPos = 25 + (1 - yRatio) * 155; // y=25 (top) to y=180 (bottom)
                        return (
                          <g key={tick}>
                            <line
                              x1="45"
                              y1={yPos}
                              x2={rightBoundary}
                              y2={yPos}
                              stroke="#e2e8f0"
                              strokeDasharray="3 3"
                              className="dark:stroke-zinc-800"
                            />
                            <text
                              x="38"
                              y={yPos + 3}
                              textAnchor="end"
                              className="fill-slate-400 dark:fill-zinc-500 text-[10px] font-mono"
                            >
                              {tick >= 1000 ? `${(tick / 1000).toFixed(1)}k`.replace('.0k', 'k') : tick}
                            </text>
                          </g>
                        );
                      })}

                      {/* Left Axis */}
                      <line x1="45" y1="25" x2="45" y2="180" stroke="#cbd5e1" className="dark:stroke-zinc-700" />

                      {/* Bars */}
                      {itemArr.map((item, idx) => {
                        const availableWidth = computedSvgWidth - 60;
                        const slotWidth = availableWidth / count;
                        const barWidth = Math.min(38, Math.max(16, slotWidth * 0.48));
                        const centerX = 45 + (idx + 0.5) * slotWidth;

                        const barHeight = Math.max(4, (item.revenue / analyticsScale.maxVal) * 155);
                        const barY = 180 - barHeight;

                        return (
                          <g key={item.label} className="group cursor-pointer">
                            {/* Floating Value Label */}
                            <text
                              x={centerX}
                              y={barY - 6}
                              textAnchor="middle"
                              className="fill-slate-600 dark:fill-zinc-300 text-[10px] sm:text-[11px] font-mono font-bold"
                            >
                              ৳{item.revenue.toLocaleString()}
                            </text>

                            {/* Bar */}
                            <rect
                              x={centerX - barWidth / 2}
                              y={barY}
                              width={barWidth}
                              height={barHeight}
                              rx="5"
                              ry="5"
                              className="fill-[#164e3f] dark:fill-emerald-600 group-hover:fill-emerald-700 dark:group-hover:fill-emerald-500 transition-all duration-200"
                            />

                            {/* X-Axis Label */}
                            <text
                              x={centerX}
                              y="202"
                              textAnchor="middle"
                              className="fill-slate-600 dark:fill-zinc-400 text-[11px] sm:text-xs font-bold"
                            >
                              {item.label}
                            </text>
                          </g>
                        );
                      })}
                    </svg>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>

        {/* Panel C: Payment Method Reconciliation & Low/Slow Stock */}
        <div className="bg-white dark:bg-zinc-900 border border-slate-200/90 dark:border-zinc-800 rounded-3xl p-5 space-y-4 shadow-xs">
          <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-zinc-800">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-zinc-200 flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-[#164e3f] dark:text-emerald-400" strokeWidth={1.75} />
              <span>{pickText('পেমেন্ট রিকনসিলিয়েশন ও স্টক সতর্কতা', 'Payment Reconciliation & Stock Alerts')}</span>
            </h3>
            <span className="text-[10px] text-slate-500">{pickText('রিকনসিলিয়েশন', 'Reconciliation')}</span>
          </div>

          {/* Combined Grid Container for Mobile / Split Grids for Computer */}
          <div className="grid grid-cols-2 gap-0 sm:gap-2 text-xs">
            {/* 1. Top-Left: Cash */}
            <div className="p-2.5 bg-transparent sm:bg-[#f4f7f5] dark:sm:bg-zinc-800 border border-slate-200/80 dark:border-zinc-700/80 rounded-tl-2xl rounded-tr-none rounded-b-none sm:rounded-xl">
              <span className="text-[10px] text-slate-500 block">{pickText('নগদ ক্যাশ', 'Cash')}</span>
              <strong className="font-mono font-bold text-slate-900 dark:text-white">
                ৳{businessReport.paymentReconciliation.cash.toLocaleString()}
              </strong>
            </div>

            {/* 2. Top-Right: bKash Merchant QR */}
            <div className="p-2.5 bg-transparent sm:bg-[#f4f7f5] dark:sm:bg-zinc-800 border border-slate-200/80 dark:border-zinc-700/80 -ml-[1px] sm:ml-0 rounded-tr-2xl rounded-tl-none rounded-b-none sm:rounded-xl">
              <span className="text-[10px] text-slate-500 block">{pickText('বিকাশ মার্চেন্ট QR', 'bKash Merchant QR')}</span>
              <strong className="font-mono font-bold text-pink-600">
                ৳{businessReport.paymentReconciliation.merchantBkash.toLocaleString()}
              </strong>
            </div>

            {/* 3. Mid-Left: Personal bKash */}
            <div className="p-2.5 bg-transparent sm:bg-[#f4f7f5] dark:sm:bg-zinc-800 border border-slate-200/80 dark:border-zinc-700/80 -mt-[1px] sm:mt-0 rounded-none sm:rounded-xl">
              <span className="text-[10px] text-slate-500 block">{pickText('পার্সোনাল বিকাশ', 'Personal bKash')}</span>
              <strong className="font-mono font-bold text-rose-600">
                ৳{businessReport.paymentReconciliation.personalBkash.toLocaleString()}
              </strong>
            </div>

            {/* 4. Mid-Right: Nagad & Bank */}
            <div className="p-2.5 bg-transparent sm:bg-[#f4f7f5] dark:sm:bg-zinc-800 border border-slate-200/80 dark:border-zinc-700/80 -ml-[1px] -mt-[1px] sm:ml-0 sm:mt-0 rounded-none sm:rounded-xl">
              <span className="text-[10px] text-slate-500 block">{pickText('নগদ ও ব্যাংক', 'Nagad & Bank')}</span>
              <strong className="font-mono font-bold text-[#F26522]">
                ৳{(businessReport.paymentReconciliation.nagad + businessReport.paymentReconciliation.bank).toLocaleString()}
              </strong>
            </div>

            {/* 5. Bottom Div spanning column 2 on mobile / separated by border-t on computer */}
            <div className="col-span-2 sm:col-span-2 sm:pt-2 sm:border-t sm:border-slate-100 sm:dark:border-zinc-800 grid grid-cols-2 gap-0 sm:gap-2">
              {/* 5a. Low Stock Alert */}
              <div className="p-2.5 bg-rose-50/70 dark:bg-rose-950/20 border border-slate-200/80 dark:border-zinc-800 sm:border-rose-200 sm:dark:border-rose-800 -mt-[1px] sm:mt-0 rounded-bl-2xl rounded-tr-none rounded-tl-none rounded-br-none sm:rounded-xl">
                <span className="text-[10px] font-bold text-rose-700 dark:text-rose-300 block">
                  {pickText(`কম স্টক (≤${storeConfig.lowStockThreshold || 5})`, `Low Stock (≤${storeConfig.lowStockThreshold || 5})`)}
                </span>
                <strong className="font-mono text-sm font-black text-rose-600">
                  {businessReport.lowStockProducts.length} {pickText('টি পণ্য', 'items')}
                </strong>
              </div>

              {/* 5b. Slow Moving Stock */}
              <div className="p-2.5 bg-amber-50/70 dark:bg-amber-950/20 border border-slate-200/80 dark:border-zinc-800 sm:border-amber-200 sm:dark:border-amber-800 -ml-[1px] -mt-[1px] sm:ml-0 sm:mt-0 rounded-br-2xl rounded-tl-none rounded-tr-none rounded-bl-none sm:rounded-xl">
                <span className="text-[10px] font-bold text-amber-800 dark:text-amber-300 block">
                  {pickText('ধীরগতির পণ্য', 'Slow-Moving Stock')}
                </span>
                <strong className="font-mono text-sm font-black text-amber-700">
                  {businessReport.slowMovingProducts.length} {pickText('টি পণ্য', 'items')}
                </strong>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 6. PARTNER POSITIONS OVERVIEW (Owner & Super Admin Only) */}
      {showPartners && (
        <div className="bg-white dark:bg-zinc-900 border border-slate-200/90 dark:border-zinc-800 rounded-3xl p-5 space-y-3 shadow-xs">
          <div className="flex items-center justify-between pb-1">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-zinc-200 flex items-center gap-2">
              <Users className="w-4 h-4 text-[#164e3f] dark:text-emerald-400" strokeWidth={1.75} />
              {pickText('পার্টনারদের অবস্থান ও ইকুইটি', 'Partner Positions & Ownership Equity')}
            </h3>
            <span className="text-[11px] text-slate-500 dark:text-zinc-500">
              {pickText('সুরক্ষিত লেজার', 'Secured Ledger')}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {owners.map((owner) => {
              const net = (owner.totalAdded || 0) - (owner.totalWithdrawn || 0);
              const showBottomBorder = owners.length >= 2;
              return (
                <div
                  key={owner.id}
                  className={`bg-transparent py-3 px-1 flex items-center justify-between text-xs ${
                    showBottomBorder ? 'border-b border-slate-200/80 dark:border-zinc-800' : ''
                  }`}
                >
                  <div>
                    <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                      <span>{owner.name}</span>
                      <span className="text-[10px] font-mono text-[#164e3f] dark:text-emerald-400 font-semibold">@{owner.username}</span>
                    </div>
                    <div className="text-[10px] text-slate-500 dark:text-zinc-500">
                      Ownership: <strong className="text-slate-800 dark:text-zinc-300">{owner.sharePercentage || 50}%</strong> • {owner.phone}
                    </div>
                  </div>

                  <div className="text-right">
                    <span className="text-[10px] text-slate-500 dark:text-zinc-400">Net Invested Balance:</span>
                    <div
                      className={`font-mono font-black text-sm ${
                        net >= 0 ? 'text-[#1f8a5b] dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                      }`}
                    >
                      {net >= 0 ? '+' : ''}৳{net.toLocaleString()}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Compact Bottom Sheet for Dashboard Order Summary */}
      <BottomSheet
        isOpen={Boolean(quickOrderInvoice)}
        onClose={() => setQuickOrderInvoice(null)}
        title={quickOrderInvoice ? `Order #${quickOrderInvoice.invoiceNo}` : 'Order Summary'}
        subtitle={
          quickOrderInvoice
            ? `${quickOrderInvoice.customerName} • ${new Date(quickOrderInvoice.createdAt).toLocaleDateString('en-GB')}`
            : undefined
        }
        footer={
          quickOrderInvoice ? (
            <button
              type="button"
              onClick={() => {
                const inv = quickOrderInvoice;
                setQuickOrderInvoice(null);
                handleOpenReceipt(inv);
              }}
              className="w-full py-2 px-3 rounded-xl bg-[#164e3f] hover:bg-[#123e32] text-white font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <span>Open Full Receipt / Edit Order</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          ) : undefined
        }
      >
        {quickOrderInvoice && (
          <div className="space-y-2.5">
            <div className="divide-y divide-slate-100 dark:divide-zinc-800 border border-slate-100 dark:border-zinc-800 rounded-xl overflow-hidden">
              {quickOrderInvoice.items.map((it, idx) => (
                <div key={idx} className="px-3 py-1.5 flex items-center justify-between gap-2">
                  <span className="truncate font-medium text-slate-800 dark:text-zinc-200">
                    {it.title} ({it.size}) × {it.quantity}
                  </span>
                  <span className="font-mono font-bold text-slate-900 dark:text-white shrink-0">
                    ৳{it.subtotal.toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
            <div className="space-y-1 pt-1 border-t border-slate-100 dark:border-zinc-800">
              <div className="flex justify-between">
                <span className="text-slate-500">Total Bill</span>
                <span className="font-mono font-bold text-slate-900 dark:text-white">
                  ৳{quickOrderInvoice.total.toLocaleString()}
                </span>
              </div>
              {(quickOrderInvoice.dueAmount || 0) > 0 && (
                <div className="flex justify-between text-amber-600 font-bold">
                  <span>Due Balance</span>
                  <span className="font-mono">৳{(quickOrderInvoice.dueAmount || 0).toLocaleString()}</span>
                </div>
              )}
            </div>
          </div>
        )}
      </BottomSheet>

      {/* Invoice Receipt Slip Modal */}
      {selectedInvoice && (
        <ReceiptModal
          isOpen={isReceiptModalOpen}
          onClose={() => {
            setIsReceiptModalOpen(false);
            setSelectedInvoice(null);
          }}
          invoice={selectedInvoice}
          onInvoiceUpdated={() => {
            setInvoices(dbService.getInvoices(currentTenant.id, role));
          }}
        />
      )}
    </div>
  );
};
