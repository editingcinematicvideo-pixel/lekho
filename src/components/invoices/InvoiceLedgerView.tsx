import React, { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { Invoice } from '../../types';
import { dbService } from '../../services/db';
import { ReceiptModal } from '../pos/ReceiptModal';
import { BottomSheet } from '../ui/BottomSheet';
import {
  FileText,
  Search,
  Download,
  Printer,
  Share2,
  PlusCircle,
  Copy,
  ChevronRight,
  Calendar,
  X,
} from 'lucide-react';

interface InvoiceLedgerViewProps {
  onNavigateToPOS?: () => void;
}

export type InvoiceStatusFilter = 'all' | 'paid' | 'partial' | 'due';
export type InvoiceDatePreset = 'all' | 'today' | 'yesterday' | 'last7days' | 'month' | 'custom';

export interface InvoiceFilterCriteria {
  searchQuery: string;
  channelFilter: string;
  statusFilter: InvoiceStatusFilter;
  dateRange: InvoiceDatePreset;
  fromDate?: string;
  toDate?: string;
  now?: Date;
}

function toLocalDateKey(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function filterInvoicesList(
  invoices: Invoice[],
  criteria: InvoiceFilterCriteria
): Invoice[] {
  const {
    searchQuery,
    channelFilter,
    statusFilter,
    dateRange,
    fromDate = '',
    toDate = '',
    now = new Date(),
  } = criteria;

  // Normalize custom date bounds if both are provided and inverted
  const [normalizedFrom, normalizedTo] =
    fromDate && toDate && fromDate > toDate ? [toDate, fromDate] : [fromDate, toDate];

  return invoices.filter((inv) => {
    if (inv.isSoftDeleted) return false;

    // 1. Channel filter
    if (
      channelFilter !== 'all' &&
      inv.paymentChannel !== channelFilter &&
      inv.paymentMethod !== channelFilter
    ) {
      return false;
    }

    // 2. Status filter
    const due = Number(inv.dueAmount) || 0;
    const paid = inv.paidAmount ?? inv.advancePaid ?? inv.total - due;
    if (statusFilter === 'paid') {
      if (due > 0) return false;
    } else if (statusFilter === 'partial') {
      // Include any invoice with outstanding due (partial or unpaid)
      if (due <= 0) return false;
    } else if (statusFilter === 'due') {
      if (paid > 0 && due <= 0) return false;
    }

    // 3. Custom Calendar Date Range filter (takes priority when applied)
    const invDate = new Date(inv.createdAt);
    const invTime = invDate.getTime();
    const invLocalDay = !isNaN(invTime) ? toLocalDateKey(invDate) : '';
    const invIsoDay = (inv.createdAt || '').slice(0, 10);

    if (normalizedFrom || normalizedTo) {
      if (!invLocalDay && !invIsoDay) return false;
      if (normalizedFrom && invLocalDay < normalizedFrom && invIsoDay < normalizedFrom) {
        return false;
      }
      if (normalizedTo && invLocalDay > normalizedTo && invIsoDay > normalizedTo) {
        return false;
      }
    } else if (dateRange !== 'all' && dateRange !== 'custom') {
      // 4. Preset Time filter (when no custom calendar range is active)
      if (isNaN(invTime)) return false;
      if (dateRange === 'today') {
        if (invDate.toDateString() !== now.toDateString()) return false;
      } else if (dateRange === 'yesterday') {
        const yest = new Date(now);
        yest.setDate(yest.getDate() - 1);
        if (invDate.toDateString() !== yest.toDateString()) return false;
      } else if (dateRange === 'last7days') {
        const diffDays = (now.getTime() - invTime) / (1000 * 3600 * 24);
        if (diffDays > 7 || diffDays < -1) return false;
      } else if (dateRange === 'month') {
        if (
          invDate.getMonth() !== now.getMonth() ||
          invDate.getFullYear() !== now.getFullYear()
        ) {
          return false;
        }
      }
    }

    // 5. Search query filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      const matchInvoiceNo = inv.invoiceNo.toLowerCase().includes(query);
      const matchCustomer = (inv.customerName || '').toLowerCase().includes(query);
      const matchPhone = (inv.customerPhone || '').toLowerCase().includes(query);
      const matchItem = inv.items.some((it) => it.title.toLowerCase().includes(query));
      if (!matchInvoiceNo && !matchCustomer && !matchPhone && !matchItem) return false;
    }

    return true;
  });
}

function formatInvoiceDateTime(isoStr: string): string {
  const d = new Date(isoStr);
  if (isNaN(d.getTime())) return isoStr;
  const datePart = d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
  const timePart = d.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
  return `${datePart} • ${timePart}`;
}

export const InvoiceLedgerView: React.FC<InvoiceLedgerViewProps> = ({ onNavigateToPOS }) => {
  const { currentTenant, showToast } = useApp();

  const [invoices] = useState<Invoice[]>(() =>
    dbService.getInvoices(currentTenant.id)
  );

  const [searchQuery, setSearchQuery] = useState('');
  const [channelFilter, setChannelFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<InvoiceStatusFilter>('all');
  const [dateRange, setDateRange] = useState<InvoiceDatePreset>('all');

  // Calendar Date-Range Picker state (Applied vs Pending)
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const [appliedFromDate, setAppliedFromDate] = useState('');
  const [appliedToDate, setAppliedToDate] = useState('');
  const [pendingFromDate, setPendingFromDate] = useState('');
  const [pendingToDate, setPendingToDate] = useState('');

  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);
  const [detailInvoice, setDetailInvoice] = useState<Invoice | null>(null);
  const [, setCopiedId] = useState<string | null>(null);

  const hasCustomDateRange = Boolean(appliedFromDate || appliedToDate);

  // Financial aggregates (preserving exact existing calculations)
  const totalCollected = useMemo(() => {
    return invoices.reduce((acc, inv) => acc + (inv.paidAmount ?? inv.total), 0);
  }, [invoices]);

  const totalReceivable = useMemo(() => {
    return invoices.reduce((acc, inv) => acc + (inv.dueAmount || 0), 0);
  }, [invoices]);

  const drawers = useMemo(() => {
    return dbService.getShopDrawers(currentTenant.id);
  }, [currentTenant.id]);

  const totalVaultBalance = useMemo(() => {
    return Object.values(drawers).reduce((acc, val) => acc + (Number(val) || 0), 0);
  }, [drawers]);

  const totalFeesAndExpenses = useMemo(() => {
    const expenses = dbService.getExpenses(currentTenant.id);
    return expenses.reduce((acc, exp) => acc + (Number(exp.amount) || 0), 0);
  }, [currentTenant.id]);

  // Combined Filtering
  const filteredInvoices = useMemo(() => {
    return filterInvoicesList(invoices, {
      searchQuery,
      channelFilter,
      statusFilter,
      dateRange,
      fromDate: appliedFromDate,
      toDate: appliedToDate,
    });
  }, [invoices, searchQuery, channelFilter, statusFilter, dateRange, appliedFromDate, appliedToDate]);

  const handleOpenDatePicker = () => {
    setPendingFromDate(appliedFromDate);
    setPendingToDate(appliedToDate);
    setIsDatePickerOpen(true);
  };

  const handleCancelDatePicker = () => {
    setPendingFromDate(appliedFromDate);
    setPendingToDate(appliedToDate);
    setIsDatePickerOpen(false);
  };

  const handleApplyDateRange = () => {
    const from = pendingFromDate.trim();
    const to = pendingToDate.trim();
    const [normFrom, normTo] = from && to && from > to ? [to, from] : [from, to];
    setAppliedFromDate(normFrom);
    setAppliedToDate(normTo);
    if (normFrom || normTo) {
      setDateRange('custom');
    } else if (dateRange === 'custom') {
      setDateRange('all');
    }
    setIsDatePickerOpen(false);
  };

  const handleClearDateRange = () => {
    setAppliedFromDate('');
    setAppliedToDate('');
    setPendingFromDate('');
    setPendingToDate('');
    if (dateRange === 'custom') {
      setDateRange('all');
    }
    setIsDatePickerOpen(false);
  };

  const handlePresetTimeChange = (value: InvoiceDatePreset) => {
    if (value === 'custom') {
      handleOpenDatePicker();
      return;
    }
    setDateRange(value);
    setAppliedFromDate('');
    setAppliedToDate('');
    setPendingFromDate('');
    setPendingToDate('');
  };

  const handleCopyMemoId = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(id);
    setCopiedId(id);
    showToast(`Invoice ID ${id} copied to clipboard!`, 'info');
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleOpenReceipt = (inv: Invoice, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setSelectedInvoice(inv);
    setIsReceiptModalOpen(true);
  };

  const handleExportCSV = (singleInvoice?: Invoice) => {
    const listToExport = singleInvoice ? [singleInvoice] : filteredInvoices;
    if (listToExport.length === 0) {
      showToast('No invoices to export.', 'warning');
      return;
    }

    const headers = [
      'Invoice No',
      'Date',
      'Customer Name',
      'Customer Phone',
      'Items Count',
      'Total (BDT)',
      'Paid (BDT)',
      'Due (BDT)',
      'Channel',
      'Status',
    ];

    const rows = listToExport.map((inv) => [
      `"${inv.invoiceNo}"`,
      `"${new Date(inv.createdAt).toLocaleString()}"`,
      `"${inv.customerName || 'Walk-in'}"`,
      `"${inv.customerPhone || 'N/A'}"`,
      inv.items.length,
      inv.total,
      inv.paidAmount ?? inv.advancePaid ?? inv.total - (inv.dueAmount || 0),
      inv.dueAmount || 0,
      `"${inv.paymentChannel || inv.paymentMethod || 'cash'}"`,
      `"${(inv.dueAmount || 0) > 0 ? 'Partial/Due' : 'Paid'}"`,
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute(
      'download',
      singleInvoice
        ? `Invoice_${singleInvoice.invoiceNo}.csv`
        : `Invoices_${currentTenant.slug}_${Date.now()}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast(
      singleInvoice
        ? `Exported CSV for #${singleInvoice.invoiceNo}`
        : `Exported ${listToExport.length} invoices to CSV`,
      'success'
    );
  };

  const handleSendWhatsApp = (inv: Invoice, e: React.MouseEvent) => {
    e.stopPropagation();
    const cleanPhone = (inv.customerPhone || '').replace(/[^0-9]/g, '');
    if (!cleanPhone) {
      showToast('কাস্টমারের ফোন নম্বর নেই', 'warning');
      return;
    }
    const fullPhone = cleanPhone.startsWith('88') ? cleanPhone : `88${cleanPhone}`;
    const itemsText = inv.items
      .map((it) => `• ${it.title} (x${it.quantity}) - ৳${it.subtotal}`)
      .join('\n');
    const channelName = inv.paymentChannel || inv.paymentMethod || 'cash';
    const msg =
      `*${currentTenant.name}* - ক্যাশ মেমো #${inv.invoiceNo}\n` +
      `তারিখ: ${new Date(inv.createdAt).toLocaleDateString()}\n` +
      `কাস্টমার: ${inv.customerName || 'সম্মানিত কাস্টমার'}\n\n` +
      `*পণ্যের বিবরণ:*\n${itemsText}\n\n` +
      `মোট টাকা: ৳${inv.total}\n` +
      `পরিশোধিত: ৳${inv.paidAmount ?? inv.advancePaid ?? inv.total - (inv.dueAmount || 0)} (${channelName})\n` +
      (inv.dueAmount ? `বাকি টাকা: ৳${inv.dueAmount}\n` : '') +
      `\nআমাদের সাথে কেনাকাটা করার জন্য ধন্যবাদ!`;

    window.open(`https://wa.me/${fullPhone}?text=${encodeURIComponent(msg)}`, '_blank');
  };

  return (
    <div className="space-y-3 sm:space-y-4 animate-in fade-in duration-150">
      {/* Desktop Header Bar (Mobile uses the top Navbar with Create Order button) */}
      <div className="hidden md:flex items-center justify-between gap-3 bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 rounded-2xl px-4 py-3 shadow-2xs">
        <div className="flex items-center gap-2">
          <h2 className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-white tracking-tight">
            Sales & Invoices
          </h2>
          <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300">
            {filteredInvoices.length}
          </span>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => handleExportCSV()}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-750 text-slate-800 dark:text-zinc-200 border border-slate-200 dark:border-zinc-700 transition cursor-pointer"
            title="Export filtered invoices to CSV"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>

          {onNavigateToPOS && (
            <button
              type="button"
              onClick={onNavigateToPOS}
              className="flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-bold text-white bg-[#0d5c3e] hover:bg-[#094730] shadow-2xs transition cursor-pointer"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Create Order</span>
            </button>
          )}
        </div>
      </div>

      {/* Unified Search + Calendar Button + Compact 2x2 Financial Summary Grid */}
      <div className="bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 rounded-3xl p-3 sm:p-4 shadow-2xs space-y-3 relative">
        {/* Search Input + Separate Right Calendar Button */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1 min-w-0">
            <Search className="w-4 h-4 text-slate-400 dark:text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search invoice or customer..."
              className="w-full h-10 bg-[#f4f7f6] dark:bg-zinc-950 border border-slate-200/70 dark:border-zinc-800 rounded-2xl pl-9 pr-8 text-xs sm:text-[13px] text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-zinc-500 focus:outline-none focus:border-[#0d5c3e] transition"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                aria-label="Clear search"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded-full text-slate-400 hover:text-slate-700 dark:hover:text-zinc-200 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={() => (isDatePickerOpen ? handleCancelDatePicker() : handleOpenDatePicker())}
            aria-label="Filter by date range"
            aria-expanded={isDatePickerOpen}
            title="Select Date Range"
            className={`w-10 h-10 rounded-2xl border flex items-center justify-center shrink-0 transition cursor-pointer active:scale-95 ${
              hasCustomDateRange || isDatePickerOpen
                ? 'bg-[#0d5c3e] text-white border-[#0d5c3e] shadow-2xs'
                : 'bg-[#e8f4ee] hover:bg-[#daf0e5] text-[#0d5c3e] border-emerald-200/70 dark:bg-emerald-950/60 dark:text-emerald-400 dark:border-emerald-800/60'
            }`}
          >
            <Calendar className="w-4 h-4" strokeWidth={2} />
          </button>
        </div>

        {/* Active Custom Date Range Indicator Chip */}
        {hasCustomDateRange && (
          <div className="flex items-center justify-between gap-2 px-3 py-1.5 rounded-xl bg-[#ebf5f0] dark:bg-emerald-950/40 border border-emerald-200/80 dark:border-emerald-800/60 text-[11px]">
            <button
              type="button"
              onClick={handleOpenDatePicker}
              className="font-semibold text-[#0d5c3e] dark:text-emerald-300 truncate text-left cursor-pointer"
            >
              Date: {appliedFromDate || 'Start'} → {appliedToDate || 'Today'}
            </button>
            <button
              type="button"
              onClick={handleClearDateRange}
              aria-label="Clear date range"
              className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-500 hover:text-rose-600 dark:text-zinc-400 dark:hover:text-rose-400 shrink-0 cursor-pointer"
            >
              <span>Clear</span>
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Compact Date-Range Picker Popover */}
        {isDatePickerOpen && (
          <>
            <div
              className="fixed inset-0 z-40 bg-black/15 sm:bg-transparent"
              onClick={handleCancelDatePicker}
            />
            <div
              role="dialog"
              aria-label="Select date range"
              className="relative sm:absolute sm:right-4 sm:top-14 z-50 w-full sm:w-80 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-3.5 shadow-xl space-y-3 animate-in fade-in zoom-in-95 duration-150"
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label
                    htmlFor="invoice-date-from"
                    className="block text-[11px] font-semibold text-slate-600 dark:text-zinc-400 mb-1"
                  >
                    From Date
                  </label>
                  <input
                    id="invoice-date-from"
                    type="date"
                    value={pendingFromDate}
                    onChange={(e) => setPendingFromDate(e.target.value)}
                    className="w-full h-9 bg-[#f4f7f6] dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl px-2.5 text-xs font-mono text-slate-900 dark:text-white focus:outline-none focus:border-[#0d5c3e]"
                  />
                </div>
                <div>
                  <label
                    htmlFor="invoice-date-to"
                    className="block text-[11px] font-semibold text-slate-600 dark:text-zinc-400 mb-1"
                  >
                    To Date
                  </label>
                  <input
                    id="invoice-date-to"
                    type="date"
                    value={pendingToDate}
                    onChange={(e) => setPendingToDate(e.target.value)}
                    className="w-full h-9 bg-[#f4f7f6] dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl px-2.5 text-xs font-mono text-slate-900 dark:text-white focus:outline-none focus:border-[#0d5c3e]"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between gap-2 pt-1">
                <button
                  type="button"
                  onClick={handleClearDateRange}
                  className="text-[11px] font-semibold text-slate-500 hover:text-rose-600 dark:text-zinc-400 dark:hover:text-rose-400 px-2 py-1.5 rounded-lg transition cursor-pointer"
                >
                  Reset
                </button>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleCancelDatePicker}
                    className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-zinc-700 text-xs font-semibold text-slate-700 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800 transition cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleApplyDateRange}
                    className="px-3.5 py-1.5 rounded-xl bg-[#0d5c3e] hover:bg-[#094730] text-white text-xs font-bold transition cursor-pointer shadow-2xs"
                  >
                    Apply
                  </button>
                </div>
              </div>
            </div>
          </>
        )}

        {/* 2x2 Compact Financial Summary Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-2.5">
          <div className="bg-[#ebf5f0] dark:bg-emerald-950/30 border border-emerald-100/90 dark:border-emerald-900/50 rounded-2xl p-2.5 sm:p-3">
            <div className="text-[#2c5e4c] dark:text-emerald-300/80 text-[11px] font-medium truncate">
              Total Collected
            </div>
            <div className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-white font-mono mt-0.5 leading-tight">
              ৳{totalCollected.toLocaleString()}
            </div>
          </div>

          <div className="bg-[#efe7e9] dark:bg-rose-950/30 border border-rose-200/70 dark:border-rose-900/60 rounded-2xl p-2.5 sm:p-3">
            <div className="text-slate-600 dark:text-zinc-400 text-[11px] font-medium truncate">
              Receivable (Due)
            </div>
            <div className="text-base sm:text-lg font-extrabold text-rose-600 dark:text-rose-400 font-mono mt-0.5 leading-tight">
              ৳{totalReceivable.toLocaleString()}
            </div>
          </div>

          <div className="bg-[#ebf5f0] dark:bg-emerald-950/30 border border-emerald-100/90 dark:border-emerald-900/50 rounded-2xl p-2.5 sm:p-3">
            <div className="text-[#2c5e4c] dark:text-emerald-300/80 text-[11px] font-medium truncate">
              Vault Balance
            </div>
            <div className="text-base sm:text-lg font-extrabold text-[#0d6847] dark:text-emerald-400 font-mono mt-0.5 leading-tight">
              ৳{totalVaultBalance.toLocaleString()}
            </div>
          </div>

          <div className="bg-[#f8faf9] dark:bg-zinc-800/60 border border-slate-200/80 dark:border-zinc-800 rounded-2xl p-2.5 sm:p-3">
            <div className="text-slate-500 dark:text-zinc-400 text-[11px] font-medium truncate">
              Expenses
            </div>
            <div className="text-base sm:text-lg font-extrabold text-black dark:text-white font-mono mt-0.5 leading-tight">
              ৳{totalFeesAndExpenses.toLocaleString()}
            </div>
          </div>
        </div>
      </div>

      {/* Compact Filter Bar (Status Pills + Channel & Time Dropdowns) */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        {/* Status Segmented Pills */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {(
            [
              { id: 'all', label: 'All Status' },
              { id: 'paid', label: 'Paid' },
              { id: 'partial', label: 'Partial Due' },
            ] as const
          ).map((tab) => {
            const active = statusFilter === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setStatusFilter(tab.id)}
                className={`px-3 py-1.5 rounded-full text-xs font-bold border transition cursor-pointer ${
                  active
                    ? 'bg-[#0d5c3e] text-white border-[#0d5c3e] shadow-2xs'
                    : 'bg-white dark:bg-zinc-900 text-slate-700 dark:text-zinc-300 border-slate-200/90 dark:border-zinc-800 hover:bg-slate-50 dark:hover:bg-zinc-800'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Channel & Time Selects */}
        <div className="flex items-center gap-1.5 flex-1 sm:flex-initial justify-end min-w-[200px]">
          <select
            aria-label="Filter by payment channel"
            value={channelFilter}
            onChange={(e) => setChannelFilter(e.target.value)}
            className="flex-1 sm:flex-initial bg-white dark:bg-zinc-900 border border-slate-200/90 dark:border-zinc-800 rounded-full px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-zinc-300 cursor-pointer focus:outline-none focus:border-[#0d5c3e] min-w-0"
          >
            <option value="all">All Channels</option>
            <option value="cash">Cash</option>
            <option value="merchantBkash">bKash Merchant</option>
            <option value="personalBkash">bKash Personal</option>
            <option value="nagad">Nagad</option>
            <option value="bank">Bank</option>
          </select>

          <select
            aria-label="Filter by time period"
            value={hasCustomDateRange ? 'custom' : dateRange}
            onChange={(e) => handlePresetTimeChange(e.target.value as InvoiceDatePreset)}
            className="flex-1 sm:flex-initial bg-white dark:bg-zinc-900 border border-slate-200/90 dark:border-zinc-800 rounded-full px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-zinc-300 cursor-pointer focus:outline-none focus:border-[#0d5c3e] min-w-0"
          >
            <option value="all">All Time</option>
            <option value="today">Today</option>
            <option value="yesterday">Yesterday</option>
            <option value="last7days">Last 7 Days</option>
            <option value="month">This Month</option>
            {hasCustomDateRange && <option value="custom">Custom Date</option>}
          </select>
        </div>
      </div>

      {/* Invoice Records List */}
      {filteredInvoices.length === 0 ? (
        <div className="bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 rounded-2xl py-10 px-4 text-center text-slate-400 dark:text-zinc-500 shadow-2xs">
          <FileText className="w-6 h-6 mx-auto mb-1.5 opacity-40" />
          <p className="font-semibold text-xs">No matching invoices found</p>
        </div>
      ) : (
        <>
          {/* Mobile & Tablet Clean Card List (< md) */}
          <div className="md:hidden space-y-2">
            {filteredInvoices.map((inv) => {
              const due = Number(inv.dueAmount) || 0;
              const paid = inv.paidAmount ?? inv.advancePaid ?? inv.total - due;
              const isPaid = due <= 0;
              const isPartial = due > 0 && paid > 0;

              return (
                <button
                  key={inv.id}
                  type="button"
                  onClick={() => setDetailInvoice(inv)}
                  className="w-full bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 rounded-2xl px-3.5 py-3 text-left flex items-center justify-between gap-2.5 shadow-2xs hover:border-emerald-300 dark:hover:border-zinc-700 transition cursor-pointer"
                >
                  <div className="min-w-0 flex-1">
                    <div className="font-extrabold text-[13px] text-slate-900 dark:text-white tracking-tight truncate">
                      {inv.invoiceNo}
                    </div>
                    <div className="text-xs text-slate-500 dark:text-zinc-400 truncate mt-0.5">
                      {inv.customerName || 'Walk-in Customer'}
                    </div>
                    <div className="mt-1.5 flex items-center gap-2 flex-wrap">
                      {isPaid ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#e3f5ec] text-[#0d6847] dark:bg-emerald-950/60 dark:text-emerald-400">
                          Paid
                        </span>
                      ) : isPartial ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#fef3c7] text-[#b45309] dark:bg-amber-950/60 dark:text-amber-400">
                          Partial Due
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#ffe4e6] text-[#e11d48] dark:bg-rose-950/60 dark:text-rose-400">
                          Due
                        </span>
                      )}
                      {due > 0 && (
                        <span className="text-[10px] font-bold text-rose-600 dark:text-rose-400 font-mono">
                          Due ৳{due.toLocaleString()}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <div className="text-right">
                      <div className="font-mono font-extrabold text-[13px] sm:text-sm text-slate-900 dark:text-white">
                        ৳{inv.total.toLocaleString()}
                      </div>
                      <div className="text-[11px] text-slate-400 dark:text-zinc-500 mt-1 whitespace-nowrap">
                        {formatInvoiceDateTime(inv.createdAt)}
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
                  </div>
                </button>
              );
            })}
          </div>

          {/* Desktop Table (>= md) */}
          <div className="hidden md:block bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 rounded-2xl overflow-hidden shadow-2xs">
            <div className="overflow-x-auto no-scrollbar">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 dark:bg-zinc-950/80 border-b border-slate-200 dark:border-zinc-800 text-slate-500 dark:text-zinc-400 font-semibold select-none">
                    <th className="py-3 px-4">Invoice ID</th>
                    <th className="py-3 px-3">Date</th>
                    <th className="py-3 px-3">Customer</th>
                    <th className="py-3 px-3">Items Ordered</th>
                    <th className="py-3 px-3 text-right">Total</th>
                    <th className="py-3 px-3">Channel</th>
                    <th className="py-3 px-3 text-right">Due</th>
                    <th className="py-3 px-3 text-center">Status</th>
                    <th className="py-3 px-4 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-zinc-800/80 text-slate-800 dark:text-zinc-200">
                  {filteredInvoices.map((inv) => {
                    const due = Number(inv.dueAmount) || 0;
                    const paid = inv.paidAmount ?? inv.advancePaid ?? inv.total - due;
                    const isPaid = due <= 0;
                    const isPartial = due > 0 && paid > 0;
                    const dateObj = new Date(inv.createdAt);

                    return (
                      <tr
                        key={inv.id}
                        onClick={() => setDetailInvoice(inv)}
                        className="hover:bg-slate-50/80 dark:hover:bg-zinc-800/50 transition cursor-pointer group"
                      >
                        <td className="py-3 px-4 font-mono font-bold text-slate-900 dark:text-white whitespace-nowrap">
                          <div className="flex items-center gap-1.5">
                            <span>{inv.invoiceNo}</span>
                            <button
                              type="button"
                              onClick={(e) => handleCopyMemoId(inv.invoiceNo, e)}
                              className="p-1 rounded text-slate-400 hover:text-slate-700 dark:hover:text-zinc-200 cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity"
                              title="Copy Invoice ID"
                            >
                              <Copy className="w-3 h-3" />
                            </button>
                          </div>
                        </td>

                        <td className="py-3 px-3 whitespace-nowrap text-slate-600 dark:text-zinc-400">
                          <div>{dateObj.toLocaleDateString('en-GB')}</div>
                          <div className="text-[10px] text-slate-400 dark:text-zinc-500">
                            {dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </div>
                        </td>

                        <td className="py-3 px-3">
                          <div className="font-semibold text-slate-900 dark:text-white truncate max-w-[140px]">
                            {inv.customerName || 'Walk-in Customer'}
                          </div>
                          {inv.customerPhone && (
                            <div className="text-[11px] font-mono text-slate-500 dark:text-zinc-400">
                              {inv.customerPhone}
                            </div>
                          )}
                        </td>

                        <td className="py-3 px-3 max-w-[200px]">
                          <div className="truncate font-medium text-slate-800 dark:text-zinc-200">
                            {inv.items[0]?.title}
                          </div>
                          <div className="text-[10px] text-slate-400 dark:text-zinc-500">
                            {inv.items.length} {inv.items.length === 1 ? 'item' : 'items'}
                          </div>
                        </td>

                        <td className="py-3 px-3 text-right font-mono font-bold text-slate-900 dark:text-white whitespace-nowrap">
                          ৳{inv.total.toLocaleString()}
                        </td>

                        <td className="py-3 px-3 whitespace-nowrap">
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-lg bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 uppercase">
                            {inv.paymentChannel || inv.paymentMethod || 'cash'}
                          </span>
                        </td>

                        <td className="py-3 px-3 text-right font-mono whitespace-nowrap">
                          {due > 0 ? (
                            <span className="font-bold text-rose-600 dark:text-rose-400">
                              ৳{due.toLocaleString()}
                            </span>
                          ) : (
                            <span className="text-slate-400 dark:text-zinc-500">৳0</span>
                          )}
                        </td>

                        <td className="py-3 px-3 text-center whitespace-nowrap">
                          {isPaid ? (
                            <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-[#e3f5ec] text-[#0d6847] dark:bg-emerald-950/40 dark:text-emerald-400">
                              Paid
                            </span>
                          ) : isPartial ? (
                            <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-[#fef3c7] text-[#b45309] dark:bg-amber-950/40 dark:text-amber-400">
                              Partial Due
                            </span>
                          ) : (
                            <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-[#ffe4e6] text-[#e11d48] dark:bg-rose-950/40 dark:text-rose-400">
                              Due
                            </span>
                          )}
                        </td>

                        <td className="py-3 px-4 whitespace-nowrap">
                          <div
                            className="flex items-center justify-center gap-1.5"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <button
                              type="button"
                              onClick={(e) => handleOpenReceipt(inv, e)}
                              className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold border border-slate-200 dark:border-zinc-750 bg-white hover:bg-slate-50 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-200 transition cursor-pointer"
                              title="View / Print Cash Memo"
                            >
                              <Printer className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                              <span>Memo</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => handleExportCSV(inv)}
                              className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold border border-slate-200 dark:border-zinc-750 bg-slate-50 hover:bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 transition cursor-pointer"
                              title="Export single invoice CSV"
                            >
                              <Download className="w-3 h-3" />
                              <span>CSV</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* Compact Bottom Sheet for Invoice Details */}
      <BottomSheet
        isOpen={Boolean(detailInvoice)}
        onClose={() => setDetailInvoice(null)}
        title={detailInvoice ? `Invoice #${detailInvoice.invoiceNo}` : 'Invoice Details'}
        subtitle={
          detailInvoice
            ? `${formatInvoiceDateTime(detailInvoice.createdAt)} • ${
                detailInvoice.customerName || 'Walk-in Customer'
              }`
            : undefined
        }
        footer={
          detailInvoice ? (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  const inv = detailInvoice;
                  setDetailInvoice(null);
                  handleOpenReceipt(inv);
                }}
                className="flex-1 py-2 px-3 rounded-xl bg-[#0d5c3e] hover:bg-[#094730] text-white font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Receipt / Print</span>
              </button>
              {detailInvoice.customerPhone && (
                <button
                  type="button"
                  onClick={(e) => handleSendWhatsApp(detailInvoice, e)}
                  className="py-2 px-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 font-bold text-xs flex items-center gap-1.5 cursor-pointer"
                >
                  <Share2 className="w-3.5 h-3.5" />
                  <span>WhatsApp</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => handleExportCSV(detailInvoice)}
                className="py-2 px-3 rounded-xl bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 font-bold text-xs flex items-center gap-1 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>CSV</span>
              </button>
            </div>
          ) : undefined
        }
      >
        {detailInvoice && (
          <div className="space-y-3">
            {/* Customer & Channel Row */}
            <div className="grid grid-cols-2 gap-2 p-2.5 rounded-xl bg-slate-50 dark:bg-zinc-800/60">
              <div>
                <div className="text-[10px] text-slate-400">Customer</div>
                <div className="font-bold text-slate-900 dark:text-white truncate">
                  {detailInvoice.customerName || 'Walk-in Customer'}
                </div>
                {detailInvoice.customerPhone && (
                  <div className="text-[11px] font-mono text-slate-500">
                    {detailInvoice.customerPhone}
                  </div>
                )}
              </div>
              <div className="text-right">
                <div className="text-[10px] text-slate-400">Channel & Staff</div>
                <div className="font-bold text-slate-900 dark:text-white uppercase">
                  {detailInvoice.paymentChannel || detailInvoice.paymentMethod || 'cash'}
                </div>
                {detailInvoice.salesmanName && (
                  <div className="text-[11px] text-slate-500 truncate">
                    By {detailInvoice.salesmanName}
                  </div>
                )}
              </div>
            </div>

            {/* Ordered Items */}
            <div>
              <div className="text-[11px] font-bold text-slate-500 dark:text-zinc-400 mb-1.5">
                Items ({detailInvoice.items.length})
              </div>
              <div className="divide-y divide-slate-100 dark:divide-zinc-800 border border-slate-100 dark:border-zinc-800 rounded-xl overflow-hidden">
                {detailInvoice.items.map((it, idx) => (
                  <div key={idx} className="px-3 py-2 flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-semibold text-slate-900 dark:text-white truncate">
                        {it.title}
                      </div>
                      <div className="text-[10px] text-slate-500">
                        {it.size ? `Size: ${it.size} • ` : ''}
                        {it.quantity} × ৳{it.rate}
                      </div>
                    </div>
                    <div className="font-mono font-bold text-slate-900 dark:text-white shrink-0">
                      ৳{it.subtotal.toLocaleString()}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Financial Summary */}
            <div className="space-y-1 pt-1 border-t border-slate-100 dark:border-zinc-800">
              <div className="flex justify-between">
                <span className="text-slate-500">Total Bill</span>
                <span className="font-mono font-bold text-slate-900 dark:text-white">
                  ৳{detailInvoice.total.toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Paid Amount</span>
                <span className="font-mono font-bold text-emerald-700 dark:text-emerald-400">
                  ৳
                  {(
                    detailInvoice.paidAmount ??
                    detailInvoice.advancePaid ??
                    detailInvoice.total - (detailInvoice.dueAmount || 0)
                  ).toLocaleString()}
                </span>
              </div>
              {(detailInvoice.dueAmount || 0) > 0 && (
                <div className="flex justify-between text-rose-600 dark:text-rose-400 font-bold">
                  <span>Receivable Due</span>
                  <span className="font-mono">
                    ৳{(detailInvoice.dueAmount || 0).toLocaleString()}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}
      </BottomSheet>

      {/* Cash Memo & Thermal Receipt Modal */}
      {selectedInvoice && (
        <ReceiptModal
          invoice={selectedInvoice}
          isOpen={isReceiptModalOpen}
          onClose={() => {
            setIsReceiptModalOpen(false);
            setSelectedInvoice(null);
          }}
        />
      )}
    </div>
  );
};
