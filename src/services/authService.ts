import { TenantShop, StaffMember, AuthSession, OfficialShopCategory, ShopProfile, UserRole } from '../types';
import { dbService } from './db';
import {
  auth,
  googleProvider,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut,
  updateProfile,
  firestoreDb,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  collection,
  query,
  where,
  getDocs,
  createSecondaryStaffUser,
} from './firebase';
import { firestoreSync, FirestoreUserProfile } from './firestoreSync';
import {
  canManageOperators,
  hashCredentialSync,
  generateCredentialSalt,
} from '../utils/securityPolicy';

const STORAGE_KEYS = {
  AUTH_SESSION: 'lekho_auth_session_v2',
  PENDING_MERCHANTS: 'lekho_pending_merchants_v3',
  PENDING_STAFF: 'lekho_pending_staff_v3',
};

interface PendingMerchantRegistration {
  fullName: string;
  shopName: string;
  shopCategory: OfficialShopCategory;
  phone: string;
  email: string;
  password: string;
  ownerPin: string;
  createdAt: number;
}

interface PendingStaffInvitation {
  staffId: string;
  shopId: string;
  fullName: string;
  email: string;
  phone: string;
  role: 'salesman' | 'manager' | 'owner';
  pinOrPassword: string;
  commissionPerPiece: number;
  canViewProfits: boolean;
  canViewDrawers: boolean;
  createdAt: number;
}

// In-memory locks to prevent race conditions / duplicate concurrent account creation
const activeRegistrationLocks = new Set<string>();
const inMemoryPendingMerchants = new Map<string, PendingMerchantRegistration>();
const inMemoryPendingStaff = new Map<string, PendingStaffInvitation>();

// Cryptographic SHA-256 hashing using Web Crypto API (supported in Browser and Node.js)
export async function hashString(str: string, salt: string = 'lekho_v3_dynamic'): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(`${str}:${salt}`);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

// Request a server-generated 6-digit OTP via /api/auth/otp/request
export async function requestServerEmailOTP(
  email: string,
  purpose: 'merchant_registration' | 'staff_invitation' | 'password_reset',
  recipientName: string = 'Merchant',
  shopId?: string
): Promise<{
  success: boolean;
  delivered?: boolean;
  smtpConfigured?: boolean;
  errorCode?: string;
  requiredEnvVars?: string[];
  expiresAt?: number;
  resendAvailableAt?: number;
  message: string;
}> {
  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    try {
      const currentSession = getStorage<AuthSession | null>(STORAGE_KEYS.AUTH_SESSION, null);
      if (currentSession?.uid) {
        headers['x-lekho-uid'] = currentSession.uid;
      }
      if (currentSession?.token) {
        headers['Authorization'] = `Bearer ${currentSession.token}`;
      }
    } catch {
      // ignore storage errors
    }

    const res = await fetch('/api/auth/otp/request', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        email: email.trim().toLowerCase(),
        purpose,
        recipientName,
        ...(shopId ? { shopId } : {}),
      }),
    });
    const data = await res.json();
    return {
      success: Boolean(res.ok && data.success),
      delivered: Boolean(data.delivered),
      smtpConfigured: data.smtpConfigured,
      errorCode: data.errorCode,
      requiredEnvVars: data.requiredEnvVars,
      expiresAt: data.expiresAt,
      resendAvailableAt: data.resendAvailableAt,
      message:
        data.message ||
        (res.ok ? '৬-ডিজিটের OTP পাঠানো হয়েছে।' : 'OTP ইমেইল পাঠানো সম্ভব হয়নি। অনুগ্রহ করে সার্ভারের SMTP কনফিগারেশন যাচাই করুন।'),
    };
  } catch (err: any) {
    return {
      success: false,
      delivered: false,
      errorCode: 'NETWORK_ERROR',
      message: err?.message || 'সার্ভারের সাথে সংযোগ স্থাপন করা যায়নি। ইন্টারনেট সংযোগ পরীক্ষা করুন।',
    };
  }
}

// Verify 6-digit OTP on the backend via /api/auth/otp/verify
export async function verifyServerEmailOTP(
  email: string,
  otp: string,
  purpose: 'merchant_registration' | 'staff_invitation' | 'password_reset'
): Promise<{
  success: boolean;
  verificationToken?: string;
  remainingAttempts?: number;
  errorCode?: string;
  message: string;
}> {
  try {
    const res = await fetch('/api/auth/otp/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email.trim().toLowerCase(), otp: otp.trim(), purpose }),
    });
    const data = await res.json();
    return {
      success: Boolean(res.ok && data.success),
      verificationToken: data.verificationToken,
      remainingAttempts: data.remainingAttempts,
      errorCode: data.errorCode,
      message: data.message || (res.ok ? 'OTP যাচাই সফল হয়েছে।' : 'ভুল OTP কোড।'),
    };
  } catch (err: any) {
    return {
      success: false,
      errorCode: 'NETWORK_ERROR',
      message: err?.message || 'OTP যাচাই করার সময় সার্ভার সংযোগ বিচ্ছিন্ন হয়েছে।',
    };
  }
}

// Consume single-use verification token on the backend
async function consumeServerVerificationToken(
  email: string,
  purpose: 'merchant_registration' | 'staff_invitation' | 'password_reset',
  verificationToken: string
): Promise<boolean> {
  try {
    const res = await fetch('/api/auth/otp/consume-token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email.trim().toLowerCase(), purpose, verificationToken }),
    });
    const data = await res.json();
    return Boolean(res.ok && data.success);
  } catch {
    return false;
  }
}

// Storage helpers (safe in both Browser and Node.js test environments)
function getStorage<T>(key: string, defaultVal: T): T {
  try {
    if (typeof localStorage === 'undefined') return defaultVal;
    const val = localStorage.getItem(key);
    return val ? JSON.parse(val) : defaultVal;
  } catch {
    return defaultVal;
  }
}

function setStorage<T>(key: string, val: T): void {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(key, JSON.stringify(val));
  } catch (err) {
    console.error(`Failed to save ${key} to storage`, err);
  }
}

function generateSecureRandomPin(): string {
  const arr = new Uint32Array(1);
  crypto.getRandomValues(arr);
  return String((arr[0] % 9000) + 1000);
}

function buildNewTenantObject(params: {
  shopId: string;
  ownerUid: string;
  shopName: string;
  fullName: string;
  phone: string;
  email: string;
  shopCategory: OfficialShopCategory;
  ownerPin?: string;
}): TenantShop {
  const internalProfile: ShopProfile = params.shopCategory === 'SPORTS WEAR' ? 'jersey' : 'clothing';
  const merchantId = `M-${Math.floor(100000 + Math.random() * 900000)}`;
  const nowIso = new Date().toISOString();
  // Never derive ownerPin from phone.slice(-4) or use '1234'/'5555'
  const safeOwnerPin =
    params.ownerPin && /^\d{4,8}$/.test(params.ownerPin) && !['1234', '5555', '0000'].includes(params.ownerPin)
      ? params.ownerPin
      : generateSecureRandomPin();

  return {
    id: params.shopId,
    name: params.shopName,
    bengaliName: params.shopName,
    slug: params.shopName.toLowerCase().replace(/[^a-z0-9]/g, '-'),
    ownerUid: params.ownerUid,
    memberUids: [params.ownerUid],
    memberRoles: {
      [params.ownerUid]: 'shop_owner',
    },
    ownerName: params.fullName,
    ownerPhone: params.phone,
    ownerEmail: params.email,
    email: params.email,
    ownerPin: safeOwnerPin,
    isEmailVerified: true,
    accountStatus: 'active',
    shopCategory: params.shopCategory,
    category: internalProfile,
    marketMallName: 'Main Store Branch',
    shopNo: 'Counter #01',
    returnPolicy: '3-day size exchange allowed with original receipt.',
    createdAt: nowIso,
    merchantId,
    coverPhoto: '/assets/aistudio/image_a4e83847.png',
    paymentSettings: {
      bkashMerchant: '',
      bkashPersonal: params.phone,
      nagad: params.phone,
      bankName: '',
      bankBranch: '',
      bankAccountNo: '',
      routingNo: '',
      binNumber: '',
      tradeLicenseNo: '',
      autoPrintReceipt: false,
      paperWidth: '80mm',
    },
    invoiceSettings: {
      headerSlogan:
        params.shopCategory === 'SPORTS WEAR'
          ? 'Premium Sports & Jersey Store'
          : 'Authentic Fashion & Apparel Store',
      invoicePrefix:
        params.shopName
          .replace(/[^A-Za-z]/g, '')
          .slice(0, 3)
          .toUpperCase() || 'INV',
      hotline: params.phone,
      showBinNumber: false,
      showSalesmanName: true,
      showCustomizationDetails: params.shopCategory === 'SPORTS WEAR',
      showQrCode: true,
      qrCodeType: 'verification',
      paperWidth: '80mm',
      footerNote: `Thank you for shopping at ${params.shopName}!`,
      returnPolicyNote: '3-day size exchange allowed with original receipt.',
    },
    clothingCategories:
      params.shopCategory === 'CLOTHING' ? dbService.getDefaultClothingCategories() : undefined,
    expenseCategories: dbService.getDefaultExpenseCategories(),
    storeConfig:
      params.shopCategory === 'CLOTHING'
        ? {
            ...dbService.getDefaultStoreConfig(),
            customClubs: [
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
            ],
            availableSizes: [
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
            ],
          }
        : dbService.getDefaultStoreConfig(),
    subscription: {
      plan: 'starter',
      status: 'active',
      amount: 499,
      trxId: `TRX_${Date.now()}`,
      senderPhone: params.phone,
      paymentMethod: 'bkash',
      submittedAt: nowIso,
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      graceEndsAt: new Date(Date.now() + 33 * 24 * 60 * 60 * 1000).toISOString(),
    },
    featureFlags: {
      jerseyCustomization: params.shopCategory === 'SPORTS WEAR',
      alterationTracker: params.shopCategory === 'CLOTHING',
      teamBulkOrders: params.shopCategory === 'SPORTS WEAR',
      staffPins: true,
      multiDrawer: true,
      resellerCounter: true,
    },
    stats: {
      totalSales: 0,
      totalOrders: 0,
      totalDueRecovered: 0,
      gmv: 0,
    },
  };
}

function formatFirebaseAuthError(error: any): string {
  const code = error?.code || '';
  if (code === 'auth/operation-not-allowed' || code === 'auth/configuration-not-found') {
    return 'Firebase Console-এ এখনো Email/Password সাইন-ইন অপশনটি চালু করা হয়নি। দয়া করে Firebase Console -> Authentication -> Sign-in method থেকে Email/Password Enable করুন অথবা "Continue with Google" ব্যবহার করুন।';
  }
  if (code === 'auth/email-already-in-use') {
    return 'এই ইমেইল দিয়ে ইতিমধ্যে একটি একাউন্ট খোলা আছে। অনুগ্রহ করে Log In করুন।';
  }
  if (code === 'auth/invalid-credential' || code === 'auth/wrong-password' || code === 'auth/user-not-found') {
    return 'ইমেইল অথবা পাসওয়ার্ড সঠিক নয়। অনুগ্রহ করে সঠিক তথ্য দিয়ে আবার চেষ্টা করুন।';
  }
  if (code === 'auth/weak-password') {
    return 'পাসওয়ার্ড কমপক্ষে ৬ অক্ষরের হতে হবে।';
  }
  if (code === 'auth/popup-closed-by-user') {
    return 'Google Sign-In পপআপটি বন্ধ করে দেওয়া হয়েছে। আবার চেষ্টা করুন।';
  }
  return error?.message || 'Authentication ব্যর্থ হয়েছে। আবার চেষ্টা করুন।';
}

export const authService = {
  // SESSION MANAGEMENT
  getSession(): AuthSession | null {
    const session = getStorage<AuthSession | null>(STORAGE_KEYS.AUTH_SESSION, null);
    if (!session) return null;

    if (new Date(session.expiresAt).getTime() < Date.now()) {
      this.clearSession();
      return null;
    }
    return session;
  },

  setSession(session: AuthSession): void {
    setStorage(STORAGE_KEYS.AUTH_SESSION, session);
  },

  updateSessionStoreInfo(updates: {
    shopName?: string;
    name?: string;
    email?: string;
    category?: ShopProfile;
    officialCategory?: OfficialShopCategory;
  }): AuthSession | null {
    const current = this.getSession();
    if (!current) return null;
    const updated: AuthSession = {
      ...current,
      ...(updates.shopName ? { shopName: updates.shopName } : {}),
      ...(updates.name ? { name: updates.name } : {}),
      ...(updates.email ? { email: updates.email } : {}),
      ...(updates.category ? { category: updates.category } : {}),
      ...(updates.officialCategory ? { officialCategory: updates.officialCategory } : {}),
    };
    this.setSession(updated);
    return updated;
  },

  clearSession(): void {
    firestoreSync.unsubscribeActiveShop();
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(STORAGE_KEYS.AUTH_SESSION);
      localStorage.setItem('lekho_logged_in', 'false');
    }
    void signOut(auth).catch(() => {});
  },

  // GOOGLE SIGN-IN (Sign In or Sign Up with Google via Firebase Auth + Firestore)
  async signInWithGoogle(registrationDetails?: {
    fullName?: string;
    shopName?: string;
    shopCategory?: OfficialShopCategory;
    phone?: string;
  }): Promise<{
    success: boolean;
    message: string;
    session?: AuthSession;
    needsShopSetup?: boolean;
    googleProfile?: { uid: string; email: string; name: string };
  }> {
    try {
      const credential = await signInWithPopup(auth, googleProvider);
      const user = credential.user;
      const cleanEmail = (user.email || '').trim().toLowerCase();

      // 1. Check if user is a Console-verified Platform Super Admin (/platform_admins/{uid})
      const isSuperAdmin = await firestoreSync.checkIsSuperAdmin(user.uid);

      // 2. Check if user profile already exists in Cloud Firestore (/users/{uid})
      const existingProfile = await firestoreSync.getUserProfile(user.uid);

      if (existingProfile && existingProfile.shopId) {
        const shop = await firestoreSync.getShop(existingProfile.shopId);
        if (shop) {
          if (shop.accountStatus === 'disabled') {
            await signOut(auth);
            return {
              success: false,
              message: 'আপনার স্টোর একাউন্টটি স্থগিত করা হয়েছে। সাপোর্টে যোগাযোগ করুন।',
            };
          }

          dbService.hydrateFromFirestore.shop(shop);
          dbService.setCurrentTenantId(shop.id);

          const effectiveRole: UserRole = isSuperAdmin ? 'super_admin' : existingProfile.role;
          const session: AuthSession = {
            token: await user.getIdToken(),
            uid: user.uid,
            userType: existingProfile.role === 'shop_owner' ? 'merchant' : 'staff',
            userId: user.uid,
            email: cleanEmail,
            name: existingProfile.name || user.displayName || shop.ownerName,
            phone: existingProfile.phone || shop.ownerPhone,
            shopId: shop.id,
            shopName: shop.name,
            category: shop.category,
            officialCategory: shop.shopCategory || (shop.category === 'jersey' ? 'SPORTS WEAR' : 'CLOTHING'),
            role: effectiveRole,
            isSuperAdminVerified: isSuperAdmin,
            authProvider: 'firebase_google',
            createdAt: new Date().toISOString(),
            expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          };

          this.setSession(session);
          if (typeof localStorage !== 'undefined') {
            localStorage.setItem('lekho_logged_in', 'true');
          }

          return {
            success: true,
            message: `স্বাগতম, ${session.name}! (${shop.name})`,
            session,
          };
        }
      }

      // 3. New Google User — if registrationDetails are provided, create their isolated Shop & UserProfile in Firestore
      if (registrationDetails?.shopName && registrationDetails?.phone) {
        const newShopId = `shop_${user.uid.slice(0, 10)}_${Date.now().toString(36)}`;
        const ownerName = (registrationDetails.fullName || user.displayName || 'Shop Owner').trim();
        const shopName = registrationDetails.shopName.trim();
        const shopCategory: OfficialShopCategory = registrationDetails.shopCategory || 'SPORTS WEAR';
        const phone = registrationDetails.phone.trim();

        const newTenant = buildNewTenantObject({
          shopId: newShopId,
          ownerUid: user.uid,
          shopName,
          fullName: ownerName,
          phone,
          email: cleanEmail,
          shopCategory,
        });

        await firestoreSync.createShop(newTenant, user.uid);
        const userProfile: FirestoreUserProfile = {
          uid: user.uid,
          email: cleanEmail,
          name: ownerName,
          phone,
          role: 'shop_owner',
          shopId: newShopId,
          shopName,
          createdAt: new Date().toISOString(),
        };
        await firestoreSync.createUserProfile(userProfile);

        dbService.addTenant(newTenant);
        dbService.setCurrentTenantId(newShopId);

        const effectiveRole: UserRole = isSuperAdmin ? 'super_admin' : 'shop_owner';
        const session: AuthSession = {
          token: await user.getIdToken().catch(() => ''),
          uid: user.uid,
          userType: 'merchant',
          userId: user.uid,
          email: cleanEmail,
          name: ownerName,
          phone,
          shopId: newShopId,
          shopName,
          category: newTenant.category,
          officialCategory: shopCategory,
          role: effectiveRole,
          isSuperAdminVerified: isSuperAdmin,
          authProvider: 'firebase_google',
          createdAt: new Date().toISOString(),
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        };

        this.setSession(session);
        if (typeof localStorage !== 'undefined') {
          localStorage.setItem('lekho_logged_in', 'true');
        }

        return {
          success: true,
          message: `${shopName} সফলভাবে তৈরি হয়েছে! LEKHO-তে স্বাগতম।`,
          session,
        };
      }

      // 4. Google user signed in on Login screen but has no shop yet -> prompt them to complete shop setup
      return {
        success: false,
        needsShopSetup: true,
        googleProfile: {
          uid: user.uid,
          email: cleanEmail,
          name: user.displayName || '',
        },
        message: 'আপনার Google একাউন্ট যাচাই হয়েছে! নতুন দোকান চালু করতে দোকানের নাম ও মোবাইল নম্বর দিন।',
      };
    } catch (error: any) {
      return {
        success: false,
        message: formatFirebaseAuthError(error),
      };
    }
  },

  // 1. MERCHANT REGISTRATION STEP 1: VALIDATE, PREVENT DUPLICATES & SEND REAL 6-DIGIT GMAIL OTP FIRST
  // Shop creation, Account activation, and Dashboard access are strictly blocked until OTP is verified in Step 2!
  async initiateMerchantRegistration(payload: {
    fullName: string;
    shopName: string;
    shopCategory: OfficialShopCategory;
    phone: string;
    email: string;
    password: string;
    ownerPin?: string;
  }): Promise<{
    success: boolean;
    message: string;
    otpId?: string;
    devOtp?: string;
    session?: AuthSession;
    directCreated?: boolean;
    smtpConfigured?: boolean;
    errorCode?: string;
  }> {
    const cleanEmail = payload.email.trim().toLowerCase();
    const cleanPhone = payload.phone.trim().replace(/[- ]/g, '');

    if (!payload.fullName.trim() || !payload.shopName.trim()) {
      return { success: false, message: 'মালিকের নাম এবং দোকানের নাম প্রদান করা আবশ্যক।' };
    }
    if (!/^01[3-9]\d{8}$/.test(cleanPhone)) {
      return { success: false, message: 'সঠিক ১১-ডিজিটের বাংলাদেশী মোবাইল নম্বর দিন (যেমন: 017xxxxxxxx)।' };
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      return { success: false, message: 'সঠিক ইমেইল (Gmail) ঠিকানা প্রদান করুন।' };
    }
    if (!payload.password || payload.password.length < 6) {
      return { success: false, message: 'পাসওয়ার্ড কমপক্ষে ৬ অক্ষরের হতে হবে।' };
    }

    // Duplicate registration check in loaded tenants
    const existingLocalShop = dbService
      .getTenants()
      .find(
        (t) =>
          (t.ownerEmail && t.ownerEmail.toLowerCase() === cleanEmail) ||
          (t.email && t.email.toLowerCase() === cleanEmail)
      );
    if (existingLocalShop) {
      return {
        success: false,
        errorCode: 'DUPLICATE_EMAIL',
        message: 'এই ইমেইল দিয়ে ইতিমধ্যে একটি দোকান নিবন্ধিত আছে। অনুগ্রহ করে Log In করুন।',
      };
    }

    // Request backend to generate & send real 6-digit OTP to Merchant's Gmail
    const otpDispatch = await requestServerEmailOTP(
      cleanEmail,
      'merchant_registration',
      payload.fullName.trim()
    );

    if (!otpDispatch.success) {
      return {
        success: false,
        smtpConfigured: otpDispatch.smtpConfigured,
        errorCode: otpDispatch.errorCode,
        message: otpDispatch.message,
      };
    }

    // Store pending registration data temporarily until OTP verification succeeds
    const pendingRecord: PendingMerchantRegistration = {
      fullName: payload.fullName.trim(),
      shopName: payload.shopName.trim(),
      shopCategory: payload.shopCategory,
      phone: cleanPhone,
      email: cleanEmail,
      password: payload.password,
      ownerPin: payload.ownerPin || generateSecureRandomPin(),
      createdAt: Date.now(),
    };

    inMemoryPendingMerchants.set(cleanEmail, pendingRecord);
    const storedMap = getStorage<Record<string, PendingMerchantRegistration>>(STORAGE_KEYS.PENDING_MERCHANTS, {});
    storedMap[cleanEmail] = pendingRecord;
    setStorage(STORAGE_KEYS.PENDING_MERCHANTS, storedMap);

    return {
      success: true,
      smtpConfigured: true,
      message: otpDispatch.message,
      directCreated: false,
    };
  },

  // 2. MERCHANT REGISTRATION STEP 2: VERIFY BACKEND OTP -> CREATE FIREBASE AUTH USER & FIRESTORE SHOP
  async verifyMerchantRegistration(email: string, enteredOtp: string): Promise<{
    success: boolean;
    message: string;
    session?: AuthSession;
  }> {
    const cleanEmail = email.trim().toLowerCase();

    // Prevent concurrent race-condition submissions for the same email
    if (activeRegistrationLocks.has(cleanEmail)) {
      return {
        success: false,
        message: 'আপনার একাউন্ট তৈরি প্রক্রিয়াধীন রয়েছে। অনুগ্রহ করে কয়েক সেকেন্ড অপেক্ষা করুন।',
      };
    }

    const storedMap = getStorage<Record<string, PendingMerchantRegistration>>(STORAGE_KEYS.PENDING_MERCHANTS, {});
    const pending = inMemoryPendingMerchants.get(cleanEmail) || storedMap[cleanEmail];

    if (!pending) {
      return {
        success: false,
        message: 'এই ইমেইলের জন্য কোনো অপেক্ষমাণ রেজিস্ট্রেশন পাওয়া যায়নি। অনুগ্রহ করে আবার ফর্মটি পূরণ করুন।',
      };
    }

    activeRegistrationLocks.add(cleanEmail);

    try {
      // 1. Verify OTP on the Backend (never on the frontend)
      const verifyResult = await verifyServerEmailOTP(cleanEmail, enteredOtp.trim(), 'merchant_registration');
      if (!verifyResult.success || !verifyResult.verificationToken) {
        return {
          success: false,
          message: verifyResult.message,
        };
      }

      // 2. Consume the single-use verification token on the backend
      const tokenConsumed = await consumeServerVerificationToken(
        cleanEmail,
        'merchant_registration',
        verifyResult.verificationToken
      );
      if (!tokenConsumed) {
        return {
          success: false,
          message: 'OTP ভেরিফিকেশন টোকেন যাচাই করা যায়নি। অনুগ্রহ করে পুনরায় চেষ্টা করুন।',
        };
      }

      // 3. Create Firebase Authentication user (or use already-authenticated Google user if matching email)
      let user = auth.currentUser && auth.currentUser.email?.toLowerCase() === cleanEmail ? auth.currentUser : null;
      if (!user) {
        const userCred = await createUserWithEmailAndPassword(auth, cleanEmail, pending.password);
        user = userCred.user;
        await updateProfile(user, { displayName: pending.fullName }).catch(() => {});
      }

      // 4. Create isolated TenantShop (/shops/{shopId}) and UserProfile (/users/{uid}) in Cloud Firestore
      const newShopId = `shop_${user.uid.slice(0, 10)}_${Date.now().toString(36)}`;
      const newTenant = buildNewTenantObject({
        shopId: newShopId,
        ownerUid: user.uid,
        shopName: pending.shopName,
        fullName: pending.fullName,
        phone: pending.phone,
        email: cleanEmail,
        shopCategory: pending.shopCategory,
        ownerPin: pending.ownerPin,
      });

      await firestoreSync.createShop(newTenant, user.uid);
      const userProfile: FirestoreUserProfile = {
        uid: user.uid,
        email: cleanEmail,
        name: pending.fullName,
        phone: pending.phone,
        role: 'shop_owner',
        shopId: newShopId,
        shopName: pending.shopName,
        createdAt: new Date().toISOString(),
      };
      await firestoreSync.createUserProfile(userProfile);

      // Clear pending registration state
      inMemoryPendingMerchants.delete(cleanEmail);
      delete storedMap[cleanEmail];
      setStorage(STORAGE_KEYS.PENDING_MERCHANTS, storedMap);

      dbService.addTenant(newTenant);
      dbService.setCurrentTenantId(newShopId);

      const isSuperAdmin = await firestoreSync.checkIsSuperAdmin(user.uid);
      const session: AuthSession = {
        token: await user.getIdToken().catch(() => ''),
        uid: user.uid,
        userType: 'merchant',
        userId: user.uid,
        email: cleanEmail,
        name: pending.fullName,
        phone: pending.phone,
        shopId: newShopId,
        shopName: pending.shopName,
        category: newTenant.category,
        officialCategory: pending.shopCategory,
        role: isSuperAdmin ? 'super_admin' : 'shop_owner',
        isSuperAdminVerified: isSuperAdmin,
        authProvider: 'firebase_email',
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      };

      this.setSession(session);
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('lekho_logged_in', 'true');
      }

      return {
        success: true,
        message: `Gmail যাচাই সম্পন্ন! ${newTenant.name} সফলভাবে চালু হয়েছে।`,
        session,
      };
    } catch (error: any) {
      return {
        success: false,
        message: formatFirebaseAuthError(error),
      };
    } finally {
      activeRegistrationLocks.delete(cleanEmail);
    }
  },

  // 3. RESEND OTP (Calls Backend /api/auth/otp/request to invalidate previous OTP & enforce 60s cooldown)
  async resendOTP(
    email: string,
    type: 'merchant_registration' | 'staff_invitation' | 'password_reset'
  ): Promise<{
    success: boolean;
    message: string;
    devOtp?: string;
    cooldownSeconds?: number;
  }> {
    const cleanEmail = email.trim().toLowerCase();
    const pendingMerchant = inMemoryPendingMerchants.get(cleanEmail);
    const pendingStaff = inMemoryPendingStaff.get(cleanEmail);
    const recipientName = pendingMerchant?.fullName || pendingStaff?.fullName || 'Merchant';

    const otpRes = await requestServerEmailOTP(cleanEmail, type, recipientName);
    if (!otpRes.success) {
      return {
        success: false,
        message: otpRes.message,
      };
    }

    return {
      success: true,
      message: otpRes.message,
      cooldownSeconds: 60,
    };
  },

  // 4. MERCHANT LOGIN (Firebase Authentication + Cloud Firestore Profile & Shop Lookup)
  // Zero hardcoded PINs ('1234', '5555' removed!)
  async loginMerchant(
    email: string,
    passwordPlain: string
  ): Promise<{
    success: boolean;
    message: string;
    session?: AuthSession;
    needsVerification?: boolean;
    email?: string;
  }> {
    const cleanEmail = email.trim().toLowerCase();

    try {
      const credential = await signInWithEmailAndPassword(auth, cleanEmail, passwordPlain);
      const user = credential.user;

      // 1. Check Console-verified Super Admin status in /platform_admins/{uid}
      const isSuperAdmin = await firestoreSync.checkIsSuperAdmin(user.uid);

      // 2. Load UserProfile from /users/{uid}
      const profile = await firestoreSync.getUserProfile(user.uid);
      if (!profile || !profile.shopId) {
        await signOut(auth);
        return {
          success: false,
          message: 'এই একাউন্টের সাথে কোনো দোকান যুক্ত পাওয়া যায়নি। নতুন দোকান খুলতে Sign Up করুন।',
        };
      }

      // 3. Load TenantShop from /shops/{shopId}
      const shop = await firestoreSync.getShop(profile.shopId);
      if (!shop) {
        await signOut(auth);
        return {
          success: false,
          message: 'দোকানের প্রোফাইল ডাটাবেসে পাওয়া যায়নি।',
        };
      }

      if (shop.accountStatus === 'disabled') {
        await signOut(auth);
        return {
          success: false,
          message: 'আপনার মার্চেন্ট একাউন্টটি নিষ্ক্রিয় করা হয়েছে। সাপোর্টে যোগাযোগ করুন।',
        };
      }

      dbService.hydrateFromFirestore.shop(shop);
      dbService.setCurrentTenantId(shop.id);

      const effectiveRole: UserRole = isSuperAdmin ? 'super_admin' : profile.role;
      const session: AuthSession = {
        token: await user.getIdToken().catch(() => ''),
        uid: user.uid,
        userType: profile.role === 'shop_owner' ? 'merchant' : 'staff',
        userId: user.uid,
        email: cleanEmail,
        name: profile.name || shop.ownerName,
        phone: profile.phone || shop.ownerPhone,
        shopId: shop.id,
        shopName: shop.name,
        category: shop.category,
        officialCategory: shop.shopCategory || (shop.category === 'jersey' ? 'SPORTS WEAR' : 'CLOTHING'),
        role: effectiveRole,
        isSuperAdminVerified: isSuperAdmin,
        authProvider: 'firebase_email',
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      };

      this.setSession(session);
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('lekho_logged_in', 'true');
      }

      return {
        success: true,
        message: `স্বাগতম, ${session.name}! (${shop.name})`,
        session,
      };
    } catch (error: any) {
      return {
        success: false,
        message: formatFirebaseAuthError(error),
      };
    }
  },

  // 5. STAFF LOGIN (Firebase Auth + Firestore Role & Active Status Verification)
  async loginStaff(
    email: string,
    passwordPlain: string
  ): Promise<{
    success: boolean;
    message: string;
    session?: AuthSession;
  }> {
    const cleanEmail = email.trim().toLowerCase();

    try {
      const credential = await signInWithEmailAndPassword(auth, cleanEmail, passwordPlain);
      const user = credential.user;

      // Check staff invitation record first to verify active/revoked status
      let inviteData: Record<string, any> | null = null;
      const invQuery = query(collection(firestoreDb, 'staff_invitations'), where('email', '==', cleanEmail));
      const invSnap = await getDocs(invQuery).catch(() => null);
      if (invSnap && !invSnap.empty) {
        inviteData = invSnap.docs[0].data();
        if (inviteData.status === 'disabled' || inviteData.status === 'revoked' || inviteData.active === false) {
          await signOut(auth);
          return {
            success: false,
            message: 'আপনার স্টাফ একাউন্টটি দোকানের মালিক কর্তৃক নিষ্ক্রিয় (Deactivated) করা হয়েছে।',
          };
        }
      }

      // Check user profile in Firestore (/users/{uid})
      let profile = await firestoreSync.getUserProfile(user.uid);

      // If staff user hasn't linked their /users/{uid} yet, create it from the verified /staff_invitations record
      if (!profile && inviteData && inviteData.shopId) {
        const newProfile: FirestoreUserProfile = {
          uid: user.uid,
          email: cleanEmail,
          name: inviteData.name || user.displayName || 'Staff Member',
          phone: inviteData.phone || '',
          role: inviteData.role === 'manager' ? 'manager' : 'salesman',
          shopId: inviteData.shopId,
          shopName: inviteData.shopName || '',
          createdAt: new Date().toISOString(),
        };
        await firestoreSync.createUserProfile(newProfile);
        profile = newProfile;
      }

      if (!profile || !profile.shopId) {
        await signOut(auth);
        return {
          success: false,
          message: 'এই ইমেইলটি কোনো দোকানের সক্রিয় স্টাফ হিসেবে নিবন্ধিত নয়। দোকানের মালিকের সাথে যোগাযোগ করুন।',
        };
      }

      const shop = await firestoreSync.getShop(profile.shopId);
      if (!shop) {
        await signOut(auth);
        return {
          success: false,
          message: 'সংশ্লিষ্ট দোকানটি ডাটাবেসে পাওয়া যায়নি।',
        };
      }

      // Enforce shop accountStatus check
      if (shop.accountStatus === 'disabled') {
        await signOut(auth);
        return {
          success: false,
          message: 'এই স্টোরের একাউন্টটি বর্তমানে নিষ্ক্রিয় রয়েছে। স্টোর মালিকের সাথে যোগাযোগ করুন।',
        };
      }

      // Verify staff is either an active member or currently invited on the shop
      const isAlreadyMember =
        shop.ownerUid === user.uid || (Array.isArray(shop.memberUids) && shop.memberUids.includes(user.uid));
      const isEmailInvited =
        Array.isArray(shop.invitedStaffEmails) &&
        shop.invitedStaffEmails.map((e) => e.toLowerCase()).includes(cleanEmail);

      if (!isAlreadyMember && !isEmailInvited) {
        await signOut(auth);
        return {
          success: false,
          message: 'আপনার স্টাফ এক্সেস বাতিল বা নিষ্ক্রিয় করা হয়েছে। দোকানের মালিকের সাথে যোগাযোগ করুন।',
        };
      }

      if (!isAlreadyMember && isEmailInvited) {
        const updatedMemberUids = Array.from(new Set([...(shop.memberUids || []), user.uid]));
        const updatedMemberRoles: Record<string, 'shop_owner' | 'manager' | 'salesman'> = {
          ...(shop.memberRoles || {}),
          [user.uid]: profile.role === 'manager' ? 'manager' : 'salesman',
        };
        if (shop.ownerUid) {
          updatedMemberRoles[shop.ownerUid] = 'shop_owner';
        }
        shop.memberUids = updatedMemberUids;
        shop.memberRoles = updatedMemberRoles;
        await updateDoc(doc(firestoreDb, 'shops', shop.id), {
          memberUids: updatedMemberUids,
          memberRoles: updatedMemberRoles,
        }).catch(() => {});
      }

      // Also check the shop's staff subcollection to ensure this staff member is not disabled
      const staffSnap = await getDocs(collection(firestoreDb, 'shops', shop.id, 'staff')).catch(() => null);
      if (staffSnap && !staffSnap.empty) {
        const matchingStaffDoc = staffSnap.docs
          .map((d) => d.data() as StaffMember)
          .find((s) => (s.email && s.email.toLowerCase() === cleanEmail) || s.uid === user.uid);
        if (matchingStaffDoc && (matchingStaffDoc.active === false || matchingStaffDoc.status === 'disabled' || matchingStaffDoc.status === 'pending_verification')) {
          await signOut(auth);
          return {
            success: false,
            message:
              matchingStaffDoc.status === 'pending_verification'
                ? 'আপনার স্টাফ ইমেইলটি এখনো OTP দিয়ে যাচাই করা হয়নি।'
                : 'আপনার স্টাফ একাউন্টটি নিষ্ক্রিয় (Deactivated) করা হয়েছে।',
          };
        }
      }

      dbService.hydrateFromFirestore.shop(shop);
      dbService.setCurrentTenantId(shop.id);

      const staffRole: UserRole = profile.role === 'manager' ? 'manager' : 'salesman';
      const session: AuthSession = {
        token: await user.getIdToken().catch(() => ''),
        uid: user.uid,
        userType: 'staff',
        userId: user.uid,
        email: cleanEmail,
        name: profile.name,
        phone: profile.phone,
        shopId: shop.id,
        shopName: shop.name,
        category: shop.category,
        officialCategory: shop.shopCategory || (shop.category === 'jersey' ? 'SPORTS WEAR' : 'CLOTHING'),
        role: staffRole,
        authProvider: 'firebase_email',
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      };

      this.setSession(session);
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('lekho_logged_in', 'true');
      }

      return {
        success: true,
        message: `স্বাগতম, ${profile.name}! (${shop.name})`,
        session,
      };
    } catch (error: any) {
      return {
        success: false,
        message: formatFirebaseAuthError(error),
      };
    }
  },

  // 6. FORGOT & RESET PASSWORD (Uses official Firebase Password Reset Email)
  async initiatePasswordReset(email: string): Promise<{ success: boolean; message: string; devOtp?: string }> {
    const cleanEmail = email.trim().toLowerCase();
    try {
      await sendPasswordResetEmail(auth, cleanEmail);
      return {
        success: true,
        message: `${cleanEmail} ঠিকানায় পাসওয়ার্ড রিসেট করার লিংক পাঠানো হয়েছে। আপনার ইমেইল ইনবক্স ও স্প্যাম ফোল্ডার চেক করে নতুন পাসওয়ার্ড সেট করুন।`,
      };
    } catch (error: any) {
      return {
        success: false,
        message: formatFirebaseAuthError(error),
      };
    }
  },

  async completePasswordReset(_email: string, _otp: string, _newPasswordPlain: string): Promise<{
    success: boolean;
    message: string;
  }> {
    return {
      success: true,
      message: 'আপনার ইমেইলে পাঠানো Firebase Password Reset লিংকে ক্লিক করে নতুন পাসওয়ার্ড সেট করুন।',
    };
  },

  // 7. OWNER ADD STAFF WITH BACKEND GMAIL OTP VERIFICATION FIRST
  async inviteStaffMember(
    shopId: string,
    payload: {
      fullName: string;
      email: string;
      phone: string;
      role: 'salesman' | 'manager' | 'owner';
      pinOrPassword: string;
      commissionPerPiece?: number;
      canViewProfits?: boolean;
      canViewDrawers?: boolean;
    },
    callerRole?: UserRole
  ): Promise<{ success: boolean; message: string; staffId?: string; devOtp?: string }> {
    const effectiveRole = dbService.getEffectiveRole(callerRole);
    if (!canManageOperators(effectiveRole)) {
      return {
        success: false,
        message: 'শুধুমাত্র দোকানের মালিক (Shop Owner) নতুন স্টাফ আমন্ত্রণ করতে পারবেন।',
      };
    }

    const cleanEmail = payload.email.trim().toLowerCase();
    const cleanSecret = payload.pinOrPassword.trim();
    const staffList = dbService.getShopStaff(shopId, effectiveRole);

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      return { success: false, message: 'স্টাফের সঠিক Gmail ঠিকানা প্রদান করুন।' };
    }

    if (cleanSecret.length < 6) {
      return {
        success: false,
        message: 'স্টাফের লগইন নিরাপত্তার জন্য পাসওয়ার্ড কমপক্ষে ৬ অক্ষরের হতে হবে (প্রথম ৪ ডিজিট কাউন্টার পিন হিসেবে কাজ করবে)।',
      };
    }

    if (staffList.some((s) => s.email && s.email.toLowerCase() === cleanEmail && s.status === 'active')) {
      return { success: false, message: 'এই ইমেইল দিয়ে ইতিমধ্যে একজন সক্রিয় স্টাফ যুক্ত করা হয়েছে।' };
    }

    // Request real 6-digit OTP on the backend for the staff member's Gmail
    const otpDispatch = await requestServerEmailOTP(cleanEmail, 'staff_invitation', payload.fullName.trim(), shopId);
    if (!otpDispatch.success) {
      return {
        success: false,
        message: otpDispatch.message,
      };
    }

    const staffId = `staff_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const passwordHash = await hashString(cleanSecret, cleanEmail);
    const pinSalt = generateCredentialSalt('staff_pin');
    const pinHash = hashCredentialSync(cleanSecret.slice(0, 4), pinSalt);

    // Record staff member in pending_verification state (NOT active until OTP is verified!)
    const newStaff: StaffMember = {
      id: staffId,
      shopId,
      name: payload.fullName.trim(),
      email: cleanEmail,
      phone: payload.phone.trim(),
      pin: '',
      pinSalt,
      pinHash,
      hasPinSet: true,
      passwordHash,
      role: payload.role,
      active: false,
      isEmailVerified: false,
      status: 'pending_verification',
      commissionPerPiece: payload.commissionPerPiece || 0,
      permissions: {
        canViewProfits: payload.canViewProfits ?? false,
        canViewDrawers: payload.canViewDrawers ?? (payload.role === 'owner' || payload.role === 'manager'),
        canAlterStock: payload.role === 'manager' || payload.role === 'owner',
        canGiveDiscount: true,
      },
      invitedAt: new Date().toISOString(),
    };

    const filteredList = staffList.filter((s) => !s.email || s.email.toLowerCase() !== cleanEmail);
    filteredList.push(newStaff);
    dbService.updateShopStaff(shopId, filteredList, effectiveRole);

    const pendingInvite: PendingStaffInvitation = {
      staffId,
      shopId,
      fullName: payload.fullName.trim(),
      email: cleanEmail,
      phone: payload.phone.trim(),
      role: payload.role,
      pinOrPassword: cleanSecret,
      commissionPerPiece: payload.commissionPerPiece || 0,
      canViewProfits: payload.canViewProfits ?? false,
      canViewDrawers: payload.canViewDrawers ?? (payload.role === 'owner' || payload.role === 'manager'),
      createdAt: Date.now(),
    };

    inMemoryPendingStaff.set(cleanEmail, pendingInvite);
    const storedStaffMap = getStorage<Record<string, PendingStaffInvitation>>(STORAGE_KEYS.PENDING_STAFF, {});
    storedStaffMap[cleanEmail] = pendingInvite;
    setStorage(STORAGE_KEYS.PENDING_STAFF, storedStaffMap);

    return {
      success: true,
      message: `${cleanEmail} ঠিকানায় ৬-ডিজিটের OTP পাঠানো হয়েছে। OTP যাচাই করলে স্টাফ একাউন্ট সক্রিয় হবে।`,
      staffId: newStaff.id,
    };
  },

  // 8. VERIFY STAFF OTP & ACTIVATE REAL FIREBASE AUTH STAFF ACCOUNT + FIRESTORE LINKING
  async verifyStaffEmail(email: string, enteredOtp: string, callerRole?: UserRole): Promise<{ success: boolean; message: string }> {
    const effectiveRole = dbService.getEffectiveRole(callerRole);
    if (!canManageOperators(effectiveRole)) {
      return {
        success: false,
        message: 'শুধুমাত্র দোকানের মালিক (Shop Owner) স্টাফ আমন্ত্রণ যাচাই ও সক্রিয় করতে পারবেন।',
      };
    }

    const cleanEmail = email.trim().toLowerCase();
    const storedStaffMap = getStorage<Record<string, PendingStaffInvitation>>(STORAGE_KEYS.PENDING_STAFF, {});
    const pendingInvite = inMemoryPendingStaff.get(cleanEmail) || storedStaffMap[cleanEmail];

    if (!pendingInvite) {
      return {
        success: false,
        message: 'এই স্টাফ ইমেইলের জন্য কোনো অপেক্ষমাণ আমন্ত্রণ পাওয়া যায়নি। অনুগ্রহ করে আবার চেষ্টা করুন।',
      };
    }

    // 1. Verify OTP on the backend
    const verifyRes = await verifyServerEmailOTP(cleanEmail, enteredOtp.trim(), 'staff_invitation');
    if (!verifyRes.success || !verifyRes.verificationToken) {
      return {
        success: false,
        message: verifyRes.message,
      };
    }

    const tokenValid = await consumeServerVerificationToken(
      cleanEmail,
      'staff_invitation',
      verifyRes.verificationToken
    );
    if (!tokenValid) {
      return {
        success: false,
        message: 'OTP টোকেন যাচাই করা যায়নি। অনুগ্রহ করে পুনরায় চেষ্টা করুন।',
      };
    }

    try {
      // 2. Create the staff member's Firebase Authentication account via Secondary App
      // so the Shop Owner's session is never signed out
      let staffUid: string | undefined;
      try {
        const created = await createSecondaryStaffUser(
          cleanEmail,
          pendingInvite.pinOrPassword,
          pendingInvite.fullName
        );
        staffUid = created.uid;
      } catch (fbErr: any) {
        // If email-already-in-use in Firebase Auth, allow linking by invited email
        if (fbErr?.code !== 'auth/email-already-in-use') {
          return {
            success: false,
            message: formatFirebaseAuthError(fbErr),
          };
        }
      }

      const firestoreRole: 'manager' | 'salesman' = pendingInvite.role === 'manager' ? 'manager' : 'salesman';

      // 3. Activate Staff record in shop's staff list
      const staffList = dbService.getShopStaff(pendingInvite.shopId, effectiveRole);
      const updatedStaffList = staffList.map((s) =>
        s.id === pendingInvite.staffId || (s.email && s.email.toLowerCase() === cleanEmail)
          ? {
              ...s,
              ...(staffUid ? { uid: staffUid } : {}),
              active: true,
              isEmailVerified: true,
              status: 'active' as const,
            }
          : s
      );
      dbService.updateShopStaff(pendingInvite.shopId, updatedStaffList, effectiveRole);

      // 4. Link Staff UID & Email into TenantShop (/shops/{shopId})
      const tenant = dbService.getTenantById(pendingInvite.shopId);
      if (tenant) {
        const invitedStaffEmails = Array.from(new Set([...(tenant.invitedStaffEmails || []), cleanEmail]));
        const memberUids = staffUid
          ? Array.from(new Set([...(tenant.memberUids || []), staffUid]))
          : tenant.memberUids || [];
        const memberRoles: Record<string, 'shop_owner' | 'manager' | 'salesman'> = {
          ...(tenant.memberRoles || {}),
          ...(staffUid ? { [staffUid]: firestoreRole } : {}),
        };
        if (tenant.ownerUid) {
          memberRoles[tenant.ownerUid] = 'shop_owner';
        }
        dbService.updateTenant(pendingInvite.shopId, {
          invitedStaffEmails,
          memberUids,
          memberRoles,
        });
      }

      // 5. Record active invitation in /staff_invitations/{staffId}
      if (firestoreSync.isFirebaseActive()) {
        await setDoc(doc(firestoreDb, 'staff_invitations', pendingInvite.staffId), {
          id: pendingInvite.staffId,
          shopId: pendingInvite.shopId,
          shopName: tenant?.name || '',
          email: cleanEmail,
          name: pendingInvite.fullName,
          phone: pendingInvite.phone,
          role: firestoreRole,
          status: 'active',
          active: true,
          ...(staffUid ? { staffUid } : {}),
          createdAt: new Date().toISOString(),
        }).catch(() => {});
      }

      inMemoryPendingStaff.delete(cleanEmail);
      delete storedStaffMap[cleanEmail];
      setStorage(STORAGE_KEYS.PENDING_STAFF, storedStaffMap);

      return {
        success: true,
        message: `স্টাফ একাউন্ট (${pendingInvite.fullName} - ${cleanEmail}) সফলভাবে যাচাই ও সক্রিয় হয়েছে!`,
      };
    } catch (err: any) {
      return {
        success: false,
        message: err?.message || 'স্টাফ একাউন্ট সক্রিয় করতে সমস্যা হয়েছে।',
      };
    }
  },

  // 9. OWNER TOGGLE STAFF ACTIVE STATUS (Immediately revokes or restores Firestore Shop & Login access)
  toggleStaffStatus(shopId: string, staffId: string, newActiveStatus: boolean, callerRole?: UserRole): boolean {
    const effectiveRole = dbService.getEffectiveRole(callerRole);
    if (!canManageOperators(effectiveRole)) {
      return false;
    }

    const staffList = dbService.getShopStaff(shopId, effectiveRole);
    const target = staffList.find((s) => s.id === staffId);
    if (!target) return false;

    target.active = newActiveStatus;
    target.status = newActiveStatus ? 'active' : 'disabled';
    dbService.updateShopStaff(shopId, staffList, effectiveRole);

    // Immediately sync revocation or restoration to /shops/{shopId} (memberUids, memberRoles, invitedStaffEmails)
    const tenant = dbService.getTenantById(shopId);
    if (tenant) {
      const cleanStaffEmail = (target.email || '').trim().toLowerCase();
      let updatedEmails = [...(tenant.invitedStaffEmails || [])];
      let updatedMemberUids = [...(tenant.memberUids || [])];
      const updatedMemberRoles: Record<string, 'shop_owner' | 'manager' | 'salesman'> = {
        ...(tenant.memberRoles || {}),
      };

      if (!newActiveStatus) {
        if (cleanStaffEmail) {
          updatedEmails = updatedEmails.filter((e) => e.toLowerCase() !== cleanStaffEmail);
        }
        if (target.uid && target.uid !== tenant.ownerUid) {
          updatedMemberUids = updatedMemberUids.filter((u) => u !== target.uid);
          delete updatedMemberRoles[target.uid];
        }
      } else {
        if (cleanStaffEmail) {
          updatedEmails = Array.from(new Set([...updatedEmails, cleanStaffEmail]));
        }
        if (target.uid) {
          updatedMemberUids = Array.from(new Set([...updatedMemberUids, target.uid]));
          updatedMemberRoles[target.uid] = target.role === 'manager' ? 'manager' : 'salesman';
        }
      }

      if (tenant.ownerUid) {
        updatedMemberRoles[tenant.ownerUid] = 'shop_owner';
      }

      dbService.updateTenant(shopId, {
        invitedStaffEmails: updatedEmails,
        memberUids: updatedMemberUids,
        memberRoles: updatedMemberRoles,
      });
    }

    // Also update /staff_invitations/{staffId} in Firestore
    if (firestoreSync.isFirebaseActive()) {
      void updateDoc(doc(firestoreDb, 'staff_invitations', staffId), {
        active: newActiveStatus,
        status: newActiveStatus ? 'active' : 'disabled',
        updatedAt: new Date().toISOString(),
      }).catch(() => {});
    }

    const currentSession = this.getSession();
    if (
      currentSession &&
      (currentSession.userId === staffId ||
        (target.uid && currentSession.uid === target.uid) ||
        (target.email && currentSession.email.toLowerCase() === target.email.toLowerCase())) &&
      !newActiveStatus
    ) {
      this.clearSession();
    }
    return true;
  },
};
