import {
  TenantShop,
  UserRole,
  InventoryItem,
  Invoice,
  OwnerAccount,
  StaffMember,
} from '../types';

export interface SubscriptionCheckResult {
  allowed: boolean;
  status: 'active' | 'grace' | 'pending' | 'expired';
  daysRemaining: number;
  reasonBn?: string;
}

export function evaluateSubscriptionStatus(
  subscription?: TenantShop['subscription'],
  nowMs: number = Date.now()
): SubscriptionCheckResult {
  if (!subscription) {
    return {
      allowed: true,
      status: 'active',
      daysRemaining: 30,
    };
  }

  if (subscription.status === 'expired') {
    return {
      allowed: false,
      status: 'expired',
      daysRemaining: 0,
      reasonBn:
        'আপনার দোকানের মাসিক সাবস্ক্রিপশনের মেয়াদ শেষ হয়েছে। নতুন বিল বা ডাটা সেভ করতে সাবস্ক্রিপশন নবায়ন (TrxID জমা) করুন।',
    };
  }

  const expiryDateStr = subscription.graceEndsAt || subscription.expiresAt;
  if (expiryDateStr) {
    const expiryTime = new Date(`${expiryDateStr}T23:59:59`).getTime();
    if (!Number.isNaN(expiryTime)) {
      const diffDays = Math.ceil((expiryTime - nowMs) / (1000 * 60 * 60 * 24));
      if (diffDays < 0 && subscription.status !== 'pending') {
        return {
          allowed: false,
          status: 'expired',
          daysRemaining: 0,
          reasonBn:
            'আপনার দোকানের সাবস্ক্রিপশনের মেয়াদ উত্তীর্ণ হয়েছে। নতুন বিক্রয় ও ইনভয়েস তৈরি চালু রাখতে পেমেন্ট সম্পন্ন করুন।',
        };
      }
      return {
        allowed: true,
        status: subscription.status,
        daysRemaining: Math.max(0, diffDays),
      };
    }
  }

  return {
    allowed: true,
    status: subscription.status,
    daysRemaining: 30,
  };
}

export interface RoleSwitchEvaluation {
  allowed: boolean;
  requiresPinModal: boolean;
  reasonBn?: string;
}

export function evaluateRoleSwitch(params: {
  currentRole: UserRole;
  targetRole: UserRole;
  userType?: 'merchant' | 'staff';
  isSuperAdminVerified?: boolean;
  isPinVerified?: boolean;
}): RoleSwitchEvaluation {
  const { currentRole, targetRole, userType, isSuperAdminVerified, isPinVerified } = params;

  if (targetRole === 'super_admin') {
    if (!isSuperAdminVerified) {
      return {
        allowed: false,
        requiresPinModal: false,
        reasonBn: 'Super Admin অ্যাক্সেস শুধুমাত্র অনুমোদিত প্ল্যাটফর্ম অ্যাডমিনের জন্য সংরক্ষিত।',
      };
    }
    return { allowed: true, requiresPinModal: false };
  }

  if (targetRole === 'shop_owner') {
    if (userType === 'staff') {
      return {
        allowed: false,
        requiresPinModal: false,
        reasonBn: 'স্টাফ একাউন্ট থেকে Shop Owner মোডে যাওয়া অনুমোদিত নয়।',
      };
    }
    if (currentRole === 'salesman' && !isPinVerified && !isSuperAdminVerified) {
      return {
        allowed: false,
        requiresPinModal: true,
        reasonBn: 'ক্যাশিয়ার মোড থেকে মালিকের (Owner) মোডে ফিরতে ৪-ডিজিট Owner PIN দিন।',
      };
    }
    return { allowed: true, requiresPinModal: false };
  }

  return { allowed: true, requiresPinModal: false };
}

export function canUserAccessShop(
  shop: {
    id: string;
    ownerUid?: string;
    memberUids?: string[];
    invitedStaffEmails?: string[];
    ownerEmail?: string;
    email?: string;
  },
  session: {
    uid?: string;
    email?: string;
    shopId?: string;
    isSuperAdminVerified?: boolean;
  } | null
): boolean {
  if (!session) return false;
  if (session.isSuperAdminVerified) return true;

  if (session.uid) {
    if (shop.ownerUid && shop.ownerUid === session.uid) return true;
    if (Array.isArray(shop.memberUids) && shop.memberUids.includes(session.uid)) return true;
  }

  const cleanEmail = session.email?.trim().toLowerCase();
  if (cleanEmail) {
    if (Array.isArray(shop.invitedStaffEmails) && shop.invitedStaffEmails.map((e) => e.toLowerCase()).includes(cleanEmail)) {
      return true;
    }
    if (!shop.ownerUid) {
      if (shop.ownerEmail?.toLowerCase() === cleanEmail || shop.email?.toLowerCase() === cleanEmail) {
        return true;
      }
    }
  }

  if (session.shopId && shop.id === session.shopId && !shop.ownerUid) {
    return true;
  }

  return false;
}

export const MENS_CLOTHING_CATEGORY_NAMES = [
  'T-Shirt',
  'Polo Shirt',
  'Shirt',
  'Pant / Trouser',
  'Jeans',
  'Shorts',
  'Panjabi',
  'Hoodie',
  'Sweatshirt',
  'Jacket',
  'Sweater',
  'Tracksuit',
  "Other Men's Clothing",
] as const;

export type BusinessCategorySector = 'clothing' | 'jersey';

/**
 * Resolves the canonical business category sector ('clothing' | 'jersey') for any shop.
 * Guarantees that existing Sportswear ('jersey' / 'SPORTS WEAR' / 'hybrid') shops always resolve to 'jersey'
 * and Clothing ('clothing' / 'CLOTHING') shops always resolve to 'clothing'.
 */
export function resolveBusinessCategory(
  shop?: {
    category?: 'jersey' | 'clothing' | 'hybrid' | string;
    shopCategory?: 'CLOTHING' | 'SPORTS WEAR' | string;
    featureFlags?: {
      jerseyCustomization?: boolean;
      teamBulkOrders?: boolean;
    };
  } | null
): BusinessCategorySector {
  if (!shop) return 'jersey';

  const rawShopCat = String(shop.shopCategory || '').trim().toUpperCase();
  const rawCat = String(shop.category || '').trim().toLowerCase();

  // Explicit Clothing identification
  if (rawShopCat === 'CLOTHING' || rawCat === 'clothing') {
    return 'clothing';
  }

  // Explicit Sportswear identification (includes legacy 'jersey' and 'hybrid' so Sportswear accounts are 100% preserved)
  if (rawShopCat === 'SPORTS WEAR' || rawShopCat === 'SPORTSWEAR' || rawCat === 'jersey' || rawCat === 'hybrid') {
    return 'jersey';
  }

  if (shop.featureFlags?.jerseyCustomization || shop.featureFlags?.teamBulkOrders) {
    return 'jersey';
  }

  return 'clothing';
}

export function isClothingShop(
  shop?: {
    category?: 'jersey' | 'clothing' | 'hybrid' | string;
    shopCategory?: 'CLOTHING' | 'SPORTS WEAR' | string;
    featureFlags?: {
      jerseyCustomization?: boolean;
      teamBulkOrders?: boolean;
    };
  } | null
): boolean {
  return resolveBusinessCategory(shop) === 'clothing';
}

export function isSportswearShop(
  shop?: {
    category?: 'jersey' | 'clothing' | 'hybrid' | string;
    shopCategory?: 'CLOTHING' | 'SPORTS WEAR' | string;
    featureFlags?: {
      jerseyCustomization?: boolean;
      teamBulkOrders?: boolean;
    };
  } | null
): boolean {
  return resolveBusinessCategory(shop) === 'jersey';
}

/**
 * Tabs exclusive to Sportswear ('jersey'):
 * - 'pipeline': Jersey Heat-Press Print Pipeline & DTF Font Orders
 * - 'team': Team Tournament Bulk Jersey Order Matrix
 *
 * Clothing merchants ('clothing') cannot access 'pipeline' or 'team' even via direct URL/state manipulation.
 */
const SPORTSWEAR_EXCLUSIVE_TABS = new Set(['pipeline', 'team']);

export function isTabAllowedForCategory(
  tab: string,
  shop?: {
    category?: 'jersey' | 'clothing' | 'hybrid' | string;
    shopCategory?: 'CLOTHING' | 'SPORTS WEAR' | string;
    featureFlags?: {
      jerseyCustomization?: boolean;
      teamBulkOrders?: boolean;
    };
  } | null
): boolean {
  const cleanTab = String(tab || 'home').trim().toLowerCase();
  const sector = resolveBusinessCategory(shop);

  if (sector === 'clothing') {
    if (SPORTSWEAR_EXCLUSIVE_TABS.has(cleanTab)) {
      return false;
    }
    return true;
  }

  // Sportswear ('jersey') has access to all Sportswear & general retail tabs
  return true;
}

export function sanitizeNavigationTabForShop(
  tab: string,
  shop?: {
    category?: 'jersey' | 'clothing' | 'hybrid' | string;
    shopCategory?: 'CLOTHING' | 'SPORTS WEAR' | string;
    featureFlags?: {
      jerseyCustomization?: boolean;
      teamBulkOrders?: boolean;
    };
  } | null
): string {
  const raw = String(tab || 'home').trim();
  const lower = raw.toLowerCase();
  const normalized =
    lower === 'exchange' || lower === 'size-exchange' || lower === 'size_exchange'
      ? 'size_exchange'
      : lower === 'alterations'
      ? 'alteration'
      : raw;
  if (!isTabAllowedForCategory(normalized, shop)) {
    return 'home';
  }
  return normalized;
}

export type CategoryProtectedAction =
  | 'access_jersey_pos_builder'
  | 'create_jersey_custom_order'
  | 'create_team_bulk_order'
  | 'create_font_order'
  | 'manage_jersey_kits'
  | 'access_clothing_pos_builder'
  | 'manage_clothing_categories'
  | 'create_alteration_order';

export function canPerformCategoryAction(
  action: CategoryProtectedAction,
  shop?: {
    category?: 'jersey' | 'clothing' | 'hybrid' | string;
    shopCategory?: 'CLOTHING' | 'SPORTS WEAR' | string;
    featureFlags?: {
      jerseyCustomization?: boolean;
      teamBulkOrders?: boolean;
    };
  } | null
): { allowed: boolean; reasonBn?: string } {
  const sector = resolveBusinessCategory(shop);

  if (sector === 'clothing') {
    if (
      action === 'access_jersey_pos_builder' ||
      action === 'create_jersey_custom_order' ||
      action === 'create_team_bulk_order' ||
      action === 'create_font_order' ||
      action === 'manage_jersey_kits'
    ) {
      return {
        allowed: false,
        reasonBn: 'এই ফিচারটি শুধুমাত্র Sportswear ক্যাটাগরির মার্চেন্টদের জন্য সংরক্ষিত। Clothing স্টোরের জন্য এটি প্রযোজ্য নয়।',
      };
    }
    return { allowed: true };
  }

  // Sportswear ('jersey')
  if (action === 'manage_clothing_categories') {
    return {
      allowed: false,
      reasonBn: 'এই ফিচারটি শুধুমাত্র Men\'s Clothing ক্যাটাগরির মার্চেন্টদের জন্য প্রযোজ্য।',
    };
  }

  return { allowed: true };
}

export interface OwnerPinVerificationInput {
  expectedOwnerPin?: string | null;
  candidatePin?: string | null;
  failedAttempts?: number;
  lockedUntilMs?: number;
  nowMs?: number;
  maxAttempts?: number;
  lockoutDurationMs?: number;
}

export interface OwnerPinVerificationResult {
  authorized: boolean;
  lockedOut: boolean;
  nextFailedAttempts: number;
  lockedUntilMs: number;
  remainingAttempts: number;
  message: string;
}

/**
 * Verifies the Store Owner's 4-digit PIN without ever exposing the expected PIN in messages or logs,
 * and enforces brute-force lockout after `maxAttempts` (default 5) failed attempts.
 */
export function verifyTenantOwnerPin(input: OwnerPinVerificationInput): OwnerPinVerificationResult {
  const now = input.nowMs ?? Date.now();
  const maxAttempts = input.maxAttempts ?? 5;
  const lockoutDurationMs = input.lockoutDurationMs ?? 60_000;
  const currentLockedUntil = input.lockedUntilMs ?? 0;
  const currentFailed = input.failedAttempts ?? 0;

  if (currentLockedUntil > now) {
    const secsLeft = Math.max(1, Math.ceil((currentLockedUntil - now) / 1000));
    return {
      authorized: false,
      lockedOut: true,
      nextFailedAttempts: currentFailed,
      lockedUntilMs: currentLockedUntil,
      remainingAttempts: 0,
      message: `Too many incorrect PIN attempts. Try again in ${secsLeft}s.`,
    };
  }

  const expected = String(input.expectedOwnerPin ?? '').trim();
  const candidate = String(input.candidatePin ?? '').trim();

  if (!expected || !/^\d{4}$/.test(candidate)) {
    const nextFailed = currentFailed + 1;
    const isNowLocked = nextFailed >= maxAttempts;
    const nextLockUntil = isNowLocked ? now + lockoutDurationMs : 0;
    return {
      authorized: false,
      lockedOut: isNowLocked,
      nextFailedAttempts: nextFailed,
      lockedUntilMs: nextLockUntil,
      remainingAttempts: Math.max(0, maxAttempts - nextFailed),
      message: isNowLocked
        ? 'Too many incorrect PIN attempts. Security lockout active for 60s.'
        : 'Invalid 4-digit Owner Security PIN. Access denied.',
    };
  }

  // Constant-time character comparison over 4 digits
  let diff = expected.length ^ candidate.length;
  for (let i = 0; i < Math.max(expected.length, candidate.length); i++) {
    diff |= (expected.charCodeAt(i) || 0) ^ (candidate.charCodeAt(i) || 0);
  }

  if (diff === 0) {
    return {
      authorized: true,
      lockedOut: false,
      nextFailedAttempts: 0,
      lockedUntilMs: 0,
      remainingAttempts: maxAttempts,
      message: 'Owner PIN verified.',
    };
  }

  const nextFailed = currentFailed + 1;
  const isNowLocked = nextFailed >= maxAttempts;
  const nextLockUntil = isNowLocked ? now + lockoutDurationMs : 0;

  return {
    authorized: false,
    lockedOut: isNowLocked,
    nextFailedAttempts: nextFailed,
    lockedUntilMs: nextLockUntil,
    remainingAttempts: Math.max(0, maxAttempts - nextFailed),
    message: isNowLocked
      ? 'Too many incorrect PIN attempts. Security lockout active for 60s.'
      : 'Invalid 4-digit Owner Security PIN. Access denied.',
  };
}

/**
 * Redacts sensitive store secrets (ownerPin, ownerPasswordHash, courier apiSecret) for non-owner roles.
 */
export function sanitizeTenantSecretsForRole<
  T extends {
    ownerPin?: string;
    ownerPasswordHash?: string;
    courierSettings?: {
      provider?: 'steadfast' | 'pathao' | 'both';
      apiKey?: string;
      apiSecret?: string;
      webhookUrl?: string;
      isConnected?: boolean;
    };
  }
>(tenant: T, role: UserRole): T {
  if (role === 'shop_owner' || role === 'super_admin') {
    return tenant;
  }
  return {
    ...tenant,
    ownerPin: '',
    ownerPasswordHash: undefined,
    courierSettings: tenant.courierSettings
      ? {
          ...tenant.courierSettings,
          apiSecret: '',
        }
      : undefined,
  };
}

/**
 * Checks if an inventory product is allowed for the given shop's business category.
 * - For Clothing shops ('clothing' / 'CLOTHING'): excludes items with `categoryType === 'jersey'` or `jerseyCategory`
 *   while preserving any legitimate clothing item (even if its name contains "Jersey", e.g. "Cotton Jersey Knit T-Shirt").
 * - For Sportswear shops ('jersey' / 'SPORTS WEAR'): allows all items unchanged.
 */
export function isProductAllowedForShop(
  item: {
    categoryType?: 'jersey' | 'apparel' | 'general' | string;
    jerseyCategory?: string;
    clothingCategory?: string;
  },
  shop?: {
    category?: 'jersey' | 'clothing' | 'hybrid' | string;
    shopCategory?: 'CLOTHING' | 'SPORTS WEAR' | string;
    featureFlags?: {
      jerseyCustomization?: boolean;
      teamBulkOrders?: boolean;
    };
  } | null
): boolean {
  if (!item) return false;
  if (isClothingShop(shop)) {
    if (item.categoryType === 'jersey' || Boolean(item.jerseyCategory)) {
      return false;
    }
    return true;
  }
  return true;
}

export function filterInventoryForShop<
  T extends {
    categoryType?: 'jersey' | 'apparel' | 'general' | string;
    jerseyCategory?: string;
    clothingCategory?: string;
  }
>(
  items: T[],
  shop?: {
    category?: 'jersey' | 'clothing' | 'hybrid' | string;
    shopCategory?: 'CLOTHING' | 'SPORTS WEAR' | string;
    featureFlags?: {
      jerseyCustomization?: boolean;
      teamBulkOrders?: boolean;
    };
  } | null
): T[] {
  if (!Array.isArray(items)) return [];
  return items.filter((item) => isProductAllowedForShop(item, shop));
}

export type SizeExchangeReplacementMode = 'jersey' | 'inventory' | 'custom';

export function getAllowedExchangeModesForShop(
  shop?: {
    category?: 'jersey' | 'clothing' | 'hybrid' | string;
    shopCategory?: 'CLOTHING' | 'SPORTS WEAR' | string;
    featureFlags?: {
      jerseyCustomization?: boolean;
      teamBulkOrders?: boolean;
    };
  } | null
): SizeExchangeReplacementMode[] {
  if (isClothingShop(shop)) {
    return ['inventory', 'custom'];
  }
  return ['jersey', 'inventory', 'custom'];
}

export function getDefaultExchangeModeForShop(
  shop?: {
    category?: 'jersey' | 'clothing' | 'hybrid' | string;
    shopCategory?: 'CLOTHING' | 'SPORTS WEAR' | string;
    featureFlags?: {
      jerseyCustomization?: boolean;
      teamBulkOrders?: boolean;
    };
  } | null
): SizeExchangeReplacementMode {
  return isClothingShop(shop) ? 'inventory' : 'jersey';
}

export function isJerseyOptionAllowedInReseller(
  shop?: {
    category?: 'jersey' | 'clothing' | 'hybrid' | string;
    shopCategory?: 'CLOTHING' | 'SPORTS WEAR' | string;
    featureFlags?: {
      jerseyCustomization?: boolean;
      teamBulkOrders?: boolean;
    };
  } | null
): boolean {
  return !isClothingShop(shop);
}

// ==========================================
// 7. COMPLETE RBAC & FINANCIAL DATA CONFIDENTIALITY
// ==========================================

export type SettingsTabId =
  | 'categories'
  | 'profile'
  | 'invoices'
  | 'payments'
  | 'partners'
  | 'subscription'
  | 'operators'
  | 'security'
  | 'security_tools'
  | 'api'
  | 'language'
  | 'help'
  | 'policies'
  | 'updates';

export type SettingsGroupId =
  | 'products_counter'
  | 'profile_memo'
  | 'payments_partners_subscription'
  | 'security_staff_system';

export interface SettingsGroupDefinition {
  id: SettingsGroupId;
  titleBn: string;
  titleEn: string;
  subtitleBn: string;
  tabs: Array<{
    id: SettingsTabId;
    labelBn: string;
    labelEn: string;
    allowedRoles: UserRole[];
  }>;
}

export const SETTINGS_GROUPS: SettingsGroupDefinition[] = [
  {
    id: 'products_counter',
    titleBn: 'পণ্য ও কাউন্টার',
    titleEn: 'Products & Counter',
    subtitleBn: 'ক্যাটালগ, সাইজ এবং ব্র্যান্ড কনফিগারেশন',
    tabs: [
      {
        id: 'categories',
        labelBn: 'ক্যাটাগরি ও দর',
        labelEn: 'Categories & Price',
        allowedRoles: ['super_admin', 'shop_owner', 'manager', 'salesman'],
      },
    ],
  },
  {
    id: 'profile_memo',
    titleBn: 'দোকানের প্রোফাইল ও পছন্দসমূহ',
    titleEn: 'Store Profile & Preferences',
    subtitleBn: 'দোকানের পরিচয়, ভাষা, রিসিট প্রিন্ট এবং হেল্প সেন্টার',
    tabs: [
      {
        id: 'profile',
        labelBn: 'দোকানের প্রোফাইল',
        labelEn: 'Store Profile',
        allowedRoles: ['super_admin', 'shop_owner', 'manager'],
      },
      {
        id: 'language',
        labelBn: 'ভাষা সেটিংস',
        labelEn: 'Language Settings',
        allowedRoles: ['super_admin', 'shop_owner', 'manager', 'salesman'],
      },
      {
        id: 'invoices',
        labelBn: 'ইনভয়েস ও রিসিট',
        labelEn: 'Invoices & Receipts',
        allowedRoles: ['super_admin', 'shop_owner', 'manager'],
      },
      {
        id: 'help',
        labelBn: 'হেল্প সেন্টার',
        labelEn: 'Help Center',
        allowedRoles: ['super_admin', 'shop_owner', 'manager', 'salesman'],
      },
      {
        id: 'policies',
        labelBn: 'পলিসি ও নীতিমালা',
        labelEn: 'Policies & Legal',
        allowedRoles: ['super_admin', 'shop_owner', 'manager', 'salesman'],
      },
      {
        id: 'updates',
        labelBn: 'আপডেট ও ঘোষণা',
        labelEn: 'Updates & Announcements',
        allowedRoles: ['super_admin', 'shop_owner', 'manager', 'salesman'],
      },
    ],
  },
  {
    id: 'payments_partners_subscription',
    titleBn: 'পেমেন্ট, পার্টনার ও সাবস্ক্রিপশন',
    titleEn: 'Payments, Partners & Subscription',
    subtitleBn: 'ড্রয়ার নম্বর, পার্টনার ইক্যুইটি ও উত্তোলন পাসওয়ার্ড এবং প্ল্যান রিনিউয়াল',
    tabs: [
      {
        id: 'payments',
        labelBn: 'পেমেন্ট ও ড্রয়ার',
        labelEn: 'Payments & Checkout',
        allowedRoles: ['super_admin', 'shop_owner'],
      },
      {
        id: 'partners',
        labelBn: 'পার্টনার ও পাসওয়ার্ড',
        labelEn: 'Partners & Password',
        allowedRoles: ['super_admin', 'shop_owner'],
      },
      {
        id: 'subscription',
        labelBn: 'প্ল্যান ও সাবস্ক্রিপশন',
        labelEn: 'Plan & Subscription',
        allowedRoles: ['super_admin', 'shop_owner'],
      },
    ],
  },
  {
    id: 'security_staff_system',
    titleBn: 'নিরাপত্তা, স্টাফ ও সিস্টেম',
    titleEn: 'Security, Staff & System',
    subtitleBn: 'স্টাফ নিয়ন্ত্রণ, ওনার সিকিউরিটি পিন, অডিট লগ, জেড-রিপোর্ট ও এপিআই কী',
    tabs: [
      {
        id: 'operators',
        labelBn: 'স্টাফ ও অপারেটর',
        labelEn: 'Manage Operators',
        allowedRoles: ['super_admin', 'shop_owner'],
      },
      {
        id: 'security',
        labelBn: 'সিকিউরিটি ও পিন',
        labelEn: 'Security & Permissions',
        allowedRoles: ['super_admin', 'shop_owner'],
      },
      {
        id: 'security_tools',
        labelBn: 'প্রিন্ট ও সিস্টেম রুলস',
        labelEn: 'Print & System Rules',
        allowedRoles: ['super_admin', 'shop_owner'],
      },
      {
        id: 'api',
        labelBn: 'এপিআই ও ইন্টিগ্রেশন',
        labelEn: 'API & Integrations',
        allowedRoles: ['super_admin', 'shop_owner'],
      },
    ],
  },
];

export function canViewBuyingPrice(role?: UserRole | string | null): boolean {
  return role === 'shop_owner' || role === 'super_admin';
}

export function canViewProfitMetrics(role?: UserRole | string | null): boolean {
  return role === 'shop_owner' || role === 'super_admin';
}

export function canManagePartners(role?: UserRole | string | null): boolean {
  return role === 'shop_owner' || role === 'super_admin';
}

export function canManageOperators(role?: UserRole | string | null): boolean {
  return role === 'shop_owner' || role === 'super_admin';
}

export function canManageDrawersAndAudits(role?: UserRole | string | null): boolean {
  return role === 'shop_owner' || role === 'super_admin';
}

export function canEditStoreProfile(role?: UserRole | string | null): boolean {
  return role === 'shop_owner' || role === 'super_admin';
}

export function canManageCatalogAndPricing(role?: UserRole | string | null): boolean {
  return (
    role === 'shop_owner' ||
    role === 'super_admin' ||
    role === 'manager' ||
    role === 'salesman'
  );
}

export function canAccessSettingsTab(
  role: UserRole | string | undefined | null,
  tabId: string
): boolean {
  if (!role) return false;
  for (const group of SETTINGS_GROUPS) {
    const found = group.tabs.find((t) => t.id === tabId);
    if (found) {
      return found.allowedRoles.includes(role as UserRole);
    }
  }
  return false;
}

export function getAllowedSettingsTabsForRole(role: UserRole | string | undefined | null): SettingsTabId[] {
  if (!role) return [];
  const allowed: SettingsTabId[] = [];
  for (const group of SETTINGS_GROUPS) {
    for (const tab of group.tabs) {
      if (tab.allowedRoles.includes(role as UserRole)) {
        allowed.push(tab.id);
      }
    }
  }
  return allowed;
}

export function getVisibleSettingsGroupsForRole(
  role: UserRole | string | undefined | null
): SettingsGroupDefinition[] {
  if (!role) return [];
  return SETTINGS_GROUPS.map((g) => ({
    ...g,
    tabs: g.tabs.filter((t) => t.allowedRoles.includes(role as UserRole)),
  })).filter((g) => g.tabs.length > 0);
}

export function getDefaultSettingsTabForRole(role: UserRole | string | undefined | null): SettingsTabId {
  if (role === 'shop_owner' || role === 'super_admin') {
    return 'profile';
  }
  return 'categories';
}

export function resolveAuthorizedSettingsTab(
  role: UserRole | string | undefined | null,
  requestedTab?: string | null
): SettingsTabId {
  if (requestedTab && canAccessSettingsTab(role, requestedTab)) {
    return requestedTab as SettingsTabId;
  }
  return getDefaultSettingsTabForRole(role);
}

export function canAccessAppRoute(
  role: UserRole | string | undefined | null,
  routeTab: string,
  shop?: Partial<TenantShop> | null
): boolean {
  if (!role) return false;
  if (routeTab === 'super_admin') {
    return role === 'super_admin';
  }
  if (routeTab === 'analytics' || routeTab === 'drawers' || routeTab === 'lot_splitter') {
    return canViewBuyingPrice(role);
  }
  if (routeTab === 'print_pipeline' || routeTab === 'font_orders' || routeTab === 'team_orders') {
    return isSportswearShop(shop);
  }
  return true;
}

// ==========================================
// 8. COST PRESERVATION & ROLE-AWARE SANITIZATION
// ==========================================

export interface PrivateProductCostRecord {
  lotCostLandingPrice: number;
  variantCosts: Record<string, number>;
}

/**
 * Strips confidential buying price fields (`lotCostLandingPrice`, `variants[].costPrice`)
 * when the viewer role is not authorized to view buying prices (`salesman` or `manager`).
 */
export function sanitizeInventoryItemForRole(
  item: InventoryItem,
  role?: UserRole | string | null
): InventoryItem {
  if (canViewBuyingPrice(role)) {
    return item;
  }
  return {
    ...item,
    lotCostLandingPrice: 0,
    variants: Array.isArray(item.variants)
      ? item.variants.map((v) => ({
          ...v,
          costPrice: 0,
        }))
      : [],
  };
}

export function sanitizeInventoryListForRole(
  items: InventoryItem[],
  role?: UserRole | string | null
): InventoryItem[] {
  if (canViewBuyingPrice(role)) {
    return items;
  }
  return items.map((item) => sanitizeInventoryItemForRole(item, role));
}

/**
 * Ensures that when a non-Owner (e.g. Staff/Salesman or Manager) creates or edits a product,
 * existing Owner cost values (`lotCostLandingPrice` and `variants[].costPrice`) are NEVER
 * overwritten or erased, and any client-injected costPrice from a non-Owner is ignored.
 */
export function preserveInventoryItemCosts(
  incoming: InventoryItem,
  existing: InventoryItem | undefined,
  role: UserRole | string | undefined | null,
  privateCostEntry?: PrivateProductCostRecord
): InventoryItem {
  if (canViewBuyingPrice(role)) {
    return incoming;
  }

  const preservedLotCost =
    existing?.lotCostLandingPrice ?? privateCostEntry?.lotCostLandingPrice ?? 0;

  const existingVariantMap = new Map<string, number>();
  if (existing && Array.isArray(existing.variants)) {
    for (const ev of existing.variants) {
      const key = `${ev.size || ''}::${ev.color || ''}`;
      existingVariantMap.set(key, ev.costPrice);
      if (ev.size && !existingVariantMap.has(ev.size)) {
        existingVariantMap.set(ev.size, ev.costPrice);
      }
    }
  }

  const preservedVariants = Array.isArray(incoming.variants)
    ? incoming.variants.map((v) => {
        const compositeKey = `${v.size || ''}::${v.color || ''}`;
        const existingVarCost =
          existingVariantMap.get(compositeKey) ??
          existingVariantMap.get(v.size) ??
          privateCostEntry?.variantCosts?.[compositeKey] ??
          privateCostEntry?.variantCosts?.[v.size] ??
          preservedLotCost;
        return {
          ...v,
          costPrice: existingVarCost,
        };
      })
    : [];

  return {
    ...incoming,
    lotCostLandingPrice: preservedLotCost,
    variants: preservedVariants,
  };
}

/**
 * Strips `defaultCostPrice` from category settings for roles that cannot view buying prices.
 */
export function sanitizeCategoryListForRole<T extends { defaultCostPrice?: number }>(
  categories: T[],
  role?: UserRole | string | null
): T[] {
  if (canViewBuyingPrice(role)) {
    return categories;
  }
  return categories.map((cat) => ({
    ...cat,
    defaultCostPrice: 0,
  }));
}

/**
 * Preserves existing Owner `defaultCostPrice` values when a non-Owner adds, renames, or updates
 * categories, MRP, bottomPrice, or defaultSizes.
 */
export function preserveCategoryCosts<
  T extends { id: string; name: string; defaultCostPrice: number }
>(
  incomingCategories: T[],
  existingCategories: T[],
  role?: UserRole | string | null,
  privateCategoryCosts?: Record<string, number>
): T[] {
  if (canViewBuyingPrice(role)) {
    return incomingCategories;
  }

  const costById = new Map<string, number>();
  const costByName = new Map<string, number>();

  for (const existing of existingCategories) {
    if (existing.id) costById.set(existing.id, existing.defaultCostPrice || 0);
    if (existing.name) {
      costByName.set(existing.name.trim().toLowerCase(), existing.defaultCostPrice || 0);
    }
  }

  if (privateCategoryCosts) {
    for (const [k, v] of Object.entries(privateCategoryCosts)) {
      if (!costById.has(k) || costById.get(k) === 0) {
        costById.set(k, v);
      }
      const lower = k.trim().toLowerCase();
      if (!costByName.has(lower) || costByName.get(lower) === 0) {
        costByName.set(lower, v);
      }
    }
  }

  return incomingCategories.map((cat) => {
    const cleanName = (cat.name || '').trim().toLowerCase();
    const preservedCost =
      (cat.id ? costById.get(cat.id) : undefined) ??
      costByName.get(cleanName) ??
      0;
    return {
      ...cat,
      defaultCostPrice: preservedCost,
    };
  });
}

/**
 * Strips `costPrice` from invoice line items when accessed by non-Owner roles.
 */
export function sanitizeInvoiceForRole(
  invoice: Invoice,
  role?: UserRole | string | null
): Invoice {
  if (canViewBuyingPrice(role)) {
    return invoice;
  }
  return {
    ...invoice,
    items: Array.isArray(invoice.items)
      ? invoice.items.map((line) => ({
          ...line,
          costPrice: 0,
        }))
      : [],
  };
}

export function sanitizeInvoiceListForRole(
  invoices: Invoice[],
  role?: UserRole | string | null
): Invoice[] {
  if (canViewBuyingPrice(role)) {
    return invoices;
  }
  return invoices.map((inv) => sanitizeInvoiceForRole(inv, role));
}

// ==========================================
// 9. CREDENTIAL HASHING & SANITIZATION (PARTNER PASSWORDS & STAFF PINS)
// ==========================================

/**
 * Pure, deterministic multi-round FNV-1a + SipHash-inspired 256-bit hex digest
 * that runs synchronously in both browser and Node.js without external dependencies.
 */
export function hashCredentialSync(secret: string, salt: string = 'lekho_sec_salt_v3'): string {
  const cleanSecret = String(secret || '').trim();
  const cleanSalt = String(salt || 'lekho_sec_salt_v3').trim();
  if (!cleanSecret) return '';

  const state = [
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
    0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
  ];
  const input = `${cleanSalt}::lekho_pbkdf::${cleanSecret}::${cleanSalt.length}`;

  for (let round = 0; round < 256; round++) {
    for (let i = 0; i < input.length; i++) {
      const code = input.charCodeAt(i);
      const lane = (i + round) & 7;
      let v = state[lane] ^ (code + round * 131 + i * 17);
      v = Math.imul(v ^ (v >>> 16), 0x85ebca6b);
      v = Math.imul(v ^ (v >>> 13), 0xc2b2ae35);
      v = (v ^ (v >>> 16)) >>> 0;
      state[lane] = v;
      state[(lane + 1) & 7] = (state[(lane + 1) & 7] + ((v << 7) | (v >>> 25))) >>> 0;
    }
  }

  return state.map((w) => (w >>> 0).toString(16).padStart(8, '0')).join('');
}

export function generateCredentialSalt(prefix: string = 'salt'): string {
  const rand = Math.random().toString(36).slice(2, 10);
  const time = Date.now().toString(36);
  return `${prefix}_${time}_${rand}`;
}

export function verifyCredentialSync(
  candidatePlain: string,
  expectedHash?: string,
  salt?: string,
  legacyPlain?: string
): boolean {
  const cleanCandidate = String(candidatePlain || '').trim();
  if (!cleanCandidate) return false;
  if (expectedHash) {
    const computed = hashCredentialSync(cleanCandidate, salt || 'lekho_sec_salt_v3');
    return computed === expectedHash;
  }
  if (legacyPlain) {
    return cleanCandidate === String(legacyPlain).trim();
  }
  return false;
}

export function migrateOwnerAccountCredentials(owner: OwnerAccount): OwnerAccount {
  const salt = owner.passwordSalt || `partner_${owner.id || owner.username || 'default'}`;
  let passwordHash = owner.passwordHash;
  if (!passwordHash && owner.password && owner.password.trim() !== '') {
    passwordHash = hashCredentialSync(owner.password.trim(), salt);
  }
  return {
    ...owner,
    password: '', // Never retain plaintext password
    passwordSalt: salt,
    passwordHash: passwordHash || '',
    hasPasswordSet: Boolean(passwordHash),
  };
}

export function sanitizePartnerForClient(owner: OwnerAccount): OwnerAccount {
  const migrated = migrateOwnerAccountCredentials(owner);
  return {
    ...migrated,
    password: '',
    passwordHash: undefined,
    passwordSalt: undefined,
    hasPasswordSet: Boolean(migrated.hasPasswordSet),
  };
}

export function migrateStaffCredentials(staff: StaffMember): StaffMember {
  const salt = staff.pinSalt || `staff_${staff.id || staff.phone || 'default'}`;
  let pinHash = staff.pinHash;
  if (!pinHash && staff.pin && staff.pin.trim() !== '' && staff.pin !== '••••') {
    pinHash = hashCredentialSync(staff.pin.trim(), salt);
  }
  return {
    ...staff,
    pin: '', // Never store or expose plaintext PIN
    pinSalt: salt,
    pinHash: pinHash || '',
    hasPinSet: Boolean(pinHash),
  };
}

export function sanitizeStaffForClient(staff: StaffMember): StaffMember {
  const migrated = migrateStaffCredentials(staff);
  return {
    ...migrated,
    pin: '',
    pinHash: undefined,
    pinSalt: undefined,
    passwordHash: undefined,
    hasPinSet: Boolean(migrated.hasPinSet),
  };
}

export function resolveSettingsSidePanelWidth(params: {
  showSettingsHub: boolean;
}): '85vw' | '100vw' {
  return params.showSettingsHub ? '85vw' : '100vw';
}

export function getSettingsSidePanelClassName(params: {
  isOpen: boolean;
  showSettingsHub: boolean;
}): string {
  const widthAndBorderClass = params.showSettingsHub
    ? 'w-[85vw] border-l'
    : 'w-[100vw] border-l-0';
  const openStateClass = params.isOpen
    ? 'translate-x-0'
    : 'translate-x-full pointer-events-none';
  return `fixed top-0 right-0 bottom-0 z-50 ${widthAndBorderClass} max-w-full bg-white dark:bg-zinc-950 shadow-2xl border-slate-200 dark:border-zinc-800 flex flex-col transform transition-[translate,transform,width] duration-300 ease-in-out ${openStateClass}`;
}
