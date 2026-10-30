import {
  auth,
  firestoreDb,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  collection,
  getDocs,
  onSnapshot,
  OperationType,
  handleFirestoreError,
} from './firebase';
import {
  TenantShop,
  InventoryItem,
  Invoice,
  ExpenseRecord,
  MultiDrawerBalance,
  DrawerTransaction,
  StaffMember,
  ResellerAccount,
  AlterationOrder,
  TeamBulkOrder,
  StandaloneFontOrder,
  UserRole,
} from '../types';
import {
  migrateOwnerAccountCredentials,
  migrateStaffCredentials,
  canViewBuyingPrice,
  PrivateProductCostRecord,
} from '../utils/securityPolicy';

export interface FirestoreUserProfile {
  uid: string;
  email: string;
  name: string;
  phone?: string;
  role: 'shop_owner' | 'manager' | 'salesman';
  shopId: string;
  shopName?: string;
  createdAt: string;
  updatedAt?: string;
}

// Sanitize undefined fields recursively for Firestore compatibility
function sanitizeForFirestore<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

let activeShopUnsubscribers: Array<() => void> = [];

export const firestoreSync = {
  isFirebaseActive(): boolean {
    return Boolean(auth.currentUser);
  },

  // 1. VERIFY SUPER ADMIN Strictly via /platform_admins/{uid} (Never by client email matching)
  async checkIsSuperAdmin(uid: string): Promise<boolean> {
    if (!uid) return false;
    try {
      const adminRef = doc(firestoreDb, 'platform_admins', uid);
      const snap = await getDoc(adminRef);
      if (!snap.exists()) return false;
      const data = snap.data();
      return data?.active === true && data?.role === 'super_admin';
    } catch {
      return false;
    }
  },

  // 2. USER PROFILE (/users/{uid})
  async getUserProfile(uid: string): Promise<FirestoreUserProfile | null> {
    const path = `users/${uid}`;
    try {
      const snap = await getDoc(doc(firestoreDb, 'users', uid));
      if (!snap.exists()) return null;
      return snap.data() as FirestoreUserProfile;
    } catch (error: any) {
      const msg = error instanceof Error ? error.message : String(error);
      if (msg.includes('offline') || error?.code === 'unavailable' || msg.includes('token-service')) {
        console.warn(`[Firestore] Client is offline or token service unavailable for ${path}`);
        return null;
      }
      handleFirestoreError(error, OperationType.GET, path);
      return null;
    }
  },

  async createUserProfile(profile: FirestoreUserProfile): Promise<void> {
    const path = `users/${profile.uid}`;
    try {
      await setDoc(doc(firestoreDb, 'users', profile.uid), sanitizeForFirestore(profile));
    } catch (error: any) {
      const msg = error instanceof Error ? error.message : String(error);
      if (msg.includes('offline') || error?.code === 'unavailable' || msg.includes('token-service')) {
        console.warn(`[Firestore] Client is offline; queued local profile creation for ${path}`);
        return;
      }
      handleFirestoreError(error, OperationType.CREATE, path);
    }
  },

  async updateUserProfile(uid: string, updates: Partial<Pick<FirestoreUserProfile, 'name' | 'phone' | 'shopName'>>): Promise<void> {
    const path = `users/${uid}`;
    try {
      await updateDoc(
        doc(firestoreDb, 'users', uid),
        sanitizeForFirestore({
          ...updates,
          updatedAt: new Date().toISOString(),
        })
      );
    } catch (error: any) {
      const msg = error instanceof Error ? error.message : String(error);
      if (msg.includes('offline') || error?.code === 'unavailable' || msg.includes('token-service')) {
        console.warn(`[Firestore] Client is offline; queued local profile update for ${path}`);
        return;
      }
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  },

  // 3. TENANT SHOP (/shops/{shopId})
  async getShop(shopId: string): Promise<TenantShop | null> {
    const path = `shops/${shopId}`;
    try {
      const snap = await getDoc(doc(firestoreDb, 'shops', shopId));
      if (!snap.exists()) return null;
      return snap.data() as TenantShop;
    } catch (error: any) {
      const msg = error instanceof Error ? error.message : String(error);
      if (msg.includes('offline') || error?.code === 'unavailable' || msg.includes('token-service')) {
        console.warn(`[Firestore] Client is offline or token service unavailable for ${path}`);
        return null;
      }
      handleFirestoreError(error, OperationType.GET, path);
      return null;
    }
  },

  async getAllShopsForSuperAdmin(): Promise<TenantShop[]> {
    const path = 'shops';
    try {
      const snap = await getDocs(collection(firestoreDb, 'shops'));
      return snap.docs.map((d) => d.data() as TenantShop);
    } catch (error: any) {
      const msg = error instanceof Error ? error.message : String(error);
      if (msg.includes('offline') || error?.code === 'unavailable' || msg.includes('token-service')) {
        console.warn(`[Firestore] Client is offline; skipping remote shops fetch`);
        return [];
      }
      handleFirestoreError(error, OperationType.LIST, path);
      return [];
    }
  },

  async createShop(shop: TenantShop, ownerUid: string): Promise<TenantShop> {
    const path = `shops/${shop.id}`;
    const enrichedShop: TenantShop = sanitizeForFirestore({
      ...shop,
      ownerUid,
      memberUids: Array.from(new Set([...(shop.memberUids || []), ownerUid])),
      memberRoles: {
        ...(shop.memberRoles || {}),
        [ownerUid]: 'shop_owner',
      },
      createdAt: shop.createdAt || new Date().toISOString(),
    });
    try {
      await setDoc(doc(firestoreDb, 'shops', shop.id), enrichedShop);
      return enrichedShop;
    } catch (error: any) {
      const msg = error instanceof Error ? error.message : String(error);
      if (msg.includes('offline') || error?.code === 'unavailable' || msg.includes('token-service')) {
        console.warn(`[Firestore] Client is offline; saved local shop for ${path}`);
        return enrichedShop;
      }
      handleFirestoreError(error, OperationType.CREATE, path);
      return enrichedShop;
    }
  },

  async saveShop(shop: TenantShop): Promise<void> {
    if (!auth.currentUser) return;
    const path = `shops/${shop.id}`;
    try {
      const uid = auth.currentUser.uid;
      const payload = sanitizeForFirestore({
        ...shop,
        ownerUid: shop.ownerUid || uid,
        memberUids: shop.memberUids?.length ? shop.memberUids : [shop.ownerUid || uid],
        memberRoles: shop.memberRoles || { [shop.ownerUid || uid]: 'shop_owner' },
        createdAt: shop.createdAt || new Date().toISOString(),
      });
      await setDoc(doc(firestoreDb, 'shops', shop.id), payload, { merge: true });
    } catch (error) {
      console.warn('Firestore saveShop warning:', error);
    }
  },

  // 4. SHOP SUBCOLLECTIONS SYNC (Products, Invoices, Expenses, Drawers, Staff, Resellers, Orders)
  async syncProduct(shopId: string, item: InventoryItem): Promise<void> {
    if (!auth.currentUser) return;
    try {
      await setDoc(
        doc(firestoreDb, 'shops', shopId, 'products', item.id),
        sanitizeForFirestore({ ...item, shopId })
      );
    } catch (error) {
      console.warn('Firestore syncProduct warning:', error);
    }
  },

  async syncAllProducts(shopId: string, items: InventoryItem[]): Promise<void> {
    if (!auth.currentUser) return;
    try {
      await Promise.all(
        items.map((item) =>
          setDoc(
            doc(firestoreDb, 'shops', shopId, 'products', item.id),
            sanitizeForFirestore({ ...item, shopId })
          )
        )
      );
    } catch (error) {
      console.warn('Firestore syncAllProducts warning:', error);
    }
  },

  async syncInvoice(shopId: string, invoice: Invoice): Promise<void> {
    if (!auth.currentUser) return;
    try {
      await setDoc(
        doc(firestoreDb, 'shops', shopId, 'invoices', invoice.id),
        sanitizeForFirestore({ ...invoice, shopId })
      );
    } catch (error) {
      console.warn('Firestore syncInvoice warning:', error);
    }
  },

  async syncAllInvoices(shopId: string, invoices: Invoice[]): Promise<void> {
    if (!auth.currentUser) return;
    try {
      await Promise.all(
        invoices.map((invoice) =>
          setDoc(
            doc(firestoreDb, 'shops', shopId, 'invoices', invoice.id),
            sanitizeForFirestore({ ...invoice, shopId })
          )
        )
      );
    } catch (error) {
      console.warn('Firestore syncAllInvoices warning:', error);
    }
  },

  async syncExpense(shopId: string, expense: ExpenseRecord): Promise<void> {
    if (!auth.currentUser) return;
    try {
      await setDoc(
        doc(firestoreDb, 'shops', shopId, 'expenses', expense.id),
        sanitizeForFirestore({ ...expense, shopId })
      );
    } catch (error) {
      console.warn('Firestore syncExpense warning:', error);
    }
  },

  async syncDrawers(shopId: string, balances: MultiDrawerBalance, txs?: DrawerTransaction[]): Promise<void> {
    if (!auth.currentUser) return;
    try {
      await setDoc(
        doc(firestoreDb, 'shops', shopId, 'drawers', 'balances'),
        sanitizeForFirestore({
          id: 'balances',
          shopId,
          balances,
          updatedAt: new Date().toISOString(),
        }),
        { merge: true }
      );
      if (txs) {
        await setDoc(
          doc(firestoreDb, 'shops', shopId, 'drawers', 'transactions'),
          sanitizeForFirestore({
            id: 'transactions',
            shopId,
            items: txs.slice(0, 300),
            updatedAt: new Date().toISOString(),
          })
        );
      }
    } catch (error) {
      console.warn('Firestore syncDrawers warning:', error);
    }
  },

  async syncStaffList(shopId: string, members: StaffMember[]): Promise<void> {
    if (!auth.currentUser) return;
    try {
      await Promise.all(
        members.map((m) => {
          const safeMember = migrateStaffCredentials(m);
          return setDoc(
            doc(firestoreDb, 'shops', shopId, 'staff', m.id),
            sanitizeForFirestore({ ...safeMember, shopId, pin: '' })
          );
        })
      );
    } catch (error) {
      console.warn('Firestore syncStaffList warning:', error);
    }
  },

  async syncPrivateCosts(
    shopId: string,
    productCosts: Record<string, PrivateProductCostRecord>,
    categoryCosts?: Record<string, number>
  ): Promise<void> {
    if (!auth.currentUser) return;
    try {
      await setDoc(
        doc(firestoreDb, 'shops', shopId, 'private_costs', 'catalog_costs'),
        sanitizeForFirestore({
          id: 'catalog_costs',
          shopId,
          productCosts,
          ...(categoryCosts ? { categoryCosts } : {}),
          updatedAt: new Date().toISOString(),
        }),
        { merge: true }
      );
    } catch (error) {
      console.warn('Firestore syncPrivateCosts warning:', error);
    }
  },

  async syncResellers(shopId: string, resellers: ResellerAccount[]): Promise<void> {
    if (!auth.currentUser) return;
    try {
      await Promise.all(
        resellers.map((r) =>
          setDoc(
            doc(firestoreDb, 'shops', shopId, 'resellers', r.id),
            sanitizeForFirestore({ ...r, shopId })
          )
        )
      );
    } catch (error) {
      console.warn('Firestore syncResellers warning:', error);
    }
  },

  async syncAuxiliaryData(
    shopId: string,
    docKey: string,
    items: AlterationOrder[] | TeamBulkOrder[] | StandaloneFontOrder[] | any[]
  ): Promise<void> {
    if (!auth.currentUser) return;
    try {
      const safeItems =
        docKey === 'owners' && Array.isArray(items)
          ? items.map((o) => ({ ...migrateOwnerAccountCredentials(o), password: '' }))
          : items;
      await setDoc(
        doc(firestoreDb, 'shops', shopId, 'data', docKey),
        sanitizeForFirestore({
          id: docKey,
          shopId,
          items: safeItems,
          updatedAt: new Date().toISOString(),
        })
      );
    } catch (error) {
      console.warn(`Firestore syncAuxiliaryData (${docKey}) warning:`, error);
    }
  },

  // 5. REAL-TIME MULTI-TENANT SUBSCRIPTION FOR ACTIVE SHOP
  unsubscribeActiveShop(): void {
    activeShopUnsubscribers.forEach((unsub) => {
      try {
        unsub();
      } catch {}
    });
    activeShopUnsubscribers = [];
  },

  subscribeToShop(
    shopId: string,
    handlers: {
      role?: UserRole;
      onShopUpdate?: (shop: TenantShop) => void;
      onProductsUpdate?: (items: InventoryItem[]) => void;
      onPrivateCostsUpdate?: (
        productCosts: Record<string, PrivateProductCostRecord>,
        categoryCosts?: Record<string, number>
      ) => void;
      onInvoicesUpdate?: (invoices: Invoice[]) => void;
      onExpensesUpdate?: (expenses: ExpenseRecord[]) => void;
      onDrawersUpdate?: (balances: MultiDrawerBalance) => void;
      onDrawerTxsUpdate?: (txs: DrawerTransaction[]) => void;
      onStaffUpdate?: (staff: StaffMember[]) => void;
      onResellersUpdate?: (resellers: ResellerAccount[]) => void;
      onAuxiliaryDataUpdate?: (docKey: string, items: any[]) => void;
    }
  ): () => void {
    this.unsubscribeActiveShop();
    if (!auth.currentUser || !shopId) return () => {};

    const effectiveRole: UserRole = handlers.role || 'shop_owner';
    const isOwnerOrSuper = canViewBuyingPrice(effectiveRole);
    const isManagerOrAbove = isOwnerOrSuper || effectiveRole === 'manager';

    const unsubscribers: Array<() => void> = [];

    // Shop document listener
    unsubscribers.push(
      onSnapshot(
        doc(firestoreDb, 'shops', shopId),
        (snap) => {
          if (snap.exists() && handlers.onShopUpdate) {
            handlers.onShopUpdate(snap.data() as TenantShop);
          }
        },
        (err) => console.warn('Shop listener error:', err.message)
      )
    );

    // Products subcollection listener
    unsubscribers.push(
      onSnapshot(
        collection(firestoreDb, 'shops', shopId, 'products'),
        (snap) => {
          if (handlers.onProductsUpdate) {
            const items = snap.docs.map((d) => d.data() as InventoryItem);
            handlers.onProductsUpdate(items);
          }
        },
        (err) => console.warn('Products listener error:', err.message)
      )
    );

    // Owner-Only Private Costs Vault listener
    if (isOwnerOrSuper) {
      unsubscribers.push(
        onSnapshot(
          doc(firestoreDb, 'shops', shopId, 'private_costs', 'catalog_costs'),
          (snap) => {
            if (snap.exists() && handlers.onPrivateCostsUpdate) {
              const data = snap.data();
              if (data?.productCosts) {
                handlers.onPrivateCostsUpdate(data.productCosts, data.categoryCosts);
              }
            }
          },
          (err) => console.warn('Private costs listener error:', err.message)
        )
      );
    }

    // Invoices subcollection listener
    unsubscribers.push(
      onSnapshot(
        collection(firestoreDb, 'shops', shopId, 'invoices'),
        (snap) => {
          if (handlers.onInvoicesUpdate) {
            const invoices = snap.docs
              .map((d) => d.data() as Invoice)
              .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
            handlers.onInvoicesUpdate(invoices);
          }
        },
        (err) => console.warn('Invoices listener error:', err.message)
      )
    );

    // Expenses subcollection listener
    unsubscribers.push(
      onSnapshot(
        collection(firestoreDb, 'shops', shopId, 'expenses'),
        (snap) => {
          if (handlers.onExpensesUpdate) {
            const expenses = snap.docs
              .map((d) => d.data() as ExpenseRecord)
              .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
            handlers.onExpensesUpdate(expenses);
          }
        },
        (err) => console.warn('Expenses listener error:', err.message)
      )
    );

    // Drawers balance listener (Owner & Super Admin only)
    if (isOwnerOrSuper) {
      unsubscribers.push(
        onSnapshot(
          doc(firestoreDb, 'shops', shopId, 'drawers', 'balances'),
          (snap) => {
            if (snap.exists() && handlers.onDrawersUpdate) {
              const data = snap.data();
              if (data?.balances) {
                handlers.onDrawersUpdate(data.balances as MultiDrawerBalance);
              }
            }
          },
          (err) => console.warn('Drawers listener error:', err.message)
        )
      );
    }

    // Drawer transactions listener (Manager, Owner, Super Admin)
    if (isManagerOrAbove) {
      unsubscribers.push(
        onSnapshot(
          doc(firestoreDb, 'shops', shopId, 'drawers', 'transactions'),
          (snap) => {
            if (snap.exists() && handlers.onDrawerTxsUpdate) {
              const data = snap.data();
              if (Array.isArray(data?.items)) {
                handlers.onDrawerTxsUpdate(data.items as DrawerTransaction[]);
              }
            }
          },
          (err) => console.warn('Drawer transactions listener error:', err.message)
        )
      );
    }

    // Staff subcollection listener (Owner & Super Admin only)
    if (isOwnerOrSuper) {
      unsubscribers.push(
        onSnapshot(
          collection(firestoreDb, 'shops', shopId, 'staff'),
          (snap) => {
            if (handlers.onStaffUpdate && !snap.empty) {
              const staff = snap.docs.map((d) => d.data() as StaffMember);
              handlers.onStaffUpdate(staff);
            }
          },
          (err) => console.warn('Staff listener error:', err.message)
        )
      );
    }

    // Resellers subcollection listener
    unsubscribers.push(
      onSnapshot(
        collection(firestoreDb, 'shops', shopId, 'resellers'),
        (snap) => {
          if (handlers.onResellersUpdate) {
            const resellers = snap.docs.map((d) => d.data() as ResellerAccount);
            handlers.onResellersUpdate(resellers);
          }
        },
        (err) => console.warn('Resellers listener error:', err.message)
      )
    );

    // Explicit document-level listeners for /data/{docKey} based on verified role
    const operationalDocKeys = [
      'alterations',
      'teamOrders',
      'fontOrders',
      'kitCategories',
      'otherCategories',
      'clothingCategories',
      'sizeExchanges',
      'steadfastParcels',
      'stockAdjustments',
      'loyaltyTxs',
      'customerProfiles',
      'campaignTemplates',
      'campaignLogs',
    ];
    const managerDocKeys = isManagerOrAbove ? ['zReports'] : [];
    const ownerDocKeys = isOwnerOrSuper ? ['owners', 'ownerTxs', 'monthlyAudits', 'trash'] : [];
    const authorizedDocKeys = [...operationalDocKeys, ...managerDocKeys, ...ownerDocKeys];

    for (const docKey of authorizedDocKeys) {
      unsubscribers.push(
        onSnapshot(
          doc(firestoreDb, 'shops', shopId, 'data', docKey),
          (docSnap) => {
            if (docSnap.exists() && handlers.onAuxiliaryDataUpdate) {
              const payload = docSnap.data();
              if (payload && Array.isArray(payload.items)) {
                handlers.onAuxiliaryDataUpdate(docSnap.id, payload.items);
              }
            }
          },
          (err) => console.warn(`Auxiliary data (${docKey}) listener error:`, err.message)
        )
      );
    }

    activeShopUnsubscribers = unsubscribers;

    return () => this.unsubscribeActiveShop();
  },
};
