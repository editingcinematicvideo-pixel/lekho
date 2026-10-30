import { DrawerType } from '../types';

export interface SplitPaymentBreakdown {
  cash: number;
  merchantBkash: number;
  personalBkash: number;
  nagad: number;
  bank: number;
}

export const SPLIT_PAYMENT_METHODS: Array<{
  key: keyof SplitPaymentBreakdown;
  drawer: DrawerType;
  label: string;
  labelBn: string;
  bnLabel: string;
  shortLabel: string;
}> = [
  { key: 'cash', drawer: 'cash', label: 'Cash', labelBn: 'নগদ ক্যাশ (Cash)', bnLabel: 'নগদ ক্যাশ (Cash)', shortLabel: 'Cash' },
  { key: 'merchantBkash', drawer: 'merchantBkash', label: 'bKash Merchant', labelBn: 'বিকাশ মার্চেন্ট', bnLabel: 'বিকাশ মার্চেন্ট', shortLabel: 'bKash M.' },
  { key: 'personalBkash', drawer: 'personalBkash', label: 'bKash Personal', labelBn: 'বিকাশ পার্সোনাল', bnLabel: 'বিকাশ পার্সোনাল', shortLabel: 'bKash P.' },
  { key: 'nagad', drawer: 'nagad', label: 'Nagad', labelBn: 'নগদ (Nagad)', bnLabel: 'নগদ (Nagad)', shortLabel: 'Nagad' },
  { key: 'bank', drawer: 'bank', label: 'Bank/Card', labelBn: 'ব্যাংক / কার্ড (Bank/Card)', bnLabel: 'ব্যাংক / কার্ড (Bank/Card)', shortLabel: 'Bank/Card' },
];

export function createEmptySplitBreakdown(initialCash: number = 0): SplitPaymentBreakdown {
  return {
    cash: Math.max(0, Math.round(initialCash)),
    merchantBkash: 0,
    personalBkash: 0,
    nagad: 0,
    bank: 0,
  };
}

export function calculateSplitTotal(breakdown?: Partial<SplitPaymentBreakdown> | null): number {
  if (!breakdown) return 0;
  return (
    (Math.max(0, Number(breakdown.cash) || 0)) +
    (Math.max(0, Number(breakdown.merchantBkash) || 0)) +
    (Math.max(0, Number(breakdown.personalBkash) || 0)) +
    (Math.max(0, Number(breakdown.nagad) || 0)) +
    (Math.max(0, Number(breakdown.bank) || 0))
  );
}

export function getActiveSplitEntries(
  breakdown?: Partial<SplitPaymentBreakdown> | null
): Array<{
  key: keyof SplitPaymentBreakdown;
  drawer: DrawerType;
  label: string;
  labelBn: string;
  amount: number;
}> {
  if (!breakdown) return [];
  return SPLIT_PAYMENT_METHODS.map((m) => ({
    key: m.key,
    drawer: m.drawer,
    label: m.label,
    labelBn: m.labelBn,
    amount: Math.max(0, Number(breakdown[m.key]) || 0),
  })).filter((entry) => entry.amount > 0);
}

export function validateSplitPayment(
  breakdown: Partial<SplitPaymentBreakdown> | null | undefined,
  targetAmount: number
): {
  valid: boolean;
  totalEntered: number;
  remaining: number;
  activeMethodsCount: number;
  reasonBn?: string;
  errorBn?: string;
} {
  const cleanTarget = Math.max(0, Number(targetAmount) || 0);
  const totalEntered = calculateSplitTotal(breakdown);
  const remaining = cleanTarget - totalEntered;
  const activeEntries = getActiveSplitEntries(breakdown);

  if (cleanTarget <= 0) {
    const reasonBn = 'পরিশোধযোগ্য টাকার পরিমাণ অবশ্যই ০-এর বেশি হতে হবে।';
    return {
      valid: false,
      totalEntered,
      remaining,
      activeMethodsCount: activeEntries.length,
      reasonBn,
      errorBn: reasonBn,
    };
  }

  if (remaining !== 0) {
    const reasonBn =
      remaining > 0
        ? `মোট বিলের সমান হতে আরও ৳${remaining.toLocaleString()} বাকি আছে।`
        : `মোট বিলের চেয়ে ৳${Math.abs(remaining).toLocaleString()} বেশি লেখা হয়েছে।`;
    return {
      valid: false,
      totalEntered,
      remaining,
      activeMethodsCount: activeEntries.length,
      reasonBn,
      errorBn: reasonBn,
    };
  }

  return {
    valid: true,
    totalEntered,
    remaining: 0,
    activeMethodsCount: activeEntries.length,
  };
}

export function autoFillSplitMethod(
  breakdown: SplitPaymentBreakdown,
  targetKey: keyof SplitPaymentBreakdown,
  targetAmount: number
): SplitPaymentBreakdown {
  const otherSum = SPLIT_PAYMENT_METHODS.reduce((acc, m) => {
    if (m.key === targetKey) return acc;
    return acc + Math.max(0, Number(breakdown[m.key]) || 0);
  }, 0);
  const remainder = Math.max(0, Math.round(targetAmount - otherSum));
  return {
    ...breakdown,
    [targetKey]: remainder,
  };
}

export function formatSplitSummaryText(
  breakdown?: Partial<SplitPaymentBreakdown> | null
): string {
  const entries = getActiveSplitEntries(breakdown);
  if (entries.length === 0) return '';
  return entries.map((e) => `${e.label}: ৳${e.amount.toLocaleString()}`).join(' + ');
}

export interface DtfSearchableItem {
  lineFormatted: string;
  customName?: string;
  customNumber?: string;
  fontStyle?: string;
  size?: string;
  patches?: string;
  kitTitle?: string;
  invoiceNo?: string;
  customerName?: string;
  customerPhone?: string;
}

export function matchesDtfSearch(item: DtfSearchableItem, rawQuery: string): boolean {
  const q = rawQuery.trim().toLowerCase();
  if (!q) return true;

  const fields = [
    item.lineFormatted,
    item.customName,
    item.customNumber,
    item.fontStyle,
    item.size,
    item.patches,
    item.kitTitle,
    item.invoiceNo,
    item.customerName,
    item.customerPhone,
  ];

  return fields.some((val) => (val || '').toLowerCase().includes(q));
}

export interface DailyClosingWhatsAppParams {
  shopName: string;
  marketMallName?: string;
  marketAndShopNo?: string;
  shopNo?: string;
  dateStr?: string;
  date?: string;
  operatorName: string;
  totalSalesVolume?: number;
  totalSales?: number;
  totalInvoicesCount?: number;
  totalInvoices?: number;
  retailSalesVolume?: number;
  retailSales?: number;
  retailCount: number;
  resellerSalesVolume?: number;
  resellerSales?: number;
  resellerCount: number;
  totalExpenses: number;
  creditGiven: number;
  wallets?: {
    cash: { expected: number; counted: number };
    merchantBkash: { expected: number; counted: number };
    personalBkash: { expected: number; counted: number };
    nagad: { expected: number; counted: number };
    bank: { expected: number; counted: number };
  };
  expectedCash?: number;
  countedCash?: number;
  expectedBkashPersonal?: number;
  countedBkashPersonal?: number;
  expectedBkashMerchant?: number;
  countedBkashMerchant?: number;
  expectedNagad?: number;
  countedNagad?: number;
  expectedBank?: number;
  countedBank?: number;
  discrepancy?: number;
  totalDiscrepancy?: number;
  notes?: string;
}

export function formatDailyClosingWhatsAppMemo(params: DailyClosingWhatsAppParams): string {
  const formatDiff = (diff: number) => {
    if (diff === 0) return '✅ মিলেছে (৳0)';
    if (diff < 0) return `⚠️ শর্টেজ (-৳${Math.abs(diff).toLocaleString()})`;
    return `💡 অতিরিক্ত (+৳${diff.toLocaleString()})`;
  };

  const cashDiff = params.wallets
    ? params.wallets.cash.counted - params.wallets.cash.expected
    : (params.countedCash ?? 0) - (params.expectedCash ?? 0);
  const bkashMDiff = params.wallets
    ? params.wallets.merchantBkash.counted - params.wallets.merchantBkash.expected
    : (params.countedBkashMerchant ?? 0) - (params.expectedBkashMerchant ?? 0);
  const bkashPDiff = params.wallets
    ? params.wallets.personalBkash.counted - params.wallets.personalBkash.expected
    : (params.countedBkashPersonal ?? 0) - (params.expectedBkashPersonal ?? 0);
  const nagadDiff = params.wallets
    ? params.wallets.nagad.counted - params.wallets.nagad.expected
    : (params.countedNagad ?? 0) - (params.expectedNagad ?? 0);
  const bankDiff = params.wallets
    ? params.wallets.bank.counted - params.wallets.bank.expected
    : (params.countedBank ?? 0) - (params.expectedBank ?? 0);

  const totalSalesVal = params.totalSalesVolume ?? params.totalSales ?? 0;
  const totalInvoicesVal = params.totalInvoicesCount ?? params.totalInvoices ?? 0;
  const retailSalesVal = params.retailSalesVolume ?? params.retailSales ?? 0;
  const resellerSalesVal = params.resellerSalesVolume ?? params.resellerSales ?? 0;
  const dateText = params.dateStr || params.date || '';
  const discrepancyVal = params.totalDiscrepancy ?? params.discrepancy ?? (cashDiff + bkashMDiff + bkashPDiff + nagadDiff + bankDiff);
  const locationHeader = params.marketAndShopNo
    ? `ঠিকানা: ${params.marketAndShopNo}\n`
    : params.marketMallName
    ? `ঠিকানা: ${params.marketMallName}${params.shopNo ? `, ${params.shopNo}` : ''}\n`
    : '';

  const expectedCashVal = params.wallets ? params.wallets.cash.expected : (params.expectedCash ?? 0);
  const countedCashVal = params.wallets ? params.wallets.cash.counted : (params.countedCash ?? 0);
  const expectedBkashMVal = params.wallets ? params.wallets.merchantBkash.expected : (params.expectedBkashMerchant ?? 0);
  const countedBkashMVal = params.wallets ? params.wallets.merchantBkash.counted : (params.countedBkashMerchant ?? 0);
  const expectedBkashPVal = params.wallets ? params.wallets.personalBkash.expected : (params.expectedBkashPersonal ?? 0);
  const countedBkashPVal = params.wallets ? params.wallets.personalBkash.counted : (params.countedBkashPersonal ?? 0);
  const expectedNagadVal = params.wallets ? params.wallets.nagad.expected : (params.expectedNagad ?? 0);
  const countedNagadVal = params.wallets ? params.wallets.nagad.counted : (params.countedNagad ?? 0);
  const expectedBankVal = params.wallets ? params.wallets.bank.expected : (params.expectedBank ?? 0);
  const countedBankVal = params.wallets ? params.wallets.bank.counted : (params.countedBank ?? 0);

  return (
    `📊 *${params.shopName} - Daily Closing (Z-Report)*\n` +
    `তারিখ: ${dateText}\n` +
    `শিফট অপারেটর: *${params.operatorName}*\n` +
    locationHeader +
    `------------------------------------------\n` +
    `💰 *বিক্রয় সারসংক্ষেপ (Sales Summary):*\n` +
    `• মোট বিক্রি: *৳${totalSalesVal.toLocaleString()}* (${totalInvoicesVal} টি মেমো)\n` +
    `• রিটেইল বিক্রি: ৳${retailSalesVal.toLocaleString()} (${params.retailCount} টি)\n` +
    `• রিসেলার/হোলসেল: ৳${resellerSalesVal.toLocaleString()} (${params.resellerCount} টি)\n` +
    `• আজকের বাকি (Due Given): ৳${params.creditGiven.toLocaleString()}\n` +
    `• আজকের মোট খরচ (Expenses): ৳${params.totalExpenses.toLocaleString()}\n` +
    `------------------------------------------\n` +
    `🏦 *ড্রয়ার ও ওয়ালেট হিসাব (System vs Counted):*\n` +
    `• Cash: হিসাব ৳${expectedCashVal.toLocaleString()} | গুনে পাওয়া ৳${countedCashVal.toLocaleString()} (${formatDiff(cashDiff)})\n` +
    `• bKash Merchant: হিসাব ৳${expectedBkashMVal.toLocaleString()} | পাওয়া ৳${countedBkashMVal.toLocaleString()} (${formatDiff(bkashMDiff)})\n` +
    `• bKash Personal: হিসাব ৳${expectedBkashPVal.toLocaleString()} | পাওয়া ৳${countedBkashPVal.toLocaleString()} (${formatDiff(bkashPDiff)})\n` +
    `• Nagad: হিসাব ৳${expectedNagadVal.toLocaleString()} | পাওয়া ৳${countedNagadVal.toLocaleString()} (${formatDiff(nagadDiff)})\n` +
    `• Bank/Card: হিসাব ৳${expectedBankVal.toLocaleString()} | পাওয়া ৳${countedBankVal.toLocaleString()} (${formatDiff(bankDiff)})\n` +
    `------------------------------------------\n` +
    `*সর্বমোট ব্যালেন্স স্ট্যাটাস:* ${formatDiff(discrepancyVal)}\n` +
    (params.notes ? `নোট: ${params.notes}\n` : '') +
    `------------------------------------------\n` +
    `LEKHO POS Smart Closing Report`
  );
}

export function buildWhatsAppUrl(rawPhone: string, text: string): string {
  const cleanPhone = (rawPhone || '').replace(/\D/g, '');
  const intlPhone = cleanPhone
    ? cleanPhone.startsWith('88')
      ? cleanPhone
      : `88${cleanPhone}`
    : '';
  const encoded = encodeURIComponent(text);
  return intlPhone ? `https://wa.me/${intlPhone}?text=${encoded}` : `https://wa.me/?text=${encoded}`;
}

// ==========================================
// BOTTOM PRICE LOCK & ONE-SALE OVERRIDE LOGIC
// ==========================================

export interface BottomPriceCartItemLike {
  id: string;
  productId?: string;
  title: string;
  rate: number;
  bottomPrice: number;
  quantity?: number;
}

export interface BottomPriceOverrideRecord {
  itemId: string;
  productId?: string;
  approvedRate: number;
  authorizedAt: number;
}

export type BottomPriceOverrideMap = Record<string, BottomPriceOverrideRecord>;

/**
 * Checks whether a single cart item satisfies its bottomPrice floor OR has a valid
 * one-sale Owner PIN override for its exact itemId, productId, and rate.
 * If the rate is lowered below the previously approved rate, or productId changes,
 * the override is invalidated and requires re-authorization.
 */
export function isItemBottomPriceSatisfied(
  item: BottomPriceCartItemLike,
  overrides: BottomPriceOverrideMap = {}
): boolean {
  const floor = Number(item.bottomPrice) || 0;
  const currentRate = Number(item.rate) || 0;

  if (floor <= 0 || currentRate >= floor) {
    return true;
  }

  const record = overrides[item.id];
  if (!record) {
    return false;
  }

  if ((record.productId || '') !== (item.productId || '')) {
    return false;
  }

  // Must not be lower than the rate the owner approved
  return currentRate >= record.approvedRate;
}

/**
 * Scans cart items and returns the first item that violates bottomPrice without a valid
 * one-sale override, or null if all items are valid/authorized.
 */
export function findFirstBottomPriceViolation<T extends BottomPriceCartItemLike>(
  items: T[],
  overrides: BottomPriceOverrideMap = {}
): { item: T; bottomPrice: number } | null {
  if (!Array.isArray(items)) return null;
  for (const item of items) {
    if (!isItemBottomPriceSatisfied(item, overrides)) {
      return { item, bottomPrice: Number(item.bottomPrice) || 0 };
    }
  }
  return null;
}

/**
 * Records a one-sale Owner PIN override for a specific cart item at its current rate.
 */
export function authorizeBottomPriceOverride(
  overrides: BottomPriceOverrideMap,
  item: Pick<BottomPriceCartItemLike, 'id' | 'productId' | 'rate'>,
  nowMs: number = Date.now()
): BottomPriceOverrideMap {
  return {
    ...overrides,
    [item.id]: {
      itemId: item.id,
      productId: item.productId,
      approvedRate: Number(item.rate) || 0,
      authorizedAt: nowMs,
    },
  };
}

/**
 * Prunes overrides when cart items are removed, replaced, or their rate is lowered further
 * than the approved override rate.
 */
export function pruneBottomPriceOverridesForCart(
  overrides: BottomPriceOverrideMap,
  items: Array<Pick<BottomPriceCartItemLike, 'id' | 'productId' | 'rate' | 'bottomPrice'>>
): BottomPriceOverrideMap {
  if (!overrides || Object.keys(overrides).length === 0) return {};
  if (!Array.isArray(items) || items.length === 0) return {};

  const next: BottomPriceOverrideMap = {};
  for (const item of items) {
    const rec = overrides[item.id];
    if (!rec) continue;
    if ((rec.productId || '') !== (item.productId || '')) continue;
    const rate = Number(item.rate) || 0;
    const floor = Number(item.bottomPrice) || 0;
    // Keep override only if rate is still below floor AND not lower than approvedRate
    if (floor > 0 && rate < floor && rate >= rec.approvedRate) {
      next[item.id] = rec;
    }
  }
  return next;
}

/**
 * Returns true if any item in the current cart is actively using an Owner PIN bottom-price override.
 */
export function hasAnyBottomPriceOverrideUsed(
  items: BottomPriceCartItemLike[],
  overrides: BottomPriceOverrideMap = {}
): boolean {
  if (!Array.isArray(items) || items.length === 0) return false;
  return items.some((item) => {
    const floor = Number(item.bottomPrice) || 0;
    const currentRate = Number(item.rate) || 0;
    return floor > 0 && currentRate < floor && isItemBottomPriceSatisfied(item, overrides);
  });
}

