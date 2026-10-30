import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { TenantShop, UserRole, StaffMember, FeatureFlags } from '../types';
import { dbService } from '../services/db';
import { authService } from '../services/authService';
import { auth, onAuthStateChanged } from '../services/firebase';
import { firestoreSync } from '../services/firestoreSync';
import {
  canUserAccessShop,
  evaluateRoleSwitch,
  sanitizeTenantSecretsForRole,
  verifyCredentialSync,
  verifyTenantOwnerPin,
} from '../utils/securityPolicy';
import {
  AppLanguage,
  getLanguageStorageKey,
  normalizeAppLanguage,
  pickLocalizedText,
  translateUI,
} from '../utils/i18n';

interface AppContextType {
  tenants: TenantShop[];
  currentTenant: TenantShop;
  role: UserRole;
  activeStaff: StaffMember | null;
  isImpersonating: boolean;
  isLocked: boolean;
  isOffline: boolean;
  theme: 'dark' | 'light';
  language: AppLanguage;
  featureFlags: FeatureFlags;
  isAuthenticated: boolean;
  
  // Actions
  setLanguage: (lang: AppLanguage) => void;
  t: (key: string, fallback?: string) => string;
  pickText: (bnText: string, enText: string) => string;
  setIsAuthenticated: (val: boolean) => void;
  syncFromAuthSession: () => void;
  logout: () => void;
  switchTenant: (tenantId: string) => void;
  switchRole: (role: UserRole) => void;
  switchStaff: (staff: StaffMember) => void;
  impersonateShop: (shopId: string) => void;
  exitImpersonation: () => void;
  loginWithPin: (pin: string) => { success: boolean; staff?: StaffMember; message?: string };
  verifyOwnerPin: (pin: string) => boolean;
  lockRegister: () => void;
  toggleTheme: () => void;
  toggleSimulatedOffline: () => void;
  updateTenantFlags: (flags: Partial<FeatureFlags>) => void;
  reloadShopData: () => void;
  showToast: (message: string, type?: 'success' | 'error' | 'warning' | 'info') => void;
  dismissToast: () => void;
  toast: { message: string; type: 'success' | 'error' | 'warning' | 'info' } | null;
}

const AppContext = createContext<AppContextType | null>(null);

const ensureSessionTenant = (): { tenants: TenantShop[]; activeShopId: string } => {
  const session = authService.getSession();
  if (session?.shopId) {
    let existing = dbService.getTenantById(session.shopId);
    if (!existing && session.shopName) {
      const isSports = session.officialCategory === 'SPORTS WEAR' || session.category === 'jersey';
      const newTenant: TenantShop = {
        id: session.shopId,
        ownerUid: session.uid || session.userId,
        memberUids: [session.uid || session.userId],
        memberRoles: { [session.uid || session.userId]: 'shop_owner' },
        merchantId: `MRC-${session.shopId.slice(-6).toUpperCase()}`,
        name: session.shopName,
        ownerName: (session as any).fullName || session.name || 'Store Owner',
        ownerPhone: (session as any).phone || '',
        email: session.email,
        ownerEmail: session.email,
        isEmailVerified: true,
        accountStatus: 'active',
        shopCategoryType: isSports ? 'SPORTS WEAR' : 'CLOTHING',
        category: isSports ? 'jersey' : 'clothing',
        marketMallName: 'Retail Outlet',
        shopNo: 'Main Counter',
        returnPolicy: '৭ দিনের মধ্যে মূল্য রসিদসহ সাইজ পরিবর্তনযোগ্য।',
        ownerPin: '',
        subscription: {
          plan: 'pro',
          status: 'active',
          monthlyFeeBdt: 1500,
          expiresAt: '2027-12-31',
          lastPaidAt: new Date().toISOString().split('T')[0],
        },
        featureFlags: {
          offlinePos: true,
          whatsAppReceipts: true,
          multiDrawer: true,
          blindProfitMode: true,
          alterationTracking: true,
          alterationTracker: !isSports,
          jerseyCustomization: isSports,
          resellerCounter: true,
          teamBulkOrders: isSports,
          staffPins: true,
        },
      };
      dbService.addTenant(newTenant);
      existing = newTenant;
    }
    if (existing) {
      dbService.setCurrentTenantId(session.shopId);
      return { tenants: dbService.getTenants(), activeShopId: session.shopId };
    }
  }
  return { tenants: dbService.getTenants(), activeShopId: dbService.getCurrentTenantId() };
};

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const initialBoot = ensureSessionTenant();
  const [allTenants, setAllTenants] = useState<TenantShop[]>(initialBoot.tenants);
  const [currentTenantId, setCurrentTenantId] = useState<string>(initialBoot.activeShopId);
  const [, setFirestoreRevision] = useState<number>(0);
  const [role, setRole] = useState<UserRole>(() => {
    const session = authService.getSession();
    if (session?.role === 'super_admin' && !session.isSuperAdminVerified) {
      return 'shop_owner';
    }
    return session?.role || 'shop_owner';
  });
  const [isImpersonating, setIsImpersonating] = useState<boolean>(false);
  const [activeStaff, setActiveStaff] = useState<StaffMember | null>(null);
  const [isLocked, setIsLocked] = useState<boolean>(false);
  const [isOffline, setIsOffline] = useState<boolean>(!navigator.onLine);
  const [isSimulatedOffline, setIsSimulatedOffline] = useState<boolean>(false);
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    return (localStorage.getItem('lekho_theme') as 'dark' | 'light') || 'light';
  });
  const [language, setLanguageState] = useState<AppLanguage>(() => {
    const session = authService.getSession();
    const shopId = session?.shopId || initialBoot.activeShopId;
    const userId = session?.userId || session?.uid || 'owner';
    const scopedKey = getLanguageStorageKey(shopId, userId);
    const savedScoped = localStorage.getItem(scopedKey);
    if (savedScoped === 'bn' || savedScoped === 'en') {
      return savedScoped;
    }
    const shopCfg = dbService.getStoreConfig(shopId);
    return normalizeAppLanguage(shopCfg?.appLanguage);
  });
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'warning' | 'info' } | null>(null);
  const [isAuthenticated, setIsAuthenticatedState] = useState<boolean>(() => {
    const session = authService.getSession();
    return Boolean(session);
  });

  useEffect(() => {
    const session = authService.getSession();
    const shopId = currentTenantId || session?.shopId || 'default_shop';
    const userId = activeStaff?.id || session?.userId || session?.uid || 'owner';
    const scopedKey = getLanguageStorageKey(shopId, userId);
    const savedScoped = localStorage.getItem(scopedKey);
    if (savedScoped === 'bn' || savedScoped === 'en') {
      setLanguageState(savedScoped);
    } else {
      const shopCfg = dbService.getStoreConfig(shopId);
      setLanguageState(normalizeAppLanguage(shopCfg?.appLanguage));
    }
  }, [currentTenantId, activeStaff?.id]);

  const setLanguage = useCallback(
    (nextLang: AppLanguage) => {
      const normalized = normalizeAppLanguage(nextLang);
      setLanguageState(normalized);
      const session = authService.getSession();
      const shopId = currentTenantId || session?.shopId || 'default_shop';
      const userId = activeStaff?.id || session?.userId || session?.uid || 'owner';
      const scopedKey = getLanguageStorageKey(shopId, userId);
      try {
        localStorage.setItem(scopedKey, normalized);
      } catch {}
      try {
        dbService.saveStoreConfig(shopId, { appLanguage: normalized });
      } catch {}
    },
    [currentTenantId, activeStaff?.id]
  );

  const t = useCallback(
    (key: string, fallback?: string) => translateUI(language, key, fallback),
    [language]
  );

  const pickText = useCallback(
    (bnText: string, enText: string) => pickLocalizedText(language, bnText, enText),
    [language]
  );

  const setIsAuthenticated = (val: boolean) => {
    setIsAuthenticatedState(val);
    localStorage.setItem('lekho_logged_in', val ? 'true' : 'false');
  };

  const syncFromAuthSession = useCallback(() => {
    const synced = ensureSessionTenant();
    setAllTenants(synced.tenants);
    setCurrentTenantId(synced.activeShopId);
    const session = authService.getSession();
    if (session) {
      const safeRole: UserRole =
        session.role === 'super_admin' && !session.isSuperAdminVerified ? 'shop_owner' : session.role || 'shop_owner';
      setRole(safeRole);
      setIsAuthenticatedState(true);
      localStorage.setItem('lekho_logged_in', 'true');
    }
  }, []);

  useEffect(() => {
    window.addEventListener('lekho:sync-session', syncFromAuthSession);
    return () => window.removeEventListener('lekho:sync-session', syncFromAuthSession);
  }, [syncFromAuthSession]);

  // Listen to Firebase Auth state as the primary source of truth and subscribe to real-time Cloud Firestore data
  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!firebaseUser) {
        // Primary Source of Truth: if Firebase Auth has no signed-in user, invalidate any localStorage session
        firestoreSync.unsubscribeActiveShop();
        if (typeof localStorage !== 'undefined') {
          localStorage.removeItem('lekho_auth_session_v2');
          localStorage.setItem('lekho_logged_in', 'false');
        }
        setIsAuthenticatedState(false);
        return;
      }

      try {
        // Test token validation: if token refreshing fails or token service API is disabled,
        let idToken = '';
        try {
          idToken = await firebaseUser.getIdToken();
        } catch (tokenErr: any) {
          console.warn('[Firebase Auth] Cached token verification failed or expired, signing out cleanly:', tokenErr?.message || tokenErr);
          await auth.signOut().catch(() => {});
          return;
        }

        const isSuperAdmin = await firestoreSync.checkIsSuperAdmin(firebaseUser.uid);
        const profile = await firestoreSync.getUserProfile(firebaseUser.uid);

        if (isSuperAdmin) {
          const allShops = await firestoreSync.getAllShopsForSuperAdmin().catch(() => []);
          allShops.forEach((s) => dbService.hydrateFromFirestore.shop(s));
          setAllTenants(dbService.getTenants());
        }

        if (profile?.shopId) {
          const shop = await firestoreSync.getShop(profile.shopId);
          if (shop) {
            if (shop.accountStatus === 'disabled') {
              authService.clearSession();
              setIsAuthenticatedState(false);
              return;
            }
            dbService.hydrateFromFirestore.shop(shop);
            dbService.setCurrentTenantId(shop.id);
            setAllTenants(dbService.getTenants());
            setCurrentTenantId(shop.id);
            dbService.syncTenantToServer(shop);
          }

          const effectiveRole: UserRole = isSuperAdmin
            ? 'super_admin'
            : profile.role === 'manager'
            ? 'manager'
            : profile.role === 'salesman'
            ? 'salesman'
            : 'shop_owner';
          setRole(effectiveRole);
          setIsAuthenticatedState(true);

          const existingSession = authService.getSession();
          const cleanEmail = (firebaseUser.email || '').trim().toLowerCase();
          const updatedSession = {
            token: idToken,
            uid: firebaseUser.uid,
            userType: effectiveRole === 'shop_owner' || effectiveRole === 'super_admin' ? ('merchant' as const) : ('staff' as const),
            userId: firebaseUser.uid,
            email: cleanEmail || existingSession?.email || '',
            name: profile.name || firebaseUser.displayName || existingSession?.name || 'Owner',
            phone: profile.phone || existingSession?.phone || '',
            shopId: profile.shopId,
            shopName: shop?.name || profile.shopName || existingSession?.shopName || 'Lekho Store',
            category: shop?.category || existingSession?.category || 'clothing',
            officialCategory: shop?.shopCategory || existingSession?.officialCategory || 'CLOTHING',
            role: effectiveRole,
            isSuperAdminVerified: isSuperAdmin,
            authProvider: existingSession?.authProvider || ('firebase_google' as const),
            createdAt: existingSession?.createdAt || new Date().toISOString(),
            expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          };
          authService.setSession(updatedSession);

          firestoreSync.subscribeToShop(profile.shopId, {
            role: effectiveRole,
            onShopUpdate: (updatedShop) => {
              if (updatedShop.accountStatus === 'disabled') {
                authService.clearSession();
                setIsAuthenticatedState(false);
                return;
              }
              dbService.hydrateFromFirestore.shop(updatedShop);
              setAllTenants(dbService.getTenants());
              setFirestoreRevision((r) => r + 1);
            },
            onProductsUpdate: (items) => {
              dbService.hydrateFromFirestore.products(profile.shopId, items);
              setFirestoreRevision((r) => r + 1);
            },
            onPrivateCostsUpdate: (productCosts, categoryCosts) => {
              dbService.hydrateFromFirestore.privateCosts(profile.shopId, productCosts, categoryCosts);
              setFirestoreRevision((r) => r + 1);
            },
            onInvoicesUpdate: (invoices) => {
              dbService.hydrateFromFirestore.invoices(profile.shopId, invoices);
              setFirestoreRevision((r) => r + 1);
            },
            onExpensesUpdate: (expenses) => {
              dbService.hydrateFromFirestore.expenses(profile.shopId, expenses);
              setFirestoreRevision((r) => r + 1);
            },
            onDrawersUpdate: (balances) => {
              dbService.hydrateFromFirestore.drawers(profile.shopId, balances);
              setFirestoreRevision((r) => r + 1);
            },
            onDrawerTxsUpdate: (txs) => {
              dbService.hydrateFromFirestore.drawerTxs(profile.shopId, txs);
              setFirestoreRevision((r) => r + 1);
            },
            onStaffUpdate: (staffList) => {
              dbService.hydrateFromFirestore.staff(profile.shopId, staffList);
              setFirestoreRevision((r) => r + 1);
            },
            onResellersUpdate: (resellers) => {
              dbService.hydrateFromFirestore.resellers(profile.shopId, resellers);
              setFirestoreRevision((r) => r + 1);
            },
            onAuxiliaryDataUpdate: (docKey, items) => {
              dbService.hydrateFromFirestore.auxiliaryData(profile.shopId, docKey, items);
              setFirestoreRevision((r) => r + 1);
            },
          });
        } else {
          // Fallback to local session if Firestore profile could not be loaded (e.g. offline mode)
          const session = authService.getSession();
          if (session?.shopId) {
            const localShop = dbService.getTenantById(session.shopId);
            if (localShop) {
              dbService.setCurrentTenantId(localShop.id);
              setAllTenants(dbService.getTenants());
              setCurrentTenantId(localShop.id);
              const safeRole: UserRole = isSuperAdmin ? 'super_admin' : session.role || 'shop_owner';
              setRole(safeRole);
              setIsAuthenticatedState(true);
              authService.setSession({
                ...session,
                token: idToken,
                uid: firebaseUser.uid,
                role: safeRole,
              });
              dbService.syncTenantToServer(localShop);
            }
          }
        }
      } catch (err) {
        console.warn('Firebase session sync warning:', err);
      }
    });

    return () => {
      unsubscribeAuth();
      firestoreSync.unsubscribeActiveShop();
    };
  }, []);

  const logout = () => {
    authService.clearSession();
    setIsAuthenticated(false);
    showToast('সফলভাবে লগআউট হয়েছেন। পুনরায় লগইন করুন।', 'info');
  };

  // Isolate visible stores to the authenticated merchant/staff (unless verified super_admin)
  const tenants = useMemo(() => {
    const session = authService.getSession();
    if (role === 'super_admin' && session?.isSuperAdminVerified) return allTenants;
    if (session) {
      const isolated = allTenants.filter((t) => canUserAccessShop(t, session));
      if (isolated.length > 0) return isolated;
    }
    const activeMatch = allTenants.filter((t) => t.id === currentTenantId);
    return activeMatch.length > 0 ? activeMatch : allTenants;
  }, [allTenants, role, currentTenantId]);

  // Authoritative current tenant (internal only for PIN verification)
  const rawCurrentTenant = useMemo(() => {
    const session = authService.getSession();
    if (session && !isImpersonating && role !== 'super_admin') {
      const sessionShop = allTenants.find((t) => t.id === session.shopId);
      if (sessionShop && currentTenantId === session.shopId) {
        return sessionShop;
      }
    }
    return allTenants.find((t) => t.id === currentTenantId) || tenants[0] || allTenants[0];
  }, [allTenants, tenants, currentTenantId, isImpersonating, role]);

  // Redact ownerPin and courier apiSecret from React context state when role is not shop_owner / super_admin
  const currentTenant = useMemo(() => {
    return sanitizeTenantSecretsForRole(rawCurrentTenant, role);
  }, [rawCurrentTenant, role]);

  // Refresh active staff when tenant or role changes (never expose ownerPin in activeStaff.pin)
  useEffect(() => {
    const session = authService.getSession();
    const staffList = dbService.getShopStaff(rawCurrentTenant.id);
    if (session?.userType === 'staff' && session.shopId === rawCurrentTenant.id) {
      const loggedInStaff = staffList.find(
        (s) => s.id === session.userId || (s.email && s.email.toLowerCase() === session.email.toLowerCase())
      );
      if (loggedInStaff) {
        setActiveStaff({ ...loggedInStaff, pin: '' });
        return;
      }
    }
    if (role === 'shop_owner') {
      const owner = staffList.find((s) => s.role === 'owner') || {
        id: `owner_${rawCurrentTenant.id}`,
        name: `${rawCurrentTenant.ownerName} (Owner)`,
        pin: '',
        role: 'owner',
        commissionPerPiece: 0,
        phone: rawCurrentTenant.ownerPhone,
        active: true,
      };
      setActiveStaff({ ...owner, pin: '' });
    } else if (role === 'manager') {
      const manager = staffList.find((s) => s.role === 'manager') || {
        id: `manager_${rawCurrentTenant.id}`,
        name: `${rawCurrentTenant.ownerName} (Manager)`,
        pin: '',
        role: 'manager',
        commissionPerPiece: 0,
        phone: rawCurrentTenant.ownerPhone,
        active: true,
      };
      setActiveStaff({ ...manager, pin: '' });
    } else if (role === 'salesman') {
      const salesman = staffList.find((s) => s.role === 'salesman') || staffList[0] || null;
      setActiveStaff(salesman ? { ...salesman, pin: '' } : null);
    } else {
      setActiveStaff(null);
    }
  }, [rawCurrentTenant.id, role, rawCurrentTenant.ownerName, rawCurrentTenant.ownerPhone]);

  // Online / Offline listener
  useEffect(() => {
    const handleOnline = () => {
      if (!isSimulatedOffline) {
        setIsOffline(false);
        showToast('Internet reconnected. All local data synced!', 'success');
      }
    };
    const handleOffline = () => {
      setIsOffline(true);
      showToast('Offline Mode: Shopping mall connection dropped. Counter is running locally.', 'warning');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [isSimulatedOffline]);

  // Theme application
  useEffect(() => {
    localStorage.setItem('lekho_theme', theme);
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  const showToast = useCallback((message: string, type: 'success' | 'error' | 'warning' | 'info' = 'info') => {
    setToast({ message, type });
    setTimeout(() => {
      setToast((prev) => (prev?.message === message ? null : prev));
    }, 4000);
  }, []);

  const dismissToast = useCallback(() => {
    setToast(null);
  }, []);

  const switchTenant = (tenantId: string) => {
    const target = tenants.find((t) => t.id === tenantId);
    if (target) {
      setCurrentTenantId(tenantId);
      dbService.setCurrentTenantId(tenantId);
      showToast(`Switched store: ${target.name}`, 'info');
    }
  };

  const switchRole = (newRole: UserRole) => {
    const session = authService.getSession();
    const check = evaluateRoleSwitch({
      currentRole: role,
      targetRole: newRole,
      userType: session?.userType,
      isSuperAdminVerified: session?.isSuperAdminVerified,
      isPinVerified: false,
    });

    if (!check.allowed) {
      showToast(check.reasonBn || 'এই মোডে যাওয়ার অনুমতি নেই।', check.requiresPinModal ? 'warning' : 'error');
      return;
    }

    setRole(newRole);
    if (newRole === 'salesman') {
      setIsLocked(false);
      showToast('Switched to Salesman / Cashier mode. Profit margins & purchase costs are hidden.', 'warning');
    } else if (newRole === 'shop_owner') {
      showToast('Switched to Shop Owner mode. Full access unlocked.', 'info');
    } else if (newRole === 'super_admin') {
      showToast('LEKHO Control Center - Super Admin mode.', 'info');
    }
  };

  const impersonateShop = (shopId: string) => {
    const session = authService.getSession();
    if (!session?.isSuperAdminVerified) {
      showToast('Unauthorized action.', 'error');
      return;
    }
    const target = tenants.find((t) => t.id === shopId);
    if (target) {
      setCurrentTenantId(shopId);
      dbService.setCurrentTenantId(shopId);
      setIsImpersonating(true);
      setRole('shop_owner');
      showToast(`Shadow Impersonation: Viewing "${target.name}".`, 'warning');
    }
  };

  const exitImpersonation = () => {
    const session = authService.getSession();
    if (!session?.isSuperAdminVerified) return;
    setIsImpersonating(false);
    setRole('super_admin');
    showToast('Exited shop view. Returned to Super Admin Control Center.', 'info');
  };

  const loginWithPin = (pin: string): { success: boolean; staff?: StaffMember; message?: string } => {
    const cleanPin = (pin || '').trim();
    if (!cleanPin) {
      return { success: false, message: 'অনুগ্রহ করে পিন বা পাসওয়ার্ড দিন।' };
    }

    const session = authService.getSession();
    const isStaffAccountSession = session?.userType === 'staff';

    // 1. Check multiple owners/partners list (ONLY allowed if the authenticated session is NOT a staff account!)
    const ownersList = dbService.getShopOwners(currentTenant.id, 'shop_owner');
    const matchedOwner = ownersList.find(
      (o) => o.active && verifyCredentialSync(cleanPin, o.passwordHash, o.passwordSalt, o.password)
    );
    if (matchedOwner) {
      if (isStaffAccountSession) {
        return {
          success: false,
          message: 'স্টাফ একাউন্ট থেকে মালিকের (Shop Owner) মোডে প্রবেশ করা অনুমোদিত নয়। মালিকের নিজস্ব জিমেইল দিয়ে লগইন করুন।',
        };
      }
      const ownerStaff: StaffMember = {
        id: matchedOwner.id,
        name: matchedOwner.name,
        username: matchedOwner.username,
        pin: '',
        role: 'owner',
        commissionPerPiece: 0,
        phone: matchedOwner.phone,
        active: true,
      };
      setActiveStaff(ownerStaff);
      setRole('shop_owner');
      setIsLocked(false);
      return { success: true, staff: ownerStaff };
    }

    // 2. Check store primary owner PIN (ONLY allowed if ownerPin is explicitly set and user is NOT a staff account!)
    if (rawCurrentTenant.ownerPin && cleanPin === rawCurrentTenant.ownerPin) {
      if (isStaffAccountSession) {
        return {
          success: false,
          message: 'স্টাফ একাউন্ট থেকে মালিকের (Shop Owner) মোডে প্রবেশ করা অনুমোদিত নয়। মালিকের নিজস্ব জিমেইল দিয়ে লগইন করুন।',
        };
      }
      const ownerStaff: StaffMember = {
        id: `owner_${rawCurrentTenant.id}`,
        name: `${rawCurrentTenant.ownerName} (Owner)`,
        pin: '',
        role: 'owner',
        commissionPerPiece: 0,
        phone: rawCurrentTenant.ownerPhone,
        active: true,
      };
      setActiveStaff(ownerStaff);
      setRole('shop_owner');
      setIsLocked(false);
      return { success: true, staff: ownerStaff };
    }

    // 3. Check active, verified staff members
    const staffList = dbService.getShopStaff(rawCurrentTenant.id, 'shop_owner');
    const found = staffList.find(
      (s) =>
        (verifyCredentialSync(cleanPin, s.pinHash, s.pinSalt, s.pin) ||
          (s.username && s.username.toLowerCase() === cleanPin.toLowerCase())) &&
        s.active &&
        s.status !== 'disabled' &&
        s.status !== 'pending_verification'
    );
    if (found) {
      if (found.role === 'owner' && isStaffAccountSession) {
        return {
          success: false,
          message: 'স্টাফ একাউন্ট থেকে মালিকের (Shop Owner) মোডে প্রবেশ করা অনুমোদিত নয়।',
        };
      }
      setActiveStaff({ ...found, pin: '' });
      const nextRole: UserRole =
        found.role === 'owner' ? 'shop_owner' : found.role === 'manager' ? 'manager' : 'salesman';
      setRole(nextRole);
      setIsLocked(false);
      return { success: true, staff: { ...found, pin: '' } };
    }

    return { success: false, message: 'পিন বা পাসওয়ার্ড সঠিক নয়।' };
  };

  const verifyOwnerPin = (pin: string): boolean => {
    const cleanPin = (pin || '').trim();
    if (!cleanPin) return false;
    const lockKey = `lekho_owner_pin_lock_${rawCurrentTenant.id}`;
    let failedAttempts = 0;
    let lockedUntilMs = 0;
    try {
      const raw = sessionStorage.getItem(lockKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        failedAttempts = Number(parsed.failedAttempts) || 0;
        lockedUntilMs = Number(parsed.lockedUntilMs) || 0;
      }
    } catch {}

    const check = verifyTenantOwnerPin({
      expectedOwnerPin: rawCurrentTenant.ownerPin,
      candidatePin: cleanPin,
      failedAttempts,
      lockedUntilMs,
    });

    if (check.authorized) {
      try {
        sessionStorage.removeItem(lockKey);
      } catch {}
      return true;
    }

    // Also allow active partner passwords if not locked out
    if (!check.lockedOut) {
      const ownersList = dbService.getShopOwners(rawCurrentTenant.id, 'shop_owner');
      if (
        ownersList.some(
          (o) => o.active && verifyCredentialSync(cleanPin, o.passwordHash, o.passwordSalt, o.password)
        )
      ) {
        try {
          sessionStorage.removeItem(lockKey);
        } catch {}
        return true;
      }
    }

    try {
      sessionStorage.setItem(
        lockKey,
        JSON.stringify({
          failedAttempts: check.nextFailedAttempts,
          lockedUntilMs: check.lockedUntilMs,
        })
      );
    } catch {}
    return false;
  };

  const lockRegister = () => {
    setIsLocked(true);
    showToast('Counter locked. Enter PIN to resume billing.', 'info');
  };

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  const toggleSimulatedOffline = () => {
    setIsSimulatedOffline((prev) => {
      const next = !prev;
      setIsOffline(next);
      if (next) {
        showToast('Simulated Offline Mode ON (Testing basement network cut)', 'warning');
      } else {
        showToast('Online Mode Restored (Simulated network active)', 'success');
      }
      return next;
    });
  };

  const updateTenantFlags = (flags: Partial<FeatureFlags>) => {
    const updatedFlags = { ...currentTenant.featureFlags, ...flags };
    const updated = dbService.updateTenant(currentTenant.id, { featureFlags: updatedFlags });
    if (updated) {
      setAllTenants(dbService.getTenants());
      showToast('Store feature flags updated successfully', 'success');
    }
  };

  const switchStaff = (staff: StaffMember) => {
    setActiveStaff(staff);
    showToast(`অপারেটর সক্রিয়: ${staff.name}`, 'info');
  };

  const reloadShopData = () => {
    const freshTenants = dbService.getTenants();
    setAllTenants(freshTenants);
    const session = authService.getSession();
    if (session) {
      const activeShop = freshTenants.find((t) => t.id === session.shopId);
      if (activeShop) {
        authService.updateSessionStoreInfo({
          shopName: activeShop.name,
          name: session.userType === 'merchant' ? activeShop.ownerName : session.name,
          email: session.userType === 'merchant' ? activeShop.ownerEmail || activeShop.email : session.email,
          category: activeShop.category,
          officialCategory: activeShop.shopCategory,
        });
      }
    }
  };

  return (
    <AppContext.Provider
      value={{
        tenants,
        currentTenant,
        role,
        activeStaff,
        isImpersonating,
        isLocked,
        isOffline,
        theme,
        language,
        featureFlags: currentTenant.featureFlags,
        isAuthenticated,
        setLanguage,
        t,
        pickText,
        setIsAuthenticated,
        syncFromAuthSession,
        logout,
        switchTenant,
        switchRole,
        switchStaff,
        impersonateShop,
        exitImpersonation,
        loginWithPin,
        verifyOwnerPin,
        lockRegister,
        toggleTheme,
        toggleSimulatedOffline,
        updateTenantFlags,
        reloadShopData,
        showToast,
        dismissToast,
        toast,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
