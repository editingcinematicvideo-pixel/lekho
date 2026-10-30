import React, { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { dbService } from '../../services/db';
import { Invoice, OrderLineItem } from '../../types';
import { ReceiptModal } from '../pos/ReceiptModal';
import {
  ArrowLeft,
  Phone,
  Copy,
  Check,
  MessageSquare,
  Printer,
  Calendar,
  Clock,
  ShoppingBag,
  CreditCard,
  Wallet,
  Smartphone,
  Building,
  Flame,
  Award,
  ChevronDown,
  ChevronUp,
  Search,
  Download,
  Share2,
  User,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';

interface CustomerProfileFullViewProps {
  customerPhone: string;
  onBack: () => void;
  onNavigateToPOS?: () => void;
}

export const CustomerProfileFullView: React.FC<CustomerProfileFullViewProps> = ({
  customerPhone,
  onBack,
  onNavigateToPOS,
}) => {
  const { currentTenant, showToast, pickText } = useApp();
  const [copiedPhone, setCopiedPhone] = useState(false);
  const [searchItemQuery, setSearchItemQuery] = useState('');
  const [selectedReceiptInvoice, setSelectedReceiptInvoice] = useState<Invoice | null>(null);
  const [expandedInvoiceIds, setExpandedInvoiceIds] = useState<Record<string, boolean>>({});
  const [refreshTick, setRefreshTick] = useState(0);

  // Shop-scoped customer loyalty & profile summary
  const customerSummary = useMemo(() => {
    return dbService.getShopCustomerHistory(currentTenant.id, customerPhone);
  }, [currentTenant.id, customerPhone, refreshTick]);

  // Fetch all invoices for this tenant and filter for this customer
  const customerInvoices = useMemo(() => {
    return customerSummary?.invoices || [];
  }, [customerSummary]);

  // Derived customer profile info
  const customerName = useMemo(() => {
    return customerSummary?.customerName || 'Customer';
  }, [customerSummary]);

  const partyType = (customerInvoices[0]?.partyType as 'Retail' | 'Reseller') || 'Retail';

  const totalSpent = useMemo(() => {
    return customerInvoices.reduce((sum, inv) => sum + (Number(inv.total) || 0), 0);
  }, [customerInvoices]);

  const totalDue = useMemo(() => {
    return customerInvoices.reduce((sum, inv) => sum + (Number(inv.dueAmount) || 0), 0);
  }, [customerInvoices]);

  const totalPaid = Math.max(0, totalSpent - totalDue);

  const firstPurchaseDate = customerInvoices.length > 0 ? customerInvoices[customerInvoices.length - 1].createdAt : null;
  const latestPurchaseDate = customerInvoices.length > 0 ? customerInvoices[0].createdAt : null;

  // Total items purchased
  const totalItemsCount = useMemo(() => {
    return customerInvoices.reduce((sum, inv) => {
      return sum + (inv.items ? inv.items.reduce((s, it) => s + (Number(it.quantity) || 1), 0) : 0);
    }, 0);
  }, [customerInvoices]);

  // Filtered invoices based on search
  const filteredInvoices = useMemo(() => {
    if (!searchItemQuery.trim()) return customerInvoices;
    const q = searchItemQuery.toLowerCase().trim();
    return customerInvoices.filter((inv) => {
      const matchInvNo = inv.invoiceNo.toLowerCase().includes(q);
      const matchDate = inv.createdAt.includes(q);
      const matchItems = inv.items?.some(
        (it) =>
          it.title.toLowerCase().includes(q) ||
          it.subDetail?.toLowerCase().includes(q) ||
          it.size?.toLowerCase().includes(q) ||
          it.customization?.customName?.toLowerCase().includes(q)
      );
      return matchInvNo || matchDate || matchItems;
    });
  }, [customerInvoices, searchItemQuery]);

  // Copy phone handler
  const handleCopyPhone = () => {
    if (!customerPhone) return;
    navigator.clipboard.writeText(customerPhone);
    setCopiedPhone(true);
    showToast(`ফোন নম্বর কপি করা হয়েছে: ${customerPhone}`, 'success');
    setTimeout(() => setCopiedPhone(false), 2000);
  };

  // WhatsApp handler
  const handleWhatsApp = () => {
    const cleanPhone = customerPhone.replace(/\D/g, '');
    const intlPhone = cleanPhone.startsWith('88') ? cleanPhone : `88${cleanPhone}`;
    const text = `আসসালামু আলাইকুম ${customerName} ভাই, ${currentTenant.name} থেকে আপনার মেমো ও কেনাকাটার স্টেটমেন্ট পাঠানো হচ্ছে। মোট কেনাকাটা: ৳${totalSpent.toLocaleString()}${totalDue > 0 ? `, বকেয়া: ৳${totalDue.toLocaleString()}` : ''}।`;
    window.open(`https://wa.me/${intlPhone}?text=${encodeURIComponent(text)}`, '_blank');
  };

  // WhatsApp share specific invoice
  const handleShareInvoiceWhatsApp = (inv: Invoice) => {
    const cleanPhone = customerPhone.replace(/\D/g, '');
    const intlPhone = cleanPhone.startsWith('88') ? cleanPhone : `88${cleanPhone}`;
    const dateFormatted = formatDateTimeBangla(inv.createdAt);
    const itemsSummary = inv.items.map((it) => `${it.title} (${it.size}) × ${it.quantity} = ৳${it.subtotal}`).join('\n• ');
    const text = `আসসালামু আলাইকুম ${customerName} ভাই,\n${currentTenant.name} থেকে আপনার ইনভয়েস #${inv.invoiceNo} এর বিবরণ:\n\nতারিখ ও সময়: ${dateFormatted}\n\nপণ্য তালিকা:\n• ${itemsSummary}\n\nমোট বিল: ৳${inv.total}\nপরিশোধ: ৳${inv.total - (inv.dueAmount || 0)}\nবকেয়া: ৳${inv.dueAmount || 0}\n\nধন্যবাদ!`;
    window.open(`https://wa.me/${intlPhone}?text=${encodeURIComponent(text)}`, '_blank');
  };

  // Toggle invoice details expansion
  const toggleExpand = (id: string) => {
    setExpandedInvoiceIds((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  // Print Customer Statement (Full Ledger)
  const handlePrintStatement = () => {
    window.print();
  };

  // Date and Time Formatter (Bangla / English)
  function formatDateTimeBangla(dateStr: string) {
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      
      const day = d.getDate();
      const monthNames = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
      ];
      const month = monthNames[d.getMonth()];
      const year = d.getFullYear();
      
      let hours = d.getHours();
      const minutes = d.getMinutes().toString().padStart(2, '0');
      const ampm = hours >= 12 ? 'PM' : 'AM';
      hours = hours % 12 || 12;
      const formattedTime = `${hours}:${minutes} ${ampm}`;

      return `${day} ${month} ${year} • ${formattedTime}`;
    } catch {
      return dateStr;
    }
  }

  // Payment channel helper badge
  const renderPaymentChannelBadge = (inv: Invoice) => {
    const ch = inv.paymentChannel || 'cash';
    let icon = <Wallet className="w-3.5 h-3.5" />;
    let label = 'নগদ ক্যাশ (Cash)';
    let colorClass = 'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800';

    if (ch === 'bkash') {
      icon = <Smartphone className="w-3.5 h-3.5 text-pink-600" />;
      label = 'bKash Wallet';
      colorClass = 'bg-pink-50 text-pink-700 border-pink-200 dark:bg-pink-950/40 dark:text-pink-300 dark:border-pink-800';
    } else if (ch === 'nagad') {
      icon = <Smartphone className="w-3.5 h-3.5 text-orange-600" />;
      label = 'Nagad Wallet';
      colorClass = 'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950/40 dark:text-orange-300 dark:border-orange-800';
    } else if (ch === 'bank') {
      icon = <Building className="w-3.5 h-3.5 text-blue-600" />;
      label = 'Bank Transfer';
      colorClass = 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800';
    } else if (ch === 'split') {
      icon = <CreditCard className="w-3.5 h-3.5 text-purple-600" />;
      label = inv.splitDetails
        ? `Split: Cash ৳${inv.splitDetails.cashAmount} + ${inv.splitDetails.digitalChannel.toUpperCase()} ৳${inv.splitDetails.digitalAmount}`
        : 'Split Multi-Drawer';
      colorClass = 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800';
    }

    return (
      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl border text-xs font-bold ${colorClass}`}>
        {icon}
        <span>{label}</span>
      </span>
    );
  };

  return (
    <div className="space-y-5 max-w-5xl mx-auto pb-28 lg:pb-12 animate-in fade-in duration-150">
      {/* ========================================================================= */}
      {/* 1. TOP HEADER & BACK NAVIGATION                                           */}
      {/* ========================================================================= */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-zinc-900 border border-slate-200/90 dark:border-zinc-800 rounded-3xl p-4 sm:p-5 shadow-2xs">
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={onBack}
            className="w-10 h-10 rounded-2xl bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-750 text-slate-800 dark:text-zinc-100 flex items-center justify-center transition cursor-pointer active:scale-95 shrink-0 shadow-2xs border border-slate-200/80 dark:border-zinc-700"
            title="কাস্টমার তালিকায় ফিরুন (Back to Directory)"
            aria-label="Back to Customer Directory"
          >
            <ArrowLeft className="w-5 h-5" strokeWidth={2.5} />
          </button>

          <div className="w-11 h-11 rounded-2xl bg-[#164e3f] text-white flex items-center justify-center font-black text-lg shadow-xs shrink-0">
            {customerName.charAt(0) || 'C'}
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-base sm:text-xl font-extrabold text-slate-900 dark:text-white tracking-tight truncate">
                {customerName}
              </h1>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                partyType === 'Reseller'
                  ? 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/50 dark:text-purple-300'
                  : 'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300'
              }`}>
                {partyType} Customer
              </span>
            </div>

            <div className="flex items-center gap-2 mt-0.5">
              <p className="text-xs font-mono font-bold text-slate-600 dark:text-zinc-300">
                {customerPhone || 'No Phone Recorded'}
              </p>
              {customerPhone && (
                <button
                  type="button"
                  onClick={handleCopyPhone}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-800 dark:hover:text-zinc-200 hover:bg-slate-100 dark:hover:bg-zinc-800 transition cursor-pointer active:scale-95 inline-flex items-center gap-1"
                  title="ফোন নম্বর কপি করুন (Copy phone)"
                >
                  {copiedPhone ? (
                    <span className="flex items-center gap-0.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                      <Check className="w-3.5 h-3.5" />
                      <span>Copied!</span>
                    </span>
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Action Buttons: WhatsApp & Print Statement */}
        <div className="flex items-center gap-2 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100 dark:border-zinc-800">
          {customerPhone && (
            <button
              type="button"
              onClick={handleWhatsApp}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs transition cursor-pointer active:scale-95"
            >
              <MessageSquare className="w-4 h-4" />
              <span>WhatsApp</span>
            </button>
          )}

          <button
            type="button"
            onClick={handlePrintStatement}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-2xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 hover:bg-slate-50 dark:hover:bg-zinc-750 text-slate-700 dark:text-zinc-200 font-bold text-xs shadow-2xs transition cursor-pointer active:scale-95"
            title="গ্রাহকের সম্পূর্ণ হিসাব প্রিন্ট বা PDF করুন"
          >
            <Printer className="w-4 h-4 text-[#164e3f] dark:text-emerald-400" />
            <span className="hidden sm:inline">Print Statement</span>
            <span className="sm:hidden">Print</span>
          </button>

          {onNavigateToPOS && (
            <button
              type="button"
              onClick={onNavigateToPOS}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-2xl bg-[#164e3f] hover:bg-[#123e32] text-white font-bold text-xs shadow-xs transition cursor-pointer active:scale-95"
            >
              <ShoppingBag className="w-4 h-4" />
              <span className="hidden sm:inline">New POS Sale</span>
            </button>
          )}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2. STATS & LIFETIME PURCHASE METRICS + LOYALTY POINTS                     */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {/* Total Spent */}
        <div className="bg-white dark:bg-zinc-900 border border-slate-200/90 dark:border-zinc-800 rounded-3xl p-4 shadow-2xs">
          <span className="text-[11px] font-semibold text-slate-500 dark:text-zinc-400 uppercase block">
            {pickText('মোট ক্রয়', 'Total Purchases')}
          </span>
          <div className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white mt-1">
            ৳{totalSpent.toLocaleString()}
          </div>
          <span className="text-[11px] text-slate-400 mt-0.5 block">
            Across {customerInvoices.length} invoices
          </span>
        </div>

        {/* Total Orders & Items */}
        <div className="bg-white dark:bg-zinc-900 border border-slate-200/90 dark:border-zinc-800 rounded-3xl p-4 shadow-2xs">
          <span className="text-[11px] font-semibold text-slate-500 dark:text-zinc-400 uppercase block">
            {pickText('মোট অর্ডার', 'Total Orders')}
          </span>
          <div className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white mt-1">
            {customerInvoices.length}
          </div>
          <span className="text-[11px] text-slate-400 mt-0.5 block">
            {totalItemsCount} Total Items Purchased
          </span>
        </div>

        {/* Total Paid */}
        <div className="bg-white dark:bg-zinc-900 border border-slate-200/90 dark:border-zinc-800 rounded-3xl p-4 shadow-2xs">
          <span className="text-[11px] font-semibold text-slate-500 dark:text-zinc-400 uppercase block">
            {pickText('পরিশোধিত', 'Total Paid')}
          </span>
          <div className="text-xl sm:text-2xl font-black text-[#1f8a5b] dark:text-emerald-400 mt-1">
            ৳{totalPaid.toLocaleString()}
          </div>
          <span className="text-[11px] text-emerald-600/80 dark:text-emerald-400/80 mt-0.5 block">
            Cleared Payments
          </span>
        </div>

        {/* Outstanding Due */}
        <div className="bg-white dark:bg-zinc-900 border border-slate-200/90 dark:border-zinc-800 rounded-3xl p-4 shadow-2xs">
          <span className="text-[11px] font-semibold text-slate-500 dark:text-zinc-400 uppercase block">
            {pickText('বকেয়া', 'Outstanding Due')}
          </span>
          <div className={`text-xl sm:text-2xl font-black mt-1 ${
            totalDue > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-[#1f8a5b] dark:text-emerald-400'
          }`}>
            ৳{totalDue.toLocaleString()}
          </div>
          <span className="text-[11px] text-slate-400 mt-0.5 block">
            {totalDue > 0 ? 'Pending Collection' : '✓ No Dues Pending'}
          </span>
        </div>

        {/* Shop-Scoped Loyalty Points */}
        <div className="bg-[#e6f4ea]/60 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-3xl p-4 shadow-2xs col-span-2 lg:col-span-1">
          <span className="text-[11px] font-bold text-[#164e3f] dark:text-emerald-300 uppercase flex items-center gap-1">
            <Award className="w-3.5 h-3.5" />
            <span>লয়্যালটি পয়েন্ট (Points)</span>
          </span>
          <div className="text-xl sm:text-2xl font-black text-[#164e3f] dark:text-emerald-400 font-mono mt-1">
            {customerSummary?.loyaltyPoints || 0} pts
          </div>
          <span className="text-[10px] text-slate-600 dark:text-zinc-400 mt-0.5 block">
            শুধুমাত্র {currentTenant.name}-এ প্রযোজ্য
          </span>
        </div>
      </div>

      {/* Customer Timeline & Do-Not-Contact Preference */}
      <div className="bg-[#f4f7f5] dark:bg-zinc-850/80 border border-slate-200/90 dark:border-zinc-750 rounded-2xl px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-600 dark:text-zinc-300">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-slate-400" />
            <span>
              First Order: <strong className="text-slate-900 dark:text-white">{firstPurchaseDate ? formatDateTimeBangla(firstPurchaseDate) : 'N/A'}</strong>
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-slate-400" />
            <span>
              Latest Order: <strong className="text-slate-900 dark:text-white">{latestPurchaseDate ? formatDateTimeBangla(latestPurchaseDate) : 'N/A'}</strong>
            </span>
          </div>
        </div>

        <label className="inline-flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={Boolean(customerSummary?.doNotContact)}
            onChange={() => {
              const nextState = dbService.toggleCustomerDoNotContact(currentTenant.id, customerPhone, customerName);
              setRefreshTick((t) => t + 1);
              showToast(
                nextState
                  ? 'এই কাস্টমারের জন্য অফার মেসেজ বন্ধ (Do-Not-Contact) করা হয়েছে'
                  : 'এই কাস্টমারের জন্য অফার মেসেজ পুনরায় চালু করা হয়েছে',
                'info'
              );
            }}
            className="w-4 h-4 rounded accent-rose-600 cursor-pointer"
          />
          <span className="font-bold text-slate-700 dark:text-zinc-300">
            অফার মেসেজ বন্ধ রাখুন (Do-Not-Contact Opt-Out)
          </span>
        </label>
      </div>

      {/* Loyalty Points Ledger (If customer has loyalty transactions in this shop) */}
      {customerSummary && customerSummary.loyaltyHistory.length > 0 && (
        <div className="bg-white dark:bg-zinc-900 border border-slate-200/90 dark:border-zinc-800 rounded-3xl p-4 sm:p-5 shadow-2xs space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs sm:text-sm font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
              <Award className="w-4 h-4 text-[#164e3f] dark:text-emerald-400" />
              <span>লয়্যালটি পয়েন্ট লেজার (Loyalty Points History — {currentTenant.name})</span>
            </h3>
            <span className="text-xs font-bold text-[#164e3f] dark:text-emerald-400 font-mono">
              Current Balance: {customerSummary.loyaltyPoints} pts
            </span>
          </div>
          <div className="border border-slate-200 dark:border-zinc-800 rounded-2xl overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#f4f7f5] dark:bg-zinc-800 text-slate-600 dark:text-zinc-400 font-bold border-b border-slate-200 dark:border-zinc-700">
                <tr>
                  <th className="p-2.5">তারিখ (Date)</th>
                  <th className="p-2.5">ইনভয়েস (Invoice)</th>
                  <th className="p-2.5">বিবরণ (Note)</th>
                  <th className="p-2.5 text-right">পয়েন্ট পরিবর্তন</th>
                  <th className="p-2.5 text-right">ব্যালেন্স</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
                {customerSummary.loyaltyHistory.map((tx) => (
                  <tr key={tx.id}>
                    <td className="p-2.5 font-mono text-[11px] text-slate-500">
                      {new Date(tx.timestamp).toLocaleDateString()}
                    </td>
                    <td className="p-2.5 font-mono font-bold text-slate-800 dark:text-zinc-200">
                      #{tx.invoiceNo || '-'}
                    </td>
                    <td className="p-2.5 text-slate-700 dark:text-zinc-300">{tx.note}</td>
                    <td
                      className={`p-2.5 text-right font-mono font-black ${
                        tx.type === 'earn' ? 'text-[#1f8a5b]' : 'text-rose-600'
                      }`}
                    >
                      {tx.type === 'earn' ? `+${tx.points}` : `-${tx.points}`} pts
                    </td>
                    <td className="p-2.5 text-right font-mono font-bold text-slate-900 dark:text-white">
                      {tx.balanceAfter} pts
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 3. INVOICES & PURCHASES CHRONOLOGICAL TIMELINE                             */}
      {/* ========================================================================= */}
      <div className="bg-white dark:bg-zinc-900 border border-slate-200/90 dark:border-zinc-800 rounded-3xl p-4 sm:p-5 shadow-2xs space-y-4">
        {/* Header with Search */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-white">
              Complete Purchase History ({filteredInvoices.length} Orders)
            </h2>
            <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
              কাস্টমার কোন তারিখে কোন সময়ে কি কি পণ্য ক্রয় করেছেন ও কিভাবে পেমেন্ট করেছেন তার বিস্তারিত বিবরণ
            </p>
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchItemQuery}
              onChange={(e) => setSearchItemQuery(e.target.value)}
              placeholder="Search invoice or product..."
              className="w-full bg-[#f4f7f5] dark:bg-zinc-800 border border-slate-200/80 dark:border-zinc-700 rounded-xl pl-9 pr-3 py-1.5 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-[#164e3f]"
            />
          </div>
        </div>

        {/* Invoice Cards List */}
        {filteredInvoices.length === 0 ? (
          <div className="py-16 text-center text-slate-400 text-xs space-y-1">
            <ShoppingBag className="w-8 h-8 mx-auto opacity-30 text-slate-400 mb-2" />
            <p className="font-semibold text-slate-700 dark:text-zinc-300">
              কোনো কেনাকাটার রেকর্ড পাওয়া যায়নি
            </p>
            <p className="text-[11px]">অন্য কোনো কি-ওয়ার্ড দিয়ে আবার চেষ্টা করুন</p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredInvoices.map((inv, idx) => {
              const isExpanded = expandedInvoiceIds[inv.id] ?? true; // default expanded to see what they bought!
              const hasDue = (inv.dueAmount || 0) > 0;
              const formattedDate = formatDateTimeBangla(inv.createdAt);

              return (
                <div
                  key={inv.id}
                  className="border border-slate-200/90 dark:border-zinc-800 rounded-2xl bg-white dark:bg-zinc-850/60 overflow-hidden shadow-2xs transition hover:border-[#164e3f]/50"
                >
                  {/* Order Card Header */}
                  <div className="p-3.5 sm:p-4 bg-[#f8faf9] dark:bg-zinc-800/80 border-b border-slate-200/80 dark:border-zinc-750 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-start sm:items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-[#164e3f] text-white flex items-center justify-center font-mono font-black text-xs shrink-0 shadow-2xs">
                        #{idx + 1}
                      </div>

                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-extrabold text-sm sm:text-base text-slate-900 dark:text-white">
                            Invoice #{inv.invoiceNo}
                          </span>
                          {hasDue ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-md bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800">
                              <AlertCircle className="w-3 h-3" />
                              বকেয়া: ৳{inv.dueAmount}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800">
                              <CheckCircle2 className="w-3 h-3 text-[#1f8a5b]" />
                              সম্পূর্ণ পরিশোধিত (Paid)
                            </span>
                          )}
                        </div>

                        {/* Date and Time: কয় তারিখ কয়টা বাজে নিসে */}
                        <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-zinc-400 mt-1 flex-wrap font-medium">
                          <span className="flex items-center gap-1 font-semibold text-slate-700 dark:text-zinc-300">
                            <Calendar className="w-3.5 h-3.5 text-[#164e3f] dark:text-emerald-400" />
                            {formattedDate}
                          </span>
                          <span>•</span>
                          <span>বিক্রেতা: <strong>{inv.salesmanName || 'দোকান অ্যাডমিন'}</strong></span>
                        </div>
                      </div>
                    </div>

                    {/* Total & Quick Action */}
                    <div className="flex items-center justify-between sm:justify-end gap-3 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-200/60 dark:border-zinc-700">
                      <div className="text-left sm:text-right">
                        <span className="text-[10px] text-slate-400 block uppercase font-bold">
                          মোট বিল (Total Amount)
                        </span>
                        <div className="text-base sm:text-lg font-black text-slate-900 dark:text-white font-mono">
                          ৳{inv.total.toLocaleString()}
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => setSelectedReceiptInvoice(inv)}
                          className="p-2 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-slate-700 dark:text-zinc-200 hover:bg-slate-100 transition cursor-pointer active:scale-95 shadow-2xs"
                          title="মেমো প্রিন্ট / ভিউ করুন"
                        >
                          <Printer className="w-4 h-4" />
                        </button>

                        <button
                          type="button"
                          onClick={() => handleShareInvoiceWhatsApp(inv)}
                          className="p-2 rounded-xl bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400 hover:bg-emerald-100 transition cursor-pointer active:scale-95 shadow-2xs"
                          title="WhatsApp এ এই মেমো পাঠান"
                        >
                          <MessageSquare className="w-4 h-4" />
                        </button>

                        <button
                          type="button"
                          onClick={() => toggleExpand(inv.id)}
                          className="p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-zinc-200 hover:bg-slate-100 dark:hover:bg-zinc-800 transition cursor-pointer"
                        >
                          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Order Details Body */}
                  {isExpanded && (
                    <div className="p-4 space-y-4">
                      {/* Products Breakdown (কি কি নিসে) */}
                      <div>
                        <div className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider mb-2 flex items-center gap-1.5">
                          <ShoppingBag className="w-3.5 h-3.5 text-[#164e3f] dark:text-emerald-400" />
                          <span>ক্রয়কৃত পণ্যের তালিকা (Purchased Items - {inv.items?.length || 0})</span>
                        </div>

                        <div className="border border-slate-200/80 dark:border-zinc-750 rounded-2xl overflow-hidden divide-y divide-slate-100 dark:divide-zinc-800 text-xs">
                          {inv.items?.map((item: OrderLineItem, itemIdx: number) => (
                            <div
                              key={item.id || itemIdx}
                              className="p-3 bg-white dark:bg-zinc-900 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 hover:bg-slate-50/70 transition"
                            >
                              <div className="space-y-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="font-bold text-slate-900 dark:text-white text-xs sm:text-sm">
                                    {item.title}
                                  </span>
                                  {item.size && (
                                    <span className="px-2 py-0.5 rounded-md bg-[#e6f4ea] dark:bg-emerald-950/60 text-[#164e3f] dark:text-emerald-300 font-extrabold text-[11px] border border-emerald-200 dark:border-emerald-800">
                                      Size: {item.size}
                                    </span>
                                  )}
                                  <span className="text-slate-500 text-[11px]">
                                    ({item.quantity} {item.quantity === 1 ? 'pc' : 'pcs'} × ৳{item.rate})
                                  </span>
                                </div>

                                {item.subDetail && (
                                  <p className="text-[11px] text-slate-500 dark:text-zinc-400">
                                    {item.subDetail}
                                  </p>
                                )}

                                {/* Heat-Press Customization Details */}
                                {item.customization && (
                                  <div className="mt-1.5 p-2 rounded-xl bg-[#f4f7f5] dark:bg-zinc-800/80 border border-emerald-200/80 dark:border-emerald-900/40 text-[11px] space-y-1">
                                    <div className="flex items-center gap-1.5 font-bold text-[#164e3f] dark:text-emerald-300">
                                      <Flame className="w-3.5 h-3.5 text-amber-500" />
                                      <span>
                                        Heat-Press: {item.customization.customName || 'NAME'} #{item.customization.customNumber || '00'}
                                      </span>
                                      <span className="text-slate-400">•</span>
                                      <span className="text-slate-600 dark:text-zinc-300">
                                        {item.customization.fontStyle || 'Official Font'}
                                      </span>
                                    </div>
                                    <div className="flex items-center gap-3 text-slate-500 dark:text-zinc-400">
                                      <span>
                                        Badges: <strong>{item.customization.patches || 'None'}</strong>
                                      </span>
                                      <span>•</span>
                                      <span>
                                        Print Charge: <strong>+৳{item.customization.extraCharge}</strong>
                                      </span>
                                      {item.customization.instructions && (
                                        <>
                                          <span>•</span>
                                          <span>Note: <em>"{item.customization.instructions}"</em></span>
                                        </>
                                      )}
                                    </div>
                                  </div>
                                )}
                              </div>

                              <div className="text-right shrink-0">
                                <span className="font-black text-slate-900 dark:text-white font-mono text-xs sm:text-sm">
                                  ৳{(item.subtotal || item.rate * item.quantity).toLocaleString()}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Payment Method Breakdown (কিভাবে পেমেন্ট করসে) */}
                      <div className="p-3.5 rounded-2xl bg-[#f8faf9] dark:bg-zinc-800/60 border border-slate-200/80 dark:border-zinc-750 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                        <div className="space-y-1">
                          <div className="text-[11px] font-bold text-slate-500 dark:text-zinc-400 uppercase">
                            পেমেন্ট মাধ্যম (Payment Method)
                          </div>
                          <div>{renderPaymentChannelBadge(inv)}</div>
                        </div>

                        <div className="flex items-center gap-4 text-right">
                          {inv.discount > 0 && (
                            <div>
                              <span className="text-[10px] text-slate-400 block">ডিসকাউন্ট</span>
                              <span className="font-bold text-amber-600">-৳{inv.discount}</span>
                            </div>
                          )}
                          <div>
                            <span className="text-[10px] text-slate-400 block">পরিশোধিত</span>
                            <span className="font-bold text-[#1f8a5b] dark:text-emerald-400">
                              ৳{(inv.paidAmount ?? (inv.total - (inv.dueAmount || 0))).toLocaleString()}
                            </span>
                          </div>
                          {hasDue && (
                            <div>
                              <span className="text-[10px] text-slate-400 block">বর্তমান বকেয়া</span>
                              <span className="font-bold text-rose-600">৳{inv.dueAmount}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* 4. PRINTABLE REPORT SECTION (FOR PRINT & SAVE AS PDF)                      */}
      {/* ========================================================================= */}
      <div id="printable-customer-statement" className="hidden">
        <div className="p-8 text-black bg-white space-y-4">
          <div className="border-b-2 border-black pb-3 text-center">
            <h1 className="text-2xl font-black uppercase tracking-wider">{currentTenant.name}</h1>
            <p className="text-xs">{currentTenant.marketMallName} • {currentTenant.shopNo}</p>
            <p className="text-xs">হটলাইন: {currentTenant.ownerPhone} • Retail POS Statement</p>
          </div>

          <div className="flex justify-between items-center text-xs border-b pb-2">
            <div>
              <p><strong>Customer Name:</strong> {customerName}</p>
              <p><strong>Mobile Phone:</strong> {customerPhone}</p>
              <p><strong>Customer Type:</strong> {partyType}</p>
            </div>
            <div className="text-right">
              <p><strong>Total Orders:</strong> {customerInvoices.length}</p>
              <p><strong>Total Lifetime Purchases:</strong> ৳{totalSpent.toLocaleString()}</p>
              <p><strong>Total Outstanding Due:</strong> ৳{totalDue.toLocaleString()}</p>
            </div>
          </div>

          <table className="w-full text-xs text-left border-collapse border border-black">
            <thead>
              <tr className="bg-slate-100 border-b border-black">
                <th className="p-2 border border-black">Invoice #</th>
                <th className="p-2 border border-black">Date & Time</th>
                <th className="p-2 border border-black">Items Purchased</th>
                <th className="p-2 border border-black">Payment Channel</th>
                <th className="p-2 text-right border border-black">Bill (৳)</th>
                <th className="p-2 text-right border border-black">Due (৳)</th>
              </tr>
            </thead>
            <tbody>
              {customerInvoices.map((inv) => (
                <tr key={inv.id} className="border-b border-black">
                  <td className="p-2 font-mono font-bold border border-black">#{inv.invoiceNo}</td>
                  <td className="p-2 border border-black">{formatDateTimeBangla(inv.createdAt)}</td>
                  <td className="p-2 border border-black">
                    {inv.items.map((it) => `${it.title} (${it.size}) × ${it.quantity}`).join(', ')}
                  </td>
                  <td className="p-2 capitalize border border-black">{inv.paymentChannel}</td>
                  <td className="p-2 text-right font-bold border border-black">৳{inv.total}</td>
                  <td className="p-2 text-right font-bold border border-black">৳{inv.dueAmount || 0}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="pt-4 text-center text-[10px] text-gray-500">
            Generated by LEKHO POS • {new Date().toLocaleString()}
          </div>
        </div>
      </div>

      {/* Cash Receipt Modal if selected */}
      {selectedReceiptInvoice && (
        <ReceiptModal
          isOpen={!!selectedReceiptInvoice}
          onClose={() => setSelectedReceiptInvoice(null)}
          invoice={selectedReceiptInvoice}
        />
      )}
    </div>
  );
};
