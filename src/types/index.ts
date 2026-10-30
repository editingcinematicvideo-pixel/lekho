export type ShopProfile = 'jersey' | 'clothing' | 'hybrid';

export type SubscriptionPlan = 'starter' | 'pro';

export type SubscriptionStatus = 'active' | 'grace' | 'expired' | 'pending';

export type UserRole = 'super_admin' | 'shop_owner' | 'manager' | 'salesman';

export interface FeatureFlags {
  jerseyCustomization: boolean;
  alterationTracker: boolean;
  teamBulkOrders: boolean;
  staffPins: boolean;
  multiDrawer: boolean;
  resellerCounter: boolean;
  offlinePos?: boolean;
  whatsAppReceipts?: boolean;
  blindProfitMode?: boolean;
  alterationTracking?: boolean;
}

export type OfficialShopCategory = 'CLOTHING' | 'SPORTS WEAR';

export interface StaffMember {
  id: string;
  shopId?: string;
  uid?: string;
  name: string;
  username?: string;
  pin: string; // Masked or empty in client responses; verified via pinHash
  pinHash?: string;
  pinSalt?: string;
  hasPinSet?: boolean;
  email?: string;
  passwordHash?: string;
  isEmailVerified?: boolean;
  status?: 'active' | 'pending_verification' | 'disabled';
  invitedAt?: string;
  verifiedAt?: string;
  role: 'owner' | 'manager' | 'salesman';
  commissionPerPiece: number; // in BDT
  phone: string;
  active: boolean;
  piecesSoldToday?: number;
  totalCommissionEarned?: number;
  permissions?: {
    canViewProfits?: boolean;
    canViewDrawers?: boolean;
    canAlterStock?: boolean;
    canGiveDiscount?: boolean;
  };
}

export interface AuthSession {
  token: string;
  uid?: string;
  userType: 'merchant' | 'staff';
  userId: string;
  email: string;
  name: string;
  phone?: string;
  shopId: string;
  shopName: string;
  category: ShopProfile;
  officialCategory: OfficialShopCategory;
  role: UserRole;
  isSuperAdminVerified?: boolean;
  authProvider?: 'firebase_email' | 'firebase_google' | 'local';
  staffPermissions?: StaffMember['permissions'];
  createdAt?: string;
  issuedAt?: string;
  expiresAt: string;
}

export interface OTPRecord {
  id: string;
  email: string;
  otpHashed: string;
  type: 'merchant_registration' | 'staff_invitation' | 'password_reset';
  expiresAt: number;
  attempts: number;
  resendCooldownUntil: number;
  metaData?: any;
}

export interface SubscriptionInfo {
  plan: SubscriptionPlan;
  status: SubscriptionStatus;
  amount?: number;
  monthlyFeeBdt?: number;
  trxId?: string;
  pendingTrxId?: string;
  senderPhone?: string;
  paymentMethod?: 'bkash' | 'nagad';
  submittedAt?: string;
  lastPaidAt?: string;
  expiresAt: string;
  graceEndsAt?: string;
  verifiedAt?: string;
  verifiedBy?: string;
}

export interface TenantShop {
  id: string;
  name: string;
  bengaliName?: string;
  slug?: string;
  ownerUid?: string;
  memberUids?: string[];
  memberRoles?: Record<string, 'shop_owner' | 'manager' | 'salesman'>;
  invitedStaffEmails?: string[];
  ownerName: string;
  ownerPhone: string;
  ownerPin?: string; // Legacy plaintext PIN (migrated to ownerPinHash on server)
  ownerPinHash?: string; // Cryptographic PBKDF2/SHA-256 hash
  ownerPinSalt?: string; // Per-tenant salt
  ownerPinConfigured?: boolean; // Whether PIN has been set up
  bottomPriceProtectionEnabled?: boolean; // Owner toggle (default true)
  ownerPinUpdatedAt?: string;
  ownerEmail?: string;
  ownerPasswordHash?: string;
  isEmailVerified?: boolean;
  accountStatus?: 'active' | 'pending_verification' | 'disabled';
  shopCategory?: OfficialShopCategory;
  shopCategoryType?: OfficialShopCategory;
  category: ShopProfile;
  marketMallName: string; // e.g. "Bashundhara City, Level 4", "Jamuna Future Park"
  shopNo: string;
  logoUrl?: string;
  returnPolicy: string;
  createdAt?: string;
  subscription: SubscriptionInfo;
  featureFlags: FeatureFlags;
  stats?: {
    totalSales: number;
    totalOrders: number;
    totalDueRecovered: number;
    gmv: number;
  };
  merchantId?: string;
  email?: string;
  facebookUrl?: string;
  websiteUrl?: string;
  coverPhoto?: string;
  paymentSettings?: {
    binNumber?: string;
    tradeLicenseNo?: string;
    bkashMerchant?: string;
    bkashPersonal?: string;
    nagad?: string;
    bankName?: string;
    bankBranch?: string;
    bankAccountNo?: string;
    routingNo?: string;
    autoPrintReceipt?: boolean;
    paperWidth?: '80mm' | '58mm' | 'custom' | string;
    customPaperWidth?: number;
  };
  invoiceSettings?: {
    headerSlogan?: string;
    invoicePrefix?: string;
    hotline?: string;
    showBinNumber?: boolean;
    showSalesmanName?: boolean;
    showCustomizationDetails?: boolean;
    showQrCode?: boolean;
    qrCodeType?: 'verification' | 'bkash';
    paperWidth?: '80mm' | '58mm' | 'custom' | string;
    customPaperWidth?: number;
    footerNote?: string;
    returnPolicyNote?: string;
  };
    courierSettings?: {
    provider: 'steadfast' | 'pathao' | 'both';
    apiKey?: string;
    apiSecret?: string;
    webhookUrl?: string;
    isConnected?: boolean;
  };
  kitCategories?: KitCategorySetting[];
  otherCategories?: OtherProductCategorySetting[];
  clothingCategories?: ClothingCategorySetting[];
  expenseCategories?: ExpenseCategorySetting[];
  storeConfig?: StoreConfiguration;
}

export interface KitCategorySetting {
  id: string;
  name: string;
  defaultMrp: number;
  defaultCostPrice: number; // Buying price (ক্রয়মূল্য)
  defaultBottomPrice: number;
  archived?: boolean;
}

export interface OtherProductCategorySetting {
  id: string;
  name: string;
  defaultMrp: number;
  defaultCostPrice: number; // Buying price (ক্রয়মূল্য)
  defaultBottomPrice?: number;
  archived?: boolean;
}

export interface ClothingCategorySetting {
  id: string;
  name: string;
  bengaliName?: string;
  nameBn?: string;
  apparelScale: ApparelScaleType;
  defaultMrp: number;
  defaultCostPrice: number;
  defaultBottomPrice: number;
  defaultSizes?: string[];
  isDefault?: boolean;
  archived?: boolean;
}

export interface ExpenseCategorySetting {
  id: string;
  name: string;
  label: string;
  bnLabel?: string;
  bengaliLabel?: string;
  color?: string;
  isDefault?: boolean;
  archived?: boolean;
}

export interface StoreConfiguration {
  // B. Products & Categories
  customClubs?: string[];
  availableSizes?: string[];
  defaultUnit?: string;
  availableUnits?: string[];

  // C. Pricing & Cost Management
  hideCostPriceFromStaff?: boolean;
  enforceBottomPriceLock?: boolean;
  defaultMarkupPercentage?: number;
  maxStaffDiscountPercent?: number;
  defaultCustomNameNumberCost?: number;
  defaultCustomNameNumberPrice?: number;
  defaultPatchCost?: number;
  defaultPatchPrice?: number;
  defaultSponsorCost?: number;
  defaultSponsorPrice?: number;
  defaultAlterationCost?: number;
  defaultAlterationPrice?: number;

  // D. POS Counter & Quick Billing
  defaultPosSection?: 'kit' | 'other_products' | 'only_font_order';
  defaultWalkInName?: string;
  requireCustomerPhoneOnDue?: boolean;
  autoFocusBarcodeSearch?: boolean;
  enableQuickDiscountButtons?: boolean;
  enableHoldOrder?: boolean;

  // E. Inventory & Stock Settings
  lowStockThreshold?: number;
  deadStockDays?: number;
  inventoryTrackingEnabled?: boolean;
  autoDeductStockOnConfirm?: boolean;
  autoRestockOnExchange?: boolean;
  allowOutOfStockSelling?: boolean;
  trashRetentionDays?: number;

  // F. Customers & Due Management
  customerTiers?: string[];
  defaultCreditLimit?: number;
  dueReminderDays?: number;
  whatsappDueTemplate?: string;

  // G. Transactions & Payment Methods
  enabledPaymentMethods?: {
    cash: boolean;
    merchantBkash: boolean;
    personalBkash: boolean;
    nagad: boolean;
    bank: boolean;
  };
  defaultPaymentMethod?: DrawerType;
  defaultTransactionFilter?: 'all' | 'today' | 'week' | 'month';

  // H. Exchange & Return Settings
  exchangeWindowDays?: number;
  allowCustomPrintedExchange?: boolean;
  allowAlteredItemExchange?: boolean;
  requireReceiptForExchange?: boolean;
  allowCashRefundOnExchange?: boolean;

  // I. Cash Drawer & Daily Closing
  drawerLabels?: {
    cash: string;
    merchantBkash: string;
    personalBkash: string;
    nagad: string;
    bank: string;
  };
  requireOwnerPasswordForWithdrawal?: boolean;
  defaultOpeningCashFloat?: number;
  requireCountBeforeZReport?: boolean;

  // J. Expenses
  defaultExpenseDrawer?: DrawerType;
  requireNoteForExpenseAbove?: number;

  // K. Jersey Order & Print Pipeline
  dtfVendorWhatsapp?: string;
  fontStyles?: string[];
  availablePatches?: string[];
  defaultStandaloneFontPrice?: number;
  defaultStandaloneFontCost?: number;

  // M. Appearance & System Preferences
  appLanguage?: 'bn' | 'en';
  currencySymbol?: string;
  dateFormat?: 'DD/MM/YYYY' | 'MM/DD/YYYY' | 'YYYY-MM-DD';
  compactPosMode?: boolean;
  soundEffectsEnabled?: boolean;

  // N. Customer Loyalty Program
  loyaltySettings?: LoyaltySettings;
}

export interface StandaloneFontOrder {
  id: string;
  shopId: string;
  teamOrKit: string;
  colorOrVersion: string;
  customName: string;
  customNumber: string;
  fontStyle: string;
  badgeOrPatch?: string;
  quantity: number;
  unitPrice: number;
  unitCostPrice?: number;
  notes?: string;
  status: 'pending' | 'printed' | 'delivered';
  customerName?: string;
  customerPhone?: string;
  createdAt: string;
}

export type DrawerType = 'cash' | 'personalBkash' | 'merchantBkash' | 'nagad' | 'bank';

export interface OwnerAccount {
  id: string;
  shopId: string;
  name: string;
  username: string; // e.g. "shawon", "mahmud", "partner2"
  password: string; // Always empty/redacted when returned; verified against passwordHash
  passwordHash?: string;
  passwordSalt?: string;
  hasPasswordSet?: boolean;
  phone: string;
  sharePercentage?: number; // Ownership stake %
  totalWithdrawn: number; // Cumulative total withdrawn in BDT
  totalAdded: number; // Cumulative capital / cash injected into business
  active: boolean;
  createdAt: string;
}

export interface OwnerWithdrawDepositRecord {
  id: string;
  shopId: string;
  ownerId: string;
  ownerName: string;
  ownerUsername: string;
  action: 'withdraw' | 'deposit'; // 'withdraw' = Owner Withdraw (উত্তোলন), 'deposit' = Business Add Money (মূলধন জমা)
  amount: number;
  drawer: DrawerType;
  note: string;
  timestamp: string;
}

export interface DrawerTransaction {
  id: string;
  shopId: string;
  type: 'sale' | 'advance' | 'due_recovery' | 'expense' | 'transfer' | 'adjustment' | 'owner_withdraw' | 'owner_deposit';
  drawer: DrawerType;
  amount: number;
  direction: 'in' | 'out';
  referenceId?: string; // invoiceId or expenseId
  note: string;
  timestamp: string;
  salesmanName?: string;
  performedBy?: string;
  ownerId?: string;
}

export interface MultiDrawerBalance {
  cash: number;
  personalBkash: number;
  merchantBkash: number;
  nagad: number;
  bank: number;
}

export type JerseyCategory = 
  | 'Player Issue' 
  | 'Fan Issue' 
  | 'Retro Vintage' 
  | 'BD Premium' 
  | 'Retro' 
  | 'Replica' 
  | 'Player Edition' 
  | 'Fan Version' 
  | 'Other';

export type FontStyle = 
  | 'Official Club Font' 
  | 'UCL / European Font'
  | 'UCL Starball Font' 
  | 'World Cup Font' 
  | 'Classic 90s Retro Font'
  | 'Standard Athletic Bold'
  | 'Retro Classic Font';

export type PatchType = 
  | 'None' 
  | 'UCL Starball + Foundation'
  | 'UCL 15/14 Badge' 
  | 'Premier League Badge'
  | 'Premier League Gold' 
  | 'World Cup Champions Patch'
  | 'FIFA World Cup Winners' 
  | 'La Liga / Serie A'
  | 'Custom';

export type JerseySize = 'S' | 'M' | 'L' | 'XL' | 'XXL' | '3XL';

export type PrintStatus = 'order_taken' | 'in_press' | 'ready_for_pickup' | 'delivered';

export interface JerseyCustomization {
  customName: string; // AUTO-UPPERCASE
  customNumber: string; // 0-99
  fontStyle: string; // Free text font style / season / typography cut
  size: JerseySize;
  patches: PatchType;
  instructions: string;
  printStatus: PrintStatus;
  extraCharge: number;
  assignedPress?: string;
  copyCount?: number; // Times copied for DTF hub (e.g. 1 means "Copy 1")
  dtfOrdered?: boolean; // Track if ordered to DTF print hub
  dtfOrderedAt?: string;
  kitDetails?: string; // e.g. "argentina 2006 home white"
}

export interface SteadfastParcelData {
  id: string;
  shopId: string;
  invoice: string;
  recipientName: string;
  recipientPhone: string;
  recipientAddress: string;
  codAmount: number;
  note: string;
  itemDescription: string;
  totalLot: number;
  deliveryType: 0 | 1; // 0: Home Delivery, 1: Steadfast Hub Pickup
  consignmentId?: string;
  trackingCode?: string;
  status: 'draft' | 'submitted';
  createdAt: string;
}

export interface MonthlyStockAudit {
  id: string;
  shopId: string;
  monthYear: string; // "YYYY-MM"
  openingStock: number;
  totalPurchases: number;
  closingStock: number;
  totalSales: number;
  calculatedCogs: number;
  operatingExpenses: number;
  netProfit: number;
  savedAt: string;
}

export type ApparelScaleType = 'shirts_tops' | 'denim_pants' | 'panjabi';

export type MenClothingCategory =
  | 'T-Shirt'
  | 'Polo Shirt'
  | 'Shirt'
  | 'Pant / Trouser'
  | 'Jeans'
  | 'Shorts'
  | 'Panjabi'
  | 'Hoodie'
  | 'Sweatshirt'
  | 'Jacket'
  | 'Sweater'
  | 'Tracksuit'
  | "Other Men's Clothing"
  | string;

export interface ApparelMatrixVariant {
  id?: string; // Unique Variant ID within product
  sku?: string; // Variant-specific SKU or Barcode
  size: string; // e.g. "M", "32-Reg", "42"
  color?: string;
  stock: number;
  daysInStock?: number;
  costPrice: number;
  mrp: number;
  bottomPrice: number;
  imageUrl?: string; // Compressed thumbnail/WebP URL or data URL
  isActive?: boolean; // Active/inactive status (defaults to true)
  isClearance?: boolean;
}

export interface InventoryItem {
  id: string;
  shopId: string;
  name: string;
  bengaliName?: string;
  description?: string;
  color?: string;
  categoryType: 'jersey' | 'apparel' | 'general';
  
  // Jersey attributes
  jerseyCategory?: JerseyCategory;
  clubOrCountry?: string;
  season?: string;
  
  // Apparel / Men's Clothing attributes
  clothingCategory?: MenClothingCategory;
  subCategory?: string;
  apparelScale?: ApparelScaleType;
  variants: ApparelMatrixVariant[];
  
  // Pricing
  lotCostLandingPrice: number; // Protected: Wholesale lot landing cost (Hidden from salesman)
  mrp: number; // Asking price
  bottomPrice: number; // Floor price (Salesman discount lock)
  
  totalStock: number;
  sku: string;
  imageUrl?: string; // Compressed product image/thumbnail
  isActive?: boolean;
  isSoftDeleted?: boolean;
  deletedAt?: string;
}

export interface OrderLineItem {
  id: string;
  productId?: string;
  variantId?: string;
  sku?: string;
  itemType: 'jersey' | 'apparel' | 'general' | 'other';
  title: string;
  color?: string;
  subDetail: string; // e.g. "Real Madrid 2024/25 • XL" or "Levis 501 • 32-Reg"
  size: string;
  rate: number;
  quantity: number;
  subtotal: number;
  costPrice: number; // for profit calculation (hidden from salesman)
  bottomPrice: number; // minimum allowed price without owner PIN
  customization?: JerseyCustomization;
  requiresAlteration?: boolean;
  overrideToken?: string; // Server-issued single-use authorization token for below-floor sales
  isManualInventoryEntry?: boolean;
}

export interface AlterationOrder {
  id: string;
  shopId: string;
  invoiceId: string;
  customerName: string;
  customerPhone: string;
  itemName: string;
  size: string;
  tailorInstruction: string;
  tailorFee: number;
  deliveryDate: string;
  status: 'sent_to_tailor' | 'ready_for_pickup' | 'handed_over';
  createdAt: string;
  handedOverAt?: string;
}

export interface Invoice {
  id: string;
  invoiceNo: string;
  shopId: string;
  customerName: string;
  customerPhone: string;
  salesmanId: string;
  salesmanName: string;
  items: OrderLineItem[];
  subtotal: number;
  discount: number;
  total: number;
  paymentMode: 'paid' | 'partial';
  paymentChannel: 'cash' | 'bkash' | 'merchantBkash' | 'personalBkash' | 'nagad' | 'bank' | 'split';
  splitBreakdown?: {
    cash: number;
    merchantBkash: number;
    personalBkash: number;
    nagad: number;
    bank: number;
  };
  splitDetails?: {
    cashAmount: number;
    digitalAmount: number;
    digitalChannel: 'bkash' | 'nagad' | 'bank';
  };
  advancePaid: number;
  paidAmount?: number;
  paymentMethod?: string;
  dueAmount: number;
  dueClearedAt?: string;
  dueClearedChannel?: DrawerType;
  status: 'completed' | 'partial_due' | 'returned';
  partyType?: 'Retail' | 'Reseller';
  courierInfo?: {
    enabled: boolean;
    courierName: string;
    tracking: string;
    deliveryFee: number;
  };
  alterationOrders?: AlterationOrder[];
  createdAt: string; // ISO string
  isSoftDeleted?: boolean;
  deletedAt?: string;
  ownerPinAuthorized?: boolean;
  hasBelowFloorDiscount?: boolean; // Set when any line item is discounted below bottomPrice
  notes?: string;
  // Customer Loyalty tracking on invoice
  loyaltyPointsEarned?: number;
  loyaltyPointsRedeemed?: number;
  loyaltyDiscountAmount?: number;
  loyaltyTierApplied?: string;
  loyaltyPointsReversed?: boolean;
  stockDeducted?: boolean;
}

export interface FloorOverrideToken {
  token: string;
  shopId: string;
  productId: string;
  variantSize?: string;
  minApprovedRate: number;
  maxQuantity: number;
  authorizerUid: string;
  authorizerRole: string;
  createdAt: number;
  expiresAt: number;
  used: boolean;
  usedAt?: number;
  invoiceId?: string;
}

export interface SecurityAuditLog {
  id: string;
  shopId: string;
  action:
    | 'pin_setup'
    | 'pin_change'
    | 'pin_reset'
    | 'protection_toggle'
    | 'override_approved'
    | 'below_floor_sale'
    | 'pin_attempt_lockout';
  actorUid: string;
  actorEmail?: string;
  actorRole: string;
  timestamp: string;
  details: {
    previousStatus?: boolean;
    newStatus?: boolean;
    productId?: string;
    productName?: string;
    approvedRate?: number;
    attemptedRate?: number;
    bottomPrice?: number;
    quantity?: number;
    invoiceId?: string;
    invoiceNo?: string;
    reason?: string;
    ipAddress?: string;
    [key: string]: any;
  };
}

export interface ZReport {
  id: string;
  shopId: string;
  date: string;
  salesmanId?: string;
  salesmanName?: string;
  expectedCash?: number;
  countedCash?: number;
  discrepancy: number; // countedCash - expectedCash (negative = short, positive = over)
  totalSalesVolume?: number;
  totalTransactionsCount?: number;
  totalDigitalVolume?: number;
  totalExpensesPaid?: number;
  notes: string;
  submittedAt?: string;
  closedBy?: string;
  timestamp?: string;
  totalSales?: number;
  totalInvoices?: number;
  cashSales?: number;
  digitalSales?: number;
  creditGiven?: number;
  expensesDeducted?: number;
  expectedCashBalance?: number;
  actualCashCounted?: number;
  status?: 'balanced' | 'short' | 'over';
  retailVsResellerRatio?: {
    retailCount: number;
    retailVolume: number;
    resellerCount: number;
    resellerVolume: number;
  };
  auditSnapshots?: Record<string, { expected: number; actual: number }>;
}

export interface ExpenseRecord {
  id: string;
  shopId: string;
  category: string;
  amount: number;
  paymentDrawer: DrawerType;
  note: string;
  date: string;
  createdAt: string;
  createdBy: string;
}

export interface TeamTournamentPlayer {
  id: string;
  name: string;
  number: string;
  size: 'S' | 'M' | 'L' | 'XL' | 'XXL';
  position?: string;
}

export interface TeamBulkOrder {
  id: string;
  shopId: string;
  teamName: string;
  tournamentName: string;
  contactPerson: string;
  contactPhone: string;
  kitDesign: string;
  players: TeamTournamentPlayer[];
  ratePerPiece: number;
  subtotal: number;
  advancePaid: number;
  dueAmount: number;
  deliveryDate: string;
  status: 'draft' | 'confirmed' | 'in_printing' | 'ready' | 'delivered';
  notes?: string;
  createdAt: string;
}

export interface ResellerTransaction {
  id: string;
  resellerId: string;
  shopId: string;
  date: string;
  type: 'dispatch' | 'payment_received' | 'opening_balance';
  itemsCount: number;
  amount: number;
  balanceAfter: number;
  note: string;
  slipNumber: string;
  splitBreakdown?: {
    cash: number;
    merchantBkash: number;
    personalBkash: number;
    nagad: number;
    bank: number;
  };
}

export interface ResellerAccount {
  id: string;
  shopId: string;
  name: string;
  phone: string;
  location: string;
  previousDue?: number;
  currentDueBalance: number; // Baki Khata
  totalPurchased: number;
  ordersCount: number;
  transactions: ResellerTransaction[];
}

export interface GlobalBlacklistEntry {
  id: string;
  phone: string;
  customerName: string;
  reportedByShopId: string;
  reportedByShopName: string;
  reason: string;
  amountDefrauded?: number;
  reportedAt: string;
  severity: 'high' | 'medium';
}

export interface TrashItem {
  id: string;
  shopId: string;
  itemType: 'invoice' | 'product' | 'bulk_order';
  title: string;
  summary: string;
  data: any;
  deletedAt: string;
  expiresAt: string; // 30 days after deletion
}

export interface SizeExchangeRecord {
  id: string;
  shopId: string;
  originalInvoiceId: string;
  originalInvoiceNo?: string;
  customerName: string;
  customerPhone: string;
  returnedItem: {
    productId?: string;
    title: string;
    size: string;
    rate: number;
    customization?: any;
  };
  replacementItem: {
    productId?: string;
    title: string;
    size: string;
    rate: number;
    customization?: any;
  };
  priceDifference: number; // positive = customer pays extra, negative = store refunds
  paymentMode?: 'paid' | 'partial' | 'refund' | 'even';
  channelUsed: DrawerType;
  paidAmount?: number;
  dueAmount?: number;
  createdAt: string;
  salesmanName: string;
  notes?: string;
}

// ==========================================
// PHASE 2: STOCK ADJUSTMENT LEDGER
// ==========================================
export type StockMovementType =
  | 'manual_correction'
  | 'sale'
  | 'return'
  | 'restock'
  | 'initial_entry';

export interface StockAdjustmentRecord {
  id: string;
  shopId: string;
  productId: string;
  productName: string;
  sku: string;
  variantId?: string;
  size: string;
  color?: string;
  previousQty: number;
  newQty: number;
  difference: number; // newQty - previousQty
  movementType: StockMovementType;
  reason: string;
  referenceId?: string; // e.g., invoiceNo or exchangeId
  responsibleUser: string;
  userRole?: UserRole;
  timestamp: string;
}

// ==========================================
// PHASE 3 & 4: SHOP-SCOPED CUSTOMER & LOYALTY SYSTEM
// ==========================================
export type LoyaltyEarningMode = 'per_purchase' | 'per_amount_spent';

export interface LoyaltyRewardTier {
  id: string;
  pointsRequired: number;
  discountPercent: number;
  label: string;
  isActive?: boolean;
}

export interface LoyaltySettings {
  enabled: boolean;
  earningMode: LoyaltyEarningMode;
  pointsPerPurchase: number; // Mode A: e.g., 10 points per qualifying invoice
  minPurchaseAmountForPoints: number; // Mode A minimum invoice total (e.g., ৳500)
  amountUnitForPoints: number; // Mode B: e.g., every ৳1000 spent
  pointsPerAmountUnit: number; // Mode B: e.g., 10 points per ৳1000
  rewardTiers: LoyaltyRewardTier[];
  allowRedeemOnDue?: boolean;
}

export interface LoyaltyTransaction {
  id: string;
  shopId: string;
  customerId: string; // "${shopId}_${normalizedPhone}"
  customerPhone: string;
  customerName: string;
  invoiceId?: string;
  invoiceNo?: string;
  type: 'earn' | 'redeem' | 'reverse' | 'manual_adjust';
  points: number; // positive for earn, positive magnitude for redeem/reverse
  balanceAfter: number;
  discountApplied?: number;
  rewardTierLabel?: string;
  note: string;
  createdBy: string;
  timestamp: string;
}

export interface ShopCustomerProfile {
  id: string; // Strictly scoped: "${shopId}_${normalizedPhone}"
  shopId: string;
  phone: string;
  name: string;
  loyaltyPoints: number;
  lifetimePointsEarned: number;
  lifetimePointsRedeemed: number;
  doNotContact?: boolean; // Opt-out flag for Festive Offers / WhatsApp campaigns
  notes?: string;
  createdAt: string;
  updatedAt: string;
  lastCampaignOpenedAt?: string;
}

// ==========================================
// PHASE 6: FESTIVE OFFERS & INDIVIDUAL WHATSAPP MESSAGING
// ==========================================
export interface CampaignTemplate {
  id: string;
  shopId: string;
  title: string;
  titleBn?: string;
  occasion: 'Eid' | 'Puja' | 'NewArrival' | 'Clearance' | 'Tournament' | 'Custom' | string;
  messageBody: string; // Supports {{customer_name}} and {{shop_name}}
  isDefault?: boolean;
  updatedAt: string;
}

export interface CampaignOpenLog {
  id: string;
  shopId: string;
  customerPhone: string;
  customerName: string;
  templateId: string;
  channel: 'whatsapp' | 'sms';
  action: 'opened_whatsapp_preview' | 'opened_sms_preview'; // Never "sent"
  timestamp: string;
  openedBy: string;
}

