import React, { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { dbService } from '../../services/db';
import { Invoice, DrawerType } from '../../types';
import { BottomSheet } from '../ui/BottomSheet';
import {
  FileText,
  Search,
  MessageSquare,
  Calendar,
  CheckCircle,
  User,
  Printer,
  X,
  CreditCard,
  RefreshCw,
  ChevronRight,
} from 'lucide-react';

interface DueListViewProps {
  onNavigateToPOS?: () => void;
}

export const DueListView: React.FC<DueListViewProps> = ({ onNavigateToPOS }) => {
  const { currentTenant, activeStaff, showToast, pickText } = useApp();
  const [invoices, setInvoices] = useState<Invoice[]>(() => dbService.getInvoices(currentTenant.id));
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFilter, setDateFilter] = useState<'all' | 'today' | 'last7' | 'this_month'>('all');
  const [partyFilter, setPartyFilter] = useState<'all' | 'Retail' | 'Reseller'>('all');
  const [minDueFilter, setMinDueFilter] = useState<number>(0);

  // Pay Due Modal State
  const [selectedInvoiceForPayment, setSelectedInvoiceForPayment] = useState<Invoice | null>(null);
  const [detailDueInvoice, setDetailDueInvoice] = useState<Invoice | null>(null);
  const [payType, setPayType] = useState<'full' | 'partial'>('full');
  const [customPayAmount, setCustomPayAmount] = useState<number>(0);
  const [selectedDrawer, setSelectedDrawer] = useState<DrawerType>('cash');
  const [lastPaymentReceipt, setLastPaymentReceipt] = useState<{
    invoice: Invoice;
    paidAmount: number;
    remainingDue: number;
    drawer: DrawerType;
  } | null>(null);

  const reloadData = () => {
    setInvoices(dbService.getInvoices(currentTenant.id));
  };

  // Filter only due invoices
  const dueInvoices = useMemo(() => {
    return invoices.filter((inv) => (inv.dueAmount || 0) > 0 && !inv.isSoftDeleted);
  }, [invoices]);

  // Apply search & filters
  const filteredDueInvoices = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0];
    const monthStart = today.slice(0, 7);

    return dueInvoices.filter((inv) => {
      // Search
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        inv.customerName.toLowerCase().includes(q) ||
        inv.customerPhone.includes(q) ||
        inv.invoiceNo.toLowerCase().includes(q);

      if (!matchesSearch) return false;

      // Party Filter
      if (partyFilter !== 'all' && inv.partyType !== partyFilter) return false;

      // Min Due Filter
      if (minDueFilter > 0 && (inv.dueAmount || 0) < minDueFilter) return false;

      // Date Filter
      const invDate = inv.createdAt.split('T')[0];
      if (dateFilter === 'today' && invDate !== today) return false;
      if (dateFilter === 'last7' && invDate < sevenDaysAgo) return false;
      if (dateFilter === 'this_month' && !invDate.startsWith(monthStart)) return false;

      return true;
    });
  }, [dueInvoices, searchQuery, dateFilter, partyFilter, minDueFilter]);

  // Aggregate Metrics
  const totalPendingDue = dueInvoices.reduce((sum, inv) => sum + (inv.dueAmount || 0), 0);
  const totalDueCustomers = dueInvoices.length;
  const highestDue = dueInvoices.reduce((max, inv) => Math.max(max, inv.dueAmount || 0), 0);

  // Today's recovered dues
  const drawerTxs = dbService.getDrawerTransactions(currentTenant.id);
  const todayStr = new Date().toISOString().split('T')[0];
  const todayRecoveredDues = drawerTxs
    .filter((tx) => tx.type === 'due_recovery' && tx.timestamp.startsWith(todayStr))
    .reduce((sum, tx) => sum + tx.amount, 0);

  // Open Payment Modal
  const handleOpenPaymentModal = (invoice: Invoice) => {
    setSelectedInvoiceForPayment(invoice);
    setPayType('full');
    setCustomPayAmount(invoice.dueAmount || 0);
    setSelectedDrawer('cash');
    setLastPaymentReceipt(null);
  };

  // Execute Due Payment
  const handleConfirmDuePayment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedInvoiceForPayment) return;

    const previousDue = selectedInvoiceForPayment.dueAmount || 0;
    const amountToPay = payType === 'full' ? previousDue : Number(customPayAmount);

    if (amountToPay <= 0) {
      showToast(
        pickText(
          'পরিশোধের পরিমাণ ০ টাকার বেশি হতে হবে',
          'Payment amount must be greater than ৳0'
        ),
        'warning'
      );
      return;
    }

    if (amountToPay > previousDue) {
      showToast(
        pickText(
          'বকেয়া টাকার চেয়ে বেশি পেমেন্ট দেওয়া যাবে না',
          'Payment cannot exceed the due amount'
        ),
        'warning'
      );
      return;
    }

    const res = dbService.payInvoiceDue(
      currentTenant.id,
      selectedInvoiceForPayment.id,
      amountToPay,
      selectedDrawer,
      activeStaff?.name || currentTenant.ownerName
    );

    if (res.success && res.invoice) {
      showToast(
        res.message ||
          pickText('বকেয়া সফলভাবে জমা নেওয়া হয়েছে!', 'Due payment received successfully!'),
        'success'
      );
      reloadData();
      setLastPaymentReceipt({
        invoice: res.invoice,
        paidAmount: amountToPay,
        remainingDue: res.invoice.dueAmount || 0,
        drawer: selectedDrawer,
      });
    } else {
      showToast(
        res.message ||
          pickText('বকেয়া পরিশোধে সমস্যা হয়েছে', 'Failed to process due payment'),
        'error'
      );
    }
  };

  // WhatsApp Due Reminder
  const handleSendDueReminderWhatsApp = (inv: Invoice) => {
    const text = `আসসালামু আলাইকুম ${inv.customerName} ভাই,
${currentTenant.name} থেকে স্মরণ করিয়ে দেওয়া হচ্ছে:

আপনার ইনভয়েস নং: *${inv.invoiceNo}*
মোট বিল ছিল: ৳${inv.total.toLocaleString()}
পূর্বে জমা: ৳${(inv.advancePaid || 0).toLocaleString()}
*বর্তমান বকেয়া বাকি: ৳${(inv.dueAmount || 0).toLocaleString()}*

অনুরোধ রইল সুবিধাজনক সময়ে বকেয়া টাকা পরিশোধ করার জন্য।
বিকাশ/নগদ পেমেন্ট করতে কল/হোয়াটসঅ্যাপ করুন: ${currentTenant.ownerPhone}
ধন্যবাদ!
-${currentTenant.name}`;

    const cleanPhone = inv.customerPhone.replace(/\D/g, '');
    const intlPhone = cleanPhone.startsWith('88') ? cleanPhone : `88${cleanPhone}`;
    const link = document.createElement('a');
    link.href = `https://wa.me/${intlPhone}?text=${encodeURIComponent(text)}`;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.click();
  };

  // WhatsApp Due Cleared Confirmation Memo
  const handleSendPaymentConfirmationWhatsApp = (
    inv: Invoice,
    paidAmount: number,
    remainingDue: number,
    drawer: DrawerType
  ) => {
    const drawerLabel =
      drawer === 'cash'
        ? 'ক্যাশ (Cash)'
        : drawer === 'personalBkash'
        ? 'পার্সোনাল বিকাশ'
        : drawer === 'merchantBkash'
        ? 'মার্চেন্ট বিকাশ'
        : drawer === 'nagad'
        ? 'নগদ'
        : 'ব্যাংক';

    const text = `🧾 *【${currentTenant.name} - বকেয়া পরিশোধ মেমো】*
তারিখ: ${new Date().toLocaleDateString('en-GB')}
-----------------------------------------
গ্রাহক: *${inv.customerName}*
মোবাইল: ${inv.customerPhone}
মেমো নং: *${inv.invoiceNo}*

মোট কেনাকাটা: ৳${inv.total.toLocaleString()}
আজকে জমা নেওয়া হয়েছে: *৳${paidAmount.toLocaleString()}*
পেমেন্ট মেথড: ${drawerLabel}
*অবশিষ্ট বর্তমান বকেয়া: ৳${remainingDue.toLocaleString()}*
-----------------------------------------
${remainingDue === 0 ? '✅ আপনার সকল বকেয়া পরিশোধ সম্পন্ন হয়েছে! ধন্যবাদ।' : 'ধন্যবাদ! অবশিষ্ট বকেয়া দ্রুত পরিশোধের অনুরোধ রইল।'}

যেকোনো প্রয়োজনে যোগাযোগ:
হটলাইন: ${currentTenant.paymentSettings?.bkashMerchant || currentTenant.ownerPhone}
দোকান: ${currentTenant.marketMallName}`;

    const cleanPhone = inv.customerPhone.replace(/\D/g, '');
    const intlPhone = cleanPhone.startsWith('88') ? cleanPhone : `88${cleanPhone}`;
    const link = document.createElement('a');
    link.href = `https://wa.me/${intlPhone}?text=${encodeURIComponent(text)}`;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.click();
  };

  return (
    <div className="space-y-5 animate-in fade-in duration-150 pb-16">
      {/* Header & KPI Summary */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-slate-200 dark:border-zinc-800">
        <h2 className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-white tracking-tight">
          {pickText('বকেয়া তালিকা', 'Due List')}
        </h2>

        <div className="flex items-center gap-2">
          <button
            onClick={reloadData}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-750 text-xs font-semibold text-slate-700 dark:text-zinc-300 transition cursor-pointer"
            title={pickText('রিফ্রেশ করুন', 'Refresh')}
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>{pickText('রিফ্রেশ', 'Refresh')}</span>
          </button>

          {onNavigateToPOS && (
            <button
              onClick={onNavigateToPOS}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition cursor-pointer shadow-xs"
            >
              <span>{pickText('+ নতুন POS সেল', '+ New POS Sale')}</span>
            </button>
          )}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3.5">
        <div className="p-3.5 rounded-2xl bg-white dark:bg-zinc-900 border border-amber-200 dark:border-amber-900/60 shadow-2xs">
          <span className="text-[11px] font-semibold text-amber-700 dark:text-amber-400 block">
            {pickText('মোট বকেয়া পাওনা', 'Total Pending Due')}
          </span>
          <div className="text-lg sm:text-xl font-black text-amber-600 dark:text-amber-400 font-mono mt-0.5">
            ৳{totalPendingDue.toLocaleString()}
          </div>
        </div>

        <div className="p-3.5 rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 shadow-2xs">
          <span className="text-[11px] font-semibold text-slate-500 dark:text-zinc-400 block">
            {pickText('বাকি থাকা কাস্টমার', 'Due Customers')}
          </span>
          <div className="text-lg sm:text-xl font-black text-slate-900 dark:text-white font-mono mt-0.5">
            {totalDueCustomers}
          </div>
        </div>

        <div className="p-3.5 rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 shadow-2xs">
          <span className="text-[11px] font-semibold text-rose-600 dark:text-rose-400 block">
            {pickText('সর্বোচ্চ একক বকেয়া', 'Highest Single Due')}
          </span>
          <div className="text-lg sm:text-xl font-black text-rose-600 dark:text-rose-400 font-mono mt-0.5">
            ৳{highestDue.toLocaleString()}
          </div>
        </div>

        <div className="p-3.5 rounded-2xl bg-white dark:bg-zinc-900 border border-emerald-200 dark:border-emerald-900/60 shadow-2xs">
          <span className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 block">
            {pickText('আজকের বকেয়া আদায়', "Today's Due Recovery")}
          </span>
          <div className="text-lg sm:text-xl font-black text-emerald-600 dark:text-emerald-400 font-mono mt-0.5">
            ৳{todayRecoveredDues.toLocaleString()}
          </div>
        </div>
      </div>

      {/* Search & Filters */}
      <div className="p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 space-y-3 shadow-xs">
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-center">
          {/* Search Box */}
          <div className="sm:col-span-5 relative">
            <Search className="w-4 h-4 text-slate-400 dark:text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={pickText(
                'কাস্টমারের নাম, ফোন নম্বর বা ইনভয়েস নং...',
                'Search customer name, phone or invoice no...'
              )}
              className="w-full bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-zinc-500 focus:outline-none focus:border-amber-500"
            />
          </div>

          {/* Date Filter */}
          <div className="sm:col-span-3">
            <select
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value as any)}
              className="w-full bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl px-3 py-2 text-xs font-medium text-slate-800 dark:text-zinc-200 focus:outline-none"
            >
              <option value="all">{pickText('সকল তারিখ', 'All Time')}</option>
              <option value="today">{pickText('আজকের ইনভয়েস', 'Today')}</option>
              <option value="last7">{pickText('গত ৭ দিন', 'Last 7 Days')}</option>
              <option value="this_month">{pickText('এই মাস', 'This Month')}</option>
            </select>
          </div>

          {/* Party Type Filter */}
          <div className="sm:col-span-2">
            <select
              value={partyFilter}
              onChange={(e) => setPartyFilter(e.target.value as any)}
              className="w-full bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl px-3 py-2 text-xs font-medium text-slate-800 dark:text-zinc-200 focus:outline-none"
            >
              <option value="all">{pickText('সকল গ্রাহক', 'All Customers')}</option>
              <option value="Retail">{pickText('রিটেইল', 'Retail')}</option>
              <option value="Reseller">{pickText('রিসেলার', 'Reseller')}</option>
            </select>
          </div>

          {/* Minimum Due Filter */}
          <div className="sm:col-span-2">
            <select
              value={minDueFilter}
              onChange={(e) => setMinDueFilter(Number(e.target.value))}
              className="w-full bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl px-3 py-2 text-xs font-medium text-slate-800 dark:text-zinc-200 focus:outline-none"
            >
              <option value={0}>{pickText('সকল বকেয়া', 'All Dues')}</option>
              <option value={500}>{pickText('৳৫০০+ বাকি', '৳500+ Due')}</option>
              <option value={1000}>{pickText('৳১,০০০+ বাকি', '৳1,000+ Due')}</option>
              <option value={2000}>{pickText('৳২,০০০+ বাকি', '৳2,000+ Due')}</option>
            </select>
          </div>
        </div>

        {/* Results summary pill */}
        <div className="flex items-center justify-between text-xs text-slate-500 dark:text-zinc-400 pt-1 border-t border-slate-100 dark:border-zinc-800">
          <div>
            {pickText('দেখাচ্ছে:', 'Showing:')} <strong>{filteredDueInvoices.length}</strong>{' '}
            {pickText('টি বাকি ইনভয়েস (ফিল্টার অনুযায়ী বকেয়া:', 'due invoices (Filtered Due:')} ৳
            {filteredDueInvoices.reduce((s, i) => s + (i.dueAmount || 0), 0).toLocaleString()})
          </div>
          {(searchQuery || dateFilter !== 'all' || partyFilter !== 'all' || minDueFilter > 0) && (
            <button
              onClick={() => {
                setSearchQuery('');
                setDateFilter('all');
                setPartyFilter('all');
                setMinDueFilter(0);
              }}
              className="text-amber-600 dark:text-amber-400 underline font-semibold cursor-pointer"
            >
              {pickText('ফিল্টার ক্লিয়ার করুন', 'Clear Filters')}
            </button>
          )}
        </div>
      </div>

      {/* Due Customer List (Compact Mobile Cards + Desktop Table) */}
      <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl overflow-hidden shadow-2xs">
        {filteredDueInvoices.length === 0 ? (
          <div className="p-10 text-center space-y-2">
            <div className="w-10 h-10 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 mx-auto flex items-center justify-center">
              <CheckCircle className="w-5 h-5" />
            </div>
            <div className="font-bold text-xs text-slate-800 dark:text-white">
              {pickText('কোনো বকেয়া পাওয়া যায়নি!', 'No due invoices found!')}
            </div>
          </div>
        ) : (
          <>
            {/* Mobile Compact Summary List (< 768px) */}
            <div className="md:hidden divide-y divide-slate-100 dark:divide-zinc-800">
              {filteredDueInvoices.map((inv) => (
                <div
                  key={inv.id}
                  className="px-3.5 py-3 flex items-center justify-between gap-2.5 hover:bg-slate-50/70 dark:hover:bg-zinc-800/40 transition"
                >
                  <button
                    type="button"
                    onClick={() => setDetailDueInvoice(inv)}
                    className="min-w-0 flex-1 flex items-center justify-between gap-2 text-left cursor-pointer"
                  >
                    <div className="min-w-0">
                      <div className="font-bold text-xs text-slate-900 dark:text-white truncate">
                        {inv.customerName}
                      </div>
                      <div className="text-[11px] text-slate-400 dark:text-zinc-500 font-mono mt-0.5 flex items-center gap-1.5">
                        <span>{inv.invoiceNo}</span>
                        <span>•</span>
                        <span>{new Date(inv.createdAt).toLocaleDateString('en-GB')}</span>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="font-mono font-black text-xs text-amber-600 dark:text-amber-400">
                        ৳{(inv.dueAmount || 0).toLocaleString()}
                      </div>
                      <div className="text-[10px] text-slate-400 font-mono">
                        {pickText('মোট বিল', 'Bill')} ৳{inv.total.toLocaleString()}
                      </div>
                    </div>
                  </button>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleOpenPaymentModal(inv)}
                      className="px-2.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-[11px] transition cursor-pointer"
                    >
                      {pickText('জমা নিন', 'Pay')}
                    </button>
                    <button
                      type="button"
                      onClick={() => setDetailDueInvoice(inv)}
                      aria-label={`View due details for ${inv.invoiceNo}`}
                      className="p-1 text-slate-400 hover:text-slate-600 cursor-pointer"
                    >
                      <ChevronRight className="w-4 h-4 shrink-0" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop Table (>= 768px) */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-zinc-950 text-slate-500 dark:text-zinc-400 border-b border-slate-200 dark:border-zinc-800 font-semibold select-none">
                  <tr>
                    <th className="py-3 px-4">{pickText('মেমো নং ও তারিখ', 'Memo No & Date')}</th>
                    <th className="py-3 px-4">{pickText('গ্রাহকের নাম ও ফোন', 'Customer & Phone')}</th>
                    <th className="py-3 px-4">{pickText('পণ্য সামগ্রী', 'Items')}</th>
                    <th className="py-3 px-4 text-right">{pickText('মোট বিল', 'Total Bill')}</th>
                    <th className="py-3 px-4 text-right">{pickText('পূর্বে জমা', 'Advance Paid')}</th>
                    <th className="py-3 px-4 text-right text-amber-600 dark:text-amber-400">
                      {pickText('বকেয়া বাকি', 'Due Balance')}
                    </th>
                    <th className="py-3 px-4 text-center">{pickText('অ্যাকশন', 'Actions')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
                  {filteredDueInvoices.map((inv) => (
                    <tr
                      key={inv.id}
                      onClick={() => setDetailDueInvoice(inv)}
                      className="hover:bg-slate-50/70 dark:hover:bg-zinc-850/50 transition cursor-pointer"
                    >
                      <td className="py-3.5 px-4 font-mono">
                        <div className="font-bold text-slate-900 dark:text-white">
                          {inv.invoiceNo}
                        </div>
                        <div className="text-[10px] text-slate-400 dark:text-zinc-500 flex items-center gap-1 mt-0.5">
                          <Calendar className="w-3 h-3" />
                          <span>{new Date(inv.createdAt).toLocaleDateString('en-GB')}</span>
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                          <User className="w-3.5 h-3.5 text-slate-400" />
                          <span>{inv.customerName}</span>
                          {inv.partyType === 'Reseller' && (
                            <span className="text-[9px] px-1 py-0.2 rounded bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300 font-semibold">
                              {pickText('রিসেলার', 'Reseller')}
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-zinc-400 font-mono mt-0.5">
                          {inv.customerPhone}
                        </div>
                      </td>

                      <td className="py-3.5 px-4 max-w-xs">
                        <div className="truncate text-slate-700 dark:text-zinc-300">
                          {inv.items.map((it) => it.title).join(', ')}
                        </div>
                        <div className="text-[10px] text-slate-400 dark:text-zinc-500">
                          {pickText('মোট', 'Total')}{' '}
                          {inv.items.reduce((s, i) => s + (i.quantity || 1), 0)}{' '}
                          {pickText('পিস', 'pcs')}
                        </div>
                      </td>

                      <td className="py-3.5 px-4 text-right font-mono font-bold text-slate-800 dark:text-zinc-200">
                        ৳{inv.total.toLocaleString()}
                      </td>

                      <td className="py-3.5 px-4 text-right font-mono text-emerald-600 dark:text-emerald-400 font-medium">
                        ৳{(inv.advancePaid || 0).toLocaleString()}
                      </td>

                      <td className="py-3.5 px-4 text-right font-mono font-black text-amber-600 dark:text-amber-400 text-sm">
                        ৳{(inv.dueAmount || 0).toLocaleString()}
                      </td>

                      <td className="py-3.5 px-4" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => handleOpenPaymentModal(inv)}
                            className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs transition cursor-pointer shadow-2xs"
                            title={pickText('বকেয়া টাকা জমা নিন', 'Collect due payment')}
                          >
                            <CreditCard className="w-3.5 h-3.5" />
                            <span>{pickText('বকেয়া নিন', 'Pay Due')}</span>
                          </button>

                          <button
                            onClick={() => handleSendDueReminderWhatsApp(inv)}
                            className="p-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/60 dark:hover:bg-emerald-900 text-emerald-700 dark:text-emerald-300 transition cursor-pointer"
                            title={pickText(
                              'WhatsApp-এ বকেয়া তাগাদা পাঠান',
                              'Send due reminder via WhatsApp'
                            )}
                          >
                            <MessageSquare className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {/* Compact Bottom Sheet for Due Details */}
      <BottomSheet
        isOpen={Boolean(detailDueInvoice)}
        onClose={() => setDetailDueInvoice(null)}
        title={detailDueInvoice ? `${detailDueInvoice.customerName}` : pickText('বকেয়ার বিবরণ', 'Due Details')}
        subtitle={
          detailDueInvoice
            ? `${pickText('মেমো', 'Memo')} #${detailDueInvoice.invoiceNo} • ${new Date(detailDueInvoice.createdAt).toLocaleDateString('en-GB')}`
            : undefined
        }
        footer={
          detailDueInvoice ? (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  const inv = detailDueInvoice;
                  setDetailDueInvoice(null);
                  handleOpenPaymentModal(inv);
                }}
                className="flex-1 py-2 px-3 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <CreditCard className="w-3.5 h-3.5" />
                <span>
                  {pickText('বকেয়া নিন', 'Pay Due')} (৳{(detailDueInvoice.dueAmount || 0).toLocaleString()})
                </span>
              </button>
              <button
                type="button"
                onClick={() => handleSendDueReminderWhatsApp(detailDueInvoice)}
                className="py-2 px-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 font-bold text-xs flex items-center gap-1.5 cursor-pointer"
              >
                <MessageSquare className="w-3.5 h-3.5" />
                <span>WhatsApp</span>
              </button>
            </div>
          ) : undefined
        }
      >
        {detailDueInvoice && (
          <div className="space-y-3">
            <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 dark:bg-zinc-800/60">
              <div>
                <div className="text-[10px] text-slate-400">
                  {pickText('কাস্টমার ফোন', 'Customer Phone')}
                </div>
                <div className="font-mono font-bold text-slate-900 dark:text-white">
                  {detailDueInvoice.customerPhone || 'N/A'}
                </div>
              </div>
              <div className="text-right">
                <div className="text-[10px] text-slate-400">
                  {pickText('কাস্টমারের ধরন', 'Customer Type')}
                </div>
                <div className="font-bold text-slate-900 dark:text-white">
                  {detailDueInvoice.partyType || 'Retail'}
                </div>
              </div>
            </div>

            <div>
              <div className="text-[11px] font-bold text-slate-500 dark:text-zinc-400 mb-1">
                {pickText('ক্রয়কৃত পণ্য', 'Items Purchased')} ({detailDueInvoice.items.length})
              </div>
              <div className="divide-y divide-slate-100 dark:divide-zinc-800 border border-slate-100 dark:border-zinc-800 rounded-xl overflow-hidden">
                {detailDueInvoice.items.map((it, idx) => (
                  <div key={idx} className="px-3 py-1.5 flex items-center justify-between gap-2">
                    <span className="truncate font-medium text-slate-800 dark:text-zinc-200">
                      {it.title} × {it.quantity}
                    </span>
                    <span className="font-mono font-bold text-slate-900 dark:text-white shrink-0">
                      ৳{it.subtotal.toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-1 pt-1 border-t border-slate-100 dark:border-zinc-800">
              <div className="flex justify-between">
                <span className="text-slate-500">{pickText('মোট বিল', 'Total Bill')}</span>
                <span className="font-mono font-bold">৳{detailDueInvoice.total.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">{pickText('পূর্বে জমা', 'Advance Paid')}</span>
                <span className="font-mono font-bold text-emerald-600">
                  ৳{(detailDueInvoice.advancePaid || 0).toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between text-amber-600 dark:text-amber-400 font-black pt-0.5">
                <span>{pickText('বকেয়া বাকি', 'Remaining Due')}</span>
                <span className="font-mono">৳{(detailDueInvoice.dueAmount || 0).toLocaleString()}</span>
              </div>
            </div>
          </div>
        )}
      </BottomSheet>

      {/* ========================================================================= */}
      {/* PAY DUE MODAL (FULL / PARTIAL DUE PAYMENT)                                */}
      {/* ========================================================================= */}
      {selectedInvoiceForPayment && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-150">
          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-3xl max-w-md w-full p-6 text-slate-900 dark:text-zinc-100 shadow-2xl relative my-6 space-y-4">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-zinc-800">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-amber-500/10 text-amber-600">
                  <CreditCard className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-slate-900 dark:text-white">
                    {pickText('বকেয়া পরিশোধ ও ক্যাশ গ্রহণ', 'Collect Due Payment')}
                  </h3>
                  <p className="text-[11px] text-slate-400 dark:text-zinc-500 font-mono">
                    {pickText('মেমো:', 'Memo:')} {selectedInvoiceForPayment.invoiceNo}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedInvoiceForPayment(null)}
                className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Customer & Invoice Summary Card */}
            <div className="p-3 rounded-2xl bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 text-xs space-y-1.5">
              <div className="flex justify-between">
                <span className="text-slate-500 dark:text-zinc-400">
                  {pickText('গ্রাহকের নাম:', 'Customer Name:')}
                </span>
                <strong className="text-slate-900 dark:text-white">
                  {selectedInvoiceForPayment.customerName}
                </strong>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 dark:text-zinc-400">
                  {pickText('মোবাইল নম্বর:', 'Phone Number:')}
                </span>
                <span className="font-mono">{selectedInvoiceForPayment.customerPhone}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 dark:text-zinc-400">
                  {pickText('মোট অর্ডার বিল:', 'Total Order Bill:')}
                </span>
                <span className="font-mono">৳{selectedInvoiceForPayment.total.toLocaleString()}</span>
              </div>
              <div className="flex justify-between font-bold text-amber-600 dark:text-amber-400 border-t border-slate-200 dark:border-zinc-800 pt-1">
                <span>{pickText('বর্তমান বকেয়া:', 'Current Due:')}</span>
                <span className="font-mono text-sm">
                  ৳{(selectedInvoiceForPayment.dueAmount || 0).toLocaleString()}
                </span>
              </div>
            </div>

            {/* If Last Payment Just Done: Show WhatsApp Memo Action */}
            {lastPaymentReceipt ? (
              <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 text-center space-y-3">
                <div className="w-10 h-10 rounded-full bg-emerald-600 text-white flex items-center justify-center mx-auto">
                  <CheckCircle className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-bold text-sm text-emerald-900 dark:text-emerald-200">
                    {pickText(
                      `৳${lastPaymentReceipt.paidAmount.toLocaleString()} সফলভাবে জমা নেওয়া হয়েছে!`,
                      `৳${lastPaymentReceipt.paidAmount.toLocaleString()} received successfully!`
                    )}
                  </h4>
                  <p className="text-xs text-emerald-700 dark:text-emerald-400 mt-0.5">
                    {pickText('অবশিষ্ট বকেয়া বাকি:', 'Remaining Due:')} ৳
                    {lastPaymentReceipt.remainingDue.toLocaleString()}
                  </p>
                </div>

                <div className="pt-2 flex flex-col gap-2">
                  <button
                    onClick={() =>
                      handleSendPaymentConfirmationWhatsApp(
                        lastPaymentReceipt.invoice,
                        lastPaymentReceipt.paidAmount,
                        lastPaymentReceipt.remainingDue,
                        lastPaymentReceipt.drawer
                      )
                    }
                    className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition cursor-pointer shadow-sm"
                  >
                    <MessageSquare className="w-4 h-4" />
                    <span>
                      {pickText('WhatsApp-এ পরিশোধ মেমো পাঠান', 'Send Payment Memo via WhatsApp')}
                    </span>
                  </button>

                  <button
                    onClick={() => setSelectedInvoiceForPayment(null)}
                    className="w-full py-2 rounded-xl bg-slate-200 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 font-semibold text-xs cursor-pointer"
                  >
                    {pickText('বন্ধ করুন', 'Close')}
                  </button>
                </div>
              </div>
            ) : (
              /* Payment Form */
              <form onSubmit={handleConfirmDuePayment} className="space-y-4">
                {/* Pay Type: Full vs Partial */}
                <div className="space-y-1.5">
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-zinc-300">
                    {pickText('পরিশোধের ধরণ নির্বাচন করুন:', 'Select Payment Type:')}
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setPayType('full');
                        setCustomPayAmount(selectedInvoiceForPayment.dueAmount || 0);
                      }}
                      className={`py-2 px-3 rounded-xl border text-xs font-bold transition cursor-pointer flex items-center justify-center gap-1.5 ${
                        payType === 'full'
                          ? 'bg-amber-500 border-amber-600 text-white shadow-xs'
                          : 'bg-slate-50 dark:bg-zinc-800 border-slate-200 dark:border-zinc-700 text-slate-700 dark:text-zinc-300'
                      }`}
                    >
                      <CheckCircle className="w-3.5 h-3.5" />
                      <span>
                        {pickText('সম্পূর্ণ পরিশোধ', 'Full Payment')} (৳{selectedInvoiceForPayment.dueAmount})
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setPayType('partial');
                        setCustomPayAmount(
                          Math.round((selectedInvoiceForPayment.dueAmount || 0) / 2)
                        );
                      }}
                      className={`py-2 px-3 rounded-xl border text-xs font-bold transition cursor-pointer flex items-center justify-center gap-1.5 ${
                        payType === 'partial'
                          ? 'bg-amber-500 border-amber-600 text-white shadow-xs'
                          : 'bg-slate-50 dark:bg-zinc-800 border-slate-200 dark:border-zinc-700 text-slate-700 dark:text-zinc-300'
                      }`}
                    >
                      <span>{pickText('আংশিক পরিশোধ', 'Partial Payment')}</span>
                    </button>
                  </div>
                </div>

                {/* Amount Input if Partial */}
                {payType === 'partial' && (
                  <div className="space-y-1">
                    <label className="block text-[11px] font-bold text-slate-700 dark:text-zinc-300">
                      {pickText('আজকে কত টাকা পরিশোধ করছে? (৳) *', 'Amount Paying Today (৳) *')}
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={selectedInvoiceForPayment.dueAmount}
                      value={customPayAmount || ''}
                      onChange={(e) => setCustomPayAmount(Number(e.target.value))}
                      placeholder={pickText('টাকার পরিমাণ লিখুন', 'Enter amount')}
                      className="w-full bg-slate-50 dark:bg-zinc-950 border border-amber-500 rounded-xl px-3 py-2 text-sm font-mono font-bold text-slate-900 dark:text-white focus:outline-none"
                      required
                    />
                    <div className="text-[11px] text-slate-400 dark:text-zinc-500 flex justify-between">
                      <span>{pickText('পরিশোধের পর বাকি থাকবে:', 'Remaining after payment:')}</span>
                      <strong className="text-amber-600 font-mono">
                        ৳
                        {Math.max(
                          0,
                          (selectedInvoiceForPayment.dueAmount || 0) - (customPayAmount || 0)
                        ).toLocaleString()}
                      </strong>
                    </div>
                  </div>
                )}

                {/* Drawer Selector */}
                <div className="space-y-1.5">
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-zinc-300">
                    {pickText('কোন ড্রয়ারে টাকা জমা হচ্ছে?', 'Select Receiving Drawer:')}
                  </label>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    {[
                      { id: 'cash', label: pickText('ক্যাশ (নগদ)', 'Physical Cash') },
                      { id: 'personalBkash', label: pickText('বিকাশ পার্সোনাল', 'bKash Personal') },
                      { id: 'merchantBkash', label: pickText('বিকাশ মার্চেন্ট', 'bKash Merchant') },
                      { id: 'nagad', label: pickText('নগদ', 'Nagad') },
                    ].map((d) => (
                      <button
                        key={d.id}
                        type="button"
                        onClick={() => setSelectedDrawer(d.id as DrawerType)}
                        className={`py-2 px-2.5 rounded-xl border text-left font-medium transition cursor-pointer flex items-center justify-between ${
                          selectedDrawer === d.id
                            ? 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-500 text-emerald-800 dark:text-emerald-300 font-bold'
                            : 'bg-slate-50 dark:bg-zinc-800 border-slate-200 dark:border-zinc-700 text-slate-700 dark:text-zinc-300'
                        }`}
                      >
                        <span className="truncate">{d.label}</span>
                        {selectedDrawer === d.id && (
                          <span className="w-2 h-2 rounded-full bg-emerald-500" />
                        )}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="pt-2 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedInvoiceForPayment(null)}
                    className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-zinc-700 text-xs font-semibold text-slate-600 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-800 cursor-pointer"
                  >
                    {pickText('বাতিল', 'Cancel')}
                  </button>

                  <button
                    type="submit"
                    className="flex-2 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs transition cursor-pointer shadow-md flex items-center justify-center gap-1.5"
                  >
                    <CheckCircle className="w-4 h-4" />
                    <span>
                      {pickText(
                        `৳${(payType === 'full'
                          ? selectedInvoiceForPayment.dueAmount || 0
                          : customPayAmount || 0
                        ).toLocaleString()} জমা নিন`,
                        `Collect ৳${(payType === 'full'
                          ? selectedInvoiceForPayment.dueAmount || 0
                          : customPayAmount || 0
                        ).toLocaleString()}`
                      )}
                    </span>
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
