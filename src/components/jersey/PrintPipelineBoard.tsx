import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Invoice, OrderLineItem, PrintStatus, DrawerType } from '../../types';
import { dbService } from '../../services/db';
import {
  Flame,
  Printer,
  Clock,
  CheckCircle,
  Truck,
  ArrowRight,
  DollarSign,
  Phone,
  MessageSquare,
  Search,
  Filter,
  Eye,
  FileText,
  X,
  Copy,
  Check,
  Calendar,
  Layers,
  Share2,
  RefreshCw,
  Send,
  Award,
  Sparkles,
  ChevronRight,
  AlertCircle,
  Tag,
  Scissors,
} from 'lucide-react';
import { OnlyFontOrderSection } from './OnlyFontOrderSection';
import { matchesDtfSearch } from '../../utils/posOperations';

export const PrintPipelineBoard: React.FC = () => {
  const { currentTenant, showToast } = useApp();
  const [invoices, setInvoices] = useState<Invoice[]>(() => dbService.getInvoices(currentTenant.id));
  
  // Navigation: Pipeline Board vs DTF Hub Orders vs Only Font Orders
  const [activeView, setActiveView] = useState<'pipeline' | 'dtf_manifest' | 'only_font_orders'>('pipeline');
  
  // Search & Filtering
  const [searchQuery, setSearchQuery] = useState('');
  const [pipelineStatusFilter, setPipelineStatusFilter] = useState<'all' | PrintStatus>('all');
  
  // DTF Batch Manifest Filter States
  const [datePreset, setDatePreset] = useState<'today' | 'yesterday' | 'last3days' | 'custom'>('custom');
  const [startDate, setStartDate] = useState<string>('2026-10-08');
  const [endDate, setEndDate] = useState<string>(() => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  });
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'copied'>('all');
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  
  // Modals & Slips
  const [dueCollectInvoice, setDueCollectInvoice] = useState<Invoice | null>(null);
  const [collectAmount, setCollectAmount] = useState<number>(0);
  const [collectDrawer, setCollectDrawer] = useState<DrawerType>('cash');
  const [jobSheetInvoice, setJobSheetInvoice] = useState<Invoice | null>(null);
  const [rawManifestOpen, setRawManifestOpen] = useState(false);
  const [dtfHubPhone, setDtfHubPhone] = useState('01711000000');
  const [copiedItemId, setCopiedItemId] = useState<string | null>(null);

  const reload = () => {
    setInvoices(dbService.getInvoices(currentTenant.id));
  };

  // Helper: Format item into clean DTF print string
  // User format specification: 'argintina 2006 home white shawon 19'
  const formatDtfPrintLine = (item: OrderLineItem, includeSize: boolean = false): string => {
    const cust = item.customization;
    if (!cust) return '';

    // Strip generic filler words like "Kit", "Jersey", "Replica"
    let cleanTitle = item.title
      .replace(/\b(Jersey|Kit|Shirt|Replica|Player Issue|Fan Issue)\b/gi, '')
      .trim();

    // Check if fontStyle contains extra useful style info not already in cleanTitle
    let stylePart = cust.fontStyle || '';
    if (cleanTitle.toLowerCase().includes(stylePart.toLowerCase())) {
      stylePart = '';
    } else {
      stylePart = stylePart.replace(/\b(Font|Official|Cut)\b/gi, '').trim();
    }

    const name = cust.customName.toLowerCase().trim();
    const num = cust.customNumber.trim();

    let line = `${cleanTitle} ${stylePart} ${name} ${num}`
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .trim();

    if (includeSize) {
      line += ` [size: ${cust.size}]`;
      if (cust.patches && cust.patches !== 'None') {
        line += ` [patch: ${cust.patches}]`;
      }
    }

    return line;
  };

  // Extract all customized items across all invoices with invoice context
  interface CustomOrderEntry {
    uniqueKey: string;
    invoice: Invoice;
    item: OrderLineItem;
    lineFormatted: string;
    lineFormattedWithSize: string;
    copyCount: number;
    dtfOrdered: boolean;
    createdAt: string;
  }

  const allCustomEntries: CustomOrderEntry[] = invoices.flatMap((inv) => {
    return inv.items
      .filter((item) => item.customization)
      .map((item, idx) => {
        const copyCount = item.customization?.copyCount || 0;
        const dtfOrdered = item.customization?.dtfOrdered || copyCount > 0;
        return {
          uniqueKey: `${inv.id}_item_${item.id || idx}`,
          invoice: inv,
          item,
          lineFormatted: formatDtfPrintLine(item, false),
          lineFormattedWithSize: formatDtfPrintLine(item, true),
          copyCount,
          dtfOrdered,
          createdAt: inv.createdAt,
        };
      });
  });

  // Filter custom items based on Date Range, Status, and Search query
  const filteredCustomEntries = allCustomEntries.filter((entry) => {
    const entryDate = entry.createdAt.split('T')[0];

    // 1. Date Filter
    if (datePreset === 'today') {
      const todayStr = new Date().toISOString().split('T')[0];
      if (entryDate !== todayStr) return false;
    } else if (datePreset === 'yesterday') {
      const d = new Date();
      d.setDate(d.getDate() - 1);
      const yestStr = d.toISOString().split('T')[0];
      if (entryDate !== yestStr) return false;
    } else if (datePreset === 'last3days') {
      const d = new Date();
      d.setDate(d.getDate() - 3);
      const threeDaysAgoStr = d.toISOString().split('T')[0];
      if (entryDate < threeDaysAgoStr) return false;
    } else if (datePreset === 'custom') {
      if (startDate && entryDate < startDate) return false;
      if (endDate && entryDate > endDate) return false;
    }

    // 2. Status Filter
    if (statusFilter === 'pending' && entry.copyCount > 0) return false;
    if (statusFilter === 'copied' && entry.copyCount === 0) return false;

    // 3. Search query
    if (searchQuery.trim()) {
      const match = matchesDtfSearch(
        {
          lineFormatted: entry.lineFormatted,
          customName: entry.item.customization?.customName,
          customNumber: entry.item.customization?.customNumber,
          invoiceNo: entry.invoice.invoiceNo,
          customerName: entry.invoice.customerName,
          customerPhone: entry.invoice.customerPhone,
          size: entry.item.customization?.size || entry.item.size,
        },
        searchQuery
      );
      if (!match) return false;
    }

    return true;
  });

  // DTF Copy Single Item handler
  const handleCopySingleItem = async (entry: CustomOrderEntry) => {
    try {
      await navigator.clipboard.writeText(entry.lineFormatted);
      setCopiedItemId(entry.uniqueKey);
      setTimeout(() => setCopiedItemId(null), 2000);

      // Increment copy count and save to database
      const inv = invoices.find((i) => i.id === entry.invoice.id);
      if (inv) {
        const updatedItems = inv.items.map((i) => {
          if (i.id === entry.item.id || (i.customization && i.customization.customName === entry.item.customization?.customName)) {
            const currentCount = i.customization?.copyCount || 0;
            return {
              ...i,
              customization: {
                ...i.customization!,
                copyCount: currentCount + 1,
                dtfOrdered: true,
                dtfOrderedAt: new Date().toISOString(),
              },
            };
          }
          return i;
        });

        dbService.updateInvoice(currentTenant.id, inv.id, { items: updatedItems });
        reload();
        showToast(`কপি সম্পন্ন! "${entry.lineFormatted}" (Copy ${(entry.copyCount || 0) + 1})`, 'success');
      }
    } catch {
      showToast('Clipboard copy failed. Please select text manually.', 'error');
    }
  };

  // Reset copy count for an item
  const handleResetCopyCount = (entry: CustomOrderEntry) => {
    const inv = invoices.find((i) => i.id === entry.invoice.id);
    if (inv) {
      const updatedItems = inv.items.map((i) => {
        if (i.id === entry.item.id) {
          return {
            ...i,
            customization: {
              ...i.customization!,
              copyCount: 0,
              dtfOrdered: false,
            },
          };
        }
        return i;
      });

      dbService.updateInvoice(currentTenant.id, inv.id, { items: updatedItems });
      reload();
      showToast('Copy status reset to 0.', 'info');
    }
  };

  // DTF Bulk Copy All Filtered Items handler
  const handleBulkCopyFiltered = async (selectedOnly: boolean = false) => {
    const targets = selectedOnly && selectedItems.size > 0
      ? filteredCustomEntries.filter((e) => selectedItems.has(e.uniqueKey))
      : filteredCustomEntries;

    if (targets.length === 0) {
      showToast('No jersey items available to copy.', 'error');
      return;
    }

    const lines = targets.map((t) => t.lineFormatted).join('\n');

    try {
      await navigator.clipboard.writeText(lines);

      // Increment copy count for all copied targets
      const invoiceMap = new Map<string, Invoice>();
      invoices.forEach((inv) => invoiceMap.set(inv.id, { ...inv, items: [...inv.items] }));

      targets.forEach((target) => {
        const inv = invoiceMap.get(target.invoice.id);
        if (inv) {
          inv.items = inv.items.map((i) => {
            if (i.id === target.item.id || (i.customization && i.customization.customName === target.item.customization?.customName)) {
              const current = i.customization?.copyCount || 0;
              return {
                ...i,
                customization: {
                  ...i.customization!,
                  copyCount: current + 1,
                  dtfOrdered: true,
                  dtfOrderedAt: new Date().toISOString(),
                },
              };
            }
            return i;
          });
        }
      });

      // Commit changes to dbService
      invoiceMap.forEach((inv) => {
        dbService.updateInvoice(currentTenant.id, inv.id, { items: inv.items });
      });

      reload();
      showToast(`কপি সফল! ${targets.length}টি জার্সি ডিটিএফ হাবে অর্ডারের জন্য কপি করা হয়েছে এবং 'Copy 1' মার্ক হয়েছে।`, 'success');
    } catch {
      showToast('Clipboard access error. Open Raw Manifest to copy manually.', 'error');
    }
  };

  // Send WhatsApp to DTF Print Hub
  const handleSendWhatsAppToDtfHub = () => {
    if (filteredCustomEntries.length === 0) {
      showToast('No custom jersey items in current filter.', 'error');
      return;
    }

    const cleanPhone = dtfHubPhone.replace(/[^0-9]/g, '');
    const phoneWithCountry = cleanPhone.startsWith('88') ? cleanPhone : `88${cleanPhone}`;

    const itemsText = filteredCustomEntries
      .map((entry, idx) => `${idx + 1}. ${entry.lineFormatted} [${entry.item.customization?.size}]`)
      .join('\n');

    const message = encodeURIComponent(
      `*DTF PRINT ORDER BATCH*\n` +
      `Shop: ${currentTenant.name}\n` +
      `Date Range: ${startDate} to ${endDate}\n` +
      `Total Jerseys: ${filteredCustomEntries.length} pcs\n\n` +
      `*PRINT LIST:*\n${itemsText}\n\n` +
      `Please confirm receipt and start printing. Thank you!`
    );

    window.open(`https://wa.me/${phoneWithCountry}?text=${message}`, '_blank');
  };

  // 4-Stage Kanban Pipeline Invoices Filtering
  const customInvoices = invoices.filter((inv) =>
    inv.items.some((item) => item.customization)
  );

  const filteredPipelineInvoices = customInvoices.filter((inv) => {
    const q = searchQuery.toLowerCase();
    const matchesSearch =
      inv.invoiceNo.toLowerCase().includes(q) ||
      inv.customerName.toLowerCase().includes(q) ||
      inv.customerPhone.includes(q) ||
      inv.items.some(
        (i) =>
          i.customization?.customName.toLowerCase().includes(q) ||
          i.customization?.customNumber.includes(q) ||
          i.customization?.fontStyle.toLowerCase().includes(q)
      );
    return matchesSearch;
  });

  const getInvoicesByStatus = (status: PrintStatus) => {
    return filteredPipelineInvoices.filter((inv) =>
      inv.items.some((i) => i.customization?.printStatus === status)
    );
  };

  const handleAdvanceStatus = (invoice: Invoice, nextStatus: PrintStatus) => {
    const updatedItems = invoice.items.map((item) => {
      if (item.customization) {
        return {
          ...item,
          customization: {
            ...item.customization,
            printStatus: nextStatus,
          },
        };
      }
      return item;
    });

    dbService.updateInvoice(currentTenant.id, invoice.id, { items: updatedItems });
    reload();
    showToast(`Print stage updated to "${nextStatus.replace('_', ' ').toUpperCase()}"`, 'success');
  };

  const handleOpenDueCollect = (inv: Invoice) => {
    setDueCollectInvoice(inv);
    setCollectAmount(inv.dueAmount);
    setCollectDrawer('cash');
  };

  const submitDueCollection = () => {
    if (!dueCollectInvoice) return;
    if (collectAmount <= 0) {
      showToast('Enter valid collection amount', 'error');
      return;
    }
    dbService.collectDue(currentTenant.id, dueCollectInvoice.id, collectAmount, collectDrawer);
    reload();
    setDueCollectInvoice(null);
    showToast(`৳${collectAmount} due recovered into ${collectDrawer}!`, 'success');
  };

  const sendWhatsAppNotification = (inv: Invoice) => {
    const customItem = inv.items.find((i) => i.customization);
    const cName = customItem?.customization?.customName || '';
    const cNum = customItem?.customization?.customNumber || '';
    const phone = inv.customerPhone.replace(/[^0-9]/g, '');
    const cleanPhone = phone.startsWith('88') ? phone : `88${phone}`;

    const text = encodeURIComponent(
      `Assalamu Alaikum ${inv.customerName},\n\nYour customized jersey [${cName} #${cNum}] is READY FOR PICKUP at ${currentTenant.name}!\n\nMemo: #${inv.invoiceNo}\nRemaining Due: ৳${inv.dueAmount}\nLocation: ${currentTenant.marketMallName}, ${currentTenant.shopNo}.\n\nThank you for shopping with us!`
    );
    window.open(`https://wa.me/${cleanPhone}?text=${text}`, '_blank');
  };

  const stages: { key: PrintStatus; label: string; icon: any; color: string }[] = [
    { key: 'order_taken', label: '1. Order Taken', icon: Clock, color: 'border-blue-500/40 text-blue-400 bg-blue-500/10' },
    { key: 'in_press', label: '2. In Printing Press', icon: Flame, color: 'border-amber-500/40 text-amber-400 bg-amber-500/10' },
    { key: 'ready_for_pickup', label: '3. Ready for Pickup', icon: CheckCircle, color: 'border-emerald-500/40 text-emerald-400 bg-emerald-500/10' },
    { key: 'delivered', label: '4. Delivered to Client', icon: Truck, color: 'border-purple-500/40 text-purple-400 bg-purple-500/10' },
  ];

  // Stats for DTF section
  const totalCustomCount = filteredCustomEntries.length;
  const copiedCount = filteredCustomEntries.filter((e) => e.copyCount > 0).length;
  const pendingCopyCount = filteredCustomEntries.filter((e) => e.copyCount === 0).length;
  const totalExtraCharges = filteredCustomEntries.reduce(
    (acc, e) => acc + (e.item.customization?.extraCharge || 0),
    0
  );

  return (
    <div className="space-y-4 max-w-4xl mx-auto pb-20 lg:pb-6">
      {/* Top Header (Matches Demo Images 2, 3, 4) */}
      <div>
        <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">
          Jersey print center
        </h2>
        <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1">
          Heat-press orders ar DTF font list ek jaygay manage korun.
        </p>
      </div>

      {/* Segmented Pill Tabs (Matches Demo Images 2, 3, 4) */}
      <div className="bg-[#e6ebe6] dark:bg-zinc-800 p-1 rounded-2xl grid grid-cols-3 gap-1">
        <button
          type="button"
          onClick={() => setActiveView('pipeline')}
          className={`py-2 rounded-xl text-xs sm:text-sm font-semibold transition text-center cursor-pointer ${
            activeView === 'pipeline'
              ? 'bg-white dark:bg-zinc-900 text-slate-900 dark:text-white shadow-2xs font-bold'
              : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900'
          }`}
        >
          Pipeline
        </button>
        <button
          type="button"
          onClick={() => setActiveView('dtf_manifest')}
          className={`py-2 rounded-xl text-xs sm:text-sm font-semibold transition text-center cursor-pointer ${
            activeView === 'dtf_manifest'
              ? 'bg-white dark:bg-zinc-900 text-slate-900 dark:text-white shadow-2xs font-bold'
              : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900'
          }`}
        >
          DTF hub
        </button>
        <button
          type="button"
          onClick={() => setActiveView('only_font_orders')}
          className={`py-2 rounded-xl text-xs sm:text-sm font-semibold transition text-center cursor-pointer ${
            activeView === 'only_font_orders'
              ? 'bg-white dark:bg-zinc-900 text-slate-900 dark:text-white shadow-2xs font-bold'
              : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900'
          }`}
        >
          Font only
        </button>
      </div>

      {/* ========================================================================= */}
      {/* VIEW 1: DTF PRINT HUB BATCH ORDERS (Matches Demo Image 3)                 */}
      {/* ========================================================================= */}
      {activeView === 'dtf_manifest' && (
        <div className="space-y-4 animate-in fade-in duration-150">
          {/* Top 3 Stat Cards (Matches Demo Image 3) */}
          <div className="grid grid-cols-3 gap-2.5">
            <div className="bg-white dark:bg-zinc-900 border border-slate-200/90 dark:border-zinc-800 rounded-3xl p-3.5 sm:p-4 shadow-2xs">
              <span className="text-xs text-slate-500 dark:text-zinc-400 font-medium block">
                Filtered
              </span>
              <span className="text-base sm:text-xl font-extrabold text-slate-900 dark:text-white mt-0.5 block">
                {totalCustomCount} pcs
              </span>
            </div>
            <div className="bg-white dark:bg-zinc-900 border border-slate-200/90 dark:border-zinc-800 rounded-3xl p-3.5 sm:p-4 shadow-2xs">
              <span className="text-xs text-slate-500 dark:text-zinc-400 font-medium block">
                Copied
              </span>
              <span className="text-base sm:text-xl font-extrabold text-slate-900 dark:text-white mt-0.5 block">
                {copiedCount} pcs
              </span>
            </div>
            <div className="bg-white dark:bg-zinc-900 border border-slate-200/90 dark:border-zinc-800 rounded-3xl p-3.5 sm:p-4 shadow-2xs">
              <span className="text-xs text-slate-500 dark:text-zinc-400 font-medium block">
                Pending
              </span>
              <span className="text-base sm:text-xl font-extrabold text-slate-900 dark:text-white mt-0.5 block">
                {pendingCopyCount} pcs
              </span>
            </div>
          </div>

          {/* Date Filter Chips (Aj, Gotokal, Last 3 days, Custom) */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
            {[
              { key: 'today', label: 'Aj' },
              { key: 'yesterday', label: 'Gotokal' },
              { key: 'last3days', label: 'Last 3 days' },
              { key: 'custom', label: 'Custom' },
            ].map((preset) => (
              <button
                key={preset.key}
                type="button"
                onClick={() => setDatePreset(preset.key as any)}
                className={`px-4 py-1.5 rounded-full text-xs font-semibold shrink-0 cursor-pointer transition ${
                  datePreset === preset.key
                    ? 'bg-[#284f3e] text-white shadow-xs'
                    : 'bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-slate-700 dark:text-zinc-300 hover:bg-slate-50'
                }`}
              >
                {preset.label}
              </button>
            ))}
          </div>

          {/* Custom Date Pickers */}
          {datePreset === 'custom' && (
            <div className="flex items-center gap-2 bg-white dark:bg-zinc-900 p-2.5 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-2xs">
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="flex-1 bg-transparent text-xs font-semibold text-slate-800 dark:text-zinc-200 px-2 py-1 outline-none"
              />
              <span className="text-slate-400">→</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="flex-1 bg-transparent text-xs font-semibold text-slate-800 dark:text-zinc-200 px-2 py-1 outline-none"
              />
            </div>
          )}

          {/* DTF Hub Search Bar & Status Filter Pills */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-2.5">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="DTF hub-এ নাম, নম্বর, টিম, সাইজ বা মেমো দিয়ে খুঁজুন..."
                className="w-full bg-white dark:bg-zinc-900 border border-slate-200/90 dark:border-zinc-800 rounded-2xl pl-10 pr-9 py-2.5 text-xs sm:text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-[#284f3e] shadow-2xs"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 dark:hover:text-white cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              {(
                [
                  { key: 'all', label: 'All' },
                  { key: 'pending', label: 'Pending' },
                  { key: 'copied', label: 'Copied' },
                ] as const
              ).map((st) => (
                <button
                  key={st.key}
                  type="button"
                  onClick={() => setStatusFilter(st.key)}
                  className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition cursor-pointer ${
                    statusFilter === st.key
                      ? 'bg-[#284f3e] text-white shadow-2xs'
                      : 'bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-slate-600 dark:text-zinc-300 hover:bg-slate-50'
                  }`}
                >
                  {st.label}
                </button>
              ))}
            </div>
          </div>

          {/* List of Orders in DTF Hub Format (Matches Demo Image 3) */}
          <div className="space-y-3">
            {filteredCustomEntries.length === 0 ? (
              <div className="py-12 text-center text-slate-400 bg-white dark:bg-zinc-900 rounded-3xl border border-slate-200/80 dark:border-zinc-800 p-6">
                <p className="text-xs">কোনো কাস্টমাইজড জার্সির রেকর্ড পাওয়া যায়নি</p>
              </div>
            ) : (
              filteredCustomEntries.map((entry) => {
                const isCopied = entry.copyCount > 0;

                return (
                  <div
                    key={entry.uniqueKey}
                    className="bg-white dark:bg-zinc-900 border border-slate-200/90 dark:border-zinc-800 rounded-3xl p-4 sm:p-5 space-y-2.5 shadow-2xs"
                  >
                    {/* Top Row: Memo & Customer + Status Badge */}
                    <div className="flex items-center justify-between">
                      <div className="text-xs sm:text-sm font-bold text-slate-700 dark:text-zinc-200">
                        #{entry.invoice.invoiceNo} · {entry.invoice.customerName}
                      </div>

                      <span
                        className={`text-xs font-semibold px-2.5 py-0.5 rounded-lg ${
                          isCopied
                            ? 'bg-[#e8f2ec] text-[#285e43]'
                            : 'bg-[#fcf3ea] text-[#9a5b1f]'
                        }`}
                      >
                        {isCopied ? 'Copied' : 'Pending'}
                      </span>
                    </div>

                    {/* Light Green Mono Format Box (Matches Demo Image 3) */}
                    <div className="bg-[#e2ede5] dark:bg-emerald-950/40 rounded-2xl p-3 font-mono text-xs sm:text-sm text-slate-900 dark:text-zinc-100 font-bold select-all">
                      {entry.lineFormatted}
                    </div>

                    {/* Bottom: Size & Copy Action Button */}
                    <div className="flex items-center justify-between text-xs pt-0.5">
                      <span className="text-slate-600 dark:text-zinc-400 font-medium">
                        Size {entry.item.customization?.size || entry.item.size}
                      </span>

                      <button
                        type="button"
                        onClick={() => handleCopySingleItem(entry)}
                        className="bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-slate-700 dark:text-zinc-200 rounded-xl px-4 py-1.5 text-xs font-semibold hover:bg-slate-50 transition cursor-pointer"
                      >
                        {isCopied ? 'Copy again' : 'Copy'}
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Copy All Pending Button (Matches Demo Image 3) */}
          {pendingCopyCount > 0 && (
            <div className="sticky bottom-4 z-20 pt-2">
              <button
                type="button"
                onClick={() => handleBulkCopyFiltered(false)}
                className="w-full bg-[#284f3e] hover:bg-[#1f3f31] text-white py-3.5 rounded-2xl font-bold text-sm shadow-lg transition cursor-pointer flex items-center justify-center gap-2"
              >
                <Copy className="w-4 h-4" />
                <span>Copy all pending ({pendingCopyCount})</span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* VIEW 3: ONLY FONT ORDERS (User Requested Feature)                         */}
      {/* ========================================================================= */}
      {activeView === 'only_font_orders' && <OnlyFontOrderSection />}

      {/* ========================================================================= */}
      {/* VIEW 2: 4-STAGE PIPELINE (Matches Demo Image 4)                           */}
      {/* ========================================================================= */}
      {activeView === 'pipeline' && (
        <div className="space-y-4 animate-in fade-in duration-150">
          {/* Status Filter Pills Row (Matches Demo Image 4) */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
            <button
              type="button"
              onClick={() => setPipelineStatusFilter('all')}
              className={`px-4 py-1.5 rounded-full text-xs font-semibold shrink-0 cursor-pointer transition ${
                pipelineStatusFilter === 'all'
                  ? 'bg-[#284f3e] text-white shadow-xs'
                  : 'bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-slate-700 dark:text-zinc-300 hover:bg-slate-50'
              }`}
            >
              All {filteredPipelineInvoices.length}
            </button>
            <button
              type="button"
              onClick={() => setPipelineStatusFilter('order_taken')}
              className={`px-4 py-1.5 rounded-full text-xs font-semibold shrink-0 cursor-pointer transition ${
                pipelineStatusFilter === 'order_taken'
                  ? 'bg-[#284f3e] text-white shadow-xs'
                  : 'bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-slate-700 dark:text-zinc-300 hover:bg-slate-50'
              }`}
            >
              Order taken {filteredPipelineInvoices.filter((i) => i.items.some((item) => item.customization?.printStatus === 'order_taken')).length}
            </button>
            <button
              type="button"
              onClick={() => setPipelineStatusFilter('in_press')}
              className={`px-4 py-1.5 rounded-full text-xs font-semibold shrink-0 cursor-pointer transition ${
                pipelineStatusFilter === 'in_press'
                  ? 'bg-[#284f3e] text-white shadow-xs'
                  : 'bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-slate-700 dark:text-zinc-300 hover:bg-slate-50'
              }`}
            >
              In printing {filteredPipelineInvoices.filter((i) => i.items.some((item) => item.customization?.printStatus === 'in_press')).length}
            </button>
            <button
              type="button"
              onClick={() => setPipelineStatusFilter('ready_for_pickup')}
              className={`px-4 py-1.5 rounded-full text-xs font-semibold shrink-0 cursor-pointer transition ${
                pipelineStatusFilter === 'ready_for_pickup'
                  ? 'bg-[#284f3e] text-white shadow-xs'
                  : 'bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-slate-700 dark:text-zinc-300 hover:bg-slate-50'
              }`}
            >
              Ready for pickup {filteredPipelineInvoices.filter((i) => i.items.some((item) => item.customization?.printStatus === 'ready_for_pickup')).length}
            </button>
            <button
              type="button"
              onClick={() => setPipelineStatusFilter('delivered')}
              className={`px-4 py-1.5 rounded-full text-xs font-semibold shrink-0 cursor-pointer transition ${
                pipelineStatusFilter === 'delivered'
                  ? 'bg-[#284f3e] text-white shadow-xs'
                  : 'bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-slate-700 dark:text-zinc-300 hover:bg-slate-50'
              }`}
            >
              Delivered {filteredPipelineInvoices.filter((i) => i.items.some((item) => item.customization?.printStatus === 'delivered')).length}
            </button>
          </div>

          {/* Search Bar (Matches Demo Image 4) */}
          <div className="relative">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Memo, player, phone khujun"
              className="w-full bg-white dark:bg-zinc-900 border border-slate-200/90 dark:border-zinc-800 rounded-2xl px-4 py-3 text-xs sm:text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-[#284f3e] shadow-2xs"
            />
          </div>

          {/* Orders Cards List (Matches Demo Image 4) */}
          <div className="space-y-3.5">
            {filteredPipelineInvoices
              .filter((inv) => {
                if (pipelineStatusFilter === 'all') return true;
                return inv.items.some((i) => i.customization?.printStatus === pipelineStatusFilter);
              })
              .map((inv) => {
                const customItem = inv.items.find((i) => i.customization);
                const cust = customItem?.customization;
                if (!cust) return null;
                const currentStatus = cust.printStatus || 'order_taken';

                return (
                  <div
                    key={inv.id}
                    className="bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 rounded-3xl p-4 sm:p-5 space-y-3 shadow-2xs transition"
                  >
                    {/* Top Row: Memo No & Total / Payment status */}
                    <div className="flex items-start justify-between">
                      <div>
                        <span className="font-extrabold text-sm sm:text-base text-slate-900 dark:text-white">
                          #{inv.invoiceNo}
                        </span>
                        <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
                          {inv.customerName} · {inv.customerPhone}
                        </p>
                      </div>

                      <div className="text-right">
                        <div className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-white">
                          ৳{inv.total}
                        </div>
                        <span
                          className={`inline-block mt-0.5 text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            inv.dueAmount === 0
                              ? 'bg-[#e8f2ec] text-[#285e43]'
                              : 'bg-[#fef3e7] text-[#b3631f]'
                          }`}
                        >
                          {inv.dueAmount === 0 ? 'Full paid' : `Advance ৳${inv.advancePaid}`}
                        </span>
                      </div>
                    </div>

                    {/* Middle Section: Player Name & Large Number */}
                    <div className="border-t border-dashed border-slate-200/80 dark:border-zinc-800 pt-3 flex items-start justify-between gap-3">
                      <div className="space-y-1">
                        <h3 className="text-base sm:text-lg font-black tracking-wide text-slate-900 dark:text-white uppercase">
                          {cust.customName}
                        </h3>
                        <div className="text-xs text-slate-600 dark:text-zinc-400 flex flex-wrap items-center gap-1.5">
                          <span>Size <strong>{cust.size || customItem.size}</strong></span>
                          <span>·</span>
                          <span>Kit <strong>{customItem.title.replace(/\b(Jersey|Shirt)\b/gi, '').trim()}</strong></span>
                          <span>·</span>
                          <span>Patch <strong>{cust.patches || 'Kono patch nei'}</strong></span>
                        </div>
                        {cust.fontStyle && (
                          <p className="text-xs italic text-slate-400 dark:text-zinc-500">
                            {cust.fontStyle}
                          </p>
                        )}
                      </div>

                      <div className="text-2xl sm:text-3xl font-black text-[#284f3e] dark:text-emerald-400 shrink-0 font-mono">
                        #{cust.customNumber}
                      </div>
                    </div>

                    {/* Bottom Action Buttons (Job slip, WhatsApp, Stage Advance) */}
                    <div className="flex items-center justify-between pt-1 gap-2">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setJobSheetInvoice(inv)}
                          className="bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-slate-700 dark:text-zinc-200 rounded-xl px-3.5 py-1.5 text-xs font-semibold cursor-pointer hover:bg-slate-50 transition"
                        >
                          Job slip
                        </button>
                        <button
                          type="button"
                          onClick={() => sendWhatsAppNotification(inv)}
                          className="bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-slate-700 dark:text-zinc-200 rounded-xl px-3.5 py-1.5 text-xs font-semibold cursor-pointer hover:bg-slate-50 transition"
                        >
                          WhatsApp
                        </button>
                      </div>

                      {/* Advance Button (Deep Pine Green) */}
                      {currentStatus === 'order_taken' && (
                        <button
                          type="button"
                          onClick={() => handleAdvanceStatus(inv, 'in_press')}
                          className="bg-[#284f3e] hover:bg-[#1f3f31] text-white rounded-xl px-4 py-2 text-xs font-bold transition shadow-xs cursor-pointer"
                        >
                          To press
                        </button>
                      )}
                      {currentStatus === 'in_press' && (
                        <button
                          type="button"
                          onClick={() => handleAdvanceStatus(inv, 'ready_for_pickup')}
                          className="bg-[#284f3e] hover:bg-[#1f3f31] text-white rounded-xl px-4 py-2 text-xs font-bold transition shadow-xs cursor-pointer"
                        >
                          Mark ready
                        </button>
                      )}
                      {currentStatus === 'ready_for_pickup' && (
                        <button
                          type="button"
                          onClick={() => handleAdvanceStatus(inv, 'delivered')}
                          className="bg-[#284f3e] hover:bg-[#1f3f31] text-white rounded-xl px-4 py-2 text-xs font-bold transition shadow-xs cursor-pointer"
                        >
                          Deliver
                        </button>
                      )}
                      {currentStatus === 'delivered' && (
                        <span className="text-[11px] font-bold text-[#285e43] bg-[#e8f2ec] px-3 py-1.5 rounded-xl">
                          Delivered ✓
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 1: RAW TEXT MANIFEST FOR DTF HUB                                     */}
      {/* ========================================================================= */}
      {rawManifestOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 dark:bg-black/75 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white dark:bg-zinc-900 border border-slate-200/90 dark:border-zinc-800 rounded-3xl max-w-xl w-full p-5 sm:p-6 text-slate-900 dark:text-zinc-100 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-zinc-800">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-[#1f8a5b] dark:text-emerald-400" />
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  DTF Print Hub Plain Text Manifest
                </h3>
              </div>
              <button
                onClick={() => setRawManifestOpen(false)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-zinc-800 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-500 dark:text-zinc-400">
              Select or copy this exact plain-text list to send via WhatsApp, email, or print shop software:
            </p>

            <textarea
              readOnly
              value={filteredCustomEntries.map((e) => e.lineFormatted).join('\n')}
              rows={10}
              className="w-full bg-[#f4f7f5] dark:bg-zinc-950 border border-slate-200/80 dark:border-zinc-800 rounded-2xl p-3 text-xs font-mono text-[#164e3f] dark:text-emerald-300 leading-relaxed focus:outline-none"
              onClick={(e) => (e.target as HTMLTextAreaElement).select()}
            />

            <div className="flex items-center justify-between pt-2">
              <span className="text-xs text-slate-500 dark:text-zinc-400">
                Total lines: {filteredCustomEntries.length}
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setRawManifestOpen(false)}
                  className="px-4 py-2 rounded-2xl border border-slate-200/90 dark:border-zinc-750 text-xs font-semibold text-slate-600 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800 cursor-pointer"
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={() => handleBulkCopyFiltered(false)}
                  className="px-5 py-2 rounded-2xl bg-[#164e3f] hover:bg-[#123e32] text-white text-xs font-bold flex items-center gap-2 cursor-pointer shadow-xs"
                >
                  <Copy className="w-4 h-4" />
                  Copy Plain List
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: COLLECT PICKUP DUE BALANCE                                       */}
      {/* ========================================================================= */}
      {dueCollectInvoice && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 dark:bg-black/75 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white dark:bg-zinc-900 border border-slate-200/90 dark:border-zinc-800 rounded-3xl max-w-sm w-full p-6 text-slate-900 dark:text-zinc-100 shadow-2xl">
            <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2 mb-1">
              <DollarSign className="w-5 h-5 text-[#1f8a5b] dark:text-emerald-400" />
              Collect Delivery Due Balance
            </h3>
            <p className="text-xs text-slate-500 dark:text-zinc-400 mb-4">
              Invoice #{dueCollectInvoice.invoiceNo} • {dueCollectInvoice.customerName}
            </p>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-zinc-300 mb-1">
                  Collection Amount (৳)
                </label>
                <input
                  type="number"
                  value={collectAmount}
                  onChange={(e) => setCollectAmount(Number(e.target.value))}
                  className="w-full bg-[#f4f7f5] dark:bg-zinc-950 border border-slate-200/80 dark:border-zinc-800 rounded-2xl px-3.5 py-2.5 text-base font-mono font-bold text-[#1f8a5b] dark:text-emerald-400 focus:outline-none focus:border-[#164e3f]"
                  max={dueCollectInvoice.dueAmount}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-zinc-300 mb-1">
                  Deposit Account / Multi-Drawer
                </label>
                <select
                  value={collectDrawer}
                  onChange={(e) => setCollectDrawer(e.target.value as DrawerType)}
                  className="w-full bg-[#f4f7f5] dark:bg-zinc-950 border border-slate-200/80 dark:border-zinc-800 rounded-2xl px-3.5 py-2.5 text-xs font-semibold text-slate-800 dark:text-zinc-200 focus:outline-none focus:border-[#164e3f] cursor-pointer"
                >
                  <option value="cash">Physical Cash Drawer</option>
                  <option value="merchantBkash">Merchant bKash</option>
                  <option value="personalBkash">Personal bKash</option>
                  <option value="nagad">Nagad</option>
                  <option value="bank">Bank Account</option>
                </select>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setDueCollectInvoice(null)}
                  className="flex-1 py-2.5 rounded-2xl border border-slate-200/90 dark:border-zinc-750 text-xs font-semibold text-slate-600 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-800 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={submitDueCollection}
                  className="flex-1 py-2.5 rounded-2xl bg-[#164e3f] hover:bg-[#123e32] text-white text-xs font-bold transition shadow-xs cursor-pointer"
                >
                  Confirm & Update
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 3: HEAT-PRESS MASTER JOB SLIP FOR OPERATOR                          */}
      {/* ========================================================================= */}
      {jobSheetInvoice && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 dark:bg-black/75 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-150">
          <div className="bg-white dark:bg-zinc-900 border border-slate-200/90 dark:border-zinc-800 rounded-3xl max-w-xl w-full p-6 text-slate-900 dark:text-zinc-100 shadow-2xl relative">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-zinc-800">
              <div className="flex items-center gap-2">
                <Printer className="w-5 h-5 text-[#1f8a5b] dark:text-emerald-400" />
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Heat-Press Master Job Sheet
                </h3>
              </div>
              <button
                onClick={() => setJobSheetInvoice(null)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-zinc-800 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Print Container */}
            <div id="printable-job-sheet" className="p-4 bg-white text-zinc-900 rounded-2xl my-4 space-y-4 border border-slate-200">
              <div className="border-b-2 border-black pb-3 flex justify-between items-start">
                <div>
                  <h1 className="text-xl font-black uppercase tracking-tight">{currentTenant.name}</h1>
                  <p className="text-xs text-zinc-600 font-medium">
                    {currentTenant.marketMallName} • {currentTenant.shopNo} • Ph: {currentTenant.ownerPhone}
                  </p>
                </div>
                <div className="text-right">
                  <div className="text-sm font-black font-mono">JOB #{jobSheetInvoice.invoiceNo}</div>
                  <div className="text-[10px] text-zinc-500">Date: {new Date(jobSheetInvoice.createdAt).toLocaleDateString()}</div>
                </div>
              </div>

              {jobSheetInvoice.items
                .filter((i) => i.customization)
                .map((item, idx) => {
                  const cust = item.customization!;
                  return (
                    <div key={idx} className="border-2 border-black p-4 rounded-lg space-y-3 bg-zinc-50">
                      <div className="flex justify-between items-center border-b border-zinc-300 pb-2">
                        <span className="font-bold text-sm uppercase">{item.title}</span>
                        <span className="text-xs font-mono font-bold bg-black text-white px-2 py-0.5 rounded">
                          SIZE: {cust.size}
                        </span>
                      </div>

                      {/* Visual Text Display for Press Operator */}
                      <div className="text-center py-4 bg-white border border-zinc-300 rounded-lg">
                        <div className="text-2xl font-black tracking-widest uppercase">{cust.customName}</div>
                        <div className="text-6xl font-black font-mono my-1">{cust.customNumber}</div>
                        <div className="text-xs font-semibold text-zinc-600">Font: {cust.fontStyle}</div>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div><strong>Patches:</strong> {cust.patches}</div>
                        <div><strong>DTF Status:</strong> {cust.copyCount && cust.copyCount > 0 ? `Copy ${cust.copyCount} (Ordered)` : 'Pending Order'}</div>
                        <div className="col-span-2"><strong>Operator Notes:</strong> {cust.instructions || 'Standard heat application'}</div>
                      </div>

                      <div className="pt-2 border-t border-zinc-300 flex justify-between text-[11px] text-zinc-600">
                        <div>Customer: {jobSheetInvoice.customerName} ({jobSheetInvoice.customerPhone})</div>
                        <div>Press Operator Sign: _______________</div>
                      </div>
                    </div>
                  );
                })}
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setJobSheetInvoice(null)}
                className="px-4 py-2 rounded-2xl border border-slate-200/90 dark:border-zinc-750 text-xs font-semibold text-slate-600 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800 cursor-pointer"
              >
                Close
              </button>
              <button
                onClick={() => window.print()}
                className="px-5 py-2 rounded-2xl bg-[#164e3f] hover:bg-[#123e32] text-white font-bold text-xs flex items-center gap-1.5 shadow-xs cursor-pointer"
              >
                <Printer className="w-4 h-4" />
                Print Job Sheet
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
