import test from 'node:test';
import assert from 'node:assert/strict';
import {
  evaluateSubscriptionStatus,
  evaluateRoleSwitch,
  canUserAccessShop,
  verifyTenantOwnerPin,
  sanitizeTenantSecretsForRole,
  isProductAllowedForShop,
  filterInventoryForShop,
  getAllowedExchangeModesForShop,
  getDefaultExchangeModeForShop,
  isJerseyOptionAllowedInReseller,
  canViewBuyingPrice,
  canViewProfitMetrics,
  canManagePartners,
  canManageOperators,
  canManageDrawersAndAudits,
  canEditStoreProfile,
  canManageCatalogAndPricing,
  canAccessSettingsTab,
  getAllowedSettingsTabsForRole,
  getVisibleSettingsGroupsForRole,
  getDefaultSettingsTabForRole,
  resolveAuthorizedSettingsTab,
  canAccessAppRoute,
  sanitizeInventoryItemForRole,
  preserveInventoryItemCosts,
  sanitizeCategoryListForRole,
  preserveCategoryCosts,
  sanitizeInvoiceForRole,
  hashCredentialSync,
  generateCredentialSalt,
  verifyCredentialSync,
  migrateOwnerAccountCredentials,
  sanitizePartnerForClient,
  migrateStaffCredentials,
  sanitizeStaffForClient,
  sanitizeNavigationTabForShop,
  SETTINGS_GROUPS,
  resolveSettingsSidePanelWidth,
  getSettingsSidePanelClassName,
} from './securityPolicy';

test('evaluateSubscriptionStatus blocks expired subscriptions and allows active/grace/pending', () => {
  const now = new Date('2026-06-15T12:00:00Z').getTime();

  const activeRes = evaluateSubscriptionStatus(
    {
      plan: 'pro',
      status: 'active',
      monthlyFeeBdt: 1500,
      expiresAt: '2026-07-15',
    },
    now
  );
  assert.equal(activeRes.allowed, true);
  assert.equal(activeRes.status, 'active');
  assert.ok(activeRes.daysRemaining >= 29);

  const expiredStatusRes = evaluateSubscriptionStatus(
    {
      plan: 'pro',
      status: 'expired',
      monthlyFeeBdt: 1500,
      expiresAt: '2026-07-15',
    },
    now
  );
  assert.equal(expiredStatusRes.allowed, false);
  assert.equal(expiredStatusRes.status, 'expired');

  const pastDateRes = evaluateSubscriptionStatus(
    {
      plan: 'pro',
      status: 'active',
      monthlyFeeBdt: 1500,
      expiresAt: '2026-05-01',
    },
    now
  );
  assert.equal(pastDateRes.allowed, false);
  assert.equal(pastDateRes.status, 'expired');

  const pendingRenewalRes = evaluateSubscriptionStatus(
    {
      plan: 'pro',
      status: 'pending',
      monthlyFeeBdt: 1500,
      expiresAt: '2026-05-01',
      pendingTrxId: 'BKASH12345',
    },
    now
  );
  assert.equal(pendingRenewalRes.allowed, true);
  assert.equal(pendingRenewalRes.status, 'pending');
});

test('evaluateRoleSwitch prevents privilege escalation and requires PIN when switching from salesman to shop_owner', () => {
  // Unverified user cannot become super_admin
  const superAdminAttempt = evaluateRoleSwitch({
    currentRole: 'shop_owner',
    targetRole: 'super_admin',
    userType: 'merchant',
    isSuperAdminVerified: false,
  });
  assert.equal(superAdminAttempt.allowed, false);

  // Verified super_admin can switch to super_admin
  const verifiedSuperAdmin = evaluateRoleSwitch({
    currentRole: 'shop_owner',
    targetRole: 'super_admin',
    userType: 'merchant',
    isSuperAdminVerified: true,
  });
  assert.equal(verifiedSuperAdmin.allowed, true);

  // Staff account can never switch to shop_owner
  const staffToOwner = evaluateRoleSwitch({
    currentRole: 'salesman',
    targetRole: 'shop_owner',
    userType: 'staff',
    isPinVerified: true,
  });
  assert.equal(staffToOwner.allowed, false);

  // Merchant in salesman counter mode must verify PIN to return to shop_owner
  const salesmanToOwnerNoPin = evaluateRoleSwitch({
    currentRole: 'salesman',
    targetRole: 'shop_owner',
    userType: 'merchant',
    isPinVerified: false,
  });
  assert.equal(salesmanToOwnerNoPin.allowed, false);
  assert.equal(salesmanToOwnerNoPin.requiresPinModal, true);

  // Merchant in salesman counter mode with verified PIN is allowed
  const salesmanToOwnerWithPin = evaluateRoleSwitch({
    currentRole: 'salesman',
    targetRole: 'shop_owner',
    userType: 'merchant',
    isPinVerified: true,
  });
  assert.equal(salesmanToOwnerWithPin.allowed, true);
});

test('canUserAccessShop isolates tenant shops strictly by uid, memberUids, or invited email', () => {
  const shopA = {
    id: 'shop_a',
    ownerUid: 'uid_owner_a',
    memberUids: ['uid_owner_a', 'uid_staff_a'],
    invitedStaffEmails: ['newstaff@gmail.com'],
    ownerEmail: 'ownera@gmail.com',
  };

  // Owner A can access Shop A
  assert.equal(canUserAccessShop(shopA, { uid: 'uid_owner_a', email: 'ownera@gmail.com', shopId: 'shop_a' }), true);

  // Staff A can access Shop A
  assert.equal(canUserAccessShop(shopA, { uid: 'uid_staff_a', email: 'staffa@gmail.com', shopId: 'shop_a' }), true);

  // Invited staff can access Shop A
  assert.equal(canUserAccessShop(shopA, { uid: 'uid_new_staff', email: 'newstaff@gmail.com', shopId: 'shop_a' }), true);

  // Owner B cannot access Shop A even if they spoof shopId in localStorage
  assert.equal(canUserAccessShop(shopA, { uid: 'uid_owner_b', email: 'ownerb@gmail.com', shopId: 'shop_a' }), false);

  // Verified Super Admin can access any shop
  assert.equal(
    canUserAccessShop(shopA, { uid: 'uid_admin', email: 'admin@lekho.com', isSuperAdminVerified: true }),
    true
  );
});

test('Task 1: sanitizeTenantSecretsForRole strips ownerPin and courier apiSecret for salesman/manager', () => {
  const rawTenant = {
    id: 'shop_vogue_apparel',
    name: 'Vogue Denim',
    ownerPin: '7361',
    ownerPasswordHash: 'hash_secret_123',
    courierSettings: {
      provider: 'steadfast' as const,
      apiKey: 'pub_key_1',
      apiSecret: 'super_secret_steadfast_key',
      webhookUrl: 'https://example.com/webhook',
      isConnected: true,
    },
  };

  const salesmanView = sanitizeTenantSecretsForRole(rawTenant, 'salesman');
  assert.equal(salesmanView.ownerPin, '');
  assert.equal(salesmanView.ownerPasswordHash, undefined);
  assert.equal(salesmanView.courierSettings?.apiSecret, '');
  assert.equal(salesmanView.courierSettings?.apiKey, 'pub_key_1');

  const managerView = sanitizeTenantSecretsForRole(rawTenant, 'manager');
  assert.equal(managerView.ownerPin, '');

  const ownerView = sanitizeTenantSecretsForRole(rawTenant, 'shop_owner');
  assert.equal(ownerView.ownerPin, '7361');
  assert.equal(ownerView.courierSettings?.apiSecret, 'super_secret_steadfast_key');
});

test('Task 1: verifyTenantOwnerPin enforces constant-time 4-digit check, never leaks PIN, and locks out after 5 failed attempts', () => {
  const now = 1700000000000;

  // Wrong PIN attempt 1..4
  const wrong1 = verifyTenantOwnerPin({
    candidatePin: '1111',
    expectedOwnerPin: '7361',
    failedAttempts: 0,
    nowMs: now,
  });
  assert.equal(wrong1.authorized, false);
  assert.equal(wrong1.nextFailedAttempts, 1);
  assert.ok(!wrong1.message.includes('7361'));

  // 5th failed attempt triggers 60s lockout
  const wrong5 = verifyTenantOwnerPin({
    candidatePin: '2222',
    expectedOwnerPin: '7361',
    failedAttempts: 4,
    nowMs: now,
  });
  assert.equal(wrong5.authorized, false);
  assert.equal(wrong5.lockedOut, true);
  assert.equal(wrong5.lockedUntilMs, now + 60_000);

  // Even correct PIN is rejected while locked out
  const duringLockout = verifyTenantOwnerPin({
    candidatePin: '7361',
    expectedOwnerPin: '7361',
    failedAttempts: 5,
    lockedUntilMs: now + 60_000,
    nowMs: now + 15_000,
  });
  assert.equal(duringLockout.authorized, false);
  assert.equal(duringLockout.lockedOut, true);

  // After lockout expires, correct PIN succeeds and resets counter
  const afterLockout = verifyTenantOwnerPin({
    candidatePin: '7361',
    expectedOwnerPin: '7361',
    failedAttempts: 5,
    lockedUntilMs: now + 60_000,
    nowMs: now + 61_000,
  });
  assert.equal(afterLockout.authorized, true);
  assert.equal(afterLockout.nextFailedAttempts, 0);
});

test('Tasks 3, 4, 5 & Sportswear Regression: Clothing isolation vs Sportswear preservation', () => {
  const clothingShop = { category: 'clothing' as const, shopCategory: 'CLOTHING' as const };
  const sportswearShop = { category: 'jersey' as const, shopCategory: 'SPORTS WEAR' as const };

  // Task 3: Reseller Counter Jersey options
  assert.equal(isJerseyOptionAllowedInReseller(clothingShop), false);
  assert.equal(isJerseyOptionAllowedInReseller(sportswearShop), true);

  // Task 4: Size Exchange Modal modes
  assert.deepEqual(getAllowedExchangeModesForShop(clothingShop), ['inventory', 'custom']);
  assert.equal(getDefaultExchangeModeForShop(clothingShop), 'inventory');
  assert.deepEqual(getAllowedExchangeModesForShop(sportswearShop), ['jersey', 'inventory', 'custom']);
  assert.equal(getDefaultExchangeModeForShop(sportswearShop), 'jersey');

  // Task 5: Inventory filtering by categoryType / jerseyCategory (NOT fragile name substring)
  const sampleItems = [
    { id: '1', name: 'Real Madrid Home Kit', categoryType: 'jersey' as const },
    { id: '2', name: 'Men Casual Oxford Shirt', categoryType: 'apparel' as const, clothingCategory: 'Shirt' as const },
    {
      id: '3',
      name: 'Argentina Blue Cotton Polo Shirt', // Legitimate clothing product whose name contains "Argentina"
      categoryType: 'apparel' as const,
      clothingCategory: 'Polo Shirt' as const,
    },
  ];

  const clothingFiltered = filterInventoryForShop(sampleItems, clothingShop);
  assert.equal(clothingFiltered.length, 2);
  assert.deepEqual(clothingFiltered.map((i) => i.id), ['2', '3']);
  assert.equal(isProductAllowedForShop(sampleItems[0], clothingShop), false);
  assert.equal(isProductAllowedForShop(sampleItems[2], clothingShop), true);

  const sportswearFiltered = filterInventoryForShop(sampleItems, sportswearShop);
  assert.equal(sportswearFiltered.length, 3);

  // Navigation route isolation
  assert.equal(sanitizeNavigationTabForShop('pipeline', clothingShop), 'home');
  assert.equal(sanitizeNavigationTabForShop('pipeline', sportswearShop), 'pipeline');
});

test('Phase 5 Test 1, 2, 3, 4 & 8: Role-based Settings, Partners, Operators, and Route access enforcement', () => {
  // 1. Shop Owner & Super Admin have full access to all 4 Settings groups & all 14 tabs
  assert.equal(SETTINGS_GROUPS.length, 4);
  const ownerGroups = getVisibleSettingsGroupsForRole('shop_owner');
  assert.equal(ownerGroups.length, 4);
  assert.equal(getAllowedSettingsTabsForRole('shop_owner').length, 14);
  assert.equal(canManagePartners('shop_owner'), true);
  assert.equal(canManageOperators('shop_owner'), true);
  assert.equal(canViewBuyingPrice('shop_owner'), true);
  assert.equal(canViewProfitMetrics('shop_owner'), true);
  assert.equal(canManageDrawersAndAudits('shop_owner'), true);
  assert.equal(canEditStoreProfile('shop_owner'), true);
  assert.equal(canAccessSettingsTab('shop_owner', 'partners'), true);
  assert.equal(canAccessSettingsTab('shop_owner', 'operators'), true);
  assert.equal(canAccessSettingsTab('shop_owner', 'security'), true);

  // 2 & 3 & 4. Staff (salesman) can ONLY access Categories & Price ('categories'), Language, and Help Center tabs in Settings
  const staffTabs = getAllowedSettingsTabsForRole('salesman');
  assert.deepEqual(staffTabs, ['categories', 'language', 'help', 'policies', 'updates']);
  assert.equal(canAccessSettingsTab('salesman', 'categories'), true);
  assert.equal(canAccessSettingsTab('salesman', 'language'), true);
  assert.equal(canAccessSettingsTab('salesman', 'help'), true);
  assert.equal(canAccessSettingsTab('salesman', 'partners'), false);
  assert.equal(canAccessSettingsTab('salesman', 'operators'), false);
  assert.equal(canAccessSettingsTab('salesman', 'security'), false);
  assert.equal(canAccessSettingsTab('salesman', 'payments'), false);
  assert.equal(canAccessSettingsTab('salesman', 'subscription'), false);
  assert.equal(canAccessSettingsTab('salesman', 'security_tools'), false);
  assert.equal(canAccessSettingsTab('salesman', 'api'), false);
  assert.equal(canManagePartners('salesman'), false);
  assert.equal(canManageOperators('salesman'), false);
  assert.equal(canManageCatalogAndPricing('salesman'), true);

  // Direct URL/state bypass protection redirects unauthorized tab to safe default
  assert.equal(resolveAuthorizedSettingsTab('salesman', 'partners'), 'categories');
  assert.equal(resolveAuthorizedSettingsTab('salesman', 'operators'), 'categories');
  assert.equal(resolveAuthorizedSettingsTab('salesman', 'security'), 'categories');
  assert.equal(getDefaultSettingsTabForRole('salesman'), 'categories');

  const staffGroups = getVisibleSettingsGroupsForRole('salesman');
  assert.equal(staffGroups.length, 2);
  assert.equal(staffGroups[0].id, 'products_counter');
  assert.deepEqual(
    staffGroups[0].tabs.map((t) => t.id),
    ['categories']
  );

  // 8. Manager cannot access Owner-only sections (partners, operators, security, payments, subscription, security_tools, api) or Buying Price
  const managerTabs = getAllowedSettingsTabsForRole('manager');
  assert.deepEqual(managerTabs, [
    'categories',
    'profile',
    'language',
    'invoices',
    'help',
    'policies',
    'updates',
  ]);
  assert.equal(canAccessSettingsTab('manager', 'partners'), false);
  assert.equal(canAccessSettingsTab('manager', 'operators'), false);
  assert.equal(canAccessSettingsTab('manager', 'security'), false);
  assert.equal(canAccessSettingsTab('manager', 'payments'), false);
  assert.equal(canAccessSettingsTab('manager', 'subscription'), false);
  assert.equal(canAccessSettingsTab('manager', 'security_tools'), false);
  assert.equal(canAccessSettingsTab('manager', 'api'), false);
  assert.equal(canViewBuyingPrice('manager'), false);
  assert.equal(canViewProfitMetrics('manager'), false);
  assert.equal(canManagePartners('manager'), false);
  assert.equal(canManageOperators('manager'), false);
  assert.equal(canEditStoreProfile('manager'), false);

  // Route-level enforcement for analytics, drawers, lot_splitter
  assert.equal(canAccessAppRoute('salesman', 'analytics'), false);
  assert.equal(canAccessAppRoute('salesman', 'drawers'), false);
  assert.equal(canAccessAppRoute('salesman', 'lot_splitter'), false);
  assert.equal(canAccessAppRoute('manager', 'analytics'), false);
  assert.equal(canAccessAppRoute('shop_owner', 'analytics'), true);
  assert.equal(canAccessAppRoute('shop_owner', 'drawers'), true);
});

test('Phase 5 Test 5, 6 & 7: Buying Price confidentiality and non-destructive Cost Preservation on Staff edits', () => {
  const ownerItem = {
    id: 'prod_denim_01',
    shopId: 'shop_vogue_apparel',
    sku: 'DNM-01',
    name: 'Premium Selvedge Jeans',
    categoryType: 'apparel' as const,
    clothingCategory: 'Jeans' as const,
    mrp: 1850,
    bottomPrice: 1500,
    lotCostLandingPrice: 980,
    totalStock: 18,
    variants: [
      { size: '30', color: 'Indigo', stock: 10, costPrice: 980, sellingPrice: 1850, mrp: 1850, bottomPrice: 1500 },
      { size: '32', color: 'Indigo', stock: 8, costPrice: 995, sellingPrice: 1850, mrp: 1850, bottomPrice: 1500 },
    ],
  };

  // 6. Staff and Manager receive sanitized inventory items with 0 buying price
  const staffSanitized = sanitizeInventoryItemForRole(ownerItem, 'salesman');
  assert.equal(staffSanitized.lotCostLandingPrice, 0);
  assert.equal(staffSanitized.variants[0].costPrice, 0);
  assert.equal(staffSanitized.variants[1].costPrice, 0);
  assert.equal(staffSanitized.mrp, 1850);
  assert.equal(staffSanitized.bottomPrice, 1500);

  const managerSanitized = sanitizeInventoryItemForRole(ownerItem, 'manager');
  assert.equal(managerSanitized.lotCostLandingPrice, 0);
  assert.equal(managerSanitized.variants[0].costPrice, 0);

  // Owner sees full buying price
  const ownerUnsanitized = sanitizeInventoryItemForRole(ownerItem, 'shop_owner');
  assert.equal(ownerUnsanitized.lotCostLandingPrice, 980);
  assert.equal(ownerUnsanitized.variants[0].costPrice, 980);
  assert.equal(ownerUnsanitized.variants[1].costPrice, 995);

  // 7. When Staff edits stock/sellingPrice/sizes (sending sanitized 0 cost), preserveInventoryItemCosts restores Owner cost!
  const staffEditedItem = {
    ...staffSanitized,
    mrp: 1950,
    totalStock: 33,
    variants: [
      { ...staffSanitized.variants[0], stock: 15, sellingPrice: 1950, mrp: 1950, costPrice: 0 },
      { ...staffSanitized.variants[1], stock: 12, sellingPrice: 1950, mrp: 1950, costPrice: 0 },
      { size: '34', color: 'Indigo', stock: 6, costPrice: 0, sellingPrice: 1950, mrp: 1950, bottomPrice: 1500 },
    ],
  };

  const preservedItem = preserveInventoryItemCosts(staffEditedItem, ownerItem, 'salesman');
  assert.equal(preservedItem.mrp, 1950);
  assert.equal(preservedItem.lotCostLandingPrice, 980); // Preserved!
  assert.equal(preservedItem.variants[0].stock, 15);
  assert.equal(preservedItem.variants[0].costPrice, 980); // Preserved!
  assert.equal(preservedItem.variants[1].costPrice, 995); // Preserved!
  assert.equal(preservedItem.variants[2].costPrice, 980); // Inherits lotCostLandingPrice for new variant added by staff!

  // Category cost sanitization and preservation
  const ownerCategories = [
    { id: 'cat_shirt', name: 'Casual Shirt', defaultCostPrice: 620, defaultSellingPrice: 1250, defaultFloorPrice: 1050 },
    { id: 'cat_polo', name: 'Polo Shirt', defaultCostPrice: 450, defaultSellingPrice: 950, defaultFloorPrice: 800 },
  ];

  const staffCategories = sanitizeCategoryListForRole(ownerCategories, 'salesman');
  assert.equal(staffCategories[0].defaultCostPrice, 0);
  assert.equal(staffCategories[1].defaultCostPrice, 0);
  assert.equal(staffCategories[0].defaultSellingPrice, 1250);

  // Staff edits selling price of cat_shirt and adds a new category cat_panjabi
  const staffUpdatedCategories = [
    { ...staffCategories[0], defaultSellingPrice: 1350, defaultCostPrice: 0 },
    staffCategories[1],
    { id: 'cat_panjabi', name: 'Panjabi', defaultCostPrice: 0, defaultSellingPrice: 1800, defaultFloorPrice: 1500 },
  ];

  const preservedCategories = preserveCategoryCosts(
    staffUpdatedCategories,
    ownerCategories,
    'salesman'
  );
  assert.equal(preservedCategories[0].defaultSellingPrice, 1350);
  assert.equal(preservedCategories[0].defaultCostPrice, 620); // Preserved!
  assert.equal(preservedCategories[1].defaultCostPrice, 450); // Preserved!
  assert.equal(preservedCategories[2].defaultCostPrice, 0); // New category added by staff starts at 0 until Owner sets cost

  // Invoice sanitization for non-owner roles
  const sampleInvoice = {
    id: 'INV-1001',
    invoiceNo: 'INV-1001',
    shopId: 'shop_vogue_apparel',
    customerName: 'Rahim',
    customerPhone: '01700000000',
    salesmanId: 'staff_1',
    salesmanName: 'Arif',
    items: [
      {
        id: 'item_1',
        itemType: 'apparel' as const,
        title: 'Shirt',
        subDetail: 'Size L',
        size: 'L',
        quantity: 2,
        rate: 1250,
        unitPrice: 1250,
        costPrice: 620,
        bottomPrice: 1050,
        mrp: 1250,
        subtotal: 2500,
      },
    ],
    subtotal: 2500,
    discount: 0,
    total: 2500,
    paymentMode: 'paid' as const,
    paymentChannel: 'cash' as const,
    advancePaid: 2500,
    paidAmount: 2500,
    dueAmount: 0,
    status: 'completed' as const,
    createdAt: new Date().toISOString(),
  };

  const staffInvoice = sanitizeInvoiceForRole(sampleInvoice, 'salesman');
  assert.equal(staffInvoice.items[0].costPrice, 0);
  assert.equal(staffInvoice.total, 2500);
});

test('Phase 5 Test 9 & 10: Partner withdrawal passwords and Staff counter PINs are hashed and never exposed in plaintext', () => {
  // 9. Partner withdrawal password migration & sanitization
  const legacyPartner = {
    id: 'owner_1',
    shopId: 'shop_vogue_apparel',
    name: 'জনাব রাকিব (Partner 1)',
    username: 'rakib',
    phone: '01711000000',
    password: 'legacy_secret_password',
    sharePercentage: 50,
    totalAdded: 100000,
    totalWithdrawn: 20000,
    active: true,
    createdAt: new Date().toISOString(),
  };

  const migratedPartner = migrateOwnerAccountCredentials(legacyPartner);
  assert.equal(migratedPartner.password, ''); // Plaintext cleared!
  assert.equal(migratedPartner.hasPasswordSet, true);
  assert.ok(migratedPartner.passwordHash && migratedPartner.passwordHash.length > 16);
  assert.ok(migratedPartner.passwordSalt && migratedPartner.passwordSalt.length > 8);

  // Verify credential check works with the migrated hash
  assert.equal(
    verifyCredentialSync(
      'legacy_secret_password',
      migratedPartner.passwordHash,
      migratedPartner.passwordSalt
    ),
    true
  );
  assert.equal(
    verifyCredentialSync('wrong_password', migratedPartner.passwordHash, migratedPartner.passwordSalt),
    false
  );

  // Client sanitization strips hash & salt and never returns plaintext password
  const sanitizedForClient = sanitizePartnerForClient(migratedPartner);
  assert.equal(sanitizedForClient.password, '');
  assert.equal(sanitizedForClient.passwordHash, undefined);
  assert.equal(sanitizedForClient.passwordSalt, undefined);
  assert.equal(sanitizedForClient.hasPasswordSet, true);

  // 10. Staff counter PIN migration & sanitization
  const legacyStaff = {
    id: 'staff_1',
    shopId: 'shop_vogue_apparel',
    name: 'আরিফ হোসেন',
    phone: '01811223344',
    role: 'salesman' as const,
    pin: '4321',
    commissionPerPiece: 20,
    active: true,
  };

  const migratedStaff = migrateStaffCredentials(legacyStaff);
  assert.equal(migratedStaff.pin, ''); // Plaintext PIN removed!
  assert.equal(migratedStaff.hasPinSet, true);
  assert.ok(migratedStaff.pinHash && migratedStaff.pinHash.length > 16);
  assert.ok(migratedStaff.pinSalt && migratedStaff.pinSalt.length > 8);

  // Verify counter PIN check works against the hash
  assert.equal(verifyCredentialSync('4321', migratedStaff.pinHash, migratedStaff.pinSalt), true);
  assert.equal(verifyCredentialSync('9999', migratedStaff.pinHash, migratedStaff.pinSalt), false);

  // Sanitized staff record never exposes pin, pinHash, or pinSalt
  const clientStaff = sanitizeStaffForClient(migratedStaff);
  assert.equal(clientStaff.pin, '');
  assert.equal(clientStaff.pinHash, undefined);
  assert.equal(clientStaff.pinSalt, undefined);
  assert.equal(clientStaff.hasPinSet, true);
});

test('Settings side panel responsive width transition: 85vw on main menu and 100vw on inner settings subpages', () => {
  // 1. Initial Settings Panel on main menu -> 85vw
  assert.equal(resolveSettingsSidePanelWidth({ showSettingsHub: true }), '85vw');
  const openHubClass = getSettingsSidePanelClassName({
    isOpen: true,
    showSettingsHub: true,
  });
  assert.ok(openHubClass.includes('w-[85vw]'));
  assert.ok(!openHubClass.includes('w-[100vw]'));
  assert.ok(openHubClass.includes('border-l'));
  assert.ok(openHubClass.includes('transition-[translate,transform,width]'));
  assert.ok(openHubClass.includes('duration-300'));
  assert.ok(openHubClass.includes('ease-in-out'));
  assert.ok(openHubClass.includes('translate-x-0'));

  // 2. Navigating to any inner settings page -> expands from 85vw to 100vw
  assert.equal(resolveSettingsSidePanelWidth({ showSettingsHub: false }), '100vw');
  const openSubpageClass = getSettingsSidePanelClassName({
    isOpen: true,
    showSettingsHub: false,
  });
  assert.ok(openSubpageClass.includes('w-[100vw]'));
  assert.ok(!openSubpageClass.includes('w-[85vw]'));
  assert.ok(openSubpageClass.includes('border-l-0'));
  assert.ok(openSubpageClass.includes('transition-[translate,transform,width]'));
  assert.ok(openSubpageClass.includes('duration-300'));
  assert.ok(openSubpageClass.includes('ease-in-out'));
  assert.ok(openSubpageClass.includes('translate-x-0'));

  // 3. Returning to Main Settings Menu -> shrinks back from 100vw to 85vw
  const returnedToHubClass = getSettingsSidePanelClassName({
    isOpen: true,
    showSettingsHub: true,
  });
  assert.ok(returnedToHubClass.includes('w-[85vw]'));
  assert.ok(!returnedToHubClass.includes('w-[100vw]'));

  // 4. Closing the side panel -> slides off-screen with translate-x-full
  const closedClass = getSettingsSidePanelClassName({
    isOpen: false,
    showSettingsHub: true,
  });
  assert.ok(closedClass.includes('translate-x-full'));
  assert.ok(closedClass.includes('pointer-events-none'));
});
