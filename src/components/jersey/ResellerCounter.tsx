import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import {
  ResellerAccount,
  DrawerType,
  OrderLineItem,
  JerseyCustomization,
  Invoice,
  ResellerTransaction,
  ClothingCategorySetting,
} from '../../types';
import { dbService } from '../../services/db';
import { isClothingShop } from '../../utils/securityPolicy';
import {
  Truck,
  Plus,
  DollarSign,
  ArrowUpRight,
  ArrowDownLeft,
  Search,
  BookOpen,
  Phone,
  MapPin,
  Clock,
  Printer,
  CheckCircle,
  Shirt,
  ShoppingBag,
  Trash2,
  Flame,
  Check,
  AlertTriangle,
  Receipt,
  User,
  ExternalLink,
  ShieldCheck,
  X,
  CreditCard,
  ChevronRight,
} from 'lucide-react';
import { CustomizationModal } from './CustomizationModal';
import { SplitPaymentModal } from '../pos/SplitPaymentModal';
import { BottomSheet } from '../ui/BottomSheet';
import {
  SplitPaymentBreakdown,
  validateSplitPayment,
  getActiveSplitEntries,
  formatSplitSummaryText,
  calculateSplitTotal,
} from '../../utils/posOperations';

interface ResellerRow {
  id: string;
  category: string;
  clubOrCountry: string;
  color?: string;
  size: string;
  rate: number;
  quantity: number;
  customization?: JerseyCustomization;
  isOther?: boolean;
  customTitle?: string;
  customSizeOrDetail?: string;
}

const CLOTHING_SIZES_BY_SCALE: Record<'shirts_tops' | 'denim_pants' | 'panjabi', string[]> = {
  shirts_tops: ['S', 'M', 'L', 'XL', 'XXL'],
  denim_pants: ['28-Reg', '30-Reg', '32-Reg', '34-Reg', '36-Reg', '38-Reg'],
  panjabi: ['38', '40', '42', '44', '46'],
};

export const ResellerCounter: React.FC = () => {
  const { currentTenant, showToast, activeStaff, role, pickText } = useApp();
  const isClothingStore = isClothingShop(currentTenant);
  const clothingCategories: ClothingCategorySetting[] = isClothingStore
    ? dbService.getClothingCategories(currentTenant.id)
    : [];

  // Active view: 'counter' (In-store Reseller billing) vs 'ledger' (Baki Khata statements)
  const [activeView, setActiveView] = useState<'counter' | 'ledger'>('counter');

  const [resellers, setResellers] = useState<ResellerAccount[]>(() =>
    dbService.getResellers(currentTenant.id)
  );
  const [search, setSearch] = useState('');
  const [selectedResellerId, setSelectedResellerId] = useState<string>(() => {
    const list = dbService.getResellers(currentTenant.id);
    return list[0]?.id || '';
  });

  // Selected reseller for ledger detail
  const [ledgerSelectedReseller, setLedgerSelectedReseller] = useState<ResellerAccount | null>(() => {
    const list = dbService.getResellers(currentTenant.id);
    return list[0] || null;
  });
  const [selectedResellerTx, setSelectedResellerTx] = useState<ResellerTransaction | null>(null);

  // Dynamic Reseller Order Builder State (Wholesale default pricing isolated by Business Category)
  const [orderRows, setOrderRows] = useState<ResellerRow[]>(() =>
    isClothingStore
      ? [
          {
            id: 'res_cloth_1',
            category: clothingCategories[2]?.name || 'Shirt',
            clubOrCountry: 'Men Casual Cotton Shirt',
            color: 'Navy Blue',
            size: 'L',
            rate: 750,
            quantity: 6,
            isOther: false,
          },
          {
            id: 'res_cloth_2',
            category: clothingCategories[4]?.name || 'Jeans',
            clubOrCountry: 'Slim Fit Stretch Denim',
            color: 'Indigo',
            size: '32-Reg',
            rate: 980,
            quantity: 6,
            isOther: false,
          },
        ]
      : [
          {
            id: 'res_row_1',
            category: 'Player Issue',
            clubOrCountry: 'Real Madrid',
            size: 'L',
            rate: 800, // Wholesale reseller rate (vs retail 1450)
            quantity: 5,
            isOther: false,
          },
          {
            id: 'res_row_2',
            category: 'Fan Issue',
            clubOrCountry: 'Argentina',
            size: 'XL',
            rate: 550, // Wholesale reseller rate (vs retail 950)
            quantity: 5,
            isOther: false,
          },
        ]
  );

  // Heat-Press Customization Modal trigger for a row
  const [customizingRowId, setCustomizingRowId] = useState<string | null>(null);

  // Settlement state
  const [discount, setDiscount] = useState<number>(0);
  const [paymentMode, setPaymentMode] = useState<'paid' | 'partial' | 'credit'>('partial');
  const [advancePaid, setAdvancePaid] = useState<number>(3000);
  const [paymentChannel, setPaymentChannel] = useState<DrawerType | 'split'>('merchantBkash');
  const [splitModalOpen, setSplitModalOpen] = useState(false);
  const [splitBreakdown, setSplitBreakdown] = useState<SplitPaymentBreakdown | null>(null);
  const [saleNote, setSaleNote] = useState(() =>
    pickText('দোকান থেকে সরাসরি পাইকারি ডেলিভারি', 'Direct in-store wholesale delivery')
  );

  // Modals
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newLocation, setNewLocation] = useState('');
  const [newPreviousDue, setNewPreviousDue] = useState<string>('');

  // Ledger collect payment modal
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState<number>(5000);
  const [paymentDrawer, setPaymentDrawer] = useState<DrawerType>('merchantBkash');
  const [paymentNote, setPaymentNote] = useState('bKash payment from reseller');

  // Ledger dispatch modal
  const [dispatchModalOpen, setDispatchModalOpen] = useState(false);
  const [dispatchCount, setDispatchCount] = useState<number>(20);
  const [dispatchRate, setDispatchRate] = useState<number>(800);
  const [dispatchNote, setDispatchNote] = useState('Wholesale lot dispatch');

  // Completed Reseller Memo Modal
  const [completedSale, setCompletedSale] = useState<{
    invoice: Invoice;
    transaction: ResellerTransaction;
    reseller: ResellerAccount;
    prevBalance: number;
    newBalance: number;
  } | null>(null);

  const reload = () => {
    const list = dbService.getResellers(currentTenant.id);
    setResellers(list);
    if (ledgerSelectedReseller) {
      const updated = list.find((r) => r.id === ledgerSelectedReseller.id);
      setLedgerSelectedReseller(updated || null);
    }
  };

  const selectedReseller = resellers.find((r) => r.id === selectedResellerId) || resellers[0] || null;

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

  // Calculations for current reseller order
  const orderSubtotal = orderRows.reduce((sum, row) => {
    const extra = row.customization?.extraCharge || 0;
    return sum + (row.rate + extra) * row.quantity;
  }, 0);

  const totalQuantity = orderRows.reduce((sum, row) => sum + row.quantity, 0);
  const netTotal = Math.max(0, orderSubtotal - discount);

  // Settlement calculations
  const effectivePaid =
    paymentMode === 'paid' ? netTotal : paymentMode === 'credit' ? 0 : Math.min(advancePaid, netTotal);
  const currentBillDue = Math.max(0, netTotal - effectivePaid);
  const prevDue = selectedReseller?.currentDueBalance || 0;
  const projectedNewDue = prevDue + currentBillDue;

  // Add Primary Row (Clothing Wholesale Row for Clothing stores; Jersey Row for Sportswear stores)
  const handleAddJerseyRow = () => {
    if (isClothingStore) {
      const defaultCat = clothingCategories[0];
      const catName = defaultCat?.name || 'T-Shirt';
      const wholesaleRate = defaultCat
        ? Math.max(defaultCat.defaultCostPrice, Math.round(defaultCat.defaultBottomPrice * 0.9))
        : 450;
      setOrderRows((prev) => [
        ...prev,
        {
          id: `res_cloth_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          category: catName,
          clubOrCountry: `Men's ${catName}`,
          color: '',
          size: defaultCat?.defaultSizes?.[1] || 'L',
          rate: wholesaleRate,
          quantity: 6,
          isOther: false,
        },
      ]);
      return;
    }

    setOrderRows((prev) => [
      ...prev,
      {
        id: `res_row_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        category: 'Player Issue',
        clubOrCountry: 'Argentina',
        size: 'L',
        rate: 800,
        quantity: 5,
        isOther: false,
      },
    ]);
  };

  // Add Others Row (Direct keyboard writing)
  const handleAddOtherRow = () => {
    setOrderRows((prev) => [
      ...prev,
      {
        id: `other_row_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        category: 'Other',
        clubOrCountry: 'Other Wholesale Product',
        size: 'Standard',
        rate: isClothingStore ? 350 : 150,
        quantity: isClothingStore ? 6 : 10,
        isOther: true,
        customTitle: '',
        customSizeOrDetail: '',
      },
    ]);
  };

  const handleRemoveRow = (id: string) => {
    if (orderRows.length <= 1) return;
    setOrderRows((prev) => prev.filter((r) => r.id !== id));
  };

  const handleUpdateRow = (id: string, field: string, val: any) => {
    setOrderRows((prev) =>
      prev.map((row) => {
        if (row.id === id) {
          const updated = { ...row, [field]: val };
          if (field === 'category') {
            if (val === 'Other') {
              updated.isOther = true;
              updated.rate = isClothingStore ? 350 : 150;
            } else if (isClothingStore) {
              updated.isOther = false;
              const matchedCat = clothingCategories.find((c) => c.name === val);
              if (matchedCat) {
                updated.rate = Math.max(
                  matchedCat.defaultCostPrice,
                  Math.round(matchedCat.defaultBottomPrice * 0.9)
                );
                const scaleSizes = CLOTHING_SIZES_BY_SCALE[matchedCat.apparelScale] || ['S', 'M', 'L', 'XL', 'XXL'];
                updated.size = scaleSizes[1] || scaleSizes[0];
              }
              if (!updated.clubOrCountry || clothingCategories.some((c) => updated.clubOrCountry.includes(c.name))) {
                updated.clubOrCountry = `Men's ${val}`;
              }
            } else {
              updated.isOther = false;
              // Wholesale Reseller Price Map
              if (val === 'Player Issue') updated.rate = 800;
              else if (val === 'Fan Issue') updated.rate = 550;
              else if (val === 'Retro Vintage') updated.rate = 950;
              else if (val === 'BD Premium') updated.rate = 600;
            }
          }
          return updated;
        }
        return row;
      })
    );
  };

  // Create New Reseller
  const handleCreateReseller = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || !newPhone.trim()) {
      showToast(
        pickText('রিসেলারের নাম ও মোবাইল নম্বর আবশ্যক', 'Reseller name and phone number are required'),
        'error'
      );
      return;
    }
    const openingDue = Math.max(0, Math.round(Number(newPreviousDue) || 0));
    const resellerId = `res_${Date.now()}`;
    const initialTransactions: ResellerTransaction[] =
      openingDue > 0
        ? [
            {
              id: `rtx_open_${Date.now()}`,
              resellerId,
              shopId: currentTenant.id,
              date: new Date().toISOString().split('T')[0],
              type: 'opening_balance',
              itemsCount: 0,
              amount: openingDue,
              balanceAfter: openingDue,
              note: pickText(
                'পূর্বের বাকি (Opening Balance / Previous Due)',
                'Opening Balance / Previous Due'
              ),
              slipNumber: 'OPENING-DUE',
            },
          ]
        : [];

    const newReseller: ResellerAccount = {
      id: resellerId,
      shopId: currentTenant.id,
      name: newName.trim(),
      phone: newPhone.trim(),
      location: newLocation.trim() || 'Dhaka',
      previousDue: openingDue,
      currentDueBalance: openingDue,
      totalPurchased: 0,
      ordersCount: 0,
      transactions: initialTransactions,
    };
    dbService.addReseller(currentTenant.id, newReseller);
    reload();
    setSelectedResellerId(newReseller.id);
    setLedgerSelectedReseller(newReseller);
    setAddModalOpen(false);
    setNewName('');
    setNewPhone('');
    setNewLocation('');
    setNewPreviousDue('');
    showToast(
      pickText(
        `নতুন রিসেলার ${newReseller.name} যোগ করা হয়েছে!${openingDue > 0 ? ` (পূর্বের বাকি: ৳${openingDue.toLocaleString()})` : ''}`,
        `Added new reseller ${newReseller.name}!${openingDue > 0 ? ` (Previous Due: ৳${openingDue.toLocaleString()})` : ''}`
      ),
      'success'
    );
  };

  // Confirm In-Store Reseller Sale
  const handleConfirmResellerSale = () => {
    if (!selectedReseller) {
      showToast(
        pickText('অনুগ্রহ করে একজন রিসেলার সিলেক্ট করুন', 'Please select a reseller'),
        'error'
      );
      return;
    }

    if (orderRows.length === 0) {
      showToast(
        pickText('কমপক্ষে ১টি পণ্য এন্ট্রি করুন', 'Please add at least 1 product'),
        'error'
      );
      return;
    }

    // Convert rows to OrderLineItem
    const lineItems: OrderLineItem[] = orderRows.map((row) => {
      if (row.isOther || row.category === 'Other') {
        const title = row.customTitle?.trim() || 'Custom Reseller Product';
        return {
          id: `item_res_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          itemType: 'other',
          title,
          subDetail: row.customSizeOrDetail ? `Wholesale • ${row.customSizeOrDetail}` : 'Wholesale Reseller Item',
          size: row.customSizeOrDetail || 'Free Size',
          rate: Number(row.rate) || 0,
          quantity: Number(row.quantity) || 1,
          subtotal: (Number(row.rate) || 0) * (Number(row.quantity) || 1),
          costPrice: Math.round((Number(row.rate) || 0) * 0.7),
          bottomPrice: Number(row.rate) || 0,
        };
      }

      if (isClothingStore) {
        const cleanColor = row.color?.trim() || undefined;
        const rate = Number(row.rate) || 0;
        const qty = Number(row.quantity) || 1;
        const detailParts = [row.category];
        if (cleanColor) detailParts.push(`Color: ${cleanColor}`);
        detailParts.push(`${row.size} [Wholesale Rate]`);
        return {
          id: `item_res_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          itemType: 'apparel',
          title: row.clubOrCountry?.trim() || `Men's ${row.category}`,
          subDetail: detailParts.join(' • '),
          size: row.size,
          color: cleanColor,
          rate,
          quantity: qty,
          subtotal: rate * qty,
          costPrice: Math.round(rate * 0.75),
          bottomPrice: rate,
        };
      }

      const extraPrint = row.customization?.extraCharge || 0;
      const rate = row.rate + extraPrint;
      const detailStr = `${row.category} • ${row.size} [Wholesale Rate]${
        row.customization ? ` • [CUSTOM: ${row.customization.customName} #${row.customization.customNumber}]` : ''
      }`;

      return {
        id: `item_res_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        itemType: 'jersey',
        title: `${row.clubOrCountry} Kit`,
        subDetail: detailStr,
        size: row.size,
        rate,
        quantity: row.quantity,
        subtotal: rate * row.quantity,
        costPrice: Math.round(row.rate * 0.75),
        bottomPrice: row.rate,
        customization: row.customization,
      };
    });

    if (paymentMode !== 'credit' && effectivePaid > 0 && paymentChannel === 'split') {
      const check = validateSplitPayment(splitBreakdown, effectivePaid);
      if (!check.valid) {
        showToast(
          pickText(
            check.errorBn || 'অনুগ্রহ করে Split Payment-এর হিসাব মিলিয়ে নিন।',
            'Please verify the Split Payment breakdown.'
          ),
          'error'
        );
        setSplitModalOpen(true);
        return;
      }
    }

    const prevBalance = selectedReseller.currentDueBalance;

    try {
      const result = dbService.recordResellerCounterSale(
        currentTenant.id,
        selectedReseller.id,
        lineItems,
        netTotal,
        effectivePaid,
        currentBillDue,
        paymentMode === 'credit' ? 'cash' : paymentChannel,
        saleNote,
        activeStaff ? activeStaff.name : 'Counter Staff',
        paymentMode !== 'credit' && paymentChannel === 'split' && splitBreakdown ? splitBreakdown : undefined
      );

      reload();

      setCompletedSale({
        invoice: result.invoice,
        transaction: result.transaction,
        reseller: selectedReseller,
        prevBalance,
        newBalance: prevBalance + currentBillDue,
      });

      showToast(
        pickText(
          `রিসেলার বিক্রয় সফল! মোট ৳${netTotal.toLocaleString()} (জমা: ৳${effectivePaid.toLocaleString()}, বাকি: ৳${currentBillDue.toLocaleString()})`,
          `Reseller sale completed! Total ৳${netTotal.toLocaleString()} (Paid: ৳${effectivePaid.toLocaleString()}, Due: ৳${currentBillDue.toLocaleString()})`
        ),
        'success'
      );
    } catch (err: any) {
      showToast(err.message || 'Error recording sale', 'error');
    }
  };

  // WhatsApp share
  const handleSendWhatsAppMemo = () => {
    if (!completedSale) return;
    const { invoice, reseller, prevBalance, newBalance } = completedSale;

    let itemsList = invoice.items
      .map(
        (it, idx) =>
          `${idx + 1}. ${it.title} (${it.size}) x ${it.quantity} ${pickText('টি', 'pcs')} @ ৳${it.rate} = ৳${it.subtotal}`
      )
      .join('\n');

    const splitSummaryLine =
      invoice.paymentChannel === 'split' && invoice.splitBreakdown
        ? `• ${pickText('স্প্লিট পেমেন্ট বিবরণ', 'Split Payment Details')}: ${formatSplitSummaryText(invoice.splitBreakdown)}\n`
        : '';

    const text =
      `*${currentTenant.name}* - ${pickText('রিসেলার পাইকারি চালান (Wholesale Memo)', 'Wholesale Reseller Memo')}\n` +
      `--------------------------------\n` +
      `• ${pickText('মেমো নং', 'Memo No')}: #${invoice.invoiceNo}\n` +
      `• ${pickText('তারিখ', 'Date')}: ${new Date(invoice.createdAt).toLocaleDateString()}\n` +
      `• ${pickText('রিসেলার', 'Reseller')}: ${reseller.name}\n` +
      `• ${pickText('ফোন', 'Phone')}: ${reseller.phone}\n` +
      `• ${pickText('ঠিকানা', 'Address')}: ${reseller.location}\n` +
      `--------------------------------\n` +
      `*${pickText('সরবরাহকৃত পণ্যসমূহ (আইটেম তালিকা)', 'Supplied Items')}:*\n` +
      `${itemsList}\n` +
      `--------------------------------\n` +
      `• ${pickText('বর্তমান বিল', 'Current Bill')}: ৳${invoice.total.toLocaleString()}\n` +
      `• ${pickText('বর্তমান জমা (Paid)', 'Paid Amount')}: ৳${invoice.advancePaid.toLocaleString()} (${invoice.paymentChannel})\n` +
      splitSummaryLine +
      `• ${pickText('বর্তমান বিলের বাকি', 'Current Bill Due')}: ৳${invoice.dueAmount.toLocaleString()}\n` +
      `--------------------------------\n` +
      `*${pickText('বাকি খাতা লেজার ব্যালেন্স', 'Ledger Balance')}:*\n` +
      `• ${pickText('পূর্বের বাকি', 'Previous Due')}: ৳${prevBalance.toLocaleString()}\n` +
      `• *${pickText('সর্বমোট বকেয়া (Current Total Due)', 'Current Total Due')}: ৳${newBalance.toLocaleString()}*\n` +
      `--------------------------------\n` +
      pickText('ধন্যবাদ! ব্যবসার সমৃদ্ধি কামনা করি।', 'Thank you for your business!');

    const cleanPhone = reseller.phone.replace(/[^0-9]/g, '');
    const fullPhone = cleanPhone.startsWith('88') ? cleanPhone : `88${cleanPhone}`;
    window.open(`https://wa.me/${fullPhone}?text=${encodeURIComponent(text)}`, '_blank');
  };

  return (
    <div className="space-y-4 pb-20 lg:pb-4 max-w-4xl mx-auto">
      {/* Top Header */}
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-white tracking-tight">
          {pickText('রিসেলার কাউন্টার (Reseller Counter)', 'Reseller Counter')}
        </h2>

        <button
          onClick={() => setAddModalOpen(true)}
          className="flex items-center gap-1.5 bg-[#1f8a5b] hover:bg-[#164e3f] text-white px-4 py-2.5 rounded-2xl text-xs sm:text-sm font-bold transition shadow-xs cursor-pointer shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>{pickText('নতুন', 'New')}</span>
        </button>
      </div>

      {/* Segmented View Switcher: সেলস কাউন্টার vs বাকি খাতা */}
      <div className="grid grid-cols-2 gap-1 bg-[#eef2f0] dark:bg-zinc-800 p-1 rounded-2xl">
        <button
          type="button"
          onClick={() => setActiveView('counter')}
          className={`py-2.5 rounded-xl text-xs sm:text-sm font-bold transition cursor-pointer ${
            activeView === 'counter'
              ? 'bg-white dark:bg-zinc-900 text-slate-900 dark:text-white shadow-2xs'
              : 'text-slate-500 dark:text-zinc-400 hover:text-slate-800'
          }`}
        >
          {pickText('সেলস কাউন্টার', 'Sales Counter')}
        </button>
        <button
          type="button"
          onClick={() => setActiveView('ledger')}
          className={`py-2.5 rounded-xl text-xs sm:text-sm font-bold transition cursor-pointer ${
            activeView === 'ledger'
              ? 'bg-white dark:bg-zinc-900 text-slate-900 dark:text-white shadow-2xs'
              : 'text-slate-500 dark:text-zinc-400 hover:text-slate-800'
          }`}
        >
          {pickText('বাকি খাতা', 'Due Ledger')}
        </button>
      </div>

      {/* VIEW 1: RESELLER SALES COUNTER */}
      {activeView === 'counter' && (
        <div className="space-y-4">
          {/* Reseller Selector Card */}
          <div className="bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 rounded-3xl p-4 sm:p-5 space-y-4 shadow-2xs">
            <div>
              <label className="block text-xs text-slate-500 dark:text-zinc-400 mb-1.5">
                {pickText('রিসেলার নির্বাচন', 'Select Reseller')}
              </label>
              <select
                value={selectedResellerId}
                onChange={(e) => setSelectedResellerId(e.target.value)}
                className="w-full bg-[#f4f7f5] dark:bg-zinc-800 border border-slate-200/80 dark:border-zinc-700 rounded-2xl px-4 py-3 text-sm font-semibold text-slate-900 dark:text-white focus:outline-none focus:border-[#1f8a5b] cursor-pointer"
              >
                {resellers.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name} — {pickText('বাকি', 'Due')}: ৳{r.currentDueBalance.toLocaleString()}
                  </option>
                ))}
              </select>
            </div>

            {selectedReseller ? (
              <div className="pt-3 border-t border-slate-100 dark:border-zinc-800 space-y-3.5">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-[#e6f4ea] dark:bg-emerald-950/60 text-[#1f8a5b] dark:text-emerald-400 font-bold text-sm flex items-center justify-center shrink-0">
                    {selectedReseller.name.charAt(0)}
                  </div>
                  <div className="min-w-0">
                    <div className="font-bold text-sm text-slate-900 dark:text-white">
                      {selectedReseller.name}
                    </div>
                    <div className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5 flex flex-wrap items-center gap-1.5">
                      <span className="text-blue-600 dark:text-blue-400 underline">
                        {selectedReseller.phone}
                      </span>
                      <span>·</span>
                      <span>{selectedReseller.location}</span>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-[#f4f7f5] dark:bg-zinc-800/60 p-3.5 rounded-2xl">
                    <div className="text-xs text-slate-500 dark:text-zinc-400">
                      {pickText('মোট লট', 'Total Lots')}
                    </div>
                    <div className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-white mt-0.5">
                      {selectedReseller.ordersCount} {pickText('বার', 'orders')}
                    </div>
                  </div>

                  <div className="bg-[#f4f7f5] dark:bg-zinc-800/60 p-3.5 rounded-2xl">
                    <div className="text-xs text-slate-500 dark:text-zinc-400">
                      {pickText('পূর্বের বাকি', 'Previous Due')}
                    </div>
                    <div
                      className={`text-base sm:text-lg font-extrabold mt-0.5 ${
                        selectedReseller.currentDueBalance > 0
                          ? 'text-rose-600 dark:text-rose-400'
                          : 'text-[#1f8a5b] dark:text-emerald-400'
                      }`}
                    >
                      ৳{selectedReseller.currentDueBalance.toLocaleString()}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-xs text-slate-400">
                {pickText(
                  "কোনো রিসেলার নেই। উপরের '+ নতুন' বাটনে ক্লিক করে যুক্ত করুন।",
                  "No resellers found. Click '+ New' above to add one."
                )}
              </div>
            )}
          </div>

          {/* এন্ট্রি Card (Clothing Wholesale vs Sportswear Jersey Entry) */}
          <div className="bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 rounded-3xl p-4 sm:p-5 space-y-4 shadow-2xs">
            <div className="flex items-center gap-2">
              <Shirt className="w-4 h-4 text-[#1f8a5b] dark:text-emerald-400" />
              <h3 className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-white">
                {isClothingStore
                  ? pickText("পোশাক এন্ট্রি (Men's Clothing Wholesale)", "Apparel Entry (Men's Clothing Wholesale)")
                  : pickText('জার্সি এন্ট্রি', 'Jersey Entry')}
              </h3>
            </div>

            {/* Rows List */}
            <div className="space-y-3.5">
              {orderRows.map((row) => (
                <div
                  key={row.id}
                  className="bg-[#f2f5f3] dark:bg-zinc-800/50 border border-slate-200/60 dark:border-zinc-800 p-3.5 sm:p-4 rounded-2xl space-y-3 transition"
                >
                  {row.isOther || row.category === 'Other' ? (
                    /* OTHERS: DIRECT WRITING ROW */
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-slate-700 dark:text-zinc-200">
                            {pickText('অন্যান্য পণ্য', 'Other Item')}
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              handleUpdateRow(
                                row.id,
                                'category',
                                isClothingStore
                                  ? clothingCategories[0]?.name || 'T-Shirt'
                                  : 'Player Issue'
                              )
                            }
                            className="text-[11px] text-[#1f8a5b] dark:text-emerald-400 font-semibold underline cursor-pointer"
                          >
                            {isClothingStore
                              ? pickText('পোশাকে ফিরুন', 'Back to Apparel')
                              : pickText('জার্সিতে ফিরুন', 'Back to Jersey')}
                          </button>
                        </div>

                        {orderRows.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveRow(row.id)}
                            className="p-2 rounded-xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 text-slate-400 hover:text-rose-500 transition cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        <div>
                          <label className="block text-xs text-slate-500 dark:text-zinc-400 mb-1">
                            {pickText('পণ্যের নাম', 'Product Name')}
                          </label>
                          <input
                            type="text"
                            value={row.customTitle || ''}
                            onChange={(e) => handleUpdateRow(row.id, 'customTitle', e.target.value)}
                            placeholder={
                              isClothingStore
                                ? pickText('যেমন: বেল্ট / ওয়ালেট / ওয়েস্টকোট', 'e.g. Belt / Wallet / Waistcoat')
                                : pickText('যেমন: ফুটবল মোজা / শর্টস', 'e.g. Football Socks / Shorts')
                            }
                            className="w-full bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-xl px-3.5 py-2.5 text-sm font-medium text-slate-900 dark:text-white focus:outline-none"
                          />
                        </div>

                        <div>
                          <label className="block text-xs text-slate-500 dark:text-zinc-400 mb-1">
                            {pickText('সাইজ বা বিবরণ', 'Size or Details')}
                          </label>
                          <input
                            type="text"
                            value={row.customSizeOrDetail || ''}
                            onChange={(e) =>
                              handleUpdateRow(row.id, 'customSizeOrDetail', e.target.value)
                            }
                            placeholder="Free / L / Black"
                            className="w-full bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 dark:text-white focus:outline-none"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2.5">
                        <div>
                          <label className="block text-xs text-slate-500 dark:text-zinc-400 mb-1">
                            {pickText('রেট (৳)', 'Rate (৳)')}
                          </label>
                          <input
                            type="number"
                            value={row.rate || ''}
                            onChange={(e) => handleUpdateRow(row.id, 'rate', Number(e.target.value))}
                            className="w-full bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-xl px-3.5 py-2.5 text-sm font-bold text-slate-900 dark:text-white focus:outline-none"
                          />
                        </div>

                        <div>
                          <label className="block text-xs text-slate-500 dark:text-zinc-400 mb-1">
                            {pickText('পরিমাণ', 'Quantity')}
                          </label>
                          <input
                            type="number"
                            min={1}
                            value={row.quantity}
                            onChange={(e) =>
                              handleUpdateRow(row.id, 'quantity', Number(e.target.value))
                            }
                            className="w-full bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-xl px-3.5 py-2.5 text-sm font-bold text-slate-900 dark:text-white focus:outline-none"
                          />
                        </div>
                      </div>
                    </div>
                  ) : isClothingStore ? (
                    /* MEN'S CLOTHING WHOLESALE ROW (Exclusive to Clothing Sector) */
                    <div className="space-y-3">
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                        <div>
                          <label className="block text-xs text-slate-500 dark:text-zinc-400 mb-1">
                            {pickText('পোশাক ক্যাটাগরি', 'Apparel Category')}
                          </label>
                          <select
                            value={row.category}
                            onChange={(e) => handleUpdateRow(row.id, 'category', e.target.value)}
                            className="w-full bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-900 dark:text-white focus:outline-none"
                          >
                            {clothingCategories.map((cat) => (
                              <option key={cat.id} value={cat.name}>
                                {cat.name}
                              </option>
                            ))}
                            <option value="Other">{pickText('অন্যান্য পণ্য', 'Other Item')}</option>
                          </select>
                        </div>

                        <div>
                          <label className="block text-xs text-slate-500 dark:text-zinc-400 mb-1">
                            {pickText('পণ্যের নাম / ব্র্যান্ড', 'Product Name / Brand')}
                          </label>
                          <input
                            type="text"
                            value={row.clubOrCountry}
                            onChange={(e) =>
                              handleUpdateRow(row.id, 'clubOrCountry', e.target.value)
                            }
                            placeholder={pickText('যেমন: Oxford Shirt / Slim Jeans', 'e.g. Oxford Shirt / Slim Jeans')}
                            className="w-full bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-900 dark:text-white focus:outline-none"
                          />
                        </div>

                        <div>
                          <label className="block text-xs text-slate-500 dark:text-zinc-400 mb-1">
                            {pickText('রঙ / Color (ঐচ্ছিক)', 'Color (Optional)')}
                          </label>
                          <input
                            type="text"
                            value={row.color || ''}
                            onChange={(e) => handleUpdateRow(row.id, 'color', e.target.value)}
                            placeholder="Navy / White / Black"
                            className="w-full bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-xl px-3 py-2.5 text-sm text-slate-900 dark:text-white focus:outline-none"
                          />
                        </div>
                      </div>

                      {/* Size Pills based on Clothing Category scale */}
                      <div className="flex flex-wrap gap-1.5">
                        {(() => {
                          const matchedCat = clothingCategories.find((c) => c.name === row.category);
                          const scale = matchedCat?.apparelScale || 'shirts_tops';
                          const sizes = CLOTHING_SIZES_BY_SCALE[scale] || ['S', 'M', 'L', 'XL', 'XXL'];
                          return sizes.map((sz) => (
                            <button
                              key={sz}
                              type="button"
                              onClick={() => handleUpdateRow(row.id, 'size', sz)}
                              className={`px-3 py-1.5 text-xs font-bold rounded-xl border transition cursor-pointer ${
                                row.size === sz
                                  ? 'bg-[#1f8a5b] text-white border-[#1f8a5b] shadow-2xs'
                                  : 'bg-white dark:bg-zinc-900 text-slate-700 dark:text-zinc-300 border-slate-200 dark:border-zinc-700'
                              }`}
                            >
                              {sz}
                            </button>
                          ));
                        })()}
                      </div>

                      {/* হোলসেল রেট (৳) and পরিমাণ */}
                      <div className="grid grid-cols-2 gap-2.5">
                        <div>
                          <label className="block text-xs text-slate-500 dark:text-zinc-400 mb-1">
                            {pickText('পাইকারি রেট (৳)', 'Wholesale Rate (৳)')}
                          </label>
                          <input
                            type="number"
                            value={row.rate}
                            onChange={(e) => handleUpdateRow(row.id, 'rate', Number(e.target.value))}
                            className="w-full bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-xl px-3.5 py-2.5 text-sm font-bold text-slate-900 dark:text-white focus:outline-none"
                          />
                        </div>

                        <div>
                          <label className="block text-xs text-slate-500 dark:text-zinc-400 mb-1">
                            {pickText('পরিমাণ (পিস)', 'Quantity (pcs)')}
                          </label>
                          <input
                            type="number"
                            min={1}
                            value={row.quantity}
                            onChange={(e) =>
                              handleUpdateRow(row.id, 'quantity', Number(e.target.value))
                            }
                            className="w-full bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-xl px-3.5 py-2.5 text-sm font-bold text-slate-900 dark:text-white focus:outline-none"
                          />
                        </div>
                      </div>

                      <div className="flex items-center justify-between gap-2 pt-1">
                        <span className="text-xs font-medium text-slate-500 dark:text-zinc-400">
                          {row.category} • {pickText('সাইজ', 'Size')} {row.size}{row.color ? ` • ${row.color}` : ''}
                        </span>
                        <div className="flex items-center gap-3">
                          <span className="text-base font-extrabold text-slate-900 dark:text-white">
                            ৳{(row.rate * row.quantity).toLocaleString()}
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              orderRows.length > 1
                                ? handleRemoveRow(row.id)
                                : showToast(
                                    pickText('অন্তত ১টি রো থাকতে হবে', 'At least 1 row is required'),
                                    'info'
                                  )
                            }
                            className="p-2 rounded-xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 text-slate-500 hover:text-rose-500 transition cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    /* JERSEY ROW WITH WHOLESALE RATE */
                    <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-2.5">
                        {/* ক্যাটাগরি */}
                        <div>
                          <label className="block text-xs text-slate-500 dark:text-zinc-400 mb-1">
                            {pickText('ক্যাটাগরি', 'Category')}
                          </label>
                          <select
                            value={row.category}
                            onChange={(e) => handleUpdateRow(row.id, 'category', e.target.value)}
                            className="w-full bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-900 dark:text-white focus:outline-none"
                          >
                            <option value="Player Issue">Player Issue</option>
                            <option value="Fan Issue">Fan Issue Standard</option>
                            <option value="Retro Vintage">Retro Vintage Kit</option>
                            <option value="BD Premium">BD Premium Edition</option>
                            <option value="Other">{pickText('অন্যান্য পণ্য', 'Other Item')}</option>
                          </select>
                        </div>

                        {/* ক্লাব / দেশ */}
                        <div>
                          <label className="block text-xs text-slate-500 dark:text-zinc-400 mb-1">
                            {pickText('ক্লাব / দেশ', 'Club / Country')}
                          </label>
                          <select
                            value={row.clubOrCountry}
                            onChange={(e) =>
                              handleUpdateRow(row.id, 'clubOrCountry', e.target.value)
                            }
                            className="w-full bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-900 dark:text-white focus:outline-none"
                          >
                            {CLUBS_AND_COUNTRIES.map((team) => (
                              <option key={team} value={team}>
                                {team}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>

                      {/* Size Pills */}
                      <div className="grid grid-cols-6 gap-1.5">
                        {(['S', 'M', 'L', 'XL', 'XXL', '3XL'] as const).map((sz) => (
                          <button
                            key={sz}
                            type="button"
                            onClick={() => handleUpdateRow(row.id, 'size', sz)}
                            className={`py-2 text-xs font-bold rounded-xl border transition cursor-pointer ${
                              row.size === sz
                                ? 'bg-[#1f8a5b] text-white border-[#1f8a5b] shadow-2xs'
                                : 'bg-white dark:bg-zinc-900 text-slate-700 dark:text-zinc-300 border-slate-200 dark:border-zinc-700'
                            }`}
                          >
                            {sz}
                          </button>
                        ))}
                      </div>

                      {/* রেট (৳) and পরিমাণ */}
                      <div className="grid grid-cols-2 gap-2.5">
                        <div>
                          <label className="block text-xs text-slate-500 dark:text-zinc-400 mb-1">
                            {pickText('রেট (৳)', 'Rate (৳)')}
                          </label>
                          <input
                            type="number"
                            value={row.rate}
                            onChange={(e) => handleUpdateRow(row.id, 'rate', Number(e.target.value))}
                            className="w-full bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-xl px-3.5 py-2.5 text-sm font-bold text-slate-900 dark:text-white focus:outline-none"
                          />
                        </div>

                        <div>
                          <label className="block text-xs text-slate-500 dark:text-zinc-400 mb-1">
                            {pickText('পরিমাণ', 'Quantity')}
                          </label>
                          <input
                            type="number"
                            min={1}
                            value={row.quantity}
                            onChange={(e) =>
                              handleUpdateRow(row.id, 'quantity', Number(e.target.value))
                            }
                            className="w-full bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-xl px-3.5 py-2.5 text-sm font-bold text-slate-900 dark:text-white focus:outline-none"
                          />
                        </div>
                      </div>

                      {/* Bottom Row: কাস্টম প্রিন্ট, Row Subtotal, Delete */}
                      <div className="flex items-center justify-between gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => setCustomizingRowId(row.id)}
                          className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold border transition cursor-pointer ${
                            row.customization
                              ? 'bg-[#e6f4ea] text-[#1f8a5b] border-emerald-300 font-bold'
                              : 'bg-white dark:bg-zinc-900 text-slate-700 dark:text-zinc-300 border-slate-200 dark:border-zinc-700'
                          }`}
                        >
                          <Flame className="w-3.5 h-3.5 text-slate-500" />
                          <span>
                            {row.customization
                              ? `${row.customization.customName} #${row.customization.customNumber}`
                              : pickText('কাস্টম প্রিন্ট', 'Custom Print')}
                          </span>
                        </button>

                        <div className="flex items-center gap-3">
                          <span className="text-base font-extrabold text-slate-900 dark:text-white">
                            ৳{(row.rate * row.quantity).toLocaleString()}
                          </span>

                          <button
                            type="button"
                            onClick={() =>
                              orderRows.length > 1
                                ? handleRemoveRow(row.id)
                                : showToast(
                                    pickText('অন্তত ১টি রো থাকতে হবে', 'At least 1 row is required'),
                                    'info'
                                  )
                            }
                            className="p-2 rounded-xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 text-slate-500 hover:text-rose-500 transition cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Quick Add Row Dashed Buttons (+ পোশাক / + জার্সি / + অন্যান্য) */}
            <div className="grid grid-cols-2 gap-3 pt-1">
              <button
                type="button"
                onClick={handleAddJerseyRow}
                className="py-2.5 px-3 rounded-xl border border-dashed border-slate-300 dark:border-zinc-700 text-slate-700 dark:text-zinc-300 hover:border-[#1f8a5b] text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer transition"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{isClothingStore ? pickText('পোশাক', 'Apparel') : pickText('জার্সি', 'Jersey')}</span>
              </button>
              <button
                type="button"
                onClick={handleAddOtherRow}
                className="py-2.5 px-3 rounded-xl border border-dashed border-slate-300 dark:border-zinc-700 text-slate-700 dark:text-zinc-300 hover:border-[#1f8a5b] text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer transition"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{pickText('অন্যান্য', 'Other')}</span>
              </button>
            </div>

            <div className="flex items-center justify-between text-xs sm:text-sm pt-1">
              <span className="text-slate-500 dark:text-zinc-400">
                {pickText('মোট আইটেম', 'Total Items')}
              </span>
              <strong className="text-slate-900 dark:text-white font-extrabold">
                {totalQuantity} {pickText('টি', 'pcs')}
              </strong>
            </div>
          </div>

          {/* বিল ও পরিশোধ Card */}
          <div className="bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 rounded-3xl p-4 sm:p-5 space-y-4 shadow-2xs">
            <div className="flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-[#1f8a5b] dark:text-emerald-400" />
              <h3 className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-white">
                {pickText('বিল ও পরিশোধ', 'Bill & Settlement')}
              </h3>
            </div>

            <div className="space-y-3 text-sm">
              <div className="flex justify-between items-center text-slate-600 dark:text-zinc-400">
                <span>{pickText('সাবটোটাল', 'Subtotal')}</span>
                <span className="font-bold text-slate-900 dark:text-white">
                  ৳{orderSubtotal.toLocaleString()}
                </span>
              </div>

              <div className="flex justify-between items-center text-slate-600 dark:text-zinc-400">
                <span>{pickText('ছাড়', 'Discount')}</span>
                <input
                  type="number"
                  min={0}
                  value={discount || ''}
                  onChange={(e) => setDiscount(Number(e.target.value))}
                  placeholder="0"
                  className="w-32 bg-[#f2f5f3] dark:bg-zinc-800 border border-slate-200/80 dark:border-zinc-700 rounded-xl px-3 py-1.5 text-sm text-right text-slate-900 dark:text-white focus:outline-none"
                />
              </div>

              <div className="pt-2 border-t border-slate-100 dark:border-zinc-800 flex justify-between items-center">
                <span className="font-bold text-slate-900 dark:text-white">
                  {pickText('এই বিল', 'Current Bill')}
                </span>
                <span className="text-lg font-extrabold text-slate-900 dark:text-white">
                  ৳{netTotal.toLocaleString()}
                </span>
              </div>

              <div className="flex justify-between items-center text-slate-500 dark:text-zinc-400">
                <span>{pickText('পূর্বের বাকি', 'Previous Due')}</span>
                <span className="font-bold text-slate-900 dark:text-white">
                  ৳{prevDue.toLocaleString()}
                </span>
              </div>

              <div className="flex justify-between items-center">
                <span className="font-bold text-slate-900 dark:text-white">
                  {pickText('সর্বমোট প্রাপ্য', 'Total Receivable')}
                </span>
                <span className="font-extrabold text-slate-900 dark:text-white">
                  ৳{(netTotal + prevDue).toLocaleString()}
                </span>
              </div>
            </div>

            {/* Payment Option Pills: নগদ / আংশিক / পুরো বাকি */}
            <div className="grid grid-cols-3 gap-2 pt-1">
              <button
                type="button"
                onClick={() => {
                  setPaymentMode('paid');
                  setAdvancePaid(netTotal);
                }}
                className={`py-2.5 rounded-xl text-xs sm:text-sm font-bold transition cursor-pointer ${
                  paymentMode === 'paid'
                    ? 'bg-[#1f8a5b] text-white shadow-xs'
                    : 'bg-[#f2f5f3] dark:bg-zinc-800 text-slate-600 dark:text-zinc-300'
                }`}
              >
                {pickText('নগদ', 'Full Paid')}
              </button>
              <button
                type="button"
                onClick={() => {
                  setPaymentMode('partial');
                  setAdvancePaid(0);
                }}
                className={`py-2.5 rounded-xl text-xs sm:text-sm font-bold transition cursor-pointer ${
                  paymentMode === 'partial'
                    ? 'bg-[#1f8a5b] text-white shadow-xs'
                    : 'bg-[#f2f5f3] dark:bg-zinc-800 text-slate-600 dark:text-zinc-300'
                }`}
              >
                {pickText('আংশিক', 'Partial')}
              </button>
              <button
                type="button"
                onClick={() => {
                  setPaymentMode('credit');
                  setAdvancePaid(0);
                }}
                className={`py-2.5 rounded-xl text-xs sm:text-sm font-bold transition cursor-pointer ${
                  paymentMode === 'credit'
                    ? 'bg-[#1f8a5b] text-white shadow-xs'
                    : 'bg-[#f2f5f3] dark:bg-zinc-800 text-slate-600 dark:text-zinc-300'
                }`}
              >
                {pickText('পুরো বাকি', 'Full Due')}
              </button>
            </div>

            {paymentMode !== 'credit' && (
              <div className="space-y-3">
                {paymentMode === 'partial' && (
                  <div>
                    <label className="block text-xs text-slate-500 dark:text-zinc-400 mb-1">
                      {pickText('জমা (৳)', 'Paid Amount (৳)')}
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={netTotal}
                      value={advancePaid}
                      onChange={(e) => setAdvancePaid(Number(e.target.value))}
                      className="w-full bg-[#f2f5f3] dark:bg-zinc-800 border border-slate-200/80 dark:border-zinc-700 rounded-xl px-3.5 py-2.5 text-sm font-bold text-slate-900 dark:text-white focus:outline-none"
                    />
                  </div>
                )}

                {/* Payment Method Selector for Reseller Counter */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs text-slate-500 dark:text-zinc-400">
                      {pickText('পেমেন্ট মাধ্যম (Payment Method)', 'Payment Method')}
                    </label>
                    {paymentChannel === 'split' && (
                      <button
                        type="button"
                        onClick={() => setSplitModalOpen(true)}
                        className="text-[11px] font-bold text-[#1f8a5b] dark:text-emerald-400 underline cursor-pointer"
                      >
                        {pickText('স্প্লিট কনফিগার করুন', 'Configure Split')}
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-3 gap-1.5 bg-[#f2f5f3] dark:bg-zinc-800 p-1.5 rounded-2xl text-center">
                    {(
                      [
                        { key: 'cash', label: 'Cash' },
                        { key: 'merchantBkash', label: 'bKash Merch.' },
                        { key: 'personalBkash', label: 'bKash Pers.' },
                        { key: 'nagad', label: 'Nagad' },
                        { key: 'bank', label: 'Bank/Card' },
                        { key: 'split', label: 'Split' },
                      ] as const
                    ).map((ch) => (
                      <button
                        key={ch.key}
                        type="button"
                        onClick={() => {
                          setPaymentChannel(ch.key);
                          if (ch.key === 'split') setSplitModalOpen(true);
                        }}
                        className={`py-2 px-1 rounded-xl text-[11px] font-bold transition cursor-pointer ${
                          paymentChannel === ch.key
                            ? 'bg-white dark:bg-zinc-900 text-[#1f8a5b] dark:text-emerald-400 shadow-2xs'
                            : 'text-slate-500 dark:text-zinc-400 hover:text-slate-800'
                        }`}
                      >
                        {ch.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Split Payment Complete Breakdown Card in Reseller Counter */}
                {paymentChannel === 'split' && (
                  <div className="bg-[#f4f7f5] dark:bg-zinc-800/70 border border-emerald-300/70 dark:border-emerald-800/60 rounded-2xl p-3 space-y-1.5 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-[#164e3f] dark:text-emerald-400">
                        {pickText(
                          `Split Payment বিবরণ (জমা: ৳${effectivePaid.toLocaleString()})`,
                          `Split Payment Breakdown (Paid: ৳${effectivePaid.toLocaleString()})`
                        )}
                      </span>
                      <button
                        type="button"
                        onClick={() => setSplitModalOpen(true)}
                        className="text-[11px] font-bold text-[#1f8a5b] underline cursor-pointer"
                      >
                        {pickText('এডিট স্প্লিট', 'Edit Split')}
                      </button>
                    </div>
                    {(() => {
                      const activeEntries = getActiveSplitEntries(splitBreakdown);
                      const splitSum = calculateSplitTotal(splitBreakdown);
                      return activeEntries.length > 0 ? (
                        <div className="space-y-1">
                          {activeEntries.map((entry) => (
                            <div
                              key={entry.key}
                              className="flex items-center justify-between text-slate-700 dark:text-zinc-200"
                            >
                              <span>• {entry.label}:</span>
                              <span className="font-mono font-bold">৳{entry.amount.toLocaleString()}</span>
                            </div>
                          ))}
                          <div className="border-t border-slate-200 dark:border-zinc-700 pt-1 flex items-center justify-between font-bold">
                            <span>{pickText('মোট স্প্লিট যোগফল:', 'Total Split Sum:')}</span>
                            <span
                              className={
                                splitSum === effectivePaid
                                  ? 'text-[#1f8a5b] font-mono'
                                  : 'text-amber-600 font-mono'
                              }
                            >
                              ৳{splitSum.toLocaleString()} / ৳{effectivePaid.toLocaleString()}
                            </span>
                          </div>
                        </div>
                      ) : (
                        <div className="text-amber-600 dark:text-amber-400">
                          {pickText(
                            'কোনো স্প্লিট পেমেন্ট কনফিগার করা হয়নি। উপরে "স্প্লিট কনফিগার করুন" ক্লিক করুন।',
                            'No split payment configured. Click "Configure Split" above.'
                          )}
                        </div>
                      );
                    })()}
                  </div>
                )}
              </div>
            )}

            <div className="flex justify-between items-center text-sm pt-1">
              <span className="font-bold text-slate-900 dark:text-white">
                {pickText('নতুন বাকি থাকবে', 'Projected New Due')}
              </span>
              <span className="font-extrabold text-slate-900 dark:text-white">
                ৳{projectedNewDue.toLocaleString()}
              </span>
            </div>

            <button
              type="button"
              onClick={handleConfirmResellerSale}
              className="w-full py-3.5 rounded-2xl bg-[#1f8a5b] hover:bg-[#164e3f] text-white font-bold text-sm flex items-center justify-center gap-2 transition shadow-sm cursor-pointer"
            >
              <CheckCircle className="w-4 h-4" />
              <span>{pickText('বিক্রি সম্পন্ন করুন', 'Complete Wholesale Sale')}</span>
            </button>
          </div>
        </div>
      )}

      {/* VIEW 2: RESELLER BAKI KHATA LEDGER STATEMENTS */}
      {activeView === 'ledger' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Resellers directory */}
          <div className="lg:col-span-5 space-y-3">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={pickText(
                  'রিসেলারের নাম বা ফোন দিয়ে খুঁজুন...',
                  'Search reseller by name or phone...'
                )}
                className="w-full bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl pl-10 pr-4 py-2.5 text-xs sm:text-sm text-slate-900 dark:text-white focus:outline-none focus:border-[#1f8a5b]"
              />
            </div>

            <div className="space-y-2.5 max-h-[600px] overflow-y-auto">
              {resellers
                .filter(
                  (r) =>
                    r.name.toLowerCase().includes(search.toLowerCase()) ||
                    r.phone.includes(search) ||
                    r.location.toLowerCase().includes(search.toLowerCase())
                )
                .map((reseller) => (
                  <div
                    key={reseller.id}
                    onClick={() => setLedgerSelectedReseller(reseller)}
                    className={`p-4 rounded-2xl border transition cursor-pointer ${
                      ledgerSelectedReseller?.id === reseller.id
                        ? 'bg-[#e6f4ea]/60 dark:bg-emerald-950/30 border-[#1f8a5b] shadow-2xs'
                        : 'bg-white dark:bg-zinc-900 border-slate-200/80 dark:border-zinc-800 hover:border-emerald-300'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                          {reseller.name}
                        </h4>
                        <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
                          {reseller.phone} · {reseller.location}
                        </p>
                      </div>

                      <div className="text-right">
                        <span className="text-[10px] text-slate-400 uppercase font-semibold">
                          {pickText('বাকি ব্যালেন্স', 'Due Balance')}
                        </span>
                        <div
                          className={`text-base font-extrabold font-mono ${
                            reseller.currentDueBalance > 0
                              ? 'text-rose-600 dark:text-rose-400'
                              : 'text-[#1f8a5b] dark:text-emerald-400'
                          }`}
                        >
                          ৳{reseller.currentDueBalance.toLocaleString()}
                        </div>
                      </div>
                    </div>

                    <div className="mt-3 pt-2 border-t border-slate-100 dark:border-zinc-800 flex items-center justify-between text-xs text-slate-500 dark:text-zinc-400">
                      <span>
                        {pickText('মোট লট:', 'Total Lots:')}{' '}
                        <strong className="text-slate-800 dark:text-zinc-200">{reseller.ordersCount}</strong>
                      </span>
                      <span>
                        {pickText('টার্নওভার:', 'Turnover:')}{' '}
                        <strong className="text-slate-800 dark:text-zinc-200">
                          ৳{reseller.totalPurchased.toLocaleString()}
                        </strong>
                      </span>
                    </div>
                  </div>
                ))}
            </div>
          </div>

          {/* Selected Reseller Ledger Statement */}
          <div className="lg:col-span-7">
            {ledgerSelectedReseller ? (
              <div className="bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 rounded-3xl p-4 sm:p-5 space-y-5 shadow-2xs">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-100 dark:border-zinc-800 gap-3">
                  <div>
                    <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                      {ledgerSelectedReseller.name}
                    </h3>
                    <div className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
                      {ledgerSelectedReseller.phone} • {ledgerSelectedReseller.location}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        setSelectedResellerId(ledgerSelectedReseller.id);
                        setActiveView('counter');
                      }}
                      className="flex items-center gap-1 bg-[#e6f4ea] text-[#1f8a5b] px-3 py-2 rounded-xl text-xs font-bold transition cursor-pointer"
                    >
                      <Shirt className="w-3.5 h-3.5" />
                      {pickText('+ নতুন বিল', '+ New Bill')}
                    </button>

                    <button
                      onClick={() => {
                        setPaymentAmount(
                          Math.min(ledgerSelectedReseller.currentDueBalance, 5000) || 1000
                        );
                        setPaymentModalOpen(true);
                      }}
                      className="flex items-center gap-1 bg-[#1f8a5b] hover:bg-[#164e3f] text-white px-3.5 py-2 rounded-xl text-xs font-bold transition shadow-xs cursor-pointer"
                    >
                      <ArrowDownLeft className="w-3.5 h-3.5" />
                      {pickText('৳ বাকি আদায়', '৳ Collect Due')}
                    </button>
                  </div>
                </div>

                {/* Baki Khata Transaction History */}
                <div className="space-y-2.5">
                  <h4 className="text-xs font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider">
                    {pickText('লেজার স্টেটমেন্ট ও চালানের ইতিহাস', 'Ledger Statement & Dispatch History')}
                  </h4>

                  <div className="border border-slate-200/80 dark:border-zinc-800 rounded-2xl overflow-hidden">
                    {ledgerSelectedReseller.transactions.length === 0 ? (
                      <div className="p-6 text-center text-xs text-slate-400">
                        {pickText('এখনো কোনো লেজার লেনদেন রেকর্ড করা হয়নি', 'No ledger transactions recorded yet')}
                      </div>
                    ) : (
                      <>
                        {/* Mobile Compact Statement Rows (< 768px) */}
                        <div className="md:hidden divide-y divide-slate-100 dark:divide-zinc-800">
                          {ledgerSelectedReseller.transactions.map((tx) => (
                            <button
                              key={tx.id}
                              type="button"
                              onClick={() => setSelectedResellerTx(tx)}
                              className="w-full px-3.5 py-2.5 text-left flex items-center justify-between gap-2.5 hover:bg-slate-50 dark:hover:bg-zinc-800/40 transition cursor-pointer"
                            >
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-1.5">
                                  <span
                                    className={`text-[10px] px-1.5 py-0.2 rounded font-bold shrink-0 ${
                                      tx.type === 'dispatch'
                                        ? 'bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300'
                                        : tx.type === 'opening_balance'
                                        ? 'bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300'
                                        : 'bg-[#e6f4ea] dark:bg-emerald-950/50 text-[#1f8a5b] dark:text-emerald-300'
                                    }`}
                                  >
                                    {tx.type === 'dispatch'
                                      ? pickText('চালান', 'Dispatch')
                                      : tx.type === 'opening_balance'
                                      ? pickText('পূর্বের বাকি', 'Opening Due')
                                      : pickText('জমা', 'Paid')}
                                  </span>
                                  <span className="font-semibold text-xs text-slate-900 dark:text-white truncate">
                                    {tx.note}
                                  </span>
                                </div>
                                <div className="text-[11px] font-mono text-slate-400 mt-0.5">
                                  {tx.date} • {tx.slipNumber}
                                </div>
                              </div>

                              <div className="flex items-center gap-2 shrink-0">
                                <div className="text-right font-mono">
                                  <div
                                    className={`text-xs font-bold ${
                                      tx.type === 'payment_received'
                                        ? 'text-[#1f8a5b] dark:text-emerald-400'
                                        : 'text-amber-600 dark:text-amber-400'
                                    }`}
                                  >
                                    {tx.type === 'payment_received' ? '-' : '+'}৳{tx.amount.toLocaleString()}
                                  </div>
                                  <div className="text-[10px] text-slate-500">
                                    Bal: ৳{tx.balanceAfter.toLocaleString()}
                                  </div>
                                </div>
                                <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
                              </div>
                            </button>
                          ))}
                        </div>

                        {/* Desktop Table (>= 768px) */}
                        <div className="hidden md:block overflow-x-auto">
                          <table className="w-full text-left text-xs text-slate-700 dark:text-zinc-300">
                            <thead className="bg-[#f4f7f5] dark:bg-zinc-800 border-b border-slate-200/80 dark:border-zinc-800 text-[11px] text-slate-500 dark:text-zinc-400 uppercase font-semibold">
                              <tr>
                                <th className="p-3">{pickText('তারিখ ও স্লিপ', 'Date & Slip')}</th>
                                <th className="p-3">{pickText('বিবরণ', 'Particulars')}</th>
                                <th className="p-3 text-right">{pickText('চালান (+)', 'Bill (+)')}</th>
                                <th className="p-3 text-right">{pickText('আদায় (-)', 'Collected (-)')}</th>
                                <th className="p-3 text-right">{pickText('বাকি', 'Balance')}</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
                              {ledgerSelectedReseller.transactions.map((tx) => (
                                <tr
                                  key={tx.id}
                                  onClick={() => setSelectedResellerTx(tx)}
                                  className="hover:bg-slate-50 dark:hover:bg-zinc-800/40 cursor-pointer"
                                >
                                  <td className="p-3">
                                    <div className="font-bold text-slate-900 dark:text-white">
                                      {tx.date}
                                    </div>
                                    <div className="text-[10px] font-mono text-slate-400">
                                      {tx.slipNumber}
                                    </div>
                                  </td>
                                  <td className="p-3">
                                    <span
                                      className={`text-[10px] px-1.5 py-0.5 rounded font-bold mr-1.5 ${
                                        tx.type === 'dispatch'
                                          ? 'bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300'
                                          : tx.type === 'opening_balance'
                                          ? 'bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300'
                                          : 'bg-[#e6f4ea] dark:bg-emerald-950/50 text-[#1f8a5b] dark:text-emerald-300'
                                      }`}
                                    >
                                      {tx.type === 'dispatch'
                                        ? pickText('চালান', 'Dispatch')
                                        : tx.type === 'opening_balance'
                                        ? pickText('পূর্বের বাকি', 'Opening Due')
                                        : pickText('জমা', 'Paid')}
                                    </span>
                                    <span className="text-xs">{tx.note}</span>
                                  </td>
                                  <td className="p-3 text-right font-mono font-bold text-amber-600 dark:text-amber-400">
                                    {tx.type === 'dispatch' || tx.type === 'opening_balance'
                                      ? `+৳${tx.amount.toLocaleString()}`
                                      : '-'}
                                  </td>
                                  <td className="p-3 text-right font-mono font-bold text-[#1f8a5b] dark:text-emerald-400">
                                    {tx.type === 'payment_received'
                                      ? `-৳${tx.amount.toLocaleString()}`
                                      : '-'}
                                  </td>
                                  <td className="p-3 text-right font-mono font-extrabold text-slate-900 dark:text-white">
                                    ৳{tx.balanceAfter.toLocaleString()}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 rounded-3xl p-12 text-center text-slate-400 text-xs">
                {pickText(
                  'রিসেলার সিলেক্ট করে তাদের বাকি খাতা লেজার স্টেটমেন্ট দেখুন',
                  'Select a reseller to view their ledger statement'
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL: COMPLETED RESELLER MEMO & SLIP */}
      {completedSale && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-3xl max-w-lg w-full p-5 sm:p-6 shadow-2xl text-slate-900 dark:text-zinc-100 relative my-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-zinc-800">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-[#e6f4ea] text-[#1f8a5b] flex items-center justify-center">
                  <CheckCircle className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                    {pickText('রিসেলার চালান মেমো তৈরি হয়েছে!', 'Reseller Wholesale Memo Generated!')}
                  </h4>
                  <p className="text-[11px] text-slate-500 font-mono">
                    #{completedSale.invoice.invoiceNo}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setCompletedSale(null)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Memo Printable Layout */}
            <div
              id="printable-reseller-memo"
              className="bg-[#f8faf9] text-slate-950 p-4 rounded-2xl border border-slate-200 text-xs space-y-3"
            >
              <div className="text-center border-b pb-2 border-slate-200">
                <h3 className="font-black text-sm uppercase tracking-wide">{currentTenant.name}</h3>
                <p className="text-[10px] text-slate-500">
                  {pickText('রিসেলার পাইকারি চালান (Wholesale Reseller Memo)', 'Wholesale Reseller Memo')}
                </p>
                <p className="text-[9px] text-slate-400 font-mono">
                  {pickText('তারিখ:', 'Date:')} {new Date(completedSale.invoice.createdAt).toLocaleDateString()}
                </p>
              </div>

              <div className="text-[11px] border-b pb-2 border-slate-200 space-y-0.5">
                <div>
                  <strong>{pickText('রিসেলার:', 'Reseller:')}</strong> {completedSale.reseller.name}
                </div>
                <div>
                  <strong>{pickText('ফোন:', 'Phone:')}</strong> {completedSale.reseller.phone} •{' '}
                  <strong>{pickText('ঠিকানা:', 'Address:')}</strong> {completedSale.reseller.location}
                </div>
              </div>

              <div className="space-y-1">
                <table className="w-full text-left text-[11px]">
                  <thead>
                    <tr className="border-b border-slate-300 font-bold text-[10px] text-slate-500 uppercase">
                      <th className="py-1">{pickText('পণ্য ও সাইজ', 'Item & Size')}</th>
                      <th className="py-1 text-center">{pickText('পরিমাণ', 'Qty')}</th>
                      <th className="py-1 text-right">{pickText('দর', 'Rate')}</th>
                      <th className="py-1 text-right">{pickText('মোট', 'Total')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200/60">
                    {completedSale.invoice.items.map((it, idx) => (
                      <tr key={idx}>
                        <td className="py-1">
                          <span className="font-semibold">{it.title}</span>
                          <span className="text-[9px] text-slate-500 block font-mono">
                            ({it.size})
                          </span>
                        </td>
                        <td className="py-1 text-center">{it.quantity}</td>
                        <td className="py-1 text-right font-mono">৳{it.rate}</td>
                        <td className="py-1 text-right font-mono font-bold">৳{it.subtotal}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="border-t pt-2 border-slate-300 space-y-1 text-[11px]">
                <div className="flex justify-between">
                  <span>{pickText('বর্তমান চালান মোট:', 'Current Memo Total:')}</span>
                  <span className="font-bold font-mono">
                    ৳{completedSale.invoice.total.toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between text-[#1f8a5b]">
                  <span>
                    {pickText('পরিশোধ করা হয়েছে', 'Paid Amount')} ({completedSale.invoice.paymentChannel}):
                  </span>
                  <span className="font-bold font-mono">
                    ৳{completedSale.invoice.advancePaid.toLocaleString()}
                  </span>
                </div>
                {completedSale.invoice.paymentChannel === 'split' &&
                  completedSale.invoice.splitBreakdown && (
                    <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-2 space-y-0.5 text-[10px] text-slate-700">
                      <div className="font-bold text-[#164e3f]">
                        {pickText('Split Payment বিবরণ:', 'Split Payment Breakdown:')}
                      </div>
                      {getActiveSplitEntries(completedSale.invoice.splitBreakdown).map((entry) => (
                        <div key={entry.key} className="flex justify-between">
                          <span>• {entry.label}:</span>
                          <span className="font-mono font-bold">৳{entry.amount.toLocaleString()}</span>
                        </div>
                      ))}
                    </div>
                  )}
                <div className="flex justify-between text-rose-600 font-bold">
                  <span>{pickText('বর্তমান চালানের বাকি:', 'Current Memo Due:')}</span>
                  <span className="font-mono">
                    ৳{completedSale.invoice.dueAmount.toLocaleString()}
                  </span>
                </div>
                <div className="border-t border-dashed border-slate-300 pt-1 flex justify-between font-black text-xs text-rose-700">
                  <span>{pickText('সর্বমোট বাকি ব্যালেন্স:', 'Total Due Balance:')}</span>
                  <span className="font-mono">৳{completedSale.newBalance.toLocaleString()}</span>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-2 pt-1">
              <button
                type="button"
                onClick={handleSendWhatsAppMemo}
                className="flex-1 py-2.5 rounded-xl bg-[#1f8a5b] hover:bg-[#164e3f] text-white font-bold text-xs flex items-center justify-center gap-1.5 transition cursor-pointer"
              >
                <Phone className="w-4 h-4" />
                {pickText('WhatsApp চালান পাঠান', 'Send WhatsApp Memo')}
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className="py-2.5 px-4 rounded-xl border border-slate-200 dark:border-zinc-700 text-xs font-semibold text-slate-700 dark:text-zinc-300 transition cursor-pointer flex items-center gap-1.5"
              >
                <Printer className="w-4 h-4" />
                {pickText('প্রিন্ট', 'Print')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: ADD NEW RESELLER */}
      {addModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-3xl max-w-md w-full p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-zinc-800">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Truck className="w-4 h-4 text-[#1f8a5b]" />
                {pickText('নতুন রিসেলার যোগ করুন', 'Add New Reseller')}
              </h3>
              <button
                onClick={() => setAddModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateReseller} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-700 dark:text-zinc-300 font-semibold mb-1">
                  {pickText('রিসেলারের নাম / পেইজের নাম *', 'Reseller / Page Name *')}
                </label>
                <input
                  type="text"
                  required
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder={pickText('যেমন: ধানমন্ডি জার্সি পয়েন্ট', 'e.g. Dhanmondi Fashion Point')}
                  className="w-full bg-[#f4f7f5] dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl px-3.5 py-2.5 text-slate-900 dark:text-white focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-700 dark:text-zinc-300 font-semibold mb-1">
                  {pickText('মোবাইল / WhatsApp নম্বর *', 'Phone / WhatsApp Number *')}
                </label>
                <input
                  type="text"
                  required
                  value={newPhone}
                  onChange={(e) => setNewPhone(e.target.value)}
                  placeholder={pickText('যেমন: 01712000000', 'e.g. 01712000000')}
                  className="w-full bg-[#f4f7f5] dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl px-3.5 py-2.5 text-slate-900 dark:text-white focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-700 dark:text-zinc-300 font-semibold mb-1">
                  {pickText('দোকানের ঠিকানা বা এলাকা', 'Shop Address or Area')}
                </label>
                <input
                  type="text"
                  value={newLocation}
                  onChange={(e) => setNewLocation(e.target.value)}
                  placeholder={pickText('যেমন: মিরপুর ১০, ঢাকা', 'e.g. Mirpur 10, Dhaka')}
                  className="w-full bg-[#f4f7f5] dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl px-3.5 py-2.5 text-slate-900 dark:text-white focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-700 dark:text-zinc-300 font-semibold mb-1">
                  {pickText('পূর্বের বাকি (Previous Due ৳)', 'Previous Due (৳)')}
                </label>
                <input
                  type="number"
                  min={0}
                  value={newPreviousDue}
                  onChange={(e) => setNewPreviousDue(e.target.value)}
                  placeholder="0"
                  className="w-full bg-[#f4f7f5] dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl px-3.5 py-2.5 font-bold text-rose-600 dark:text-rose-400 focus:outline-none"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setAddModalOpen(false)}
                  className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-zinc-700 text-slate-600 dark:text-zinc-400 font-semibold"
                >
                  {pickText('বাতিল', 'Cancel')}
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-[#1f8a5b] hover:bg-[#164e3f] text-white font-bold"
                >
                  {pickText('সংরক্ষণ করুন', 'Save Reseller')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: COLLECT BAKI PAYMENT */}
      {paymentModalOpen && ledgerSelectedReseller && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-3xl max-w-md w-full p-5 space-y-4 shadow-2xl text-xs">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-zinc-800">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <ArrowDownLeft className="w-4 h-4 text-[#1f8a5b]" />
                {pickText('বাকি টাকা আদায়', 'Collect Due Payment')}
              </h3>
              <button
                onClick={() => setPaymentModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="bg-[#f4f7f5] dark:bg-zinc-800 p-3.5 rounded-2xl">
              <div className="font-bold text-slate-900 dark:text-white">
                {ledgerSelectedReseller.name}
              </div>
              <div className="text-slate-500 dark:text-zinc-400 text-[11px] mt-0.5">
                {pickText('বর্তমান মোট বাকি:', 'Current Total Due:')}{' '}
                <strong className="text-rose-600 font-mono">
                  ৳{ledgerSelectedReseller.currentDueBalance.toLocaleString()}
                </strong>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-slate-700 dark:text-zinc-300 font-semibold mb-1">
                  {pickText('আদায়কৃত টাকার পরিমাণ (৳) *', 'Collected Amount (৳) *')}
                </label>
                <input
                  type="number"
                  min={1}
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(Number(e.target.value))}
                  className="w-full bg-[#f4f7f5] dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl px-3.5 py-2.5 text-slate-900 dark:text-white font-bold focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-700 dark:text-zinc-300 font-semibold mb-1">
                  {pickText('টাকা জমা নেওয়ার ড্রয়ার/অ্যাকাউন্ট', 'Deposit Drawer / Account')}
                </label>
                <select
                  value={paymentDrawer}
                  onChange={(e) => setPaymentDrawer(e.target.value as DrawerType)}
                  className="w-full bg-[#f4f7f5] dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl px-3.5 py-2.5 text-slate-900 dark:text-white focus:outline-none"
                >
                  <option value="merchantBkash">Merchant bKash</option>
                  <option value="personalBkash">Personal bKash</option>
                  <option value="cash">Physical Cash Drawer</option>
                  <option value="nagad">Nagad</option>
                  <option value="bank">Bank</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-700 dark:text-zinc-300 font-semibold mb-1">
                  {pickText('নোট / রেফারেন্স', 'Note / Reference')}
                </label>
                <input
                  type="text"
                  value={paymentNote}
                  onChange={(e) => setPaymentNote(e.target.value)}
                  className="w-full bg-[#f4f7f5] dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl px-3.5 py-2.5 text-slate-900 dark:text-white focus:outline-none"
                />
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setPaymentModalOpen(false)}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-zinc-700 text-slate-600 dark:text-zinc-400 font-semibold"
              >
                {pickText('বাতিল', 'Cancel')}
              </button>
              <button
                type="button"
                onClick={() => {
                  if (paymentAmount <= 0) {
                    showToast(
                      pickText('টাকার পরিমাণ লিখুন', 'Please enter a valid amount'),
                      'error'
                    );
                    return;
                  }
                  dbService.recordResellerPayment(
                    currentTenant.id,
                    ledgerSelectedReseller.id,
                    paymentAmount,
                    paymentDrawer,
                    paymentNote
                  );
                  reload();
                  setPaymentModalOpen(false);
                  showToast(
                    pickText(
                      `৳${paymentAmount.toLocaleString()} পেমেন্ট সফলভাবে জমা নেওয়া হয়েছে!`,
                      `Payment of ৳${paymentAmount.toLocaleString()} recorded successfully!`
                    ),
                    'success'
                  );
                }}
                className="flex-1 py-2.5 rounded-xl bg-[#1f8a5b] hover:bg-[#164e3f] text-white font-bold"
              >
                {pickText('পেমেন্ট কনফার্ম করুন', 'Confirm Payment')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* HEAT-PRESS CUSTOMIZATION MODAL */}
      {customizingRowId && (
        <CustomizationModal
          isOpen={!!customizingRowId}
          onClose={() => setCustomizingRowId(null)}
          onSave={(customData: JerseyCustomization) => {
            handleUpdateRow(customizingRowId, 'customization', customData);
            setCustomizingRowId(null);
          }}
          initialData={orderRows.find((r) => r.id === customizingRowId)?.customization}
        />
      )}

      {/* SPLIT PAYMENT MODAL FOR RESELLER COUNTER */}
      {splitModalOpen && (
        <SplitPaymentModal
          isOpen={splitModalOpen}
          onClose={() => setSplitModalOpen(false)}
          totalAmount={effectivePaid}
          initialBreakdown={splitBreakdown}
          isPartialAdvance={paymentMode === 'partial'}
          maxBillTotal={netTotal}
          onConfirm={(breakdown, confirmedTargetAmount) => {
            setSplitBreakdown(breakdown);
            if (paymentMode === 'partial') {
              setAdvancePaid(confirmedTargetAmount);
            }
            showToast(
              pickText(
                `রিসেলার স্প্লিট পেমেন্ট সেট হয়েছে: ${formatSplitSummaryText(breakdown)}`,
                `Reseller split payment configured: ${formatSplitSummaryText(breakdown)}`
              ),
              'info'
            );
          }}
        />
      )}

      {/* Compact Bottom Sheet for Reseller Statement Entry */}
      <BottomSheet
        isOpen={Boolean(selectedResellerTx)}
        onClose={() => setSelectedResellerTx(null)}
        title={selectedResellerTx ? `Slip #${selectedResellerTx.slipNumber}` : 'Statement Entry'}
        subtitle={selectedResellerTx ? `Date: ${selectedResellerTx.date}` : undefined}
        maxHeightClass="max-h-[45dvh]"
      >
        {selectedResellerTx && (
          <div className="space-y-2.5">
            <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 dark:bg-zinc-800/60">
              <span className="text-slate-500">
                {pickText('লেনদেনের পরিমাণ', 'Transaction Amount')}
              </span>
              <span
                className={`font-mono font-black text-sm ${
                  selectedResellerTx.type === 'payment_received'
                    ? 'text-[#1f8a5b] dark:text-emerald-400'
                    : 'text-amber-600 dark:text-amber-400'
                }`}
              >
                {selectedResellerTx.type === 'payment_received' ? '-' : '+'}৳
                {selectedResellerTx.amount.toLocaleString()}
              </span>
            </div>
            <div className="space-y-1.5">
              <div className="flex justify-between">
                <span className="text-slate-500">
                  {pickText('পরবর্তী বাকি ব্যালেন্স', 'Running Balance After')}
                </span>
                <span className="font-mono font-bold text-slate-900 dark:text-white">
                  ৳{selectedResellerTx.balanceAfter.toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">{pickText('লেনদেনের ধরন', 'Entry Type')}</span>
                <span className="font-bold text-slate-900 dark:text-white uppercase">
                  {selectedResellerTx.type === 'payment_received'
                    ? pickText('জমা আদায়', 'Payment Received')
                    : pickText('বিল যুক্ত', 'Bill Added')}
                </span>
              </div>
              <div className="pt-1.5 border-t border-slate-100 dark:border-zinc-800">
                <div className="text-[10px] text-slate-400 mb-0.5">
                  {pickText('নোট / বিবরণ', 'Note / Particulars')}
                </div>
                <div className="font-medium text-slate-800 dark:text-zinc-200">
                  {selectedResellerTx.note}
                </div>
              </div>
            </div>
          </div>
        )}
      </BottomSheet>
    </div>
  );
};
