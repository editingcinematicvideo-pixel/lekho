import {
  ApparelMatrixVariant,
  CampaignOpenLog,
  CampaignTemplate,
  DrawerTransaction,
  ExpenseRecord,
  InventoryItem,
  Invoice,
  LoyaltyRewardTier,
  LoyaltySettings,
  LoyaltyTransaction,
  OrderLineItem,
  ShopCustomerProfile,
  SizeExchangeRecord,
  StockAdjustmentRecord,
  StockMovementType,
  UserRole,
} from '../types';
import { canViewBuyingPrice } from './securityPolicy';

// ==========================================
// 1. MULTI-TENANT PHONE & CUSTOMER ISOLATION
// ==========================================

/**
 * Normalizes Bangladesh and international phone numbers to a canonical digit string
 * so "01876-217089", "+8801876217089", and "8801876217089" resolve to "01876217089".
 */
export function normalizeBdPhone(phone: string | undefined | null): string {
  if (!phone) return '';
  const digits = String(phone).replace(/[^0-9]/g, '');
  if (!digits) return '';
  if (digits.startsWith('8801') && digits.length === 13) {
    return digits.slice(2); // "01XXXXXXXXX"
  }
  if (digits.startsWith('1') && digits.length === 10) {
    return `0${digits}`;
  }
  return digits;
}

/**
 * Builds a strictly tenant-scoped customer ID.
 * Even if the same phone number (e.g. 01876217089) shops at Shop A (Clothing)
 * and Shop B (Sportswear), their IDs are distinct ("shopA_01876217089" vs "shopB_01876217089").
 */
export function buildShopCustomerId(shopId: string, phone: string): string {
  const cleanShop = String(shopId || '').trim();
  const cleanPhone = normalizeBdPhone(phone);
  if (!cleanShop || !cleanPhone) return '';
  return `${cleanShop}_${cleanPhone}`;
}

export interface ShopCustomerRecentProduct {
  invoiceId: string;
  invoiceNo: string;
  date: string;
  title: string;
  size: string;
  color?: string;
  quantity: number;
  rate: number;
  subtotal: number;
}

export interface ShopCustomerSummary {
  customerId: string;
  shopId: string;
  phone: string;
  customerName: string;
  existsInShop: boolean;
  invoiceCount: number;
  totalSpent: number;
  totalPaid: number;
  totalDue: number;
  loyaltyPoints: number;
  lifetimePointsEarned: number;
  lifetimePointsRedeemed: number;
  lastPurchaseDate: string | null;
  recentProducts: ShopCustomerRecentProduct[];
  invoices: Invoice[];
  loyaltyHistory: LoyaltyTransaction[];
  doNotContact: boolean;
  notes?: string;
}

/**
 * Computes a customer's complete purchase & loyalty summary strictly isolated to `shopId`.
 * Records belonging to any other `shopId` are unconditionally excluded.
 */
export function getShopCustomerSummary(params: {
  shopId: string;
  phone: string;
  invoices: Invoice[];
  loyaltyTransactions: LoyaltyTransaction[];
  customerProfiles?: ShopCustomerProfile[];
}): ShopCustomerSummary {
  const { shopId, phone, invoices, loyaltyTransactions, customerProfiles = [] } = params;
  const normalizedPhone = normalizeBdPhone(phone);
  const customerId = buildShopCustomerId(shopId, normalizedPhone);

  if (!shopId || !normalizedPhone || normalizedPhone.length < 6) {
    return {
      customerId,
      shopId,
      phone: normalizedPhone,
      customerName: '',
      existsInShop: false,
      invoiceCount: 0,
      totalSpent: 0,
      totalPaid: 0,
      totalDue: 0,
      loyaltyPoints: 0,
      lifetimePointsEarned: 0,
      lifetimePointsRedeemed: 0,
      lastPurchaseDate: null,
      recentProducts: [],
      invoices: [],
      loyaltyHistory: [],
      doNotContact: false,
    };
  }

  // Strictly filter by shopId AND normalized phone
  const shopInvoices = (invoices || [])
    .filter(
      (inv) =>
        inv &&
        !inv.isSoftDeleted &&
        inv.shopId === shopId &&
        normalizeBdPhone(inv.customerPhone) === normalizedPhone
    )
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const shopLoyaltyTxs = (loyaltyTransactions || [])
    .filter(
      (tx) =>
        tx &&
        tx.shopId === shopId &&
        (tx.customerId === customerId || normalizeBdPhone(tx.customerPhone) === normalizedPhone)
    )
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  const matchedProfile = (customerProfiles || []).find(
    (p) =>
      p &&
      p.shopId === shopId &&
      (p.id === customerId || normalizeBdPhone(p.phone) === normalizedPhone)
  );

  let totalSpent = 0;
  let totalPaid = 0;
  let totalDue = 0;
  const recentProducts: ShopCustomerRecentProduct[] = [];

  for (const inv of shopInvoices) {
    if (inv.status !== 'returned') {
      totalSpent += Number(inv.total) || 0;
      totalPaid += Number(inv.advancePaid ?? inv.paidAmount ?? 0) || 0;
      totalDue += Number(inv.dueAmount) || 0;
    }
    for (const item of inv.items || []) {
      if (recentProducts.length < 12) {
        recentProducts.push({
          invoiceId: inv.id,
          invoiceNo: inv.invoiceNo,
          date: inv.createdAt,
          title: item.title,
          size: item.size,
          color: item.color,
          quantity: item.quantity,
          rate: item.rate,
          subtotal: item.subtotal,
        });
      }
    }
  }

  // Compute loyalty points from ledger if transactions exist, else fallback to profile
  let computedPoints = 0;
  let lifetimeEarned = 0;
  let lifetimeRedeemed = 0;

  if (shopLoyaltyTxs.length > 0) {
    // Reconstruct in chronological order to prevent negative balances
    const chronological = [...shopLoyaltyTxs].reverse();
    for (const tx of chronological) {
      const pts = Math.max(0, Number(tx.points) || 0);
      if (tx.type === 'earn') {
        computedPoints += pts;
        lifetimeEarned += pts;
      } else if (tx.type === 'redeem') {
        computedPoints = Math.max(0, computedPoints - pts);
        lifetimeRedeemed += pts;
      } else if (tx.type === 'reverse') {
        computedPoints = Math.max(0, computedPoints - pts);
      } else if (tx.type === 'manual_adjust') {
        computedPoints = Math.max(0, computedPoints + (Number(tx.points) || 0));
      }
    }
  } else if (matchedProfile) {
    computedPoints = Math.max(0, Number(matchedProfile.loyaltyPoints) || 0);
    lifetimeEarned = Math.max(0, Number(matchedProfile.lifetimePointsEarned) || 0);
    lifetimeRedeemed = Math.max(0, Number(matchedProfile.lifetimePointsRedeemed) || 0);
  }

  const latestInvoiceName = shopInvoices.find(
    (inv) => inv.customerName && inv.customerName.trim().toLowerCase() !== 'walk-in customer'
  )?.customerName;

  const customerName =
    matchedProfile?.name ||
    latestInvoiceName ||
    shopInvoices[0]?.customerName ||
    '';

  const existsInShop = shopInvoices.length > 0 || Boolean(matchedProfile) || shopLoyaltyTxs.length > 0;

  return {
    customerId,
    shopId,
    phone: normalizedPhone,
    customerName,
    existsInShop,
    invoiceCount: shopInvoices.length,
    totalSpent,
    totalPaid,
    totalDue,
    loyaltyPoints: computedPoints,
    lifetimePointsEarned: lifetimeEarned,
    lifetimePointsRedeemed: lifetimeRedeemed,
    lastPurchaseDate: shopInvoices[0]?.createdAt || null,
    recentProducts,
    invoices: shopInvoices,
    loyaltyHistory: shopLoyaltyTxs,
    doNotContact: Boolean(matchedProfile?.doNotContact),
    notes: matchedProfile?.notes,
  };
}

// ==========================================
// 2. FLEXIBLE MULTI-VARIANT & STOCK LEDGER ENGINE
// ==========================================

export function buildVariantId(productId: string, size: string, color?: string): string {
  const cleanSize = String(size || 'STD')
    .trim()
    .replace(/\s+/g, '-');
  const cleanColor = String(color || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-');
  return cleanColor ? `${productId}_v_${cleanColor}_${cleanSize}` : `${productId}_v_${cleanSize}`;
}

export function normalizeProductVariants(item: InventoryItem): InventoryItem {
  const baseColor = item.color?.trim() || undefined;
  const normalizedVariants: ApparelMatrixVariant[] = (item.variants || []).map((v, idx) => {
    const vColor = v.color?.trim() || baseColor;
    const vId = v.id || buildVariantId(item.id, v.size || `V${idx + 1}`, vColor);
    const vSku =
      v.sku ||
      `${item.sku}-${vColor ? `${vColor.slice(0, 3).toUpperCase()}-` : ''}${v.size}`;
    return {
      ...v,
      id: vId,
      sku: vSku,
      color: vColor,
      stock: Math.max(0, Number(v.stock) || 0),
      costPrice: Math.max(0, Number(v.costPrice ?? item.lotCostLandingPrice) || 0),
      mrp: Math.max(0, Number(v.mrp ?? item.mrp) || 0),
      bottomPrice: Math.max(0, Number(v.bottomPrice ?? item.bottomPrice) || 0),
      isActive: v.isActive !== false,
    };
  });

  const totalStock = normalizedVariants
    .filter((v) => v.isActive !== false)
    .reduce((sum, v) => sum + (Number(v.stock) || 0), 0);

  return {
    ...item,
    isActive: item.isActive !== false,
    variants: normalizedVariants,
    totalStock,
  };
}

export function matchesVariant(
  variant: ApparelMatrixVariant,
  target: { variantId?: string; size: string; color?: string }
): boolean {
  if (target.variantId && variant.id && target.variantId === variant.id) {
    return true;
  }
  const sizeMatches =
    String(variant.size || '').trim().toLowerCase() ===
    String(target.size || '').trim().toLowerCase();
  if (!sizeMatches) return false;

  if (target.color && variant.color) {
    return (
      String(variant.color).trim().toLowerCase() ===
      String(target.color).trim().toLowerCase()
    );
  }
  return true;
}

export function applyManualStockCorrection(params: {
  item: InventoryItem;
  size: string;
  color?: string;
  variantId?: string;
  newQty: number;
  reason: string;
  shopId: string;
  responsibleUser: string;
  userRole?: UserRole;
  timestamp?: string;
}): {
  updatedItem: InventoryItem;
  adjustmentRecord: StockAdjustmentRecord;
} {
  const {
    item,
    size,
    color,
    variantId,
    newQty,
    reason,
    shopId,
    responsibleUser,
    userRole,
    timestamp = new Date().toISOString(),
  } = params;

  const cleanReason = String(reason || '').trim();
  if (!cleanReason) {
    throw new Error('স্টক পরিবর্তনের কারণ (Reason) উল্লেখ করা আবশ্যক।');
  }

  const sanitizedNewQty = Math.max(0, Math.floor(Number(newQty) || 0));
  const normalized = normalizeProductVariants(item);

  let matchedVariant: ApparelMatrixVariant | undefined;
  const updatedVariants = normalized.variants.map((v) => {
    if (!matchedVariant && matchesVariant(v, { variantId, size, color })) {
      matchedVariant = v;
      return { ...v, stock: sanitizedNewQty };
    }
    return v;
  });

  if (!matchedVariant) {
    // Fallback to matching by size only if color was not matched
    const fallbackIdx = updatedVariants.findIndex(
      (v) => v.size.trim().toLowerCase() === size.trim().toLowerCase()
    );
    if (fallbackIdx !== -1) {
      matchedVariant = updatedVariants[fallbackIdx];
      updatedVariants[fallbackIdx] = { ...matchedVariant, stock: sanitizedNewQty };
    } else {
      throw new Error(`কাঙ্ক্ষিত ভ্যারিয়েন্ট (${size}${color ? ` - ${color}` : ''}) পাওয়া যায়নি।`);
    }
  }

  const previousQty = Math.max(0, Number(matchedVariant.stock) || 0);
  const difference = sanitizedNewQty - previousQty;

  const updatedItem = normalizeProductVariants({
    ...normalized,
    variants: updatedVariants,
  });

  const adjustmentRecord: StockAdjustmentRecord = {
    id: `stk_adj_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    shopId,
    productId: item.id,
    productName: item.name,
    sku: matchedVariant.sku || item.sku,
    variantId: matchedVariant.id,
    size: matchedVariant.size,
    color: matchedVariant.color || item.color,
    previousQty,
    newQty: sanitizedNewQty,
    difference,
    movementType: 'manual_correction',
    reason: cleanReason,
    responsibleUser: responsibleUser || 'Shop Owner',
    userRole,
    timestamp,
  };

  return { updatedItem, adjustmentRecord };
}

export function createStockMovementRecord(params: {
  shopId: string;
  item: InventoryItem;
  variant?: ApparelMatrixVariant;
  size: string;
  color?: string;
  previousQty: number;
  newQty: number;
  movementType: StockMovementType;
  reason: string;
  referenceId?: string;
  responsibleUser: string;
  userRole?: UserRole;
  timestamp?: string;
}): StockAdjustmentRecord {
  const {
    shopId,
    item,
    variant,
    size,
    color,
    previousQty,
    newQty,
    movementType,
    reason,
    referenceId,
    responsibleUser,
    userRole,
    timestamp = new Date().toISOString(),
  } = params;

  return {
    id: `stk_mov_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    shopId,
    productId: item.id,
    productName: item.name,
    sku: variant?.sku || item.sku,
    variantId: variant?.id,
    size: variant?.size || size,
    color: variant?.color || color || item.color,
    previousQty,
    newQty,
    difference: newQty - previousQty,
    movementType,
    reason,
    referenceId,
    responsibleUser,
    userRole,
    timestamp,
  };
}

/**
 * Locates the matching shop-scoped product and variant for a POS order line item.
 */
export function findMatchingInventoryVariant(
  inventory: InventoryItem[],
  lineItem: Pick<
    OrderLineItem,
    'productId' | 'variantId' | 'sku' | 'title' | 'size' | 'color' | 'isManualInventoryEntry'
  >,
  shopId: string
): { product: InventoryItem; variant: ApparelMatrixVariant; variantIndex: number } | null {
  if (!shopId || lineItem.isManualInventoryEntry) return null;

  const shopItems = (inventory || []).filter(
    (p) => p && !p.isSoftDeleted && p.shopId === shopId
  );

  // 1. Match product by explicit productId, variantId, SKU, or normalized title
  let matchedProduct = lineItem.productId
    ? shopItems.find((p) => p.id === lineItem.productId)
    : undefined;

  if (!matchedProduct && lineItem.variantId) {
    matchedProduct = shopItems.find((p) =>
      (p.variants || []).some((v) => v.id === lineItem.variantId)
    );
  }

  if (!matchedProduct && lineItem.sku) {
    const cleanSku = lineItem.sku.trim().toLowerCase();
    matchedProduct = shopItems.find(
      (p) =>
        p.sku?.trim().toLowerCase() === cleanSku ||
        (p.variants || []).some((v) => v.sku?.trim().toLowerCase() === cleanSku)
    );
  }

  if (!matchedProduct && lineItem.title) {
    const cleanTitle = lineItem.title.trim().toLowerCase();
    matchedProduct = shopItems.find((p) => {
      const pName = p.name.trim().toLowerCase();
      return pName === cleanTitle || cleanTitle.startsWith(pName);
    });
  }

  if (!matchedProduct) return null;

  const variants = matchedProduct.variants || [];
  // 2. Match exact variant by variantId -> variant SKU -> color+size -> size
  let variantIndex = -1;
  if (lineItem.variantId) {
    variantIndex = variants.findIndex((v) => v.id === lineItem.variantId);
  }
  if (variantIndex === -1 && lineItem.sku) {
    const cleanSku = lineItem.sku.trim().toLowerCase();
    variantIndex = variants.findIndex((v) => v.sku?.trim().toLowerCase() === cleanSku);
  }
  if (variantIndex === -1) {
    variantIndex = variants.findIndex((v) =>
      matchesVariant(v, {
        variantId: lineItem.variantId,
        size: lineItem.size,
        color: lineItem.color || matchedProduct?.color,
      })
    );
  }
  if (variantIndex === -1 && lineItem.size) {
    const cleanSize = lineItem.size.trim().toLowerCase();
    variantIndex = variants.findIndex(
      (v) => String(v.size || '').trim().toLowerCase() === cleanSize
    );
  }

  if (variantIndex === -1) return null;

  return {
    product: matchedProduct,
    variant: variants[variantIndex],
    variantIndex,
  };
}

/**
 * Atomically and idempotently processes POS sale stock deductions for a shop.
 * - Respects Owner-controlled `inventoryTrackingEnabled` ON/OFF setting.
 * - Prevents duplicate stock deduction if the same invoice is retried/resubmitted.
 * - Skips manual/non-inventory POS entries (`isManualInventoryEntry: true`).
 * - Strictly isolates stock operations to `shopId`.
 */
export function processPosSaleStockDeduction(params: {
  shopId: string;
  invoice: Invoice;
  inventory: InventoryItem[];
  existingAdjustments: StockAdjustmentRecord[];
  inventoryTrackingEnabled: boolean;
  allowOutOfStockSelling?: boolean;
  responsibleUser: string;
  userRole?: UserRole;
  timestamp?: string;
}): {
  updatedInventory: InventoryItem[];
  stockMovements: StockAdjustmentRecord[];
  stockDeducted: boolean;
  alreadyProcessed: boolean;
} {
  const {
    shopId,
    invoice,
    inventory,
    existingAdjustments = [],
    inventoryTrackingEnabled,
    allowOutOfStockSelling = false,
    responsibleUser,
    userRole,
    timestamp = new Date().toISOString(),
  } = params;

  const clonedInventory: InventoryItem[] = (inventory || []).map((item) => ({
    ...item,
    variants: (item.variants || []).map((v) => ({ ...v })),
  }));

  // If Inventory Tracking is OFF or invoice is already returned, do not deduct stock
  if (!inventoryTrackingEnabled || invoice.status === 'returned' || invoice.shopId !== shopId) {
    return {
      updatedInventory: clonedInventory,
      stockMovements: [],
      stockDeducted: false,
      alreadyProcessed: false,
    };
  }

  // Idempotency check: has this invoice already deducted stock?
  const refIds = new Set([invoice.invoiceNo, invoice.id].filter(Boolean));
  const alreadyDeducted = existingAdjustments.some(
    (adj) =>
      adj &&
      adj.shopId === shopId &&
      adj.movementType === 'sale' &&
      adj.referenceId &&
      refIds.has(adj.referenceId)
  );

  if (alreadyDeducted) {
    return {
      updatedInventory: clonedInventory,
      stockMovements: [],
      stockDeducted: true,
      alreadyProcessed: true,
    };
  }

  const stockMovements: StockAdjustmentRecord[] = [];

  for (const lineItem of invoice.items || []) {
    if (!lineItem || lineItem.isManualInventoryEntry) continue;
    const qtyToDeduct = Math.max(0, Math.floor(Number(lineItem.quantity) || 0));
    if (qtyToDeduct <= 0) continue;

    const match = findMatchingInventoryVariant(clonedInventory, lineItem, shopId);
    if (!match) {
      if (!allowOutOfStockSelling && (lineItem.productId || lineItem.variantId)) {
        throw new Error(
          `ইনভেন্টরিতে পণ্য বা ভ্যারিয়েন্ট পাওয়া যায়নি: "${lineItem.title}" (${lineItem.size})`
        );
      }
      continue;
    }

    const { product, variant, variantIndex } = match;
    if (product.isActive === false || variant.isActive === false) {
      throw new Error(
        `পণ্য বা ভ্যারিয়েন্টটি বর্তমানে নিষ্ক্রিয় (Inactive): "${product.name}" (${variant.size})`
      );
    }

    const prevQty = Math.max(0, Number(variant.stock) || 0);
    if (!allowOutOfStockSelling && prevQty < qtyToDeduct) {
      throw new Error(
        `অপর্যাপ্ত স্টক: "${product.name}" (${variant.color ? `${variant.color} • ` : ''}${variant.size}) স্টকে আছে ${prevQty} পিস, কিন্তু অর্ডার করা হয়েছে ${qtyToDeduct} পিস।`
      );
    }

    const newQty = Math.max(0, prevQty - qtyToDeduct);
    product.variants[variantIndex] = {
      ...variant,
      stock: newQty,
    };
    product.totalStock = product.variants
      .filter((v) => v.isActive !== false)
      .reduce((sum, v) => sum + (Number(v.stock) || 0), 0);

    // Enrich line item with resolved productId, variantId, sku, and color
    lineItem.productId = product.id;
    lineItem.variantId = variant.id;
    lineItem.sku = variant.sku || product.sku;
    if (!lineItem.color && (variant.color || product.color)) {
      lineItem.color = variant.color || product.color;
    }

    stockMovements.push(
      createStockMovementRecord({
        shopId,
        item: product,
        variant: product.variants[variantIndex],
        size: variant.size,
        color: variant.color || lineItem.color || product.color,
        previousQty: prevQty,
        newQty,
        movementType: 'sale',
        reason: `POS Sale (${invoice.invoiceNo})`,
        referenceId: invoice.invoiceNo,
        responsibleUser: responsibleUser || invoice.salesmanName || 'POS Counter',
        userRole,
        timestamp,
      })
    );
  }

  return {
    updatedInventory: clonedInventory,
    stockMovements,
    stockDeducted: stockMovements.length > 0,
    alreadyProcessed: false,
  };
}

/**
 * Atomically and idempotently restores variant stock when a POS invoice is returned or cancelled.
 */
export function processReturnStockRestoration(params: {
  shopId: string;
  invoice: Invoice;
  inventory: InventoryItem[];
  existingAdjustments: StockAdjustmentRecord[];
  responsibleUser: string;
  userRole?: UserRole;
  reason?: string;
  timestamp?: string;
}): {
  updatedInventory: InventoryItem[];
  stockMovements: StockAdjustmentRecord[];
  alreadyRestored: boolean;
} {
  const {
    shopId,
    invoice,
    inventory,
    existingAdjustments = [],
    responsibleUser,
    userRole,
    reason,
    timestamp = new Date().toISOString(),
  } = params;

  const clonedInventory: InventoryItem[] = (inventory || []).map((item) => ({
    ...item,
    variants: (item.variants || []).map((v) => ({ ...v })),
  }));

  // If stock was explicitly NOT deducted when the invoice was created (e.g. Inventory Tracking was OFF), do not add phantom stock on return
  if (invoice.stockDeducted === false || invoice.shopId !== shopId) {
    return {
      updatedInventory: clonedInventory,
      stockMovements: [],
      alreadyRestored: false,
    };
  }

  const refIds = new Set([invoice.invoiceNo, invoice.id].filter(Boolean));
  const alreadyRestored = existingAdjustments.some(
    (adj) =>
      adj &&
      adj.shopId === shopId &&
      adj.movementType === 'return' &&
      adj.referenceId &&
      refIds.has(adj.referenceId)
  );

  if (alreadyRestored) {
    return {
      updatedInventory: clonedInventory,
      stockMovements: [],
      alreadyRestored: true,
    };
  }

  const stockMovements: StockAdjustmentRecord[] = [];

  for (const lineItem of invoice.items || []) {
    if (!lineItem || lineItem.isManualInventoryEntry) continue;
    const qtyToRestore = Math.max(0, Math.floor(Number(lineItem.quantity) || 0));
    if (qtyToRestore <= 0) continue;

    const match = findMatchingInventoryVariant(clonedInventory, lineItem, shopId);
    if (!match) continue;

    const { product, variant, variantIndex } = match;
    const prevQty = Math.max(0, Number(variant.stock) || 0);
    const newQty = prevQty + qtyToRestore;

    product.variants[variantIndex] = {
      ...variant,
      stock: newQty,
    };
    product.totalStock = product.variants
      .filter((v) => v.isActive !== false)
      .reduce((sum, v) => sum + (Number(v.stock) || 0), 0);

    stockMovements.push(
      createStockMovementRecord({
        shopId,
        item: product,
        variant: product.variants[variantIndex],
        size: variant.size,
        color: variant.color || lineItem.color || product.color,
        previousQty: prevQty,
        newQty,
        movementType: 'return',
        reason: reason || `Invoice Return / Cancellation (${invoice.invoiceNo})`,
        referenceId: invoice.invoiceNo,
        responsibleUser: responsibleUser || 'Shop Owner',
        userRole,
        timestamp,
      })
    );
  }

  return {
    updatedInventory: clonedInventory,
    stockMovements,
    alreadyRestored: false,
  };
}


// ==========================================
// 3. CUSTOMER LOYALTY ENGINE (PHASE 4)
// ==========================================

export function getDefaultLoyaltySettings(): LoyaltySettings {
  return {
    enabled: true,
    earningMode: 'per_amount_spent',
    pointsPerPurchase: 10,
    minPurchaseAmountForPoints: 500,
    amountUnitForPoints: 1000,
    pointsPerAmountUnit: 10,
    allowRedeemOnDue: true,
    rewardTiers: [
      {
        id: 'tier_50',
        pointsRequired: 50,
        discountPercent: 2,
        label: '50 Points = 2% Discount',
        isActive: true,
      },
      {
        id: 'tier_100',
        pointsRequired: 100,
        discountPercent: 5,
        label: '100 Points = 5% Discount',
        isActive: true,
      },
      {
        id: 'tier_200',
        pointsRequired: 200,
        discountPercent: 10,
        label: '200 Points = 10% Discount',
        isActive: true,
      },
    ],
  };
}

export function calculateEarnedLoyaltyPoints(
  invoiceNetTotal: number,
  settings: LoyaltySettings | undefined,
  status: Invoice['status'] = 'completed'
): number {
  if (!settings || !settings.enabled) return 0;
  if (status === 'returned') return 0;
  const cleanTotal = Math.max(0, Number(invoiceNetTotal) || 0);
  if (cleanTotal <= 0) return 0;

  if (settings.earningMode === 'per_purchase') {
    const minAmount = Math.max(0, Number(settings.minPurchaseAmountForPoints) || 0);
    if (cleanTotal < minAmount) return 0;
    return Math.max(0, Math.floor(Number(settings.pointsPerPurchase) || 0));
  }

  // Mode B: 'per_amount_spent' (e.g., 10 points per ৳1,000 spent)
  const unit = Math.max(1, Number(settings.amountUnitForPoints) || 1000);
  const ptsPerUnit = Math.max(0, Number(settings.pointsPerAmountUnit) || 0);
  const completedUnits = Math.floor(cleanTotal / unit);
  return Math.max(0, completedUnits * ptsPerUnit);
}

export function getEligibleLoyaltyTiers(
  availablePoints: number,
  settings: LoyaltySettings | undefined
): LoyaltyRewardTier[] {
  if (!settings || !settings.enabled) return [];
  const pts = Math.max(0, Number(availablePoints) || 0);
  return (settings.rewardTiers || [])
    .filter((t) => t && t.isActive !== false && t.pointsRequired > 0 && pts >= t.pointsRequired)
    .sort((a, b) => b.pointsRequired - a.pointsRequired);
}

export function calculateLoyaltyRedemption(params: {
  cartSubtotal: number;
  manualDiscount: number;
  selectedTier: LoyaltyRewardTier | null | undefined;
  availablePoints: number;
  cartItems: OrderLineItem[];
  enforceBottomPriceLock?: boolean;
}): {
  isValid: boolean;
  pointsToRedeem: number;
  loyaltyDiscountAmount: number;
  combinedDiscount: number;
  finalTotal: number;
  minimumFloorTotal: number;
  violatesBottomPriceFloor: boolean;
  reason?: string;
} {
  const {
    cartSubtotal,
    manualDiscount,
    selectedTier,
    availablePoints,
    cartItems,
    enforceBottomPriceLock = true,
  } = params;

  const cleanSubtotal = Math.max(0, Number(cartSubtotal) || 0);
  const cleanManual = Math.max(0, Number(manualDiscount) || 0);
  const minimumFloorTotal = (cartItems || []).reduce(
    (sum, item) => sum + Math.max(0, Number(item.bottomPrice) || 0) * Math.max(1, Number(item.quantity) || 1),
    0
  );

  if (!selectedTier) {
    const finalTotal = Math.max(0, cleanSubtotal - cleanManual);
    return {
      isValid: true,
      pointsToRedeem: 0,
      loyaltyDiscountAmount: 0,
      combinedDiscount: cleanManual,
      finalTotal,
      minimumFloorTotal,
      violatesBottomPriceFloor: enforceBottomPriceLock && finalTotal < minimumFloorTotal,
    };
  }

  if (availablePoints < selectedTier.pointsRequired) {
    const finalTotal = Math.max(0, cleanSubtotal - cleanManual);
    return {
      isValid: false,
      pointsToRedeem: 0,
      loyaltyDiscountAmount: 0,
      combinedDiscount: cleanManual,
      finalTotal,
      minimumFloorTotal,
      violatesBottomPriceFloor: false,
      reason: `এই রিওয়ার্ডের জন্য কমপক্ষে ${selectedTier.pointsRequired} পয়েন্ট প্রয়োজন (আছে ${availablePoints} পয়েন্ট)।`,
    };
  }

  const baseAfterManual = Math.max(0, cleanSubtotal - cleanManual);
  const rawLoyaltyDiscount = Math.round((baseAfterManual * Math.max(0, selectedTier.discountPercent)) / 100);
  const combinedDiscount = Math.min(cleanSubtotal, cleanManual + rawLoyaltyDiscount);
  const finalTotal = Math.max(0, cleanSubtotal - combinedDiscount);
  const violatesBottomPriceFloor =
    enforceBottomPriceLock && minimumFloorTotal > 0 && finalTotal < minimumFloorTotal;

  return {
    isValid: true,
    pointsToRedeem: selectedTier.pointsRequired,
    loyaltyDiscountAmount: rawLoyaltyDiscount,
    combinedDiscount,
    finalTotal,
    minimumFloorTotal,
    violatesBottomPriceFloor,
  };
}

// ==========================================
// 4. BUSINESS REPORTS ENGINE (PHASE 5)
// ==========================================

export type ReportDatePreset =
  | 'all'
  | 'today'
  | 'yesterday'
  | 'last7days'
  | 'thisMonth'
  | 'custom';

export function isTimestampInReportRange(
  isoOrDateStr: string | undefined,
  preset: ReportDatePreset,
  customStart?: string,
  customEnd?: string,
  now: Date = new Date()
): boolean {
  if (preset === 'all') return true;
  if (!isoOrDateStr) return false;
  const target = new Date(isoOrDateStr);
  if (Number.isNaN(target.getTime())) return false;

  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
  const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

  if (preset === 'today') {
    return target >= startOfToday && target <= endOfToday;
  }

  if (preset === 'yesterday') {
    const startOfYesterday = new Date(startOfToday.getTime() - 86400000);
    const endOfYesterday = new Date(startOfToday.getTime() - 1);
    return target >= startOfYesterday && target <= endOfYesterday;
  }

  if (preset === 'last7days') {
    const startOf7Days = new Date(startOfToday.getTime() - 6 * 86400000);
    return target >= startOf7Days && target <= endOfToday;
  }

  if (preset === 'thisMonth') {
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
    return target >= startOfMonth && target <= endOfToday;
  }

  if (preset === 'custom') {
    const from = customStart
      ? new Date(`${customStart}T00:00:00`)
      : new Date(0);
    const to = customEnd
      ? new Date(`${customEnd}T23:59:59.999`)
      : endOfToday;
    return target >= from && target <= to;
  }

  return true;
}

export interface ProductSalesRankItem {
  productId: string;
  title: string;
  sku?: string;
  category?: string;
  qtySold: number;
  grossRevenue: number;
  estimatedProfit: number;
}

export interface VariantBreakdownItem {
  key: string; // size or color name
  qtySold: number;
  revenue: number;
}

export interface PaymentMethodReconciliation {
  cash: number;
  merchantBkash: number;
  personalBkash: number;
  nagad: number;
  bank: number;
  totalCollectedFromSales: number;
  dueRecoveredInPeriod: number;
  splitInvoicesCount: number;
}

export interface AccurateShopBusinessReport {
  shopId: string;
  preset: ReportDatePreset;
  invoiceCount: number;
  completedInvoiceCount: number;
  partialDueInvoiceCount: number;
  returnedInvoiceCount: number;
  totalUnitsSold: number;
  grossSales: number;
  totalDiscounts: number;
  loyaltyDiscountsGiven: number;
  returnsAndRefundsAmount: number;
  exchangeNetAdjustment: number;
  netSales: number;
  totalCollectedOnSales: number;
  totalCustomerDueGiven: number;
  dueRecoveredInPeriod: number;
  totalActiveShopReceivable: number; // Overall outstanding customer due in this shop
  canSeeCostAndProfit: boolean;
  totalCogs: number;
  grossProfit: number;
  totalExpenses: number;
  netProfit: number;
  expensesByCategory: Array<{ category: string; amount: number; count: number }>;
  bestSellingProducts: ProductSalesRankItem[];
  variantSalesBySize: VariantBreakdownItem[];
  variantSalesByColor: VariantBreakdownItem[];
  lowStockProducts: Array<{
    productId: string;
    name: string;
    sku: string;
    totalStock: number;
    lowVariants: string[];
  }>;
  slowMovingProducts: Array<{
    productId: string;
    name: string;
    sku: string;
    totalStock: number;
    qtySoldInPeriod: number;
    maxDaysInStock: number;
  }>;
  paymentReconciliation: PaymentMethodReconciliation;
  loyaltySummary: {
    pointsEarnedInPeriod: number;
    pointsRedeemedInPeriod: number;
    pointsReversedInPeriod: number;
    activeLoyaltyMembers: number;
    totalOutstandingPoints: number;
  };
  dailyTrend: Array<{
    dateKey: string;
    label: string;
    netSales: number;
    ordersCount: number;
    expenses: number;
  }>;
}

export function computeAccurateShopBusinessReport(params: {
  shopId: string;
  role: UserRole;
  invoices: Invoice[];
  inventory: InventoryItem[];
  expenses: ExpenseRecord[];
  sizeExchanges?: SizeExchangeRecord[];
  drawerTransactions?: DrawerTransaction[];
  loyaltyTransactions?: LoyaltyTransaction[];
  customerProfiles?: ShopCustomerProfile[];
  lowStockThreshold?: number;
  preset?: ReportDatePreset;
  customStart?: string;
  customEnd?: string;
  now?: Date;
}): AccurateShopBusinessReport {
  const {
    shopId,
    role,
    invoices = [],
    inventory = [],
    expenses = [],
    sizeExchanges = [],
    drawerTransactions = [],
    loyaltyTransactions = [],
    customerProfiles = [],
    lowStockThreshold = 5,
    preset = 'all',
    customStart,
    customEnd,
    now = new Date(),
  } = params;

  const canSeeCostAndProfit = canViewBuyingPrice(role);

  // Strictly scope all inputs to shopId
  const allShopInvoices = invoices.filter((i) => i && !i.isSoftDeleted && i.shopId === shopId);
  const allShopInventory = inventory.filter((p) => p && !p.isSoftDeleted && p.shopId === shopId);
  const allShopExpenses = expenses.filter((e) => e && e.shopId === shopId);
  const allShopExchanges = sizeExchanges.filter((ex) => ex && ex.shopId === shopId);
  const allShopDrawerTxs = drawerTransactions.filter((tx) => tx && tx.shopId === shopId);
  const allShopLoyaltyTxs = loyaltyTransactions.filter((tx) => tx && tx.shopId === shopId);

  // Overall active receivable in this shop
  const totalActiveShopReceivable = allShopInvoices
    .filter((i) => i.status !== 'returned')
    .reduce((sum, i) => sum + Math.max(0, Number(i.dueAmount) || 0), 0);

  // Filter by selected date range
  const periodInvoices = allShopInvoices.filter((i) =>
    isTimestampInReportRange(i.createdAt, preset, customStart, customEnd, now)
  );
  const periodExpenses = allShopExpenses.filter((e) =>
    isTimestampInReportRange(e.createdAt || e.date, preset, customStart, customEnd, now)
  );
  const periodExchanges = allShopExchanges.filter((ex) =>
    isTimestampInReportRange(ex.createdAt, preset, customStart, customEnd, now)
  );
  const periodDrawerTxs = allShopDrawerTxs.filter((tx) =>
    isTimestampInReportRange(tx.timestamp, preset, customStart, customEnd, now)
  );
  const periodLoyaltyTxs = allShopLoyaltyTxs.filter((tx) =>
    isTimestampInReportRange(tx.timestamp, preset, customStart, customEnd, now)
  );

  let completedInvoiceCount = 0;
  let partialDueInvoiceCount = 0;
  let returnedInvoiceCount = 0;
  let totalUnitsSold = 0;
  let grossSales = 0;
  let totalDiscounts = 0;
  let loyaltyDiscountsGiven = 0;
  let returnsAndRefundsAmount = 0;
  let netSales = 0;
  let totalCollectedOnSales = 0;
  let totalCustomerDueGiven = 0;
  let totalCogs = 0;

  const productRankMap = new Map<string, ProductSalesRankItem>();
  const sizeBreakdownMap = new Map<string, VariantBreakdownItem>();
  const colorBreakdownMap = new Map<string, VariantBreakdownItem>();

  const paymentReconciliation: PaymentMethodReconciliation = {
    cash: 0,
    merchantBkash: 0,
    personalBkash: 0,
    nagad: 0,
    bank: 0,
    totalCollectedFromSales: 0,
    dueRecoveredInPeriod: 0,
    splitInvoicesCount: 0,
  };

  for (const inv of periodInvoices) {
    if (inv.status === 'returned') {
      returnedInvoiceCount += 1;
      returnsAndRefundsAmount += Math.max(0, Number(inv.total) || 0);
      continue;
    }

    if (inv.status === 'partial_due' || (Number(inv.dueAmount) || 0) > 0) {
      partialDueInvoiceCount += 1;
    } else {
      completedInvoiceCount += 1;
    }

    const invSubtotal = Math.max(0, Number(inv.subtotal) || 0);
    const invDiscount = Math.max(0, Number(inv.discount) || 0);
    const invNetTotal = Math.max(0, Number(inv.total) || Math.max(0, invSubtotal - invDiscount));
    const invCollected = Math.max(0, Number(inv.advancePaid ?? inv.paidAmount ?? 0));
    const invDue = Math.max(0, Number(inv.dueAmount) || 0);

    grossSales += invSubtotal;
    totalDiscounts += invDiscount;
    loyaltyDiscountsGiven += Math.max(0, Number(inv.loyaltyDiscountAmount) || 0);
    netSales += invNetTotal;
    totalCollectedOnSales += invCollected;
    totalCustomerDueGiven += invDue;

    // Payment method reconciliation
    if (inv.paymentChannel === 'split' && inv.splitBreakdown) {
      paymentReconciliation.splitInvoicesCount += 1;
      paymentReconciliation.cash += Math.max(0, Number(inv.splitBreakdown.cash) || 0);
      paymentReconciliation.merchantBkash += Math.max(0, Number(inv.splitBreakdown.merchantBkash) || 0);
      paymentReconciliation.personalBkash += Math.max(0, Number(inv.splitBreakdown.personalBkash) || 0);
      paymentReconciliation.nagad += Math.max(0, Number(inv.splitBreakdown.nagad) || 0);
      paymentReconciliation.bank += Math.max(0, Number(inv.splitBreakdown.bank) || 0);
    } else if (inv.paymentChannel === 'split' && inv.splitDetails) {
      paymentReconciliation.splitInvoicesCount += 1;
      paymentReconciliation.cash += Math.max(0, Number(inv.splitDetails.cashAmount) || 0);
      const digAmt = Math.max(0, Number(inv.splitDetails.digitalAmount) || 0);
      if (inv.splitDetails.digitalChannel === 'bkash') {
        paymentReconciliation.merchantBkash += digAmt;
      } else if (inv.splitDetails.digitalChannel === 'nagad') {
        paymentReconciliation.nagad += digAmt;
      } else {
        paymentReconciliation.bank += digAmt;
      }
    } else {
      const ch = inv.paymentChannel;
      if (ch === 'cash') paymentReconciliation.cash += invCollected;
      else if (ch === 'merchantBkash' || ch === 'bkash') paymentReconciliation.merchantBkash += invCollected;
      else if (ch === 'personalBkash') paymentReconciliation.personalBkash += invCollected;
      else if (ch === 'nagad') paymentReconciliation.nagad += invCollected;
      else if (ch === 'bank') paymentReconciliation.bank += invCollected;
    }

    // Line items for COGS, best sellers, and variant breakdowns
    for (const line of inv.items || []) {
      const qty = Math.max(1, Number(line.quantity) || 1);
      const lineSub = Math.max(0, Number(line.subtotal) || (Number(line.rate) || 0) * qty);
      const unitCost = Math.max(0, Number(line.costPrice) || 0);
      const lineCost = unitCost * qty;

      totalUnitsSold += qty;
      totalCogs += lineCost;

      const prodKey = line.productId || line.title.trim().toLowerCase();
      const existingRank = productRankMap.get(prodKey);
      if (existingRank) {
        existingRank.qtySold += qty;
        existingRank.grossRevenue += lineSub;
        existingRank.estimatedProfit += lineSub - lineCost;
      } else {
        productRankMap.set(prodKey, {
          productId: line.productId || prodKey,
          title: line.title,
          sku: line.sku,
          qtySold: qty,
          grossRevenue: lineSub,
          estimatedProfit: lineSub - lineCost,
        });
      }

      const sizeKey = String(line.size || 'STD').trim() || 'STD';
      const existingSize = sizeBreakdownMap.get(sizeKey) || { key: sizeKey, qtySold: 0, revenue: 0 };
      existingSize.qtySold += qty;
      existingSize.revenue += lineSub;
      sizeBreakdownMap.set(sizeKey, existingSize);

      const colorKey = String(line.color || 'Default').trim() || 'Default';
      const existingColor = colorBreakdownMap.get(colorKey) || { key: colorKey, qtySold: 0, revenue: 0 };
      existingColor.qtySold += qty;
      existingColor.revenue += lineSub;
      colorBreakdownMap.set(colorKey, existingColor);
    }
  }

  paymentReconciliation.totalCollectedFromSales =
    paymentReconciliation.cash +
    paymentReconciliation.merchantBkash +
    paymentReconciliation.personalBkash +
    paymentReconciliation.nagad +
    paymentReconciliation.bank;

  const dueRecoveredInPeriod = periodDrawerTxs
    .filter((tx) => tx.type === 'due_recovery' && tx.direction === 'in')
    .reduce((sum, tx) => sum + Math.max(0, Number(tx.amount) || 0), 0);
  paymentReconciliation.dueRecoveredInPeriod = dueRecoveredInPeriod;

  const exchangeNetAdjustment = periodExchanges.reduce(
    (sum, ex) => sum + (Number(ex.priceDifference) || 0),
    0
  );
  const exchangeRefunds = periodExchanges
    .filter((ex) => (Number(ex.priceDifference) || 0) < 0)
    .reduce((sum, ex) => sum + Math.abs(Number(ex.priceDifference) || 0), 0);
  returnsAndRefundsAmount += exchangeRefunds;

  // Expenses breakdown
  const totalExpenses = periodExpenses.reduce((sum, e) => sum + Math.max(0, Number(e.amount) || 0), 0);
  const expenseCatMap = new Map<string, { category: string; amount: number; count: number }>();
  for (const exp of periodExpenses) {
    const cat = exp.category || 'other';
    const curr = expenseCatMap.get(cat) || { category: cat, amount: 0, count: 0 };
    curr.amount += Math.max(0, Number(exp.amount) || 0);
    curr.count += 1;
    expenseCatMap.set(cat, curr);
  }

  const grossProfit = canSeeCostAndProfit ? netSales - totalCogs : 0;
  const netProfit = canSeeCostAndProfit ? grossProfit - totalExpenses : 0;

  // Low stock & slow moving items
  const lowStockProducts: AccurateShopBusinessReport['lowStockProducts'] = [];
  const slowMovingProducts: AccurateShopBusinessReport['slowMovingProducts'] = [];

  for (const prod of allShopInventory) {
    const lowVariants = (prod.variants || [])
      .filter((v) => v.isActive !== false && (Number(v.stock) || 0) <= lowStockThreshold)
      .map((v) => `${v.color ? `${v.color}/` : ''}${v.size} (${v.stock})`);

    if ((Number(prod.totalStock) || 0) <= lowStockThreshold || lowVariants.length > 0) {
      lowStockProducts.push({
        productId: prod.id,
        name: prod.name,
        sku: prod.sku,
        totalStock: Number(prod.totalStock) || 0,
        lowVariants,
      });
    }

    const soldEntry = productRankMap.get(prod.id) || productRankMap.get(prod.name.trim().toLowerCase());
    const qtySoldInPeriod = soldEntry?.qtySold || 0;
    const maxDaysInStock = Math.max(
      0,
      ...(prod.variants || []).map((v) => Number(v.daysInStock) || 0)
    );

    if ((Number(prod.totalStock) || 0) > 0 && (qtySoldInPeriod === 0 || maxDaysInStock >= 30)) {
      slowMovingProducts.push({
        productId: prod.id,
        name: prod.name,
        sku: prod.sku,
        totalStock: Number(prod.totalStock) || 0,
        qtySoldInPeriod,
        maxDaysInStock,
      });
    }
  }

  // Loyalty summary
  let pointsEarnedInPeriod = 0;
  let pointsRedeemedInPeriod = 0;
  let pointsReversedInPeriod = 0;
  for (const ltx of periodLoyaltyTxs) {
    const pts = Math.max(0, Number(ltx.points) || 0);
    if (ltx.type === 'earn') pointsEarnedInPeriod += pts;
    else if (ltx.type === 'redeem') pointsRedeemedInPeriod += pts;
    else if (ltx.type === 'reverse') pointsReversedInPeriod += pts;
  }

  const shopProfiles = customerProfiles.filter((p) => p && p.shopId === shopId);
  const activeLoyaltyMembers = shopProfiles.filter((p) => (Number(p.loyaltyPoints) || 0) > 0).length;
  const totalOutstandingPoints = shopProfiles.reduce(
    (sum, p) => sum + Math.max(0, Number(p.loyaltyPoints) || 0),
    0
  );

  // 7-day real daily trend (no fake fallback values)
  const dailyTrend: AccurateShopBusinessReport['dailyTrend'] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
    const dateKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const label = d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

    const dayInvoices = allShopInvoices.filter((inv) => {
      if (inv.status === 'returned') return false;
      const dt = new Date(inv.createdAt);
      return (
        dt.getFullYear() === d.getFullYear() &&
        dt.getMonth() === d.getMonth() &&
        dt.getDate() === d.getDate()
      );
    });

    const dayExpenses = allShopExpenses.filter((exp) => {
      const dt = new Date(exp.createdAt || exp.date);
      return (
        dt.getFullYear() === d.getFullYear() &&
        dt.getMonth() === d.getMonth() &&
        dt.getDate() === d.getDate()
      );
    });

    dailyTrend.push({
      dateKey,
      label,
      netSales: dayInvoices.reduce((s, inv) => s + Math.max(0, Number(inv.total) || 0), 0),
      ordersCount: dayInvoices.length,
      expenses: dayExpenses.reduce((s, exp) => s + Math.max(0, Number(exp.amount) || 0), 0),
    });
  }

  return {
    shopId,
    preset,
    invoiceCount: periodInvoices.length,
    completedInvoiceCount,
    partialDueInvoiceCount,
    returnedInvoiceCount,
    totalUnitsSold,
    grossSales,
    totalDiscounts,
    loyaltyDiscountsGiven,
    returnsAndRefundsAmount,
    exchangeNetAdjustment,
    netSales,
    totalCollectedOnSales,
    totalCustomerDueGiven,
    dueRecoveredInPeriod,
    totalActiveShopReceivable,
    canSeeCostAndProfit,
    totalCogs: canSeeCostAndProfit ? totalCogs : 0,
    grossProfit,
    totalExpenses,
    netProfit,
    expensesByCategory: Array.from(expenseCatMap.values()).sort((a, b) => b.amount - a.amount),
    bestSellingProducts: Array.from(productRankMap.values())
      .map((item) => ({
        ...item,
        estimatedProfit: canSeeCostAndProfit ? item.estimatedProfit : 0,
      }))
      .sort((a, b) => b.qtySold - a.qtySold || b.grossRevenue - a.grossRevenue),
    variantSalesBySize: Array.from(sizeBreakdownMap.values()).sort((a, b) => b.qtySold - a.qtySold),
    variantSalesByColor: Array.from(colorBreakdownMap.values()).sort((a, b) => b.qtySold - a.qtySold),
    lowStockProducts,
    slowMovingProducts,
    paymentReconciliation,
    loyaltySummary: {
      pointsEarnedInPeriod,
      pointsRedeemedInPeriod,
      pointsReversedInPeriod,
      activeLoyaltyMembers,
      totalOutstandingPoints,
    },
    dailyTrend,
  };
}

// ==========================================
// 5. FESTIVE OFFERS & INDIVIDUAL WHATSAPP MESSAGING (PHASE 6)
// ==========================================

export function getDefaultCampaignTemplates(shopId: string, isClothing: boolean): CampaignTemplate[] {
  const now = new Date().toISOString();
  if (isClothing) {
    return [
      {
        id: `tpl_eid_${shopId}`,
        shopId,
        title: 'Eid Special Collection Offer',
        titleBn: 'ঈদ স্পেশাল কালেকশন অফার',
        occasion: 'Eid',
        messageBody:
          'আসসালামু আলাইকুম {{customer_name}}, {{shop_name}}-এ এসেছে নতুন ঈদ পাঞ্জাবি, প্রিমিয়াম শার্ট ও ডেনিম কালেকশন! শোরুমে এসে আপনার পছন্দের সাইজটি সংগ্রহ করুন। আমাদের প্রিয় কাস্টমার হিসেবে আপনার জন্য থাকছে বিশেষ ডিসকাউন্ট ও লয়্যালটি পয়েন্ট সুবিধা!',
        isDefault: true,
        updatedAt: now,
      },
      {
        id: `tpl_puja_${shopId}`,
        shopId,
        title: 'Festive & Puja Offer',
        titleBn: 'পূজা ও উৎসবের বিশেষ ছাড়',
        occasion: 'Puja',
        messageBody:
          'প্রিয় {{customer_name}}, উৎসবের রঙে নিজেকে সাজাতে {{shop_name}}-এ চলছে ফেস্টিভ স্পেশাল অফার! নতুন টি-শার্ট, পোলো, ক্যাজুয়াল শার্ট ও ট্রাউজারে পাচ্ছেন আকর্ষণীয় ছাড়। আজই ভিজিট করুন!',
        isDefault: true,
        updatedAt: now,
      },
      {
        id: `tpl_arrival_${shopId}`,
        shopId,
        title: 'New Stock Arrival Alert',
        titleBn: 'নতুন কালেকশন অ্যালার্ট',
        occasion: 'NewArrival',
        messageBody:
          'হ্যালো {{customer_name}}, {{shop_name}}-এ নতুন এক্সপোর্ট ও প্রিমিয়াম মেনস পোশাকের স্টক এসেছে। আপনার পছন্দের কালার ও সাইজ শেষ হওয়ার আগেই শোরুমে চলে আসুন!',
        isDefault: true,
        updatedAt: now,
      },
    ];
  }

  return [
    {
      id: `tpl_kit_${shopId}`,
      shopId,
      title: 'New Season Jersey Arrival',
      titleBn: 'নতুন সিজনের জার্সি কালেকশন',
      occasion: 'NewArrival',
      messageBody:
        'হ্যালো {{customer_name}}, {{shop_name}}-এ নতুন সিজনের Player Edition ও Fan Issue জার্সি এবং কাস্টম DTF নেম-নাম্বার প্রিন্টিং শুরু হয়েছে! আপনার পছন্দের ক্লাবের কিট নিতে আজই চলে আসুন।',
      isDefault: true,
      updatedAt: now,
    },
    {
      id: `tpl_eid_${shopId}`,
      shopId,
      title: 'Eid & Tournament Special Offer',
      titleBn: 'ঈদ ও টুর্নামেন্ট স্পেশাল ছাড়',
      occasion: 'Eid',
      messageBody:
        'আসসালামু আলাইকুম {{customer_name}}, ঈদ ও আসন্ন টুর্নামেন্ট উপলক্ষে {{shop_name}}-এ সকল প্রিমিয়াম জার্সি, ট্র্যাকসুট ও স্পোর্টসওয়্যারে চলছে বিশেষ ছাড়! আপনার লয়্যালটি পয়েন্ট ব্যবহার করে আরও ডিসকাউন্ট উপভোগ করুন।',
      isDefault: true,
      updatedAt: now,
    },
    {
      id: `tpl_clear_${shopId}`,
      shopId,
      title: 'Season End Clearance Offer',
      titleBn: 'সিজন এন্ড ক্লিয়ারেন্স অফার',
      occasion: 'Clearance',
      messageBody:
        'প্রিয় {{customer_name}}, {{shop_name}}-এ চলছে সিজন এন্ড ক্লিয়ারেন্স সেল! রেট্রো এবং ক্লাব জার্সিতে পাচ্ছেন বিশেষ মূল্যছাড়। স্টক সীমিত!',
      isDefault: true,
      updatedAt: now,
    },
  ];
}

/**
 * Safely replaces {{customer_name}} and {{shop_name}} (as well as single-brace variants)
 * for individual customer messaging.
 */
export function renderCampaignTemplate(
  templateBody: string,
  vars: { customerName?: string; shopName?: string }
): string {
  const safeCustomer = (vars.customerName || '').trim() || 'গ্রাহক';
  const safeShop = (vars.shopName || '').trim() || 'আমাদের শপ';

  return String(templateBody || '')
    .replace(/\{\{\s*customer_name\s*\}\}/gi, safeCustomer)
    .replace(/\{\s*customerName\s*\}/gi, safeCustomer)
    .replace(/\{\{\s*shop_name\s*\}\}/gi, safeShop)
    .replace(/\{\s*shopName\s*\}/gi, safeShop);
}

/**
 * Builds an individual click-to-chat WhatsApp link (`https://wa.me/8801...`)
 * for ONE customer at a time. Does not use any paid API or bulk sender.
 */
export function buildIndividualWhatsAppCampaignUrl(phone: string, renderedMessage: string): string {
  const clean = normalizeBdPhone(phone);
  if (!clean) return '';
  const intlPhone = clean.startsWith('880')
    ? clean
    : clean.startsWith('0')
    ? `88${clean}`
    : `880${clean}`;
  return `https://wa.me/${intlPhone}?text=${encodeURIComponent(renderedMessage)}`;
}

/**
 * Builds an individual `sms:` URI for opening the device's default SMS composer
 * for ONE customer at a time.
 */
export function buildIndividualSmsUrl(phone: string, renderedMessage: string): string {
  const clean = normalizeBdPhone(phone);
  if (!clean) return '';
  return `sms:${clean}?body=${encodeURIComponent(renderedMessage)}`;
}

/**
 * Records that the user clicked to open the WhatsApp/SMS preview in their browser/device.
 * IMPORTANT: Never records status as "sent" or "delivered".
 */
export function createCampaignOpenLog(params: {
  shopId: string;
  customerPhone: string;
  customerName: string;
  templateId: string;
  channel: 'whatsapp' | 'sms';
  openedBy: string;
  timestamp?: string;
}): CampaignOpenLog {
  const {
    shopId,
    customerPhone,
    customerName,
    templateId,
    channel,
    openedBy,
    timestamp = new Date().toISOString(),
  } = params;

  return {
    id: `cmp_log_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    shopId,
    customerPhone: normalizeBdPhone(customerPhone),
    customerName: customerName || 'Walk-in Customer',
    templateId,
    channel,
    action: channel === 'whatsapp' ? 'opened_whatsapp_preview' : 'opened_sms_preview',
    timestamp,
    openedBy,
  };
}

// ==========================================
// 6. PRODUCT & MULTI-VARIANT WORKSPACE ENGINE
// ==========================================

export interface BatchVariantGenerationResult {
  nextVariants: ApparelMatrixVariant[];
  addedCount: number;
  skippedExistingCount: number;
  totalActiveVariants: number;
  totalActiveStock: number;
}

/**
 * Generates multi-size variants for a target color where Batch Stock means
 * the initial stock quantity for EACH newly generated variant (never divided).
 * Existing (color, size) variants are preserved without overwriting their stock or prices.
 */
export function generateBatchVariants(params: {
  existingVariants: ApparelMatrixVariant[];
  sizes: string[];
  color: string;
  baseSku: string;
  batchStock: number;
  costPrice: number;
  mrp: number;
  bottomPrice: number;
  productId?: string;
}): BatchVariantGenerationResult {
  const {
    existingVariants = [],
    sizes = [],
    color,
    baseSku,
    batchStock,
    costPrice,
    mrp,
    bottomPrice,
    productId = 'new',
  } = params;

  const targetColor = (color || 'Black').trim() || 'Black';
  const cleanBaseSku = (baseSku || 'PRD').trim().toUpperCase() || 'PRD';
  const perVariantStock = Math.max(0, Math.floor(Number(batchStock) || 0));
  const cleanCost = Math.max(0, Number(costPrice) || 0);
  const cleanMrp = Math.max(0, Number(mrp) || 0);
  const cleanFloor = Math.max(0, Number(bottomPrice) || 0);

  const nextVariants: ApparelMatrixVariant[] = existingVariants.map((v) => ({ ...v }));
  const usedSkus = new Set(
    nextVariants.map((v) => (v.sku || '').trim().toUpperCase()).filter(Boolean)
  );

  let addedCount = 0;
  let skippedExistingCount = 0;

  const colorCode =
    targetColor
      .replace(/[^a-zA-Z0-9]/g, '')
      .slice(0, 3)
      .toUpperCase() || 'CLR';

  for (const rawSize of sizes) {
    const cleanSize = String(rawSize || '').trim();
    if (!cleanSize) continue;

    const alreadyExists = nextVariants.some(
      (v) =>
        (v.color || '').trim().toLowerCase() === targetColor.toLowerCase() &&
        v.size.trim().toLowerCase() === cleanSize.toLowerCase()
    );

    if (alreadyExists) {
      skippedExistingCount += 1;
      continue;
    }

    let candidateSku = `${cleanBaseSku}-${colorCode}-${cleanSize.toUpperCase()}`;
    let suffix = 2;
    while (usedSkus.has(candidateSku.toUpperCase())) {
      candidateSku = `${cleanBaseSku}-${colorCode}-${cleanSize.toUpperCase()}-${suffix}`;
      suffix += 1;
    }
    usedSkus.add(candidateSku.toUpperCase());

    nextVariants.push({
      id: buildVariantId(productId, cleanSize, targetColor),
      color: targetColor,
      size: cleanSize,
      sku: candidateSku,
      stock: perVariantStock,
      costPrice: cleanCost,
      mrp: cleanMrp,
      bottomPrice: cleanFloor,
      isActive: true,
    });
    addedCount += 1;
  }

  const activeVariants = nextVariants.filter((v) => v.isActive !== false);
  const totalActiveVariants = activeVariants.length;
  const totalActiveStock = activeVariants.reduce(
    (sum, v) => sum + Math.max(0, Math.floor(Number(v.stock) || 0)),
    0
  );

  return {
    nextVariants,
    addedCount,
    skippedExistingCount,
    totalActiveVariants,
    totalActiveStock,
  };
}

export interface ProductFormValidationResult {
  isValid: boolean;
  errors: string[];
  variantRowErrors: Record<number, string[]>;
}

/**
 * Validates product & multi-variant form fields before saving:
 * - Missing product name or category
 * - Negative stock or prices
 * - Floor price higher than selling price
 * - Duplicate (Color + Size) combinations
 * - Duplicate SKUs
 */
export function validateProductFormInput(params: {
  name: string;
  category: string;
  variants: ApparelMatrixVariant[];
  showBuyingCost?: boolean;
}): ProductFormValidationResult {
  const { name, category, variants = [], showBuyingCost = true } = params;
  const errors: string[] = [];
  const variantRowErrors: Record<number, string[]> = {};

  const addRowError = (idx: number, msg: string) => {
    if (!variantRowErrors[idx]) variantRowErrors[idx] = [];
    variantRowErrors[idx].push(msg);
  };

  if (!String(name || '').trim()) {
    errors.push('প্রোডাক্টের নাম লিখুন (Product Name আবশ্যক)।');
  }

  if (!String(category || '').trim()) {
    errors.push('প্রোডাক্টের ক্যাটাগরি নির্বাচন করুন (Category আবশ্যক)।');
  }

  if (!Array.isArray(variants) || variants.length === 0) {
    errors.push('কমপক্ষে ১টি ভ্যারিয়েন্ট (Color ও Size) যুক্ত করুন।');
  }

  const seenColorSize = new Map<string, number>();
  const seenSku = new Map<string, number>();

  variants.forEach((v, idx) => {
    const color = String(v.color || '').trim();
    const size = String(v.size || '').trim();
    const sku = String(v.sku || '').trim();
    const stock = Number(v.stock);
    const mrp = Number(v.mrp);
    const floor = Number(v.bottomPrice);
    const cost = Number(v.costPrice || 0);

    if (!color) {
      addRowError(idx, 'কালার (Color) লিখুন');
    }
    if (!size) {
      addRowError(idx, 'সাইজ (Size) লিখুন');
    }

    if (Number.isNaN(stock) || stock < 0) {
      addRowError(idx, 'স্টক ঋণাত্মক (Negative) হতে পারবে না');
    }
    if (Number.isNaN(mrp) || mrp <= 0) {
      addRowError(idx, 'বিক্রয় মূল্য (Selling Price) ০ এর বেশি হতে হবে');
    }
    if (Number.isNaN(floor) || floor < 0) {
      addRowError(idx, 'সর্বনিম্ন মূল্য (Floor Price) ঋণাত্মক হতে পারবে না');
    }
    if (!Number.isNaN(mrp) && !Number.isNaN(floor) && floor > mrp) {
      addRowError(
        idx,
        `Floor Price (৳${floor}) বিক্রয় মূল্যের (৳${mrp}) চেয়ে বেশি হতে পারবে না`
      );
    }
    if (showBuyingCost && (Number.isNaN(cost) || cost < 0)) {
      addRowError(idx, 'কেনা মূল্য (Buying Price) ঋণাত্মক হতে পারবে না');
    }

    if (color && size) {
      const comboKey = `${color.toLowerCase()}__${size.toLowerCase()}`;
      if (seenColorSize.has(comboKey)) {
        const firstIdx = seenColorSize.get(comboKey)!;
        addRowError(
          idx,
          `ডুপ্লিকেট ভ্যারিয়েন্ট: "${color} / ${size}" ইতিমধ্যে সারি #${firstIdx + 1}-এ রয়েছে`
        );
      } else {
        seenColorSize.set(comboKey, idx);
      }
    }

    if (sku) {
      const skuKey = sku.toUpperCase();
      if (seenSku.has(skuKey)) {
        const firstIdx = seenSku.get(skuKey)!;
        addRowError(
          idx,
          `ডুপ্লিকেট SKU: "${sku}" ইতিমধ্যে সারি #${firstIdx + 1}-এ ব্যবহৃত হয়েছে`
        );
      } else {
        seenSku.set(skuKey, idx);
      }
    }
  });

  Object.entries(variantRowErrors).forEach(([rowIdx, rowMsgs]) => {
    rowMsgs.forEach((m) => {
      errors.push(`ভ্যারিয়েন্ট সারি #${Number(rowIdx) + 1}: ${m}`);
    });
  });

  return {
    isValid: errors.length === 0,
    errors,
    variantRowErrors,
  };
}

/**
 * Compares an existing product's variants against updated variants during product edit
 * and builds immutable StockAdjustmentRecord entries for any variant whose stock changed.
 */
export function buildProductEditStockAdjustments(params: {
  shopId: string;
  existingProduct: InventoryItem;
  updatedProductName: string;
  updatedBaseSku: string;
  updatedVariants: ApparelMatrixVariant[];
  reason?: string;
  responsibleUser: string;
  userRole?: UserRole;
  timestamp?: string;
}): StockAdjustmentRecord[] {
  const {
    shopId,
    existingProduct,
    updatedProductName,
    updatedBaseSku,
    updatedVariants = [],
    reason = 'Product Edit Stock Correction (প্রোডাক্ট এডিট থেকে স্টক সংশোধন)',
    responsibleUser,
    userRole,
    timestamp = new Date().toISOString(),
  } = params;

  const adjustments: StockAdjustmentRecord[] = [];
  const prevVariants = existingProduct.variants || [];

  updatedVariants.forEach((nextVar) => {
    const prevVar = prevVariants.find(
      (pv) =>
        (pv.id && nextVar.id && pv.id === nextVar.id) ||
        (pv.size.trim().toLowerCase() === nextVar.size.trim().toLowerCase() &&
          (pv.color || '').trim().toLowerCase() === (nextVar.color || '').trim().toLowerCase())
    );
    if (!prevVar) return;

    const prevStock = Math.max(0, Math.floor(Number(prevVar.stock) || 0));
    const nextStock = Math.max(0, Math.floor(Number(nextVar.stock) || 0));
    if (prevStock !== nextStock) {
      adjustments.push({
        id: `stk_edit_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        shopId,
        productId: existingProduct.id,
        productName: updatedProductName,
        sku: nextVar.sku || updatedBaseSku,
        variantId: nextVar.id || prevVar.id,
        size: nextVar.size,
        color: nextVar.color || prevVar.color,
        previousQty: prevStock,
        newQty: nextStock,
        difference: nextStock - prevStock,
        movementType: 'manual_correction',
        reason: reason.trim() || 'Product Edit Stock Correction (প্রোডাক্ট এডিট থেকে স্টক সংশোধন)',
        responsibleUser: responsibleUser || 'Shop Owner',
        userRole,
        timestamp,
      });
    }
  });

  return adjustments;
}

