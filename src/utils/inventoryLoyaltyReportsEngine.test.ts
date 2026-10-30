import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeBdPhone,
  buildShopCustomerId,
  getShopCustomerSummary,
  normalizeProductVariants,
  applyManualStockCorrection,
  getDefaultLoyaltySettings,
  calculateEarnedLoyaltyPoints,
  getEligibleLoyaltyTiers,
  calculateLoyaltyRedemption,
  computeAccurateShopBusinessReport,
  renderCampaignTemplate,
  buildIndividualWhatsAppCampaignUrl,
  createCampaignOpenLog,
  findMatchingInventoryVariant,
  processPosSaleStockDeduction,
  processReturnStockRestoration,
  generateBatchVariants,
  validateProductFormInput,
  buildProductEditStockAdjustments,
} from './inventoryLoyaltyReportsEngine';
import { validateProductImageFile } from './imageOptimization';
import {
  getLanguageStorageKey,
  translateUI,
  pickLocalizedText,
  normalizeAppLanguage,
} from './i18n';
import {
  TUTORIAL_SUBCATEGORIES,
  FAQ_GROUPS,
  DEFAULT_HELP_TUTORIALS,
  DEFAULT_HELP_FAQS,
  LEGAL_POLICY_DOCUMENTS,
  DEFAULT_APP_UPDATES,
  canManageHelpCenterContent,
  filterTutorialsForViewer,
  searchHelpCenterContent,
  validateSupportTicketInput,
} from './helpCenterEngine';
import { InventoryItem, Invoice, LoyaltyTransaction, ShopCustomerProfile } from '../types';

test('Multi-tenant customer isolation: identical phone 01876217089 in Shop A (CLOTHING) and Shop B (SPORTSWEAR) stays 100% isolated', () => {
  const sharedPhone = '01876217089';
  const shopA = 'shop_vogue_apparel'; // CLOTHING
  const shopB = 'shop_galleria_sports'; // SPORTSWEAR

  const idA = buildShopCustomerId(shopA, sharedPhone);
  const idB = buildShopCustomerId(shopB, '+8801876-217089');

  assert.equal(normalizeBdPhone('+8801876-217089'), '01876217089');
  assert.notEqual(idA, idB);
  assert.equal(idA, 'shop_vogue_apparel_01876217089');
  assert.equal(idB, 'shop_galleria_sports_01876217089');

  const combinedInvoices: Invoice[] = [
    {
      id: 'inv_a_1',
      invoiceNo: 'CL-1001',
      shopId: shopA,
      customerName: 'Tanvir Ahmed (Clothing Buyer)',
      customerPhone: '01876217089',
      salesmanId: 's1',
      salesmanName: 'Counter A',
      items: [
        {
          id: 'li_1',
          productId: 'prod_shirt_1',
          itemType: 'apparel',
          title: 'Premium Oxford Shirt',
          color: 'Navy',
          subDetail: 'Shirt • L',
          size: 'L',
          rate: 1500,
          quantity: 2,
          subtotal: 3000,
          costPrice: 700,
          bottomPrice: 1200,
        },
      ],
      subtotal: 3000,
      discount: 0,
      total: 3000,
      paymentMode: 'paid',
      paymentChannel: 'cash',
      advancePaid: 3000,
      dueAmount: 0,
      status: 'completed',
      createdAt: '2026-03-10T10:00:00.000Z',
    },
    {
      id: 'inv_b_1',
      invoiceNo: 'SP-2001',
      shopId: shopB,
      customerName: 'Tanvir Sports Club',
      customerPhone: '+8801876217089',
      salesmanId: 's2',
      salesmanName: 'Counter B',
      items: [
        {
          id: 'li_2',
          productId: 'prod_jersey_1',
          itemType: 'jersey',
          title: 'Argentina Home Player Issue',
          color: 'White/Blue',
          subDetail: 'Player Issue • XL',
          size: 'XL',
          rate: 1450,
          quantity: 1,
          subtotal: 1450,
          costPrice: 720,
          bottomPrice: 1200,
        },
      ],
      subtotal: 1450,
      discount: 50,
      total: 1400,
      paymentMode: 'partial',
      paymentChannel: 'merchantBkash',
      advancePaid: 1000,
      dueAmount: 400,
      status: 'partial_due',
      createdAt: '2026-03-11T12:00:00.000Z',
    },
  ];

  const combinedLoyalty: LoyaltyTransaction[] = [
    {
      id: 'ltx_a_1',
      shopId: shopA,
      customerId: idA,
      customerPhone: sharedPhone,
      customerName: 'Tanvir Ahmed (Clothing Buyer)',
      invoiceId: 'inv_a_1',
      invoiceNo: 'CL-1001',
      type: 'earn',
      points: 60,
      balanceAfter: 60,
      note: 'Earned in Shop A',
      createdBy: 'Owner A',
      timestamp: '2026-03-10T10:00:00.000Z',
    },
    {
      id: 'ltx_b_1',
      shopId: shopB,
      customerId: idB,
      customerPhone: sharedPhone,
      customerName: 'Tanvir Sports Club',
      invoiceId: 'inv_b_1',
      invoiceNo: 'SP-2001',
      type: 'earn',
      points: 10,
      balanceAfter: 10,
      note: 'Earned in Shop B',
      createdBy: 'Owner B',
      timestamp: '2026-03-11T12:00:00.000Z',
    },
  ];

  const profiles: ShopCustomerProfile[] = [
    {
      id: idA,
      shopId: shopA,
      phone: sharedPhone,
      name: 'Tanvir Ahmed (Clothing Buyer)',
      loyaltyPoints: 60,
      lifetimePointsEarned: 60,
      lifetimePointsRedeemed: 0,
      doNotContact: false,
      createdAt: '2026-03-10T10:00:00.000Z',
      updatedAt: '2026-03-10T10:00:00.000Z',
    },
    {
      id: idB,
      shopId: shopB,
      phone: sharedPhone,
      name: 'Tanvir Sports Club',
      loyaltyPoints: 10,
      lifetimePointsEarned: 10,
      lifetimePointsRedeemed: 0,
      doNotContact: true,
      createdAt: '2026-03-11T12:00:00.000Z',
      updatedAt: '2026-03-11T12:00:00.000Z',
    },
  ];

  const summaryA = getShopCustomerSummary({
    shopId: shopA,
    phone: sharedPhone,
    invoices: combinedInvoices,
    loyaltyTransactions: combinedLoyalty,
    customerProfiles: profiles,
  });

  const summaryB = getShopCustomerSummary({
    shopId: shopB,
    phone: sharedPhone,
    invoices: combinedInvoices,
    loyaltyTransactions: combinedLoyalty,
    customerProfiles: profiles,
  });

  // Shop A sees ONLY Shop A data
  assert.equal(summaryA.existsInShop, true);
  assert.equal(summaryA.customerName, 'Tanvir Ahmed (Clothing Buyer)');
  assert.equal(summaryA.invoiceCount, 1);
  assert.equal(summaryA.totalSpent, 3000);
  assert.equal(summaryA.totalDue, 0);
  assert.equal(summaryA.loyaltyPoints, 60);
  assert.equal(summaryA.recentProducts[0].title, 'Premium Oxford Shirt');
  assert.equal(summaryA.doNotContact, false);

  // Shop B sees ONLY Shop B data
  assert.equal(summaryB.existsInShop, true);
  assert.equal(summaryB.customerName, 'Tanvir Sports Club');
  assert.equal(summaryB.invoiceCount, 1);
  assert.equal(summaryB.totalSpent, 1400);
  assert.equal(summaryB.totalDue, 400);
  assert.equal(summaryB.loyaltyPoints, 10);
  assert.equal(summaryB.recentProducts[0].title, 'Argentina Home Player Issue');
  assert.equal(summaryB.doNotContact, true);
});

test('Variant stock correction: records previousQty, newQty, difference, reason, and updates totalStock', () => {
  const sampleProduct: InventoryItem = {
    id: 'prod_tshirt_1',
    shopId: 'shop_vogue_apparel',
    name: 'Heavyweight Drop-Shoulder Tee',
    color: 'Black',
    categoryType: 'apparel',
    clothingCategory: 'T-Shirt',
    lotCostLandingPrice: 280,
    mrp: 650,
    bottomPrice: 500,
    totalStock: 60,
    sku: 'TSH-BLK-01',
    variants: [
      { size: 'M', color: 'Black', stock: 40, costPrice: 280, mrp: 650, bottomPrice: 500 },
      { size: 'L', color: 'Black', stock: 20, costPrice: 280, mrp: 650, bottomPrice: 500 },
    ],
  };

  const normalized = normalizeProductVariants(sampleProduct);
  assert.equal(normalized.totalStock, 60);
  assert.ok(normalized.variants[0].id);

  // Correct mistake: 40 Black Medium entered, actual physical count is 30
  const { updatedItem, adjustmentRecord } = applyManualStockCorrection({
    item: normalized,
    size: 'M',
    color: 'Black',
    newQty: 30,
    reason: 'Physical recount correction: 40 entered by mistake instead of 30',
    shopId: 'shop_vogue_apparel',
    responsibleUser: 'Owner Admin',
    userRole: 'shop_owner',
  });

  assert.equal(updatedItem.variants[0].stock, 30);
  assert.equal(updatedItem.variants[1].stock, 20);
  assert.equal(updatedItem.totalStock, 50);

  assert.equal(adjustmentRecord.previousQty, 40);
  assert.equal(adjustmentRecord.newQty, 30);
  assert.equal(adjustmentRecord.difference, -10);
  assert.equal(adjustmentRecord.movementType, 'manual_correction');
  assert.equal(adjustmentRecord.shopId, 'shop_vogue_apparel');
});

test('Loyalty engine: Mode A vs Mode B calculation, tier eligibility, and floor price check', () => {
  const defaultSettings = getDefaultLoyaltySettings();

  // Mode B (default): 10 points per ৳1,000 spent
  assert.equal(calculateEarnedLoyaltyPoints(950, defaultSettings, 'completed'), 0);
  assert.equal(calculateEarnedLoyaltyPoints(2450, defaultSettings, 'completed'), 20);
  assert.equal(calculateEarnedLoyaltyPoints(2450, defaultSettings, 'returned'), 0);

  // Mode A: 15 points per qualifying purchase >= ৳500
  const modeASettings = {
    ...defaultSettings,
    earningMode: 'per_purchase' as const,
    pointsPerPurchase: 15,
    minPurchaseAmountForPoints: 500,
  };
  assert.equal(calculateEarnedLoyaltyPoints(400, modeASettings, 'completed'), 0);
  assert.equal(calculateEarnedLoyaltyPoints(650, modeASettings, 'completed'), 15);

  // Eligible tiers for 120 points -> 100 pts (5%) and 50 pts (2%)
  const eligible = getEligibleLoyaltyTiers(120, defaultSettings);
  assert.equal(eligible.length, 2);
  assert.equal(eligible[0].pointsRequired, 100);
  assert.equal(eligible[0].discountPercent, 5);

  // Redemption calculation & bottom price check
  const redemption = calculateLoyaltyRedemption({
    cartSubtotal: 1000,
    manualDiscount: 0,
    selectedTier: eligible[0], // 5% off = ৳50
    availablePoints: 120,
    cartItems: [
      {
        id: 'c1',
        itemType: 'apparel',
        title: 'Polo Shirt',
        subDetail: 'L',
        size: 'L',
        rate: 1000,
        quantity: 1,
        subtotal: 1000,
        costPrice: 500,
        bottomPrice: 900, // Floor is 900; 1000 - 50 = 950 >= 900 (OK)
      },
    ],
    enforceBottomPriceLock: true,
  });

  assert.equal(redemption.isValid, true);
  assert.equal(redemption.pointsToRedeem, 100);
  assert.equal(redemption.loyaltyDiscountAmount, 50);
  assert.equal(redemption.finalTotal, 950);
  assert.equal(redemption.violatesBottomPriceFloor, false);
});

test('Business reports: accurate net sales, COGS, profit masking for staff, and zero fake fallback numbers', () => {
  const shopId = 'shop_vogue_apparel';
  const now = new Date('2026-03-15T15:00:00.000Z');

  const invoices: Invoice[] = [
    {
      id: 'inv_1',
      invoiceNo: 'INV-101',
      shopId,
      customerName: 'Rahim',
      customerPhone: '01711000001',
      salesmanId: 's1',
      salesmanName: 'Staff',
      items: [
        {
          id: 'i1',
          productId: 'p1',
          itemType: 'apparel',
          title: 'Formal Shirt',
          color: 'White',
          subDetail: 'M',
          size: 'M',
          rate: 1200,
          quantity: 2,
          subtotal: 2400,
          costPrice: 600,
          bottomPrice: 1000,
        },
      ],
      subtotal: 2400,
      discount: 200,
      loyaltyDiscountAmount: 100,
      total: 2200,
      paymentMode: 'paid',
      paymentChannel: 'split',
      splitBreakdown: {
        cash: 1200,
        merchantBkash: 1000,
        personalBkash: 0,
        nagad: 0,
        bank: 0,
      },
      advancePaid: 2200,
      dueAmount: 0,
      status: 'completed',
      createdAt: '2026-03-15T10:00:00.000Z',
    },
  ];

  const ownerReport = computeAccurateShopBusinessReport({
    shopId,
    role: 'shop_owner',
    invoices,
    inventory: [],
    expenses: [
      {
        id: 'e1',
        shopId,
        category: 'food',
        amount: 150,
        paymentDrawer: 'cash',
        note: 'Snacks',
        date: '2026-03-15',
        createdAt: '2026-03-15T11:00:00.000Z',
        createdBy: 'Owner',
      },
    ],
    preset: 'today',
    now,
  });

  assert.equal(ownerReport.grossSales, 2400);
  assert.equal(ownerReport.totalDiscounts, 200);
  assert.equal(ownerReport.netSales, 2200);
  assert.equal(ownerReport.totalCogs, 1200); // 2 * 600
  assert.equal(ownerReport.grossProfit, 1000); // 2200 - 1200
  assert.equal(ownerReport.totalExpenses, 150);
  assert.equal(ownerReport.netProfit, 850); // 1000 - 150
  assert.equal(ownerReport.paymentReconciliation.cash, 1200);
  assert.equal(ownerReport.paymentReconciliation.merchantBkash, 1000);
  // Days without sales in dailyTrend must have 0 netSales (not fake numbers)
  const emptyDays = ownerReport.dailyTrend.filter((d) => d.dateKey !== '2026-03-15');
  assert.ok(emptyDays.every((d) => d.netSales === 0 && d.ordersCount === 0));

  // Staff role must have cost and profit masked to 0
  const staffReport = computeAccurateShopBusinessReport({
    shopId,
    role: 'salesman',
    invoices,
    inventory: [],
    expenses: [],
    preset: 'today',
    now,
  });
  assert.equal(staffReport.canSeeCostAndProfit, false);
  assert.equal(staffReport.totalCogs, 0);
  assert.equal(staffReport.grossProfit, 0);
  assert.equal(staffReport.netProfit, 0);
});

test('Festive Offers & Individual WhatsApp: renders placeholders and logs opened_whatsapp_preview only', () => {
  const msg = renderCampaignTemplate(
    'আসসালামু আলাইকুম {{customer_name}}, {{shop_name}}-এ চলছে ঈদ অফার!',
    { customerName: 'মাহমুদ হাসান', shopName: 'Vogue Men Apparel' }
  );
  assert.equal(msg, 'আসসালামু আলাইকুম মাহমুদ হাসান, Vogue Men Apparel-এ চলছে ঈদ অফার!');

  const waUrl = buildIndividualWhatsAppCampaignUrl('01876217089', msg);
  assert.ok(waUrl.startsWith('https://wa.me/8801876217089?text='));

  const log = createCampaignOpenLog({
    shopId: 'shop_vogue_apparel',
    customerPhone: '01876217089',
    customerName: 'মাহমুদ হাসান',
    templateId: 'tpl_eid',
    channel: 'whatsapp',
    openedBy: 'Shop Owner',
  });
  assert.equal(log.action, 'opened_whatsapp_preview');
});

test('Image validation: enforces allowed MIME types and 5MB max file size', () => {
  assert.equal(validateProductImageFile({ type: 'image/webp', size: 120_000 }).valid, true);
  assert.equal(validateProductImageFile({ type: 'image/pdf', size: 120_000 }).valid, false);
  assert.equal(validateProductImageFile({ type: 'image/jpeg', size: 8 * 1024 * 1024 }).valid, false);
});

test('POS & Inventory Sync: Black T-Shirt M (stock 40) selling 3 pcs becomes 37, idempotent on retry, skips manual items, and respects Inventory Tracking OFF', () => {
  const shopId = 'shop_vogue_apparel';
  const initialInventory: InventoryItem[] = [
    normalizeProductVariants({
      id: 'prod_tshirt_1',
      shopId,
      name: 'T-Shirt',
      color: 'Black',
      categoryType: 'apparel',
      clothingCategory: 'T-Shirt',
      lotCostLandingPrice: 250,
      mrp: 400,
      bottomPrice: 350,
      totalStock: 90,
      sku: 'TSH-01',
      variants: [
        { size: 'M', color: 'Black', stock: 40, costPrice: 250, mrp: 400, bottomPrice: 350 },
        { size: 'L', color: 'Black', stock: 30, costPrice: 250, mrp: 400, bottomPrice: 350 },
        { size: 'M', color: 'White', stock: 20, costPrice: 260, mrp: 420, bottomPrice: 360 },
      ],
    }),
  ];

  const saleInvoice: Invoice = {
    id: 'inv_pos_100',
    invoiceNo: 'VG-2026-0100',
    shopId,
    customerName: 'Arif Hossain',
    customerPhone: '01711223344',
    salesmanId: 'staff_1',
    salesmanName: 'Tanvir',
    items: [
      {
        id: 'line_1',
        productId: 'prod_tshirt_1',
        itemType: 'apparel',
        title: 'T-Shirt',
        color: 'Black',
        subDetail: 'T-Shirt • Color: Black • Size M',
        size: 'M',
        rate: 400,
        quantity: 3,
        subtotal: 1200,
        costPrice: 250,
        bottomPrice: 350,
      },
      {
        id: 'line_manual_1',
        itemType: 'apparel',
        title: 'Custom Leather Belt',
        subDetail: 'Manual Item (Non-Inventory)',
        size: 'Free Size',
        rate: 500,
        quantity: 2,
        subtotal: 1000,
        costPrice: 300,
        bottomPrice: 500,
        isManualInventoryEntry: true,
      },
    ],
    subtotal: 2200,
    discount: 0,
    total: 2200,
    paymentMode: 'paid',
    paymentChannel: 'cash',
    advancePaid: 2200,
    dueAmount: 0,
    status: 'completed',
    createdAt: '2026-03-20T10:00:00.000Z',
  };

  // 1. When Inventory Tracking is OFF: stock remains 40, no movements recorded
  const offResult = processPosSaleStockDeduction({
    shopId,
    invoice: saleInvoice,
    inventory: initialInventory,
    existingAdjustments: [],
    inventoryTrackingEnabled: false,
    responsibleUser: 'Tanvir',
  });
  assert.equal(offResult.stockDeducted, false);
  assert.equal(offResult.stockMovements.length, 0);
  const blackMWhenOff = offResult.updatedInventory[0].variants.find(
    (v) => v.color === 'Black' && v.size === 'M'
  );
  assert.equal(blackMWhenOff?.stock, 40);

  // 2. When Inventory Tracking is ON: Black M stock 40 - 3 = 37; Black L stays 30; White M stays 20; totalStock = 87
  const onResult = processPosSaleStockDeduction({
    shopId,
    invoice: saleInvoice,
    inventory: initialInventory,
    existingAdjustments: [],
    inventoryTrackingEnabled: true,
    responsibleUser: 'Tanvir',
  });
  assert.equal(onResult.stockDeducted, true);
  assert.equal(onResult.alreadyProcessed, false);
  assert.equal(onResult.stockMovements.length, 1); // Manual item was skipped!
  assert.equal(onResult.stockMovements[0].previousQty, 40);
  assert.equal(onResult.stockMovements[0].newQty, 37);
  assert.equal(onResult.stockMovements[0].difference, -3);
  assert.equal(onResult.stockMovements[0].movementType, 'sale');

  const updatedProduct = onResult.updatedInventory[0];
  assert.equal(
    updatedProduct.variants.find((v) => v.color === 'Black' && v.size === 'M')?.stock,
    37
  );
  assert.equal(
    updatedProduct.variants.find((v) => v.color === 'Black' && v.size === 'L')?.stock,
    30
  );
  assert.equal(
    updatedProduct.variants.find((v) => v.color === 'White' && v.size === 'M')?.stock,
    20
  );
  assert.equal(updatedProduct.totalStock, 87);

  // 3. Idempotency: Retrying the same invoice does NOT deduct stock a second time
  const retryResult = processPosSaleStockDeduction({
    shopId,
    invoice: saleInvoice,
    inventory: onResult.updatedInventory,
    existingAdjustments: onResult.stockMovements,
    inventoryTrackingEnabled: true,
    responsibleUser: 'Tanvir',
  });
  assert.equal(retryResult.alreadyProcessed, true);
  assert.equal(retryResult.stockMovements.length, 0);
  assert.equal(
    retryResult.updatedInventory[0].variants.find((v) => v.color === 'Black' && v.size === 'M')?.stock,
    37
  );

  // 4. Return / Cancellation restores stock back from 37 to 40 idempotently
  const returnResult = processReturnStockRestoration({
    shopId,
    invoice: { ...saleInvoice, stockDeducted: true },
    inventory: onResult.updatedInventory,
    existingAdjustments: onResult.stockMovements,
    responsibleUser: 'Shop Owner',
  });
  assert.equal(returnResult.alreadyRestored, false);
  assert.equal(returnResult.stockMovements.length, 1);
  assert.equal(
    returnResult.updatedInventory[0].variants.find((v) => v.color === 'Black' && v.size === 'M')?.stock,
    40
  );
});

test('Stock Overselling Prevention: Rejects checkout when sold quantity exceeds available variant stock', () => {
  const shopId = 'shop_test_oversell';
  const initialInventory: InventoryItem[] = [
    {
      id: 'prod_limited',
      shopId,
      name: 'Limited Edition Jersey',
      categoryType: 'jersey',
      subCategory: 'Club',
      sku: 'LTD-01',
      lotCostLandingPrice: 600,
      mrp: 1200,
      bottomPrice: 1000,
      totalStock: 5,
      variants: [
        { id: 'var_ltd_m', size: 'M', color: 'Home', stock: 2, costPrice: 600, mrp: 1200, bottomPrice: 1000, isActive: true },
      ],
    },
  ];

  const oversellingInvoice: Invoice = {
    id: 'inv_oversell_1',
    shopId,
    invoiceNo: 'LEK-OVER-01',
    customerName: 'Karim',
    customerPhone: '01700000000',
    salesmanId: 'staff_1',
    salesmanName: 'Staff Member',
    items: [
      {
        id: 'item_1',
        itemType: 'jersey',
        productId: 'prod_limited',
        variantId: 'var_ltd_m',
        title: 'Limited Edition Jersey',
        subDetail: 'Player Issue Home',
        size: 'M',
        color: 'Home',
        rate: 1200,
        costPrice: 600,
        bottomPrice: 1000,
        quantity: 5, // Tries to buy 5 when only 2 exist!
        subtotal: 6000,
      },
    ],
    subtotal: 6000,
    discount: 0,
    total: 6000,
    paymentMode: 'paid',
    paymentChannel: 'cash',
    advancePaid: 6000,
    dueAmount: 0,
    status: 'completed',
    createdAt: new Date().toISOString(),
  };

  assert.throws(
    () => {
      processPosSaleStockDeduction({
        shopId,
        invoice: oversellingInvoice,
        inventory: initialInventory,
        existingAdjustments: [],
        inventoryTrackingEnabled: true,
        allowOutOfStockSelling: false,
        responsibleUser: 'Cashier',
      });
    },
    (err: any) => {
      assert.match(err.message, /অপর্যাপ্ত স্টক/);
      return true;
    }
  );
});

test('Batch Stock & Multi-Variant Generator: assigns Batch Stock to EACH newly generated variant (never divides) and preserves edited variants', () => {
  // 1. Product: T-Shirt, Sizes: S, M, L, XL, XXL, Default Color: Black, Batch Stock: 20 => 5 variants x 20 = 100 total stock
  const batch1 = generateBatchVariants({
    existingVariants: [],
    sizes: ['S', 'M', 'L', 'XL', 'XXL'],
    color: 'Black',
    baseSku: 'TSH-001',
    batchStock: 20,
    costPrice: 250,
    mrp: 450,
    bottomPrice: 380,
    productId: 'prod_tshirt_batch',
  });

  assert.equal(batch1.addedCount, 5);
  assert.equal(batch1.skippedExistingCount, 0);
  assert.equal(batch1.totalActiveVariants, 5);
  assert.equal(batch1.totalActiveStock, 100);
  assert.ok(batch1.nextVariants.every((v) => v.stock === 20 && v.color === 'Black'));

  // 2. User manually edits Black / M stock to 35; re-running preset S..XXL with batchStock 10 must NOT overwrite Black / M
  const manuallyEdited = batch1.nextVariants.map((v) =>
    v.size === 'M' ? { ...v, stock: 35, mrp: 480 } : v
  );

  const batchReRun = generateBatchVariants({
    existingVariants: manuallyEdited,
    sizes: ['S', 'M', 'L', 'XL', 'XXL', '3XL'],
    color: 'Black',
    baseSku: 'TSH-001',
    batchStock: 10,
    costPrice: 250,
    mrp: 450,
    bottomPrice: 380,
    productId: 'prod_tshirt_batch',
  });

  assert.equal(batchReRun.addedCount, 1); // Only 3XL is newly added
  assert.equal(batchReRun.skippedExistingCount, 5); // S, M, L, XL, XXL preserved
  const blackM = batchReRun.nextVariants.find((v) => v.color === 'Black' && v.size === 'M');
  const black3XL = batchReRun.nextVariants.find((v) => v.color === 'Black' && v.size === '3XL');
  assert.equal(blackM?.stock, 35);
  assert.equal(blackM?.mrp, 480);
  assert.equal(black3XL?.stock, 10);

  // 3. Add a second color (White) under the SAME product
  const batchWhite = generateBatchVariants({
    existingVariants: batchReRun.nextVariants,
    sizes: ['M', 'L', 'XL'],
    color: 'White',
    baseSku: 'TSH-001',
    batchStock: 15,
    costPrice: 250,
    mrp: 450,
    bottomPrice: 380,
    productId: 'prod_tshirt_batch',
  });

  assert.equal(batchWhite.addedCount, 3);
  assert.equal(batchWhite.totalActiveVariants, 9); // 6 Black + 3 White
  // Total stock = (20 + 35 + 20 + 20 + 20 + 10) + (15 * 3) = 125 + 45 = 170
  assert.equal(batchWhite.totalActiveStock, 170);
});

test('Product Form Validation & Edit Stock Audit Trail: blocks invalid prices/duplicates and records stock adjustments on edit', () => {
  const invalidValidation = validateProductFormInput({
    name: '',
    category: 'T-Shirt',
    variants: [
      {
        id: 'v1',
        color: 'Black',
        size: 'M',
        sku: 'DUP-SKU-1',
        stock: 20,
        costPrice: 250,
        mrp: 400,
        bottomPrice: 450, // Floor > Selling Price!
        isActive: true,
      },
      {
        id: 'v2',
        color: 'Black',
        size: 'M', // Duplicate (Black, M)!
        sku: 'DUP-SKU-1', // Duplicate SKU!
        stock: 15,
        costPrice: 250,
        mrp: 400,
        bottomPrice: 350,
        isActive: true,
      },
    ],
    showBuyingCost: true,
  });

  assert.equal(invalidValidation.isValid, false);
  assert.ok(invalidValidation.errors.some((e) => e.includes('প্রোডাক্টের নাম')));
  assert.ok(invalidValidation.errors.some((e) => e.includes('Floor Price')));
  assert.ok(invalidValidation.errors.some((e) => e.includes('ডুপ্লিকেট ভ্যারিয়েন্ট')));
  assert.ok(invalidValidation.errors.some((e) => e.includes('ডুপ্লিকেট SKU')));

  // Existing product edit stock adjustment check
  const existingProduct: InventoryItem = {
    id: 'prod_edit_1',
    shopId: 'shop_vogue_apparel',
    name: 'Oxford Shirt',
    categoryType: 'apparel',
    clothingCategory: 'Shirt',
    sku: 'OXF-01',
    lotCostLandingPrice: 550,
    mrp: 980,
    bottomPrice: 850,
    totalStock: 60,
    variants: [
      { id: 'v_m', color: 'Navy', size: 'M', sku: 'OXF-01-NAV-M', stock: 40, costPrice: 550, mrp: 980, bottomPrice: 850, isActive: true },
      { id: 'v_l', color: 'Navy', size: 'L', sku: 'OXF-01-NAV-L', stock: 20, costPrice: 550, mrp: 980, bottomPrice: 850, isActive: true },
    ],
  };

  const adjustments = buildProductEditStockAdjustments({
    shopId: 'shop_vogue_apparel',
    existingProduct,
    updatedProductName: 'Oxford Shirt',
    updatedBaseSku: 'OXF-01',
    updatedVariants: [
      { id: 'v_m', color: 'Navy', size: 'M', sku: 'OXF-01-NAV-M', stock: 30, costPrice: 550, mrp: 980, bottomPrice: 850, isActive: true },
      { id: 'v_l', color: 'Navy', size: 'L', sku: 'OXF-01-NAV-L', stock: 20, costPrice: 550, mrp: 980, bottomPrice: 850, isActive: true },
    ],
    reason: 'Physical recount correction during product edit',
    responsibleUser: 'Owner Admin',
    userRole: 'shop_owner',
  });

  assert.equal(adjustments.length, 1);
  assert.equal(adjustments[0].variantId, 'v_m');
  assert.equal(adjustments[0].previousQty, 40);
  assert.equal(adjustments[0].newQty, 30);
  assert.equal(adjustments[0].difference, -10);
  assert.equal(adjustments[0].reason, 'Physical recount correction during product edit');
});

test('Language Settings (i18n): tenant/user storage key isolation and zero raw-key leak', () => {
  const keyShopA = getLanguageStorageKey('shop_vogue_apparel', 'owner_vogue');
  const keyShopB = getLanguageStorageKey('shop_galleria_sports', 'owner_galleria');
  assert.notEqual(keyShopA, keyShopB);
  assert.equal(keyShopA, 'lekho_pos_lang_v1::shop_vogue_apparel::owner_vogue');
  assert.equal(keyShopB, 'lekho_pos_lang_v1::shop_galleria_sports::owner_galleria');

  assert.equal(normalizeAppLanguage('en'), 'en');
  assert.equal(normalizeAppLanguage('bn'), 'bn');
  assert.equal(normalizeAppLanguage(undefined), 'bn');

  assert.equal(translateUI('bn', 'nav.help'), 'হেল্প সেন্টার ও গাইড');
  assert.equal(translateUI('en', 'nav.help'), 'Help Center');
  assert.equal(pickLocalizedText('bn', 'বাংলা শিরোনাম', 'English Title'), 'বাংলা শিরোনাম');
  assert.equal(pickLocalizedText('en', 'বাংলা শিরোনাম', 'English Title'), 'English Title');
});

test('LEKHO Help Center Engine: 7 tutorial subcategories, 6 FAQ groups, 6 legal policies, CLOTHING vs SPORTSWEAR isolation, and RBAC guards', () => {
  assert.equal(TUTORIAL_SUBCATEGORIES.length, 7);
  assert.equal(FAQ_GROUPS.length, 6);
  assert.equal(LEGAL_POLICY_DOCUMENTS.length, 6);
  assert.ok(DEFAULT_APP_UPDATES.length >= 3);

  // Verify no fake playable video URLs are present in default guides
  for (const guide of DEFAULT_HELP_TUTORIALS) {
    assert.equal(guide.videoUrl, '');
  }

  // RBAC: only super_admin can publish/edit platform-wide Help Center content
  assert.equal(canManageHelpCenterContent('super_admin'), true);
  assert.equal(canManageHelpCenterContent('shop_owner'), false);
  assert.equal(canManageHelpCenterContent('manager'), false);
  assert.equal(canManageHelpCenterContent('salesman'), false);

  // Shop Category Isolation: CLOTHING shop must never see SPORTSWEAR-only guides
  const clothingGuides = filterTutorialsForViewer(
    DEFAULT_HELP_TUTORIALS,
    { category: 'clothing', shopCategory: 'CLOTHING' },
    'shop_owner'
  );
  assert.ok(clothingGuides.length > 0);
  assert.ok(clothingGuides.every((g) => g.shopCategoryScope !== 'SPORTSWEAR'));
  assert.ok(clothingGuides.some((g) => g.shopCategoryScope === 'CLOTHING'));

  // SPORTSWEAR shop sees SPORTSWEAR guides and never sees CLOTHING-only guides
  const sportswearGuides = filterTutorialsForViewer(
    DEFAULT_HELP_TUTORIALS,
    { category: 'jersey', shopCategory: 'SPORTS WEAR' },
    'shop_owner'
  );
  assert.ok(sportswearGuides.length > 0);
  assert.ok(sportswearGuides.every((g) => g.shopCategoryScope !== 'CLOTHING'));
  assert.ok(sportswearGuides.some((g) => g.shopCategoryScope === 'SPORTSWEAR'));

  // Unified search across tutorials, FAQs, policies, and release updates
  const searchResults = searchHelpCenterContent(
    'Grace',
    { category: 'clothing', shopCategory: 'CLOTHING' },
    'shop_owner',
    DEFAULT_HELP_TUTORIALS,
    DEFAULT_HELP_FAQS,
    LEGAL_POLICY_DOCUMENTS,
    DEFAULT_APP_UPDATES
  );
  assert.ok(searchResults.length > 0);

  // Support ticket validation
  const invalidTicket = validateSupportTicketInput({
    reporterName: '',
    reporterEmailOrPhone: '12',
    subject: 'Hi',
    message: 'short',
  });
  assert.equal(invalidTicket.valid, false);
  assert.ok(invalidTicket.errorBn);

  const validTicket = validateSupportTicketInput({
    reporterName: 'Tanvir Ahmed',
    reporterEmailOrPhone: '+8801711-223399',
    subject: 'Thermal receipt 58mm alignment query',
    message: 'How do I switch our counter thermal printer from 80mm to 58mm roll size?',
  });
  assert.equal(validTicket.valid, true);
  assert.equal(validTicket.errorBn, undefined);
});




