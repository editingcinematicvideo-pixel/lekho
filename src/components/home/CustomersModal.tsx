import React, { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { dbService } from '../../services/db';
import { Invoice } from '../../types';
import {
  Users,
  Search,
  Phone,
  Calendar,
  X,
  ShoppingBag,
  ArrowRight,
  TrendingUp,
  Receipt,
  MessageSquare,
  Filter,
  DollarSign,
  AlertCircle,
  FileText,
  Copy,
  Check,
} from 'lucide-react';

interface CustomersModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectCustomerInvoices?: (customerPhone: string) => void;
}

interface CustomerSummary {
  name: string;
  phone: string;
  totalOrders: number;
  totalSpent: number;
  totalDue: number;
  lastOrderDate: string;
  latestInvoiceNo: string;
  partyType: 'Retail' | 'Reseller';
}

const CopyPhoneButton: React.FC<{ phone: string }> = ({ phone }) => {
  const [copied, setCopied] = useState(false);
  const { showToast } = useApp();

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!phone) return;
    navigator.clipboard.writeText(phone);
    setCopied(true);
    showToast(`ফোন নম্বর কপি করা হয়েছে: ${phone}`, 'success');
    setTimeout(() => setCopied(false), 2000);
  };

  if (!phone) return null;

  return (
    <button
      type="button"
      onClick={handleCopy}
      title="ফোন নম্বর কপি করুন (Copy phone)"
      className="p-1 rounded-md text-slate-400 hover:text-slate-800 dark:hover:text-zinc-100 hover:bg-slate-100 dark:hover:bg-zinc-800 transition cursor-pointer active:scale-95 inline-flex items-center gap-1"
    >
      {copied ? (
        <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
          <Check className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
          <span>Copied</span>
        </span>
      ) : (
        <Copy className="w-3 h-3" />
      )}
    </button>
  );
};

export const CustomersModal: React.FC<CustomersModalProps> = ({
  isOpen,
  onClose,
  onSelectCustomerInvoices,
}) => {
  const { currentTenant, showToast, pickText } = useApp();
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFilter, setDateFilter] = useState<'all' | 'today' | 'yesterday' | 'last7' | 'this_month' | 'custom'>('all');
  const [partyFilter, setPartyFilter] = useState<'all' | 'Retail' | 'Reseller'>('all');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');

  const rawInvoices = useMemo(() => {
    return dbService.getInvoices(currentTenant.id).filter((inv) => !inv.isSoftDeleted);
  }, [currentTenant.id]);

  // Filter invoices by selected date range
  const filteredInvoicesByDate = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
    const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0];
    const monthStart = today.slice(0, 7);

    return rawInvoices.filter((inv) => {
      const invDate = inv.createdAt.split('T')[0];

      if (dateFilter === 'today' && invDate !== today) return false;
      if (dateFilter === 'yesterday' && invDate !== yesterday) return false;
      if (dateFilter === 'last7' && invDate < sevenDaysAgo) return false;
      if (dateFilter === 'this_month' && !invDate.startsWith(monthStart)) return false;
      if (dateFilter === 'custom') {
        if (customStartDate && invDate < customStartDate) return false;
        if (customEndDate && invDate > customEndDate) return false;
      }

      if (partyFilter !== 'all' && (inv.partyType || 'Retail') !== partyFilter) return false;

      return true;
    });
  }, [rawInvoices, dateFilter, partyFilter, customStartDate, customEndDate]);

  // Aggregate customer summary based on filtered invoices
  const customerList = useMemo(() => {
    const map = new Map<string, CustomerSummary>();

    filteredInvoicesByDate.forEach((inv) => {
      const phone = (inv.customerPhone || '').trim();
      const name = (inv.customerName || 'Walk-in Customer').trim();
      const key = phone ? phone : name;

      if (!map.has(key)) {
        map.set(key, {
          name,
          phone,
          totalOrders: 0,
          totalSpent: 0,
          totalDue: 0,
          lastOrderDate: inv.createdAt,
          latestInvoiceNo: inv.invoiceNo,
          partyType: (inv.partyType as 'Retail' | 'Reseller') || 'Retail',
        });
      }

      const entry = map.get(key)!;
      entry.totalOrders += 1;
      entry.totalSpent += (inv.paidAmount ?? inv.advancePaid ?? (inv.total - (inv.dueAmount || 0)));
      entry.totalDue += (inv.dueAmount || 0);

      if (new Date(inv.createdAt) > new Date(entry.lastOrderDate)) {
        entry.lastOrderDate = inv.createdAt;
        entry.latestInvoiceNo = inv.invoiceNo;
      }
    });

    return Array.from(map.values()).sort((a, b) => b.totalSpent - a.totalSpent);
  }, [filteredInvoicesByDate]);

  // Apply search
  const filteredCustomers = useMemo(() => {
    if (!searchQuery.trim()) return customerList;
    const q = searchQuery.toLowerCase().trim();
    return customerList.filter(
      (c) => c.name.toLowerCase().includes(q) || c.phone.includes(q)
    );
  }, [customerList, searchQuery]);

  // KPI Metrics
  const totalRevenuePeriod = useMemo(
    () => customerList.reduce((sum, c) => sum + c.totalSpent, 0),
    [customerList]
  );
  const totalDuePeriod = useMemo(
    () => customerList.reduce((sum, c) => sum + c.totalDue, 0),
    [customerList]
  );
  const totalOrdersPeriod = useMemo(
    () => customerList.reduce((sum, c) => sum + c.totalOrders, 0),
    [customerList]
  );

  if (!isOpen) return null;

  const handleWhatsApp = (phone: string, name: string, due: number) => {
    const clean = phone.replace(/[^0-9]/g, '');
    if (!clean) {
      showToast('কাস্টমারের ফোন নম্বর প্রদান করা হয়নি', 'warning');
      return;
    }
    const full = clean.startsWith('88') ? clean : `88${clean}`;
    let text = `আসসালামু আলাইকুম ${name} ভাই, ${currentTenant.name}-এ কেনাকাটা করার জন্য ধন্যবাদ!`;
    if (due > 0) {
      text += `\nআপনার বর্তমান বকেয়া বাকি আছে: ৳${due.toLocaleString()}।`;
    }
    window.open(`https://wa.me/${full}?text=${encodeURIComponent(text)}`, '_blank');
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-in fade-in duration-150">
      <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-3xl max-w-3xl w-full p-4 sm:p-6 shadow-2xl text-slate-900 dark:text-zinc-100 relative my-6 space-y-4 max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-zinc-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center border border-emerald-500/20">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                {pickText('কাস্টমার তালিকা', 'Customer Directory')}
                <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 font-bold">
                  {customerList.length} জন
                </span>
              </h3>
              <p className="text-xs text-slate-500 dark:text-zinc-400">
                POS-এর মাধ্যমে সম্পন্ন হওয়া বিক্রির কাস্টমারদের ইতিহাস, মোট কেনাকাটা ও বকেয়া খাতা
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-zinc-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Quick KPI Highlights Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 shrink-0 text-xs">
          <div className="p-3 rounded-2xl bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800">
            <span className="text-[10px] text-slate-500 dark:text-zinc-400 block font-medium">কাস্টমার সংখ্যা</span>
            <strong className="text-sm sm:text-base font-black text-slate-900 dark:text-white">
              {customerList.length}
            </strong>
          </div>
          <div className="p-3 rounded-2xl bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800">
            <span className="text-[10px] text-slate-500 dark:text-zinc-400 block font-medium">মোট অর্ডার</span>
            <strong className="text-sm sm:text-base font-black text-slate-900 dark:text-white">
              {totalOrdersPeriod} টি
            </strong>
          </div>
          <div className="p-3 rounded-2xl bg-emerald-50/60 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800">
            <span className="text-[10px] text-emerald-700 dark:text-emerald-400 block font-medium">মোট বিক্রয়</span>
            <strong className="text-sm sm:text-base font-black text-emerald-700 dark:text-emerald-400 font-mono">
              ৳{totalRevenuePeriod.toLocaleString()}
            </strong>
          </div>
          <div className="p-3 rounded-2xl bg-amber-50/60 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
            <span className="text-[10px] text-amber-700 dark:text-amber-400 block font-medium">মোট বর্তমান বাকি</span>
            <strong className="text-sm sm:text-base font-black text-amber-700 dark:text-amber-400 font-mono">
              ৳{totalDuePeriod.toLocaleString()}
            </strong>
          </div>
        </div>

        {/* Date Filter & Party Filter Bar */}
        <div className="space-y-2.5 shrink-0">
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            <span className="text-[11px] font-bold text-slate-500 dark:text-zinc-400 flex items-center gap-1 mr-1">
              <Calendar className="w-3.5 h-3.5 text-emerald-600" />
              তারিখ নির্বাচন:
            </span>
            {[
              { id: 'all', label: 'সব সময়' },
              { id: 'today', label: 'আজকের কাস্টমার' },
              { id: 'yesterday', label: 'গতকাল' },
              { id: 'last7', label: 'বিগত ৭ দিন' },
              { id: 'this_month', label: 'চলতি মাস' },
              { id: 'custom', label: 'কাস্টম তারিখ' },
            ].map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setDateFilter(f.id as any)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer ${
                  dateFilter === f.id
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-300 hover:bg-slate-200'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* Custom Date Pickers */}
          {dateFilter === 'custom' && (
            <div className="flex items-center gap-2 p-2 rounded-xl bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 text-xs">
              <label className="text-[11px] text-slate-500">শুরু:</label>
              <input
                type="date"
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
                className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-lg px-2 py-1 text-xs"
              />
              <label className="text-[11px] text-slate-500 ml-2">শেষ:</label>
              <input
                type="date"
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
                className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-lg px-2 py-1 text-xs"
              />
            </div>
          )}

          {/* Search & Party Filter */}
          <div className="flex flex-col sm:flex-row gap-2 items-center">
            <div className="relative flex-1 w-full">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="কাস্টমারের নাম বা মোবাইল নম্বর দিয়ে খুঁজুন..."
                className="w-full bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl pl-9 pr-4 py-2 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div className="flex items-center gap-1.5 shrink-0 self-stretch sm:self-auto">
              <button
                type="button"
                onClick={() => setPartyFilter('all')}
                className={`flex-1 sm:flex-none px-3 py-2 rounded-xl text-xs font-semibold transition cursor-pointer ${
                  partyFilter === 'all'
                    ? 'bg-slate-900 text-white dark:bg-white dark:text-zinc-900'
                    : 'bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-300'
                }`}
              >
                সব কাস্টমার
              </button>
              <button
                type="button"
                onClick={() => setPartyFilter('Retail')}
                className={`flex-1 sm:flex-none px-3 py-2 rounded-xl text-xs font-semibold transition cursor-pointer ${
                  partyFilter === 'Retail'
                    ? 'bg-emerald-600 text-white'
                    : 'bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-300'
                }`}
              >
                রিটেইল
              </button>
              <button
                type="button"
                onClick={() => setPartyFilter('Reseller')}
                className={`flex-1 sm:flex-none px-3 py-2 rounded-xl text-xs font-semibold transition cursor-pointer ${
                  partyFilter === 'Reseller'
                    ? 'bg-emerald-600 text-white'
                    : 'bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-300'
                }`}
              >
                রিসেলার
              </button>
            </div>
          </div>
        </div>

        {/* Customer List Table / Cards */}
        <div className="flex-1 overflow-y-auto space-y-2 pr-1 min-h-[220px]">
          {filteredCustomers.length === 0 ? (
            <div className="py-16 text-center text-slate-400 dark:text-zinc-500 text-xs">
              <Users className="w-8 h-8 mx-auto mb-2 opacity-40 text-slate-400" />
              <span>নির্বাচিত ফিল্টারে কোনো কাস্টমার রেকর্ড পাওয়া যায়নি</span>
            </div>
          ) : (
            filteredCustomers.map((cust, idx) => (
              <div
                key={idx}
                className="p-3 sm:p-3.5 rounded-2xl bg-white dark:bg-zinc-950/70 border border-slate-200/90 dark:border-zinc-800/90 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:border-emerald-300 dark:hover:border-emerald-800/60 transition shadow-2xs"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-2xl bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400 font-extrabold flex items-center justify-center shrink-0 text-sm border border-emerald-200/60 dark:border-emerald-800/60">
                    {cust.name.charAt(0) || 'C'}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white truncate">
                        {cust.name}
                      </span>
                      <span
                        className={`text-[10px] font-semibold px-2 py-0.2 rounded-full ${
                          cust.partyType === 'Reseller'
                            ? 'bg-teal-50 text-teal-800 border border-teal-200 dark:bg-teal-950/40 dark:text-teal-300'
                            : 'bg-[#e6f4ea] text-[#164e3f] border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300'
                        }`}
                      >
                        {cust.partyType}
                      </span>
                    </div>
                    <div className="text-[11px] font-mono text-slate-500 dark:text-zinc-400 flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-0.5">
                      <span className="flex items-center gap-1">
                        <Phone className="w-3 h-3 text-slate-400" />
                        <span>{cust.phone || 'ফোন নেই'}</span>
                        {cust.phone && <CopyPhoneButton phone={cust.phone} />}
                      </span>
                      <span>•</span>
                      <span>{cust.totalOrders} টি কেনাকাটা</span>
                      <span>•</span>
                      <span>সর্বশেষ: {cust.lastOrderDate.split('T')[0]}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100 dark:border-zinc-850">
                  <div className="text-left sm:text-right">
                    <span className="text-[10px] text-slate-400 block">মোট কেনাকাটা:</span>
                    <div className="text-xs sm:text-sm font-mono font-black text-emerald-600 dark:text-emerald-400">
                      ৳{cust.totalSpent.toLocaleString()}
                    </div>
                    {cust.totalDue > 0 ? (
                      <div className="text-[10px] font-mono font-bold text-rose-600 dark:text-rose-400">
                        বাকি: ৳{cust.totalDue.toLocaleString()}
                      </div>
                    ) : (
                      <div className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold">
                        ✓ কোনো বাকি নেই
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5">
                    {cust.phone && (
                      <button
                        onClick={() => handleWhatsApp(cust.phone, cust.name, cust.totalDue)}
                        className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 border border-emerald-200 dark:border-emerald-800 transition cursor-pointer"
                        title="WhatsApp বার্তা পাঠান"
                      >
                        <MessageSquare className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
