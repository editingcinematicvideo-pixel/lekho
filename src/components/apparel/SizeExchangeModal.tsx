import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import {
  Invoice,
  OrderLineItem,
  SizeExchangeRecord,
  DrawerType,
  InventoryItem,
} from '../../types';
import { dbService } from '../../services/db';
import {
  isClothingShop,
  filterInventoryForShop,
  getDefaultExchangeModeForShop,
} from '../../utils/securityPolicy';
import { InfoTooltip } from '../ui/InfoTooltip';
import {
  ArrowRightLeft,
  Search,
  Check,
  CheckCircle,
  X,
  Phone,
  Sparkles,
  User,
  Clock,
  ArrowLeft,
  FileText,
  Printer,
  Package,
  RefreshCw,
  ArrowRight,
  Wallet,
} from 'lucide-react';

interface SizeExchangeModalProps {
  isOpen?: boolean;
  onClose?: () => void;
  onBack?: () => void;
  onExchangeComplete?: () => void;
  mode?: 'page' | 'modal';
}

export const SizeExchangeModal: React.FC<SizeExchangeModalProps> = ({
  isOpen = true,
  onClose,
  onBack,
  onExchangeComplete,
  mode = 'page',
}) => {
  const { currentTenant, showToast, activeStaff, pickText } = useApp();
  const isClothingStore = isClothingShop(currentTenant);

  // Search states
  const [searchQuery, setSearchQuery] = useState('');
  const [matchedInvoices, setMatchedInvoices] = useState<Invoice[]>([]);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);

  // Return Item State (Item Customer is Returning)
  const [returnItem, setReturnItem] = useState<OrderLineItem | null>(null);

  // Replacement Item State (Clothing defaults to 'inventory', Sportswear defaults to 'jersey')
  const [replacementType, setReplacementType] = useState<'jersey' | 'inventory' | 'custom'>(() =>
    getDefaultExchangeModeForShop(currentTenant)
  );

  // 1. Jersey Entry Mode (Sportswear only)
  const [replJerseyClub, setReplJerseyClub] = useState('Argentina');
  const [replJerseyCategory, setReplJerseyCategory] = useState('Player Issue');
  const [replJerseySize, setReplJerseySize] = useState('L');
  const [replJerseyRate, setReplJerseyRate] = useState<number>(900);

  // 2. Inventory Entry Mode (filtered for shop category)
  const [inventory, setInventory] = useState<InventoryItem[]>(() =>
    filterInventoryForShop(dbService.getInventory(currentTenant.id), currentTenant)
  );
  const [replInventoryProductId, setReplInventoryProductId] = useState<string>('');
  const [replInventorySize, setReplInventorySize] = useState<string>('L');

  // 3. Custom / Other Entry Mode
  const [replCustomTitle, setReplCustomTitle] = useState(() =>
    isClothingStore ? 'Men Casual Cotton Shirt' : 'Argentina 2026 Home White'
  );
  const [replCustomSize, setReplCustomSize] = useState('XL');
  const [replCustomRate, setReplCustomRate] = useState<number>(() => (isClothingStore ? 1250 : 900));

  // Payment Options
  const [channelUsed, setChannelUsed] = useState<DrawerType>('cash');
  const [paymentMode, setPaymentMode] = useState<'paid' | 'partial'>('paid');
  const [advancePaid, setAdvancePaid] = useState<number>(0);
  const [exchangeNote, setExchangeNote] = useState('');

  // Exchange completed slip & history state
  const [completedExchange, setCompletedExchange] = useState<SizeExchangeRecord | null>(null);
  const [exchangeHistory, setExchangeHistory] = useState<SizeExchangeRecord[]>(() =>
    dbService.getSizeExchanges(currentTenant.id)
  );

  // Keep inventory and defaults synced when tenant switches
  useEffect(() => {
    const freshInv = filterInventoryForShop(dbService.getInventory(currentTenant.id), currentTenant);
    setInventory(freshInv);
    if (freshInv[0]) {
      setReplInventoryProductId(freshInv[0].id);
      if (freshInv[0].variants?.[0]?.size) {
        setReplInventorySize(freshInv[0].variants[0].size);
      }
    }
    setReplacementType(getDefaultExchangeModeForShop(currentTenant));
    setReplCustomTitle(
      isClothingShop(currentTenant) ? 'Men Casual Cotton Shirt' : 'Argentina 2026 Home White'
    );
    setReplCustomRate(isClothingShop(currentTenant) ? 1250 : 900);
    setExchangeHistory(dbService.getSizeExchanges(currentTenant.id));
  }, [currentTenant.id, currentTenant.category, currentTenant.shopCategory]);

  if (!isOpen) return null;

  const handleBackAction = () => {
    if (onBack) onBack();
    else if (onClose) onClose();
  };

  const invoices = dbService.getInvoices(currentTenant.id).filter((i) => !i.isSoftDeleted);

  const CLUBS_AND_COUNTRIES = [
    'Real Madrid',
    'Barcelona',
    'Argentina',
    'Brazil',
    'Manchester United',
    'Arsenal',
    'Manchester City',
    'Chelsea',
    'Liverpool',
    'Bayern Munich',
    'PSG',
    'Bangladesh Cricket',
    'Portugal',
    'Inter Miami',
    'Germany',
    'France',
  ];

  const selectInvoiceRecord = (inv: Invoice) => {
    setSelectedInvoice(inv);
    const initialItem = inv.items[0] || null;
    setReturnItem(initialItem);
    if (initialItem) {
      setReplJerseyClub(initialItem.title.replace(' Kit', '').replace(' Jersey', '') || 'Argentina');
      setReplJerseySize(initialItem.size === 'L' ? 'XL' : 'L');
      setReplJerseyRate(900);
      if (initialItem.productId) {
        const matchedProd = inventory.find((p) => p.id === initialItem.productId);
        if (matchedProd) {
          setReplInventoryProductId(matchedProd.id);
          const nextVariant =
            matchedProd.variants.find((v) => v.size !== initialItem.size && v.stock > 0) ||
            matchedProd.variants[0];
          if (nextVariant) {
            setReplInventorySize(nextVariant.size);
          }
        }
      }
    }
  };

  const handleSearch = (overrideQuery?: string) => {
    const q = (overrideQuery !== undefined ? overrideQuery : searchQuery).trim().toLowerCase();
    if (!q) {
      setMatchedInvoices([]);
      setSelectedInvoice(null);
      setReturnItem(null);
      return;
    }

    const matches = invoices.filter(
      (inv) =>
        inv.customerPhone.toLowerCase().includes(q) ||
        inv.invoiceNo.toLowerCase().includes(q) ||
        inv.customerName.toLowerCase().includes(q)
    );

    if (matches.length > 0) {
      setMatchedInvoices(matches);
      selectInvoiceRecord(matches[0]);
      setCompletedExchange(null);
    } else {
      setMatchedInvoices([]);
      setSelectedInvoice(null);
      setReturnItem(null);
      showToast('কোনো বিক্রয় রশিদ বা ফোন নম্বর খুঁজে পাওয়া যায়নি', 'error');
    }
  };

  // Determine effective replacement product details & price
  let replacementTitle = '';
  let replacementSizeDisplay = '';
  let replacementPrice = 0;
  let replacementProductId: string | undefined = undefined;

  const effectiveReplacementType =
    isClothingStore && replacementType === 'jersey' ? 'inventory' : replacementType;

  const selectedInventoryProduct =
    inventory.find((p) => p.id === replInventoryProductId) || inventory[0];

  if (effectiveReplacementType === 'jersey') {
    replacementTitle = `${replJerseyClub} ${replJerseyCategory}`;
    replacementSizeDisplay = replJerseySize;
    replacementPrice = Number(replJerseyRate) || 0;
  } else if (effectiveReplacementType === 'inventory') {
    const prod = selectedInventoryProduct;
    const variant = prod?.variants.find((v) => v.size === replInventorySize) || prod?.variants?.[0];
    replacementTitle = prod?.name || 'Selected Inventory Item';
    replacementSizeDisplay = variant?.size || replInventorySize || 'L';
    replacementPrice = variant?.mrp || prod?.mrp || 0;
    replacementProductId = prod?.id;
  } else {
    replacementTitle = replCustomTitle || 'Custom Replacement Item';
    replacementSizeDisplay = replCustomSize || 'Free Size';
    replacementPrice = Number(replCustomRate) || 0;
  }

  // Financial calculations
  const returnPrice = returnItem ? returnItem.rate : 0;
  const priceDifference = replacementPrice - returnPrice;

  const customerPaysExtra = priceDifference > 0;
  const storeRefunds = priceDifference < 0;
  const isEvenExchange = priceDifference === 0;

  // Partial pay calculations
  const payableAmount = Math.max(0, priceDifference);
  const effectivePaid = paymentMode === 'paid' ? payableAmount : Math.min(advancePaid, payableAmount);
  const dueAmount = Math.max(0, payableAmount - effectivePaid);

  const handleExecuteExchange = () => {
    if (!selectedInvoice || !returnItem) {
      showToast('অনুগ্রহ করে এক্সচেঞ্জ করার আইটেম সিলেক্ট করুন', 'error');
      return;
    }

    if (!replacementTitle.trim()) {
      showToast('অনুগ্রহ করে নতুন এক্সচেঞ্জ আইটেমের বিবরণ দিন', 'error');
      return;
    }

    const updatedInventory = [...inventory];

    // 1. Restock returned item (+1) if it has a productId
    if (returnItem.productId) {
      const prod = updatedInventory.find((p) => p.id === returnItem.productId);
      if (prod) {
        prod.totalStock += 1;
        const v = prod.variants?.find((va) => va.size === returnItem.size);
        if (v) v.stock += 1;
        dbService.saveShopInventory(currentTenant.id, updatedInventory);
      }
    }

    // 2. Deduct replacement item (-1) if from inventory
    if (replacementProductId) {
      const selectedReplProduct = updatedInventory.find((p) => p.id === replacementProductId);
      if (selectedReplProduct) {
        selectedReplProduct.totalStock = Math.max(0, selectedReplProduct.totalStock - 1);
        const selectedReplVariant = selectedReplProduct.variants?.find(
          (v) => v.size === replacementSizeDisplay
        );
        if (selectedReplVariant) {
          selectedReplVariant.stock = Math.max(0, selectedReplVariant.stock - 1);
        }
        dbService.saveShopInventory(currentTenant.id, updatedInventory);
      }
    }

    setInventory(updatedInventory);

    // 3. Record size exchange record
    const record: SizeExchangeRecord = {
      id: `exch_${Date.now()}`,
      shopId: currentTenant.id,
      originalInvoiceId: selectedInvoice.id,
      originalInvoiceNo: selectedInvoice.invoiceNo,
      customerName: selectedInvoice.customerName,
      customerPhone: selectedInvoice.customerPhone,
      returnedItem: {
        productId: returnItem.productId,
        title: returnItem.title,
        size: returnItem.size,
        rate: returnItem.rate,
        customization: returnItem.customization,
      },
      replacementItem: {
        productId: replacementProductId,
        title: replacementTitle,
        size: replacementSizeDisplay,
        rate: replacementPrice,
      },
      priceDifference,
      paymentMode: isEvenExchange ? 'even' : customerPaysExtra ? paymentMode : 'refund',
      channelUsed,
      paidAmount: customerPaysExtra ? effectivePaid : 0,
      dueAmount: customerPaysExtra ? dueAmount : 0,
      createdAt: new Date().toISOString(),
      salesmanName: activeStaff ? activeStaff.name : 'Counter Staff',
      notes: exchangeNote || undefined,
    };

    dbService.addSizeExchange(record);
    setCompletedExchange(record);
    setExchangeHistory(dbService.getSizeExchanges(currentTenant.id));

    showToast(
      `১০-সেকেন্ড সাইজ এক্সচেঞ্জ সম্পন্ন হয়েছে! ${returnItem.size} ফেরত নিয়ে ${replacementSizeDisplay} ইস্যু করা হয়েছে।`,
      'success'
    );

    if (onExchangeComplete) onExchangeComplete();
  };

  const handleSendWhatsAppSlip = (rec: SizeExchangeRecord) => {
    const text =
      `*${currentTenant.name}* - সাইজ এক্সচেঞ্জ রশিদ\n` +
      `================================\n` +
      `তারিখ: ${new Date(rec.createdAt).toLocaleString()}\n` +
      `কাস্টমার: ${rec.customerName} (${rec.customerPhone})\n` +
      `পূর্বের মেমো: #${rec.originalInvoiceNo || rec.originalInvoiceId}\n\n` +
      `*ফেরত নেওয়া আইটেম:*\n` +
      `• ${rec.returnedItem.title} (সাইজ: ${rec.returnedItem.size}) - ৳${rec.returnedItem.rate}\n\n` +
      `*নতুন এক্সচেঞ্জ আইটেম:*\n` +
      `• ${rec.replacementItem.title} (সাইজ: ${rec.replacementItem.size}) - ৳${rec.replacementItem.rate}\n\n` +
      `*হিসেব বিবরণী:*\n` +
      `• পার্থক্যের পরিমাণ: ৳${rec.priceDifference}\n` +
      (rec.priceDifference > 0
        ? `• পেমেন্ট স্ট্যাটাস: ${rec.paymentMode === 'partial' ? 'আংশিক পরিশোধ' : 'পরিশোধিত'}\n` +
          `• পরিশোধকৃত টাকা: ৳${rec.paidAmount || 0} (${rec.channelUsed})\n` +
          (rec.dueAmount ? `• বাকি টাকা: ৳${rec.dueAmount}\n` : '')
        : rec.priceDifference < 0
        ? `• দোকান থেকে রিফান্ড: ৳${Math.abs(rec.priceDifference)}\n`
        : `• সমান বিনিময় (৳০)\n`) +
      `\nধন্যবাদ! আবার আসবেন।`;

    const cleanPhone = rec.customerPhone.replace(/[^0-9]/g, '');
    const fullPhone = cleanPhone.startsWith('88') ? cleanPhone : `88${cleanPhone}`;
    window.open(`https://wa.me/${fullPhone}?text=${encodeURIComponent(text)}`, '_blank');
  };

  const handleResetExchangeForm = () => {
    setCompletedExchange(null);
    setSelectedInvoice(null);
    setReturnItem(null);
    setMatchedInvoices([]);
    setSearchQuery('');
    setExchangeNote('');
    setPaymentMode('paid');
    setAdvancePaid(0);
  };

  const pageContent = (
    <div className="space-y-5">
      {/* ===================================================================== */}
      {/* MAIN RESPONSIVE WORKSPACE GRID                                        */}
      {/* ===================================================================== */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* =================================================================== */}
        {/* LEFT COLUMN (5 cols on lg): SEARCH, RECENT CUSTOMERS, ORIGINAL MEMO */}
        {/* =================================================================== */}
        <div className="lg:col-span-5 space-y-5">
          {/* SECTION 1: CUSTOMER PHONE / NAME OR INVOICE SEARCH */}
          <div className="bg-white dark:bg-zinc-900 border border-slate-200/90 dark:border-zinc-800 rounded-3xl p-4 sm:p-5 space-y-3.5 shadow-2xs">
            <div className="flex items-center justify-between">
              <label className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Search className="w-4 h-4 text-[#1f8a5b]" />
                <span>কাস্টমার ফোন, নাম অথবা মেমো নম্বর দিয়ে খুঁজুন</span>
              </label>
              {searchQuery && (
                <button
                  type="button"
                  onClick={handleResetExchangeForm}
                  className="text-[11px] font-semibold text-slate-400 hover:text-rose-600 cursor-pointer"
                >
                  মুছুন (Clear)
                </button>
              )}
            </div>

            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                  placeholder="যেমন: 01712000000 অথবা GS-2026-0891"
                  className="w-full bg-[#f4f7f5] dark:bg-zinc-950 border border-slate-200/80 dark:border-zinc-800 rounded-2xl pl-10 pr-3 py-2.5 text-xs sm:text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-[#164e3f] focus:ring-2 focus:ring-[#164e3f]/15 transition"
                />
              </div>
              <button
                type="button"
                onClick={() => handleSearch()}
                className="px-5 py-2.5 bg-[#164e3f] hover:bg-[#123e32] text-white font-bold text-xs sm:text-sm rounded-2xl transition cursor-pointer flex items-center gap-1.5 shadow-xs shrink-0"
              >
                <Search className="w-3.5 h-3.5" />
                <span>খুঁজুন</span>
              </button>
            </div>

            {/* RECENTLY ACCESSED CUSTOMERS QUICK CHIPS */}
            <div className="space-y-1.5 pt-1">
              <div className="text-[11px] font-semibold text-slate-500 dark:text-zinc-400 flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-[#1f8a5b]" />
                <span>সাম্প্রতিক কাস্টমার ও মেমো (১-ক্লিক সিলেক্ট):</span>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                {invoices.slice(0, 6).map((inv) => {
                  const isSelected = selectedInvoice?.id === inv.id;
                  return (
                    <button
                      key={inv.id}
                      type="button"
                      onClick={() => {
                        setSearchQuery(inv.customerPhone || inv.invoiceNo);
                        setMatchedInvoices([inv]);
                        selectInvoiceRecord(inv);
                        setCompletedExchange(null);
                      }}
                      className={`text-[11px] px-2.5 py-1.5 rounded-xl border transition cursor-pointer flex items-center gap-1.5 font-semibold ${
                        isSelected
                          ? 'bg-[#164e3f] text-white border-[#164e3f] shadow-2xs'
                          : 'bg-[#f4f7f5] dark:bg-zinc-950 hover:bg-[#e6f4ea] text-slate-700 dark:text-zinc-300 border-slate-200/80 dark:border-zinc-800'
                      }`}
                    >
                      <User className={`w-3 h-3 ${isSelected ? 'text-emerald-300' : 'text-[#1f8a5b]'}`} />
                      <span>
                        {inv.customerPhone} ({inv.customerName})
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Multiple matched invoices selector when a customer has multiple memos */}
            {matchedInvoices.length > 1 && (
              <div className="pt-2 border-t border-slate-100 dark:border-zinc-800 space-y-1.5">
                <span className="text-[11px] font-bold text-slate-500 dark:text-zinc-400 block">
                  পাওয়া মেমোসমূহ ({matchedInvoices.length} টি):
                </span>
                <div className="grid grid-cols-1 gap-1.5 max-h-40 overflow-y-auto pr-1">
                  {matchedInvoices.map((inv) => (
                    <button
                      key={inv.id}
                      type="button"
                      onClick={() => selectInvoiceRecord(inv)}
                      className={`p-2.5 rounded-2xl border text-left text-xs flex items-center justify-between transition cursor-pointer ${
                        selectedInvoice?.id === inv.id
                          ? 'bg-[#e6f4ea] dark:bg-emerald-950/40 border-[#1f8a5b] text-slate-900 dark:text-white'
                          : 'bg-[#f4f7f5] dark:bg-zinc-950 border-slate-200/80 dark:border-zinc-800 text-slate-700 dark:text-zinc-300 hover:border-slate-300'
                      }`}
                    >
                      <div>
                        <span className="font-mono font-bold">#{inv.invoiceNo}</span>
                        <span className="text-[11px] text-slate-500 dark:text-zinc-400 ml-2">
                          {inv.customerName} ({inv.items.length} আইটেম)
                        </span>
                      </div>
                      <span className="font-mono font-bold text-[#1f8a5b] dark:text-emerald-400">
                        ৳{inv.total}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* SECTION 2: ORIGINAL INVOICE & PURCHASED PRODUCTS */}
          {selectedInvoice ? (
            <div className="bg-white dark:bg-zinc-900 border border-slate-200/90 dark:border-zinc-800 rounded-3xl p-4 sm:p-5 space-y-4 shadow-2xs">
              {/* Original Memo Header */}
              <div className="bg-[#f4f7f5] dark:bg-zinc-950 p-3.5 rounded-2xl border border-slate-200/80 dark:border-zinc-800 text-xs flex justify-between items-center">
                <div>
                  <span className="text-[10px] font-mono font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider">
                    ORIGINAL MEMO / পূর্বের বিক্রয় রশিদ
                  </span>
                  <div className="font-extrabold text-slate-900 dark:text-white text-sm flex items-center gap-2 mt-0.5">
                    <span className="font-mono">#{selectedInvoice.invoiceNo}</span>
                    <span className="text-[10px] bg-[#e6f4ea] dark:bg-emerald-950/60 text-[#1f8a5b] dark:text-emerald-400 px-2 py-0.5 rounded-full font-bold border border-emerald-200 dark:border-emerald-800">
                      {selectedInvoice.items.length} আইটেম
                    </span>
                  </div>
                  <div className="text-slate-500 dark:text-zinc-400 flex items-center gap-1.5 mt-1">
                    <span className="font-bold text-slate-800 dark:text-zinc-200">
                      {selectedInvoice.customerName}
                    </span>
                    <span>•</span>
                    <span className="font-mono">{selectedInvoice.customerPhone}</span>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-slate-400 block">পূর্বে পরিশোধ</span>
                  <div className="font-mono font-extrabold text-[#1f8a5b] dark:text-emerald-400 text-base">
                    ৳{selectedInvoice.total}
                  </div>
                  <div className="text-[10px] text-slate-400 font-mono">
                    {new Date(selectedInvoice.createdAt).toLocaleDateString()}
                  </div>
                </div>
              </div>

              {/* Purchased Items List for Return Selection */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-rose-600 dark:text-rose-400">
                    ১. কাস্টমার যে পণ্যটি রিটার্ন / এক্সচেঞ্জ করতে চাচ্ছে (Select Return Item) *
                  </label>
                  <span className="text-[10px] font-semibold bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-300 px-2 py-0.5 rounded-full border border-rose-200 dark:border-rose-800">
                    শেলফে +১ যুক্ত হবে
                  </span>
                </div>

                <div className="space-y-2">
                  {selectedInvoice.items.map((item) => {
                    const isPicked = returnItem?.id === item.id;
                    return (
                      <div
                        key={item.id}
                        onClick={() => {
                          setReturnItem(item);
                          setReplJerseyClub(
                            item.title.replace(' Kit', '').replace(' Jersey', '') || 'Argentina'
                          );
                        }}
                        className={`p-3.5 rounded-2xl border flex items-center justify-between text-xs cursor-pointer transition ${
                          isPicked
                            ? 'bg-rose-50/80 dark:bg-rose-950/25 border-rose-400 dark:border-rose-800 text-slate-900 dark:text-white shadow-2xs'
                            : 'bg-[#f4f7f5] dark:bg-zinc-950 border-slate-200/80 dark:border-zinc-800 text-slate-700 dark:text-zinc-300 hover:border-slate-300'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-6 h-6 rounded-full flex items-center justify-center border text-[11px] shrink-0 ${
                              isPicked
                                ? 'bg-rose-600 border-rose-500 text-white font-bold'
                                : 'border-slate-300 text-slate-400 bg-white dark:bg-zinc-900'
                            }`}
                          >
                            {isPicked ? <Check className="w-3.5 h-3.5" strokeWidth={2.5} /> : '1'}
                          </div>
                          <div>
                            <div className="font-bold text-slate-900 dark:text-white flex flex-wrap items-center gap-2">
                              <span>{item.title}</span>
                              <span className="text-[10px] bg-white dark:bg-zinc-800 text-slate-800 dark:text-zinc-200 px-2 py-0.5 rounded-lg border border-slate-200 dark:border-zinc-700 font-mono font-bold">
                                সাইজ: {item.size}
                              </span>
                            </div>
                            <div className="text-[10px] text-slate-500 dark:text-zinc-400 mt-0.5">
                              {item.subDetail || 'Standard Counter Item'} • Qty: {item.quantity}
                            </div>
                          </div>
                        </div>
                        <div className="text-right shrink-0 pl-2">
                          <span className="text-[10px] text-slate-400 block">আগের দাম</span>
                          <span className="font-mono font-bold text-rose-600 dark:text-rose-400 text-sm">
                            ৳{item.rate}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : (
            <div className="relative bg-white dark:bg-zinc-900 border border-dashed border-slate-300 dark:border-zinc-800 rounded-3xl p-8 text-center space-y-2.5 shadow-2xs">
              <div className="absolute top-3.5 right-3.5">
                <InfoTooltip
                  text={pickText(
                    'উপরে কাস্টমারের মোবাইল নম্বর বা মেমো নম্বর লিখে সার্চ করুন অথবা সাম্প্রতিক কাস্টমার তালিকা থেকে যেকোনো একটিতে ক্লিক করুন।',
                    'Search above by customer phone or invoice number, or click any recent customer from the quick chips.'
                  )}
                />
              </div>
              <div className="w-12 h-12 rounded-2xl bg-[#e6f4ea] dark:bg-emerald-950/60 text-[#1f8a5b] dark:text-emerald-400 flex items-center justify-center mx-auto">
                <FileText className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-bold text-slate-800 dark:text-zinc-200">
                {pickText('কাস্টমারের মেমো নির্বাচন করুন', 'Select Customer Invoice')}
              </h3>
            </div>
          )}

          {/* SECTION 6 (HISTORY): RECENT SIZE EXCHANGE HISTORY */}
          <div className="bg-white dark:bg-zinc-900 border border-slate-200/90 dark:border-zinc-800 rounded-3xl p-4 sm:p-5 space-y-3 shadow-2xs">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-zinc-800">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-[#1f8a5b]" />
                <h3 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">
                  সাম্প্রতিক সাইজ এক্সচেঞ্জ হিস্ট্রি (Exchange History)
                </h3>
              </div>
              <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded-full bg-[#f4f7f5] dark:bg-zinc-800 text-slate-600 dark:text-zinc-300">
                {exchangeHistory.length} রেকর্ড
              </span>
            </div>

            {exchangeHistory.length === 0 ? (
              <div className="py-6 text-center text-xs text-slate-400 dark:text-zinc-500">
                এখনো কোনো সাইজ এক্সচেঞ্জ রেকর্ড করা হয়নি।
              </div>
            ) : (
              <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                {exchangeHistory.slice(0, 8).map((rec) => (
                  <div
                    key={rec.id}
                    className="p-3 rounded-2xl bg-[#f4f7f5] dark:bg-zinc-950 border border-slate-200/80 dark:border-zinc-800 text-xs flex items-center justify-between gap-2.5"
                  >
                    <div className="min-w-0 space-y-0.5">
                      <div className="font-bold text-slate-900 dark:text-white truncate flex items-center gap-1.5">
                        <span>{rec.customerName}</span>
                        <span className="text-[10px] font-mono text-slate-500 dark:text-zinc-400">
                          ({rec.customerPhone})
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-600 dark:text-zinc-300 flex flex-wrap items-center gap-1">
                        <span className="text-rose-600 dark:text-rose-400 font-semibold">
                          ফেরত: {rec.returnedItem.size}
                        </span>
                        <ArrowRight className="w-3 h-3 text-slate-400" />
                        <span className="text-[#1f8a5b] dark:text-emerald-400 font-bold">
                          নতুন: {rec.replacementItem.size}
                        </span>
                        <span className="text-slate-400">•</span>
                        <span className="truncate max-w-[160px] text-slate-500">
                          {rec.replacementItem.title}
                        </span>
                      </div>
                      <div className="text-[10px] font-mono text-slate-400">
                        মেমো #{rec.originalInvoiceNo || rec.originalInvoiceId} •{' '}
                        {new Date(rec.createdAt).toLocaleDateString()}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span
                        className={`text-[11px] font-mono font-bold px-2 py-0.5 rounded-lg border ${
                          rec.priceDifference > 0
                            ? 'bg-[#e6f4ea] text-[#1f8a5b] border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800'
                            : rec.priceDifference < 0
                            ? 'bg-rose-50 text-rose-600 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800'
                            : 'bg-white dark:bg-zinc-900 text-slate-600 dark:text-zinc-300 border-slate-200 dark:border-zinc-700'
                        }`}
                      >
                        {rec.priceDifference > 0
                          ? `+৳${rec.priceDifference}`
                          : rec.priceDifference < 0
                          ? `-৳${Math.abs(rec.priceDifference)}`
                          : '৳০ সমান'}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleSendWhatsAppSlip(rec)}
                        title="কাস্টমারকে WhatsApp রশিদ পাঠান"
                        className="p-2 rounded-xl bg-white hover:bg-[#e6f4ea] dark:bg-zinc-900 dark:hover:bg-emerald-950/50 text-[#1f8a5b] dark:text-emerald-400 border border-slate-200/80 dark:border-zinc-800 transition cursor-pointer"
                      >
                        <Phone className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* =================================================================== */}
        {/* RIGHT COLUMN (7 cols on lg): REPLACEMENT BUILDER, SUMMARY, SETTLEMENT */}
        {/* =================================================================== */}
        <div className="lg:col-span-7 space-y-5">
          {completedExchange ? (
            /* COMPLETED EXCHANGE CONFIRMATION & RECEIPT VIEW */
            <div className="bg-white dark:bg-zinc-900 border border-slate-200/90 dark:border-zinc-800 rounded-3xl p-5 sm:p-6 space-y-5 shadow-2xs">
              <div className="text-center space-y-2">
                <div className="w-14 h-14 rounded-full bg-[#e6f4ea] dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-800 flex items-center justify-center text-[#1f8a5b] dark:text-emerald-400 mx-auto">
                  <CheckCircle className="w-8 h-8" />
                </div>
                <h2 className="text-lg sm:text-xl font-extrabold text-slate-900 dark:text-white">
                  সাইজ এক্সচেঞ্জ সফলভাবে সম্পন্ন হয়েছে!
                </h2>
                <p className="text-xs text-slate-500 dark:text-zinc-400">
                  আইটেম স্টক (+১ রিটার্ন এবং -১ নতুন ইস্যু) ও ক্যাশ ড্রয়ার অ্যাডজাস্টমেন্ট স্বয়ংক্রিয়ভাবে আপডেট করা হয়েছে
                </p>
              </div>

              {/* Printable Slip Card */}
              <div
                id="printable-exchange-slip"
                className="bg-[#f4f7f5] dark:bg-zinc-950 border border-slate-200/90 dark:border-zinc-800 rounded-2xl p-4 sm:p-5 text-xs space-y-3"
              >
                <div className="flex justify-between items-center pb-2.5 border-b border-slate-200 dark:border-zinc-800">
                  <div>
                    <div className="font-extrabold text-sm text-slate-900 dark:text-white">
                      {currentTenant.name}
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-zinc-400">
                      পূর্বের মেমো: #{completedExchange.originalInvoiceNo || completedExchange.originalInvoiceId}
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] font-mono text-slate-400 block">
                      {new Date(completedExchange.createdAt).toLocaleString()}
                    </span>
                    <span className="font-bold text-slate-800 dark:text-zinc-200">
                      {completedExchange.customerName} ({completedExchange.customerPhone})
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="p-3 rounded-xl bg-white dark:bg-zinc-900 border border-rose-200/80 dark:border-rose-900/50 space-y-1">
                    <span className="text-[10px] font-bold uppercase text-rose-600 dark:text-rose-400 block">
                      ফেরত নেওয়া পণ্য (Returned +1)
                    </span>
                    <div className="font-bold text-slate-900 dark:text-white">
                      {completedExchange.returnedItem.title}
                    </div>
                    <div className="flex justify-between text-[11px] font-mono pt-1">
                      <span className="bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 px-2 py-0.5 rounded font-bold">
                        সাইজ: {completedExchange.returnedItem.size}
                      </span>
                      <span className="font-bold text-rose-600 dark:text-rose-400">
                        ৳{completedExchange.returnedItem.rate}
                      </span>
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-white dark:bg-zinc-900 border border-emerald-200/80 dark:border-emerald-900/50 space-y-1">
                    <span className="text-[10px] font-bold uppercase text-[#1f8a5b] dark:text-emerald-400 block">
                      নতুন এক্সচেঞ্জ পণ্য (Replacement -1)
                    </span>
                    <div className="font-bold text-slate-900 dark:text-white">
                      {completedExchange.replacementItem.title}
                    </div>
                    <div className="flex justify-between text-[11px] font-mono pt-1">
                      <span className="bg-[#e6f4ea] dark:bg-emerald-950/60 text-[#1f8a5b] dark:text-emerald-300 px-2 py-0.5 rounded font-bold">
                        সাইজ: {completedExchange.replacementItem.size}
                      </span>
                      <span className="font-bold text-[#1f8a5b] dark:text-emerald-400">
                        ৳{completedExchange.replacementItem.rate}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex justify-between items-center pt-2.5 border-t border-slate-200 dark:border-zinc-800 font-bold">
                  <span className="text-slate-600 dark:text-zinc-300">টাকার চূড়ান্ত হিসাব:</span>
                  <span className="text-slate-900 dark:text-white text-sm font-mono">
                    {completedExchange.priceDifference > 0
                      ? `অতিরিক্ত পরিশোধ: ৳${completedExchange.priceDifference} (${completedExchange.channelUsed})`
                      : completedExchange.priceDifference < 0
                      ? `দোকান থেকে রিফান্ড: ৳${Math.abs(completedExchange.priceDifference)}`
                      : 'সমান বিনিময় (৳০)'}
                  </span>
                </div>
              </div>

              <div className="flex flex-wrap gap-2.5 pt-1">
                <button
                  type="button"
                  onClick={() => handleSendWhatsAppSlip(completedExchange)}
                  className="flex-1 py-3 px-4 rounded-2xl bg-[#164e3f] hover:bg-[#123e32] text-white font-bold text-xs flex items-center justify-center gap-2 transition cursor-pointer shadow-xs"
                >
                  <Phone className="w-4 h-4" />
                  <span>কাস্টমারকে WhatsApp রশিদ পাঠান</span>
                </button>
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="py-3 px-4 rounded-2xl bg-[#e6f4ea] hover:bg-emerald-100 text-[#1f8a5b] border border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800 font-bold text-xs flex items-center justify-center gap-1.5 transition cursor-pointer"
                >
                  <Printer className="w-4 h-4" />
                  <span>প্রিন্ট রশিদ</span>
                </button>
                <button
                  type="button"
                  onClick={handleResetExchangeForm}
                  className="py-3 px-4 rounded-2xl border border-slate-200/90 dark:border-zinc-700 text-xs font-semibold text-slate-700 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800 transition cursor-pointer"
                >
                  + আরেকটি এক্সচেঞ্জ করুন
                </button>
              </div>
            </div>
          ) : selectedInvoice && returnItem ? (
            <>
              {/* SECTION 3: EXCHANGE ITEM SELECTION & AVAILABLE SIZES */}
              <div className="bg-white dark:bg-zinc-900 border border-slate-200/90 dark:border-zinc-800 rounded-3xl p-4 sm:p-5 space-y-4 shadow-2xs">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-3 border-b border-slate-100 dark:border-zinc-800">
                  <span className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-[#164e3f] dark:text-emerald-400" />
                    <span>২. এক্সচেঞ্জে নতুন যে পণ্যটি দেওয়া হবে (New Replacement Item) *</span>
                  </span>

                  {/* Mode Switcher */}
                  <div
                    className={`grid ${
                      isClothingStore ? 'grid-cols-2' : 'grid-cols-3'
                    } gap-1 bg-[#eef2f0] dark:bg-zinc-800 p-1 rounded-2xl text-[11px] font-semibold`}
                  >
                    {!isClothingStore && (
                      <button
                        type="button"
                        onClick={() => setReplacementType('jersey')}
                        className={`px-3 py-1.5 rounded-xl transition cursor-pointer text-center ${
                          effectiveReplacementType === 'jersey'
                            ? 'bg-white dark:bg-zinc-900 text-slate-900 dark:text-white shadow-2xs font-bold'
                            : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900'
                        }`}
                      >
                        জার্সি বিল্ডার
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setReplacementType('inventory')}
                      className={`px-3 py-1.5 rounded-xl transition cursor-pointer text-center ${
                        effectiveReplacementType === 'inventory'
                          ? 'bg-white dark:bg-zinc-900 text-slate-900 dark:text-white shadow-2xs font-bold'
                          : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900'
                      }`}
                    >
                      স্টক আইটেম
                    </button>
                    <button
                      type="button"
                      onClick={() => setReplacementType('custom')}
                      className={`px-3 py-1.5 rounded-xl transition cursor-pointer text-center ${
                        effectiveReplacementType === 'custom'
                          ? 'bg-white dark:bg-zinc-900 text-slate-900 dark:text-white shadow-2xs font-bold'
                          : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900'
                      }`}
                    >
                      কাস্টম পণ্য
                    </button>
                  </div>
                </div>

                {/* MODE 1: JERSEY ENTRY (SPORTSWEAR ONLY) */}
                {!isClothingStore && effectiveReplacementType === 'jersey' && (
                  <div className="space-y-3.5">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-center">
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-500 dark:text-zinc-400 mb-1">
                          ক্লাব বা দেশ (Club / Country)
                        </label>
                        <select
                          value={replJerseyClub}
                          onChange={(e) => setReplJerseyClub(e.target.value)}
                          className="w-full bg-[#f4f7f5] dark:bg-zinc-950 border border-slate-200/80 dark:border-zinc-800 rounded-2xl px-3.5 py-2.5 text-xs font-semibold text-slate-900 dark:text-white focus:outline-none focus:border-[#164e3f]"
                        >
                          {CLUBS_AND_COUNTRIES.map((c) => (
                            <option key={c} value={c}>
                              {c}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-[11px] font-semibold text-slate-500 dark:text-zinc-400 mb-1">
                          কিট ক্যাটাগরি (Kit Category)
                        </label>
                        <select
                          value={replJerseyCategory}
                          onChange={(e) => {
                            setReplJerseyCategory(e.target.value);
                            if (e.target.value === 'Fan Issue') setReplJerseyRate(900);
                            else if (e.target.value === 'Player Issue') setReplJerseyRate(1450);
                            else if (e.target.value === 'Retro Vintage') setReplJerseyRate(1750);
                            else if (e.target.value === 'BD Premium') setReplJerseyRate(990);
                          }}
                          className="w-full bg-[#f4f7f5] dark:bg-zinc-950 border border-slate-200/80 dark:border-zinc-800 rounded-2xl px-3.5 py-2.5 text-xs font-semibold text-slate-900 dark:text-white focus:outline-none focus:border-[#164e3f]"
                        >
                          <option value="Player Issue">Player Issue (Master Copy)</option>
                          <option value="Fan Issue">Fan Issue Standard</option>
                          <option value="Player Edition">Player Edition</option>
                          <option value="Retro Vintage">Retro Vintage Kit</option>
                          <option value="BD Premium">BD Premium Edition</option>
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-center">
                      <div className="sm:col-span-7">
                        <label className="block text-[11px] font-semibold text-slate-500 dark:text-zinc-400 mb-1">
                          নতুন সাইজ সিলেক্ট করুন (Available Sizes)
                        </label>
                        <div className="flex gap-1.5">
                          {(['S', 'M', 'L', 'XL', 'XXL', '3XL'] as const).map((sz) => (
                            <button
                              key={sz}
                              type="button"
                              onClick={() => setReplJerseySize(sz)}
                              className={`flex-1 py-2 text-xs font-bold rounded-xl border transition cursor-pointer ${
                                replJerseySize === sz
                                  ? 'bg-[#164e3f] text-white border-[#164e3f] shadow-xs'
                                  : 'bg-[#f4f7f5] dark:bg-zinc-950 text-slate-700 dark:text-zinc-300 border-slate-200/80 dark:border-zinc-800 hover:border-slate-300'
                              }`}
                            >
                              {sz}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="sm:col-span-5">
                        <label className="block text-[11px] font-semibold text-slate-500 dark:text-zinc-400 mb-1">
                          নতুন অর্ডারের মূল্য (Rate ৳) *
                        </label>
                        <div className="relative">
                          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                            ৳
                          </span>
                          <input
                            type="number"
                            value={replJerseyRate || ''}
                            onChange={(e) => setReplJerseyRate(Number(e.target.value))}
                            placeholder="900"
                            className="w-full bg-[#f4f7f5] dark:bg-zinc-950 border border-slate-200/80 dark:border-zinc-800 rounded-2xl pl-8 pr-3 py-2 text-xs font-mono font-bold text-slate-900 dark:text-white focus:outline-none focus:border-[#164e3f]"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* MODE 2: INVENTORY CATALOG WITH AVAILABLE SIZE MATRIX */}
                {effectiveReplacementType === 'inventory' && (
                  <div className="space-y-3.5">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-500 dark:text-zinc-400 mb-1">
                        স্টক থেকে পণ্য নির্বাচন করুন (Select Inventory Product)
                      </label>
                      <select
                        value={selectedInventoryProduct?.id || ''}
                        onChange={(e) => {
                          setReplInventoryProductId(e.target.value);
                          const prod = inventory.find((p) => p.id === e.target.value);
                          if (prod?.variants?.[0]) setReplInventorySize(prod.variants[0].size);
                        }}
                        className="w-full bg-[#f4f7f5] dark:bg-zinc-950 border border-slate-200/80 dark:border-zinc-800 rounded-2xl px-3.5 py-2.5 text-xs sm:text-sm font-semibold text-slate-900 dark:text-white focus:outline-none focus:border-[#164e3f]"
                      >
                        {inventory.map((prod) => (
                          <option key={prod.id} value={prod.id}>
                            {prod.name} (৳{prod.mrp} • মোট স্টক: {prod.totalStock} pcs)
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Available Sizes Interactive Grid */}
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-500 dark:text-zinc-400 mb-1.5">
                        উপলব্ধ সাইজ ও মজুদ নির্বাচন করুন (Select Replacement Size)
                      </label>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        {selectedInventoryProduct?.variants.map((v) => {
                          const isSelectedSize = replInventorySize === v.size;
                          const isSameAsReturned =
                            returnItem?.productId === selectedInventoryProduct.id &&
                            returnItem?.size === v.size;
                          return (
                            <button
                              key={v.size}
                              type="button"
                              onClick={() => setReplInventorySize(v.size)}
                              className={`p-2.5 rounded-2xl border text-left transition cursor-pointer flex flex-col justify-between ${
                                isSelectedSize
                                  ? 'bg-[#164e3f] text-white border-[#164e3f] shadow-xs'
                                  : 'bg-[#f4f7f5] dark:bg-zinc-950 text-slate-800 dark:text-zinc-200 border-slate-200/80 dark:border-zinc-800 hover:border-[#1f8a5b]'
                              }`}
                            >
                              <div className="flex items-center justify-between">
                                <span className="text-xs font-extrabold font-mono">
                                  সাইজ: {v.size}
                                </span>
                                {isSameAsReturned && (
                                  <span
                                    className={`text-[9px] px-1.5 py-0.2 rounded font-bold ${
                                      isSelectedSize
                                        ? 'bg-white/20 text-white'
                                        : 'bg-amber-100 text-amber-800'
                                    }`}
                                  >
                                    আগের সাইজ
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center justify-between mt-1.5 text-[10px]">
                                <span
                                  className={
                                    isSelectedSize
                                      ? 'text-emerald-200 font-semibold'
                                      : v.stock > 0
                                      ? 'text-[#1f8a5b] dark:text-emerald-400 font-semibold'
                                      : 'text-rose-500 font-semibold'
                                  }
                                >
                                  মজুদ: {v.stock} pcs
                                </span>
                                <span
                                  className={`font-mono font-bold ${
                                    isSelectedSize ? 'text-white' : 'text-slate-700 dark:text-zinc-300'
                                  }`}
                                >
                                  ৳{v.mrp}
                                </span>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}

                {/* MODE 3: CUSTOM / OTHER ENTRY */}
                {effectiveReplacementType === 'custom' && (
                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-center">
                    <div className="sm:col-span-6">
                      <label className="block text-[11px] font-semibold text-slate-500 dark:text-zinc-400 mb-1">
                        পণ্যের নাম
                      </label>
                      <input
                        type="text"
                        value={replCustomTitle}
                        onChange={(e) => setReplCustomTitle(e.target.value)}
                        placeholder={
                          isClothingStore
                            ? 'যেমন: Men Formal Shirt / Slim Fit Jeans'
                            : 'যেমন: আর্জেন্টিনা হোম কিট / শর্টস'
                        }
                        className="w-full bg-[#f4f7f5] dark:bg-zinc-950 border border-slate-200/80 dark:border-zinc-800 rounded-2xl px-3.5 py-2.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-[#164e3f]"
                      />
                    </div>

                    <div className="sm:col-span-3">
                      <label className="block text-[11px] font-semibold text-slate-500 dark:text-zinc-400 mb-1">
                        সাইজ
                      </label>
                      <input
                        type="text"
                        value={replCustomSize}
                        onChange={(e) => setReplCustomSize(e.target.value)}
                        placeholder="XL"
                        className="w-full bg-[#f4f7f5] dark:bg-zinc-950 border border-slate-200/80 dark:border-zinc-800 rounded-2xl px-2.5 py-2.5 text-xs font-mono font-bold text-slate-900 dark:text-white text-center focus:outline-none focus:border-[#164e3f]"
                      />
                    </div>

                    <div className="sm:col-span-3">
                      <label className="block text-[11px] font-semibold text-slate-500 dark:text-zinc-400 mb-1">
                        মূল্য (৳)
                      </label>
                      <input
                        type="number"
                        value={replCustomRate || ''}
                        onChange={(e) => setReplCustomRate(Number(e.target.value))}
                        placeholder="900"
                        className="w-full bg-[#f4f7f5] dark:bg-zinc-950 border border-slate-200/80 dark:border-zinc-800 rounded-2xl px-2.5 py-2.5 text-xs font-mono font-bold text-slate-900 dark:text-white text-center focus:outline-none focus:border-[#164e3f]"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* SECTION 4: RETURNED ITEM & REPLACEMENT ITEM SIDE-BY-SIDE SUMMARY */}
              <div className="bg-white dark:bg-zinc-900 border border-slate-200/90 dark:border-zinc-800 rounded-3xl p-4 sm:p-5 space-y-3 shadow-2xs">
                <div className="text-xs font-bold text-slate-700 dark:text-zinc-300 flex items-center gap-2">
                  <Package className="w-4 h-4 text-[#1f8a5b]" />
                  <span>৩. ফেরত পণ্য বনাম নতুন পণ্যের তুলনামূলক সারসংক্ষেপ (Exchange Comparison)</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Returned Item Box */}
                  <div className="p-3.5 rounded-2xl bg-rose-50/60 dark:bg-rose-950/20 border border-rose-200/80 dark:border-rose-900/50 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold uppercase text-rose-600 dark:text-rose-400">
                        ফেরত নেওয়া পণ্য (Returned)
                      </span>
                      <span className="text-[10px] font-semibold text-rose-600 dark:text-rose-400">
                        স্টক +1
                      </span>
                    </div>
                    <div className="text-xs font-bold text-slate-900 dark:text-white truncate">
                      {returnItem.title}
                    </div>
                    <div className="flex items-center justify-between pt-1">
                      <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded-lg bg-white dark:bg-zinc-900 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
                        সাইজ: {returnItem.size}
                      </span>
                      <span className="text-sm font-mono font-extrabold text-rose-600 dark:text-rose-400">
                        ৳{returnPrice}
                      </span>
                    </div>
                  </div>

                  {/* Replacement Item Box */}
                  <div className="p-3.5 rounded-2xl bg-[#e6f4ea]/60 dark:bg-emerald-950/25 border border-emerald-200/90 dark:border-emerald-900/50 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold uppercase text-[#1f8a5b] dark:text-emerald-400">
                        নতুন দেওয়া পণ্য (Replacement)
                      </span>
                      <span className="text-[10px] font-semibold text-[#1f8a5b] dark:text-emerald-400">
                        স্টক -1
                      </span>
                    </div>
                    <div className="text-xs font-bold text-slate-900 dark:text-white truncate">
                      {replacementTitle}
                    </div>
                    <div className="flex items-center justify-between pt-1">
                      <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded-lg bg-white dark:bg-zinc-900 text-[#1f8a5b] dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                        সাইজ: {replacementSizeDisplay}
                      </span>
                      <span className="text-sm font-mono font-extrabold text-[#1f8a5b] dark:text-emerald-400">
                        ৳{replacementPrice}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* SECTION 5: PRICE DIFFERENCE, ADDITIONAL PAYMENT / REFUND & CONFIRMATION */}
              <div className="bg-white dark:bg-zinc-900 border border-slate-200/90 dark:border-zinc-800 rounded-3xl p-4 sm:p-5 space-y-4 shadow-2xs">
                <div className="bg-[#f4f7f5] dark:bg-zinc-950 border border-slate-200/80 dark:border-zinc-800 p-4 rounded-2xl space-y-3.5">
                  <div className="flex items-center justify-between pb-2.5 border-b border-slate-200/80 dark:border-zinc-800">
                    <div>
                      <div className="text-xs sm:text-sm text-slate-800 dark:text-zinc-200 font-bold flex items-center gap-1.5">
                        <Wallet className="w-4 h-4 text-[#1f8a5b]" />
                        <span>টাকার হিসাব ও সেটেলমেন্ট (Settlement Summary)</span>
                      </div>
                      <div className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5 flex items-center gap-1.5 font-mono">
                        <span>নতুন পণ্য: ৳{replacementPrice}</span>
                        <span>-</span>
                        <span>ফেরত পণ্য: ৳{returnPrice}</span>
                      </div>
                    </div>

                    <div className="text-right">
                      {customerPaysExtra ? (
                        <div>
                          <span className="text-[10px] text-amber-700 dark:text-amber-400 font-bold uppercase block">
                            কাস্টমার অতিরিক্ত দিবে:
                          </span>
                          <div className="text-xl font-mono font-extrabold text-[#1f8a5b] dark:text-emerald-400">
                            +৳{priceDifference}
                          </div>
                        </div>
                      ) : storeRefunds ? (
                        <div>
                          <span className="text-[10px] text-rose-600 dark:text-rose-400 font-bold uppercase block">
                            দোকান রিফান্ড দিবে:
                          </span>
                          <div className="text-xl font-mono font-extrabold text-rose-600 dark:text-rose-400">
                            -৳{Math.abs(priceDifference)}
                          </div>
                        </div>
                      ) : (
                        <div className="text-xs font-bold text-[#1f8a5b] dark:text-emerald-300 bg-[#e6f4ea] dark:bg-emerald-950/60 px-3 py-1.5 rounded-xl border border-emerald-200 dark:border-emerald-800">
                          সমান বিনিময় (৳০)
                        </div>
                      )}
                    </div>
                  </div>

                  {/* PAYMENT OPTIONS (When Customer has to pay extra) */}
                  {customerPaysExtra && (
                    <div className="space-y-3 pt-1">
                      {/* Full Paid vs Partial Mode */}
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => setPaymentMode('paid')}
                          className={`py-2 px-3 rounded-xl border text-xs font-bold transition cursor-pointer ${
                            paymentMode === 'paid'
                              ? 'bg-[#164e3f] text-white border-[#164e3f]'
                              : 'bg-white dark:bg-zinc-900 text-slate-700 dark:text-zinc-300 border-slate-200/80 dark:border-zinc-800'
                          }`}
                        >
                          পূর্ণ পরিশোধ (৳{payableAmount})
                        </button>
                        <button
                          type="button"
                          onClick={() => setPaymentMode('partial')}
                          className={`py-2 px-3 rounded-xl border text-xs font-bold transition cursor-pointer ${
                            paymentMode === 'partial'
                              ? 'bg-amber-600 text-white border-amber-600'
                              : 'bg-white dark:bg-zinc-900 text-slate-700 dark:text-zinc-300 border-slate-200/80 dark:border-zinc-800'
                          }`}
                        >
                          আংশিক পরিশোধ / বাকি
                        </button>
                      </div>

                      {paymentMode === 'partial' && (
                        <div className="grid grid-cols-2 gap-3 p-3 rounded-xl bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800">
                          <div>
                            <label className="block text-[10px] font-semibold text-slate-500 mb-1">
                              নগদ জমা (Advance Paid ৳)
                            </label>
                            <input
                              type="number"
                              value={advancePaid || ''}
                              onChange={(e) => setAdvancePaid(Number(e.target.value))}
                              placeholder="0"
                              className="w-full bg-[#f4f7f5] dark:bg-zinc-950 border border-slate-200/80 dark:border-zinc-800 rounded-xl px-3 py-1.5 text-xs font-mono font-bold text-slate-900 dark:text-white focus:outline-none"
                            />
                          </div>
                          <div className="text-right flex flex-col justify-center">
                            <span className="text-[10px] text-slate-400">নতুন বাকি (Due):</span>
                            <span className="text-sm font-mono font-extrabold text-rose-600 dark:text-rose-400">
                              ৳{dueAmount}
                            </span>
                          </div>
                        </div>
                      )}

                      <div>
                        <label className="block text-xs font-semibold text-slate-600 dark:text-zinc-400 mb-1.5">
                          পেমেন্ট মাধ্যম (Payment Channel)
                        </label>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                          {[
                            { key: 'cash', label: 'Cash (ক্যাশ)' },
                            { key: 'merchantBkash', label: 'বিকাশ মার্চেন্ট' },
                            { key: 'personalBkash', label: 'বিকাশ পার্সোনাল' },
                            { key: 'nagad', label: 'নগদ' },
                          ].map((ch) => (
                            <button
                              key={ch.key}
                              type="button"
                              onClick={() => setChannelUsed(ch.key as DrawerType)}
                              className={`py-2 px-2.5 rounded-xl border text-xs font-semibold transition cursor-pointer flex items-center justify-center gap-1.5 ${
                                channelUsed === ch.key
                                  ? 'bg-[#164e3f] text-white border-[#164e3f] font-bold shadow-xs'
                                  : 'bg-white dark:bg-zinc-900 text-slate-700 dark:text-zinc-300 border-slate-200/80 dark:border-zinc-800 hover:border-slate-300'
                              }`}
                            >
                              <span>{ch.label}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Store Refunds Drawer Channel */}
                  {storeRefunds && (
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 dark:text-zinc-400 mb-1">
                        রিফান্ডের ক্যাশ কোন অ্যাকাউন্ট থেকে দেওয়া হবে?
                      </label>
                      <select
                        value={channelUsed}
                        onChange={(e) => setChannelUsed(e.target.value as DrawerType)}
                        className="w-full bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 rounded-2xl px-3.5 py-2.5 text-xs font-semibold text-slate-900 dark:text-white focus:outline-none"
                      >
                        <option value="cash">Physical Cash Drawer</option>
                        <option value="merchantBkash">Merchant bKash</option>
                        <option value="personalBkash">Personal bKash</option>
                        <option value="nagad">Nagad</option>
                        <option value="bank">Bank</option>
                      </select>
                    </div>
                  )}

                  {/* Optional Exchange Note */}
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-500 dark:text-zinc-400 mb-1">
                      এক্সচেঞ্জ নোট / মন্তব্য (ঐচ্ছিক)
                    </label>
                    <input
                      type="text"
                      value={exchangeNote}
                      onChange={(e) => setExchangeNote(e.target.value)}
                      placeholder="যেমন: ট্রায়াল রুমের পর সাইজ ছোট হওয়ায় L থেকে XL পরিবর্তন..."
                      className="w-full bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 rounded-2xl px-3.5 py-2 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-[#164e3f]"
                    />
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex flex-col sm:flex-row gap-2.5 pt-1">
                  <button
                    type="button"
                    onClick={handleBackAction}
                    className="sm:flex-1 py-3.5 px-4 rounded-2xl border border-slate-200/90 dark:border-zinc-700 text-xs font-semibold text-slate-600 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800 transition cursor-pointer"
                  >
                    বাতিল / ফিরে যান
                  </button>
                  <button
                    type="button"
                    onClick={handleExecuteExchange}
                    className="sm:flex-2 py-3.5 px-6 rounded-2xl bg-[#164e3f] hover:bg-[#123e32] text-white text-xs sm:text-sm font-bold transition shadow-md flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <ArrowRightLeft className="w-4 h-4" />
                    <span>১০-সেকেন্ড সাইজ এক্সচেঞ্জ কনফার্ম করুন</span>
                  </button>
                </div>
              </div>
            </>
          ) : (
            /* Empty / Ready-to-Select State on Right Column */
            <div className="relative bg-white dark:bg-zinc-900 border border-slate-200/90 dark:border-zinc-800 rounded-3xl p-8 sm:p-12 text-center space-y-3 shadow-2xs flex flex-col items-center justify-center min-h-[240px]">
              <div className="absolute top-4 right-4">
                <InfoTooltip
                  text={pickText(
                    'বাম পাশ থেকে কাস্টমারের পূর্বের মেমো ও রিটার্ন আইটেম নির্বাচন করলে এখানে নতুন সাইজ, স্টক, মূল্যের পার্থক্য এবং পেমেন্ট/রিফান্ড অপশনগুলো স্বয়ংক্রিয়ভাবে প্রদর্শিত হবে। (১. মেমো সার্চ বা ক্লিক করুন • ২. নতুন সাইজ বেছে নিন • ৩. ১০ সেকেন্ডে কনফার্ম করুন)',
                    'Select the customer’s original invoice and return item on the left to view replacement sizes, stock, price difference, and settlement options. (1. Search or click invoice • 2. Choose new size • 3. Confirm in 10 seconds)'
                  )}
                />
              </div>
              <div className="w-14 h-14 rounded-2xl bg-[#e6f4ea] dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800/60 text-[#1f8a5b] dark:text-emerald-400 flex items-center justify-center">
                <ArrowRightLeft className="w-7 h-7" />
              </div>
              <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                {pickText('সাইজ এক্সচেঞ্জ ওয়ার্কস্পেস প্রস্তুত', 'Size Exchange Workspace Ready')}
              </h3>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  if (mode === 'modal') {
    return (
      <div className="fixed inset-0 z-50 bg-slate-900/60 dark:bg-black/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-in fade-in duration-150">
        <div className="bg-slate-50 dark:bg-zinc-950 border border-slate-200/90 dark:border-zinc-800 rounded-3xl max-w-6xl w-full p-4 sm:p-6 shadow-2xl text-slate-900 dark:text-zinc-100 relative my-6 max-h-[92vh] overflow-y-auto">
          {pageContent}
        </div>
      </div>
    );
  }

  return pageContent;
};

export const SizeExchangePage = SizeExchangeModal;
