import test from 'node:test';
import assert from 'node:assert/strict';
import { dbService } from './db';
import { authService } from './authService';
import { TenantShop } from '../types';

// Mock localStorage in Node test environment
const storageMap = new Map<string, string>();
(globalThis as any).localStorage = {
  getItem: (key: string) => (storageMap.has(key) ? storageMap.get(key)! : null),
  setItem: (key: string, val: string) => storageMap.set(key, String(val)),
  removeItem: (key: string) => storageMap.delete(key),
  clear: () => storageMap.clear(),
};

test('Multi-store isolation: newly created store has clean empty data and does not inherit Galleria Sports BD demo records', () => {
  storageMap.clear();

  const newShopId = 'shop_alpha_clothing_999';
  const newTenant: TenantShop = {
    id: newShopId,
    merchantId: 'MRC-999111',
    name: 'Alpha Clothing House',
    ownerName: 'Tanvir Hossain',
    ownerPhone: '01712345678',
    email: 'tanvir@alphaclothing.com',
    isEmailVerified: true,
    accountStatus: 'active',
    shopCategoryType: 'CLOTHING',
    category: 'clothing',
    marketMallName: 'Bashundhara City',
    shopNo: 'Level 3, Block B',
    returnPolicy: '7 days exchange with tag.',
    ownerPin: '4321',
    subscription: {
      plan: 'pro',
      status: 'active',
      monthlyFeeBdt: 1500,
      expiresAt: '2027-01-01',
      lastPaidAt: '2026-01-01',
    },
    featureFlags: {
      offlinePos: true,
      whatsAppReceipts: true,
      multiDrawer: true,
      blindProfitMode: true,
      alterationTracking: true,
      alterationTracker: true,
      staffPins: true,
      jerseyCustomization: false,
      resellerCounter: true,
      teamBulkOrders: false,
    },
  };

  dbService.addTenant(newTenant);
  dbService.setCurrentTenantId(newShopId);

  assert.equal(dbService.getCurrentTenantId(), newShopId);

  // Verify the new store has empty records, not Galleria Sports BD's demo data
  assert.equal(dbService.getInventory(newShopId).length, 0);
  assert.equal(dbService.getInvoices(newShopId).length, 0);
  assert.equal(dbService.getResellers(newShopId).length, 0);
  assert.equal(dbService.getFontOrders(newShopId).length, 0);
  assert.equal(dbService.getExpenses(newShopId).length, 0);

  // Meanwhile, demo store still has its own isolated records
  assert.ok(dbService.getInventory('shop_galleria_sports').length > 0);
  assert.ok(dbService.getResellers('shop_galleria_sports').length > 0);
});

test('Store profile & StoreConfiguration persistence and isolation across stores', () => {
  const shopId = 'shop_alpha_clothing_999';

  dbService.updateTenant(shopId, {
    name: 'Alpha Premier Apparel',
    ownerName: 'Tanvir H. Chowdhury',
  });

  const updatedTenant = dbService.getTenants().find((t) => t.id === shopId);
  assert.ok(updatedTenant);
  assert.equal(updatedTenant.name, 'Alpha Premier Apparel');
  assert.equal(updatedTenant.ownerName, 'Tanvir H. Chowdhury');

  // Save custom StoreConfiguration
  const savedConfig = dbService.saveStoreConfig(shopId, {
    defaultMarkupPercentage: 95,
    lowStockThreshold: 12,
    defaultAlterationPrice: 150,
    exchangeWindowDays: 14,
  });

  assert.equal(savedConfig.defaultMarkupPercentage, 95);
  assert.equal(savedConfig.lowStockThreshold, 12);
  assert.equal(savedConfig.defaultAlterationPrice, 150);
  assert.equal(savedConfig.exchangeWindowDays, 14);

  // Other store's config remains untouched
  const otherStoreConfig = dbService.getStoreConfig('shop_galleria_sports');
  assert.equal(otherStoreConfig.defaultMarkupPercentage, 85);
});

test('Custom categories & safe deletion checks prevent deleting categories in use', () => {
  const shopId = 'shop_alpha_clothing_999';

  // Add custom expense category
  const expCats = dbService.getExpenseCategories(shopId);
  const customExpCat = { id: 'wifi_bill', name: 'wifi_bill', label: 'WiFi & Internet', bnLabel: 'ওয়াইফাই বিল', color: 'emerald' };
  dbService.saveExpenseCategories(shopId, [...expCats, customExpCat]);

  // Initially unused -> deletion is allowed
  const checkUnused = dbService.canDeleteExpenseCategory(shopId, 'wifi_bill');
  assert.equal(checkUnused.canDelete, true);

  // Add an expense record referencing 'wifi_bill'
  dbService.addExpense(shopId, {
    id: 'exp_test_1',
    shopId,
    category: 'wifi_bill' as any,
    amount: 1200,
    paymentDrawer: 'cash',
    note: 'Monthly Fiber Internet',
    date: '2026-04-01',
    createdAt: new Date().toISOString(),
    createdBy: 'Tanvir',
  });

  // Now in use -> deletion is blocked with clear message
  const checkInUse = dbService.canDeleteExpenseCategory(shopId, 'wifi_bill');
  assert.equal(checkInUse.canDelete, false);
  assert.ok(checkInUse.reason && checkInUse.reason.includes('1'));

  // Session store info sync
  authService.setSession({
    userType: 'merchant',
    userId: 'usr_1',
    email: 'tanvir@alphaclothing.com',
    name: 'Tanvir Hossain',
    role: 'shop_owner',
    shopId,
    shopName: 'Alpha Clothing House',
    category: 'clothing',
    officialCategory: 'CLOTHING',
    token: 'tok_123',
    issuedAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 86400000).toISOString(),
  });

  authService.updateSessionStoreInfo({
    shopName: 'Alpha Premier Apparel',
    name: 'Tanvir H. Chowdhury',
  });

  const syncedSession = authService.getSession();
  assert.ok(syncedSession);
  assert.equal(syncedSession.shopName, 'Alpha Premier Apparel');
  assert.equal(syncedSession.name, 'Tanvir H. Chowdhury');
});

test('Category-Based Merchant Access: Men\'s Clothing store gets all 13 Men\'s Clothing categories without duplicates and blocks Sportswear-only actions', async () => {
  const {
    MENS_CLOTHING_CATEGORY_NAMES,
    resolveBusinessCategory,
    isClothingShop,
    isSportswearShop,
    isTabAllowedForCategory,
    sanitizeNavigationTabForShop,
    canPerformCategoryAction,
  } = await import('../utils/securityPolicy');

  const clothingShop = dbService.getTenants().find((t) => t.id === 'shop_vogue_apparel');
  const sportswearShop = dbService.getTenants().find((t) => t.id === 'shop_galleria_sports');

  assert.ok(clothingShop, 'Clothing demo store must exist');
  assert.ok(sportswearShop, 'Sportswear demo store must exist');

  // 1. Category resolution
  assert.equal(resolveBusinessCategory(clothingShop), 'clothing');
  assert.equal(isClothingShop(clothingShop), true);
  assert.equal(isSportswearShop(clothingShop), false);

  assert.equal(resolveBusinessCategory(sportswearShop), 'jersey');
  assert.equal(isSportswearShop(sportswearShop), true);
  assert.equal(isClothingShop(sportswearShop), false);

  // 2. Navigation tab isolation
  assert.equal(isTabAllowedForCategory('pipeline', clothingShop), false, 'Clothing store must not access Heat-Press Pipeline');
  assert.equal(isTabAllowedForCategory('team', clothingShop), false, 'Clothing store must not access Team Bulk Jersey Matrix');
  assert.equal(isTabAllowedForCategory('pos', clothingShop), true);
  assert.equal(isTabAllowedForCategory('alteration', clothingShop), true);
  assert.equal(isTabAllowedForCategory('wholesale', clothingShop), true);
  assert.equal(isTabAllowedForCategory('reseller', clothingShop), true);
  assert.equal(sanitizeNavigationTabForShop('pipeline', clothingShop), 'home');
  assert.equal(sanitizeNavigationTabForShop('team', clothingShop), 'home');

  // Sportswear retains full access to pipeline & team
  assert.equal(isTabAllowedForCategory('pipeline', sportswearShop), true);
  assert.equal(isTabAllowedForCategory('team', sportswearShop), true);
  assert.equal(sanitizeNavigationTabForShop('pipeline', sportswearShop), 'pipeline');

  // 3. Action authorization
  assert.equal(canPerformCategoryAction('access_clothing_pos_builder', clothingShop).allowed, true);
  assert.equal(canPerformCategoryAction('manage_clothing_categories', clothingShop).allowed, true);
  assert.equal(canPerformCategoryAction('access_jersey_pos_builder', clothingShop).allowed, false);
  assert.equal(canPerformCategoryAction('create_jersey_custom_order', clothingShop).allowed, false);
  assert.equal(canPerformCategoryAction('create_team_bulk_order', clothingShop).allowed, false);
  assert.equal(canPerformCategoryAction('create_font_order', clothingShop).allowed, false);

  assert.equal(canPerformCategoryAction('access_jersey_pos_builder', sportswearShop).allowed, true);
  assert.equal(canPerformCategoryAction('create_jersey_custom_order', sportswearShop).allowed, true);
  assert.equal(canPerformCategoryAction('create_team_bulk_order', sportswearShop).allowed, true);
  assert.equal(canPerformCategoryAction('create_font_order', sportswearShop).allowed, true);
  assert.equal(canPerformCategoryAction('manage_clothing_categories', sportswearShop).allowed, false);

  // 4. All 13 Men's Clothing Categories exist without duplicates
  const clothingCats = dbService.getClothingCategories('shop_vogue_apparel');
  assert.equal(clothingCats.length, 13);
  const catNames = clothingCats.map((c) => c.name);
  for (const expectedName of MENS_CLOTHING_CATEGORY_NAMES) {
    assert.ok(catNames.includes(expectedName), `Must include Men's Clothing category: ${expectedName}`);
  }
  assert.equal(new Set(catNames.map((n) => n.toLowerCase())).size, 13, 'No duplicate clothing categories allowed');

  // 5. Service-level guards block Sportswear-only mutations for Clothing shops
  assert.throws(() => {
    dbService.addTeamOrder('shop_vogue_apparel', {
      id: 'team_blocked_1',
      shopId: 'shop_vogue_apparel',
      teamName: 'Blocked FC',
      captainName: 'Test',
      captainPhone: '01700000000',
      jerseyModel: 'Blocked Kit',
      unitPrice: 1000,
      totalAmount: 1000,
      advancePaid: 500,
      dueAmount: 500,
      deliveryDate: '2026-05-01',
      status: 'confirmed',
      players: [],
    } as any);
  }, /Sportswear merchants/);

  assert.throws(() => {
    dbService.addFontOrder('shop_vogue_apparel', {
      id: 'font_blocked_1',
      shopId: 'shop_vogue_apparel',
      customerName: 'Test',
      customerPhone: '01700000000',
      playerName: 'MESSI',
      playerNumber: '10',
      fontStyle: 'UCL',
      quantity: 1,
      price: 200,
      paidAmount: 200,
      dueAmount: 0,
      paymentMethod: 'cash',
      status: 'pending',
      createdAt: new Date().toISOString(),
    } as any);
  }, /Sportswear merchants/);

  assert.equal(dbService.getFontOrders('shop_vogue_apparel').length, 0, 'Clothing shop must return empty DTF font orders');
});

