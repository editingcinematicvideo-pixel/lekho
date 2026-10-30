import {
  TenantShop,
  InventoryItem,
  Invoice,
  OrderLineItem,
  MultiDrawerBalance,
  DrawerTransaction,
  ExpenseRecord,
  AlterationOrder,
  TeamBulkOrder,
  ResellerAccount,
  ResellerTransaction,
  GlobalBlacklistEntry,
  TrashItem,
  ZReport,
  SizeExchangeRecord,
  StaffMember,
  DrawerType,
  MonthlyStockAudit,
  SteadfastParcelData,
  OwnerAccount,
  OwnerWithdrawDepositRecord,
  KitCategorySetting,
  OtherProductCategorySetting,
  ClothingCategorySetting,
  ExpenseCategorySetting,
  StoreConfiguration,
  StandaloneFontOrder,
  UserRole,
  StockAdjustmentRecord,
  LoyaltySettings,
  LoyaltyTransaction,
  ShopCustomerProfile,
  CampaignTemplate,
  CampaignOpenLog,
} from '../types';
import { firestoreSync } from './firestoreSync';
import { auth } from './firebase';
import {
  isClothingShop,
  filterInventoryForShop,
  canViewBuyingPrice,
  canManagePartners,
  canManageOperators,
  sanitizeInventoryItemForRole,
  sanitizeInventoryListForRole,
  preserveInventoryItemCosts,
  sanitizeCategoryListForRole,
  preserveCategoryCosts,
  sanitizeInvoiceListForRole,
  hashCredentialSync,
  generateCredentialSalt,
  verifyCredentialSync,
  migrateOwnerAccountCredentials,
  sanitizePartnerForClient,
  migrateStaffCredentials,
  sanitizeStaffForClient,
  PrivateProductCostRecord,
} from '../utils/securityPolicy';
import {
  normalizeBdPhone,
  buildShopCustomerId,
  getShopCustomerSummary,
  ShopCustomerSummary,
  normalizeProductVariants,
  matchesVariant,
  applyManualStockCorrection,
  createStockMovementRecord,
  findMatchingInventoryVariant,
  processPosSaleStockDeduction,
  processReturnStockRestoration,
  getDefaultLoyaltySettings,
  calculateEarnedLoyaltyPoints,
  getDefaultCampaignTemplates,
  createCampaignOpenLog,
} from '../utils/inventoryLoyaltyReportsEngine';

const STORAGE_KEYS = {
  TENANTS: 'lekho_tenants_v1',
  CURRENT_TENANT_ID: 'lekho_current_tenant_id',
  ACTIVE_ROLE: 'lekho_active_role',
  INVENTORY: 'lekho_inventory_v1',
  PRIVATE_COSTS: 'lekho_private_costs_v3',
  INVOICES: 'lekho_invoices_v1',
  DRAWERS: 'lekho_drawers_v1',
  DRAWER_TXS: 'lekho_drawer_txs_v1',
  EXPENSES: 'lekho_expenses_v1',
  ALTERATIONS: 'lekho_alterations_v1',
  TEAM_ORDERS: 'lekho_team_orders_v1',
  RESELLERS: 'lekho_resellers_v1',
  BLACKLIST: 'lekho_blacklist_v1',
  TRASH: 'lekho_trash_v1',
  Z_REPORTS: 'lekho_z_reports_v1',
  SIZE_EXCHANGES: 'lekho_size_exchanges_v1',
  STAFF_MEMBERS: 'lekho_staff_v1',
  OFFLINE_QUEUE: 'lekho_offline_queue_v1',
  MONTHLY_AUDITS: 'lekho_monthly_audits_v1',
  STEADFAST_PARCELS: 'lekho_steadfast_parcels_v1',
  OWNERS: 'lekho_owners_v1',
  OWNER_TXS: 'lekho_owner_txs_v1',
  FONT_ORDERS: 'lekho_font_orders_v1',
  KIT_CATEGORIES: 'lekho_kit_categories_v1',
  OTHER_CATEGORIES: 'lekho_other_categories_v1',
  CLOTHING_CATEGORIES: 'lekho_clothing_categories_v1',
  STOCK_ADJUSTMENTS: 'lekho_stock_adjustments_v1',
  LOYALTY_TXS: 'lekho_loyalty_txs_v1',
  CUSTOMER_PROFILES: 'lekho_customer_profiles_v1',
  CAMPAIGN_TEMPLATES: 'lekho_campaign_templates_v1',
  CAMPAIGN_LOGS: 'lekho_campaign_logs_v1',
};

function getRequesterUid(): string {
  try {
    if (auth && auth.currentUser) {
      return auth.currentUser.uid;
    }
  } catch {}
  try {
    const raw = safeGetItem('lekho_auth_session_v2');
    if (raw) {
      const parsed = JSON.parse(raw);
      return parsed.uid || parsed.userId || '';
    }
  } catch {}
  return '';
}

async function getAuthHeaders(): Promise<Record<string, string>> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  let token = '';
  let uid = '';

  try {
    if (auth && auth.currentUser) {
      uid = auth.currentUser.uid;
      token = await auth.currentUser.getIdToken().catch(() => '');
    }
  } catch {}

  if (!uid || !token) {
    try {
      const raw = safeGetItem('lekho_auth_session_v2');
      if (raw) {
        const parsed = JSON.parse(raw);
        uid = uid || parsed.uid || parsed.userId || '';
        token = token || parsed.token || '';
      }
    } catch {}
  }

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  if (uid) {
    headers['x-lekho-uid'] = uid;
  }
  return headers;
}

// Seed Tenants
const DEFAULT_TENANTS: TenantShop[] = [
  {
    id: 'shop_galleria_sports',
    name: 'Galleria Sports BD',
    bengaliName: 'গ্যালারিয়া স্পোর্টস বিডি',
    slug: 'galleria-sports',
    ownerName: 'Mahmudul Hasan',
    ownerPhone: '01711223344',
    ownerPin: '8492',
    ownerPinConfigured: true,
    bottomPriceProtectionEnabled: true,
    category: 'jersey',
    shopCategory: 'SPORTS WEAR',
    marketMallName: 'Jamuna Future Park, Level 3, Block C',
    shopNo: 'Shop #302',
    returnPolicy: 'Jersey customization orders are non-refundable. 7-day size exchange on fresh stock with original memo and tags.',
    createdAt: '2026-08-15T10:00:00Z',
    subscription: {
      plan: 'pro',
      status: 'active',
      amount: 999,
      trxId: 'BK90X8849L',
      senderPhone: '01711223344',
      paymentMethod: 'bkash',
      submittedAt: '2026-10-01T09:30:00Z',
      expiresAt: '2026-12-31T09:30:00Z',
      graceEndsAt: '2026-12-31T09:30:00Z',
      verifiedAt: '2026-10-01T10:15:00Z',
      verifiedBy: 'Super Admin',
    },
    featureFlags: {
      jerseyCustomization: true,
      alterationTracker: false,
      teamBulkOrders: true,
      staffPins: true,
      multiDrawer: true,
      resellerCounter: true,
    },
    stats: {
      totalSales: 485200,
      totalOrders: 342,
      totalDueRecovered: 64500,
      gmv: 485200,
    },
    merchantId: '190832',
    email: 'galleria.sports.bd@gmail.com',
    facebookUrl: 'https://facebook.com/galleriasportsbd',
    websiteUrl: 'https://galleriasportsbd.com',
    coverPhoto: 'https://images.unsplash.com/photo-1574629810360-7efbbe195018?auto=format&fit=crop&w=1400&q=80',
    paymentSettings: {
      binNumber: 'BIN-003849120-01',
      tradeLicenseNo: 'TRAD/DSCC/019284/2026',
      bkashMerchant: '01711223344',
      bkashPersonal: '01799887766',
      nagad: '01811223344',
      bankName: 'The City Bank Ltd.',
      bankBranch: 'Jamuna Future Park Branch',
      bankAccountNo: '1502938471001',
      routingNo: '225271840',
      autoPrintReceipt: true,
      paperWidth: '80mm',
    },
    courierSettings: {
      provider: 'both',
      apiKey: 'stf_live_891048291049281',
      apiSecret: 'sec_981294109284102',
      webhookUrl: 'https://api.lekho.pos/webhooks/courier',
      isConnected: true,
    },
  },
  {
    id: 'shop_vogue_apparel',
    name: 'Vogue Denim & Panjabi House',
    bengaliName: 'ভোগ ডেনিম ও পাঞ্জাবি হাউস',
    slug: 'vogue-denim',
    ownerName: 'Rafiqul Islam',
    ownerPhone: '01819556677',
    ownerPin: '7361',
    category: 'clothing',
    shopCategory: 'CLOTHING',
    coverPhoto: 'https://images.unsplash.com/photo-1574629810360-7efbbe195018?auto=format&fit=crop&w=1400&q=80',
    marketMallName: 'Bashundhara City, Level 2, Block A',
    shopNo: 'Shop #54',
    returnPolicy: '3-day size exchange allowed. Altered or tailored items cannot be exchanged.',
    createdAt: '2026-09-01T14:20:00Z',
    subscription: {
      plan: 'starter',
      status: 'active',
      amount: 499,
      trxId: 'NG7719283K',
      senderPhone: '01819556677',
      paymentMethod: 'nagad',
      submittedAt: '2026-10-18T06:00:00Z',
      expiresAt: '2026-12-31T06:00:00Z',
      graceEndsAt: '2026-12-31T06:00:00Z',
    },
    featureFlags: {
      jerseyCustomization: false,
      alterationTracker: true,
      teamBulkOrders: false,
      staffPins: true,
      multiDrawer: true,
      resellerCounter: true,
    },
    stats: {
      totalSales: 312000,
      totalOrders: 189,
      totalDueRecovered: 18200,
      gmv: 312000,
    },
  },
  {
    id: 'shop_all_stars',
    name: 'All Stars Club & Outfitters',
    bengaliName: 'অল স্টারস ক্লাব ও আউটফিটার্স',
    slug: 'all-stars',
    ownerName: 'Tanvir Hossain',
    ownerPhone: '01912334455',
    ownerPin: '8888',
    category: 'hybrid',
    marketMallName: 'Rapa Plaza, Dhanmondi 27',
    shopNo: 'Shop #12',
    returnPolicy: 'Exchange within 5 days with memo. No cash refunds.',
    createdAt: '2026-07-20T11:00:00Z',
    subscription: {
      plan: 'pro',
      status: 'pending',
      amount: 999,
      trxId: 'BK110099AA',
      senderPhone: '01912334455',
      paymentMethod: 'bkash',
      submittedAt: '2026-10-18T07:45:00Z',
      expiresAt: '2026-10-19T07:45:00Z',
      graceEndsAt: '2026-10-19T07:45:00Z',
    },
    featureFlags: {
      jerseyCustomization: true,
      alterationTracker: true,
      teamBulkOrders: true,
      staffPins: true,
      multiDrawer: true,
      resellerCounter: true,
    },
    stats: {
      totalSales: 245000,
      totalOrders: 154,
      totalDueRecovered: 12000,
      gmv: 245000,
    },
  },
];

// Seed Staff (PINs stored as cryptographic hashes, never plaintext)
const DEFAULT_STAFF: Record<string, StaffMember[]> = {
  shop_galleria_sports: [
    {
      id: 'staff_1',
      name: 'Mahmudul Hasan (Owner)',
      pin: '',
      pinSalt: 'staff_staff_1',
      pinHash: hashCredentialSync('8492', 'staff_staff_1'),
      hasPinSet: true,
      role: 'owner',
      commissionPerPiece: 0,
      phone: '01711223344',
      active: true,
    },
    {
      id: 'staff_2',
      name: 'Tanvir Ahmed (Salesman)',
      pin: '',
      pinSalt: 'staff_staff_2',
      pinHash: hashCredentialSync('7890', 'staff_staff_2'),
      hasPinSet: true,
      role: 'salesman',
      commissionPerPiece: 25,
      phone: '01722334455',
      active: true,
      piecesSoldToday: 8,
      totalCommissionEarned: 3450,
    },
    {
      id: 'staff_3',
      name: 'Rana Sheikh (Counter Staff)',
      pin: '',
      pinSalt: 'staff_staff_3',
      pinHash: hashCredentialSync('4321', 'staff_staff_3'),
      hasPinSet: true,
      role: 'salesman',
      commissionPerPiece: 20,
      phone: '01733445566',
      active: true,
      piecesSoldToday: 5,
      totalCommissionEarned: 2100,
    },
  ],
  shop_vogue_apparel: [
    {
      id: 'staff_vogue_1',
      name: 'Rafiqul Islam (Owner)',
      pin: '',
      pinSalt: 'staff_staff_vogue_1',
      pinHash: hashCredentialSync('7361', 'staff_staff_vogue_1'),
      hasPinSet: true,
      role: 'owner',
      commissionPerPiece: 0,
      phone: '01819556677',
      active: true,
    },
    {
      id: 'staff_vogue_2',
      name: 'Kabir Hossain (Cashier)',
      pin: '',
      pinSalt: 'staff_staff_vogue_2',
      pinHash: hashCredentialSync('1122', 'staff_staff_vogue_2'),
      hasPinSet: true,
      role: 'salesman',
      commissionPerPiece: 30,
      phone: '01822446688',
      active: true,
      piecesSoldToday: 6,
      totalCommissionEarned: 1800,
    },
  ],
};

// Seed Multi-Drawer Balances
const DEFAULT_DRAWERS: Record<string, MultiDrawerBalance> = {
  shop_galleria_sports: {
    cash: 24500,
    personalBkash: 14200,
    merchantBkash: 42800,
    nagad: 8900,
    bank: 65000,
  },
  shop_vogue_apparel: {
    cash: 18200,
    personalBkash: 9400,
    merchantBkash: 28500,
    nagad: 6300,
    bank: 35000,
  },
  shop_all_stars: {
    cash: 12000,
    personalBkash: 6000,
    merchantBkash: 15000,
    nagad: 4000,
    bank: 20000,
  },
};

// Seed Owners & Partners (Withdrawal passwords stored as salted hashes, never plaintext)
const DEFAULT_OWNERS: Record<string, OwnerAccount[]> = {
  shop_galleria_sports: [
    {
      id: 'owner_galleria_1',
      shopId: 'shop_galleria_sports',
      name: 'Mahmudul Hasan (Founder)',
      username: 'mahmud',
      password: '',
      passwordSalt: 'partner_owner_galleria_1',
      passwordHash: hashCredentialSync('123', 'partner_owner_galleria_1'),
      hasPasswordSet: true,
      phone: '01711223344',
      sharePercentage: 50,
      totalWithdrawn: 15000,
      totalAdded: 80000,
      active: true,
      createdAt: '2026-08-15T10:00:00Z',
    },
    {
      id: 'owner_galleria_2',
      shopId: 'shop_galleria_sports',
      name: 'Shawon Ahmed (Managing Partner)',
      username: 'shawon',
      password: '',
      passwordSalt: 'partner_owner_galleria_2',
      passwordHash: hashCredentialSync('567', 'partner_owner_galleria_2'),
      hasPasswordSet: true,
      phone: '01799887766',
      sharePercentage: 50,
      totalWithdrawn: 10000,
      totalAdded: 80000,
      active: true,
      createdAt: '2026-08-20T10:00:00Z',
    },
  ],
};

const DEFAULT_OWNER_TXS: Record<string, OwnerWithdrawDepositRecord[]> = {
  shop_galleria_sports: [
    {
      id: 'otx_1',
      shopId: 'shop_galleria_sports',
      ownerId: 'owner_galleria_1',
      ownerName: 'Mahmudul Hasan (Founder)',
      ownerUsername: 'mahmud',
      action: 'withdraw',
      amount: 15000,
      drawer: 'bank',
      note: 'ব্যক্তিগত প্রয়োজনে জরুরি উত্তোলন',
      timestamp: '2026-10-14T11:30:00Z',
    },
    {
      id: 'otx_2',
      shopId: 'shop_galleria_sports',
      ownerId: 'owner_galleria_2',
      ownerName: 'Shawon Ahmed (Managing Partner)',
      ownerUsername: 'shawon',
      action: 'deposit',
      amount: 40000,
      drawer: 'cash',
      note: 'নতুন সিজন জার্সি লট আমদানির ক্যাপিটাল ইনভেস্টমেন্ট',
      timestamp: '2026-10-09T09:00:00Z',
    },
  ],
};

// Seed Drawer Transactions
const DEFAULT_DRAWER_TXS: Record<string, DrawerTransaction[]> = {
  shop_galleria_sports: [
    {
      id: 'dtx_1',
      shopId: 'shop_galleria_sports',
      type: 'sale',
      drawer: 'cash',
      amount: 1450,
      direction: 'in',
      referenceId: 'INV-2026-101',
      note: 'Retail Sale: Real Madrid 24/25 Home (Player Issue)',
      timestamp: '2026-10-18T08:15:00Z',
      salesmanName: 'Tanvir Ahmed',
    },
    {
      id: 'dtx_2',
      shopId: 'shop_galleria_sports',
      type: 'advance',
      drawer: 'merchantBkash',
      amount: 800,
      direction: 'in',
      referenceId: 'INV-2026-102',
      note: 'Advance for Custom Jersey (Messi 10)',
      timestamp: '2026-10-18T07:45:00Z',
      salesmanName: 'Tanvir Ahmed',
    },
    {
      id: 'dtx_3',
      shopId: 'shop_galleria_sports',
      type: 'expense',
      drawer: 'cash',
      amount: 320,
      direction: 'out',
      referenceId: 'EXP-01',
      note: 'Staff Breakfast & Tea (Nashta)',
      timestamp: '2026-10-18T07:00:00Z',
      salesmanName: 'Mahmudul Hasan (Owner)',
    },
    {
      id: 'dtx_4',
      shopId: 'shop_galleria_sports',
      type: 'sale',
      drawer: 'merchantBkash',
      amount: 5400,
      direction: 'in',
      referenceId: 'INV-2026-098',
      note: 'Wholesale 6 pcs Argentina Fan Edition',
      timestamp: '2026-10-17T15:20:00Z',
      salesmanName: 'Rana Sheikh',
    },
    {
      id: 'dtx_5',
      shopId: 'shop_galleria_sports',
      type: 'sale',
      drawer: 'nagad',
      amount: 2200,
      direction: 'in',
      referenceId: 'INV-2026-095',
      note: '2x Retro Vintage Jersey Sale via Nagad',
      timestamp: '2026-10-16T12:10:00Z',
      salesmanName: 'Tanvir Ahmed',
    },
    {
      id: 'dtx_6',
      shopId: 'shop_galleria_sports',
      type: 'owner_withdraw',
      drawer: 'bank',
      amount: 15000,
      direction: 'out',
      referenceId: 'OWNER-WITHDRAW-1',
      note: 'Owner Withdraw: Mahmudul Hasan - ব্যক্তিগত প্রয়োজনে জরুরি উত্তোলন',
      timestamp: '2026-10-14T11:30:00Z',
      performedBy: 'Mahmudul Hasan (Founder)',
      ownerId: 'owner_galleria_1',
    },
    {
      id: 'dtx_7',
      shopId: 'shop_galleria_sports',
      type: 'due_recovery',
      drawer: 'personalBkash',
      amount: 3000,
      direction: 'in',
      referenceId: 'REC-2026-44',
      note: 'Baki Recovery from Reseller Fahim Sports',
      timestamp: '2026-10-12T17:40:00Z',
      salesmanName: 'Tanvir Ahmed',
    },
    {
      id: 'dtx_8',
      shopId: 'shop_galleria_sports',
      type: 'sale',
      drawer: 'merchantBkash',
      amount: 4500,
      direction: 'in',
      referenceId: 'INV-2026-088',
      note: 'Team Order 3 pcs Barcelona Home Kit',
      timestamp: '2026-10-11T14:15:00Z',
      salesmanName: 'Tanvir Ahmed',
    },
    {
      id: 'dtx_9',
      shopId: 'shop_galleria_sports',
      type: 'sale',
      drawer: 'nagad',
      amount: 1900,
      direction: 'in',
      referenceId: 'INV-2026-082',
      note: 'Counter Sale: Germany 2024 Away Kit',
      timestamp: '2026-10-10T11:00:00Z',
      salesmanName: 'Rana Sheikh',
    },
    {
      id: 'dtx_10',
      shopId: 'shop_galleria_sports',
      type: 'owner_deposit',
      drawer: 'cash',
      amount: 40000,
      direction: 'in',
      referenceId: 'CAPITAL-DEP-1',
      note: 'Business Capital Add: Shawon Ahmed - নতুন সিজন জার্সি লট আমদানির ক্যাপিটাল ইনভেস্টমেন্ট',
      timestamp: '2026-10-09T09:00:00Z',
      performedBy: 'Shawon Ahmed (Managing Partner)',
      ownerId: 'owner_galleria_2',
    },
    {
      id: 'dtx_11',
      shopId: 'shop_galleria_sports',
      type: 'sale',
      drawer: 'personalBkash',
      amount: 2900,
      direction: 'in',
      referenceId: 'INV-2026-077',
      note: 'Customer Direct Personal bKash Payment',
      timestamp: '2026-10-08T16:45:00Z',
      salesmanName: 'Tanvir Ahmed',
    },
  ],
};

// Seed Inventory Items
const DEFAULT_INVENTORY: Record<string, InventoryItem[]> = {
  shop_galleria_sports: [
    {
      id: 'prod_rm_2425',
      shopId: 'shop_galleria_sports',
      name: 'Real Madrid 2024/25 Home White Kit',
      bengaliName: 'রিয়াল মাদ্রিদ হোম জার্সি',
      categoryType: 'jersey',
      jerseyCategory: 'Player Issue',
      clubOrCountry: 'Real Madrid',
      season: '2024/25',
      lotCostLandingPrice: 720,
      mrp: 1450,
      bottomPrice: 1200,
      totalStock: 38,
      sku: 'JER-RM-2425-PI',
      variants: [
        { size: 'M', stock: 12, daysInStock: 8, costPrice: 720, mrp: 1450, bottomPrice: 1200 },
        { size: 'L', stock: 15, daysInStock: 8, costPrice: 720, mrp: 1450, bottomPrice: 1200 },
        { size: 'XL', stock: 8, daysInStock: 8, costPrice: 720, mrp: 1450, bottomPrice: 1200 },
        { size: 'XXL', stock: 3, daysInStock: 14, costPrice: 720, mrp: 1450, bottomPrice: 1200 },
      ],
    },
    {
      id: 'prod_arg_3star',
      shopId: 'shop_galleria_sports',
      name: 'Argentina 3-Star World Cup Champions Jersey',
      bengaliName: 'আর্জেন্টিনা ৩ স্টার চ্যাম্পিয়ন জার্সি',
      categoryType: 'jersey',
      jerseyCategory: 'Player Issue',
      clubOrCountry: 'Argentina',
      season: '2024/25 Copa',
      lotCostLandingPrice: 750,
      mrp: 1500,
      bottomPrice: 1250,
      totalStock: 45,
      sku: 'JER-ARG-3STAR',
      variants: [
        { size: 'M', stock: 14, daysInStock: 5, costPrice: 750, mrp: 1500, bottomPrice: 1250 },
        { size: 'L', stock: 18, daysInStock: 5, costPrice: 750, mrp: 1500, bottomPrice: 1250 },
        { size: 'XL', stock: 9, daysInStock: 5, costPrice: 750, mrp: 1500, bottomPrice: 1250 },
        { size: 'XXL', stock: 4, daysInStock: 12, costPrice: 750, mrp: 1500, bottomPrice: 1250 },
      ],
    },
    {
      id: 'prod_barca_retro',
      shopId: 'shop_galleria_sports',
      name: 'FC Barcelona 2008/09 Retro UCL Final Kit',
      bengaliName: 'বার্সেলোনা ২০০৮ রেট্রো জার্সি',
      categoryType: 'jersey',
      jerseyCategory: 'Retro Vintage',
      clubOrCountry: 'Barcelona',
      season: '2008/09 Retro',
      lotCostLandingPrice: 850,
      mrp: 1750,
      bottomPrice: 1450,
      totalStock: 16,
      sku: 'JER-FCB-0809-RETRO',
      variants: [
        { size: 'M', stock: 5, daysInStock: 22, costPrice: 850, mrp: 1750, bottomPrice: 1450 },
        { size: 'L', stock: 7, daysInStock: 22, costPrice: 850, mrp: 1750, bottomPrice: 1450 },
        { size: 'XL', stock: 4, daysInStock: 22, costPrice: 850, mrp: 1750, bottomPrice: 1450 },
      ],
    },
    {
      id: 'prod_bd_premium',
      shopId: 'shop_galleria_sports',
      name: 'Bangladesh National Cricket Official World Cup Edition',
      bengaliName: 'বাংলাদেশ জাতীয় ক্রিকেট জার্সি',
      categoryType: 'jersey',
      jerseyCategory: 'BD Premium',
      clubOrCountry: 'Bangladesh Cricket',
      season: '2024 Edition',
      lotCostLandingPrice: 520,
      mrp: 990,
      bottomPrice: 850,
      totalStock: 29,
      sku: 'JER-BD-PREM-2024',
      variants: [
        { size: 'M', stock: 10, daysInStock: 15, costPrice: 520, mrp: 990, bottomPrice: 850 },
        { size: 'L', stock: 12, daysInStock: 15, costPrice: 520, mrp: 990, bottomPrice: 850 },
        { size: 'XL', stock: 5, daysInStock: 15, costPrice: 520, mrp: 990, bottomPrice: 850 },
        { size: 'XXL', stock: 2, daysInStock: 30, costPrice: 520, mrp: 990, bottomPrice: 850 },
      ],
    },
    {
      id: 'prod_brazil_fan',
      shopId: 'shop_galleria_sports',
      name: 'Brazil 2024 Copa America Yellow Home Kit',
      bengaliName: 'ব্রাজিল ২০২৪ হলুদ হোম জার্সি',
      categoryType: 'jersey',
      jerseyCategory: 'Fan Issue',
      clubOrCountry: 'Brazil',
      season: '2024',
      lotCostLandingPrice: 480,
      mrp: 950,
      bottomPrice: 750,
      totalStock: 24,
      sku: 'JER-BRA-FAN-24',
      variants: [
        { size: 'M', stock: 8, daysInStock: 18, costPrice: 480, mrp: 950, bottomPrice: 750 },
        { size: 'L', stock: 10, daysInStock: 18, costPrice: 480, mrp: 950, bottomPrice: 750 },
        { size: 'XL', stock: 6, daysInStock: 18, costPrice: 480, mrp: 950, bottomPrice: 750 },
      ],
    },
  ],
  shop_vogue_apparel: [
    {
      id: 'prod_denim_501',
      shopId: 'shop_vogue_apparel',
      name: 'Premium Washed Stretch Slim Denim Pants',
      bengaliName: 'প্রিমিয়াম ওয়াশড স্ট্রেচ জিন্স প্যান্ট',
      categoryType: 'apparel',
      clothingCategory: 'Jeans',
      subCategory: 'Jeans',
      apparelScale: 'denim_pants',
      lotCostLandingPrice: 650,
      mrp: 1650,
      bottomPrice: 1350,
      totalStock: 42,
      sku: 'APP-DNM-501',
      variants: [
        { size: '28-Reg', stock: 4, daysInStock: 12, costPrice: 650, mrp: 1650, bottomPrice: 1350 },
        { size: '30-Reg', stock: 10, daysInStock: 8, costPrice: 650, mrp: 1650, bottomPrice: 1350 },
        { size: '32-Reg', stock: 16, daysInStock: 8, costPrice: 650, mrp: 1650, bottomPrice: 1350 },
        { size: '34-Reg', stock: 8, daysInStock: 14, costPrice: 650, mrp: 1650, bottomPrice: 1350 },
        { size: '36-Reg', stock: 3, daysInStock: 25, costPrice: 650, mrp: 1650, bottomPrice: 1350 },
        { size: '38-Long', stock: 1, daysInStock: 52, costPrice: 650, mrp: 1650, bottomPrice: 1350, isClearance: true }, // DEAD-STOCK ALERT (>45 days)
      ],
    },
    {
      id: 'prod_linen_shirt',
      shopId: 'shop_vogue_apparel',
      name: 'Casual Pure Linen Mandarin Collar Shirt',
      bengaliName: 'ক্যাজুয়াল পিওর লিনেন শার্ট',
      categoryType: 'apparel',
      clothingCategory: 'Shirt',
      subCategory: 'Shirt',
      apparelScale: 'shirts_tops',
      lotCostLandingPrice: 420,
      mrp: 1150,
      bottomPrice: 900,
      totalStock: 35,
      sku: 'APP-SHIRT-LINEN',
      variants: [
        { size: 'S', stock: 2, daysInStock: 49, costPrice: 420, mrp: 1150, bottomPrice: 900, isClearance: true }, // DEAD-STOCK ALERT
        { size: 'M', stock: 12, daysInStock: 10, costPrice: 420, mrp: 1150, bottomPrice: 900 },
        { size: 'L', stock: 14, daysInStock: 10, costPrice: 420, mrp: 1150, bottomPrice: 900 },
        { size: 'XL', stock: 6, daysInStock: 15, costPrice: 420, mrp: 1150, bottomPrice: 900 },
        { size: 'XXL', stock: 1, daysInStock: 48, costPrice: 420, mrp: 1150, bottomPrice: 900, isClearance: true }, // DEAD-STOCK ALERT
      ],
    },
    {
      id: 'prod_panjabi_royal',
      shopId: 'shop_vogue_apparel',
      name: 'Royal Jacquard Embroidered Semi-Fit Panjabi',
      bengaliName: 'রয়্যাল জাকুয়ার্ড সেমি-ফিট পাঞ্জাবি',
      categoryType: 'apparel',
      clothingCategory: 'Panjabi',
      subCategory: 'Panjabi',
      apparelScale: 'panjabi',
      lotCostLandingPrice: 880,
      mrp: 2250,
      bottomPrice: 1800,
      totalStock: 28,
      sku: 'APP-PANJABI-ROYAL',
      variants: [
        { size: '38', stock: 5, daysInStock: 14, costPrice: 880, mrp: 2250, bottomPrice: 1800 },
        { size: '40', stock: 9, daysInStock: 14, costPrice: 880, mrp: 2250, bottomPrice: 1800 },
        { size: '42', stock: 8, daysInStock: 14, costPrice: 880, mrp: 2250, bottomPrice: 1800 },
        { size: '44', stock: 4, daysInStock: 18, costPrice: 880, mrp: 2250, bottomPrice: 1800 },
        { size: '46', stock: 2, daysInStock: 46, costPrice: 880, mrp: 2250, bottomPrice: 1800, isClearance: true },
      ],
    },
    {
      id: 'prod_tshirt_heavy',
      shopId: 'shop_vogue_apparel',
      name: 'Heavyweight Drop-Shoulder Combed Cotton T-Shirt',
      bengaliName: 'হেভিওয়েট ড্রপ-শোল্ডার কটন টি-শার্ট',
      categoryType: 'apparel',
      clothingCategory: 'T-Shirt',
      subCategory: 'T-Shirt',
      apparelScale: 'shirts_tops',
      lotCostLandingPrice: 240,
      mrp: 650,
      bottomPrice: 500,
      totalStock: 40,
      sku: 'APP-TSHIRT-240',
      variants: [
        { size: 'S', stock: 6, daysInStock: 6, costPrice: 240, mrp: 650, bottomPrice: 500 },
        { size: 'M', stock: 14, daysInStock: 6, costPrice: 240, mrp: 650, bottomPrice: 500 },
        { size: 'L', stock: 12, daysInStock: 6, costPrice: 240, mrp: 650, bottomPrice: 500 },
        { size: 'XL', stock: 8, daysInStock: 6, costPrice: 240, mrp: 650, bottomPrice: 500 },
      ],
    },
    {
      id: 'prod_polo_pique',
      shopId: 'shop_vogue_apparel',
      name: 'Mercerized Pique Knit Classic Polo Shirt',
      bengaliName: 'প্রিমিয়াম পিকে নিট পোলো শার্ট',
      categoryType: 'apparel',
      clothingCategory: 'Polo Shirt',
      subCategory: 'Polo Shirt',
      apparelScale: 'shirts_tops',
      lotCostLandingPrice: 380,
      mrp: 950,
      bottomPrice: 780,
      totalStock: 32,
      sku: 'APP-POLO-950',
      variants: [
        { size: 'M', stock: 10, daysInStock: 7, costPrice: 380, mrp: 950, bottomPrice: 780 },
        { size: 'L', stock: 12, daysInStock: 7, costPrice: 380, mrp: 950, bottomPrice: 780 },
        { size: 'XL', stock: 7, daysInStock: 7, costPrice: 380, mrp: 950, bottomPrice: 780 },
        { size: 'XXL', stock: 3, daysInStock: 7, costPrice: 380, mrp: 950, bottomPrice: 780 },
      ],
    },
    {
      id: 'prod_chino_trouser',
      shopId: 'shop_vogue_apparel',
      name: 'Stretch Twill Gabardine Formal Chino Trouser',
      bengaliName: 'স্ট্রেচ টুইল গ্যাবার্ডিন প্যান্ট / ট্রাউজার',
      categoryType: 'apparel',
      clothingCategory: 'Pant / Trouser',
      subCategory: 'Pant / Trouser',
      apparelScale: 'denim_pants',
      lotCostLandingPrice: 520,
      mrp: 1350,
      bottomPrice: 1100,
      totalStock: 30,
      sku: 'APP-PANT-CHINO',
      variants: [
        { size: '30-Reg', stock: 8, daysInStock: 9, costPrice: 520, mrp: 1350, bottomPrice: 1100 },
        { size: '32-Reg', stock: 10, daysInStock: 9, costPrice: 520, mrp: 1350, bottomPrice: 1100 },
        { size: '34-Reg', stock: 8, daysInStock: 9, costPrice: 520, mrp: 1350, bottomPrice: 1100 },
        { size: '36-Reg', stock: 4, daysInStock: 9, costPrice: 520, mrp: 1350, bottomPrice: 1100 },
      ],
    },
    {
      id: 'prod_hoodie_fleece',
      shopId: 'shop_vogue_apparel',
      name: '320 GSM Brushed Fleece Winter Pullover Hoodie',
      bengaliName: '৩২০ জিএসএম ফ্লিস উইন্টার হুডি',
      categoryType: 'apparel',
      clothingCategory: 'Hoodie',
      subCategory: 'Hoodie',
      apparelScale: 'shirts_tops',
      lotCostLandingPrice: 680,
      mrp: 1550,
      bottomPrice: 1250,
      totalStock: 22,
      sku: 'APP-HOODIE-320',
      variants: [
        { size: 'M', stock: 7, daysInStock: 5, costPrice: 680, mrp: 1550, bottomPrice: 1250 },
        { size: 'L', stock: 9, daysInStock: 5, costPrice: 680, mrp: 1550, bottomPrice: 1250 },
        { size: 'XL', stock: 6, daysInStock: 5, costPrice: 680, mrp: 1550, bottomPrice: 1250 },
      ],
    },
  ],
};

// Seed Invoices
const DEFAULT_INVOICES: Record<string, Invoice[]> = {
  shop_galleria_sports: [
    {
      id: 'inv_101',
      invoiceNo: 'GS-2026-0891',
      shopId: 'shop_galleria_sports',
      customerName: 'Sabbir Ahmed',
      customerPhone: '01712998877',
      salesmanId: 'staff_2',
      salesmanName: 'Tanvir Ahmed',
      items: [
        {
          id: 'item_1',
          productId: 'prod_rm_2425',
          itemType: 'jersey',
          title: 'Real Madrid 2024/25 Home White Kit',
          subDetail: 'Player Issue • L',
          size: 'L',
          rate: 1450,
          quantity: 1,
          subtotal: 1450,
          costPrice: 720,
          bottomPrice: 1200,
        },
      ],
      subtotal: 1450,
      discount: 0,
      total: 1450,
      paymentMode: 'paid',
      paymentChannel: 'cash',
      advancePaid: 1450,
      dueAmount: 0,
      status: 'completed',
      createdAt: '2026-10-18T08:15:00Z',
    },
    {
      id: 'inv_102',
      invoiceNo: 'GS-2026-0892',
      shopId: 'shop_galleria_sports',
      customerName: 'Fahim Shakil',
      customerPhone: '01819334455',
      salesmanId: 'staff_2',
      salesmanName: 'Tanvir Ahmed',
      items: [
        {
          id: 'item_2',
          productId: 'prod_arg_3star',
          itemType: 'jersey',
          title: 'Argentina 3-Star World Cup Champions Jersey',
          subDetail: 'Player Issue • XL • [CUSTOM: MESSI 10 • World Cup Font • UCL 15 Badge]',
          size: 'XL',
          rate: 1850, // 1500 + 350 customization
          quantity: 1,
          subtotal: 1850,
          costPrice: 750,
          bottomPrice: 1550,
          customization: {
            customName: 'MESSI',
            customNumber: '10',
            fontStyle: 'World Cup Font',
            size: 'XL',
            patches: 'FIFA World Cup Winners',
            instructions: 'Gold heat press text, centered under neck. Deliver by Monday 5 PM.',
            printStatus: 'in_press',
            extraCharge: 350,
            assignedPress: 'Nilkhet Print Hub Unit 3',
          },
        },
      ],
      subtotal: 1850,
      discount: 50,
      total: 1800,
      paymentMode: 'partial',
      paymentChannel: 'bkash',
      advancePaid: 1000,
      dueAmount: 800,
      status: 'partial_due',
      createdAt: '2026-10-18T07:45:00Z',
      notes: 'Customer will collect after office hours. Send WhatsApp slip when ready.',
    },
    {
      id: 'inv_103',
      invoiceNo: 'GS-2026-0893',
      shopId: 'shop_galleria_sports',
      customerName: 'Shawon Hossain',
      customerPhone: '01711223344',
      salesmanId: 'staff_2',
      salesmanName: 'Tanvir Ahmed',
      items: [
        {
          id: 'item_3',
          productId: 'prod_arg_2006',
          itemType: 'jersey',
          title: 'Argentina 2006 Home White Kit',
          subDetail: 'Retro Vintage • L • [CUSTOM: SHAWON 19]',
          size: 'L',
          rate: 1850,
          quantity: 1,
          subtotal: 1850,
          costPrice: 800,
          bottomPrice: 1500,
          customization: {
            customName: 'SHAWON',
            customNumber: '19',
            fontStyle: '2006 Home White',
            size: 'L',
            patches: 'None',
            instructions: 'Black outline with white fill, official 2006 World Cup cut',
            printStatus: 'order_taken',
            extraCharge: 350,
            copyCount: 0,
            dtfOrdered: false,
          },
        },
      ],
      subtotal: 1850,
      discount: 0,
      total: 1850,
      paymentMode: 'paid',
      paymentChannel: 'cash',
      advancePaid: 1850,
      dueAmount: 0,
      status: 'completed',
      createdAt: '2026-10-18T10:15:00Z',
    },
    {
      id: 'inv_104',
      invoiceNo: 'GS-2026-0888',
      shopId: 'shop_galleria_sports',
      customerName: 'Rayhan Kabir',
      customerPhone: '01922334455',
      salesmanId: 'staff_3',
      salesmanName: 'Rana Sheikh',
      items: [
        {
          id: 'item_4',
          productId: 'prod_rm_2425',
          itemType: 'jersey',
          title: 'Real Madrid 2024/25 Home White Kit',
          subDetail: 'Player Issue • XL • [CUSTOM: BELLINGHAM 5]',
          size: 'XL',
          rate: 1800,
          quantity: 1,
          subtotal: 1800,
          costPrice: 750,
          bottomPrice: 1450,
          customization: {
            customName: 'BELLINGHAM',
            customNumber: '5',
            fontStyle: '2024/25 Official Font',
            size: 'XL',
            patches: 'UCL 15/14 Badge',
            instructions: 'Standard black numbering, UCL starball on sleeve',
            printStatus: 'in_press',
            extraCharge: 350,
            copyCount: 1,
            dtfOrdered: true,
            dtfOrderedAt: '2026-10-09T15:30:00Z',
          },
        },
      ],
      subtotal: 1800,
      discount: 0,
      total: 1800,
      paymentMode: 'paid',
      paymentChannel: 'cash',
      advancePaid: 1800,
      dueAmount: 0,
      status: 'completed',
      createdAt: '2026-10-09T14:30:00Z',
    },
    {
      id: 'inv_105',
      invoiceNo: 'GS-2026-0885',
      shopId: 'shop_galleria_sports',
      customerName: 'Tahmid Hasan',
      customerPhone: '01833445566',
      salesmanId: 'staff_2',
      salesmanName: 'Tanvir Ahmed',
      items: [
        {
          id: 'item_5',
          productId: 'prod_brz_2002',
          itemType: 'jersey',
          title: 'Brazil 2002 Away Blue Retro Kit',
          subDetail: 'Retro Vintage • M • [CUSTOM: RONALDO 9]',
          size: 'M',
          rate: 1900,
          quantity: 1,
          subtotal: 1900,
          costPrice: 850,
          bottomPrice: 1550,
          customization: {
            customName: 'RONALDO',
            customNumber: '9',
            fontStyle: '2002 World Cup Font',
            size: 'M',
            patches: 'World Cup Champions Patch',
            instructions: 'Yellow font on blue jersey, curved arch lettering',
            printStatus: 'ready_for_pickup',
            extraCharge: 350,
            copyCount: 0,
            dtfOrdered: false,
          },
        },
      ],
      subtotal: 1900,
      discount: 0,
      total: 1900,
      paymentMode: 'paid',
      paymentChannel: 'nagad',
      advancePaid: 1900,
      dueAmount: 0,
      status: 'completed',
      createdAt: '2026-10-10T12:00:00Z',
    },
    {
      id: 'inv_sarif_1',
      invoiceNo: 'GS-2026-0925',
      shopId: 'shop_galleria_sports',
      customerName: 'sarif',
      customerPhone: '01876217088',
      salesmanId: 'staff_2',
      salesmanName: 'Tanvir Ahmed',
      items: [
        {
          id: 'item_sarif_1',
          productId: 'prod_rm_2425',
          itemType: 'jersey',
          title: 'Real Madrid 2024/25 Home White Kit',
          subDetail: 'Player Issue • L • [CUSTOM: SARIF 10 • UCL 15 Badge]',
          size: 'L',
          rate: 2150,
          quantity: 1,
          subtotal: 2150,
          costPrice: 750,
          bottomPrice: 1750,
          customization: {
            customName: 'SARIF',
            customNumber: '10',
            fontStyle: '2024/25 Official Font',
            size: 'L',
            patches: 'UCL 15/14 Badge',
            instructions: 'Golden name print on back with UCL 15 sleeve badge',
            printStatus: 'ready_for_pickup',
            extraCharge: 350,
            copyCount: 1,
            dtfOrdered: true,
            dtfOrderedAt: '2026-10-22T09:15:00Z',
          },
        },
      ],
      subtotal: 2150,
      discount: 0,
      total: 2150,
      paymentMode: 'paid',
      paymentChannel: 'bkash',
      advancePaid: 2150,
      dueAmount: 0,
      status: 'completed',
      createdAt: '2026-10-22T10:35:00Z',
      notes: 'Customer Sarif - heat press customized jersey',
    },
    {
      id: 'inv_sarif_2',
      invoiceNo: 'GS-2026-0899',
      shopId: 'shop_galleria_sports',
      customerName: 'sarif',
      customerPhone: '01876217088',
      salesmanId: 'staff_3',
      salesmanName: 'Rana Sheikh',
      items: [
        {
          id: 'item_sarif_2',
          productId: 'prod_arg_3star',
          itemType: 'jersey',
          title: 'Argentina 3-Star World Cup Champions Jersey',
          subDetail: 'Fan Issue • M',
          size: 'M',
          rate: 1500,
          quantity: 1,
          subtotal: 1500,
          costPrice: 750,
          bottomPrice: 1250,
        },
      ],
      subtotal: 1500,
      discount: 0,
      total: 1500,
      paymentMode: 'paid',
      paymentChannel: 'cash',
      advancePaid: 1500,
      dueAmount: 0,
      status: 'completed',
      createdAt: '2026-10-15T09:20:00Z',
    },
  ],
  shop_vogue_apparel: [
    {
      id: 'inv_vogue_01',
      invoiceNo: 'VG-2026-0412',
      shopId: 'shop_vogue_apparel',
      customerName: 'Shahidul Alam',
      customerPhone: '01611002233',
      salesmanId: 'staff_vogue_2',
      salesmanName: 'Kabir Hossain',
      items: [
        {
          id: 'v_item_1',
          productId: 'prod_denim_501',
          itemType: 'apparel',
          title: 'Premium Washed Stretch Slim Denim Pants',
          subDetail: 'Denim • 32-Reg',
          size: '32-Reg',
          rate: 1650,
          quantity: 1,
          subtotal: 1650,
          costPrice: 650,
          bottomPrice: 1350,
          requiresAlteration: true,
        },
      ],
      subtotal: 1650,
      discount: 100,
      total: 1550,
      paymentMode: 'paid',
      paymentChannel: 'split',
      splitDetails: {
        cashAmount: 1000,
        digitalAmount: 550,
        digitalChannel: 'bkash',
      },
      advancePaid: 1550,
      dueAmount: 0,
      status: 'completed',
      alterationOrders: [
        {
          id: 'alt_01',
          shopId: 'shop_vogue_apparel',
          invoiceId: 'inv_vogue_01',
          customerName: 'Shahidul Alam',
          customerPhone: '01611002233',
          itemName: 'Slim Denim Pants (32-Reg)',
          size: '32-Reg',
          tailorInstruction: 'Bottom length -2.5 inches, keep original rope hem stitch.',
          tailorFee: 60,
          deliveryDate: '2026-10-19',
          status: 'sent_to_tailor',
          createdAt: '2026-10-18T08:00:00Z',
        },
      ],
      createdAt: '2026-10-18T08:00:00Z',
    },
  ],
};

// Seed Alterations
const DEFAULT_ALTERATIONS: Record<string, AlterationOrder[]> = {
  shop_vogue_apparel: [
    {
      id: 'alt_01',
      shopId: 'shop_vogue_apparel',
      invoiceId: 'inv_vogue_01',
      customerName: 'Shahidul Alam',
      customerPhone: '01611002233',
      itemName: 'Slim Denim Pants (32-Reg)',
      size: '32-Reg',
      tailorInstruction: 'Bottom length -2.5 inches, keep original rope hem stitch.',
      tailorFee: 60,
      deliveryDate: '2026-10-19',
      status: 'sent_to_tailor',
      createdAt: '2026-10-18T08:00:00Z',
    },
    {
      id: 'alt_02',
      shopId: 'shop_vogue_apparel',
      invoiceId: 'inv_vogue_00',
      customerName: 'Ashraful Haque',
      customerPhone: '01999887766',
      itemName: 'Royal Jacquard Panjabi (42)',
      size: '42',
      tailorInstruction: 'Sleeve length trim 1 inch + side fitting tighten 0.5 inch.',
      tailorFee: 80,
      deliveryDate: '2026-10-18',
      status: 'ready_for_pickup',
      createdAt: '2026-10-17T16:00:00Z',
    },
  ],
};

// Seed Team Tournament Bulk Orders
const DEFAULT_TEAM_ORDERS: Record<string, TeamBulkOrder[]> = {
  shop_galleria_sports: [
    {
      id: 'team_01',
      shopId: 'shop_galleria_sports',
      teamName: 'Gulshan Tigers FC',
      tournamentName: 'Corporate Super League 2026',
      contactPerson: 'Capt. Ariful Islam',
      contactPhone: '01715001122',
      kitDesign: 'Navy Blue & Electric Gold stripes, Official V-Neck',
      players: [
        { id: 'p_1', name: 'ARIF', number: '10', size: 'L', position: 'Forward' },
        { id: 'p_2', name: 'SOHEL', number: '7', size: 'M', position: 'Winger' },
        { id: 'p_3', name: 'SAKIB', number: '1', size: 'XL', position: 'GK' },
        { id: 'p_4', name: 'TARIQ', number: '4', size: 'L', position: 'Defender' },
        { id: 'p_5', name: 'NASIM', number: '8', size: 'M', position: 'Midfield' },
        { id: 'p_6', name: 'MEHEDI', number: '11', size: 'L', position: 'Forward' },
        { id: 'p_7', name: 'HASAN', number: '3', size: 'XL', position: 'Defender' },
        { id: 'p_8', name: 'SHOHAG', number: '6', size: 'M', position: 'Midfield' },
      ],
      ratePerPiece: 1100,
      subtotal: 8800,
      advancePaid: 4000,
      dueAmount: 4800,
      deliveryDate: '2026-10-24',
      status: 'in_printing',
      notes: 'Include sponsor logo on chest (vector file sent on WhatsApp). Heat pressed gold names.',
      createdAt: '2026-10-16T12:00:00Z',
    },
  ],
};

// Seed Resellers
const DEFAULT_RESELLERS: Record<string, ResellerAccount[]> = {
  shop_galleria_sports: [
    {
      id: 'res_01',
      shopId: 'shop_galleria_sports',
      name: 'Mirpur Sports Corner (Hazi Belal)',
      phone: '01817112233',
      location: 'Mirpur 10 Muktodhara Market, Dhaka',
      currentDueBalance: 14200,
      totalPurchased: 185000,
      ordersCount: 19,
      transactions: [
        {
          id: 'rtx_1',
          resellerId: 'res_01',
          shopId: 'shop_galleria_sports',
          date: '2026-10-15',
          type: 'dispatch',
          itemsCount: 20,
          amount: 18000,
          balanceAfter: 18000,
          note: 'Wholesale lot dispatch: 20 pcs Argentina Player Issue',
          slipNumber: 'WS-DISP-401',
        },
        {
          id: 'rtx_2',
          resellerId: 'res_01',
          shopId: 'shop_galleria_sports',
          date: '2026-10-16',
          type: 'payment_received',
          itemsCount: 0,
          amount: 3800,
          balanceAfter: 14200,
          note: 'bKash Merchant Payment received',
          slipNumber: 'BK-MR-9921',
        },
      ],
    },
    {
      id: 'res_02',
      shopId: 'shop_galleria_sports',
      name: 'Chittagong Kits Hub (Rezaul)',
      phone: '01911445566',
      location: 'New Market GEC Circle, Chattogram',
      currentDueBalance: 6500,
      totalPurchased: 98000,
      ordersCount: 9,
      transactions: [],
    },
  ],
};

// Seed Expenses
const DEFAULT_EXPENSES: Record<string, ExpenseRecord[]> = {
  shop_galleria_sports: [
    {
      id: 'exp_01',
      shopId: 'shop_galleria_sports',
      category: 'food',
      amount: 320,
      paymentDrawer: 'cash',
      note: 'Staff breakfast & afternoon tea',
      date: '2026-10-18',
      createdAt: '2026-10-18T07:00:00Z',
      createdBy: 'Mahmudul Hasan',
    },
    {
      id: 'exp_02',
      shopId: 'shop_galleria_sports',
      category: 'tailoring',
      amount: 850,
      paymentDrawer: 'personalBkash',
      note: 'Heat press machine maintenance & Nilkhet runner fee',
      date: '2026-10-17',
      createdAt: '2026-10-17T15:30:00Z',
      createdBy: 'Mahmudul Hasan',
    },
  ],
};

// Seed Global Blacklist
const DEFAULT_BLACKLIST: GlobalBlacklistEntry[] = [
  {
    id: 'bl_1',
    phone: '01819998877',
    customerName: 'Shuvo K.',
    reportedByShopId: 'shop_galleria_sports',
    reportedByShopName: 'Galleria Sports BD',
    reason: 'Fake bKash SMS screenshot scam attempt; left without paying due balance of ৳3,400.',
    amountDefrauded: 3400,
    reportedAt: '2026-10-10T14:30:00Z',
    severity: 'high',
  },
  {
    id: 'bl_2',
    phone: '01918776655',
    customerName: 'Rashedul I.',
    reportedByShopId: 'shop_vogue_apparel',
    reportedByShopName: 'Vogue Denim',
    reason: 'Altered clothes collected by 3rd person with stolen invoice screenshot; denied payment.',
    amountDefrauded: 2600,
    reportedAt: '2026-09-28T18:00:00Z',
    severity: 'medium',
  },
];

// In-memory fallback for environments without browser localStorage (e.g., node test, SSR)
const memoryStore = new Map<string, string>();

function safeGetItem(key: string): string | null {
  if (typeof window !== 'undefined' && typeof window.localStorage !== 'undefined') {
    try {
      return window.localStorage.getItem(key);
    } catch {
      return memoryStore.get(key) || null;
    }
  }
  return memoryStore.get(key) || null;
}

function safeSetItem(key: string, value: string): void {
  if (typeof window !== 'undefined' && typeof window.localStorage !== 'undefined') {
    try {
      window.localStorage.setItem(key, value);
      return;
    } catch {
      memoryStore.set(key, value);
      return;
    }
  }
  memoryStore.set(key, value);
}

// Helper to initialize or retrieve from storage
function getStorage<T>(key: string, defaultVal: T): T {
  try {
    const val = safeGetItem(key);
    if (!val) {
      safeSetItem(key, JSON.stringify(defaultVal));
      return defaultVal;
    }
    const parsed = JSON.parse(val);
    if (typeof defaultVal === 'object' && defaultVal !== null && !Array.isArray(defaultVal)) {
      return { ...defaultVal, ...parsed };
    }
    return parsed;
  } catch (e) {
    return defaultVal;
  }
}

function setStorage<T>(key: string, val: T): void {
  try {
    safeSetItem(key, JSON.stringify(val));
  } catch (e) {}
}

export const dbService = {
  // TENANTS
  getTenants(): TenantShop[] {
    return getStorage<TenantShop[]>(STORAGE_KEYS.TENANTS, DEFAULT_TENANTS);
  },

  saveTenants(tenants: TenantShop[]) {
    setStorage(STORAGE_KEYS.TENANTS, tenants);
  },

  getTenantById(id: string): TenantShop | undefined {
    const tenants = this.getTenants();
    return tenants.find((t) => t.id === id);
  },

  getCurrentTenantId(): string {
    const current = safeGetItem(STORAGE_KEYS.CURRENT_TENANT_ID);
    if (current && this.getTenantById(current)) {
      return current;
    }
    return 'shop_galleria_sports';
  },

  setCurrentTenantId(id: string) {
    safeSetItem(STORAGE_KEYS.CURRENT_TENANT_ID, id);
  },

  syncTenantToServer(tenant: TenantShop) {
    try {
      if (typeof window !== 'undefined' && typeof fetch === 'function') {
        void (async () => {
          try {
            const authHeaders = await getAuthHeaders();
            await fetch(`/api/stores/${encodeURIComponent(tenant.id)}`, {
              method: 'PUT',
              headers: {
                ...authHeaders,
                'x-lekho-uid': getRequesterUid() || tenant.ownerUid || '',
              },
              body: JSON.stringify({ store: tenant }),
            });
          } catch {}
        })();
      }
    } catch {}
  },

  // OWNER PIN & BOTTOM PRICE PROTECTION APIS
  async getOwnerPinStatus(shopId: string): Promise<{
    success: boolean;
    isConfigured: boolean;
    protectionEnabled: boolean;
    isLockedOut: boolean;
    remainingLockSeconds: number;
    remainingAttempts: number;
    error?: string;
  }> {
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`/api/shops/${encodeURIComponent(shopId)}/owner-pin/status`, {
        headers,
      });
      const data = await res.json();
      return {
        success: Boolean(res.ok && data.success),
        isConfigured: Boolean(data.isConfigured),
        protectionEnabled: data.protectionEnabled !== false,
        isLockedOut: Boolean(data.isLockedOut),
        remainingLockSeconds: Number(data.remainingLockSeconds) || 0,
        remainingAttempts: Number(data.remainingAttempts) ?? 5,
        error: data.message || data.error,
      };
    } catch (e: any) {
      return {
        success: false,
        isConfigured: false,
        protectionEnabled: true,
        isLockedOut: false,
        remainingLockSeconds: 0,
        remainingAttempts: 5,
        error: e.message || 'Network error',
      };
    }
  },

  async setupOwnerPin(
    shopId: string,
    pin: string,
    confirmPin: string,
    storeInfo?: Partial<TenantShop>
  ): Promise<{ success: boolean; message: string; errorCode?: string }> {
    try {
      const headers = await getAuthHeaders();
      const resolvedStore = storeInfo || this.getTenantById(shopId);
      const res = await fetch(`/api/shops/${encodeURIComponent(shopId)}/owner-pin/setup`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ pin, confirmPin, storeInfo: resolvedStore }),
      });
      const data = await res.json();
      if (data.success) {
        this.updateTenant(shopId, { ownerPinConfigured: true, ownerPin: '' });
      }
      return {
        success: Boolean(res.ok && data.success),
        message: data.message || data.error || (res.ok ? 'Owner PIN সফলভাবে কনফিগার করা হয়েছে।' : 'পিন সেট করতে সমস্যা হয়েছে।'),
        errorCode: data.errorCode,
        ...data,
      };
    } catch (e: any) {
      return { success: false, message: e.message || 'সার্ভারের সাথে সংযোগ স্থাপন করা যায়নি।' };
    }
  },

  async changeOwnerPin(
    shopId: string,
    currentPin: string,
    newPin: string,
    confirmPin: string,
    storeInfo?: Partial<TenantShop>
  ): Promise<{
    success: boolean;
    message: string;
    isLocked?: boolean;
    remainingAttempts?: number;
    remainingLockSeconds?: number;
    errorCode?: string;
  }> {
    try {
      const headers = await getAuthHeaders();
      const resolvedStore = storeInfo || this.getTenantById(shopId);
      const res = await fetch(`/api/shops/${encodeURIComponent(shopId)}/owner-pin/change`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ currentPin, newPin, confirmPin, storeInfo: resolvedStore }),
      });
      const data = await res.json();
      if (data.success) {
        this.updateTenant(shopId, { ownerPinConfigured: true, ownerPin: '' });
      }
      return {
        success: Boolean(res.ok && data.success),
        message: data.message || data.error || (res.ok ? 'Owner PIN সফলভাবে পরিবর্তিত হয়েছে।' : 'পিন পরিবর্তন করতে সমস্যা হয়েছে।'),
        errorCode: data.errorCode,
        ...data,
      };
    } catch (e: any) {
      return { success: false, message: e.message || 'সার্ভারের সাথে সংযোগ স্থাপন করা যায়নি।' };
    }
  },

  async resetOwnerPin(
    shopId: string,
    newPin: string,
    confirmPin: string,
    ownerPassword?: string,
    storeInfo?: Partial<TenantShop>
  ): Promise<{
    success: boolean;
    message: string;
    errorCode?: string;
  }> {
    try {
      const headers = await getAuthHeaders();
      const resolvedStore = storeInfo || this.getTenantById(shopId);
      const res = await fetch(`/api/shops/${encodeURIComponent(shopId)}/owner-pin/reset`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ newPin, confirmPin, ownerPassword, storeInfo: resolvedStore }),
      });
      const data = await res.json();
      if (data.success) {
        this.updateTenant(shopId, { ownerPinConfigured: true, ownerPin: '' });
      }
      return {
        success: Boolean(res.ok && data.success),
        message: data.message || data.error || (res.ok ? 'Owner PIN সফলভাবে রিসেট হয়েছে।' : 'পিন রিসেট করতে সমস্যা হয়েছে।'),
        errorCode: data.errorCode,
        ...data,
      };
    } catch (e: any) {
      return { success: false, message: e.message || 'সার্ভারের সাথে সংযোগ স্থাপন করা যায়নি।' };
    }
  },

  async toggleBottomPriceProtection(
    shopId: string,
    enabled: boolean,
    storeInfo?: Partial<TenantShop>
  ): Promise<{
    success: boolean;
    protectionEnabled?: boolean;
    message: string;
    errorCode?: string;
  }> {
    try {
      const headers = await getAuthHeaders();
      const resolvedStore = storeInfo || this.getTenantById(shopId);
      const res = await fetch(`/api/shops/${encodeURIComponent(shopId)}/owner-pin/toggle-protection`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ enabled, storeInfo: resolvedStore }),
      });
      const data = await res.json();
      if (data.success) {
        this.updateTenant(shopId, { bottomPriceProtectionEnabled: enabled });
      }
      return {
        success: Boolean(res.ok && data.success),
        protectionEnabled: data.protectionEnabled ?? enabled,
        message: data.message || data.error || (res.ok ? 'বটম-প্রাইস প্রোটেকশন আপডেট হয়েছে।' : 'প্রোটেকশন আপডেট করতে সমস্যা হয়েছে।'),
        errorCode: data.errorCode,
        ...data,
      };
    } catch (e: any) {
      return { success: false, message: e.message || 'সার্ভারের সাথে সংযোগ স্থাপন করা যায়নি।' };
    }
  },

  async authorizeFloorOverride(
    shopId: string,
    params: {
      pin: string;
      productId: string;
      productName?: string;
      attemptedRate: number;
      quantity: number;
      bottomPrice: number;
    },
    storeInfo?: Partial<TenantShop>
  ): Promise<{
    success: boolean;
    overrideToken?: string;
    expiresAt?: number;
    message: string;
    isLocked?: boolean;
    remainingAttempts?: number;
    remainingLockSeconds?: number;
    errorCode?: string;
  }> {
    try {
      const headers = await getAuthHeaders();
      const resolvedStore = storeInfo || this.getTenantById(shopId);
      const res = await fetch(`/api/shops/${encodeURIComponent(shopId)}/owner-pin/authorize-override`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ ...params, storeInfo: resolvedStore }),
      });
      const data = await res.json();
      return {
        success: Boolean(res.ok && data.success),
        overrideToken: data.overrideToken,
        expiresAt: data.expiresAt,
        message: data.message || data.error || (res.ok ? 'Store Owner অনুমোদন নিশ্চিত হয়েছে।' : 'বটম প্রাইস অনুমোদন ব্যর্থ হয়েছে।'),
        isLocked: data.isLocked,
        remainingAttempts: data.remainingAttempts,
        remainingLockSeconds: data.remainingLockSeconds,
        errorCode: data.errorCode,
        ...data,
      };
    } catch (e: any) {
      return {
        success: false,
        message: 'ইন্টারনেট বা সার্ভার সংযোগ ত্রুটি। বটম প্রাইস অনুমোদন করতে অনলাইন সংযোগ আবশ্যক।',
      };
    }
  },

  async createAuthorizedInvoice(
    shopId: string,
    invoice: Invoice,
    overrideTokens?: Record<string, string>,
    storeInfo?: Partial<TenantShop>
  ): Promise<{
    success: boolean;
    invoice?: Invoice;
    message?: string;
    errorCode?: string;
  }> {
    try {
      const headers = await getAuthHeaders();
      const resolvedStore = storeInfo || this.getTenantById(shopId);
      const res = await fetch(`/api/shops/${encodeURIComponent(shopId)}/invoices/create`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ invoice, overrideTokens, storeInfo: resolvedStore }),
      });
      const data = await res.json();
      return {
        success: Boolean(res.ok && data.success),
        invoice: data.invoice,
        message: data.message || data.error || (res.ok ? 'ইনভয়েস অনুমোদিত হয়েছে।' : 'ইনভয়েস অনুমোদন ব্যর্থ হয়েছে।'),
        errorCode: data.errorCode,
        ...data,
      };
    } catch (e: any) {
      return {
        success: false,
        errorCode: 'SERVER_NETWORK_ERROR',
        message: e.message || 'সার্ভার সংযোগ ত্রুটি',
      };
    }
  },

  async getSecurityAuditLogs(shopId: string): Promise<{ success: boolean; logs: any[]; error?: string }> {
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`/api/shops/${encodeURIComponent(shopId)}/audit-logs`, {
        headers,
      });
      const data = await res.json();
      return {
        success: Boolean(res.ok && data.success),
        logs: data.logs || [],
        error: data.message || data.error,
      };
    } catch (e: any) {
      return { success: false, logs: [], error: e.message };
    }
  },

  updateTenant(id: string, updates: Partial<TenantShop>): TenantShop | undefined {
    const tenants = this.getTenants();
    const index = tenants.findIndex((t) => t.id === id);
    if (index === -1) return undefined;
    tenants[index] = { ...tenants[index], ...updates };
    this.saveTenants(tenants);
    this.syncTenantToServer(tenants[index]);
    if (firestoreSync.isFirebaseActive()) {
      void firestoreSync.saveShop(tenants[index]);
    }
    return tenants[index];
  },

  submitSubscriptionRenewal(shopId: string, trxId: string): void {
    const tenant = this.getTenantById(shopId);
    if (!tenant) return;
    const currentSub = tenant.subscription || {
      plan: 'pro',
      status: 'active',
      monthlyFeeBdt: 1500,
      expiresAt: new Date(Date.now() + 30 * 86400000).toISOString(),
    };
    this.updateTenant(shopId, {
      subscription: {
        ...currentSub,
        pendingTrxId: trxId,
        status: 'pending',
        submittedAt: new Date().toISOString(),
      },
    });
  },

  addTenant(tenant: TenantShop) {
    const tenants = this.getTenants();
    const existingIdx = tenants.findIndex((t) => t.id === tenant.id);
    if (existingIdx !== -1) {
      tenants[existingIdx] = { ...tenants[existingIdx], ...tenant };
    } else {
      tenants.push(tenant);
    }
    this.saveTenants(tenants);
    this.syncTenantToServer(tenant);
    if (firestoreSync.isFirebaseActive()) {
      void firestoreSync.saveShop(tenant);
    }

    // If this is a Clothing shop, initialize default Men's Clothing categories if not already saved
    if (isClothingShop(tenant)) {
      const existingClothingCats = this.getClothingCategories(tenant.id);
      this.saveClothingCategories(tenant.id, existingClothingCats);
    }

    // Also init drawers
    const drawers = this.getDrawers();
    drawers[tenant.id] = {
      cash: 0,
      personalBkash: 0,
      merchantBkash: 0,
      nagad: 0,
      bank: 0,
    };
    this.saveDrawers(drawers);

    // Init staff (Owner only — no hardcoded '1234' salesman PIN backdoor)
    const staff = this.getStaffMembers();
    staff[tenant.id] = [
      {
        id: `staff_${tenant.id}_owner`,
        shopId: tenant.id,
        name: `${tenant.ownerName} (Owner)`,
        pin: tenant.ownerPin || '',
        role: 'owner',
        commissionPerPiece: 0,
        phone: tenant.ownerPhone,
        active: true,
      },
    ];
    this.saveStaffMembers(staff);
    if (firestoreSync.isFirebaseActive()) {
      void firestoreSync.syncStaffList(tenant.id, staff[tenant.id]);
    }
  },

  // Hydrate cache directly from Cloud Firestore snapshots without triggering write loops
  hydrateFromFirestore: {
    shop(shop: TenantShop) {
      const tenants = getStorage<TenantShop[]>(STORAGE_KEYS.TENANTS, DEFAULT_TENANTS);
      const idx = tenants.findIndex((t) => t.id === shop.id);
      if (idx !== -1) {
        tenants[idx] = { ...tenants[idx], ...shop };
      } else {
        tenants.push(shop);
      }
      setStorage(STORAGE_KEYS.TENANTS, tenants);
    },
    products(shopId: string, items: InventoryItem[]) {
      const all = getStorage<Record<string, InventoryItem[]>>(STORAGE_KEYS.INVENTORY, DEFAULT_INVENTORY);
      all[shopId] = items;
      setStorage(STORAGE_KEYS.INVENTORY, all);
    },
    privateCosts(
      shopId: string,
      productCosts: Record<string, PrivateProductCostRecord>,
      categoryCosts?: Record<string, number>
    ) {
      const all = getStorage<
        Record<
          string,
          {
            productCosts: Record<string, PrivateProductCostRecord>;
            categoryCosts: Record<string, number>;
          }
        >
      >(STORAGE_KEYS.PRIVATE_COSTS, {});
      const existing = all[shopId] || { productCosts: {}, categoryCosts: {} };
      all[shopId] = {
        productCosts: { ...existing.productCosts, ...(productCosts || {}) },
        categoryCosts: categoryCosts
          ? { ...existing.categoryCosts, ...categoryCosts }
          : existing.categoryCosts,
      };
      setStorage(STORAGE_KEYS.PRIVATE_COSTS, all);
    },
    invoices(shopId: string, invoices: Invoice[]) {
      const all = getStorage<Record<string, Invoice[]>>(STORAGE_KEYS.INVOICES, DEFAULT_INVOICES);
      all[shopId] = invoices;
      setStorage(STORAGE_KEYS.INVOICES, all);
    },
    expenses(shopId: string, expenses: ExpenseRecord[]) {
      const all = getStorage<Record<string, ExpenseRecord[]>>(STORAGE_KEYS.EXPENSES, DEFAULT_EXPENSES);
      all[shopId] = expenses;
      setStorage(STORAGE_KEYS.EXPENSES, all);
    },
    drawers(shopId: string, balances: MultiDrawerBalance) {
      const all = getStorage<Record<string, MultiDrawerBalance>>(STORAGE_KEYS.DRAWERS, DEFAULT_DRAWERS);
      all[shopId] = balances;
      setStorage(STORAGE_KEYS.DRAWERS, all);
    },
    drawerTxs(shopId: string, txs: DrawerTransaction[]) {
      const all = getStorage<Record<string, DrawerTransaction[]>>(STORAGE_KEYS.DRAWER_TXS, DEFAULT_DRAWER_TXS);
      all[shopId] = txs;
      setStorage(STORAGE_KEYS.DRAWER_TXS, all);
    },
    staff(shopId: string, staffList: StaffMember[]) {
      const all = getStorage<Record<string, StaffMember[]>>(STORAGE_KEYS.STAFF_MEMBERS, DEFAULT_STAFF);
      all[shopId] = staffList;
      setStorage(STORAGE_KEYS.STAFF_MEMBERS, all);
    },
    resellers(shopId: string, resellers: ResellerAccount[]) {
      const all = getStorage<Record<string, ResellerAccount[]>>(STORAGE_KEYS.RESELLERS, DEFAULT_RESELLERS);
      all[shopId] = resellers;
      setStorage(STORAGE_KEYS.RESELLERS, all);
    },
    auxiliaryData(shopId: string, docKey: string, items: any[]) {
      const keyMap: Record<string, string> = {
        alterations: STORAGE_KEYS.ALTERATIONS,
        teamOrders: STORAGE_KEYS.TEAM_ORDERS,
        fontOrders: STORAGE_KEYS.FONT_ORDERS,
        kitCategories: STORAGE_KEYS.KIT_CATEGORIES,
        otherCategories: STORAGE_KEYS.OTHER_CATEGORIES,
        clothingCategories: STORAGE_KEYS.CLOTHING_CATEGORIES,
        owners: STORAGE_KEYS.OWNERS,
        ownerTxs: STORAGE_KEYS.OWNER_TXS,
        zReports: STORAGE_KEYS.Z_REPORTS,
        sizeExchanges: STORAGE_KEYS.SIZE_EXCHANGES,
        trash: STORAGE_KEYS.TRASH,
        monthlyAudits: STORAGE_KEYS.MONTHLY_AUDITS,
        steadfastParcels: STORAGE_KEYS.STEADFAST_PARCELS,
        stockAdjustments: STORAGE_KEYS.STOCK_ADJUSTMENTS,
        loyaltyTxs: STORAGE_KEYS.LOYALTY_TXS,
        customerProfiles: STORAGE_KEYS.CUSTOMER_PROFILES,
        campaignTemplates: STORAGE_KEYS.CAMPAIGN_TEMPLATES,
        campaignLogs: STORAGE_KEYS.CAMPAIGN_LOGS,
      };
      const storageKey = keyMap[docKey];
      if (!storageKey) return;
      const all = getStorage<Record<string, any[]>>(storageKey, {});
      all[shopId] = items;
      setStorage(storageKey, all);
    },
  },

  // ROLE RESOLUTION & PRIVATE COST VAULT
  getEffectiveRole(overrideRole?: UserRole | string | null): UserRole {
    if (
      overrideRole === 'super_admin' ||
      overrideRole === 'shop_owner' ||
      overrideRole === 'manager' ||
      overrideRole === 'salesman'
    ) {
      return overrideRole;
    }
    try {
      const rawSession = safeGetItem('lekho_auth_session_v2');
      if (rawSession) {
        const parsed = JSON.parse(rawSession);
        if (
          parsed?.role === 'super_admin' ||
          parsed?.role === 'shop_owner' ||
          parsed?.role === 'manager' ||
          parsed?.role === 'salesman'
        ) {
          return parsed.role;
        }
      }
    } catch {}
    try {
      const activeRole = safeGetItem(STORAGE_KEYS.ACTIVE_ROLE);
      if (
        activeRole === 'super_admin' ||
        activeRole === 'shop_owner' ||
        activeRole === 'manager' ||
        activeRole === 'salesman'
      ) {
        return activeRole;
      }
    } catch {}
    return 'shop_owner';
  },

  setActiveRole(role: UserRole): void {
    // Only allow setting active role if there is no conflicting authenticated staff session
    try {
      const rawSession = safeGetItem('lekho_auth_session_v2');
      if (rawSession) {
        const parsed = JSON.parse(rawSession);
        if (parsed?.role && parsed.role !== role) {
          // Do not allow privilege escalation over an active authenticated session
          safeSetItem(STORAGE_KEYS.ACTIVE_ROLE, parsed.role);
          return;
        }
      }
    } catch {}
    safeSetItem(STORAGE_KEYS.ACTIVE_ROLE, role);
  },

  getPrivateCostVault(shopId: string): {
    productCosts: Record<string, PrivateProductCostRecord>;
    categoryCosts: Record<string, number>;
  } {
    const all = getStorage<
      Record<
        string,
        {
          productCosts: Record<string, PrivateProductCostRecord>;
          categoryCosts: Record<string, number>;
        }
      >
    >(STORAGE_KEYS.PRIVATE_COSTS, {});
    if (!all[shopId]) {
      const seedItems = DEFAULT_INVENTORY[shopId] || [];
      const productCosts: Record<string, PrivateProductCostRecord> = {};
      for (const item of seedItems) {
        const variantCosts: Record<string, number> = {};
        for (const v of item.variants || []) {
          variantCosts[v.size] = v.costPrice || item.lotCostLandingPrice || 0;
          variantCosts[`${v.size}::${v.color || ''}`] = v.costPrice || item.lotCostLandingPrice || 0;
        }
        productCosts[item.id] = {
          lotCostLandingPrice: item.lotCostLandingPrice || 0,
          variantCosts,
        };
      }
      all[shopId] = { productCosts, categoryCosts: {} };
      setStorage(STORAGE_KEYS.PRIVATE_COSTS, all);
    }
    return all[shopId];
  },

  savePrivateCostVault(
    shopId: string,
    productCosts: Record<string, PrivateProductCostRecord>,
    categoryCosts?: Record<string, number>
  ): void {
    const all = getStorage<
      Record<
        string,
        {
          productCosts: Record<string, PrivateProductCostRecord>;
          categoryCosts: Record<string, number>;
        }
      >
    >(STORAGE_KEYS.PRIVATE_COSTS, {});
    const existing = all[shopId] || { productCosts: {}, categoryCosts: {} };
    all[shopId] = {
      productCosts: { ...existing.productCosts, ...productCosts },
      categoryCosts: categoryCosts
        ? { ...existing.categoryCosts, ...categoryCosts }
        : existing.categoryCosts,
    };
    setStorage(STORAGE_KEYS.PRIVATE_COSTS, all);
    if (firestoreSync.isFirebaseActive()) {
      void firestoreSync.syncPrivateCosts(
        shopId,
        all[shopId].productCosts,
        all[shopId].categoryCosts
      );
    }
  },

  // STAFF & PINs
  getStaffMembers(): Record<string, StaffMember[]> {
    return getStorage<Record<string, StaffMember[]>>(STORAGE_KEYS.STAFF_MEMBERS, DEFAULT_STAFF);
  },

  saveStaffMembers(staff: Record<string, StaffMember[]>) {
    setStorage(STORAGE_KEYS.STAFF_MEMBERS, staff);
  },

  getShopStaff(shopId: string, role?: UserRole): StaffMember[] {
    const staff = this.getStaffMembers();
    const rawMembers = staff[shopId] || [];
    let needsSave = false;
    const migrated = rawMembers.map((m) => {
      if (m.pin && m.pin !== '' && !m.pinHash) {
        needsSave = true;
      }
      return migrateStaffCredentials(m);
    });
    if (needsSave) {
      staff[shopId] = migrated;
      this.saveStaffMembers(staff);
    }
    const effectiveRole = this.getEffectiveRole(role);
    // Never return plaintext PINs, pinHashes, or passwordHashes to any client caller
    if (!canManageOperators(effectiveRole)) {
      const uid = getRequesterUid();
      return migrated
        .filter((m) => !uid || m.uid === uid || m.role === 'owner' || m.active)
        .map((m) => sanitizeStaffForClient(m));
    }
    return migrated.map((m) => sanitizeStaffForClient(m));
  },

  updateShopStaff(shopId: string, members: StaffMember[], role?: UserRole): boolean {
    const effectiveRole = this.getEffectiveRole(role);
    if (!canManageOperators(effectiveRole)) {
      return false;
    }
    const staff = this.getStaffMembers();
    const existingList = staff[shopId] || [];
    const existingById = new Map(existingList.map((m) => [m.id, migrateStaffCredentials(m)]));

    const safeMembers = members.map((m) => {
      const prev = existingById.get(m.id);
      if (m.pin && m.pin.trim() !== '' && m.pin !== '••••') {
        return migrateStaffCredentials(m);
      }
      if (prev) {
        return {
          ...m,
          pin: '',
          pinHash: m.pinHash || prev.pinHash,
          pinSalt: m.pinSalt || prev.pinSalt,
          hasPinSet: Boolean(m.pinHash || prev.pinHash),
        };
      }
      return migrateStaffCredentials(m);
    });

    staff[shopId] = safeMembers;
    this.saveStaffMembers(staff);
    if (firestoreSync.isFirebaseActive()) {
      void firestoreSync.syncStaffList(shopId, safeMembers);
    }
    return true;
  },

  updateStaffPin(shopId: string, staffId: string, newPin: string, role?: UserRole): boolean {
    const effectiveRole = this.getEffectiveRole(role);
    if (!canManageOperators(effectiveRole)) {
      return false;
    }
    const cleanPin = String(newPin || '').trim();
    if (!/^\d{4}$/.test(cleanPin)) {
      return false;
    }
    const staff = this.getStaffMembers();
    const members = staff[shopId] || [];
    const member = members.find((m) => m.id === staffId);
    if (member) {
      const salt = member.pinSalt || generateCredentialSalt(`staff_${staffId}`);
      member.pin = '';
      member.pinSalt = salt;
      member.pinHash = hashCredentialSync(cleanPin, salt);
      member.hasPinSet = true;
      this.saveStaffMembers(staff);
      if (firestoreSync.isFirebaseActive()) {
        void firestoreSync.syncStaffList(shopId, members);
      }
      return true;
    }
    return false;
  },

  verifyStaffCounterPin(shopId: string, staffId: string, candidatePin: string): boolean {
    const staff = this.getStaffMembers();
    const members = staff[shopId] || [];
    const member = members.find((m) => m.id === staffId);
    if (!member || !member.active) return false;
    const migrated = migrateStaffCredentials(member);
    return verifyCredentialSync(
      candidatePin,
      migrated.pinHash,
      migrated.pinSalt,
      member.pin
    );
  },

  // OWNERS & PARTNERS (Strictly Owner & Super Admin Only)
  getOwners(): Record<string, OwnerAccount[]> {
    return getStorage<Record<string, OwnerAccount[]>>(STORAGE_KEYS.OWNERS, DEFAULT_OWNERS);
  },

  saveOwners(owners: Record<string, OwnerAccount[]>, syncShopId?: string) {
    setStorage(STORAGE_KEYS.OWNERS, owners);
    if (syncShopId && firestoreSync.isFirebaseActive()) {
      void firestoreSync.syncAuxiliaryData(syncShopId, 'owners', owners[syncShopId] || []);
    }
  },

  getRawShopOwnersInternal(shopId: string): OwnerAccount[] {
    const all = this.getOwners();
    if (!all[shopId] || all[shopId].length === 0) {
      const tenant = this.getTenantById(shopId);
      if (tenant) {
        const salt = `partner_owner_${shopId}_1`;
        const seedSecret = tenant.ownerPin && tenant.ownerPin.trim() ? tenant.ownerPin.trim() : '8492';
        all[shopId] = [
          {
            id: `owner_${shopId}_1`,
            shopId: shopId,
            name: `${tenant.ownerName} (Founder)`,
            username: tenant.ownerEmail ? tenant.ownerEmail.split('@')[0].toLowerCase() : 'founder',
            password: '',
            passwordSalt: salt,
            passwordHash: hashCredentialSync(seedSecret, salt),
            hasPasswordSet: true,
            phone: tenant.ownerPhone,
            sharePercentage: 100,
            totalWithdrawn: 0,
            totalAdded: 0,
            active: true,
            createdAt: new Date().toISOString(),
          },
        ];
        this.saveOwners(all);
      }
    }
    let migratedAny = false;
    const migratedList = (all[shopId] || []).map((o) => {
      if (o.password && o.password.trim() !== '') {
        migratedAny = true;
      }
      return migrateOwnerAccountCredentials(o);
    });
    if (migratedAny) {
      all[shopId] = migratedList;
      this.saveOwners(all);
    }
    return migratedList;
  },

  getShopOwners(shopId: string, role?: UserRole): OwnerAccount[] {
    const effectiveRole = this.getEffectiveRole(role);
    if (!canManagePartners(effectiveRole)) {
      return [];
    }
    const rawOwners = this.getRawShopOwnersInternal(shopId);
    return rawOwners.map((o) => sanitizePartnerForClient(o));
  },

  addShopOwner(
    shopId: string,
    ownerData: {
      name: string;
      username: string;
      password: string;
      phone: string;
      sharePercentage?: number;
    },
    role?: UserRole
  ): OwnerAccount | null {
    const effectiveRole = this.getEffectiveRole(role);
    if (!canManagePartners(effectiveRole)) {
      return null;
    }
    const cleanPassword = String(ownerData.password || '').trim();
    if (!ownerData.name.trim() || !ownerData.username.trim() || cleanPassword.length < 3) {
      return null;
    }
    const all = this.getOwners();
    const currentRaw = this.getRawShopOwnersInternal(shopId);
    const ownerId = `owner_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const salt = generateCredentialSalt(`partner_${ownerId}`);
    const passwordHash = hashCredentialSync(cleanPassword, salt);

    const newOwner: OwnerAccount = {
      id: ownerId,
      shopId,
      name: ownerData.name.trim(),
      username: ownerData.username.trim().toLowerCase(),
      password: '',
      passwordSalt: salt,
      passwordHash,
      hasPasswordSet: true,
      phone: ownerData.phone.trim(),
      sharePercentage: ownerData.sharePercentage || 50,
      totalWithdrawn: 0,
      totalAdded: 0,
      active: true,
      createdAt: new Date().toISOString(),
    };
    currentRaw.push(newOwner);
    all[shopId] = currentRaw;
    this.saveOwners(all, shopId);
    return sanitizePartnerForClient(newOwner);
  },

  updateShopOwner(
    shopId: string,
    ownerId: string,
    updates: Partial<OwnerAccount>,
    role?: UserRole
  ): OwnerAccount | null {
    const effectiveRole = this.getEffectiveRole(role);
    if (!canManagePartners(effectiveRole)) {
      return null;
    }
    const all = this.getOwners();
    const currentRaw = this.getRawShopOwnersInternal(shopId);
    const idx = currentRaw.findIndex((o) => o.id === ownerId);
    if (idx === -1) return null;

    const existing = currentRaw[idx];
    let updatedPasswordHash = existing.passwordHash;
    let updatedPasswordSalt = existing.passwordSalt || `partner_${ownerId}`;

    if (updates.password && updates.password.trim().length >= 3) {
      updatedPasswordSalt = generateCredentialSalt(`partner_${ownerId}`);
      updatedPasswordHash = hashCredentialSync(updates.password.trim(), updatedPasswordSalt);
    }

    currentRaw[idx] = {
      ...existing,
      ...updates,
      password: '',
      passwordSalt: updatedPasswordSalt,
      passwordHash: updatedPasswordHash,
      hasPasswordSet: Boolean(updatedPasswordHash),
    };
    all[shopId] = currentRaw;
    this.saveOwners(all, shopId);
    return sanitizePartnerForClient(currentRaw[idx]);
  },

  updateShopOwnerPassword(
    shopId: string,
    ownerId: string,
    newPassword: string,
    role?: UserRole
  ): { success: boolean; message: string } {
    const effectiveRole = this.getEffectiveRole(role);
    if (!canManagePartners(effectiveRole)) {
      return {
        success: false,
        message: 'শুধুমাত্র দোকানের মালিক (Shop Owner) পার্টনার পাসওয়ার্ড পরিবর্তন করতে পারবেন।',
      };
    }
    const cleanNew = String(newPassword || '').trim();
    if (cleanNew.length < 4) {
      return {
        success: false,
        message: 'নিরাপত্তার স্বার্থে উত্তোলন পাসওয়ার্ড কমপক্ষে ৪ অক্ষরের হতে হবে।',
      };
    }
    const updated = this.updateShopOwner(shopId, ownerId, { password: cleanNew }, effectiveRole);
    if (!updated) {
      return { success: false, message: 'পার্টনার একাউন্ট পাওয়া যায়নি।' };
    }
    return {
      success: true,
      message: `${updated.name}-এর উত্তোলন পাসওয়ার্ড সফলভাবে আপডেট ও এনক্রিপ্ট করা হয়েছে।`,
    };
  },

  deleteShopOwner(shopId: string, ownerId: string, role?: UserRole): boolean {
    const effectiveRole = this.getEffectiveRole(role);
    if (!canManagePartners(effectiveRole)) {
      return false;
    }
    const all = this.getOwners();
    const currentRaw = this.getRawShopOwnersInternal(shopId);
    if (currentRaw.length <= 1) {
      return false; // Prevent deleting the last founder account
    }
    all[shopId] = currentRaw.filter((o) => o.id !== ownerId);
    this.saveOwners(all, shopId);
    return true;
  },

  getOwnerWithdrawDeposits(shopId: string, role?: UserRole): OwnerWithdrawDepositRecord[] {
    const effectiveRole = this.getEffectiveRole(role);
    if (!canManagePartners(effectiveRole)) {
      return [];
    }
    const all = getStorage<Record<string, OwnerWithdrawDepositRecord[]>>(STORAGE_KEYS.OWNER_TXS, DEFAULT_OWNER_TXS);
    return all[shopId] || [];
  },

  recordOwnerWithdrawDeposit(
    shopId: string,
    payload: {
      ownerId: string;
      password: string;
      action: 'withdraw' | 'deposit';
      amount: number;
      drawer: DrawerType;
      note: string;
    },
    role?: UserRole
  ): { success: boolean; record?: OwnerWithdrawDepositRecord; tx?: DrawerTransaction; message?: string } {
    const effectiveRole = this.getEffectiveRole(role);
    if (!canManagePartners(effectiveRole)) {
      return {
        success: false,
        message: 'অননুমোদিত অনুরোধ: শুধুমাত্র দোকানের মালিক (Shop Owner) পার্টনার উত্তোলন বা মূলধন জমা এন্ট্রি করতে পারবেন।',
      };
    }

    const rawOwners = this.getRawShopOwnersInternal(shopId);
    const owner = rawOwners.find((o) => o.id === payload.ownerId);
    if (!owner) {
      return { success: false, message: 'Owner / Partner profile not found' };
    }

    // Verify password against salted hash (never plaintext comparison)
    const isPasswordValid = verifyCredentialSync(
      payload.password,
      owner.passwordHash,
      owner.passwordSalt,
      owner.password
    );
    if (!isPasswordValid) {
      return {
        success: false,
        message: `ভুল পাসওয়ার্ড! ${owner.name}-এর নির্ধারিত গোপন পাসওয়ার্ড ছাড়া টাকা উত্তোলন বা মূলধন এন্ট্রি সম্ভব নয়।`,
      };
    }

    if (payload.amount <= 0) {
      return { success: false, message: 'টাকার পরিমাণ ০ এর বেশি হতে হবে' };
    }

    // Check drawer balance if withdrawing
    const shopDrawers = this.getShopDrawers(shopId);
    if (payload.action === 'withdraw' && shopDrawers[payload.drawer] < payload.amount) {
      return {
        success: false,
        message: `ড্রয়ারে পর্যাপ্ত ব্যালেন্স নেই! ${payload.drawer} এ বর্তমান ব্যালেন্স ৳${shopDrawers[payload.drawer].toLocaleString()} কিন্তু উত্তোলন চাওয়া হয়েছে ৳${payload.amount.toLocaleString()}`,
      };
    }

    const timestamp = new Date().toISOString();
    const actionLabel = payload.action === 'withdraw' ? 'Owner Withdraw' : 'Capital Deposit';
    const note = payload.note ? payload.note.trim() : (payload.action === 'withdraw' ? 'মালিকের ব্যক্তিগত উত্তোলন' : 'ব্যবসায় মূলধন জমা');

    // 1. Create Drawer Transaction
    const drawerTx: DrawerTransaction = {
      id: `dtx_owner_${Date.now()}`,
      shopId,
      type: payload.action === 'withdraw' ? 'owner_withdraw' : 'owner_deposit',
      drawer: payload.drawer,
      amount: payload.amount,
      direction: payload.action === 'withdraw' ? 'out' : 'in',
      referenceId: `${payload.action === 'withdraw' ? 'WITHDRAW' : 'CAPITAL'}-${owner.username.toUpperCase()}`,
      note: `${actionLabel}: ${owner.name} (@${owner.username}) - ${note}`,
      timestamp,
      performedBy: `${owner.name} (@${owner.username})`,
      ownerId: owner.id,
    };
    this.addDrawerTransaction(drawerTx);

    // 2. Update owner account totals
    if (payload.action === 'withdraw') {
      owner.totalWithdrawn = (owner.totalWithdrawn || 0) + payload.amount;
    } else {
      owner.totalAdded = (owner.totalAdded || 0) + payload.amount;
    }
    this.updateShopOwner(
      shopId,
      owner.id,
      {
        totalWithdrawn: owner.totalWithdrawn,
        totalAdded: owner.totalAdded,
      },
      effectiveRole
    );

    // 3. Record in Owner Ledger
    const record: OwnerWithdrawDepositRecord = {
      id: `otx_${Date.now()}`,
      shopId,
      ownerId: owner.id,
      ownerName: owner.name,
      ownerUsername: owner.username,
      action: payload.action,
      amount: payload.amount,
      drawer: payload.drawer,
      note,
      timestamp,
    };

    const allOwnerTxs = getStorage<Record<string, OwnerWithdrawDepositRecord[]>>(STORAGE_KEYS.OWNER_TXS, DEFAULT_OWNER_TXS);
    if (!allOwnerTxs[shopId]) allOwnerTxs[shopId] = [];
    allOwnerTxs[shopId].unshift(record);
    setStorage(STORAGE_KEYS.OWNER_TXS, allOwnerTxs);
    if (firestoreSync.isFirebaseActive()) {
      void firestoreSync.syncAuxiliaryData(shopId, 'ownerTxs', allOwnerTxs[shopId]);
    }

    return {
      success: true,
      record,
      tx: drawerTx,
    };
  },

  // MULTI-DRAWER
  getDrawers(): Record<string, MultiDrawerBalance> {
    return getStorage<Record<string, MultiDrawerBalance>>(STORAGE_KEYS.DRAWERS, DEFAULT_DRAWERS);
  },

  saveDrawers(drawers: Record<string, MultiDrawerBalance>) {
    setStorage(STORAGE_KEYS.DRAWERS, drawers);
  },

  getShopDrawers(shopId: string): MultiDrawerBalance {
    const drawers = this.getDrawers();
    return (
      drawers[shopId] || {
        cash: 0,
        personalBkash: 0,
        merchantBkash: 0,
        nagad: 0,
        bank: 0,
      }
    );
  },

  getDrawerTransactions(shopId: string): DrawerTransaction[] {
    const all = getStorage<Record<string, DrawerTransaction[]>>(STORAGE_KEYS.DRAWER_TXS, DEFAULT_DRAWER_TXS);
    return all[shopId] || [];
  },

  addDrawerTransaction(tx: DrawerTransaction) {
    const all = getStorage<Record<string, DrawerTransaction[]>>(STORAGE_KEYS.DRAWER_TXS, DEFAULT_DRAWER_TXS);
    if (!all[tx.shopId]) all[tx.shopId] = [];
    all[tx.shopId].unshift(tx);
    setStorage(STORAGE_KEYS.DRAWER_TXS, all);

    // Update drawer balance
    const drawers = this.getDrawers();
    const shopDrawer = this.getShopDrawers(tx.shopId);
    const multiplier = tx.direction === 'in' ? 1 : -1;
    shopDrawer[tx.drawer] = Math.max(0, (shopDrawer[tx.drawer] || 0) + tx.amount * multiplier);
    drawers[tx.shopId] = shopDrawer;
    this.saveDrawers(drawers);
    if (firestoreSync.isFirebaseActive()) {
      void firestoreSync.syncDrawers(tx.shopId, shopDrawer, all[tx.shopId]);
    }
  },

  transferDrawerFunds(shopId: string, from: keyof MultiDrawerBalance, to: keyof MultiDrawerBalance, amount: number, note: string) {
    const shopDrawer = this.getShopDrawers(shopId);
    if ((shopDrawer[from] || 0) < amount) {
      throw new Error(`Insufficient balance in ${from} to transfer ৳${amount}`);
    }

    // Log debit transaction (addDrawerTransaction automatically debits the drawer)
    this.addDrawerTransaction({
      id: `tx_trf_${Date.now()}`,
      shopId,
      type: 'transfer',
      drawer: from,
      amount,
      direction: 'out',
      note: `Transferred to ${to}: ${note}`,
      timestamp: new Date().toISOString(),
    });

    // Log credit transaction (addDrawerTransaction automatically credits the drawer)
    this.addDrawerTransaction({
      id: `tx_trf_in_${Date.now() + 1}`,
      shopId,
      type: 'transfer',
      drawer: to,
      amount,
      direction: 'in',
      note: `Received transfer from ${from}: ${note}`,
      timestamp: new Date().toISOString(),
    });
  },

  // INVENTORY (Role-Aware Buying Price Protection & Cost Preservation)
  getRawInventoryInternal(shopId: string): InventoryItem[] {
    const all = getStorage<Record<string, InventoryItem[]>>(STORAGE_KEYS.INVENTORY, DEFAULT_INVENTORY);
    const items = (all[shopId] || DEFAULT_INVENTORY[shopId] || []).filter((item) => !item.isSoftDeleted);
    const vault = this.getPrivateCostVault(shopId);

    const hydrated = items.map((item) => {
      const vaultEntry = vault.productCosts[item.id];
      const lotCost =
        item.lotCostLandingPrice && item.lotCostLandingPrice > 0
          ? item.lotCostLandingPrice
          : vaultEntry?.lotCostLandingPrice || 0;
      const variants = Array.isArray(item.variants)
        ? item.variants.map((v) => {
            const compositeKey = `${v.size || ''}::${v.color || ''}`;
            const vCost =
              v.costPrice && v.costPrice > 0
                ? v.costPrice
                : vaultEntry?.variantCosts?.[compositeKey] ??
                  vaultEntry?.variantCosts?.[v.size] ??
                  lotCost;
            return { ...v, costPrice: vCost };
          })
        : [];
      return {
        ...item,
        lotCostLandingPrice: lotCost,
        variants,
      };
    });

    const tenant = this.getTenantById(shopId);
    return filterInventoryForShop(hydrated, tenant);
  },

  getInventory(shopId: string, role?: UserRole): InventoryItem[] {
    const effectiveRole = this.getEffectiveRole(role);
    const rawItems = this.getRawInventoryInternal(shopId);
    return sanitizeInventoryListForRole(rawItems, effectiveRole);
  },

  recordProductCostsInVault(shopId: string, items: InventoryItem[]): void {
    const vault = this.getPrivateCostVault(shopId);
    const updatedProductCosts: Record<string, PrivateProductCostRecord> = {
      ...vault.productCosts,
    };
    for (const item of items) {
      if (!item || !item.id) continue;
      const prevEntry = updatedProductCosts[item.id];
      const lotCost =
        item.lotCostLandingPrice && item.lotCostLandingPrice > 0
          ? item.lotCostLandingPrice
          : prevEntry?.lotCostLandingPrice || 0;
      const variantCosts: Record<string, number> = {
        ...(prevEntry?.variantCosts || {}),
      };
      for (const v of item.variants || []) {
        const c = v.costPrice && v.costPrice > 0 ? v.costPrice : lotCost;
        if (c > 0) {
          variantCosts[v.size] = c;
          variantCosts[`${v.size || ''}::${v.color || ''}`] = c;
        }
      }
      updatedProductCosts[item.id] = {
        lotCostLandingPrice: lotCost,
        variantCosts,
      };
    }
    this.savePrivateCostVault(shopId, updatedProductCosts);
  },

  saveShopInventory(shopId: string, items: InventoryItem[], role?: UserRole) {
    const effectiveRole = this.getEffectiveRole(role);
    const all = getStorage<Record<string, InventoryItem[]>>(STORAGE_KEYS.INVENTORY, DEFAULT_INVENTORY);
    const existingRawList = all[shopId] || DEFAULT_INVENTORY[shopId] || [];
    const existingById = new Map(existingRawList.map((i) => [i.id, i]));
    const vault = this.getPrivateCostVault(shopId);

    const safeItems = items.map((incoming) => {
      const existing = existingById.get(incoming.id);
      return preserveInventoryItemCosts(
        incoming,
        existing,
        effectiveRole,
        vault.productCosts[incoming.id]
      );
    });

    all[shopId] = safeItems;
    setStorage(STORAGE_KEYS.INVENTORY, all);
    if (canViewBuyingPrice(effectiveRole)) {
      this.recordProductCostsInVault(shopId, safeItems);
    }
    if (firestoreSync.isFirebaseActive()) {
      void firestoreSync.syncAllProducts(shopId, safeItems);
    }
  },

  saveInventoryItem(shopId: string, item: InventoryItem, role?: UserRole) {
    const effectiveRole = this.getEffectiveRole(role);
    const all = getStorage<Record<string, InventoryItem[]>>(STORAGE_KEYS.INVENTORY, DEFAULT_INVENTORY);
    const items = all[shopId] ? [...all[shopId]] : [...(DEFAULT_INVENTORY[shopId] || [])];
    const vault = this.getPrivateCostVault(shopId);
    const index = items.findIndex((i) => i.id === item.id);
    const existing = index !== -1 ? items[index] : undefined;

    const preservedItem = preserveInventoryItemCosts(
      item,
      existing,
      effectiveRole,
      vault.productCosts[item.id]
    );

    if (index !== -1) {
      items[index] = { ...items[index], ...preservedItem, isSoftDeleted: false };
    } else {
      items.unshift(preservedItem);
    }
    all[shopId] = items;
    setStorage(STORAGE_KEYS.INVENTORY, all);

    if (canViewBuyingPrice(effectiveRole)) {
      this.recordProductCostsInVault(shopId, [preservedItem]);
    }

    if (firestoreSync.isFirebaseActive()) {
      const firestorePayload = canViewBuyingPrice(effectiveRole)
        ? preservedItem
        : { ...preservedItem, lotCostLandingPrice: existing?.lotCostLandingPrice ?? 0 };
      void firestoreSync.syncProduct(shopId, firestorePayload);
    }
  },

  deleteInventoryItem(shopId: string, itemId: string) {
    this.softDeleteInventoryItem(shopId, itemId);
  },

  addInventoryItem(shopId: string, item: InventoryItem, role?: UserRole) {
    this.saveInventoryItem(shopId, item, role);
  },

  updateInventoryItem(shopId: string, itemId: string, updates: Partial<InventoryItem>, role?: UserRole) {
    const effectiveRole = this.getEffectiveRole(role);
    const rawItems = this.getRawInventoryInternal(shopId);
    const existing = rawItems.find((i) => i.id === itemId);
    if (!existing) return;

    const mergedCandidate: InventoryItem = {
      ...existing,
      ...updates,
      id: itemId,
    };
    this.saveInventoryItem(shopId, mergedCandidate, effectiveRole);
  },

  softDeleteInventoryItem(shopId: string, itemId: string) {
    const all = getStorage<Record<string, InventoryItem[]>>(STORAGE_KEYS.INVENTORY, DEFAULT_INVENTORY);
    const items = all[shopId] ? [...all[shopId]] : [...(DEFAULT_INVENTORY[shopId] || [])];
    const target = items.find((i) => i.id === itemId && !i.isSoftDeleted);
    if (!target) return;

    // Send to trash
    this.addToTrash({
      id: `trash_inv_${Date.now()}`,
      shopId,
      itemType: 'product',
      title: target.name,
      summary: `Stock: ${target.totalStock} pcs • MRP: ৳${target.mrp}`,
      data: target,
      deletedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    });

    // Mark deleted
    target.isSoftDeleted = true;
    target.deletedAt = new Date().toISOString();
    all[shopId] = items;
    setStorage(STORAGE_KEYS.INVENTORY, all);
    if (firestoreSync.isFirebaseActive()) {
      void firestoreSync.syncProduct(shopId, target);
    }
  },

  // INVOICES & SALES (Role-Aware Cost Sanitization + Automatic Server/Vault Cost Hydration on Sale)
  getRawInvoicesInternal(shopId: string): Invoice[] {
    const all = getStorage<Record<string, Invoice[]>>(STORAGE_KEYS.INVOICES, DEFAULT_INVOICES);
    if (!Array.isArray(all[shopId])) {
      all[shopId] = DEFAULT_INVOICES[shopId] ? [...DEFAULT_INVOICES[shopId]] : [];
      setStorage(STORAGE_KEYS.INVOICES, all);
    }
    const shopInvoices = all[shopId] || [];
    return shopInvoices.filter((inv) => !inv.isSoftDeleted);
  },

  getInvoices(shopId: string, role?: UserRole): Invoice[] {
    const effectiveRole = this.getEffectiveRole(role);
    const rawInvoices = this.getRawInvoicesInternal(shopId);
    return sanitizeInvoiceListForRole(rawInvoices, effectiveRole);
  },

  saveShopInvoices(shopId: string, invoices: Invoice[]) {
    const all = getStorage<Record<string, Invoice[]>>(STORAGE_KEYS.INVOICES, DEFAULT_INVOICES);
    all[shopId] = invoices;
    setStorage(STORAGE_KEYS.INVOICES, all);
    if (firestoreSync.isFirebaseActive()) {
      void firestoreSync.syncAllInvoices(shopId, invoices);
    }
  },

  addInvoice(shopId: string, invoice: Invoice) {
    const invoices = this.getRawInvoicesInternal(shopId);
    // Idempotency guard: if this exact invoice ID or invoiceNo was already committed for this shop, do not duplicate or double-deduct stock
    if (
      invoices.some(
        (existing) =>
          existing &&
          !existing.isSoftDeleted &&
          (existing.id === invoice.id || existing.invoiceNo === invoice.invoiceNo)
      )
    ) {
      return;
    }

    const rawInventory = this.getRawInventoryInternal(shopId);
    const vault = this.getPrivateCostVault(shopId);
    const storeConfig = this.getStoreConfig(shopId);
    const isInventoryTrackingOn =
      storeConfig.inventoryTrackingEnabled !== false &&
      storeConfig.autoDeductStockOnConfirm !== false;

    // Ensure line items retain accurate Owner costPrice for Owner profit calculations
    // and link to matching inventory variants ONLY when Inventory Tracking is ON
    const hydratedItems = (invoice.items || []).map((line) => {
      if (!isInventoryTrackingOn || line.isManualInventoryEntry) {
        return line;
      }
      const match = findMatchingInventoryVariant(rawInventory, line, shopId);
      const prod =
        match?.product ||
        (line.productId ? rawInventory.find((p) => p.id === line.productId) : undefined);
      const variant =
        match?.variant || prod?.variants?.find((v) => v.size === line.size);

      const resolvedProductId = line.productId || prod?.id;
      const resolvedVariantId = line.variantId || variant?.id;
      const resolvedSku = line.sku || variant?.sku || prod?.sku;
      const resolvedColor = line.color || variant?.color || prod?.color;

      if (line.costPrice && line.costPrice > 0) {
        return {
          ...line,
          productId: resolvedProductId,
          variantId: resolvedVariantId,
          sku: resolvedSku,
          color: resolvedColor,
        };
      }

      if (resolvedProductId) {
        const vaultProd = vault.productCosts[resolvedProductId];
        const resolvedCost =
          variant?.costPrice ||
          prod?.lotCostLandingPrice ||
          vaultProd?.variantCosts?.[line.size] ||
          vaultProd?.lotCostLandingPrice ||
          0;
        return {
          ...line,
          productId: resolvedProductId,
          variantId: resolvedVariantId,
          sku: resolvedSku,
          color: resolvedColor,
          costPrice: resolvedCost,
        };
      }
      return line;
    });

    const enrichedInvoice: Invoice = {
      ...invoice,
      shopId,
      items: hydratedItems,
      stockDeducted: false,
    };

    // Atomically compute stock deductions BEFORE committing invoice so any stock validation error aborts cleanly
    const existingAdjustments = this.getStockAdjustments(shopId);
    const deductionResult = processPosSaleStockDeduction({
      shopId,
      invoice: enrichedInvoice,
      inventory: rawInventory,
      existingAdjustments,
      inventoryTrackingEnabled: isInventoryTrackingOn,
      allowOutOfStockSelling: storeConfig.allowOutOfStockSelling === true,
      responsibleUser: enrichedInvoice.salesmanName || 'Counter Staff',
      timestamp: enrichedInvoice.createdAt,
    });

    enrichedInvoice.stockDeducted = deductionResult.stockDeducted;

    // Persist invoice and stock changes together
    invoices.unshift(enrichedInvoice);
    this.saveShopInvoices(shopId, invoices);

    if (deductionResult.stockMovements.length > 0 && !deductionResult.alreadyProcessed) {
      this.saveShopInventory(shopId, deductionResult.updatedInventory, 'shop_owner');
      this.appendStockAdjustments(shopId, deductionResult.stockMovements);
    }

    // Update Drawer balances
    if (enrichedInvoice.paymentChannel === 'split' && enrichedInvoice.splitBreakdown) {
      const entries: Array<{ key: keyof MultiDrawerBalance; label: string; amount: number }> = [
        { key: 'cash', label: 'Cash', amount: Number(enrichedInvoice.splitBreakdown.cash) || 0 },
        { key: 'merchantBkash', label: 'bKash Merchant', amount: Number(enrichedInvoice.splitBreakdown.merchantBkash) || 0 },
        { key: 'personalBkash', label: 'bKash Personal', amount: Number(enrichedInvoice.splitBreakdown.personalBkash) || 0 },
        { key: 'nagad', label: 'Nagad', amount: Number(enrichedInvoice.splitBreakdown.nagad) || 0 },
        { key: 'bank', label: 'Bank/Card', amount: Number(enrichedInvoice.splitBreakdown.bank) || 0 },
      ];
      entries.forEach((entry, idx) => {
        if (entry.amount > 0) {
          this.addDrawerTransaction({
            id: `dtx_inv_sp_${Date.now()}_${idx}`,
            shopId,
            type: enrichedInvoice.paymentMode === 'partial' ? 'advance' : 'sale',
            drawer: entry.key,
            amount: entry.amount,
            direction: 'in',
            referenceId: enrichedInvoice.invoiceNo,
            note: `Split ${enrichedInvoice.paymentMode === 'partial' ? 'advance' : 'sale'} memo #${enrichedInvoice.invoiceNo} (${entry.label})`,
            timestamp: new Date().toISOString(),
            salesmanName: enrichedInvoice.salesmanName,
          });
        }
      });
    } else if (enrichedInvoice.paymentChannel === 'split' && enrichedInvoice.splitDetails) {
      this.addDrawerTransaction({
        id: `dtx_inv_c_${Date.now()}`,
        shopId,
        type: 'sale',
        drawer: 'cash',
        amount: enrichedInvoice.splitDetails.cashAmount,
        direction: 'in',
        referenceId: enrichedInvoice.invoiceNo,
        note: `Split sale memo #${enrichedInvoice.invoiceNo} (Cash part)`,
        timestamp: new Date().toISOString(),
        salesmanName: enrichedInvoice.salesmanName,
      });

      const digitalDrawerKey =
        enrichedInvoice.splitDetails.digitalChannel === 'bkash'
          ? 'merchantBkash'
          : enrichedInvoice.splitDetails.digitalChannel === 'nagad'
          ? 'nagad'
          : 'bank';

      this.addDrawerTransaction({
        id: `dtx_inv_d_${Date.now()}`,
        shopId,
        type: 'sale',
        drawer: digitalDrawerKey,
        amount: enrichedInvoice.splitDetails.digitalAmount,
        direction: 'in',
        referenceId: enrichedInvoice.invoiceNo,
        note: `Split sale memo #${enrichedInvoice.invoiceNo} (${enrichedInvoice.splitDetails.digitalChannel} part)`,
        timestamp: new Date().toISOString(),
        salesmanName: enrichedInvoice.salesmanName,
      });
    } else {
      const channelToDrawer: Record<string, keyof MultiDrawerBalance> = {
        cash: 'cash',
        bkash: 'merchantBkash',
        merchantBkash: 'merchantBkash',
        personalBkash: 'personalBkash',
        nagad: 'nagad',
        bank: 'bank',
      };
      const drawerKey = channelToDrawer[enrichedInvoice.paymentChannel] || 'cash';

      if (enrichedInvoice.advancePaid > 0) {
        this.addDrawerTransaction({
          id: `dtx_inv_${Date.now()}`,
          shopId,
          type: enrichedInvoice.paymentMode === 'partial' ? 'advance' : 'sale',
          drawer: drawerKey,
          amount: enrichedInvoice.advancePaid,
          direction: 'in',
          referenceId: enrichedInvoice.invoiceNo,
          note: `Sale Memo #${enrichedInvoice.invoiceNo} (${enrichedInvoice.customerName || 'Walk-in'})`,
          timestamp: new Date().toISOString(),
          salesmanName: enrichedInvoice.salesmanName,
        });
      }
    }

    // Update Shop-Scoped Customer Profile & Loyalty Ledger (Strictly isolated to shopId)
    const normalizedPhone = normalizeBdPhone(enrichedInvoice.customerPhone);
    if (normalizedPhone && normalizedPhone.length >= 6) {
      const loyaltySettings = this.getLoyaltySettings(shopId);
      const existingSummary = this.getShopCustomerHistory(shopId, normalizedPhone);
      let currentPoints = existingSummary.loyaltyPoints;
      let lifetimeEarned = existingSummary.lifetimePointsEarned;
      let lifetimeRedeemed = existingSummary.lifetimePointsRedeemed;
      const customerId = buildShopCustomerId(shopId, normalizedPhone);
      const existingTxs = this.getLoyaltyTransactions(shopId);

      // 1. Record Loyalty Points Redemption (idempotent per invoiceId)
      const redeemedPts = Math.max(0, Number(enrichedInvoice.loyaltyPointsRedeemed) || 0);
      const alreadyRedeemed = existingTxs.some(
        (tx) => tx.invoiceId === enrichedInvoice.id && tx.type === 'redeem'
      );
      if (redeemedPts > 0 && !alreadyRedeemed && loyaltySettings.enabled) {
        const actualRedeem = Math.min(currentPoints, redeemedPts);
        if (actualRedeem > 0) {
          currentPoints = Math.max(0, currentPoints - actualRedeem);
          lifetimeRedeemed += actualRedeem;
          existingTxs.unshift({
            id: `ltx_red_${enrichedInvoice.id}`,
            shopId,
            customerId,
            customerPhone: normalizedPhone,
            customerName: enrichedInvoice.customerName || existingSummary.customerName || 'Walk-in Customer',
            invoiceId: enrichedInvoice.id,
            invoiceNo: enrichedInvoice.invoiceNo,
            type: 'redeem',
            points: actualRedeem,
            balanceAfter: currentPoints,
            discountApplied: enrichedInvoice.loyaltyDiscountAmount || 0,
            rewardTierLabel: enrichedInvoice.loyaltyTierApplied,
            note: `Redeemed on Memo #${enrichedInvoice.invoiceNo}`,
            createdBy: enrichedInvoice.salesmanName || 'Counter Staff',
            timestamp: enrichedInvoice.createdAt,
          });
        }
      }

      // 2. Record Loyalty Points Earned (idempotent per invoiceId)
      const alreadyEarned = existingTxs.some(
        (tx) => tx.invoiceId === enrichedInvoice.id && tx.type === 'earn'
      );
      const earnedPts =
        enrichedInvoice.loyaltyPointsEarned !== undefined
          ? Math.max(0, Number(enrichedInvoice.loyaltyPointsEarned) || 0)
          : calculateEarnedLoyaltyPoints(enrichedInvoice.total, loyaltySettings, enrichedInvoice.status);

      if (earnedPts > 0 && !alreadyEarned && loyaltySettings.enabled) {
        currentPoints += earnedPts;
        lifetimeEarned += earnedPts;
        enrichedInvoice.loyaltyPointsEarned = earnedPts;
        existingTxs.unshift({
          id: `ltx_earn_${enrichedInvoice.id}`,
          shopId,
          customerId,
          customerPhone: normalizedPhone,
          customerName: enrichedInvoice.customerName || existingSummary.customerName || 'Walk-in Customer',
          invoiceId: enrichedInvoice.id,
          invoiceNo: enrichedInvoice.invoiceNo,
          type: 'earn',
          points: earnedPts,
          balanceAfter: currentPoints,
          note: `Earned from Memo #${enrichedInvoice.invoiceNo} (৳${enrichedInvoice.total})`,
          createdBy: enrichedInvoice.salesmanName || 'Counter Staff',
          timestamp: enrichedInvoice.createdAt,
        });
        // Persist updated loyaltyPointsEarned onto the saved invoice
        const updatedInvs = this.getRawInvoicesInternal(shopId);
        const targetInv = updatedInvs.find((i) => i.id === enrichedInvoice.id);
        if (targetInv) {
          targetInv.loyaltyPointsEarned = earnedPts;
          this.saveShopInvoices(shopId, updatedInvs);
        }
      }

      this.saveLoyaltyTransactions(shopId, existingTxs);
      this.upsertShopCustomerProfile(shopId, normalizedPhone, {
        name:
          enrichedInvoice.customerName &&
          enrichedInvoice.customerName.trim().toLowerCase() !== 'walk-in customer'
            ? enrichedInvoice.customerName.trim()
            : existingSummary.customerName || 'Walk-in Customer',
        loyaltyPoints: currentPoints,
        lifetimePointsEarned: lifetimeEarned,
        lifetimePointsRedeemed: lifetimeRedeemed,
      });
    }

    // Update Shop stats
    const tenant = this.getTenantById(shopId);
    if (tenant) {
      const currentStats = tenant.stats || { totalSales: 0, totalOrders: 0, totalDueRecovered: 0, gmv: 0 };
      currentStats.totalSales += invoice.total;
      currentStats.totalOrders += 1;
      currentStats.gmv += invoice.total;
      this.updateTenant(shopId, { stats: currentStats });
    }
  },

  updateInvoice(shopId: string, invoiceId: string, updates: Partial<Invoice>) {
    const invoices = this.getRawInvoicesInternal(shopId);
    const idx = invoices.findIndex((i) => i.id === invoiceId);
    if (idx !== -1) {
      const prevStatus = invoices[idx].status;
      invoices[idx] = { ...invoices[idx], ...updates };
      this.saveShopInvoices(shopId, invoices);
      if (prevStatus !== 'returned' && updates.status === 'returned') {
        this.reverseInvoiceStockAndLoyalty(shopId, invoices[idx], 'Invoice marked as returned');
      }
    }
  },

  reverseInvoiceStockAndLoyalty(shopId: string, invoice: Invoice, reason: string) {
    // 1. Restock inventory variants idempotently using processReturnStockRestoration
    const inventory = this.getRawInventoryInternal(shopId);
    const existingAdjustments = this.getStockAdjustments(shopId);
    const restorationResult = processReturnStockRestoration({
      shopId,
      invoice,
      inventory,
      existingAdjustments,
      responsibleUser: 'System Return',
      reason: `${reason} (#${invoice.invoiceNo})`,
    });

    if (restorationResult.stockMovements.length > 0 && !restorationResult.alreadyRestored) {
      this.saveShopInventory(shopId, restorationResult.updatedInventory, 'shop_owner');
      this.appendStockAdjustments(shopId, restorationResult.stockMovements);
    }

    // 2. Reverse earned loyalty points idempotently
    const normalizedPhone = normalizeBdPhone(invoice.customerPhone);
    if (normalizedPhone && normalizedPhone.length >= 6) {
      const existingTxs = this.getLoyaltyTransactions(shopId);
      const alreadyReversed = existingTxs.some(
        (tx) => tx.invoiceId === invoice.id && tx.type === 'reverse'
      );
      const earnedTx = existingTxs.find(
        (tx) => tx.invoiceId === invoice.id && tx.type === 'earn'
      );
      const ptsToReverse = earnedTx?.points || invoice.loyaltyPointsEarned || 0;
      if (ptsToReverse > 0 && !alreadyReversed) {
        const summary = this.getShopCustomerHistory(shopId, normalizedPhone);
        const newBalance = Math.max(0, summary.loyaltyPoints - ptsToReverse);
        const customerId = buildShopCustomerId(shopId, normalizedPhone);
        existingTxs.unshift({
          id: `ltx_rev_${invoice.id}`,
          shopId,
          customerId,
          customerPhone: normalizedPhone,
          customerName: invoice.customerName || summary.customerName || 'Walk-in Customer',
          invoiceId: invoice.id,
          invoiceNo: invoice.invoiceNo,
          type: 'reverse',
          points: ptsToReverse,
          balanceAfter: newBalance,
          note: `Points reversed: ${reason} (#${invoice.invoiceNo})`,
          createdBy: 'System',
          timestamp: new Date().toISOString(),
        });
        this.saveLoyaltyTransactions(shopId, existingTxs);
        this.upsertShopCustomerProfile(shopId, normalizedPhone, {
          loyaltyPoints: newBalance,
        });
      }
    }
  },

  collectDue(shopId: string, invoiceId: string, amount: number, drawer: keyof MultiDrawerBalance) {
    const invoices = this.getRawInvoicesInternal(shopId);
    const invoice = invoices.find((i) => i.id === invoiceId);
    if (!invoice) return;

    invoice.dueAmount = Math.max(0, invoice.dueAmount - amount);
    if (invoice.dueAmount === 0) {
      invoice.status = 'completed';
      invoice.dueClearedAt = new Date().toISOString();
      invoice.dueClearedChannel = drawer;
    }
    this.saveShopInvoices(shopId, invoices);

    // Add to drawer
    this.addDrawerTransaction({
      id: `dtx_due_${Date.now()}`,
      shopId,
      type: 'due_recovery',
      drawer,
      amount,
      direction: 'in',
      referenceId: invoice.invoiceNo,
      note: `Due Recovery for Memo #${invoice.invoiceNo} (${invoice.customerName})`,
      timestamp: new Date().toISOString(),
    });

    const tenant = this.getTenantById(shopId);
    if (tenant) {
      const currentStats = tenant.stats || { totalSales: 0, totalOrders: 0, totalDueRecovered: 0, gmv: 0 };
      currentStats.totalDueRecovered += amount;
      this.updateTenant(shopId, { stats: currentStats });
    }
  },

  softDeleteInvoice(shopId: string, invoiceId: string) {
    const invoices = this.getRawInvoicesInternal(shopId);
    const target = invoices.find((i) => i.id === invoiceId);
    if (!target) return;

    this.reverseInvoiceStockAndLoyalty(shopId, target, 'Invoice moved to Trash');

    this.addToTrash({
      id: `trash_inv_${Date.now()}`,
      shopId,
      itemType: 'invoice',
      title: `Memo #${target.invoiceNo}`,
      summary: `Total: ৳${target.total} • Customer: ${target.customerName} (${target.customerPhone})`,
      data: target,
      deletedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    });

    target.isSoftDeleted = true;
    target.deletedAt = new Date().toISOString();
    this.saveShopInvoices(shopId, invoices);
  },

  // ALTERATIONS
  getAlterations(shopId: string): AlterationOrder[] {
    const all = getStorage<Record<string, AlterationOrder[]>>(STORAGE_KEYS.ALTERATIONS, DEFAULT_ALTERATIONS);
    return all[shopId] || [];
  },

  saveAlterations(shopId: string, items: AlterationOrder[]) {
    const all = getStorage<Record<string, AlterationOrder[]>>(STORAGE_KEYS.ALTERATIONS, DEFAULT_ALTERATIONS);
    all[shopId] = items;
    setStorage(STORAGE_KEYS.ALTERATIONS, all);
    if (firestoreSync.isFirebaseActive()) {
      void firestoreSync.syncAuxiliaryData(shopId, 'alterations', items);
    }
  },

  addAlteration(shopId: string, alt: AlterationOrder) {
    const list = this.getAlterations(shopId);
    list.unshift(alt);
    this.saveAlterations(shopId, list);

    // Tailor fee can be recorded into expenses
    if (alt.tailorFee > 0) {
      this.addExpense(shopId, {
        id: `exp_tailor_${Date.now()}`,
        shopId,
        category: 'tailoring',
        amount: alt.tailorFee,
        paymentDrawer: 'cash',
        note: `Tailor alteration fee: ${alt.itemName} (${alt.customerName})`,
        date: new Date().toISOString().split('T')[0],
        createdAt: new Date().toISOString(),
        createdBy: 'Alteration Tracker',
      });
    }
  },

  updateAlterationStatus(shopId: string, altId: string, status: AlterationOrder['status']) {
    const list = this.getAlterations(shopId);
    const target = list.find((a) => a.id === altId);
    if (target) {
      target.status = status;
      if (status === 'handed_over') {
        target.handedOverAt = new Date().toISOString();
      }
      this.saveAlterations(shopId, list);
    }
  },

  // TEAM BULK ORDERS
  getTeamOrders(shopId: string): TeamBulkOrder[] {
    const all = getStorage<Record<string, TeamBulkOrder[]>>(STORAGE_KEYS.TEAM_ORDERS, DEFAULT_TEAM_ORDERS);
    return all[shopId] || [];
  },

  saveTeamOrders(shopId: string, orders: TeamBulkOrder[]) {
    const all = getStorage<Record<string, TeamBulkOrder[]>>(STORAGE_KEYS.TEAM_ORDERS, DEFAULT_TEAM_ORDERS);
    all[shopId] = orders;
    setStorage(STORAGE_KEYS.TEAM_ORDERS, all);
    if (firestoreSync.isFirebaseActive()) {
      void firestoreSync.syncAuxiliaryData(shopId, 'teamOrders', orders);
    }
  },

  addTeamOrder(shopId: string, order: TeamBulkOrder) {
    const tenant = this.getTenantById(shopId);
    if (tenant && isClothingShop(tenant)) {
      throw new Error('Team bulk jersey orders are only available for Sportswear merchants.');
    }
    const list = this.getTeamOrders(shopId);
    list.unshift(order);
    this.saveTeamOrders(shopId, list);

    if (order.advancePaid > 0) {
      this.addDrawerTransaction({
        id: `dtx_team_${Date.now()}`,
        shopId,
        type: 'advance',
        drawer: 'merchantBkash',
        amount: order.advancePaid,
        direction: 'in',
        referenceId: order.id,
        note: `Team Order Advance: ${order.teamName} (${order.tournamentName})`,
        timestamp: new Date().toISOString(),
      });
    }
  },

  updateTeamOrderStatus(shopId: string, orderId: string, status: TeamBulkOrder['status']) {
    const list = this.getTeamOrders(shopId);
    const target = list.find((o) => o.id === orderId);
    if (target) {
      target.status = status;
      this.saveTeamOrders(shopId, list);
    }
  },

  // RESELLERS & WHOLESALE
  getResellers(shopId: string): ResellerAccount[] {
    let all = getStorage<any>(STORAGE_KEYS.RESELLERS, DEFAULT_RESELLERS);
    if (!all || typeof all !== 'object' || Array.isArray(all)) {
      all = { ...DEFAULT_RESELLERS };
      setStorage(STORAGE_KEYS.RESELLERS, all);
    }
    if (!all[shopId] || !Array.isArray(all[shopId])) {
      if (shopId === 'shop_galleria_sports') {
        all[shopId] = DEFAULT_RESELLERS['shop_galleria_sports'] || [];
        setStorage(STORAGE_KEYS.RESELLERS, all);
        return all[shopId];
      }
      return [];
    }
    return all[shopId];
  },

  saveResellers(shopId: string, list: ResellerAccount[]) {
    let all = getStorage<any>(STORAGE_KEYS.RESELLERS, DEFAULT_RESELLERS);
    if (!all || typeof all !== 'object' || Array.isArray(all)) {
      all = {};
    }
    all[shopId] = list;
    setStorage(STORAGE_KEYS.RESELLERS, all);
    if (firestoreSync.isFirebaseActive()) {
      void firestoreSync.syncResellers(shopId, list);
    }
  },

  addReseller(shopId: string, reseller: ResellerAccount) {
    const list = this.getResellers(shopId);
    list.unshift(reseller);
    this.saveResellers(shopId, list);
  },

  recordResellerDispatch(shopId: string, resellerId: string, itemsCount: number, totalAmount: number, note: string) {
    const list = this.getResellers(shopId);
    const reseller = list.find((r) => r.id === resellerId);
    if (!reseller) return;

    reseller.currentDueBalance += totalAmount;
    reseller.totalPurchased += totalAmount;
    reseller.ordersCount += 1;
    reseller.transactions.unshift({
      id: `rtx_${Date.now()}`,
      resellerId,
      shopId,
      date: new Date().toISOString().split('T')[0],
      type: 'dispatch',
      itemsCount,
      amount: totalAmount,
      balanceAfter: reseller.currentDueBalance,
      note,
      slipNumber: `WS-DISP-${Date.now().toString().slice(-4)}`,
    });
    this.saveResellers(shopId, list);
  },

  recordResellerPayment(shopId: string, resellerId: string, amount: number, drawer: DrawerType, note: string) {
    const list = this.getResellers(shopId);
    const reseller = list.find((r) => r.id === resellerId);
    if (!reseller) return;

    reseller.currentDueBalance = Math.max(0, reseller.currentDueBalance - amount);
    reseller.transactions.unshift({
      id: `rtx_${Date.now()}`,
      resellerId,
      shopId,
      date: new Date().toISOString().split('T')[0],
      type: 'payment_received',
      itemsCount: 0,
      amount,
      balanceAfter: reseller.currentDueBalance,
      note,
      slipNumber: `PAY-REC-${Date.now().toString().slice(-4)}`,
    });
    this.saveResellers(shopId, list);

    this.addDrawerTransaction({
      id: `dtx_reseller_${Date.now()}`,
      shopId,
      type: 'due_recovery',
      drawer,
      amount,
      direction: 'in',
      referenceId: resellerId,
      note: `Reseller Payment from ${reseller.name} (${note})`,
      timestamp: new Date().toISOString(),
    });
  },

  recordResellerCounterSale(
    shopId: string,
    resellerId: string,
    items: OrderLineItem[],
    totalAmount: number,
    paidAmount: number,
    dueAmount: number,
    paymentChannel: DrawerType | 'split',
    note: string,
    salesmanName: string,
    splitBreakdown?: {
      cash: number;
      merchantBkash: number;
      personalBkash: number;
      nagad: number;
      bank: number;
    }
  ): { invoice: Invoice; transaction: ResellerTransaction } {
    const list = this.getResellers(shopId);
    let reseller = list.find((r) => r.id === resellerId);
    if (!reseller && list.length > 0) {
      reseller = list[0];
    }
    if (!reseller) throw new Error('Reseller not found');

    const totalQty = items.reduce((sum, it) => sum + it.quantity, 0);
    const prevBalance = reseller.currentDueBalance;
    reseller.currentDueBalance += dueAmount;
    reseller.totalPurchased += totalAmount;
    reseller.ordersCount += 1;

    const slipNumber = `RES-INV-${Date.now().toString().slice(-5)}`;

    const transaction: ResellerTransaction = {
      id: `rtx_${Date.now()}`,
      resellerId,
      shopId,
      date: new Date().toISOString().split('T')[0],
      type: 'dispatch',
      itemsCount: totalQty,
      amount: totalAmount,
      balanceAfter: reseller.currentDueBalance,
      note: note || `In-Store Reseller Sale (${totalQty} pcs) • Paid: ৳${paidAmount}, Due: ৳${dueAmount}`,
      slipNumber,
      splitBreakdown: paymentChannel === 'split' ? splitBreakdown : undefined,
    };
    reseller.transactions.unshift(transaction);
    this.saveResellers(shopId, list);

    // If paidAmount > 0, record in drawer(s)
    if (paidAmount > 0) {
      if (paymentChannel === 'split' && splitBreakdown) {
        const entries: Array<{ key: DrawerType; label: string; amount: number }> = [
          { key: 'cash', label: 'Cash', amount: Number(splitBreakdown.cash) || 0 },
          { key: 'merchantBkash', label: 'bKash Merchant', amount: Number(splitBreakdown.merchantBkash) || 0 },
          { key: 'personalBkash', label: 'bKash Personal', amount: Number(splitBreakdown.personalBkash) || 0 },
          { key: 'nagad', label: 'Nagad', amount: Number(splitBreakdown.nagad) || 0 },
          { key: 'bank', label: 'Bank/Card', amount: Number(splitBreakdown.bank) || 0 },
        ];
        entries.forEach((entry, idx) => {
          if (entry.amount > 0) {
            this.addDrawerTransaction({
              id: `dtx_res_sale_sp_${Date.now()}_${idx}`,
              shopId,
              type: 'sale',
              drawer: entry.key,
              amount: entry.amount,
              direction: 'in',
              referenceId: slipNumber,
              note: `Reseller Split Sale: ${reseller!.name} (${slipNumber} - ${entry.label})`,
              timestamp: new Date().toISOString(),
              salesmanName,
            });
          }
        });
      } else if (paymentChannel !== 'split') {
        this.addDrawerTransaction({
          id: `dtx_res_sale_${Date.now()}`,
          shopId,
          type: 'sale',
          drawer: paymentChannel,
          amount: paidAmount,
          direction: 'in',
          referenceId: slipNumber,
          note: `Reseller Sale: ${reseller.name} (${slipNumber})`,
          timestamp: new Date().toISOString(),
          salesmanName,
        });
      }
    }

    // Save formal invoice with partyType: 'Reseller'
    const invoice: Invoice = {
      id: `inv_res_${Date.now()}`,
      invoiceNo: slipNumber,
      shopId,
      customerName: `${reseller.name} (Reseller)`,
      customerPhone: reseller.phone,
      salesmanId: 'staff_counter',
      salesmanName: salesmanName || 'Counter Staff',
      items,
      subtotal: totalAmount,
      discount: 0,
      total: totalAmount,
      paymentMode: dueAmount > 0 ? 'partial' : 'paid',
      paymentChannel:
        paymentChannel === 'split'
          ? 'split'
          : paymentChannel === 'merchantBkash'
          ? 'merchantBkash'
          : paymentChannel === 'personalBkash'
          ? 'personalBkash'
          : paymentChannel === 'nagad'
          ? 'nagad'
          : paymentChannel === 'bank'
          ? 'bank'
          : 'cash',
      splitBreakdown: paymentChannel === 'split' ? splitBreakdown : undefined,
      advancePaid: paidAmount,
      dueAmount,
      status: dueAmount > 0 ? 'partial_due' : 'completed',
      partyType: 'Reseller',
      createdAt: new Date().toISOString(),
      notes: `Reseller Counter: ${reseller.location} • Prev Balance: ৳${prevBalance}, New Balance: ৳${reseller.currentDueBalance}`,
    };

    const invoices = this.getInvoices(shopId);
    invoices.unshift(invoice);
    this.saveShopInvoices(shopId, invoices);

    return { invoice, transaction };
  },

  // EXPENSES
  getExpenses(shopId: string): ExpenseRecord[] {
    const all = getStorage<Record<string, ExpenseRecord[]>>(STORAGE_KEYS.EXPENSES, DEFAULT_EXPENSES);
    return all[shopId] || [];
  },

  addExpense(shopId: string, expense: ExpenseRecord) {
    const all = getStorage<Record<string, ExpenseRecord[]>>(STORAGE_KEYS.EXPENSES, DEFAULT_EXPENSES);
    if (!all[shopId]) all[shopId] = [];
    all[shopId].unshift(expense);
    setStorage(STORAGE_KEYS.EXPENSES, all);
    if (firestoreSync.isFirebaseActive()) {
      void firestoreSync.syncExpense(shopId, expense);
    }

    this.addDrawerTransaction({
      id: `dtx_exp_${Date.now()}`,
      shopId,
      type: 'expense',
      drawer: expense.paymentDrawer,
      amount: expense.amount,
      direction: 'out',
      referenceId: expense.id,
      note: `Expense: [${expense.category.toUpperCase()}] ${expense.note}`,
      timestamp: new Date().toISOString(),
    });
  },

  // Z-REPORTS
  getZReports(shopId: string): ZReport[] {
    const all = getStorage<Record<string, ZReport[]>>(STORAGE_KEYS.Z_REPORTS, {});
    return all[shopId] || [];
  },

  addZReport(shopId: string, report: ZReport) {
    const all = getStorage<Record<string, ZReport[]>>(STORAGE_KEYS.Z_REPORTS, {});
    if (!all[shopId]) all[shopId] = [];
    all[shopId].unshift(report);
    setStorage(STORAGE_KEYS.Z_REPORTS, all);
    if (firestoreSync.isFirebaseActive()) {
      void firestoreSync.syncAuxiliaryData(shopId, 'zReports', all[shopId]);
    }
  },

  // GLOBAL BLACKLIST
  getBlacklist(): GlobalBlacklistEntry[] {
    return getStorage<GlobalBlacklistEntry[]>(STORAGE_KEYS.BLACKLIST, DEFAULT_BLACKLIST);
  },

  addToBlacklist(entry: GlobalBlacklistEntry) {
    const list = this.getBlacklist();
    list.unshift(entry);
    setStorage(STORAGE_KEYS.BLACKLIST, list);
  },

  removeFromBlacklist(phone: string) {
    const list = this.getBlacklist().filter((b) => b.phone !== phone);
    setStorage(STORAGE_KEYS.BLACKLIST, list);
  },

  checkCustomerBlacklist(phone: string): GlobalBlacklistEntry | undefined {
    const list = this.getBlacklist();
    const cleanPhone = phone.replace(/[^0-9]/g, '');
    return list.find((b) => b.phone.replace(/[^0-9]/g, '') === cleanPhone);
  },

  // TRASH BIN
  getTrash(shopId: string): TrashItem[] {
    const all = getStorage<Record<string, TrashItem[]>>(STORAGE_KEYS.TRASH, {});
    const items = all[shopId] || [];
    const now = Date.now();
    // Auto-clean expired items (>30 days)
    return items.filter((item) => new Date(item.expiresAt).getTime() > now);
  },

  addToTrash(item: TrashItem) {
    const all = getStorage<Record<string, TrashItem[]>>(STORAGE_KEYS.TRASH, {});
    if (!all[item.shopId]) all[item.shopId] = [];
    all[item.shopId].unshift(item);
    setStorage(STORAGE_KEYS.TRASH, all);
    if (firestoreSync.isFirebaseActive()) {
      void firestoreSync.syncAuxiliaryData(item.shopId, 'trash', all[item.shopId]);
    }
  },

  restoreFromTrash(shopId: string, trashId: string): boolean {
    const all = getStorage<Record<string, TrashItem[]>>(STORAGE_KEYS.TRASH, {});
    const items = all[shopId] || [];
    const target = items.find((t) => t.id === trashId);
    if (!target) return false;

    if (target.itemType === 'invoice') {
      const invoices = this.getInvoices(shopId);
      const original = invoices.find((inv) => inv.id === target.data.id);
      if (original) {
        original.isSoftDeleted = false;
        original.deletedAt = undefined;
        this.saveShopInvoices(shopId, invoices);
      }
    } else if (target.itemType === 'product') {
      const inventory = this.getInventory(shopId);
      const original = inventory.find((p) => p.id === target.data.id);
      if (original) {
        original.isSoftDeleted = false;
        original.deletedAt = undefined;
        this.saveShopInventory(shopId, inventory);
      }
    }

    all[shopId] = items.filter((t) => t.id !== trashId);
    setStorage(STORAGE_KEYS.TRASH, all);
    if (firestoreSync.isFirebaseActive()) {
      void firestoreSync.syncAuxiliaryData(shopId, 'trash', all[shopId]);
    }
    return true;
  },

  // SIZE EXCHANGES
  getSizeExchanges(shopId: string): SizeExchangeRecord[] {
    const all = getStorage<Record<string, SizeExchangeRecord[]>>(STORAGE_KEYS.SIZE_EXCHANGES, {});
    return all[shopId] || [];
  },

  addSizeExchange(exchange: SizeExchangeRecord) {
    const all = getStorage<Record<string, SizeExchangeRecord[]>>(STORAGE_KEYS.SIZE_EXCHANGES, {});
    if (!all[exchange.shopId]) all[exchange.shopId] = [];
    all[exchange.shopId].unshift(exchange);
    setStorage(STORAGE_KEYS.SIZE_EXCHANGES, all);
    if (firestoreSync.isFirebaseActive()) {
      void firestoreSync.syncAuxiliaryData(exchange.shopId, 'sizeExchanges', all[exchange.shopId]);
    }

    if (exchange.priceDifference !== 0) {
      // Determine actual amount exchanged in drawer
      let transAmount = Math.abs(exchange.priceDifference);
      if (exchange.priceDifference > 0 && exchange.paymentMode === 'partial' && exchange.paidAmount !== undefined) {
        transAmount = exchange.paidAmount;
      }

      if (transAmount > 0) {
        this.addDrawerTransaction({
          id: `dtx_exch_${Date.now()}`,
          shopId: exchange.shopId,
          type: 'adjustment',
          drawer: exchange.channelUsed,
          amount: transAmount,
          direction: exchange.priceDifference > 0 ? 'in' : 'out',
          referenceId: exchange.originalInvoiceId,
          note: `Size Exchange: Return ${exchange.returnedItem.title} (${exchange.returnedItem.size}) -> Issue ${exchange.replacementItem.title} (${exchange.replacementItem.size})${
            exchange.dueAmount ? ` [Partial Paid: ৳${exchange.paidAmount}, Due: ৳${exchange.dueAmount}]` : ''
          }`,
          timestamp: new Date().toISOString(),
          salesmanName: exchange.salesmanName,
        });
      }
    }
  },

  // MONTHLY STOCK AUDIT (COGS & NET PROFIT)
  getMonthlyAudits(shopId: string): MonthlyStockAudit[] {
    const all = getStorage<Record<string, MonthlyStockAudit[]>>(STORAGE_KEYS.MONTHLY_AUDITS, {});
    return all[shopId] || [];
  },

  saveMonthlyAudit(audit: MonthlyStockAudit) {
    const all = getStorage<Record<string, MonthlyStockAudit[]>>(STORAGE_KEYS.MONTHLY_AUDITS, {});
    if (!all[audit.shopId]) all[audit.shopId] = [];
    all[audit.shopId].unshift(audit);
    setStorage(STORAGE_KEYS.MONTHLY_AUDITS, all);
    if (firestoreSync.isFirebaseActive()) {
      void firestoreSync.syncAuxiliaryData(audit.shopId, 'monthlyAudits', all[audit.shopId]);
    }
  },

  // STEADFAST PARCEL AI ENTRY
  getSteadfastParcels(shopId: string): SteadfastParcelData[] {
    const all = getStorage<Record<string, SteadfastParcelData[]>>(STORAGE_KEYS.STEADFAST_PARCELS, {});
    return all[shopId] || [];
  },

  addSteadfastParcel(parcel: SteadfastParcelData) {
    const all = getStorage<Record<string, SteadfastParcelData[]>>(STORAGE_KEYS.STEADFAST_PARCELS, {});
    if (!all[parcel.shopId]) all[parcel.shopId] = [];
    all[parcel.shopId].unshift(parcel);
    setStorage(STORAGE_KEYS.STEADFAST_PARCELS, all);
    if (firestoreSync.isFirebaseActive()) {
      void firestoreSync.syncAuxiliaryData(parcel.shopId, 'steadfastParcels', all[parcel.shopId]);
    }
  },

  // KIT CATEGORIES & PRICING (Role-Aware Cost Sanitization & Cost Preservation)
  getRawKitCategoriesInternal(shopId: string): KitCategorySetting[] {
    const defaultCategories: KitCategorySetting[] = [
      { id: 'kit_1', name: 'Player Issue (Master Copy)', defaultMrp: 1450, defaultCostPrice: 720, defaultBottomPrice: 1200 },
      { id: 'kit_2', name: 'Fan Issue Standard', defaultMrp: 950, defaultCostPrice: 480, defaultBottomPrice: 800 },
      { id: 'kit_3', name: 'Player Edition (BEY Special)', defaultMrp: 1650, defaultCostPrice: 850, defaultBottomPrice: 1400 },
      { id: 'kit_4', name: 'Fan Version', defaultMrp: 900, defaultCostPrice: 450, defaultBottomPrice: 750 },
      { id: 'kit_5', name: 'Retro Vintage Kit', defaultMrp: 1350, defaultCostPrice: 680, defaultBottomPrice: 1100 },
      { id: 'kit_6', name: 'Retro', defaultMrp: 1250, defaultCostPrice: 620, defaultBottomPrice: 1000 },
      { id: 'kit_7', name: 'Replica', defaultMrp: 750, defaultCostPrice: 380, defaultBottomPrice: 600 },
      { id: 'kit_8', name: 'BD Premium Edition', defaultMrp: 1100, defaultCostPrice: 550, defaultBottomPrice: 900 },
    ];
    const all = getStorage<Record<string, KitCategorySetting[]>>(STORAGE_KEYS.KIT_CATEGORIES, {
      [shopId]: defaultCategories,
    });
    return all[shopId] || defaultCategories;
  },

  getKitCategories(shopId: string, role?: UserRole): KitCategorySetting[] {
    const effectiveRole = this.getEffectiveRole(role);
    const raw = this.getRawKitCategoriesInternal(shopId);
    return sanitizeCategoryListForRole(raw, effectiveRole);
  },

  saveKitCategories(shopId: string, categories: KitCategorySetting[], role?: UserRole) {
    const effectiveRole = this.getEffectiveRole(role);
    const existingRaw = this.getRawKitCategoriesInternal(shopId);
    const vault = this.getPrivateCostVault(shopId);
    const preserved = preserveCategoryCosts(
      categories,
      existingRaw,
      effectiveRole,
      vault.categoryCosts
    );

    const all = getStorage<Record<string, KitCategorySetting[]>>(STORAGE_KEYS.KIT_CATEGORIES, {});
    all[shopId] = preserved;
    setStorage(STORAGE_KEYS.KIT_CATEGORIES, all);

    if (canViewBuyingPrice(effectiveRole)) {
      const catCostMap: Record<string, number> = {};
      for (const c of preserved) {
        if (c.defaultCostPrice > 0) {
          catCostMap[c.id] = c.defaultCostPrice;
          catCostMap[c.name] = c.defaultCostPrice;
        }
      }
      this.savePrivateCostVault(shopId, {}, catCostMap);
    }

    if (firestoreSync.isFirebaseActive()) {
      void firestoreSync.syncAuxiliaryData(shopId, 'kitCategories', preserved);
    }
  },

  // OTHERS CATEGORIES & PRICING (Role-Aware Cost Sanitization & Cost Preservation)
  getRawOtherCategoriesInternal(shopId: string): OtherProductCategorySetting[] {
    const defaultCategories: OtherProductCategorySetting[] = [
      { id: 'oth_1', name: 'Football Socks (ফুটবল মোজা)', defaultMrp: 180, defaultCostPrice: 90 },
      { id: 'oth_2', name: 'Shorts (শর্টস)', defaultMrp: 350, defaultCostPrice: 190 },
      { id: 'oth_3', name: 'Cap / Hat (হ্যাট/ক্যাপ)', defaultMrp: 300, defaultCostPrice: 150 },
      { id: 'oth_4', name: 'Wristband / Band (রিস্টব্যান্ড)', defaultMrp: 120, defaultCostPrice: 50 },
      { id: 'oth_5', name: 'Supporter Flag (পতাকা/মাফলার)', defaultMrp: 250, defaultCostPrice: 110 },
      { id: 'oth_6', name: 'Mini Trophy / Keyring (স্মারক ট্রফি/কী-রিং)', defaultMrp: 220, defaultCostPrice: 100 },
    ];
    const all = getStorage<Record<string, OtherProductCategorySetting[]>>(STORAGE_KEYS.OTHER_CATEGORIES, {
      [shopId]: defaultCategories,
    });
    return all[shopId] || defaultCategories;
  },

  getOtherCategories(shopId: string, role?: UserRole): OtherProductCategorySetting[] {
    const effectiveRole = this.getEffectiveRole(role);
    const raw = this.getRawOtherCategoriesInternal(shopId);
    return sanitizeCategoryListForRole(raw, effectiveRole);
  },

  saveOtherCategories(shopId: string, categories: OtherProductCategorySetting[], role?: UserRole) {
    const effectiveRole = this.getEffectiveRole(role);
    const existingRaw = this.getRawOtherCategoriesInternal(shopId);
    const vault = this.getPrivateCostVault(shopId);
    const preserved = preserveCategoryCosts(
      categories,
      existingRaw,
      effectiveRole,
      vault.categoryCosts
    );

    const all = getStorage<Record<string, OtherProductCategorySetting[]>>(STORAGE_KEYS.OTHER_CATEGORIES, {});
    all[shopId] = preserved;
    setStorage(STORAGE_KEYS.OTHER_CATEGORIES, all);

    if (canViewBuyingPrice(effectiveRole)) {
      const catCostMap: Record<string, number> = {};
      for (const c of preserved) {
        if (c.defaultCostPrice > 0) {
          catCostMap[c.id] = c.defaultCostPrice;
          catCostMap[c.name] = c.defaultCostPrice;
        }
      }
      this.savePrivateCostVault(shopId, {}, catCostMap);
    }

    if (firestoreSync.isFirebaseActive()) {
      void firestoreSync.syncAuxiliaryData(shopId, 'otherCategories', preserved);
    }
  },

  // MEN'S CLOTHING CATEGORIES & PRICING (Exclusive to Clothing Sector)
  getDefaultClothingCategories(): ClothingCategorySetting[] {
    return [
      {
        id: 'cloth_cat_tshirt',
        name: 'T-Shirt',
        bengaliName: 'টি-শার্ট (Drop-Shoulder / Crew Neck)',
        apparelScale: 'shirts_tops',
        defaultMrp: 650,
        defaultCostPrice: 260,
        defaultBottomPrice: 500,
        defaultSizes: ['S', 'M', 'L', 'XL', 'XXL'],
        isDefault: true,
      },
      {
        id: 'cloth_cat_polo',
        name: 'Polo Shirt',
        bengaliName: 'পোলো শার্ট (Pique / Collar)',
        apparelScale: 'shirts_tops',
        defaultMrp: 950,
        defaultCostPrice: 400,
        defaultBottomPrice: 780,
        defaultSizes: ['S', 'M', 'L', 'XL', 'XXL'],
        isDefault: true,
      },
      {
        id: 'cloth_cat_shirt',
        name: 'Shirt',
        bengaliName: 'শার্ট (Casual / Formal / Linen)',
        apparelScale: 'shirts_tops',
        defaultMrp: 1250,
        defaultCostPrice: 520,
        defaultBottomPrice: 980,
        defaultSizes: ['S', 'M', 'L', 'XL', 'XXL'],
        isDefault: true,
      },
      {
        id: 'cloth_cat_pant',
        name: 'Pant / Trouser',
        bengaliName: 'প্যান্ট / ট্রাউজার (Chino / Formal / Gabardine)',
        apparelScale: 'denim_pants',
        defaultMrp: 1350,
        defaultCostPrice: 560,
        defaultBottomPrice: 1100,
        defaultSizes: ['28-Reg', '30-Reg', '32-Reg', '34-Reg', '36-Reg', '38-Reg'],
        isDefault: true,
      },
      {
        id: 'cloth_cat_jeans',
        name: 'Jeans',
        bengaliName: 'জিন্স প্যান্ট (Slim / Stretch Denim)',
        apparelScale: 'denim_pants',
        defaultMrp: 1650,
        defaultCostPrice: 680,
        defaultBottomPrice: 1350,
        defaultSizes: ['28-Reg', '30-Reg', '32-Reg', '34-Reg', '36-Reg', '38-Long'],
        isDefault: true,
      },
      {
        id: 'cloth_cat_shorts',
        name: 'Shorts',
        bengaliName: 'শর্টস (Cargo / Chino / Cotton Shorts)',
        apparelScale: 'denim_pants',
        defaultMrp: 650,
        defaultCostPrice: 280,
        defaultBottomPrice: 520,
        defaultSizes: ['M', 'L', 'XL', 'XXL', '30-Reg', '32-Reg', '34-Reg'],
        isDefault: true,
      },
      {
        id: 'cloth_cat_panjabi',
        name: 'Panjabi',
        bengaliName: 'পাঞ্জাবি (Festive / Semi-Fit / Cotton)',
        apparelScale: 'panjabi',
        defaultMrp: 2250,
        defaultCostPrice: 920,
        defaultBottomPrice: 1800,
        defaultSizes: ['38', '40', '42', '44', '46'],
        isDefault: true,
      },
      {
        id: 'cloth_cat_hoodie',
        name: 'Hoodie',
        bengaliName: 'হুডি (Winter Fleece Pullover / Zip)',
        apparelScale: 'shirts_tops',
        defaultMrp: 1550,
        defaultCostPrice: 680,
        defaultBottomPrice: 1250,
        defaultSizes: ['M', 'L', 'XL', 'XXL'],
        isDefault: true,
      },
      {
        id: 'cloth_cat_sweatshirt',
        name: 'Sweatshirt',
        bengaliName: 'সোয়েটশার্ট (Crewneck Winter)',
        apparelScale: 'shirts_tops',
        defaultMrp: 1250,
        defaultCostPrice: 540,
        defaultBottomPrice: 1000,
        defaultSizes: ['M', 'L', 'XL', 'XXL'],
        isDefault: true,
      },
      {
        id: 'cloth_cat_jacket',
        name: 'Jacket',
        bengaliName: 'জ্যাকেট (Denim / Bomber / Puffer)',
        apparelScale: 'shirts_tops',
        defaultMrp: 2450,
        defaultCostPrice: 1100,
        defaultBottomPrice: 1950,
        defaultSizes: ['M', 'L', 'XL', 'XXL'],
        isDefault: true,
      },
      {
        id: 'cloth_cat_sweater',
        name: 'Sweater',
        bengaliName: 'সোয়েটার (Knitted / Cardigan)',
        apparelScale: 'shirts_tops',
        defaultMrp: 1450,
        defaultCostPrice: 620,
        defaultBottomPrice: 1150,
        defaultSizes: ['M', 'L', 'XL', 'XXL'],
        isDefault: true,
      },
      {
        id: 'cloth_cat_tracksuit',
        name: 'Tracksuit',
        bengaliName: 'ট্র্যাকসুট / জগার্স সেট',
        apparelScale: 'shirts_tops',
        defaultMrp: 1850,
        defaultCostPrice: 820,
        defaultBottomPrice: 1500,
        defaultSizes: ['M', 'L', 'XL', 'XXL'],
        isDefault: true,
      },
      {
        id: 'cloth_cat_other',
        name: "Other Men's Clothing",
        bengaliName: 'অন্যান্য মেনস পোশাক (Waistcoat / Pajama / Belt)',
        apparelScale: 'shirts_tops',
        defaultMrp: 850,
        defaultCostPrice: 380,
        defaultBottomPrice: 680,
        defaultSizes: ['S', 'M', 'L', 'XL', 'XXL', 'Free Size'],
        isDefault: true,
      },
    ];
  },

  getRawClothingCategoriesInternal(shopId: string): ClothingCategorySetting[] {
    const defaults = this.getDefaultClothingCategories();
    const tenant = this.getTenantById(shopId);
    const all = getStorage<Record<string, ClothingCategorySetting[]>>(STORAGE_KEYS.CLOTHING_CATEGORIES, {});
    const rawList = all[shopId] || tenant?.clothingCategories || defaults;

    // Deduplicate by normalized category name while preserving order and custom edits
    const seen = new Set<string>();
    const deduped: ClothingCategorySetting[] = [];
    for (const item of rawList) {
      if (!item || !item.name) continue;
      const key = item.name.trim().toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      deduped.push(item);
    }

    // Ensure all 13 core Men's Clothing categories exist if the store hasn't customized/saved yet
    if (!all[shopId] && !tenant?.clothingCategories) {
      for (const def of defaults) {
        const key = def.name.trim().toLowerCase();
        if (!seen.has(key)) {
          seen.add(key);
          deduped.push(def);
        }
      }
    }

    return deduped;
  },

  getClothingCategories(shopId: string, role?: UserRole): ClothingCategorySetting[] {
    const effectiveRole = this.getEffectiveRole(role);
    const raw = this.getRawClothingCategoriesInternal(shopId);
    return sanitizeCategoryListForRole(raw, effectiveRole);
  },

  saveClothingCategories(shopId: string, categories: ClothingCategorySetting[], role?: UserRole) {
    const effectiveRole = this.getEffectiveRole(role);
    const existingRaw = this.getRawClothingCategoriesInternal(shopId);
    const vault = this.getPrivateCostVault(shopId);
    const preserved = preserveCategoryCosts(
      categories,
      existingRaw,
      effectiveRole,
      vault.categoryCosts
    );

    const seen = new Set<string>();
    const deduped: ClothingCategorySetting[] = [];
    for (const item of preserved) {
      if (!item || !item.name) continue;
      const key = item.name.trim().toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      deduped.push(item);
    }

    const all = getStorage<Record<string, ClothingCategorySetting[]>>(STORAGE_KEYS.CLOTHING_CATEGORIES, {});
    all[shopId] = deduped;
    setStorage(STORAGE_KEYS.CLOTHING_CATEGORIES, all);
    this.updateTenant(shopId, { clothingCategories: deduped });

    if (canViewBuyingPrice(effectiveRole)) {
      const catCostMap: Record<string, number> = {};
      for (const c of deduped) {
        if (c.defaultCostPrice > 0) {
          catCostMap[c.id] = c.defaultCostPrice;
          catCostMap[c.name] = c.defaultCostPrice;
        }
      }
      this.savePrivateCostVault(shopId, {}, catCostMap);
    }

    if (firestoreSync.isFirebaseActive()) {
      void firestoreSync.syncAuxiliaryData(shopId, 'clothingCategories', deduped);
    }
  },

  canDeleteClothingCategory(shopId: string, categoryName: string): { canDelete: boolean; usageCount: number; reason?: string } {
    const clean = categoryName.trim().toLowerCase();
    const inventory = this.getInventory(shopId);
    const invoices = this.getInvoices(shopId);

    let usageCount = 0;
    for (const item of inventory) {
      if (
        (item.clothingCategory && item.clothingCategory.trim().toLowerCase() === clean) ||
        (item.subCategory && item.subCategory.trim().toLowerCase() === clean) ||
        (item.name && item.name.toLowerCase().includes(clean))
      ) {
        usageCount++;
      }
    }
    for (const inv of invoices) {
      for (const line of inv.items || []) {
        if (
          (line.title && line.title.toLowerCase().includes(clean)) ||
          (line.subDetail && line.subDetail.toLowerCase().includes(clean))
        ) {
          usageCount++;
        }
      }
    }

    if (usageCount > 0) {
      return {
        canDelete: false,
        usageCount,
        reason: `This clothing category is used in ${usageCount} product/invoice record(s). Rename it instead so historical records stay intact.`,
      };
    }
    return { canDelete: true, usageCount: 0 };
  },

  // STANDALONE FONT ORDERS (শুধু ফন্ট অর্ডার)
  getFontOrders(shopId: string): StandaloneFontOrder[] {
    const tenant = this.getTenantById(shopId);
    if (tenant && isClothingShop(tenant)) {
      return [];
    }
    const defaultOrders: StandaloneFontOrder[] = [
      {
        id: 'font_ord_1',
        shopId: 'shop_galleria_sports',
        teamOrKit: 'Brasil Home 2026',
        colorOrVersion: 'Green',
        customName: 'NEYMAR JR',
        customNumber: '10',
        fontStyle: 'Official Cut Vinyl',
        badgeOrPatch: 'FIFA World Champions',
        quantity: 5,
        unitPrice: 200,
        unitCostPrice: 80,
        notes: 'Heat press font batch for store counter',
        status: 'pending',
        customerName: 'Internal Shop Stock',
        customerPhone: '01711223344',
        createdAt: new Date().toISOString(),
      },
      {
        id: 'font_ord_2',
        shopId: 'shop_galleria_sports',
        teamOrKit: 'Real Madrid Home 24/25',
        colorOrVersion: 'Black/Gold',
        customName: 'MBAPPE',
        customNumber: '9',
        fontStyle: 'La Liga Font',
        badgeOrPatch: 'UCL 15 Badges',
        quantity: 8,
        unitPrice: 250,
        unitCostPrice: 95,
        notes: 'Counter stock font printing',
        status: 'printed',
        customerName: 'Shop Counter Stock',
        customerPhone: '01711223344',
        createdAt: new Date(Date.now() - 86400000).toISOString(),
      },
    ];
    const all = getStorage<Record<string, StandaloneFontOrder[]>>(STORAGE_KEYS.FONT_ORDERS, {
      shop_galleria_sports: defaultOrders,
    });
    if (all[shopId]) {
      return all[shopId];
    }
    return shopId === 'shop_galleria_sports' ? defaultOrders : [];
  },

  addFontOrder(shopId: string, order: StandaloneFontOrder) {
    const tenant = this.getTenantById(shopId);
    if (tenant && isClothingShop(tenant)) {
      throw new Error('Standalone DTF font orders are only available for Sportswear merchants.');
    }
    const all = getStorage<Record<string, StandaloneFontOrder[]>>(STORAGE_KEYS.FONT_ORDERS, {});
    if (!all[shopId]) all[shopId] = [];
    all[shopId].unshift(order);
    setStorage(STORAGE_KEYS.FONT_ORDERS, all);
    if (firestoreSync.isFirebaseActive()) {
      void firestoreSync.syncAuxiliaryData(shopId, 'fontOrders', all[shopId]);
    }
  },

  updateFontOrderStatus(shopId: string, orderId: string, status: StandaloneFontOrder['status']) {
    const all = getStorage<Record<string, StandaloneFontOrder[]>>(STORAGE_KEYS.FONT_ORDERS, {});
    const orders = all[shopId] || [];
    const ord = orders.find((o) => o.id === orderId);
    if (ord) {
      ord.status = status;
      setStorage(STORAGE_KEYS.FONT_ORDERS, all);
      if (firestoreSync.isFirebaseActive()) {
        void firestoreSync.syncAuxiliaryData(shopId, 'fontOrders', all[shopId] || []);
      }
    }
  },

  deleteFontOrder(shopId: string, orderId: string) {
    const all = getStorage<Record<string, StandaloneFontOrder[]>>(STORAGE_KEYS.FONT_ORDERS, {});
    if (all[shopId]) {
      all[shopId] = all[shopId].filter((o) => o.id !== orderId);
      setStorage(STORAGE_KEYS.FONT_ORDERS, all);
      if (firestoreSync.isFirebaseActive()) {
        void firestoreSync.syncAuxiliaryData(shopId, 'fontOrders', all[shopId]);
      }
    }
  },

  // DUE PAYMENT RECOVERY (বকেয়া আদায়)
  payInvoiceDue(
    shopId: string,
    invoiceId: string,
    amountPaid: number,
    drawer: DrawerType,
    salesmanName?: string
  ): { success: boolean; invoice?: Invoice; message?: string } {
    const invoices = this.getInvoices(shopId);
    const invoice = invoices.find((inv) => inv.id === invoiceId);
    if (!invoice) {
      return { success: false, message: 'ইনভয়েস পাওয়া যায়নি' };
    }

    if (amountPaid <= 0) {
      return { success: false, message: 'টাকার পরিমাণ শূন্য বা নেগেটিভ হতে পারে না' };
    }

    const previousDue = invoice.dueAmount || 0;
    const actualPay = Math.min(amountPaid, previousDue);
    const remainingDue = Math.max(0, previousDue - actualPay);

    invoice.advancePaid = (invoice.advancePaid || 0) + actualPay;
    invoice.paidAmount = invoice.advancePaid;
    invoice.dueAmount = remainingDue;

    if (remainingDue === 0) {
      invoice.status = 'completed';
      invoice.dueClearedAt = new Date().toISOString();
      invoice.dueClearedChannel = drawer;
    } else {
      invoice.status = 'partial_due';
    }

    this.saveShopInvoices(shopId, invoices);

    // Record drawer transaction (which also auto-deposits into drawer balance)
    this.addDrawerTransaction({
      id: `trx_due_${Date.now()}`,
      shopId,
      type: 'due_recovery',
      drawer,
      amount: actualPay,
      direction: 'in',
      referenceId: invoice.id,
      note: `Due Recovery: ${invoice.customerName} paid ৳${actualPay} for Inv #${invoice.invoiceNo} (Remaining Due: ৳${remainingDue})`,
      timestamp: new Date().toISOString(),
      salesmanName: salesmanName || 'Cashier',
    });

    return { success: true, invoice, message: `৳${actualPay} বকেয়া সফলভাবে জমা নেওয়া হয়েছে!` };
  },

  // ==========================================
  // STORE CONFIGURATION & CUSTOM CATEGORIES
  // ==========================================
  getDefaultStoreConfig(): StoreConfiguration {
    return {
      customClubs: [
        'Argentina',
        'Brazil',
        'Real Madrid',
        'Barcelona',
        'Manchester United',
        'Arsenal',
        'Liverpool',
        'Manchester City',
        'Inter Miami',
        'Al Nassr',
        'Bangladesh',
        'Bashundhara Kings',
        'AC Milan',
        'Bayern Munich',
        'PSG',
        'Portugal',
      ],
      availableSizes: ['S', 'M', 'L', 'XL', 'XXL', '3XL', '4XL', 'Custom'],
      defaultUnit: 'Piece (পিস)',
      availableUnits: ['Piece (পিস)', 'Set (সেট)', 'Pair (জোড়া)', 'Pack (প্যাক)', 'Dozen (ডজন)'],

      hideCostPriceFromStaff: true,
      enforceBottomPriceLock: true,
      defaultMarkupPercentage: 85,
      maxStaffDiscountPercent: 15,
      defaultCustomNameNumberCost: 85,
      defaultCustomNameNumberPrice: 250,
      defaultPatchCost: 35,
      defaultPatchPrice: 120,
      defaultSponsorCost: 50,
      defaultSponsorPrice: 150,
      defaultAlterationCost: 40,
      defaultAlterationPrice: 100,

      defaultPosSection: 'kit',
      defaultWalkInName: 'Walk-in Customer',
      requireCustomerPhoneOnDue: true,
      autoFocusBarcodeSearch: true,
      enableQuickDiscountButtons: true,
      enableHoldOrder: true,

      lowStockThreshold: 5,
      deadStockDays: 60,
      inventoryTrackingEnabled: true,
      autoDeductStockOnConfirm: true,
      autoRestockOnExchange: true,
      allowOutOfStockSelling: false,
      trashRetentionDays: 30,

      customerTiers: ['Regular', 'VIP', 'Wholesale / Reseller', 'Club / Corporate'],
      defaultCreditLimit: 10000,
      dueReminderDays: 7,
      whatsappDueTemplate:
        'প্রিয় {customerName}, {shopName} এ আপনার পূর্বের বকেয়া ৳{dueAmount} (ইনভয়েস #{invoiceNo}) পরিশোধের জন্য বিনীত অনুরোধ করা হচ্ছে। ধন্যবাদ!',

      enabledPaymentMethods: {
        cash: true,
        merchantBkash: true,
        personalBkash: true,
        nagad: true,
        bank: true,
      },
      defaultPaymentMethod: 'cash',
      defaultTransactionFilter: 'today',

      exchangeWindowDays: 3,
      allowCustomPrintedExchange: false,
      allowAlteredItemExchange: false,
      requireReceiptForExchange: true,
      allowCashRefundOnExchange: false,

      drawerLabels: {
        cash: 'Cash Drawer (ক্যাশ)',
        merchantBkash: 'bKash Merchant',
        personalBkash: 'bKash Personal',
        nagad: 'Nagad Personal',
        bank: 'Bank Account',
      },
      requireOwnerPasswordForWithdrawal: true,
      defaultOpeningCashFloat: 5000,
      requireCountBeforeZReport: true,

      defaultExpenseDrawer: 'cash',
      requireNoteForExpenseAbove: 500,

      dtfVendorWhatsapp: '',
      fontStyles: [
        'UCL Official Font',
        'EPL Official Font',
        'La Liga Official Font',
        'World Cup 2026 Font',
        'Serie A Official Font',
        'Custom Club Font',
        'Golden 3D Silicone',
        'Retro Flock / Velvet',
      ],
      availablePatches: [
        'UCL Starball + 15 Badge',
        'EPL Gold Lion Patch',
        'FIFA World Champions Badge',
        'La Liga Official Patch',
        'Copa America Winners Patch',
        'UEFA Foundation + Respect',
        'BPL / Local Tournament Patch',
      ],
      defaultStandaloneFontPrice: 200,
      defaultStandaloneFontCost: 80,

      currencySymbol: '৳',
      dateFormat: 'DD/MM/YYYY',
      compactPosMode: false,
      soundEffectsEnabled: true,
      loyaltySettings: getDefaultLoyaltySettings(),
    };
  },

  getStoreConfig(shopId: string): StoreConfiguration {
    const defaults = this.getDefaultStoreConfig();
    const tenant = this.getTenantById(shopId);
    const saved = tenant?.storeConfig || {};
    const clothingStore = tenant ? isClothingShop(tenant) : false;

    const clothingDefaultBrands = [
      'In-House Brand',
      'Export Surplus',
      'Richman',
      'Sailor',
      'Yellow',
      'Twelve Clothing',
      'Easy Fashion',
      'Illiyeen',
      'Gentle Park',
      'Freeland',
    ];
    const clothingDefaultSizes = [
      'S',
      'M',
      'L',
      'XL',
      'XXL',
      '28-Reg',
      '30-Reg',
      '32-Reg',
      '34-Reg',
      '36-Reg',
      '38-Reg',
      '38',
      '40',
      '42',
      '44',
      '46',
    ];

    return {
      ...defaults,
      customClubs: clothingStore ? clothingDefaultBrands : defaults.customClubs,
      availableSizes: clothingStore ? clothingDefaultSizes : defaults.availableSizes,
      ...saved,
      enabledPaymentMethods: {
        ...defaults.enabledPaymentMethods!,
        ...(saved.enabledPaymentMethods || {}),
      },
      drawerLabels: {
        ...defaults.drawerLabels!,
        ...(saved.drawerLabels || {}),
      },
      loyaltySettings: {
        ...getDefaultLoyaltySettings(),
        ...(saved.loyaltySettings || {}),
        rewardTiers:
          saved.loyaltySettings?.rewardTiers && saved.loyaltySettings.rewardTiers.length > 0
            ? saved.loyaltySettings.rewardTiers
            : getDefaultLoyaltySettings().rewardTiers,
      },
    };
  },

  saveStoreConfig(shopId: string, partialConfig: Partial<StoreConfiguration>): StoreConfiguration {
    const current = this.getStoreConfig(shopId);
    const resolvedTracking =
      partialConfig.inventoryTrackingEnabled !== undefined
        ? partialConfig.inventoryTrackingEnabled
        : partialConfig.autoDeductStockOnConfirm !== undefined
        ? partialConfig.autoDeductStockOnConfirm
        : current.inventoryTrackingEnabled ?? current.autoDeductStockOnConfirm ?? true;

    const next: StoreConfiguration = {
      ...current,
      ...partialConfig,
      inventoryTrackingEnabled: resolvedTracking,
      autoDeductStockOnConfirm: resolvedTracking,
      enabledPaymentMethods: {
        ...current.enabledPaymentMethods!,
        ...(partialConfig.enabledPaymentMethods || {}),
      },
      drawerLabels: {
        ...current.drawerLabels!,
        ...(partialConfig.drawerLabels || {}),
      },
      loyaltySettings: partialConfig.loyaltySettings
        ? {
            ...(current.loyaltySettings || getDefaultLoyaltySettings()),
            ...partialConfig.loyaltySettings,
          }
        : current.loyaltySettings,
    };
    this.updateTenant(shopId, { storeConfig: next });
    return next;
  },

  isInventoryTrackingEnabled(shopId: string): boolean {
    const cfg = this.getStoreConfig(shopId);
    return cfg.inventoryTrackingEnabled !== false && cfg.autoDeductStockOnConfirm !== false;
  },

  setInventoryTrackingEnabled(
    shopId: string,
    enabled: boolean,
    role?: UserRole
  ): StoreConfiguration {
    const activeRole: UserRole = role || 'shop_owner';
    if (!canViewBuyingPrice(activeRole)) {
      throw new Error('শুধুমাত্র শপ ওনার (Owner) ইনভেন্টরি ট্র্যাকিং চালু বা বন্ধ করতে পারবেন।');
    }
    return this.saveStoreConfig(shopId, {
      inventoryTrackingEnabled: Boolean(enabled),
      autoDeductStockOnConfirm: Boolean(enabled),
    });
  },

  getDefaultExpenseCategories(): ExpenseCategorySetting[] {
    return [
      { id: 'food', name: 'food', label: 'Staff Snacks & Tea', bnLabel: 'নাস্তা ও চা', color: 'amber', isDefault: true },
      { id: 'transport', name: 'transport', label: 'Courier & Transport', bnLabel: 'যাতায়াত ও কুরিয়ার', color: 'blue', isDefault: true },
      { id: 'tailoring', name: 'tailoring', label: 'DTF Print & Tailoring', bnLabel: 'প্রিন্ট ও অল্টার খরচ', color: 'purple', isDefault: true },
      { id: 'packaging', name: 'packaging', label: 'Poly, Bag & Tags', bnLabel: 'প্যাকেজিং ও ব্যাগ', color: 'emerald', isDefault: true },
      { id: 'utility', name: 'utility', label: 'Electricity, WiFi & Service', bnLabel: 'বিদ্যুৎ, ওয়াইফাই ও সার্ভিস', color: 'cyan', isDefault: true },
      { id: 'salary', name: 'salary', label: 'Staff Salary / Commission', bnLabel: 'স্টাফ বেতন/কমিশন', color: 'indigo', isDefault: true },
      { id: 'rent', name: 'rent', label: 'Shop Rent & Advance', bnLabel: 'দোকান ভাড়া', color: 'rose', isDefault: true },
      { id: 'other', name: 'other', label: 'Misc / Other Expenses', bnLabel: 'অন্যান্য খরচ', color: 'slate', isDefault: true },
    ];
  },

  getExpenseCategories(shopId: string): ExpenseCategorySetting[] {
    const tenant = this.getTenantById(shopId);
    if (tenant?.expenseCategories && tenant.expenseCategories.length > 0) {
      return tenant.expenseCategories;
    }
    return this.getDefaultExpenseCategories();
  },

  saveExpenseCategories(shopId: string, categories: ExpenseCategorySetting[]): void {
    this.updateTenant(shopId, { expenseCategories: categories });
  },

  canDeleteKitCategory(shopId: string, categoryName: string): { canDelete: boolean; usageCount: number; reason?: string } {
    const clean = categoryName.trim().toLowerCase();
    const inventory = this.getInventory(shopId);
    const invoices = this.getInvoices(shopId);

    let usageCount = 0;
    for (const item of inventory) {
      if (
        (item.subCategory && item.subCategory.trim().toLowerCase() === clean) ||
        (item.name && item.name.toLowerCase().includes(clean))
      ) {
        usageCount++;
      }
    }
    for (const inv of invoices) {
      for (const line of inv.items || []) {
        if (line.title && line.title.toLowerCase().includes(clean)) {
          usageCount++;
        }
      }
    }

    if (usageCount > 0) {
      return {
        canDelete: false,
        usageCount,
        reason: `This category is used in ${usageCount} product/invoice record(s). Archive it or rename it instead so historical records stay intact.`,
      };
    }
    return { canDelete: true, usageCount: 0 };
  },

  canDeleteOtherCategory(shopId: string, categoryName: string): { canDelete: boolean; usageCount: number; reason?: string } {
    const clean = categoryName.trim().toLowerCase();
    const inventory = this.getInventory(shopId);
    const invoices = this.getInvoices(shopId);

    let usageCount = 0;
    for (const item of inventory) {
      if (
        (item.subCategory && item.subCategory.trim().toLowerCase() === clean) ||
        (item.name && item.name.toLowerCase().includes(clean))
      ) {
        usageCount++;
      }
    }
    for (const inv of invoices) {
      for (const line of inv.items || []) {
        if (line.title && line.title.toLowerCase().includes(clean)) {
          usageCount++;
        }
      }
    }

    if (usageCount > 0) {
      return {
        canDelete: false,
        usageCount,
        reason: `This category is referenced in ${usageCount} inventory/invoice record(s). Archive it instead to protect historical sales.`,
      };
    }
    return { canDelete: true, usageCount: 0 };
  },

  canDeleteExpenseCategory(shopId: string, categoryId: string): { canDelete: boolean; usageCount: number; reason?: string } {
    const clean = categoryId.trim().toLowerCase();
    const expenses = this.getExpenses(shopId);
    const usageCount = expenses.filter((e) => e.category.trim().toLowerCase() === clean).length;
    if (usageCount > 0) {
      return {
        canDelete: false,
        usageCount,
        reason: `This expense category has ${usageCount} recorded expense(s). You can edit its label or archive it without losing historical ledger records.`,
      };
    }
    return { canDelete: true, usageCount: 0 };
  },

  // ==========================================
  // PHASE 2: STOCK ADJUSTMENT LEDGER & VARIANT CORRECTION
  // ==========================================
  getStockAdjustments(shopId: string): StockAdjustmentRecord[] {
    const all = getStorage<Record<string, StockAdjustmentRecord[]>>(
      STORAGE_KEYS.STOCK_ADJUSTMENTS,
      {}
    );
    return (all[shopId] || []).filter((r) => r && r.shopId === shopId);
  },

  appendStockAdjustments(shopId: string, records: StockAdjustmentRecord[]) {
    if (!records || records.length === 0) return;
    const all = getStorage<Record<string, StockAdjustmentRecord[]>>(
      STORAGE_KEYS.STOCK_ADJUSTMENTS,
      {}
    );
    const current = all[shopId] || [];
    all[shopId] = [...records, ...current].slice(0, 500);
    setStorage(STORAGE_KEYS.STOCK_ADJUSTMENTS, all);
    if (firestoreSync.isFirebaseActive()) {
      void firestoreSync.syncAuxiliaryData(shopId, 'stockAdjustments', all[shopId]);
    }
  },

  correctVariantStock(params: {
    shopId: string;
    productId: string;
    size: string;
    color?: string;
    variantId?: string;
    newQty: number;
    reason: string;
    responsibleUser: string;
    userRole?: UserRole;
  }): { updatedItem: InventoryItem; adjustmentRecord: StockAdjustmentRecord } {
    const {
      shopId,
      productId,
      size,
      color,
      variantId,
      newQty,
      reason,
      responsibleUser,
      userRole,
    } = params;
    const effectiveRole = this.getEffectiveRole(userRole);
    const rawItems = this.getRawInventoryInternal(shopId);
    const targetItem = rawItems.find((p) => p.id === productId);
    if (!targetItem) {
      throw new Error('পণ্যটি ইনভেন্টরিতে পাওয়া যায়নি।');
    }

    const { updatedItem, adjustmentRecord } = applyManualStockCorrection({
      item: targetItem,
      size,
      color,
      variantId,
      newQty,
      reason,
      shopId,
      responsibleUser,
      userRole: effectiveRole,
    });

    this.saveInventoryItem(shopId, updatedItem, effectiveRole);
    this.appendStockAdjustments(shopId, [adjustmentRecord]);

    return {
      updatedItem: sanitizeInventoryItemForRole(updatedItem, effectiveRole),
      adjustmentRecord,
    };
  },

  // ==========================================
  // PHASE 3 & 4: SHOP-SCOPED CUSTOMERS & LOYALTY SYSTEM
  // ==========================================
  getCustomerProfiles(shopId: string): ShopCustomerProfile[] {
    const all = getStorage<Record<string, ShopCustomerProfile[]>>(
      STORAGE_KEYS.CUSTOMER_PROFILES,
      {}
    );
    return (all[shopId] || []).filter((p) => p && p.shopId === shopId);
  },

  saveCustomerProfiles(shopId: string, profiles: ShopCustomerProfile[]) {
    const all = getStorage<Record<string, ShopCustomerProfile[]>>(
      STORAGE_KEYS.CUSTOMER_PROFILES,
      {}
    );
    all[shopId] = profiles.filter((p) => p && p.shopId === shopId);
    setStorage(STORAGE_KEYS.CUSTOMER_PROFILES, all);
    if (firestoreSync.isFirebaseActive()) {
      void firestoreSync.syncAuxiliaryData(shopId, 'customerProfiles', all[shopId]);
    }
  },

  upsertShopCustomerProfile(
    shopId: string,
    phone: string,
    updates: Partial<ShopCustomerProfile>
  ): ShopCustomerProfile | null {
    const normalizedPhone = normalizeBdPhone(phone);
    if (!shopId || !normalizedPhone || normalizedPhone.length < 6) return null;
    const customerId = buildShopCustomerId(shopId, normalizedPhone);
    const profiles = this.getCustomerProfiles(shopId);
    const idx = profiles.findIndex(
      (p) => p.id === customerId || normalizeBdPhone(p.phone) === normalizedPhone
    );
    const now = new Date().toISOString();

    if (idx !== -1) {
      const existing = profiles[idx];
      const updated: ShopCustomerProfile = {
        ...existing,
        ...updates,
        id: customerId,
        shopId,
        phone: normalizedPhone,
        name: updates.name?.trim() || existing.name || 'Walk-in Customer',
        updatedAt: now,
      };
      profiles[idx] = updated;
      this.saveCustomerProfiles(shopId, profiles);
      return updated;
    }

    const created: ShopCustomerProfile = {
      id: customerId,
      shopId,
      phone: normalizedPhone,
      name: updates.name?.trim() || 'Walk-in Customer',
      loyaltyPoints: Math.max(0, Number(updates.loyaltyPoints) || 0),
      lifetimePointsEarned: Math.max(0, Number(updates.lifetimePointsEarned) || 0),
      lifetimePointsRedeemed: Math.max(0, Number(updates.lifetimePointsRedeemed) || 0),
      doNotContact: Boolean(updates.doNotContact),
      notes: updates.notes,
      createdAt: now,
      updatedAt: now,
      lastCampaignOpenedAt: updates.lastCampaignOpenedAt,
    };
    profiles.unshift(created);
    this.saveCustomerProfiles(shopId, profiles);
    return created;
  },

  toggleCustomerDoNotContact(
    shopId: string,
    phone: string,
    customerName?: string
  ): boolean {
    const normalizedPhone = normalizeBdPhone(phone);
    const profiles = this.getCustomerProfiles(shopId);
    const existing = profiles.find((p) => normalizeBdPhone(p.phone) === normalizedPhone);
    const nextValue = !existing?.doNotContact;
    this.upsertShopCustomerProfile(shopId, normalizedPhone, {
      name: customerName || existing?.name,
      doNotContact: nextValue,
    });
    return nextValue;
  },

  getLoyaltySettings(shopId: string): LoyaltySettings {
    const config = this.getStoreConfig(shopId);
    return config.loyaltySettings || getDefaultLoyaltySettings();
  },

  saveLoyaltySettings(
    shopId: string,
    settings: LoyaltySettings,
    role?: UserRole
  ): LoyaltySettings {
    const effectiveRole = this.getEffectiveRole(role);
    if (!canViewBuyingPrice(effectiveRole)) {
      throw new Error('শুধুমাত্র শপ ওনার (Owner) লয়্যালটি পয়েন্ট সেটিংস পরিবর্তন করতে পারবেন।');
    }
    const updatedConfig = this.saveStoreConfig(shopId, { loyaltySettings: settings });
    return updatedConfig.loyaltySettings || settings;
  },

  getLoyaltyTransactions(shopId: string): LoyaltyTransaction[] {
    const all = getStorage<Record<string, LoyaltyTransaction[]>>(
      STORAGE_KEYS.LOYALTY_TXS,
      {}
    );
    return (all[shopId] || []).filter((tx) => tx && tx.shopId === shopId);
  },

  saveLoyaltyTransactions(shopId: string, list: LoyaltyTransaction[]) {
    const all = getStorage<Record<string, LoyaltyTransaction[]>>(
      STORAGE_KEYS.LOYALTY_TXS,
      {}
    );
    all[shopId] = list.filter((tx) => tx && tx.shopId === shopId).slice(0, 1000);
    setStorage(STORAGE_KEYS.LOYALTY_TXS, all);
    if (firestoreSync.isFirebaseActive()) {
      void firestoreSync.syncAuxiliaryData(shopId, 'loyaltyTxs', all[shopId]);
    }
  },

  getShopCustomerHistory(shopId: string, phone: string, role?: UserRole): ShopCustomerSummary {
    const invoices = this.getInvoices(shopId, role);
    const loyaltyTransactions = this.getLoyaltyTransactions(shopId);
    const customerProfiles = this.getCustomerProfiles(shopId);
    return getShopCustomerSummary({
      shopId,
      phone,
      invoices,
      loyaltyTransactions,
      customerProfiles,
    });
  },

  // ==========================================
  // PHASE 6: FESTIVE OFFERS & INDIVIDUAL WHATSAPP MESSAGING
  // ==========================================
  getCampaignTemplates(shopId: string): CampaignTemplate[] {
    const tenant = this.getTenantById(shopId);
    const isClothing = tenant ? isClothingShop(tenant) : false;
    const defaults = getDefaultCampaignTemplates(shopId, isClothing);
    const all = getStorage<Record<string, CampaignTemplate[]>>(
      STORAGE_KEYS.CAMPAIGN_TEMPLATES,
      {}
    );
    const saved = (all[shopId] || []).filter((t) => t && t.shopId === shopId);
    if (saved.length > 0) return saved;
    return defaults;
  },

  saveCampaignTemplates(shopId: string, templates: CampaignTemplate[]) {
    const all = getStorage<Record<string, CampaignTemplate[]>>(
      STORAGE_KEYS.CAMPAIGN_TEMPLATES,
      {}
    );
    all[shopId] = templates.map((t) => ({ ...t, shopId }));
    setStorage(STORAGE_KEYS.CAMPAIGN_TEMPLATES, all);
    if (firestoreSync.isFirebaseActive()) {
      void firestoreSync.syncAuxiliaryData(shopId, 'campaignTemplates', all[shopId]);
    }
  },

  getCampaignLogs(shopId: string): CampaignOpenLog[] {
    const all = getStorage<Record<string, CampaignOpenLog[]>>(
      STORAGE_KEYS.CAMPAIGN_LOGS,
      {}
    );
    return (all[shopId] || []).filter((l) => l && l.shopId === shopId);
  },

  logIndividualCampaignOpen(params: {
    shopId: string;
    customerPhone: string;
    customerName: string;
    templateId: string;
    channel: 'whatsapp' | 'sms';
    openedBy: string;
  }): CampaignOpenLog {
    const log = createCampaignOpenLog(params);
    const all = getStorage<Record<string, CampaignOpenLog[]>>(
      STORAGE_KEYS.CAMPAIGN_LOGS,
      {}
    );
    const current = all[params.shopId] || [];
    all[params.shopId] = [log, ...current].slice(0, 300);
    setStorage(STORAGE_KEYS.CAMPAIGN_LOGS, all);
    this.upsertShopCustomerProfile(params.shopId, params.customerPhone, {
      name: params.customerName,
      lastCampaignOpenedAt: log.timestamp,
    });
    if (firestoreSync.isFirebaseActive()) {
      void firestoreSync.syncAuxiliaryData(params.shopId, 'campaignLogs', all[params.shopId]);
    }
    return log;
  },
};


