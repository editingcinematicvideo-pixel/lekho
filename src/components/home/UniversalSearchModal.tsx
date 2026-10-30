import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useApp } from '../../context/AppContext';
import { dbService } from '../../services/db';
import { isClothingShop } from '../../utils/securityPolicy';
import {
  Search,
  X,
  ShoppingCart,
  Users,
  Calendar,
  FileText,
  Building2,
  ArrowLeftRight,
  Wallet,
  Flame,
  TrendingUp,
  Settings,
  Calculator,
  Receipt,
  Copy,
  Check,
  ChevronRight,
  ArrowRight,
  Clock,
  ExternalLink,
} from 'lucide-react';

interface UniversalSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (tab: string, subtab?: string) => void;
  onOpenExchangeModal: () => void;
  onOpenZReportModal: () => void;
}

export const UniversalSearchModal: React.FC<UniversalSearchModalProps> = ({
  isOpen,
  onClose,
  onNavigate,
  onOpenExchangeModal,
  onOpenZReportModal,
}) => {
  const { currentTenant, showToast, pickText } = useApp();
  const isClothingStore = isClothingShop(currentTenant);
  const [query, setQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'all' | 'modules' | 'customers' | 'invoices'>('all');
  const [copiedPhone, setCopiedPhone] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-focus search input when opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
    } else {
      setQuery('');
      setActiveTab('all');
    }
  }, [isOpen]);

  // Handle ESC key to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Copy phone handler
  const handleCopyPhone = (phone: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!phone) return;
    navigator.clipboard.writeText(phone);
    setCopiedPhone(phone);
    showToast(`ফোন নম্বর কপি করা হয়েছে: ${phone}`, 'success');
    setTimeout(() => {
      setCopiedPhone(null);
    }, 2000);
  };

  // Modules list with rich metadata
  const MODULES = useMemo(() => [
    {
      id: 'pos',
      title: pickText('কাউন্টার সেল', 'POS Counter'),
      desc: isClothingStore ? "New POS sale entry & Men's Clothing Counter" : 'New POS sale entry & Jersey Builder',
      icon: ShoppingCart,
      category: 'modules',
      action: () => {
        onNavigate('pos');
        onClose();
      },
    },
    {
      id: 'customers',
      title: pickText('গ্রাহক তালিকা', 'Customers'),
      desc: 'Customer directory & purchase history',
      icon: Users,
      category: 'modules',
      action: () => {
        onNavigate('customers');
        onClose();
      },
    },
    {
      id: 'daily_closing',
      title: pickText('দৈনিক ক্লোজিং', 'Daily Closing'),
      desc: 'Shift audit & drawer discrepancy audit',
      icon: Calendar,
      category: 'modules',
      action: () => {
        onNavigate('daily_closing');
        onClose();
      },
    },
    {
      id: 'invoices',
      title: pickText('মেমো খাতা', 'Transactions & Invoices'),
      desc: 'Sales ledger, due tracking & print copies',
      icon: FileText,
      category: 'modules',
      action: () => {
        onNavigate('invoices');
        onClose();
      },
    },
    {
      id: 'size_exchange',
      title: pickText('সাইজ এক্সচেঞ্জ', 'Size Exchange'),
      desc: 'Full-page 10s size swap, return & stock adjustment',
      icon: ArrowLeftRight,
      category: 'modules',
      action: () => {
        onNavigate('size_exchange');
        onClose();
      },
    },
    {
      id: 'reseller',
      title: pickText('পাইকারি খাতা', 'Wholesale / Reseller'),
      desc: 'Reseller accounts, dispatch & baki ledger',
      icon: Building2,
      category: 'modules',
      action: () => {
        onNavigate('reseller');
        onClose();
      },
    },
    {
      id: 'drawers',
      title: pickText('ভল্ট ও ড্রয়ার', 'Multi-Drawer Vault'),
      desc: 'Cash, bKash, Nagad, Bank transfer balances',
      icon: Wallet,
      category: 'modules',
      action: () => {
        onNavigate('drawers');
        onClose();
      },
    },
    ...(!isClothingStore
      ? [
          {
            id: 'pipeline',
            title: pickText('ডিটিএফ প্রিন্ট', 'Jersey Print Pipeline'),
            desc: 'DTF queue & heat-press order board',
            icon: Flame,
            category: 'modules',
            action: () => {
              onNavigate('pipeline');
              onClose();
            },
          },
        ]
      : []),
    {
      id: 'dashboard',
      title: pickText('ড্যাশবোর্ড', 'Summary Dashboard'),
      desc: 'Live revenue, sales KPI & margin report',
      icon: TrendingUp,
      category: 'modules',
      action: () => {
        onNavigate('dashboard');
        onClose();
      },
    },
    {
      id: 'settings',
      title: pickText('দোকান সেটিংস', 'Store Settings'),
      desc: 'Staff PINs, receipt printer & categories',
      icon: Settings,
      category: 'modules',
      action: () => {
        onNavigate('settings');
        onClose();
      },
    },
    {
      id: 'lot_splitter',
      title: pickText('প্রাইসিং ক্যালকুলেটর', 'Lot Pricing Splitter'),
      desc: 'Wholesale bundle cost breakdown',
      icon: Calculator,
      category: 'modules',
      action: () => {
        onNavigate('lot_splitter');
        onClose();
      },
    },
    {
      id: 'expenses',
      title: pickText('দৈনিক খরচ', 'Expense Ledger'),
      desc: 'Store expense vouchers & petty cash',
      icon: Receipt,
      category: 'modules',
      action: () => {
        onNavigate('expenses');
        onClose();
      },
    },
  ], [onNavigate, onOpenExchangeModal, onClose]);

  // Raw invoices
  const allInvoices = useMemo(() => {
    return dbService.getInvoices(currentTenant.id).filter((i) => !i.isSoftDeleted);
  }, [currentTenant.id]);

  // Aggregated customers
  const allCustomers = useMemo(() => {
    const map = new Map<string, {
      name: string;
      phone: string;
      totalSpent: number;
      ordersCount: number;
      totalDue: number;
      lastDate: string;
    }>();

    allInvoices.forEach((inv) => {
      const phone = (inv.customerPhone || '').trim();
      const name = (inv.customerName || 'Walk-in Customer').trim();
      const key = phone ? phone : name;

      if (!map.has(key)) {
        map.set(key, {
          name,
          phone,
          totalSpent: 0,
          ordersCount: 0,
          totalDue: 0,
          lastDate: inv.createdAt,
        });
      }

      const entry = map.get(key)!;
      entry.totalSpent += Number(inv.total) || 0;
      entry.ordersCount += 1;
      entry.totalDue += Number(inv.dueAmount) || 0;
    });

    return Array.from(map.values()).sort((a, b) => b.totalSpent - a.totalSpent);
  }, [allInvoices]);

  // Filtered Modules
  const filteredModules = useMemo(() => {
    if (!query.trim()) return MODULES.slice(0, 6);
    const q = query.toLowerCase().trim();
    return MODULES.filter(
      (m) =>
        m.title.toLowerCase().includes(q) ||
        m.desc.toLowerCase().includes(q) ||
        m.id.toLowerCase().includes(q)
    );
  }, [query, MODULES]);

  // Filtered Customers
  const filteredCustomers = useMemo(() => {
    if (!query.trim()) return allCustomers.slice(0, 4);
    const q = query.toLowerCase().trim();
    return allCustomers.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.phone.includes(q)
    ).slice(0, 8);
  }, [query, allCustomers]);

  // Filtered Invoices
  const filteredInvoices = useMemo(() => {
    if (!query.trim()) return allInvoices.slice(0, 4);
    const q = query.toLowerCase().trim();
    return allInvoices.filter(
      (inv) =>
        inv.invoiceNo.toLowerCase().includes(q) ||
        (inv.customerPhone && inv.customerPhone.includes(q)) ||
        (inv.customerName && inv.customerName.toLowerCase().includes(q))
    ).slice(0, 8);
  }, [query, allInvoices]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex flex-col justify-start items-center p-3 sm:p-6 overflow-y-auto animate-in fade-in duration-150">
      <div className="bg-white dark:bg-zinc-900 border border-slate-200/90 dark:border-zinc-800 rounded-3xl max-w-2xl w-full p-4 sm:p-5 shadow-2xl text-slate-900 dark:text-zinc-100 relative mt-2 sm:mt-12 flex flex-col max-h-[88vh]">
        {/* Top Input Bar */}
        <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100 dark:border-zinc-800">
          <div className="w-10 h-10 rounded-2xl bg-[#164e3f] text-white flex items-center justify-center shrink-0 shadow-xs">
            <Search className="w-5 h-5" />
          </div>

          <div className="relative flex-1">
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="খুঁজুন: কাস্টমার নাম, মোবাইল, ইনভয়েস নম্বর বা টুলস..."
              className="w-full bg-[#f4f7f5] dark:bg-zinc-800 border border-slate-200/80 dark:border-zinc-700 rounded-2xl pl-4 pr-9 py-2.5 text-xs sm:text-sm font-semibold text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-[#164e3f] focus:ring-2 focus:ring-[#164e3f]/20 transition"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={onClose}
            className="px-3 py-2 rounded-xl border border-slate-200 dark:border-zinc-700 text-xs font-semibold text-slate-600 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800 transition cursor-pointer shrink-0"
          >
            Cancel
          </button>
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 pt-3 pb-2 overflow-x-auto no-scrollbar">
          {[
            { id: 'all', label: pickText('সব ফলাফল', 'All Results') },
            { id: 'modules', label: `Tools (${filteredModules.length})` },
            { id: 'customers', label: `Customers (${filteredCustomers.length})` },
            { id: 'invoices', label: `Invoices (${filteredInvoices.length})` },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-3 py-1 rounded-xl text-xs font-bold transition cursor-pointer shrink-0 ${
                activeTab === tab.id
                  ? 'bg-[#164e3f] text-white shadow-xs'
                  : 'bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400 hover:bg-slate-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Results Container */}
        <div className="flex-1 overflow-y-auto space-y-4 pt-2 pr-1 max-h-[62vh]">
          {/* 1. Modules / Quick Navigation */}
          {(activeTab === 'all' || activeTab === 'modules') && filteredModules.length > 0 && (
            <div className="space-y-1.5">
              <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider px-1">
                POS Modules & Tools
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {filteredModules.map((m) => {
                  const Icon = m.icon;
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={m.action}
                      className="p-2.5 rounded-2xl bg-white hover:bg-[#e6f4ea]/60 dark:bg-zinc-850 dark:hover:bg-emerald-950/40 border border-slate-200/80 dark:border-zinc-750 hover:border-[#164e3f] text-left transition cursor-pointer flex items-center justify-between group"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-8 h-8 rounded-xl bg-[#e6f4ea] dark:bg-emerald-950/80 text-[#1f8a5b] dark:text-emerald-400 flex items-center justify-center shrink-0 group-hover:bg-[#164e3f] group-hover:text-white transition-colors">
                          <Icon className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <div className="text-xs font-bold text-slate-900 dark:text-white truncate">
                            {m.title}
                          </div>
                          <div className="text-[10px] text-slate-400 dark:text-zinc-400 truncate">
                            {m.desc}
                          </div>
                        </div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-[#164e3f] group-hover:translate-x-0.5 transition-transform shrink-0" />
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* 2. Customers Matches */}
          {(activeTab === 'all' || activeTab === 'customers') && filteredCustomers.length > 0 && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between px-1">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  Matching Customers
                </span>
                <button
                  type="button"
                  onClick={() => {
                    onNavigate('customers');
                    onClose();
                  }}
                  className="text-[11px] font-bold text-[#1f8a5b] dark:text-emerald-400 hover:underline cursor-pointer"
                >
                  View All Directory →
                </button>
              </div>

              <div className="space-y-1.5">
                {filteredCustomers.map((c, idx) => (
                  <div
                    key={`c_${idx}`}
                    onClick={() => {
                      onNavigate('customers');
                      onClose();
                    }}
                    className="p-2.5 rounded-2xl bg-white hover:bg-slate-50 dark:bg-zinc-850 dark:hover:bg-zinc-800 border border-slate-200/80 dark:border-zinc-750 flex items-center justify-between gap-2.5 transition cursor-pointer"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-8 h-8 rounded-xl bg-[#164e3f] text-white font-extrabold flex items-center justify-center text-xs shrink-0">
                        {c.name.charAt(0) || 'C'}
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-slate-900 dark:text-white truncate">
                          {c.name}
                        </div>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="text-[11px] font-mono text-slate-500 dark:text-zinc-400">
                            {c.phone || 'No phone'}
                          </span>
                          {c.phone && (
                            <button
                              type="button"
                              onClick={(e) => handleCopyPhone(c.phone, e)}
                              title="Copy phone"
                              className="p-1 rounded text-slate-400 hover:text-slate-800 dark:hover:text-zinc-200 hover:bg-slate-100 dark:hover:bg-zinc-700 transition cursor-pointer"
                            >
                              {copiedPhone === c.phone ? (
                                <span className="flex items-center gap-0.5 text-[9px] font-bold text-emerald-600">
                                  <Check className="w-3 h-3" />
                                  <span>Copied</span>
                                </span>
                              ) : (
                                <Copy className="w-3 h-3" />
                              )}
                            </button>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <div className="text-xs font-black text-slate-900 dark:text-white">
                        ৳{c.totalSpent.toLocaleString()}
                      </div>
                      <span className="text-[10px] text-slate-400 block">
                        {c.ordersCount} orders • {c.totalDue > 0 ? `Due: ৳${c.totalDue}` : 'Paid'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 3. Invoices Matches */}
          {(activeTab === 'all' || activeTab === 'invoices') && filteredInvoices.length > 0 && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between px-1">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  Matching Invoices / Memos
                </span>
                <button
                  type="button"
                  onClick={() => {
                    onNavigate('invoices');
                    onClose();
                  }}
                  className="text-[11px] font-bold text-[#1f8a5b] dark:text-emerald-400 hover:underline cursor-pointer"
                >
                  View Ledger →
                </button>
              </div>

              <div className="space-y-1.5">
                {filteredInvoices.map((inv) => (
                  <div
                    key={inv.id}
                    onClick={() => {
                      onNavigate('invoices');
                      onClose();
                    }}
                    className="p-2.5 rounded-2xl bg-white hover:bg-slate-50 dark:bg-zinc-850 dark:hover:bg-zinc-800 border border-slate-200/80 dark:border-zinc-750 flex items-center justify-between gap-2.5 transition cursor-pointer"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-300 flex items-center justify-center shrink-0">
                        <FileText className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5 truncate">
                          <span>#{inv.invoiceNo}</span>
                          <span className="text-[10px] font-medium text-slate-400 truncate">
                            {inv.customerName}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="text-[10px] text-slate-400 font-mono">
                            {new Date(inv.createdAt).toLocaleDateString()}
                          </span>
                          {inv.customerPhone && (
                            <>
                              <span className="text-slate-300">•</span>
                              <span className="text-[10px] font-mono text-slate-500">
                                {inv.customerPhone}
                              </span>
                              <button
                                type="button"
                                onClick={(e) => handleCopyPhone(inv.customerPhone, e)}
                                className="p-0.5 text-slate-400 hover:text-slate-700 cursor-pointer"
                                title="Copy phone"
                              >
                                {copiedPhone === inv.customerPhone ? (
                                  <Check className="w-2.5 h-2.5 text-emerald-600" />
                                ) : (
                                  <Copy className="w-2.5 h-2.5" />
                                )}
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <div className="text-xs font-black text-slate-900 dark:text-white">
                        ৳{inv.total}
                      </div>
                      <span className={`text-[10px] font-bold ${inv.dueAmount > 0 ? 'text-rose-600' : 'text-[#1f8a5b]'}`}>
                        {inv.dueAmount > 0 ? `Due: ৳${inv.dueAmount}` : 'Paid'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Empty State */}
          {filteredModules.length === 0 &&
            filteredCustomers.length === 0 &&
            filteredInvoices.length === 0 && (
              <div className="py-12 text-center text-slate-400 dark:text-zinc-500 text-xs space-y-1">
                <Search className="w-8 h-8 mx-auto opacity-30 text-slate-400 mb-2" />
                <p className="font-semibold text-slate-700 dark:text-zinc-300">
                  কোনো ফলাফল পাওয়া যায়নি (No results found)
                </p>
                <p className="text-[11px]">অন্য কোনো কি-ওয়ার্ড দিয়ে আবার চেষ্টা করুন</p>
              </div>
            )}
        </div>
      </div>
    </div>
  );
};
