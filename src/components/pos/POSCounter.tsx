import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useApp } from '../../context/AppContext';
import {
  OrderLineItem,
  Invoice,
  InventoryItem,
  JerseyCustomization,
  DrawerType,
  GlobalBlacklistEntry,
  KitCategorySetting,
  OtherProductCategorySetting,
  ClothingCategorySetting,
  MenClothingCategory,
} from '../../types';
import { dbService } from '../../services/db';
import { canViewBuyingPrice, evaluateSubscriptionStatus, isClothingShop } from '../../utils/securityPolicy';
import {
  SplitPaymentBreakdown,
  validateSplitPayment,
  getActiveSplitEntries,
  formatSplitSummaryText,
  calculateSplitTotal,
  BottomPriceOverrideMap,
  findFirstBottomPriceViolation,
  authorizeBottomPriceOverride,
  pruneBottomPriceOverridesForCart,
  hasAnyBottomPriceOverrideUsed,
} from '../../utils/posOperations';
import { CustomizationModal } from '../jersey/CustomizationModal';
import { ReceiptModal } from './ReceiptModal';
import { BottomPriceLockModal } from './BottomPriceLockModal';
import { SplitPaymentModal } from './SplitPaymentModal';
import { BottomSheet } from '../ui/BottomSheet';
import {
  ShoppingCart,
  Plus,
  Trash2,
  Flame,
  Search,
  Scissors,
  CheckCircle,
  AlertTriangle,
  Wallet,
  ShieldCheck,
  User,
  Users,
  DollarSign,
  Shirt,
  ShoppingBag,
  Sparkles,
  Phone,
  ArrowRight,
  ArrowLeft,
  ArrowUp,
  ChevronDown,
  Info,
  Box,
  Truck,
  Zap,
  Receipt,
  Edit2,
  Package,
  X,
  Tag,
  History,
  Award,
  Sliders,
  Image as ImageIcon,
  ChevronRight,
  ChevronLeft,
  MoreVertical,
  CreditCard,
  RefreshCw,
  Minus,
} from 'lucide-react';
import { ResellerAccount, StockAdjustmentRecord } from '../../types';
import {
  getEligibleLoyaltyTiers,
  calculateLoyaltyRedemption,
  calculateEarnedLoyaltyPoints,
  createStockMovementRecord,
  buildVariantId,
  findMatchingInventoryVariant,
} from '../../utils/inventoryLoyaltyReportsEngine';
import { compressProductImageFile } from '../../utils/imageOptimization';

interface POSCounterProps {
  onNavigateToReseller?: () => void;
  onNavigateHome?: () => void;
}

const SIZES_BY_SCALE: Record<'shirts_tops' | 'denim_pants' | 'panjabi', string[]> = {
  shirts_tops: ['S', 'M', 'L', 'XL', 'XXL'],
  denim_pants: ['28-Reg', '30-Reg', '32-Reg', '34-Reg', '36-Reg', '38-Reg'],
  panjabi: ['38', '40', '42', '44', '46'],
};

export const POSCounter: React.FC<POSCounterProps> = ({ onNavigateToReseller, onNavigateHome }) => {
  const { currentTenant, role, activeStaff, reloadShopData, showToast } = useApp();
  const showBuyingPrice = canViewBuyingPrice(role);
  const [renewalTrxId, setRenewalTrxId] = useState('');
  const subscriptionCheck = useMemo(
    () => evaluateSubscriptionStatus(currentTenant.subscription),
    [currentTenant.subscription]
  );

  const handleRenewalSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!renewalTrxId.trim()) {
      showToast('অনুগ্রহ করে bKash/Nagad TrxID লিখুন।', 'error');
      return;
    }
    dbService.submitSubscriptionRenewal(currentTenant.id, renewalTrxId.trim());
    reloadShopData();
    setRenewalTrxId('');
    showToast('সাবস্ক্রিপশন নবায়নের TrxID জমা হয়েছে! ভেরিফিকেশন চলাকালীন বিলিং সচল করা হয়েছে।', 'success');
  };

  const isClothingStore = useMemo(() => isClothingShop(currentTenant), [currentTenant]);
  const isSportsOrJersey = !isClothingStore;

  // Active Category tabs in POS: Jersey (Sportswear only) vs Apparel (Clothing) vs Quick Catalog
  const defaultTab = isClothingStore ? 'apparel' : 'jersey';
  const [activeTab, setActiveTab] = useState<'jersey' | 'apparel' | 'catalog'>(defaultTab);

  useEffect(() => {
    if (isClothingStore && activeTab === 'jersey') {
      setActiveTab('apparel');
    } else if (!isClothingStore && activeTab === 'apparel') {
      setActiveTab('jersey');
    }
  }, [currentTenant.id, currentTenant.category, currentTenant.shopCategory, isClothingStore, activeTab]);

  // Cart / Checkout State
  const [cartItems, setCartItems] = useState<OrderLineItem[]>([]);
  const [customerName, setCustomerName] = useState('Walk-in Customer');
  const [customerPhone, setCustomerPhone] = useState('01712000000');
  const [paymentMode, setPaymentMode] = useState<'paid' | 'partial'>('paid');
  const [paymentChannel, setPaymentChannel] = useState<
    'cash' | 'bkash' | 'merchantBkash' | 'personalBkash' | 'nagad' | 'bank' | 'split'
  >('cash');
  const [advancePaid, setAdvancePaid] = useState<number>(0);
  const [discount, setDiscount] = useState<number>(0);
  const [blacklistAlert, setBlacklistAlert] = useState<GlobalBlacklistEntry | null>(null);
  const [matchedReseller, setMatchedReseller] = useState<ResellerAccount | null>(null);

  // Dynamic Jersey & Others Row Builder State (Sportswear only)
  const [jerseyRows, setJerseyRows] = useState<
    Array<{
      id: string;
      category: string;
      clubOrCountry: string;
      size: string;
      rate: number;
      quantity: number;
      customization?: JerseyCustomization;
      bottomPrice: number;
      costPrice: number;
      isOther?: boolean;
      otherCategoryId?: string;
      customTitle?: string;
      customSizeOrDetail?: string;
    }>
  >([
    {
      id: 'j_row_1',
      category: 'Player Issue (Master Copy)',
      clubOrCountry: 'Real Madrid',
      size: 'L',
      rate: 1450,
      quantity: 1,
      bottomPrice: 1200,
      costPrice: 720,
      isOther: false,
      otherCategoryId: 'custom',
    },
  ]);

  // Clothing Categories & Men's Clothing Quick Order Builder State
  const [clothingCategories, setClothingCategories] = useState<ClothingCategorySetting[]>(() =>
    dbService.getClothingCategories(currentTenant.id, role)
  );
  const [selectedClothingCategoryFilter, setSelectedClothingCategoryFilter] = useState<string>('ALL');
  const [apparelScale, setApparelScale] = useState<'ALL' | 'shirts_tops' | 'denim_pants' | 'panjabi'>('ALL');
  const [requiresAlteration, setRequiresAlteration] = useState(false);
  const [tailorNote, setTailorNote] = useState('Length -2 inches');
  const [tailorFee, setTailorFee] = useState<number>(50);

  // Quick Clothing Row Builder for Men's Clothing Counter
  const [clothingRows, setClothingRows] = useState<
    Array<{
      id: string;
      clothingCategory: MenClothingCategory;
      title: string;
      brandOrSubCategory: string;
      color?: string;
      size: string;
      rate: number;
      costPrice: number;
      bottomPrice: number;
      quantity: number;
    }>
  >([
    {
      id: 'c_row_1',
      clothingCategory: 'Shirt',
      title: 'Men Casual Oxford Shirt',
      brandOrSubCategory: 'Casual Shirt',
      color: 'Navy Blue',
      size: 'L',
      rate: 1250,
      costPrice: 680,
      bottomPrice: 1050,
      quantity: 1,
    },
  ]);

  // Product & Multi-Variant Create / Edit Modal State (Supports BOTH Clothing & Sportswear)
  const [productModalOpen, setProductModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<InventoryItem | null>(null);
  const [prodName, setProdName] = useState('');
  const [prodCategory, setProdCategory] = useState<MenClothingCategory>('T-Shirt');
  const [prodSubCategory, setProdSubCategory] = useState('');
  const [prodColor, setProdColor] = useState('');
  const [prodSku, setProdSku] = useState('');
  const [prodScale, setProdScale] = useState<'shirts_tops' | 'denim_pants' | 'panjabi'>('shirts_tops');
  const [prodCost, setProdCost] = useState<number>(450);
  const [prodMrp, setProdMrp] = useState<number>(850);
  const [prodBottom, setProdBottom] = useState<number>(700);
  const [prodImageUrl, setProdImageUrl] = useState<string>('');
  const [prodEditReason, setProdEditReason] = useState<string>('Physical stock update');
  const [prodVariants, setProdVariants] = useState<
    Array<{
      id?: string;
      sku?: string;
      size: string;
      color?: string;
      stock: number;
      costPrice?: number;
      mrp?: number;
      bottomPrice?: number;
      isActive?: boolean;
    }>
  >(SIZES_BY_SCALE.shirts_tops.map((size) => ({ size, stock: 5, isActive: true })));
  const [customVariantSize, setCustomVariantSize] = useState('');
  const [customVariantColor, setCustomVariantColor] = useState('');

  // Stock Correction & Audit Ledger Modal State (Phase 2)
  const [stockLedgerModalOpen, setStockLedgerModalOpen] = useState(false);
  const [stockTargetProductId, setStockTargetProductId] = useState<string>('');
  const [stockTargetVariantKey, setStockTargetVariantKey] = useState<string>('');
  const [stockNewQty, setStockNewQty] = useState<number>(0);
  const [stockCorrectionReason, setStockCorrectionReason] = useState<string>('');
  const [stockAdjustments, setStockAdjustments] = useState<StockAdjustmentRecord[]>(() =>
    dbService.getStockAdjustments(currentTenant.id)
  );

  // Customer Full History Modal & Loyalty State (Phases 3 & 4)
  const [customerHistoryModalOpen, setCustomerHistoryModalOpen] = useState(false);
  const [selectedLoyaltyTierId, setSelectedLoyaltyTierId] = useState<string | null>(null);

  // Modals & One-Sale Floor Price Override State
  const [customizingRowId, setCustomizingRowId] = useState<string | null>(null);
  const [activeReceipt, setActiveReceipt] = useState<Invoice | null>(null);
  const [bottomPriceLockedItem, setBottomPriceLockedItem] = useState<{
    item: OrderLineItem;
    bottomPrice: number;
  } | null>(null);
  const [approvedFloorOverrides, setApprovedFloorOverrides] = useState<BottomPriceOverrideMap>({});
  const [floorOverrideTokens, setFloorOverrideTokens] = useState<Record<string, string>>({});
  const [pendingCheckoutOpenMemo, setPendingCheckoutOpenMemo] = useState<boolean | null>(null);
  const [splitModalOpen, setSplitModalOpen] = useState(false);
  const [splitBreakdown, setSplitBreakdown] = useState<SplitPaymentBreakdown | null>(null);

  // Invalidate any floor-price overrides if cart items change (e.g. item removed or rate lowered further)
  useEffect(() => {
    setApprovedFloorOverrides((prev) => pruneBottomPriceOverridesForCart(prev, cartItems));
  }, [cartItems]);

  // Clear floor-price overrides if tenant or active tab changes
  useEffect(() => {
    setApprovedFloorOverrides({});
    setFloorOverrideTokens({});
    setPendingCheckoutOpenMemo(null);
  }, [currentTenant.id, activeTab]);

  // Inventory catalog for search & Mode A (Inventory Tracking ON) product selector
  const [catalog, setCatalog] = useState<InventoryItem[]>(() => dbService.getInventory(currentTenant.id, role));
  const [catalogSearch, setCatalogSearch] = useState('');
  const [posQuickSearch, setPosQuickSearch] = useState('');
  const [posCategoryFilter, setPosCategoryFilter] = useState<string>('ALL');
  const [selectedPosProductId, setSelectedPosProductId] = useState<string>('');
  const [selectedPosColorFilter, setSelectedPosColorFilter] = useState<string>('ALL');
  const [selectedPosVariantId, setSelectedPosVariantId] = useState<string>('');
  const [selectedPosRate, setSelectedPosRate] = useState<number>(0);
  const [selectedPosQty, setSelectedPosQty] = useState<number>(1);
  const [modeACustomization, setModeACustomization] = useState<JerseyCustomization | undefined>(undefined);
  const [pendingModeSwitchTarget, setPendingModeSwitchTarget] = useState<boolean | null>(null);
  const [externalModeChangeBanner, setExternalModeChangeBanner] = useState<boolean>(false);
  const [isSubmittingSale, setIsSubmittingSale] = useState<boolean>(false);
  const [showManualEntryBox, setShowManualEntryBox] = useState(false);
  const [manualItemTitle, setManualItemTitle] = useState('');
  const [manualItemSize, setManualItemSize] = useState('Free Size');
  const [manualItemColor, setManualItemColor] = useState('');
  const [manualItemRate, setManualItemRate] = useState<number>(400);
  const [manualItemQty, setManualItemQty] = useState<number>(1);
  const [modeMenuOpen, setModeMenuOpen] = useState(false);
  const [activeInfoPopover, setActiveInfoPopover] = useState<
    'mode' | 'manual' | 'variant' | 'builder' | 'loyalty' | 'payment' | null
  >(null);
  const [mobilePosStep, setMobilePosStep] = useState<'products' | 'cart' | 'checkout'>('products');
  const [mobileVariantModalOpen, setMobileVariantModalOpen] = useState(false);
  const [editingCartItemId, setEditingCartItemId] = useState<string | null>(null);
  const [cartSummaryExpanded, setCartSummaryExpanded] = useState(false);
  const topProductsRef = useRef<HTMLDivElement | null>(null);
  const variantSelectorRef = useRef<HTMLDivElement | null>(null);
  const counterRegisterRef = useRef<HTMLDivElement | null>(null);
  const [storeConfigState, setStoreConfigState] = useState(() =>
    dbService.getStoreConfig(currentTenant.id)
  );

  // Configured Kit & Others categories from Settings
  const kitCategories = useMemo(() => dbService.getKitCategories(currentTenant.id, role), [currentTenant.id, role, catalog]);
  const otherCategories = useMemo(() => dbService.getOtherCategories(currentTenant.id, role), [currentTenant.id, role, catalog]);

  useEffect(() => {
    const syncPosData = () => {
      setCatalog(dbService.getInventory(currentTenant.id, role));
      setClothingCategories(dbService.getClothingCategories(currentTenant.id, role));
      setStockAdjustments(dbService.getStockAdjustments(currentTenant.id));
      const nextStoreConfig = dbService.getStoreConfig(currentTenant.id);
      setStoreConfigState((prev) => {
        const prevOn =
          prev.inventoryTrackingEnabled !== false && prev.autoDeductStockOnConfirm !== false;
        const nextOn =
          nextStoreConfig.inventoryTrackingEnabled !== false &&
          nextStoreConfig.autoDeductStockOnConfirm !== false;
        if (prevOn !== nextOn) {
          setCartItems((currCart) => {
            if (currCart.length > 0) {
              setExternalModeChangeBanner(true);
              if (nextOn) {
                // Safely mark any unlinked items from OFF mode as manual so they never corrupt stock
                return currCart.map((it) =>
                  !it.variantId ? { ...it, isManualInventoryEntry: true } : it
                );
              }
            }
            return currCart;
          });
        }
        return nextStoreConfig;
      });
    };
    syncPosData();
    setSelectedLoyaltyTierId(null);
    setPosCategoryFilter('ALL');
    setSelectedPosProductId('');
    setSelectedPosColorFilter('ALL');
    setSelectedPosVariantId('');
    setExternalModeChangeBanner(false);
    setPendingModeSwitchTarget(null);
    setMobilePosStep('products');
    setMobileVariantModalOpen(false);
    window.addEventListener('lekho-storage-updated', syncPosData);
    return () => window.removeEventListener('lekho-storage-updated', syncPosData);
  }, [currentTenant.id, role]);

  // Pre-loaded clubs & countries
  const CLUBS_AND_COUNTRIES = [
    'Real Madrid',
    'Barcelona',
    'Argentina',
    'Brazil',
    'Manchester United',
    'Arsenal',
    'Manchester City',
    'Chelsea',
    'Liverpool',
    'Bayern Munich',
    'PSG',
    'Bangladesh Cricket',
    'Portugal',
    'Inter Miami',
    'Germany',
    'France',
  ];

  // Shop-scoped Customer History & Loyalty Lookup (Strictly isolated to currentTenant.id)
  const customerHistory = useMemo(
    () => dbService.getShopCustomerHistory(currentTenant.id, customerPhone, role),
    [currentTenant.id, customerPhone, role, catalog]
  );

  const loyaltySettings = useMemo(
    () => dbService.getLoyaltySettings(currentTenant.id),
    [currentTenant.id, currentTenant.storeConfig]
  );

  const storeConfig = storeConfigState;
  const inventoryTrackingEnabled =
    storeConfig.inventoryTrackingEnabled !== false &&
    storeConfig.autoDeductStockOnConfirm !== false;

  // MODE A: Category list for current shop (Clothing vs Sportswear)
  const modeAAvailableCategories = useMemo(() => {
    const catSet = new Set<string>();
    if (isClothingStore) {
      for (const c of clothingCategories) {
        if (c?.name) catSet.add(c.name);
      }
      for (const item of catalog) {
        if (item && item.isActive !== false && !item.isSoftDeleted && item.categoryType === 'apparel') {
          if (item.clothingCategory) catSet.add(item.clothingCategory);
        }
      }
    } else {
      for (const k of kitCategories) {
        if (k?.name) catSet.add(k.name);
      }
      for (const o of otherCategories) {
        if (o?.name) catSet.add(o.name);
      }
      for (const item of catalog) {
        if (item && item.isActive !== false && !item.isSoftDeleted && item.categoryType !== 'apparel') {
          const catLabel = item.jerseyCategory || item.subCategory;
          if (catLabel) catSet.add(catLabel);
        }
      }
    }
    return Array.from(catSet);
  }, [isClothingStore, clothingCategories, kitCategories, otherCategories, catalog]);

  // MODE A: Active products filtered by selected category and optional search query
  const modeAFilteredProducts = useMemo(() => {
    const q = posQuickSearch.trim().toLowerCase();
    return catalog.filter((item) => {
      if (!item || item.isActive === false || item.isSoftDeleted) return false;
      if (isClothingStore && item.categoryType !== 'apparel') return false;
      if (!isClothingStore && item.categoryType === 'apparel') return false;

      const itemCat = item.clothingCategory || item.jerseyCategory || item.subCategory || '';
      if (posCategoryFilter !== 'ALL' && itemCat !== posCategoryFilter) {
        return false;
      }

      if (!q) return true;
      const mainMatch =
        item.name.toLowerCase().includes(q) ||
        (item.sku || '').toLowerCase().includes(q) ||
        (item.color || '').toLowerCase().includes(q) ||
        itemCat.toLowerCase().includes(q) ||
        (item.clubOrCountry || '').toLowerCase().includes(q) ||
        (item.subCategory || '').toLowerCase().includes(q);
      const varMatch = (item.variants || []).some(
        (v) =>
          (v.color || '').toLowerCase().includes(q) ||
          (v.size || '').toLowerCase().includes(q) ||
          (v.sku || '').toLowerCase().includes(q)
      );
      return mainMatch || varMatch;
    });
  }, [catalog, isClothingStore, posCategoryFilter, posQuickSearch]);

  // MODE A: Currently selected product
  const selectedPosProduct = useMemo(() => {
    if (modeAFilteredProducts.length === 0) return null;
    return (
      modeAFilteredProducts.find((p) => p.id === selectedPosProductId) ||
      modeAFilteredProducts[0]
    );
  }, [modeAFilteredProducts, selectedPosProductId]);

  // MODE A: Available colors for the selected product
  const selectedProductColors = useMemo(() => {
    if (!selectedPosProduct) return [];
    const colors = new Set<string>();
    for (const v of selectedPosProduct.variants || []) {
      if (v.isActive === false) continue;
      const clr = (v.color || selectedPosProduct.color || '').trim();
      if (clr) colors.add(clr);
    }
    return Array.from(colors);
  }, [selectedPosProduct]);

  // MODE A: Active variants for the selected product (filtered by color if selected)
  const selectedProductVariants = useMemo(() => {
    if (!selectedPosProduct) return [];
    const activeVars = (selectedPosProduct.variants || []).filter((v) => v.isActive !== false);
    if (selectedPosColorFilter === 'ALL') return activeVars;
    const filtered = activeVars.filter(
      (v) =>
        (v.color || selectedPosProduct.color || '').trim().toLowerCase() ===
        selectedPosColorFilter.toLowerCase()
    );
    return filtered.length > 0 ? filtered : activeVars;
  }, [selectedPosProduct, selectedPosColorFilter]);

  // Helper: how many units of a specific variant are already in the cart
  const getVariantInCartQty = (productId: string, variantId?: string, size?: string, color?: string) => {
    return cartItems.reduce((sum, ci) => {
      if (ci.isManualInventoryEntry || ci.productId !== productId) return sum;
      if (variantId && ci.variantId === variantId) {
        return sum + (Number(ci.quantity) || 0);
      }
      if (
        !ci.variantId &&
        size &&
        ci.size.toLowerCase() === size.toLowerCase() &&
        (!color || (ci.color || '').toLowerCase() === color.toLowerCase())
      ) {
        return sum + (Number(ci.quantity) || 0);
      }
      return sum;
    }, 0);
  };

  // MODE A: Currently selected variant
  const selectedPosVariant = useMemo(() => {
    if (selectedProductVariants.length === 0) return null;
    if (selectedPosVariantId) {
      const exact = selectedProductVariants.find(
        (v) =>
          v.id === selectedPosVariantId ||
          `${v.size}::${v.color || ''}` === selectedPosVariantId
      );
      if (exact) return exact;
    }
    // Prefer first variant with remaining stock > 0
    const firstInStock = selectedProductVariants.find((v) => {
      const inCart = selectedPosProduct
        ? getVariantInCartQty(selectedPosProduct.id, v.id, v.size, v.color)
        : 0;
      return Math.max(0, (Number(v.stock) || 0) - inCart) > 0;
    });
    return firstInStock || selectedProductVariants[0];
  }, [selectedProductVariants, selectedPosVariantId, selectedPosProduct, cartItems]);

  // Keep selectedPosRate and selectedPosQty synced when selected product or variant changes
  useEffect(() => {
    if (selectedPosProduct && selectedPosVariant) {
      setSelectedPosRate(
        Number(selectedPosVariant.mrp || selectedPosProduct.mrp) || 0
      );
      setSelectedPosQty(1);
    } else if (selectedPosProduct) {
      setSelectedPosRate(Number(selectedPosProduct.mrp) || 0);
      setSelectedPosQty(1);
    }
  }, [selectedPosProduct?.id, selectedPosVariant?.id, selectedPosVariant?.size, selectedPosVariant?.color]);

  // Direct Inventory Mode Toggle Handler (Immediate toggle without modal)
  const handleRequestToggleInventoryTracking = (nextEnabled: boolean) => {
    if (!showBuyingPrice) {
      showToast('শুধুমাত্র শপ ওনার (Owner) ইনভেন্টরি ট্র্যাকিং চালু বা বন্ধ করতে পারবেন।', 'error');
      return;
    }
    if (nextEnabled && cartItems.length > 0) {
      setCartItems((currCart) =>
        currCart.map((it) => (!it.variantId ? { ...it, isManualInventoryEntry: true } : it))
      );
    }
    setPendingModeSwitchTarget(null);
    setModeMenuOpen(false);
    setExternalModeChangeBanner(false);
    const updated = dbService.setInventoryTrackingEnabled(currentTenant.id, nextEnabled, role);
    setStoreConfigState(updated);
  };

  const handleAddManualNonInventoryItem = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanTitle = manualItemTitle.trim();
    if (!cleanTitle) {
      showToast('অনুগ্রহ করে ম্যানুয়াল পণ্যের নাম লিখুন', 'warning');
      return;
    }
    const cleanRate = Math.max(0, Number(manualItemRate) || 0);
    const cleanQty = Math.max(1, Math.floor(Number(manualItemQty) || 1));
    const cleanSize = manualItemSize.trim() || 'Free Size';
    const cleanColor = manualItemColor.trim() || undefined;

    const manualLine: OrderLineItem = {
      id: `item_manual_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      itemType: isClothingStore ? 'apparel' : 'other',
      title: cleanTitle,
      subDetail: `Manual Item (Non-Inventory)${cleanColor ? ` • Color: ${cleanColor}` : ''} • Size: ${cleanSize}`,
      size: cleanSize,
      color: cleanColor,
      rate: cleanRate,
      quantity: cleanQty,
      subtotal: cleanRate * cleanQty,
      costPrice: Math.round(cleanRate * 0.6),
      bottomPrice: cleanRate,
      isManualInventoryEntry: true,
    };

    setCartItems((prev) => [...prev, manualLine]);
    setManualItemTitle('');
    setManualItemQty(1);
    setShowManualEntryBox(false);
    showToast(`Manual item "${cleanTitle}" (${cleanQty} pc) কার্টে যোগ হয়েছে!`, 'success');
  };

  // Check customer blacklist, registered reseller, and auto-fill known shop customer name
  useEffect(() => {
    setSelectedLoyaltyTierId(null);
    if (customerPhone.length >= 10) {
      const match = dbService.checkCustomerBlacklist(customerPhone);
      setBlacklistAlert(match || null);

      const resellers = dbService.getResellers(currentTenant.id);
      const cleanInput = customerPhone.replace(/[^0-9]/g, '');
      const resMatch = resellers.find((r) => r.phone.replace(/[^0-9]/g, '') === cleanInput);
      setMatchedReseller(resMatch || null);
    } else {
      setBlacklistAlert(null);
      setMatchedReseller(null);
    }
  }, [customerPhone, currentTenant.id]);

  // Auto-fill customer name when phone matches an existing customer in the active shop
  useEffect(() => {
    if (
      customerHistory.existsInShop &&
      customerHistory.customerName &&
      (!customerName.trim() || customerName.trim() === 'Walk-in Customer')
    ) {
      setCustomerName(customerHistory.customerName);
    }
  }, [customerHistory.existsInShop, customerHistory.customerName]);

  // Eligible Loyalty Reward Tiers & Calculations
  const eligibleLoyaltyTiers = useMemo(
    () => getEligibleLoyaltyTiers(customerHistory.loyaltyPoints, loyaltySettings),
    [customerHistory.loyaltyPoints, loyaltySettings]
  );

  const selectedLoyaltyTier = useMemo(
    () => eligibleLoyaltyTiers.find((t) => t.id === selectedLoyaltyTierId) || null,
    [eligibleLoyaltyTiers, selectedLoyaltyTierId]
  );

  const cartSubtotal = cartItems.reduce((acc, item) => acc + item.subtotal, 0);

  const loyaltyRedemption = useMemo(
    () =>
      calculateLoyaltyRedemption({
        cartSubtotal,
        manualDiscount: discount,
        selectedTier: selectedLoyaltyTier,
        availablePoints: customerHistory.loyaltyPoints,
        cartItems,
        enforceBottomPriceLock: storeConfig.enforceBottomPriceLock !== false,
      }),
    [
      cartSubtotal,
      discount,
      selectedLoyaltyTier,
      customerHistory.loyaltyPoints,
      cartItems,
      storeConfig.enforceBottomPriceLock,
    ]
  );

  const finalTotal = loyaltyRedemption.finalTotal;
  const effectiveAdvance = paymentMode === 'paid' ? finalTotal : Math.min(advancePaid, finalTotal);
  const dueAmount = Math.max(0, finalTotal - effectiveAdvance);
  const previewEarnedPoints = useMemo(
    () =>
      calculateEarnedLoyaltyPoints(
        finalTotal,
        loyaltySettings,
        dueAmount > 0 ? 'partial_due' : 'completed'
      ),
    [finalTotal, loyaltySettings, dueAmount]
  );

  // Dynamic Jersey & Others builder methods
  const handleAddJerseyRow = () => {
    setJerseyRows((prev) => [
      ...prev,
      {
        id: `j_row_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        category: 'Player Issue',
        clubOrCountry: 'Argentina',
        size: 'L',
        rate: 1500,
        quantity: 1,
        bottomPrice: 1250,
        costPrice: 750,
        isOther: false,
      },
    ]);
  };

  const handleAddOtherRow = () => {
    setJerseyRows((prev) => [
      ...prev,
      {
        id: `other_row_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        category: 'Other',
        clubOrCountry: 'Other Category Item',
        size: 'Standard',
        rate: 350,
        quantity: 1,
        bottomPrice: 200,
        costPrice: 150,
        isOther: true,
        customTitle: '',
        customSizeOrDetail: '',
      },
    ]);
  };

  const handleRemoveJerseyRow = (id: string) => {
    if (jerseyRows.length <= 1) return;
    setJerseyRows((prev) => prev.filter((r) => r.id !== id));
  };

  const handleUpdateJerseyRow = (id: string, field: string, val: any) => {
    setJerseyRows((prev) =>
      prev.map((row) => {
        if (row.id === id) {
          const updated = { ...row, [field]: val };

          // adjust default pricing if category changes
          if (field === 'category') {
            if (val === 'Other') {
              updated.isOther = true;
              updated.otherCategoryId = 'custom';
              if (updated.rate >= 900) {
                updated.rate = 250;
                updated.costPrice = 120;
              }
            } else {
              updated.isOther = false;
              // Look up dynamic Kit Category from Settings
              const matchedKit = kitCategories.find((k) => k.name === val || k.id === val);
              if (matchedKit) {
                updated.rate = matchedKit.defaultMrp;
                updated.bottomPrice = matchedKit.defaultBottomPrice;
                updated.costPrice = matchedKit.defaultCostPrice; // hidden buying price
              } else {
                updated.rate = 1200;
                updated.bottomPrice = 1000;
                updated.costPrice = 650;
              }
            }
          }

          // adjust product and price if Other category selection changes
          if (field === 'otherCategoryId') {
            updated.otherCategoryId = val;
            if (val === 'custom') {
              // Custom product: keep or reset title, manual buying price input
              if (!updated.customTitle) {
                updated.customTitle = '';
              }
            } else {
              const matchedOther = otherCategories.find((o) => o.id === val || o.name === val);
              if (matchedOther) {
                updated.customTitle = matchedOther.name;
                updated.rate = matchedOther.defaultMrp;
                updated.costPrice = matchedOther.defaultCostPrice;
                updated.bottomPrice = matchedOther.defaultMrp;
              }
            }
          }

          return updated;
        }
        return row;
      })
    );
  };

  // MODE B (Inventory Tracking OFF): Jersey Order Builder -> Cart (Does NOT require or deduct inventory)
  const handleAddJerseyRowsToCart = () => {
    const newItems: OrderLineItem[] = jerseyRows.map((row) => {
      if (row.isOther || row.category === 'Other') {
        const title = row.customTitle?.trim() || 'Custom Product / অন্যান্য পণ্য';
        const detailStr = row.customSizeOrDetail?.trim()
          ? `Others • ${row.customSizeOrDetail}`
          : 'Others (Custom Entry)';

        return {
          id: `item_other_${Date.now()}_${Math.random().toString().slice(2, 6)}`,
          itemType: 'other',
          title,
          subDetail: detailStr,
          size: row.customSizeOrDetail || 'Standard',
          rate: Number(row.rate) || 0,
          quantity: Number(row.quantity) || 1,
          subtotal: (Number(row.rate) || 0) * (Number(row.quantity) || 1),
          costPrice: row.costPrice || Math.round((Number(row.rate) || 0) * 0.6),
          bottomPrice: row.bottomPrice || Number(row.rate) || 0,
          isManualInventoryEntry: true,
        };
      }

      const extraPrint = row.customization?.extraCharge || 0;
      const rate = row.rate + extraPrint;
      const detailStr = `${row.category} • ${row.size}${
        row.customization ? ` • [CUSTOM: ${row.customization.customName} #${row.customization.customNumber}]` : ''
      }`;
      const candidateTitle = `${row.clubOrCountry} Kit`;

      return {
        id: `item_${Date.now()}_${Math.random().toString().slice(2, 6)}`,
        itemType: 'jersey',
        title: candidateTitle,
        subDetail: detailStr,
        size: row.size,
        rate,
        quantity: row.quantity,
        subtotal: rate * row.quantity,
        costPrice: row.costPrice,
        bottomPrice: row.bottomPrice,
        customization: row.customization,
        isManualInventoryEntry: true,
      };
    });

    setCartItems((prev) => [...prev, ...newItems]);
    showToast(`Added ${jerseyRows.length} item(s) to cart!`, 'success');
  };

  // Men's Clothing Quick Order Builder Handlers (MODE B: Inventory Tracking OFF)
  const getScaleForClothingCategory = (
    catName: MenClothingCategory
  ): 'shirts_tops' | 'denim_pants' | 'panjabi' => {
    const matched = clothingCategories.find((c) => c.name === catName);
    if (matched) return matched.apparelScale;
    if (catName === 'Pant / Trouser' || catName === 'Jeans' || catName === 'Shorts') return 'denim_pants';
    if (catName === 'Panjabi') return 'panjabi';
    return 'shirts_tops';
  };

  const handleAddClothingRow = () => {
    const defaultCat = clothingCategories[0];
    const catName = (defaultCat?.name || 'T-Shirt') as MenClothingCategory;
    const scale = getScaleForClothingCategory(catName);
    setClothingRows((prev) => [
      ...prev,
      {
        id: `c_row_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        clothingCategory: catName,
        title: `${catName}`,
        brandOrSubCategory: '',
        color: '',
        size: SIZES_BY_SCALE[scale][1] || 'L',
        rate: defaultCat?.defaultMrp || 850,
        costPrice: defaultCat?.defaultCostPrice || 450,
        bottomPrice: defaultCat?.defaultBottomPrice || 700,
        quantity: 1,
      },
    ]);
  };

  const handleRemoveClothingRow = (id: string) => {
    if (clothingRows.length <= 1) return;
    setClothingRows((prev) => prev.filter((r) => r.id !== id));
  };

  const handleUpdateClothingRow = (id: string, field: string, val: any) => {
    setClothingRows((prev) =>
      prev.map((row) => {
        if (row.id !== id) return row;
        const updated = { ...row, [field]: val };
        if (field === 'clothingCategory') {
          const catName = val as MenClothingCategory;
          const matched = clothingCategories.find((c) => c.name === catName);
          const scale = getScaleForClothingCategory(catName);
          updated.size = SIZES_BY_SCALE[scale][1] || SIZES_BY_SCALE[scale][0];
          if (matched) {
            updated.rate = matched.defaultMrp;
            updated.costPrice = matched.defaultCostPrice;
            updated.bottomPrice = matched.defaultBottomPrice;
          }
          if (!updated.title || clothingCategories.some((c) => updated.title.includes(c.name))) {
            updated.title = `Men's ${catName}`;
          }
        }
        return updated;
      })
    );
  };

  // MODE B (Inventory Tracking OFF): Men's Clothing Order Builder -> Cart (Does NOT require or deduct inventory)
  const handleAddClothingRowsToCart = () => {
    const newItems: OrderLineItem[] = clothingRows.map((row) => {
      const rate = Number(row.rate) || 0;
      const qty = Math.max(1, Number(row.quantity) || 1);
      const cleanColor = row.color?.trim() || undefined;
      const cleanTitle = row.title.trim() || `Men's ${row.clothingCategory}`;

      const subParts: string[] = [row.clothingCategory];
      if (row.brandOrSubCategory.trim()) subParts.push(row.brandOrSubCategory.trim());
      if (cleanColor) {
        subParts.push(`Color: ${cleanColor}`);
      }
      subParts.push(`Size ${row.size}`);
      return {
        id: `item_cloth_${Date.now()}_${Math.random().toString().slice(2, 6)}`,
        itemType: 'apparel',
        title: cleanTitle,
        subDetail: subParts.join(' • '),
        size: row.size,
        color: cleanColor,
        rate,
        quantity: qty,
        subtotal: rate * qty,
        costPrice: Number(row.costPrice) || Math.round(rate * 0.55),
        bottomPrice: Number(row.bottomPrice) || Math.round(rate * 0.85),
        requiresAlteration,
        isManualInventoryEntry: true,
      };
    });
    setCartItems((prev) => [...prev, ...newItems]);
    showToast(`Added ${clothingRows.length} clothing item(s) to cart!`, 'success');
  };

  // Product & Multi-Variant Create / Edit Handlers (Supports BOTH Clothing & Sportswear)
  const openCreateProductModal = () => {
    if (isClothingStore) {
      const firstCat = (clothingCategories[0]?.name || 'T-Shirt') as MenClothingCategory;
      const scale = getScaleForClothingCategory(firstCat);
      setEditingProduct(null);
      setProdName('');
      setProdCategory(firstCat);
      setProdSubCategory('');
      setProdColor('Black');
      setProdSku(`CL-${firstCat.slice(0, 3).toUpperCase()}-${Date.now().toString().slice(-3)}`);
      setProdScale(scale);
      setProdCost(clothingCategories[0]?.defaultCostPrice || 450);
      setProdMrp(clothingCategories[0]?.defaultMrp || 850);
      setProdBottom(clothingCategories[0]?.defaultBottomPrice || 700);
      setProdImageUrl('');
      setProdEditReason('Initial stock entry');
      setProdVariants(
        SIZES_BY_SCALE[scale].map((size) => ({
          size,
          color: 'Black',
          stock: 5,
          isActive: true,
        }))
      );
    } else {
      const firstKit = kitCategories[0];
      const catName = firstKit?.name || 'Player Issue';
      setEditingProduct(null);
      setProdName('');
      setProdCategory(catName);
      setProdSubCategory('Real Madrid');
      setProdColor('Home White');
      setProdSku(`KIT-${Date.now().toString().slice(-4)}`);
      setProdScale('shirts_tops');
      setProdCost(firstKit?.defaultCostPrice || 720);
      setProdMrp(firstKit?.defaultMrp || 1450);
      setProdBottom(firstKit?.defaultBottomPrice || 1200);
      setProdImageUrl('');
      setProdEditReason('Initial stock entry');
      setProdVariants(
        ['S', 'M', 'L', 'XL', 'XXL'].map((size) => ({
          size,
          color: 'Home White',
          stock: 5,
          isActive: true,
        }))
      );
    }
    setProductModalOpen(true);
  };

  const openEditProductModal = (item: InventoryItem) => {
    const cat = (item.clothingCategory || item.jerseyCategory || 'T-Shirt') as MenClothingCategory;
    const scale = item.apparelScale || getScaleForClothingCategory(cat);
    setEditingProduct(item);
    setProdName(item.name);
    setProdCategory(cat);
    setProdSubCategory(item.subCategory || item.clubOrCountry || '');
    setProdColor(item.color || '');
    setProdSku(item.sku);
    setProdScale(scale);
    setProdCost(item.lotCostLandingPrice);
    setProdMrp(item.mrp);
    setProdBottom(item.bottomPrice);
    setProdImageUrl(item.imageUrl || '');
    setProdEditReason('Physical stock recount correction');
    setProdVariants(
      item.variants.length > 0
        ? item.variants.map((v) => ({
            id: v.id,
            sku: v.sku,
            size: v.size,
            color: v.color || item.color || '',
            stock: v.stock,
            costPrice: v.costPrice,
            mrp: v.mrp,
            bottomPrice: v.bottomPrice,
            isActive: v.isActive !== false,
          }))
        : SIZES_BY_SCALE[scale].map((size) => ({
            size,
            color: item.color || '',
            stock: 0,
            isActive: true,
          }))
    );
    setProductModalOpen(true);
  };

  const openStockCorrectionModalForProduct = (item?: InventoryItem) => {
    const target = item || catalog[0];
    setStockAdjustments(dbService.getStockAdjustments(currentTenant.id));
    if (target) {
      setStockTargetProductId(target.id);
      const firstVar = target.variants?.[0];
      if (firstVar) {
        setStockTargetVariantKey(`${firstVar.size}::${firstVar.color || ''}`);
        setStockNewQty(firstVar.stock);
      }
    }
    setStockCorrectionReason('');
    setStockLedgerModalOpen(true);
  };

  const handleSubmitStockCorrection = (e: React.FormEvent) => {
    e.preventDefault();
    if (!stockTargetProductId) {
      showToast('অনুগ্রহ করে একটি পণ্য নির্বাচন করুন।', 'error');
      return;
    }
    if (!stockCorrectionReason.trim()) {
      showToast('স্টক পরিবর্তনের কারণ (Reason) উল্লেখ করা আবশ্যক।', 'error');
      return;
    }
    const [targetSize, targetColor] = stockTargetVariantKey.split('::');
    try {
      const { adjustmentRecord } = dbService.correctVariantStock({
        shopId: currentTenant.id,
        productId: stockTargetProductId,
        size: targetSize || 'M',
        color: targetColor || undefined,
        newQty: stockNewQty,
        reason: stockCorrectionReason.trim(),
        responsibleUser: activeStaff?.name || currentTenant.ownerName || 'Shop Owner',
        userRole: role,
      });
      setCatalog(dbService.getInventory(currentTenant.id, role));
      setStockAdjustments(dbService.getStockAdjustments(currentTenant.id));
      setStockCorrectionReason('');
      showToast(
        `স্টক আপডেট সম্পন্ন: ${adjustmentRecord.productName} (${adjustmentRecord.size}) ${adjustmentRecord.previousQty} → ${adjustmentRecord.newQty} pcs`,
        'success'
      );
    } catch (err: any) {
      showToast(err?.message || 'স্টক আপডেট ব্যর্থ হয়েছে।', 'error');
    }
  };

  const handleProdImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const compressed = await compressProductImageFile(file);
      setProdImageUrl(compressed);
      showToast('ছবিটি সফলভাবে রিসাইজ ও অপ্টিমাইজ করা হয়েছে!', 'success');
    } catch (err: any) {
      showToast(err?.message || 'ছবি আপলোড করতে সমস্যা হয়েছে।', 'error');
    }
  };

  const handleAddCustomVariantToModal = () => {
    const sz = customVariantSize.trim() || 'L';
    const clr = customVariantColor.trim() || prodColor.trim() || undefined;
    const exists = prodVariants.some(
      (v) =>
        v.size.toLowerCase() === sz.toLowerCase() &&
        (v.color || '').toLowerCase() === (clr || '').toLowerCase()
    );
    if (exists) {
      showToast('এই সাইজ ও কালার ভ্যারিয়েন্টটি ইতিমধ্যে তালিকায় আছে।', 'info');
      return;
    }
    setProdVariants((prev) => [
      ...prev,
      {
        size: sz,
        color: clr,
        stock: 5,
        costPrice: prodCost,
        mrp: prodMrp,
        bottomPrice: prodBottom,
        isActive: true,
      },
    ]);
    setCustomVariantSize('');
  };

  const handleProdCategoryChange = (catName: MenClothingCategory) => {
    setProdCategory(catName);
    if (isClothingStore) {
      const matched = clothingCategories.find((c) => c.name === catName);
      const scale = getScaleForClothingCategory(catName);
      setProdScale(scale);
      if (!editingProduct) {
        if (matched) {
          setProdCost(matched.defaultCostPrice);
          setProdMrp(matched.defaultMrp);
          setProdBottom(matched.defaultBottomPrice);
        }
        setProdSku(
          `CL-${catName.replace(/[^A-Za-z]/g, '').slice(0, 3).toUpperCase()}-${Date.now().toString().slice(-3)}`
        );
        setProdVariants(
          SIZES_BY_SCALE[scale].map((size) => ({
            size,
            color: prodColor.trim() || undefined,
            stock: 5,
            isActive: true,
          }))
        );
      } else if (scale !== prodScale) {
        setProdVariants(
          SIZES_BY_SCALE[scale].map((size) => ({
            size,
            color: prodColor.trim() || undefined,
            stock: 5,
            isActive: true,
          }))
        );
      }
    } else {
      const matchedKit = kitCategories.find((k) => k.name === catName);
      if (!editingProduct && matchedKit) {
        setProdCost(matchedKit.defaultCostPrice);
        setProdMrp(matchedKit.defaultMrp);
        setProdBottom(matchedKit.defaultBottomPrice);
      }
    }
  };

  const handleSaveClothingProduct = (e: React.FormEvent) => {
    e.preventDefault();
    if (!prodName.trim()) {
      showToast('অনুগ্রহ করে পণ্যের নাম লিখুন।', 'error');
      return;
    }
    const cleanColor = prodColor.trim() || undefined;
    const prodId = editingProduct
      ? editingProduct.id
      : isClothingStore
      ? `inv_cloth_${Date.now()}`
      : `inv_sport_${Date.now()}`;
    const cleanSku = prodSku.trim() || `${isClothingStore ? 'CL' : 'SP'}-${Date.now().toString().slice(-4)}`;

    const builtVariants = prodVariants.map((v, idx) => {
      const vColor = v.color?.trim() || cleanColor;
      const vId = v.id || buildVariantId(prodId, v.size || `V${idx + 1}`, vColor);
      const vSku =
        v.sku ||
        `${cleanSku}-${vColor ? `${vColor.slice(0, 3).toUpperCase()}-` : ''}${v.size}`;
      return {
        id: vId,
        sku: vSku,
        size: v.size,
        color: vColor,
        stock: Math.max(0, Number(v.stock) || 0),
        costPrice: Number(v.costPrice ?? prodCost) || 0,
        mrp: Number(v.mrp ?? prodMrp) || 0,
        bottomPrice: Number(v.bottomPrice ?? prodBottom) || 0,
        imageUrl: prodImageUrl || undefined,
        isActive: v.isActive !== false,
      };
    });

    const totalStock = builtVariants
      .filter((v) => v.isActive !== false)
      .reduce((sum, v) => sum + Math.max(0, Number(v.stock) || 0), 0);

    const savedItem: InventoryItem = {
      id: prodId,
      shopId: currentTenant.id,
      sku: cleanSku,
      name: prodName.trim(),
      categoryType: isClothingStore ? 'apparel' : 'jersey',
      clothingCategory: isClothingStore ? prodCategory : undefined,
      jerseyCategory: !isClothingStore ? (prodCategory as any) : undefined,
      clubOrCountry: !isClothingStore ? prodSubCategory.trim() || undefined : undefined,
      subCategory: prodSubCategory.trim() || undefined,
      color: cleanColor,
      apparelScale: prodScale,
      lotCostLandingPrice: Number(prodCost) || 0,
      mrp: Number(prodMrp) || 0,
      bottomPrice: Number(prodBottom) || 0,
      totalStock,
      imageUrl: prodImageUrl || undefined,
      isActive: true,
      variants: builtVariants,
    };

    // Record stock adjustments if editing an existing product and any variant stock changed
    if (editingProduct) {
      const adjustmentLogs: StockAdjustmentRecord[] = [];
      for (const nextVar of builtVariants) {
        const oldVar = editingProduct.variants.find(
          (ov) =>
            (ov.id && ov.id === nextVar.id) ||
            (ov.size === nextVar.size && (ov.color || '') === (nextVar.color || ''))
        );
        const prevQty = oldVar ? Math.max(0, Number(oldVar.stock) || 0) : 0;
        if (prevQty !== nextVar.stock) {
          adjustmentLogs.push(
            createStockMovementRecord({
              shopId: currentTenant.id,
              item: savedItem,
              variant: nextVar,
              size: nextVar.size,
              color: nextVar.color,
              previousQty: prevQty,
              newQty: nextVar.stock,
              movementType: 'manual_correction',
              reason: prodEditReason.trim() || 'Product edit stock correction',
              responsibleUser: activeStaff?.name || currentTenant.ownerName || 'Shop Owner',
              userRole: role,
            })
          );
        }
      }
      if (adjustmentLogs.length > 0) {
        dbService.appendStockAdjustments(currentTenant.id, adjustmentLogs);
        setStockAdjustments(dbService.getStockAdjustments(currentTenant.id));
      }
    } else {
      // Initial stock entry log
      const initialLogs = builtVariants
        .filter((v) => v.stock > 0)
        .map((v) =>
          createStockMovementRecord({
            shopId: currentTenant.id,
            item: savedItem,
            variant: v,
            size: v.size,
            color: v.color,
            previousQty: 0,
            newQty: v.stock,
            movementType: 'initial_entry',
            reason: 'Initial product & variant stock entry',
            responsibleUser: activeStaff?.name || currentTenant.ownerName || 'Shop Owner',
            userRole: role,
          })
        );
      if (initialLogs.length > 0) {
        dbService.appendStockAdjustments(currentTenant.id, initialLogs);
        setStockAdjustments(dbService.getStockAdjustments(currentTenant.id));
      }
    }

    dbService.saveInventoryItem(currentTenant.id, savedItem, role);
    setCatalog(dbService.getInventory(currentTenant.id, role));
    setProductModalOpen(false);
    showToast(
      editingProduct
        ? `"${savedItem.name}" স্টক ও ভ্যারিয়েন্ট আপডেট হয়েছে!`
        : `"${savedItem.name}" ইনভেন্টরিতে যুক্ত হয়েছে!`,
      'success'
    );
  };

  const handleDeleteClothingProduct = (item: InventoryItem) => {
    dbService.deleteInventoryItem(currentTenant.id, item.id);
    setCatalog(dbService.getInventory(currentTenant.id, role));
    showToast(`"${item.name}" রিসাইকেল বিনে পাঠানো হয়েছে।`, 'info');
  };

  // MODE A (Inventory Tracking ON): Add selected Inventory Product + Variant + Quantity to Cart
  const handleAddModeAVariantToCart = () => {
    if (!selectedPosProduct) {
      showToast('অনুগ্রহ করে একটি পণ্য নির্বাচন করুন।', 'warning');
      return;
    }
    if (!selectedPosVariant) {
      showToast('অনুগ্রহ করে পণ্যের সাইজ বা ভ্যারিয়েন্ট নির্বাচন করুন।', 'warning');
      return;
    }

    const variantStock = Math.max(0, Number(selectedPosVariant.stock) || 0);
    const alreadyInCart = getVariantInCartQty(
      selectedPosProduct.id,
      selectedPosVariant.id,
      selectedPosVariant.size,
      selectedPosVariant.color
    );
    const remainingAvailable = Math.max(0, variantStock - alreadyInCart);
    const qtyToAdd = Math.max(1, Math.floor(Number(selectedPosQty) || 1));

    if (qtyToAdd > remainingAvailable) {
      showToast(
        `অপর্যাপ্ত স্টক! "${selectedPosProduct.name}" (${
          selectedPosVariant.color ? `${selectedPosVariant.color} • ` : ''
        }${selectedPosVariant.size}) স্টকে আছে ${variantStock} পিস${
          alreadyInCart > 0 ? ` (কার্টে ইতিমধ্যে আছে ${alreadyInCart} পিস)` : ''
        }।`,
        'error'
      );
      return;
    }

    const baseRate =
      Number(selectedPosRate) > 0
        ? Number(selectedPosRate)
        : Number(selectedPosVariant.mrp || selectedPosProduct.mrp) || 0;
    const extraPrint = !isClothingStore && modeACustomization ? Number(modeACustomization.extraCharge) || 0 : 0;
    const unitRate = baseRate + extraPrint;
    const bottom = Number(selectedPosVariant.bottomPrice || selectedPosProduct.bottomPrice) || 0;
    const cost = Number(selectedPosVariant.costPrice || selectedPosProduct.lotCostLandingPrice) || 0;
    const itemColor = selectedPosVariant.color || selectedPosProduct.color || undefined;
    const itemSku = selectedPosVariant.sku || selectedPosProduct.sku;
    const catLabel =
      selectedPosProduct.clothingCategory ||
      selectedPosProduct.jerseyCategory ||
      selectedPosProduct.subCategory ||
      '';

    const detailParts: string[] = [];
    if (catLabel) detailParts.push(catLabel);
    if (itemSku) detailParts.push(`SKU: ${itemSku}`);
    if (itemColor) detailParts.push(`Color: ${itemColor}`);
    detailParts.push(`Size: ${selectedPosVariant.size}`);
    if (!isClothingStore && modeACustomization) {
      detailParts.push(
        `[CUSTOM: ${modeACustomization.customName} #${modeACustomization.customNumber}]`
      );
    }
    if (isClothingStore && requiresAlteration) {
      detailParts.push('[Alteration]');
    }

    setCartItems((prev) => {
      // Merge into existing cart line if same variantId, rate, customization, and alteration
      const existingIdx = prev.findIndex(
        (ci) =>
          !ci.isManualInventoryEntry &&
          ci.productId === selectedPosProduct.id &&
          ci.variantId === selectedPosVariant.id &&
          ci.rate === unitRate &&
          Boolean(ci.requiresAlteration) === Boolean(isClothingStore && requiresAlteration) &&
          JSON.stringify(ci.customization || null) ===
            JSON.stringify(!isClothingStore ? modeACustomization || null : null)
      );

      if (existingIdx !== -1) {
        const next = [...prev];
        const target = next[existingIdx];
        const nextQty = target.quantity + qtyToAdd;
        next[existingIdx] = {
          ...target,
          quantity: nextQty,
          subtotal: unitRate * nextQty,
        };
        return next;
      }

      const newLine: OrderLineItem = {
        id: `item_inv_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        productId: selectedPosProduct.id,
        variantId: selectedPosVariant.id,
        sku: itemSku,
        itemType: selectedPosProduct.categoryType,
        title: selectedPosProduct.name,
        subDetail: detailParts.join(' • '),
        size: selectedPosVariant.size,
        color: itemColor,
        rate: unitRate,
        quantity: qtyToAdd,
        subtotal: unitRate * qtyToAdd,
        costPrice: cost,
        bottomPrice: bottom,
        requiresAlteration: isClothingStore ? requiresAlteration : undefined,
        customization: !isClothingStore ? modeACustomization : undefined,
        isManualInventoryEntry: false,
      };
      return [...prev, newLine];
    });

    setSelectedPosQty(1);
    setModeACustomization(undefined);
    setMobileVariantModalOpen(false);
    showToast(
      `কার্টে যোগ হয়েছে: ${selectedPosProduct.name} (${
        itemColor ? `${itemColor} / ` : ''
      }${selectedPosVariant.size}) × ${qtyToAdd}`,
      'success'
    );
  };

  const handleRemoveCartItem = (id: string) => {
    setCartItems((prev) => prev.filter((item) => item.id !== id));
  };

  const handleUpdateItemRate = (id: string, newRate: number) => {
    setCartItems((prev) =>
      prev.map((item) => {
        if (item.id === id) {
          return {
            ...item,
            rate: newRate,
            subtotal: newRate * item.quantity,
          };
        }
        return item;
      })
    );
  };

  const handleUpdateCartItemQuantity = (id: string, nextQtyRaw: number) => {
    const nextQty = Math.max(1, Math.floor(Number(nextQtyRaw) || 1));
    const targetItem = cartItems.find((i) => i.id === id);
    if (!targetItem) return;

    if (
      inventoryTrackingEnabled &&
      !targetItem.isManualInventoryEntry &&
      targetItem.productId
    ) {
      const match = findMatchingInventoryVariant(catalog, targetItem, currentTenant.id);
      if (match) {
        const otherLinesQty = cartItems.reduce((sum, ci) => {
          if (
            ci.id !== id &&
            !ci.isManualInventoryEntry &&
            ci.productId === match.product.id &&
            ci.variantId === match.variant.id
          ) {
            return sum + (Number(ci.quantity) || 0);
          }
          return sum;
        }, 0);
        const maxAllowedForThisLine = Math.max(0, (Number(match.variant.stock) || 0) - otherLinesQty);
        if (nextQty > maxAllowedForThisLine) {
          showToast(
            `অপর্যাপ্ত স্টক! "${match.product.name}" (${match.variant.size}) স্টকে আছে মোট ${match.variant.stock} পিস।`,
            'error'
          );
          return;
        }
      }
    }

    setCartItems((prev) =>
      prev.map((item) =>
        item.id === id
          ? {
              ...item,
              quantity: nextQty,
              subtotal: item.rate * nextQty,
            }
          : item
      )
    );
  };

  // Checkout Execution
  const handleCompleteSale = async (
    openMemo: boolean = true,
    overridesArg?: BottomPriceOverrideMap,
    tokensArg?: Record<string, string>
  ) => {
    if (isSubmittingSale) return;
    if (!subscriptionCheck.allowed) {
      showToast(
        subscriptionCheck.reasonBn ||
          'আপনার দোকানের সাবস্ক্রিপশনের মেয়াদ শেষ হয়েছে। নতুন বিল করতে সাবস্ক্রিপশন নবায়ন করুন।',
        'error'
      );
      return;
    }

    if (cartItems.length === 0) {
      showToast('Cart is empty. Add items to bill.', 'error');
      return;
    }

    // BOTTOM-PRICE CHECK: Verify if salesman discounted below protected floor price (or via loyalty discount)!
    const activeOverrides = overridesArg ?? approvedFloorOverrides;
    const activeTokens = tokensArg ?? floorOverrideTokens;
    const floorViolation = findFirstBottomPriceViolation(cartItems, activeOverrides);
    if (floorViolation) {
      setPendingCheckoutOpenMemo(openMemo);
      setBottomPriceLockedItem({
        item: floorViolation.item,
        bottomPrice: floorViolation.bottomPrice,
      });
      return;
    }

    if (
      loyaltyRedemption.violatesBottomPriceFloor &&
      !hasAnyBottomPriceOverrideUsed(cartItems, activeOverrides) &&
      role !== 'shop_owner' &&
      role !== 'super_admin'
    ) {
      const firstCartItem = cartItems[0];
      if (firstCartItem) {
        setPendingCheckoutOpenMemo(openMemo);
        setBottomPriceLockedItem({
          item: firstCartItem,
          bottomPrice: firstCartItem.bottomPrice,
        });
        return;
      }
    }

    // Validate Split Payment if Split is selected
    if (paymentChannel === 'split') {
      const splitValidation = validateSplitPayment(splitBreakdown, effectiveAdvance);
      if (!splitValidation.valid) {
        showToast(splitValidation.errorBn || 'অনুগ্রহ করে Split Payment-এর হিসাব মিলিয়ে নিন।', 'error');
        setSplitModalOpen(true);
        return;
      }
    }

    setIsSubmittingSale(true);
    try {
      const slugPrefix = (currentTenant.slug || currentTenant.name || 'LK').slice(0, 2).toUpperCase();
      const invoiceNo = `${slugPrefix}-${new Date().getFullYear()}-${Date.now().toString().slice(-4)}`;

      const hasBelowFloor =
        cartItems.some((item) => {
          const bottom = Number(item.bottomPrice) || 0;
          return bottom > 0 && item.rate < bottom;
        }) || loyaltyRedemption.violatesBottomPriceFloor;

      const newInvoice: Invoice = {
        id: `inv_${Date.now()}`,
        invoiceNo,
        shopId: currentTenant.id,
        customerName: customerName.trim() || 'Walk-in Customer',
        customerPhone: customerPhone.trim(),
        salesmanId: activeStaff ? activeStaff.id : 'counter_staff',
        salesmanName: activeStaff ? activeStaff.name : 'Counter Staff',
        items: cartItems.map((item) => ({
          ...item,
          overrideToken: activeTokens[item.id] || activeTokens[item.productId || ''],
        })),
        subtotal: cartSubtotal,
        discount: loyaltyRedemption.combinedDiscount,
        total: finalTotal,
        paymentMode,
        paymentChannel,
        splitBreakdown: paymentChannel === 'split' && splitBreakdown ? splitBreakdown : undefined,
        advancePaid: effectiveAdvance,
        dueAmount,
        status: dueAmount > 0 ? 'partial_due' : 'completed',
        ownerPinAuthorized: hasAnyBottomPriceOverrideUsed(cartItems, activeOverrides),
        hasBelowFloorDiscount: hasBelowFloor,
        loyaltyPointsEarned: previewEarnedPoints,
        loyaltyPointsRedeemed: loyaltyRedemption.pointsToRedeem,
        loyaltyDiscountAmount: loyaltyRedemption.loyaltyDiscountAmount,
        loyaltyTierApplied: selectedLoyaltyTier?.label,
        partyType: 'Retail',
        createdAt: new Date().toISOString(),
      };

      // If sale contains below-floor items, verify with trusted backend
      if (hasBelowFloor && role !== 'shop_owner' && role !== 'super_admin') {
        if (typeof navigator !== 'undefined' && !navigator.onLine) {
          showToast(
            'Offline Security Lock: অফলাইনে বটম-প্রাইসের নিচে বিক্রির অনুমোদন সম্ভব নয়। অনলাইন সংযোগ চালু করুন।',
            'error'
          );
          return;
        }
        const serverAuth = await dbService.createAuthorizedInvoice(currentTenant.id, newInvoice, activeTokens);
        if (!serverAuth.success) {
          showToast(serverAuth.message || 'বটম-প্রাইস ভেরিফিকেশন ব্যর্থ হয়েছে।', 'error');
          return;
        }
      }

      // Commit invoice & atomic stock validation/deduction FIRST so any stock error aborts cleanly without side effects
      dbService.addInvoice(currentTenant.id, newInvoice);

      // Only after invoice + stock deduction succeed, record alteration if requested
      const altItem = cartItems.find((i) => i.requiresAlteration);
      if (altItem) {
        dbService.addAlteration(currentTenant.id, {
          id: `alt_${Date.now()}`,
          shopId: currentTenant.id,
          invoiceId: newInvoice.id,
          customerName: newInvoice.customerName,
          customerPhone: newInvoice.customerPhone,
          itemName: altItem.title,
          size: altItem.size,
          tailorInstruction: tailorNote,
          tailorFee,
          deliveryDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          status: 'sent_to_tailor',
          createdAt: new Date().toISOString(),
        });
      }

      setCatalog(dbService.getInventory(currentTenant.id, role));
      setStockAdjustments(dbService.getStockAdjustments(currentTenant.id));

      // Reset counter & one-sale floor price overrides and tokens
      if (openMemo) {
        setActiveReceipt(newInvoice);
      }
      setCartItems([]);
      setApprovedFloorOverrides({});
      setFloorOverrideTokens({});
      setPendingCheckoutOpenMemo(null);
      setDiscount(0);
      setSelectedLoyaltyTierId(null);
      setAdvancePaid(0);
      setSplitBreakdown(null);
      setExternalModeChangeBanner(false);
      setMobilePosStep('products');
      setMobileVariantModalOpen(false);
      showToast(
        openMemo
          ? `Invoice #${newInvoice.invoiceNo} generated! ৳${finalTotal}`
          : `Quick Cash In: ৳${finalTotal} saved to drawer!`,
        'success'
      );
    } catch (err: any) {
      showToast(
        err?.message || 'চেকআউট সম্পন্ন করা যায়নি। স্টক ও পণ্যের পরিমাণ যাচাই করুন।',
        'error'
      );
    } finally {
      setIsSubmittingSale(false);
    }
  };

  const totalCartUnits = useMemo(
    () => cartItems.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0),
    [cartItems]
  );

  const renderInventoryToggleSwitch = () => (
    <button
      type="button"
      role="switch"
      aria-checked={inventoryTrackingEnabled}
      aria-label={inventoryTrackingEnabled ? 'Inventory ON' : 'Inventory OFF'}
      onClick={() => handleRequestToggleInventoryTracking(!inventoryTrackingEnabled)}
      className={`relative inline-flex items-center w-[96px] h-[20px] rounded-full border select-none shrink-0 overflow-hidden cursor-pointer transition-colors duration-220 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#11382C]/40 focus-visible:ring-offset-1 ${
        inventoryTrackingEnabled
          ? 'bg-[#E6F6EE] border-[#C5E8D5] dark:bg-emerald-950/80 dark:border-emerald-800/80'
          : 'bg-[#EFE7E9] border-[#E2D2D6] dark:bg-rose-950/50 dark:border-rose-900/60'
      }`}
    >
      <span
        className={`w-full text-[9px] font-bold tracking-tight whitespace-nowrap leading-none transition-all duration-220 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none ${
          inventoryTrackingEnabled
            ? 'pl-[5px] pr-[20px] text-center text-[#11382C] dark:text-emerald-200'
            : 'pl-[20px] pr-[5px] text-center text-[#5C2831] dark:text-rose-200'
        }`}
      >
        {inventoryTrackingEnabled ? 'Inventory ON' : 'Inventory OFF'}
      </span>
      <span
        aria-hidden="true"
        className={`absolute top-[1.5px] left-[1.5px] w-[15px] h-[15px] rounded-full shadow-2xs transition-all duration-220 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none ${
          inventoryTrackingEnabled
            ? 'translate-x-[76px] bg-[#11382C] dark:bg-emerald-400'
            : 'translate-x-0 bg-[#9E4754] dark:bg-rose-400'
        }`}
      />
    </button>
  );

  return (
    <div ref={topProductsRef} className="space-y-3 pb-28 lg:pb-4">

      {/* Subscription Expired Paywall Banner */}
      {!subscriptionCheck.allowed && (
        <div className="bg-rose-50 dark:bg-rose-950/90 border-2 border-rose-400 dark:border-rose-600 rounded-2xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-md">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-600 flex items-center justify-center text-white shrink-0 mt-0.5">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs font-extrabold uppercase tracking-wider text-rose-700 dark:text-rose-300">
                সাবস্ক্রিপশনের মেয়াদ শেষ (Subscription Expired)
              </div>
              <p className="text-xs text-rose-800 dark:text-rose-200 mt-0.5">
                {subscriptionCheck.reasonBn} মাসিক ফি ৳{currentTenant.subscription?.monthlyFeeBdt || 1500} bKash/Nagad পেমেন্ট করে নিচের বক্সে TrxID জমা দিন।
              </p>
            </div>
          </div>
          <form onSubmit={handleRenewalSubmit} className="flex items-center gap-2 shrink-0">
            <input
              type="text"
              value={renewalTrxId}
              onChange={(e) => setRenewalTrxId(e.target.value)}
              placeholder="bKash/Nagad TrxID দিন"
              className="px-3 py-2 rounded-xl bg-white dark:bg-zinc-900 border border-rose-300 dark:border-rose-700 text-xs font-mono text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-rose-500"
            />
            <button
              type="submit"
              className="px-3.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition cursor-pointer shrink-0"
            >
              TrxID জমা দিন
            </button>
          </form>
        </div>
      )}

      {/* Blacklist Alert Banner */}
      {blacklistAlert && (
        <div className="bg-rose-50 dark:bg-rose-950/80 border border-rose-300 dark:border-rose-500 rounded-2xl p-4 flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-600 flex items-center justify-center text-white shrink-0">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <div className="text-[11px] font-bold uppercase tracking-wider text-rose-600 dark:text-rose-300">
                Unpaid Due Blacklist Warning
              </div>
              <div className="text-sm font-bold text-slate-900 dark:text-white">
                {blacklistAlert.customerName} ({blacklistAlert.phone})
              </div>
              <p className="text-xs text-rose-700 dark:text-rose-200 mt-0.5">
                Reported by {blacklistAlert.reportedByShopName}: "{blacklistAlert.reason}"
              </p>
            </div>
          </div>
          <span className="text-xs bg-rose-600 text-white font-bold px-3 py-1.5 rounded-xl shrink-0">
            Cash Only
          </span>
        </div>
      )}

      {/* External Mode Change Warning Banner (if setting changed in Store Settings while cart had items) */}
      {externalModeChangeBanner && cartItems.length > 0 && (
        <div className="bg-amber-50 dark:bg-amber-950/70 border-2 border-amber-400 dark:border-amber-600 rounded-2xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center gap-2.5">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
            <div className="text-xs text-amber-900 dark:text-amber-200">
              <span className="font-extrabold">ইনভেন্টরি ট্র্যাকিং মোড পরিবর্তন হয়েছে!</span> কার্টে থাকা পূর্বের পণ্যগুলো নিরাপদ রাখতে ম্যানুয়াল আইটেম হিসেবে গণ্য করা হবে (স্টক কাটা হবে না)।
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => {
                setCartItems([]);
                setExternalModeChangeBanner(false);
                showToast('কার্ট খালি করা হয়েছে। এখন নতুন মোডে পণ্য যোগ করুন।', 'info');
              }}
              className="px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold transition cursor-pointer"
            >
              কার্ট খালি করুন (Clear Cart)
            </button>
            <button
              type="button"
              onClick={() => setExternalModeChangeBanner(false)}
              className="px-3 py-1.5 rounded-xl bg-white dark:bg-zinc-800 text-slate-700 dark:text-zinc-200 border border-slate-300 dark:border-zinc-700 text-xs font-bold transition cursor-pointer"
            >
              চালিয়ে যান (Keep)
            </button>
          </div>
        </div>
      )}

      {/* Main POS Interface (Mobile 3-Page Flow + Desktop Dual-Pane) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* PAGE 1 ON MOBILE / LEFT PANE ON DESKTOP: Product Selection & Order Builder */}
        <div
          className={`${
            mobilePosStep === 'products' ? 'block' : 'hidden lg:block'
          } lg:col-span-7 space-y-3`}
        >
          {/* POS Counter Header & Action Toolbar (Mobile + Desktop) */}
          <div className="space-y-2.5">
            {/* POS Counter Header with Back Button and Animated Inventory Switch */}
            <div className="flex items-center justify-between gap-2.5 bg-white dark:bg-zinc-900 border border-slate-200/90 dark:border-zinc-800 rounded-2xl px-3 sm:px-3.5 py-2 sm:py-2.5 shadow-2xs">
              <div className="flex items-center gap-2 min-w-0">
                {onNavigateHome && (
                  <button
                    type="button"
                    onClick={onNavigateHome}
                    className="p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-zinc-800 text-slate-700 dark:text-zinc-300 transition shrink-0 cursor-pointer flex items-center justify-center"
                    title="Back to Home"
                    aria-label="Back to Home"
                  >
                    <ArrowLeft className="w-4 h-4" />
                  </button>
                )}
                <span className="text-xs sm:text-sm font-extrabold tracking-tight text-slate-900 dark:text-white truncate">
                  POS Counter
                </span>
                <span className="text-xs text-slate-400 dark:text-zinc-500 hidden sm:inline" aria-hidden="true">
                  ·
                </span>
                <span className="text-xs font-medium text-slate-500 dark:text-zinc-400 truncate hidden sm:inline">
                  {currentTenant.name}
                </span>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {renderInventoryToggleSwitch()}
              </div>
            </div>

            {/* Manual / Non-Inventory Item Inline Form (Desktop) */}
            {inventoryTrackingEnabled && showManualEntryBox && (
              <form
                onSubmit={handleAddManualNonInventoryItem}
                className="p-3.5 rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 shadow-xs space-y-2.5 animate-in fade-in duration-150"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-extrabold text-slate-900 dark:text-white">
                      Manual / Non-Inventory Item
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        setActiveInfoPopover((prev) => (prev === 'manual' ? null : 'manual'))
                      }
                      className="w-5 h-5 rounded-full hover:bg-slate-100 dark:hover:bg-zinc-800 text-slate-400 hover:text-slate-700 flex items-center justify-center cursor-pointer"
                      title="About Manual Non-Inventory Item"
                    >
                      <Info className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#E6F6EE] text-[#115E3B] dark:bg-emerald-950 dark:text-emerald-300">
                      No Stock Deducted
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowManualEntryBox(false)}
                      className="p-1 rounded-lg text-slate-400 hover:text-slate-700 cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {activeInfoPopover === 'manual' && (
                  <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-zinc-800/70 text-[11px] text-slate-600 dark:text-zinc-300 leading-relaxed">
                    স্টক রেকর্ড ছাড়াই যেকোনো আনরেজিস্টার্ড বা কাস্টম পণ্য দ্রুত বিলে যোগ করুন। এতে ইনভেন্টরি স্টক বিয়োগ হবে না।
                  </div>
                )}

                <div className="grid grid-cols-2 sm:grid-cols-6 gap-2 text-xs">
                  <input
                    type="text"
                    required
                    value={manualItemTitle}
                    onChange={(e) => setManualItemTitle(e.target.value)}
                    placeholder="Item name (e.g. Belt / Cap) *"
                    className="col-span-2 px-3 py-2 rounded-xl bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-700 font-semibold text-slate-900 dark:text-white focus:outline-none focus:border-[#11382C]"
                  />
                  <input
                    type="text"
                    value={manualItemColor}
                    onChange={(e) => setManualItemColor(e.target.value)}
                    placeholder="Color (Opt.)"
                    className="px-2.5 py-2 rounded-xl bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-700 text-slate-900 dark:text-white focus:outline-none focus:border-[#11382C]"
                  />
                  <input
                    type="text"
                    value={manualItemSize}
                    onChange={(e) => setManualItemSize(e.target.value)}
                    placeholder="Size (M / L)"
                    className="px-2.5 py-2 rounded-xl bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-700 font-mono text-slate-900 dark:text-white focus:outline-none focus:border-[#11382C]"
                  />
                  <input
                    type="number"
                    min={0}
                    required
                    value={manualItemRate}
                    onChange={(e) => setManualItemRate(Number(e.target.value) || 0)}
                    placeholder="Rate (৳)"
                    className="px-2.5 py-2 rounded-xl bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-700 font-mono font-bold text-slate-900 dark:text-white focus:outline-none focus:border-[#11382C]"
                  />
                  <div className="flex items-center gap-1.5">
                    <input
                      type="number"
                      min={1}
                      value={manualItemQty}
                      onChange={(e) => setManualItemQty(Math.max(1, Number(e.target.value) || 1))}
                      className="w-14 px-2 py-2 rounded-xl bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-700 font-mono font-bold text-center text-slate-900 dark:text-white focus:outline-none"
                    />
                    <button
                      type="submit"
                      className="flex-1 py-2 px-3 rounded-xl bg-[#11382C] hover:bg-[#0D2B22] text-white font-bold text-xs cursor-pointer"
                    >
                      Add
                    </button>
                  </div>
                </div>
              </form>
            )}
          </div>

          {/* ========================================================================= */}
          {/* MODE A: INVENTORY TRACKING ON (Category -> Product -> Variant/Size -> Cart) */}
          {/* ========================================================================= */}
          {inventoryTrackingEnabled ? (
            <div className="space-y-3">
              {/* Search Bar Row (Matches Reference Image 1) */}
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={posQuickSearch}
                    onChange={(e) => setPosQuickSearch(e.target.value)}
                    placeholder="Search product, SKU..."
                    className="w-full pl-10 pr-8 py-3 rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 text-xs sm:text-sm font-medium text-slate-900 dark:text-white placeholder:text-slate-400 shadow-2xs focus:outline-none focus:border-[#11382C]"
                  />
                  {posQuickSearch && (
                    <button
                      type="button"
                      onClick={() => setPosQuickSearch('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-700 cursor-pointer"
                      aria-label="Clear search"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => openStockCorrectionModalForProduct()}
                  className="hidden lg:flex w-10 h-10 rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200/90 dark:border-zinc-800 items-center justify-center text-slate-700 dark:text-zinc-300 hover:border-[#11382C] shadow-2xs shrink-0 transition cursor-pointer"
                  title="Stock Correction & Audit Ledger"
                  aria-label="Stock Correction & Audit Ledger"
                >
                  <Sliders className="w-4 h-4" />
                </button>
              </div>

              {/* Horizontal Category Chips Row (Matches Reference Image 1) */}
              <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-0.5">
                <button
                  type="button"
                  onClick={() => {
                    setPosCategoryFilter('ALL');
                    setSelectedPosColorFilter('ALL');
                  }}
                  className={`px-4 py-2 rounded-full text-xs font-bold shrink-0 border transition cursor-pointer ${
                    posCategoryFilter === 'ALL'
                      ? 'bg-[#11382C] text-white border-[#11382C] shadow-2xs'
                      : 'bg-white dark:bg-zinc-900 hover:bg-slate-50 dark:hover:bg-zinc-800 text-slate-700 dark:text-zinc-300 border-slate-200/80 dark:border-zinc-800'
                  }`}
                >
                  All ({modeAFilteredProducts.length})
                </button>
                {modeAAvailableCategories.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => {
                      setPosCategoryFilter(cat);
                      setSelectedPosColorFilter('ALL');
                    }}
                    className={`px-4 py-2 rounded-full text-xs font-bold shrink-0 border transition cursor-pointer ${
                      posCategoryFilter === cat
                        ? 'bg-[#11382C] text-white border-[#11382C] shadow-2xs'
                        : 'bg-white dark:bg-zinc-900 hover:bg-slate-50 dark:hover:bg-zinc-800 text-slate-700 dark:text-zinc-300 border-slate-200/80 dark:border-zinc-800'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>

              {/* Product List Cards (Single-Column Horizontal Cards on Mobile per Reference Image 1, 3-Col Grid on Desktop) */}
              {modeAFilteredProducts.length === 0 ? (
                <div className="p-6 text-center text-slate-400 text-xs bg-white dark:bg-zinc-900 border border-dashed border-slate-200 dark:border-zinc-800 rounded-2xl space-y-2.5">
                  <div>এই ক্যাটাগরিতে কোনো পণ্য পাওয়া যায়নি।</div>
                </div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-2.5 lg:gap-3 lg:max-h-[430px] lg:overflow-y-auto lg:pr-1">
                  {modeAFilteredProducts.map((item) => {
                    const isSelected = selectedPosProduct?.id === item.id;
                    const isOutOfStock = item.totalStock <= 0;
                    const categoryLabel =
                      item.clothingCategory ||
                      item.jerseyCategory ||
                      item.subCategory ||
                      (isClothingStore ? 'Clothing' : 'Sportswear');

                    return (
                      <div
                        key={item.id}
                        onClick={() => {
                          setSelectedPosProductId(item.id);
                          setSelectedPosColorFilter('ALL');
                          setSelectedPosVariantId('');
                          if (typeof window !== 'undefined' && window.innerWidth < 1024) {
                            setMobileVariantModalOpen(true);
                          }
                        }}
                        className={`p-3.5 rounded-2xl border transition cursor-pointer flex lg:flex-col items-center lg:items-stretch justify-between gap-3 lg:gap-2.5 relative shadow-2xs ${
                          isSelected
                            ? 'bg-[#F7FCF9] dark:bg-emerald-950/30 border-[#11382C] ring-1 ring-[#11382C]/20'
                            : 'bg-white dark:bg-zinc-900 border-slate-200/75 dark:border-zinc-800 hover:border-emerald-500/60'
                        }`}
                      >
                        {/* Left Column on Mobile: Category, Product Title, Price & Mint Stock Badge */}
                        <div className="min-w-0 flex-1 flex flex-col justify-between lg:order-2">
                          <div>
                            <div className="text-[11px] font-semibold text-[#3B6E5C] dark:text-emerald-400 leading-tight truncate">
                              {categoryLabel}
                            </div>
                            <div
                              className="text-[15px] lg:text-[13px] font-extrabold text-slate-900 dark:text-white leading-snug line-clamp-1 mt-0.5"
                              title={item.name}
                            >
                              {item.name}
                            </div>
                          </div>

                          <div className="flex items-center gap-2.5 lg:justify-between mt-2.5 lg:mt-2">
                            <span className="font-mono font-extrabold text-[15px] lg:text-sm text-slate-900 dark:text-white">
                              ৳ {item.mrp.toLocaleString()}
                            </span>
                            <span
                              className={`px-2.5 py-0.5 rounded-full text-[11px] lg:text-[10px] font-bold shrink-0 ${
                                isOutOfStock
                                  ? 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300'
                                  : 'bg-[#E6F6EE] text-[#115E3B] dark:bg-emerald-950 dark:text-emerald-300'
                              }`}
                            >
                              Stock: {item.totalStock}
                            </span>
                          </div>
                        </div>

                        {/* Right Column on Mobile (Top on Desktop): Thumbnail + Floating (+) Button + Chevron */}
                        <div className="flex items-center lg:items-start lg:justify-between gap-2.5 shrink-0 lg:order-1">
                          <div className="relative w-16 h-16 rounded-2xl bg-slate-50 dark:bg-zinc-800 border border-slate-100 dark:border-zinc-700 flex items-center justify-center shrink-0">
                            {item.imageUrl ? (
                              <img
                                src={item.imageUrl}
                                alt={item.name}
                                loading="lazy"
                                className="w-full h-full rounded-2xl object-cover"
                              />
                            ) : isClothingStore ? (
                              <Shirt className="w-8 h-8 text-[#11382C] dark:text-emerald-400 stroke-[1.6]" />
                            ) : (
                              <ShoppingBag className="w-8 h-8 text-[#11382C] dark:text-emerald-400 stroke-[1.6]" />
                            )}

                            {/* Floating (+) Badge on Mobile Thumbnail */}
                            <span
                              className={`lg:hidden w-7 h-7 rounded-full flex items-center justify-center transition border shadow-sm absolute -bottom-1 -right-1 ${
                                isSelected
                                  ? 'bg-[#11382C] text-white border-[#11382C]'
                                  : 'bg-white dark:bg-zinc-900 text-[#11382C] dark:text-emerald-400 border-slate-200 dark:border-zinc-700'
                              }`}
                              aria-hidden="true"
                            >
                              <Plus className="w-4 h-4" strokeWidth={2.2} />
                            </span>
                          </div>

                          {/* Desktop (+) Badge */}
                          <span
                            className={`hidden lg:flex w-7 h-7 rounded-full items-center justify-center transition shrink-0 ${
                              isSelected
                                ? 'bg-[#11382C] text-white shadow-2xs'
                                : 'bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-300'
                            }`}
                            aria-hidden="true"
                          >
                            <Plus className="w-4 h-4" strokeWidth={2.2} />
                          </span>

                          {/* Right Chevron on Mobile (Matches Reference Image 1) */}
                          <ChevronRight className="w-4 h-4 text-slate-400 dark:text-zinc-500 shrink-0 lg:hidden" />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Compact Selected Product Variant, Color, Size & Quantity Card (Mobile Bottom Sheet + Desktop Inline) */}
              {selectedPosProduct && (
                <>
                  {mobileVariantModalOpen && (
                    <div
                      className="lg:hidden fixed inset-0 z-40 bg-slate-950/50 backdrop-blur-[1px]"
                      onClick={() => setMobileVariantModalOpen(false)}
                    />
                  )}
                  <div
                    ref={variantSelectorRef}
                    className={`${
                      mobileVariantModalOpen
                        ? 'fixed inset-x-0 bottom-[56px] z-50 rounded-t-2xl border-t shadow-2xl max-h-[50dvh] overflow-y-auto px-4 pt-2 pb-3.5 animate-in slide-in-from-bottom duration-200'
                        : 'hidden lg:block'
                    } lg:static lg:z-auto lg:max-h-none lg:overflow-visible bg-white dark:bg-zinc-900 border border-slate-200/90 dark:border-zinc-800 lg:rounded-2xl lg:p-4 space-y-2.5 lg:shadow-2xs`}
                  >
                    <div className="lg:hidden w-9 h-1 rounded-full bg-slate-300 dark:bg-zinc-700 mx-auto mb-1" />
                    <div className="flex items-center justify-between gap-2 pb-2 border-b border-slate-100 dark:border-zinc-800">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <h4 className="text-sm font-extrabold text-slate-900 dark:text-white truncate">
                            {selectedPosProduct.name}
                          </h4>
                          <button
                            type="button"
                            onClick={() =>
                              setActiveInfoPopover((prev) => (prev === 'variant' ? null : 'variant'))
                            }
                            className="w-5 h-5 rounded-full hover:bg-slate-100 dark:hover:bg-zinc-800 text-slate-400 hover:text-slate-700 flex items-center justify-center shrink-0 cursor-pointer"
                            title="Variant & Floor Price Info"
                          >
                            <Info className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-zinc-400 font-mono truncate">
                          SKU: {selectedPosProduct.sku} • Total Stock: {selectedPosProduct.totalStock} pcs
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        {/* Quick Edit button for Owner / Manager on Desktop */}
                        {showBuyingPrice && (
                          <button
                            type="button"
                            onClick={() => {
                              setMobileVariantModalOpen(false);
                              openEditProductModal(selectedPosProduct);
                            }}
                            className="hidden lg:flex px-2.5 py-1 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 text-[11px] font-bold text-[#11382C] dark:text-emerald-400 items-center gap-1 cursor-pointer shrink-0"
                          >
                            <Edit2 className="w-3 h-3" />
                            <span>Edit</span>
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => setMobileVariantModalOpen(false)}
                          className="lg:hidden w-8 h-8 rounded-full bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-300 flex items-center justify-center cursor-pointer"
                          aria-label="Close variant selector"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {activeInfoPopover === 'variant' && (
                      <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-zinc-800/70 text-[11px] text-slate-600 dark:text-zinc-300 leading-relaxed">
                        কালার ও সাইজ ভ্যারিয়েন্ট নির্বাচন করে পরিমাণ ও বিক্রয়মূল্য নির্ধারণ করুন। নির্ধারিত Floor Price-এর নিচে বিক্রয় করতে Owner PIN ভেরিফিকেশন প্রয়োজন হবে।
                      </div>
                    )}

                    {/* Color Selector Pills (if multiple colors available) */}
                    {selectedProductColors.length > 1 && (
                      <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
                        <span className="text-[11px] font-bold text-slate-500 dark:text-zinc-400 shrink-0 mr-1">
                          Color:
                        </span>
                        <button
                          type="button"
                          onClick={() => setSelectedPosColorFilter('ALL')}
                          className={`px-2.5 py-1 rounded-xl text-xs font-bold border transition cursor-pointer shrink-0 ${
                            selectedPosColorFilter === 'ALL'
                              ? 'bg-[#11382C] text-white border-[#11382C]'
                              : 'bg-slate-50 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 border-slate-200 dark:border-zinc-700'
                          }`}
                        >
                          All
                        </button>
                        {selectedProductColors.map((clr) => (
                          <button
                            key={clr}
                            type="button"
                            onClick={() => setSelectedPosColorFilter(clr)}
                            className={`px-2.5 py-1 rounded-xl text-xs font-bold border transition cursor-pointer shrink-0 ${
                              selectedPosColorFilter === clr
                                ? 'bg-[#11382C] text-white border-[#11382C]'
                                : 'bg-slate-50 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 border-slate-200 dark:border-zinc-700'
                            }`}
                          >
                            {clr}
                          </button>
                        ))}
                      </div>
                    )}

                    {/* Size & Variant Buttons Grid (Compact 3-Col on Mobile, 4-Col on Desktop) */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="font-bold text-slate-600 dark:text-zinc-300">
                          Select Size / Variant
                        </span>
                        {selectedPosVariant && (
                          <span className="text-slate-500 font-mono">
                            Available:{' '}
                            <strong className="text-[#115E3B] dark:text-emerald-400 font-bold">
                              {Math.max(
                                0,
                                (Number(selectedPosVariant.stock) || 0) -
                                  getVariantInCartQty(
                                    selectedPosProduct.id,
                                    selectedPosVariant.id,
                                    selectedPosVariant.size,
                                    selectedPosVariant.color
                                  )
                              )}{' '}
                              pcs
                            </strong>
                          </span>
                        )}
                      </div>

                      <div className="grid grid-cols-3 sm:grid-cols-4 gap-1.5">
                        {selectedProductVariants.map((v, vIdx) => {
                          const vStock = Math.max(0, Number(v.stock) || 0);
                          const inCart = getVariantInCartQty(
                            selectedPosProduct.id,
                            v.id,
                            v.size,
                            v.color
                          );
                          const remaining = Math.max(0, vStock - inCart);
                          const isSelected = Boolean(
                            selectedPosVariant &&
                              ((Boolean(v.id) && selectedPosVariant.id === v.id) ||
                                (selectedPosVariant.size === v.size &&
                                  (selectedPosVariant.color || '') === (v.color || '')))
                          );
                          const isOutOfStock = remaining <= 0;

                          return (
                            <button
                              key={v.id || `${v.size}_${v.color || vIdx}`}
                              type="button"
                              disabled={isOutOfStock}
                              onClick={() => {
                                setSelectedPosVariantId(v.id || `${v.size}::${v.color || ''}`);
                                setSelectedPosRate(Number(v.mrp || selectedPosProduct.mrp) || 0);
                                setSelectedPosQty(1);
                              }}
                              className={`p-2 rounded-xl border text-left transition cursor-pointer flex flex-col justify-between gap-1 ${
                                isSelected
                                  ? 'bg-[#11382C] text-white border-[#11382C] shadow-2xs'
                                  : isOutOfStock
                                  ? 'bg-slate-50 dark:bg-zinc-950 text-slate-400 border-slate-200 dark:border-zinc-800 opacity-60 cursor-not-allowed'
                                  : 'bg-slate-50/70 dark:bg-zinc-800/70 text-slate-800 dark:text-zinc-200 border-slate-200/90 dark:border-zinc-700 hover:border-[#11382C]'
                              }`}
                            >
                              <div className="flex items-center justify-between gap-1">
                                <span className="font-bold text-xs truncate">
                                  {v.color && v.color !== selectedPosProduct.color ? `${v.color} ` : ''}
                                  {v.size}
                                </span>
                                {isSelected && <CheckCircle className="w-3 h-3 shrink-0" />}
                              </div>
                              <div className="flex items-center justify-between text-[10px] font-mono">
                                <span
                                  className={
                                    isSelected
                                      ? 'text-emerald-100 font-bold'
                                      : 'text-slate-600 dark:text-zinc-400'
                                  }
                                >
                                  ৳{v.mrp || selectedPosProduct.mrp}
                                </span>
                                <span
                                  className={`px-1 rounded ${
                                    isSelected
                                      ? 'bg-emerald-900/80 text-white font-bold'
                                      : isOutOfStock
                                      ? 'bg-rose-100 text-rose-700'
                                      : 'bg-[#E6F6EE] text-[#115E3B] dark:bg-emerald-950 dark:text-emerald-300 font-bold'
                                  }`}
                                >
                                  {isOutOfStock ? 'Out' : `${remaining}p`}
                                </span>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Side-by-Side Quantity & Selling Rate on Mobile & Desktop */}
                    <div className="grid grid-cols-2 gap-2.5 pt-0.5">
                      {/* Quantity Selector */}
                      <div>
                        <label className="block text-[11px] font-bold text-slate-600 dark:text-zinc-300 mb-1">
                          Quantity
                        </label>
                        <div className="flex items-center bg-slate-50 dark:bg-zinc-800/90 border border-slate-200 dark:border-zinc-700 rounded-xl px-2 py-1 justify-between">
                          <button
                            type="button"
                            onClick={() => setSelectedPosQty((q) => Math.max(1, q - 1))}
                            className="w-7 h-7 rounded-lg text-slate-600 hover:bg-white dark:hover:bg-zinc-700 flex items-center justify-center font-bold text-sm cursor-pointer"
                          >
                            −
                          </button>
                          <input
                            type="number"
                            min={1}
                            value={selectedPosQty}
                            onChange={(e) =>
                              setSelectedPosQty(Math.max(1, Math.floor(Number(e.target.value) || 1)))
                            }
                            className="w-12 text-center font-mono font-bold text-sm bg-transparent text-slate-900 dark:text-white focus:outline-none"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              if (!selectedPosVariant) return;
                              const vStock = Math.max(0, Number(selectedPosVariant.stock) || 0);
                              const inCart = getVariantInCartQty(
                                selectedPosProduct.id,
                                selectedPosVariant.id,
                                selectedPosVariant.size,
                                selectedPosVariant.color
                              );
                              const rem = Math.max(0, vStock - inCart);
                              if (selectedPosQty >= rem) {
                                showToast(`সর্বোচ্চ উপলব্ধ স্টক: ${rem} পিস`, 'info');
                                return;
                              }
                              setSelectedPosQty((q) => q + 1);
                            }}
                            className="w-7 h-7 rounded-lg text-slate-600 hover:bg-white dark:hover:bg-zinc-700 flex items-center justify-center font-bold text-sm cursor-pointer"
                          >
                            +
                          </button>
                        </div>
                      </div>

                      {/* Selling Rate */}
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="block text-[11px] font-bold text-slate-600 dark:text-zinc-300">
                            Rate (৳)
                          </label>
                          {selectedPosVariant && (
                            <span className="text-[10px] text-slate-400 font-mono">
                              Min: ৳{selectedPosVariant.bottomPrice || selectedPosProduct.bottomPrice}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center bg-slate-50 dark:bg-zinc-800/90 border border-slate-200 dark:border-zinc-700 rounded-xl px-3 py-1.5">
                          <span className="text-slate-400 font-bold mr-1 text-xs">৳</span>
                          <input
                            type="number"
                            value={selectedPosRate || ''}
                            onChange={(e) => setSelectedPosRate(Number(e.target.value))}
                            className="w-full bg-transparent font-mono font-bold text-sm text-slate-900 dark:text-white focus:outline-none"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Clothing Category Alteration Option */}
                    {isClothingStore && (
                      <div className="bg-slate-50 dark:bg-zinc-800/60 border border-slate-200/80 dark:border-zinc-700 p-2.5 rounded-xl space-y-2">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={requiresAlteration}
                            onChange={(e) => setRequiresAlteration(e.target.checked)}
                            className="w-4 h-4 rounded accent-[#11382C]"
                          />
                          <span className="text-xs font-bold text-slate-800 dark:text-zinc-200 flex items-center gap-1.5">
                            <Scissors className="w-3.5 h-3.5 text-[#11382C] dark:text-emerald-400" />
                            <span>Trial Room Alteration</span>
                          </span>
                        </label>
                        {requiresAlteration && (
                          <div className="grid grid-cols-3 gap-2 pt-1">
                            <div className="col-span-2">
                              <input
                                type="text"
                                value={tailorNote}
                                onChange={(e) => setTailorNote(e.target.value)}
                                placeholder="e.g. Length -2 inches"
                                className="w-full bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-xl px-3 py-1.5 text-xs text-slate-900 dark:text-white focus:outline-none"
                              />
                            </div>
                            <div>
                              <input
                                type="number"
                                value={tailorFee}
                                onChange={(e) => setTailorFee(Number(e.target.value))}
                                placeholder="Fee ৳"
                                className="w-full bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-900 dark:text-white focus:outline-none"
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Sportswear Heat-press Customization Option */}
                    {!isClothingStore && (
                      <div
                        onClick={() => setCustomizingRowId('__mode_a_inventory__')}
                        className={`border rounded-xl p-2.5 flex items-center justify-between gap-2.5 cursor-pointer transition ${
                          modeACustomization
                            ? 'bg-[#E6F6EE] dark:bg-emerald-950/60 border-[#11382C]'
                            : 'bg-slate-50 dark:bg-zinc-800/60 border-slate-200 dark:border-zinc-700 hover:border-[#11382C]'
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <div
                            className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                              modeACustomization
                                ? 'bg-[#11382C] text-white'
                                : 'bg-[#E6F6EE] text-[#11382C]'
                            }`}
                          >
                            <Flame className="w-3.5 h-3.5" />
                          </div>
                          <div className="min-w-0">
                            <div className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                              <span>Heat-Press Print</span>
                              {modeACustomization && (
                                <span className="text-[10px] font-bold bg-[#11382C] text-white px-1.5 py-0.2 rounded">
                                  +৳{modeACustomization.extraCharge}
                                </span>
                              )}
                            </div>
                            <div className="text-[10px] text-slate-500 truncate">
                              {modeACustomization
                                ? `${modeACustomization.customName} #${modeACustomization.customNumber} (${modeACustomization.patches})`
                                : 'Custom name, number & badge'}
                            </div>
                          </div>
                        </div>
                        <span className="text-xs font-bold text-[#11382C] dark:text-emerald-400 underline shrink-0">
                          {modeACustomization ? 'Edit' : 'Add'}
                        </span>
                      </div>
                    )}

                    {/* Add to Cart Button */}
                    <button
                      type="button"
                      onClick={handleAddModeAVariantToCart}
                      className="w-full py-3.5 rounded-full bg-[#11382C] hover:bg-[#0D2B22] text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition shadow-xs cursor-pointer"
                    >
                      <ShoppingCart className="w-4 h-4" />
                      <span>
                        Add to Cart — ৳
                        {(
                          ((Number(selectedPosRate) ||
                            Number(selectedPosVariant?.mrp || selectedPosProduct.mrp) ||
                            0) +
                            (!isClothingStore && modeACustomization
                              ? Number(modeACustomization.extraCharge) || 0
                              : 0)) *
                          selectedPosQty
                        ).toLocaleString()}{' '}
                        ({selectedPosQty} pc)
                      </span>
                    </button>
                  </div>
                </>
              )}
            </div>
          ) : (
            /* ========================================================================= */
            /* MODE B: INVENTORY TRACKING OFF (Normal Order Builder — No Inventory Needed) */
            /* ========================================================================= */
            <div className="space-y-3.5">
              {isClothingStore ? (
                /* Men's Clothing Order Builder */
                <div className="bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 rounded-2xl p-3.5 sm:p-4 space-y-3.5 shadow-2xs">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-9 h-9 rounded-xl bg-[#E6F6EE] dark:bg-emerald-950/60 flex items-center justify-center text-[#11382C] dark:text-emerald-400 shrink-0">
                        <Shirt className="w-4 h-4 stroke-[1.9]" />
                      </div>
                      <div className="flex items-center gap-1.5 min-w-0">
                        <h3 className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-white truncate">
                          Order Builder
                        </h3>
                        <button
                          type="button"
                          onClick={() =>
                            setActiveInfoPopover((prev) => (prev === 'builder' ? null : 'builder'))
                          }
                          className="w-5 h-5 rounded-full hover:bg-slate-100 dark:hover:bg-zinc-800 text-slate-400 hover:text-slate-700 flex items-center justify-center shrink-0 cursor-pointer"
                          title="Order Builder Info"
                        >
                          <Info className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={handleAddClothingRow}
                      className="px-3 py-1.5 rounded-xl bg-[#E6F6EE] hover:bg-[#d8ede0] dark:bg-emerald-950/50 text-[#11382C] dark:text-emerald-300 font-bold text-xs flex items-center gap-1 transition cursor-pointer shrink-0"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add Row</span>
                    </button>
                  </div>

                  {activeInfoPopover === 'builder' && (
                    <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-zinc-800/70 text-[11px] text-slate-600 dark:text-zinc-300 leading-relaxed">
                      স্টক ট্র্যাকিং ছাড়া ক্যাটাগরি, সাইজ, দর ও অল্টারেশনসহ দ্রুত সাধারণ বিক্রয় বিল তৈরি করুন।
                    </div>
                  )}

                  <div className="space-y-3">
                    {clothingRows.map((row, idx) => {
                      const rowScale = getScaleForClothingCategory(row.clothingCategory);
                      const availableSizes = SIZES_BY_SCALE[rowScale];
                      return (
                        <div
                          key={row.id}
                          className="bg-slate-50/80 dark:bg-zinc-800/50 border border-slate-200/70 dark:border-zinc-800 p-3 rounded-2xl space-y-2.5"
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-slate-700 dark:text-zinc-200">
                              Item #{idx + 1}
                            </span>
                            {clothingRows.length > 1 && (
                              <button
                                type="button"
                                onClick={() => handleRemoveClothingRow(row.id)}
                                className="p-1 rounded-lg bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 text-slate-400 hover:text-rose-500 transition cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>

                          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
                            <div>
                              <label className="block text-[11px] font-semibold text-slate-500 dark:text-zinc-400 mb-1">
                                Category
                              </label>
                              <select
                                value={row.clothingCategory}
                                onChange={(e) =>
                                  handleUpdateClothingRow(row.id, 'clothingCategory', e.target.value)
                                }
                                className="w-full bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-xl px-2.5 py-2 text-xs font-semibold text-slate-900 dark:text-white focus:outline-none focus:border-[#11382C]"
                              >
                                {clothingCategories.map((cat) => (
                                  <option key={cat.id} value={cat.name}>
                                    {cat.name}
                                  </option>
                                ))}
                              </select>
                            </div>

                            <div>
                              <label className="block text-[11px] font-semibold text-slate-500 dark:text-zinc-400 mb-1">
                                Product Name
                              </label>
                              <input
                                type="text"
                                value={row.title}
                                onChange={(e) =>
                                  handleUpdateClothingRow(row.id, 'title', e.target.value)
                                }
                                placeholder="e.g. Cotton Shirt"
                                className="w-full bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-xl px-2.5 py-2 text-xs font-medium text-slate-900 dark:text-white focus:outline-none focus:border-[#11382C]"
                              />
                            </div>

                            <div>
                              <label className="block text-[11px] font-semibold text-slate-500 dark:text-zinc-400 mb-1">
                                Brand / Type
                              </label>
                              <input
                                type="text"
                                value={row.brandOrSubCategory}
                                onChange={(e) =>
                                  handleUpdateClothingRow(row.id, 'brandOrSubCategory', e.target.value)
                                }
                                placeholder="Casual / Slim"
                                className="w-full bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-xl px-2.5 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-[#11382C]"
                              />
                            </div>

                            <div>
                              <label className="block text-[11px] font-semibold text-slate-500 dark:text-zinc-400 mb-1">
                                Color
                              </label>
                              <input
                                type="text"
                                value={row.color || ''}
                                onChange={(e) =>
                                  handleUpdateClothingRow(row.id, 'color', e.target.value)
                                }
                                placeholder="Navy / Black"
                                className="w-full bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-xl px-2.5 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-[#11382C]"
                              />
                            </div>
                          </div>

                          {/* Size Pills */}
                          <div>
                            <label className="block text-[11px] font-semibold text-slate-500 dark:text-zinc-400 mb-1">
                              Size
                            </label>
                            <div className="flex flex-wrap gap-1.5">
                              {availableSizes.map((sz) => (
                                <button
                                  key={sz}
                                  type="button"
                                  onClick={() => handleUpdateClothingRow(row.id, 'size', sz)}
                                  className={`px-3 py-1.5 text-xs font-bold rounded-xl border transition cursor-pointer ${
                                    row.size === sz
                                      ? 'bg-[#11382C] text-white border-[#11382C]'
                                      : 'bg-white dark:bg-zinc-900 text-slate-700 dark:text-zinc-300 border-slate-200 dark:border-zinc-700 hover:border-[#11382C]'
                                  }`}
                                >
                                  {sz}
                                </button>
                              ))}
                            </div>
                          </div>

                          {/* Selling Rate, Cost Price, Quantity */}
                          <div className={`grid ${showBuyingPrice ? 'grid-cols-3' : 'grid-cols-2'} gap-2`}>
                            <div>
                              <div className="flex items-center justify-between mb-1">
                                <label className="block text-[11px] font-semibold text-slate-500 dark:text-zinc-400">
                                  Rate (৳)
                                </label>
                                <span className="text-[10px] text-slate-400 font-mono">
                                  Min: ৳{row.bottomPrice}
                                </span>
                              </div>
                              <input
                                type="number"
                                value={row.rate}
                                onChange={(e) =>
                                  handleUpdateClothingRow(row.id, 'rate', Number(e.target.value))
                                }
                                className="w-full bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-xl px-2.5 py-1.5 text-xs sm:text-sm font-bold text-slate-900 dark:text-white focus:outline-none"
                              />
                            </div>

                            {showBuyingPrice && (
                              <div>
                                <label className="block text-[11px] font-semibold text-slate-500 dark:text-zinc-400 mb-1">
                                  Cost (৳)
                                </label>
                                <input
                                  type="number"
                                  value={row.costPrice}
                                  onChange={(e) =>
                                    handleUpdateClothingRow(row.id, 'costPrice', Number(e.target.value))
                                  }
                                  className="w-full bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-xl px-2.5 py-1.5 text-xs sm:text-sm font-medium text-slate-700 dark:text-zinc-300 focus:outline-none"
                                />
                              </div>
                            )}

                            <div>
                              <label className="block text-[11px] font-semibold text-slate-500 dark:text-zinc-400 mb-1">
                                Qty
                              </label>
                              <div className="flex items-center justify-between bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-xl px-2 py-1">
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleUpdateClothingRow(
                                      row.id,
                                      'quantity',
                                      Math.max(1, row.quantity - 1)
                                    )
                                  }
                                  className="w-6 h-6 rounded-lg text-slate-500 hover:bg-slate-100 flex items-center justify-center font-bold cursor-pointer"
                                >
                                  −
                                </button>
                                <span className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">
                                  {row.quantity}
                                </span>
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleUpdateClothingRow(row.id, 'quantity', row.quantity + 1)
                                  }
                                  className="w-6 h-6 rounded-lg text-slate-500 hover:bg-slate-100 flex items-center justify-center font-bold cursor-pointer"
                                >
                                  +
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Alteration Toggle */}
                  <div className="bg-slate-50/80 dark:bg-zinc-800/50 border border-slate-200/70 dark:border-zinc-800 p-3 rounded-2xl space-y-2">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={requiresAlteration}
                        onChange={(e) => setRequiresAlteration(e.target.checked)}
                        className="w-4 h-4 rounded accent-[#11382C]"
                      />
                      <span className="text-xs font-bold text-slate-800 dark:text-zinc-200 flex items-center gap-1.5">
                        <Scissors className="w-3.5 h-3.5 text-[#11382C] dark:text-emerald-400" />
                        <span>Trial Room Alteration</span>
                      </span>
                    </label>

                    {requiresAlteration && (
                      <div className="grid grid-cols-3 gap-2 pt-1">
                        <div className="col-span-2">
                          <input
                            type="text"
                            value={tailorNote}
                            onChange={(e) => setTailorNote(e.target.value)}
                            placeholder="e.g. Length -2 inches"
                            className="w-full bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-xl px-3 py-1.5 text-xs text-slate-900 dark:text-white focus:outline-none"
                          />
                        </div>
                        <div>
                          <input
                            type="number"
                            value={tailorFee}
                            onChange={(e) => setTailorFee(Number(e.target.value))}
                            placeholder="Fee ৳"
                            className="w-full bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-900 dark:text-white focus:outline-none"
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={handleAddClothingRowsToCart}
                    className="w-full py-3 rounded-xl bg-[#11382C] hover:bg-[#0D2B22] text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition shadow-xs cursor-pointer"
                  >
                    <ShoppingCart className="w-4 h-4" />
                    <span>
                      Add to Cart ({clothingRows.length} {clothingRows.length === 1 ? 'item' : 'items'})
                    </span>
                  </button>
                </div>
              ) : (
                /* Jersey Order Builder (Sportswear) */
                <div className="bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 rounded-2xl p-3.5 sm:p-4 space-y-3.5 shadow-2xs">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-xl bg-[#E6F6EE] dark:bg-emerald-950/60 flex items-center justify-center text-[#11382C] dark:text-emerald-400 shrink-0">
                        <Shirt className="w-4 h-4 stroke-[1.9]" />
                      </div>
                      <div className="flex items-center gap-1.5">
                        <h3 className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-white">
                          Jersey Order Builder
                        </h3>
                        <button
                          type="button"
                          onClick={() =>
                            setActiveInfoPopover((prev) => (prev === 'builder' ? null : 'builder'))
                          }
                          className="w-5 h-5 rounded-full hover:bg-slate-100 dark:hover:bg-zinc-800 text-slate-400 hover:text-slate-700 flex items-center justify-center cursor-pointer"
                          title="Jersey Builder Info"
                        >
                          <Info className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>

                  {activeInfoPopover === 'builder' && (
                    <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-zinc-800/70 text-[11px] text-slate-600 dark:text-zinc-300 leading-relaxed">
                      স্টক ট্র্যাকিং ছাড়া জার্সি ক্যাটাগরি, ক্লাব, সাইজ, রেট ও হিট-প্রেস কাস্টমাইজেশনসহ দ্রুত বিল তৈরি করুন।
                    </div>
                  )}

                  <div className="space-y-3">
                    {jerseyRows.map((row, idx) => (
                      <div
                        key={row.id}
                        className="bg-slate-50/80 dark:bg-zinc-800/50 border border-slate-200/70 dark:border-zinc-800 p-3 rounded-2xl space-y-3 transition"
                      >
                        {row.isOther || row.category === 'Other' ? (
                          <div className="space-y-2.5">
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-xs font-bold text-slate-700 dark:text-zinc-200">
                                Other Item #{idx + 1}
                              </span>
                              {jerseyRows.length > 1 && (
                                <button
                                  type="button"
                                  onClick={() => handleRemoveJerseyRow(row.id)}
                                  className="p-1 rounded-lg bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 text-slate-400 hover:text-rose-500 transition cursor-pointer"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>

                            <div className="grid grid-cols-2 gap-2.5">
                              <div>
                                <label className="block text-[11px] font-semibold text-slate-500 dark:text-zinc-400 mb-1">
                                  Category
                                </label>
                                <select
                                  value={row.otherCategoryId || 'custom'}
                                  onChange={(e) =>
                                    handleUpdateJerseyRow(row.id, 'otherCategoryId', e.target.value)
                                  }
                                  className="w-full bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-xl px-2.5 py-2 text-xs font-medium text-slate-900 dark:text-white focus:outline-none"
                                >
                                  <option value="custom">Custom Product</option>
                                  {otherCategories.map((c) => (
                                    <option key={c.id} value={c.id}>
                                      {c.name}
                                    </option>
                                  ))}
                                </select>
                              </div>

                              <div>
                                <label className="block text-[11px] font-semibold text-slate-500 dark:text-zinc-400 mb-1">
                                  Item Name *
                                </label>
                                <input
                                  type="text"
                                  value={row.customTitle || ''}
                                  onChange={(e) =>
                                    handleUpdateJerseyRow(row.id, 'customTitle', e.target.value)
                                  }
                                  placeholder="Boots / Socks..."
                                  className="w-full bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-xl px-2.5 py-2 text-xs font-medium text-slate-900 dark:text-white focus:outline-none"
                                />
                              </div>
                            </div>

                            <div className={`grid ${showBuyingPrice ? 'grid-cols-4' : 'grid-cols-3'} gap-2`}>
                              <div>
                                <label className="block text-[11px] font-semibold text-slate-500 dark:text-zinc-400 mb-1">
                                  Size
                                </label>
                                <input
                                  type="text"
                                  value={row.customSizeOrDetail || ''}
                                  onChange={(e) =>
                                    handleUpdateJerseyRow(row.id, 'customSizeOrDetail', e.target.value)
                                  }
                                  placeholder="Free"
                                  className="w-full bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-xl px-2.5 py-1.5 text-xs text-slate-900 dark:text-white focus:outline-none"
                                />
                              </div>

                              <div>
                                <label className="block text-[11px] font-semibold text-slate-500 dark:text-zinc-400 mb-1">
                                  Rate (৳)
                                </label>
                                <input
                                  type="number"
                                  value={row.rate || ''}
                                  onChange={(e) =>
                                    handleUpdateJerseyRow(row.id, 'rate', Number(e.target.value))
                                  }
                                  className="w-full bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-xl px-2.5 py-1.5 text-xs font-bold text-slate-900 dark:text-white focus:outline-none"
                                />
                              </div>

                              {showBuyingPrice && (
                                <div>
                                  <label className="block text-[11px] font-semibold text-slate-500 dark:text-zinc-400 mb-1">
                                    Cost (৳)
                                  </label>
                                  <input
                                    type="number"
                                    value={row.costPrice || ''}
                                    onChange={(e) =>
                                      handleUpdateJerseyRow(row.id, 'costPrice', Number(e.target.value))
                                    }
                                    className="w-full bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-xl px-2.5 py-1.5 text-xs text-slate-700 dark:text-zinc-300 focus:outline-none"
                                  />
                                </div>
                              )}

                              <div>
                                <label className="block text-[11px] font-semibold text-slate-500 dark:text-zinc-400 mb-1">
                                  Qty
                                </label>
                                <div className="flex items-center justify-between bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-xl px-2 py-1">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleUpdateJerseyRow(
                                        row.id,
                                        'quantity',
                                        Math.max(1, row.quantity - 1)
                                      )
                                    }
                                    className="w-5 h-5 rounded text-slate-500 hover:bg-slate-100 flex items-center justify-center font-bold cursor-pointer"
                                  >
                                    −
                                  </button>
                                  <span className="text-xs font-bold text-slate-900 dark:text-white">
                                    {row.quantity}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleUpdateJerseyRow(row.id, 'quantity', row.quantity + 1)
                                    }
                                    className="w-5 h-5 rounded text-slate-500 hover:bg-slate-100 flex items-center justify-center font-bold cursor-pointer"
                                  >
                                    +
                                  </button>
                                </div>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-2.5">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-bold text-slate-700 dark:text-zinc-300">
                                Jersey #{idx + 1}
                              </span>
                              {jerseyRows.length > 1 && (
                                <button
                                  type="button"
                                  onClick={() => handleRemoveJerseyRow(row.id)}
                                  className="p-1 rounded-lg bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 text-slate-400 hover:text-rose-500 transition cursor-pointer"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>

                            <div className="grid grid-cols-2 gap-2.5">
                              <div>
                                <label className="block text-[11px] font-semibold text-slate-500 dark:text-zinc-400 mb-1">
                                  Kit Category
                                </label>
                                <select
                                  value={row.category}
                                  onChange={(e) =>
                                    handleUpdateJerseyRow(row.id, 'category', e.target.value)
                                  }
                                  className="w-full bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-xl px-2.5 py-2 text-xs font-medium text-slate-900 dark:text-white focus:outline-none"
                                >
                                  {kitCategories.map((kc) => (
                                    <option key={kc.id} value={kc.name}>
                                      {kc.name}
                                    </option>
                                  ))}
                                  <option value="Other">Others / অন্যান্য</option>
                                </select>
                              </div>

                              <div>
                                <label className="block text-[11px] font-semibold text-slate-500 dark:text-zinc-400 mb-1">
                                  Club / Country
                                </label>
                                <select
                                  value={row.clubOrCountry}
                                  onChange={(e) =>
                                    handleUpdateJerseyRow(row.id, 'clubOrCountry', e.target.value)
                                  }
                                  className="w-full bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-xl px-2.5 py-2 text-xs font-medium text-slate-900 dark:text-white focus:outline-none"
                                >
                                  {CLUBS_AND_COUNTRIES.map((team) => (
                                    <option key={team} value={team}>
                                      {team}
                                    </option>
                                  ))}
                                </select>
                              </div>
                            </div>

                            {/* Size Pills */}
                            <div>
                              <label className="block text-[11px] font-semibold text-slate-500 dark:text-zinc-400 mb-1">
                                Size
                              </label>
                              <div className="grid grid-cols-6 gap-1.5">
                                {(['S', 'M', 'L', 'XL', 'XXL', '3XL'] as const).map((sz) => (
                                  <button
                                    key={sz}
                                    type="button"
                                    onClick={() => handleUpdateJerseyRow(row.id, 'size', sz)}
                                    className={`py-1.5 text-xs font-bold rounded-xl border transition cursor-pointer ${
                                      row.size === sz
                                        ? 'bg-[#11382C] text-white border-[#11382C]'
                                        : 'bg-white dark:bg-zinc-900 text-slate-700 dark:text-zinc-300 border-slate-200 dark:border-zinc-700 hover:border-[#11382C]'
                                    }`}
                                  >
                                    {sz}
                                  </button>
                                ))}
                              </div>
                            </div>

                            {/* Rate and Qty */}
                            <div className="grid grid-cols-12 gap-2.5 items-start">
                              <div className="col-span-7">
                                <label className="block text-[11px] font-semibold text-slate-500 dark:text-zinc-400 mb-1">
                                  Rate (৳)
                                </label>
                                <div className="flex items-center bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-xl px-3 py-1.5">
                                  <span className="text-slate-400 text-xs mr-1">৳</span>
                                  <input
                                    type="number"
                                    value={row.rate}
                                    onChange={(e) =>
                                      handleUpdateJerseyRow(row.id, 'rate', Number(e.target.value))
                                    }
                                    className="w-full bg-transparent text-xs sm:text-sm font-bold text-slate-900 dark:text-white focus:outline-none"
                                  />
                                </div>
                              </div>

                              <div className="col-span-5">
                                <label className="block text-[11px] font-semibold text-slate-500 dark:text-zinc-400 mb-1">
                                  Qty
                                </label>
                                <div className="flex items-center justify-between bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-xl px-2.5 py-1.5">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleUpdateJerseyRow(
                                        row.id,
                                        'quantity',
                                        Math.max(1, row.quantity - 1)
                                      )
                                    }
                                    className="w-5 h-5 rounded text-slate-500 hover:bg-slate-100 flex items-center justify-center font-bold cursor-pointer"
                                  >
                                    −
                                  </button>
                                  <span className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">
                                    {row.quantity}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleUpdateJerseyRow(row.id, 'quantity', row.quantity + 1)
                                    }
                                    className="w-5 h-5 rounded text-slate-500 hover:bg-slate-100 flex items-center justify-center font-bold cursor-pointer"
                                  >
                                    +
                                  </button>
                                </div>
                              </div>
                            </div>

                            {/* Heat-press customization */}
                            <div
                              onClick={() => setCustomizingRowId(row.id)}
                              className={`border rounded-xl p-2.5 flex items-center justify-between gap-2.5 cursor-pointer transition ${
                                row.customization
                                  ? 'bg-[#E6F6EE]/70 dark:bg-emerald-950/40 border-[#11382C]'
                                  : 'bg-white dark:bg-zinc-900 border-slate-200/80 dark:border-zinc-700 hover:border-[#11382C]'
                              }`}
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                <div
                                  className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                                    row.customization
                                      ? 'bg-[#11382C] text-white'
                                      : 'bg-[#E6F6EE] text-[#11382C]'
                                  }`}
                                >
                                  <Flame className="w-3.5 h-3.5" />
                                </div>
                                <div className="min-w-0">
                                  <div className="text-xs font-bold text-slate-900 dark:text-white truncate flex items-center gap-1.5">
                                    <span>Heat-Press Print</span>
                                    {row.customization && (
                                      <span className="text-[10px] font-bold bg-[#11382C] text-white px-1.5 py-0.2 rounded">
                                        +৳{row.customization.extraCharge}
                                      </span>
                                    )}
                                  </div>
                                  <div className="text-[10px] text-slate-500 truncate">
                                    {row.customization
                                      ? `${row.customization.customName} #${row.customization.customNumber}`
                                      : 'Custom name, number & badge'}
                                  </div>
                                </div>
                              </div>
                              <span className="text-xs font-bold text-[#11382C] underline shrink-0">
                                {row.customization ? 'Edit' : 'Add'}
                              </span>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                  <div className="grid grid-cols-2 gap-2.5">
                    <button
                      type="button"
                      onClick={handleAddJerseyRow}
                      className="py-2 px-3 rounded-xl bg-[#E6F6EE] hover:bg-[#d8ede0] text-[#11382C] font-bold text-xs flex items-center justify-center gap-1.5 transition cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add Jersey</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleAddOtherRow}
                      className="py-2 px-3 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-800 border border-slate-200 font-bold text-xs flex items-center justify-center gap-1.5 transition cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Other Item</span>
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={handleAddJerseyRowsToCart}
                    className="w-full py-3 rounded-xl bg-[#11382C] hover:bg-[#0D2B22] text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition shadow-xs cursor-pointer"
                  >
                    <ShoppingCart className="w-4 h-4" />
                    <span>
                      Add to Cart ({jerseyRows.length} {jerseyRows.length === 1 ? 'item' : 'items'})
                    </span>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* MOBILE PAGE 2: VIEW CART (Matches Reference Image 2) */}
        {mobilePosStep === 'cart' && (
          <div className="lg:hidden space-y-3 pb-24">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setMobilePosStep('products')}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 text-slate-800 dark:text-zinc-200 flex items-center justify-center transition cursor-pointer active:scale-95 shrink-0"
                aria-label="Back to Products"
              >
                <ChevronLeft className="w-4 h-4" strokeWidth={2.2} />
              </button>
              <h2 className="text-base font-extrabold text-slate-900 dark:text-white">
                Cart ({totalCartUnits})
              </h2>
            </div>
            <div className="bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 rounded-3xl p-4 shadow-2xs space-y-3">
              {cartItems.length === 0 ? (
                <div className="py-10 px-4 flex flex-col items-center justify-center text-center">
                  <div className="w-12 h-12 rounded-full bg-[#E6F6EE] dark:bg-emerald-950/60 text-[#11382C] dark:text-emerald-400 flex items-center justify-center mb-2.5">
                    <ShoppingCart className="w-5 h-5" />
                  </div>
                  <div className="text-sm font-extrabold text-slate-900 dark:text-white">
                    Your cart is empty
                  </div>
                  <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1 max-w-xs">
                    Browse products and select sizes or variants to add items to your cart.
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100 dark:divide-zinc-800/80">
                  {cartItems.map((item) => {
                    const matchedProduct = catalog.find(
                      (p) => p.id === item.variantId || p.name === item.title
                    );
                    const variantLabel = [item.size, item.color].filter(Boolean).join(' / ');
                    const isEditingItem = editingCartItemId === item.id;

                    return (
                      <div key={item.id} className="py-3.5 first:pt-0.5 last:pb-1">
                        <div className="flex items-start gap-3">
                          {/* Left Square Product Thumbnail */}
                          <div className="w-16 h-16 rounded-2xl bg-[#F4F6F5] dark:bg-zinc-800 border border-slate-200/60 dark:border-zinc-700/60 flex items-center justify-center overflow-hidden shrink-0">
                            {matchedProduct?.imageUrl ? (
                              <img
                                src={matchedProduct.imageUrl}
                                alt={item.title}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <Shirt className="w-7 h-7 stroke-[1.6] text-[#11382C] dark:text-emerald-400" />
                            )}
                          </div>

                          {/* Middle Product Info */}
                          <div className="min-w-0 flex-1">
                            <div className="text-[15px] font-extrabold text-slate-900 dark:text-white leading-snug truncate">
                              {item.title}
                            </div>
                            <div className="text-xs text-slate-500 dark:text-zinc-400 font-medium mt-0.5 truncate">
                              {variantLabel || 'Standard'}
                              {item.isManualInventoryEntry ? ' • Non-Stock' : ''}
                            </div>
                            <div className="text-sm font-extrabold text-slate-900 dark:text-white font-mono mt-2">
                              ৳ {item.rate.toLocaleString()}
                            </div>
                          </div>

                          {/* Right Stepper + Menu & Subtotal */}
                          <div className="flex flex-col items-end justify-between self-stretch shrink-0">
                            <div className="flex items-center gap-1.5">
                              <div className="flex items-center bg-[#F4F6F5] dark:bg-zinc-800 rounded-full px-1.5 py-1 border border-slate-200/70 dark:border-zinc-700">
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleUpdateCartItemQuantity(item.id, item.quantity - 1)
                                  }
                                  className="w-6 h-6 rounded-full text-slate-700 dark:text-zinc-200 hover:bg-white dark:hover:bg-zinc-700 flex items-center justify-center font-bold text-sm cursor-pointer transition"
                                  aria-label="Decrease quantity"
                                >
                                  −
                                </button>
                                <span className="w-7 text-center font-mono font-extrabold text-xs text-slate-900 dark:text-white">
                                  {item.quantity}
                                </span>
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleUpdateCartItemQuantity(item.id, item.quantity + 1)
                                  }
                                  className="w-6 h-6 rounded-full text-slate-700 dark:text-zinc-200 hover:bg-white dark:hover:bg-zinc-700 flex items-center justify-center font-bold text-sm cursor-pointer transition"
                                  aria-label="Increase quantity"
                                >
                                  +
                                </button>
                              </div>

                              <button
                                type="button"
                                onClick={() =>
                                  setEditingCartItemId((prev) =>
                                    prev === item.id ? null : item.id
                                  )
                                }
                                className="w-7 h-7 rounded-full text-slate-500 hover:bg-slate-100 dark:hover:bg-zinc-800 flex items-center justify-center cursor-pointer"
                                aria-label="Item options"
                              >
                                <MoreVertical className="w-4 h-4" />
                              </button>
                            </div>

                            <div className="text-sm font-extrabold text-slate-900 dark:text-white font-mono mt-2">
                              ৳ {item.subtotal.toLocaleString()}
                            </div>
                          </div>
                        </div>

                        {/* Expandable unit rate edit & remove bar */}
                        {isEditingItem && (
                          <div className="mt-2.5 pt-2.5 border-t border-slate-100 dark:border-zinc-800 flex items-center justify-between gap-2 bg-slate-50/80 dark:bg-zinc-800/50 px-3 py-2 rounded-2xl">
                            <div className="flex items-center gap-1.5">
                              <span className="text-[11px] font-semibold text-slate-500">
                                Unit Price (৳):
                              </span>
                              <input
                                type="number"
                                value={item.rate}
                                onChange={(e) =>
                                  handleUpdateItemRate(item.id, Number(e.target.value))
                                }
                                className="w-20 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-xl px-2 py-1 text-xs font-bold text-slate-900 dark:text-white text-center focus:outline-none"
                              />
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                handleRemoveCartItem(item.id);
                                setEditingCartItemId(null);
                              }}
                              className="px-2.5 py-1 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 text-xs font-bold flex items-center gap-1 cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              <span>Remove</span>
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* + Add more items button */}
              <div className="pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setMobilePosStep('products');
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                  className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-full bg-[#E6F6EE] hover:bg-[#d5efe2] text-[#11382C] text-xs font-extrabold transition cursor-pointer"
                >
                  <Plus className="w-4 h-4 stroke-[2.4]" />
                  <span>Add more items</span>
                </button>
              </div>
            </div>

            {/* Total Summary Card (Matches Reference Image 2) */}
            <div className="bg-[#F2FBF6] dark:bg-emerald-950/30 border border-emerald-200/80 dark:border-emerald-800/60 rounded-3xl p-4 shadow-2xs space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-full bg-[#E0F3E8] dark:bg-emerald-900/60 text-[#11382C] dark:text-emerald-300 flex items-center justify-center shrink-0">
                    <Tag className="w-4 h-4 stroke-[2.2]" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-extrabold text-slate-900 dark:text-white">
                      Total{' '}
                      <span className="text-xs font-medium text-slate-500 dark:text-zinc-400">
                        ({totalCartUnits} {totalCartUnits === 1 ? 'item' : 'items'})
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setCartSummaryExpanded((prev) => !prev)}
                      className="text-xs font-bold text-[#11382C] dark:text-emerald-400 underline inline-flex items-center gap-0.5 mt-0.5 cursor-pointer"
                    >
                      <span>See summary</span>
                      <ChevronRight
                        className={`w-3.5 h-3.5 transition-transform ${
                          cartSummaryExpanded ? 'rotate-90' : ''
                        }`}
                      />
                    </button>
                  </div>
                </div>

                <div className="text-xl font-black text-slate-900 dark:text-white font-mono shrink-0">
                  ৳ {finalTotal.toLocaleString()}
                </div>
              </div>

              <BottomSheet
                isOpen={cartSummaryExpanded}
                onClose={() => setCartSummaryExpanded(false)}
                title="Order Summary"
                subtitle={`${totalCartUnits} ${totalCartUnits === 1 ? 'item' : 'items'} in cart`}
                maxHeightClass="max-h-[48dvh]"
              >
                <div className="space-y-2 text-xs">
                  <div className="flex items-center justify-between py-1 text-slate-600 dark:text-zinc-300">
                    <span>Items Subtotal ({cartItems.length} products)</span>
                    <span className="font-mono font-bold text-slate-900 dark:text-white">
                      ৳ {cartSubtotal.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex items-center justify-between py-1 text-slate-600 dark:text-zinc-300">
                    <span>Manual Discount</span>
                    <span className="font-mono font-bold text-[#11382C] dark:text-emerald-400">
                      − ৳ {discount.toLocaleString()}
                    </span>
                  </div>
                  {loyaltyRedemption.loyaltyDiscountAmount > 0 && (
                    <div className="flex items-center justify-between py-1 text-slate-600 dark:text-zinc-300">
                      <span>Loyalty Points Discount</span>
                      <span className="font-mono font-bold text-[#11382C] dark:text-emerald-400">
                        − ৳ {loyaltyRedemption.loyaltyDiscountAmount.toLocaleString()}
                      </span>
                    </div>
                  )}
                  <div className="flex items-center justify-between pt-2.5 border-t border-slate-200 dark:border-zinc-800 text-sm font-black text-slate-900 dark:text-white">
                    <span>Net Payable</span>
                    <span className="font-mono text-[#11382C] dark:text-emerald-400">
                      ৳ {finalTotal.toLocaleString()}
                    </span>
                  </div>
                </div>
              </BottomSheet>
            </div>

            {/* Continue to Checkout CTA (Matches Reference Image 2) */}
            <button
              type="button"
              disabled={cartItems.length === 0}
              onClick={() => {
                if (cartItems.length === 0) {
                  showToast('কার্টে অন্তত একটি পণ্য যোগ করুন', 'warning');
                  return;
                }
                setMobilePosStep('checkout');
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              className="w-full py-4 px-5 rounded-full bg-[#11382C] hover:bg-[#0D2B22] disabled:opacity-50 text-white font-extrabold text-sm flex items-center justify-between shadow-md transition cursor-pointer"
            >
              <span className="w-5" />
              <span className="flex items-center gap-2">
                <CreditCard className="w-4 h-4" />
                <span>Continue to Checkout</span>
              </span>
              <ArrowRight className="w-4 h-4 stroke-[2.4]" />
            </button>
          </div>
        )}

        {/* MOBILE PAGE 3: CHECKOUT & PAYMENT (Matches Reference Image 3) */}
        {mobilePosStep === 'checkout' && (
          <div className="lg:hidden space-y-3 pb-24">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setMobilePosStep('cart')}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 text-slate-800 dark:text-zinc-200 flex items-center justify-center transition cursor-pointer active:scale-95 shrink-0"
                aria-label="Back to Cart"
              >
                <ChevronLeft className="w-4 h-4" strokeWidth={2.2} />
              </button>
              <h2 className="text-base font-extrabold text-slate-900 dark:text-white">
                Checkout
              </h2>
            </div>
            {/* Order Items Card */}
            <div className="bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 rounded-3xl p-4 shadow-2xs">
              {cartItems.length === 0 ? (
                <div className="py-6 text-center text-xs text-slate-500">
                  No items in order.{' '}
                  <button
                    type="button"
                    onClick={() => setMobilePosStep('products')}
                    className="font-bold text-[#11382C] underline cursor-pointer"
                  >
                    Add products
                  </button>
                </div>
              ) : (
                <div className="divide-y divide-slate-100 dark:divide-zinc-800/80">
                  {cartItems.map((item) => {
                    const matchedProduct = catalog.find(
                      (p) => p.id === item.variantId || p.name === item.title
                    );
                    const variantLabel = [item.size, item.color].filter(Boolean).join(' / ');
                    const isEditingItem = editingCartItemId === item.id;

                    return (
                      <div key={item.id} className="py-3.5 first:pt-0.5 last:pb-0.5">
                        <div className="flex items-start gap-3">
                          <div className="w-16 h-16 rounded-2xl bg-[#F4F6F5] dark:bg-zinc-800 border border-slate-200/60 dark:border-zinc-700/60 flex items-center justify-center overflow-hidden shrink-0">
                            {matchedProduct?.imageUrl ? (
                              <img
                                src={matchedProduct.imageUrl}
                                alt={item.title}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <Shirt className="w-7 h-7 stroke-[1.6] text-[#11382C] dark:text-emerald-400" />
                            )}
                          </div>

                          <div className="min-w-0 flex-1">
                            <div className="text-[15px] font-extrabold text-slate-900 dark:text-white leading-snug truncate">
                              {item.title}
                            </div>
                            <div className="text-xs text-slate-500 dark:text-zinc-400 font-medium mt-0.5 truncate">
                              {variantLabel || 'Standard'}
                            </div>
                            <div className="text-sm font-extrabold text-slate-900 dark:text-white font-mono mt-2">
                              ৳ {item.rate.toLocaleString()}
                            </div>
                          </div>

                          <div className="flex flex-col items-end justify-between self-stretch shrink-0">
                            <div className="flex items-center gap-1.5">
                              <div className="flex items-center bg-[#F4F6F5] dark:bg-zinc-800 rounded-full px-1.5 py-1 border border-slate-200/70 dark:border-zinc-700">
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleUpdateCartItemQuantity(item.id, item.quantity - 1)
                                  }
                                  className="w-6 h-6 rounded-full text-slate-700 dark:text-zinc-200 hover:bg-white flex items-center justify-center font-bold text-sm cursor-pointer"
                                  aria-label="Decrease quantity"
                                >
                                  −
                                </button>
                                <span className="w-7 text-center font-mono font-extrabold text-xs text-slate-900 dark:text-white">
                                  {item.quantity}
                                </span>
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleUpdateCartItemQuantity(item.id, item.quantity + 1)
                                  }
                                  className="w-6 h-6 rounded-full text-slate-700 dark:text-zinc-200 hover:bg-white flex items-center justify-center font-bold text-sm cursor-pointer"
                                  aria-label="Increase quantity"
                                >
                                  +
                                </button>
                              </div>

                              <button
                                type="button"
                                onClick={() =>
                                  setEditingCartItemId((prev) =>
                                    prev === item.id ? null : item.id
                                  )
                                }
                                className="w-7 h-7 rounded-full text-slate-500 hover:bg-slate-100 dark:hover:bg-zinc-800 flex items-center justify-center cursor-pointer"
                                aria-label="Item options"
                              >
                                <MoreVertical className="w-4 h-4" />
                              </button>
                            </div>

                            <div className="text-sm font-extrabold text-slate-900 dark:text-white font-mono mt-2">
                              ৳ {item.subtotal.toLocaleString()}
                            </div>
                          </div>
                        </div>

                        {isEditingItem && (
                          <div className="mt-2.5 pt-2.5 border-t border-slate-100 dark:border-zinc-800 flex items-center justify-between gap-2 bg-slate-50/80 dark:bg-zinc-800/50 px-3 py-2 rounded-2xl">
                            <div className="flex items-center gap-1.5">
                              <span className="text-[11px] font-semibold text-slate-500">
                                Rate (৳):
                              </span>
                              <input
                                type="number"
                                value={item.rate}
                                onChange={(e) =>
                                  handleUpdateItemRate(item.id, Number(e.target.value))
                                }
                                className="w-20 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-xl px-2 py-1 text-xs font-bold text-slate-900 dark:text-white text-center focus:outline-none"
                              />
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                handleRemoveCartItem(item.id);
                                setEditingCartItemId(null);
                              }}
                              className="px-2.5 py-1 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 text-xs font-bold flex items-center gap-1 cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              <span>Remove</span>
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Order Summary Card (Matches Reference Image 3) */}
            <div className="bg-[#F2FBF6] dark:bg-emerald-950/30 border border-emerald-200/80 dark:border-emerald-800/60 rounded-3xl p-4 shadow-2xs space-y-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-full bg-[#E0F3E8] dark:bg-emerald-900/60 text-[#11382C] dark:text-emerald-300 flex items-center justify-center shrink-0">
                  <Tag className="w-4 h-4 stroke-[2.2]" />
                </div>
                <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                  Order Summary
                </h3>
              </div>

              <div className="space-y-2.5 text-sm">
                <div className="flex items-center justify-between text-slate-600 dark:text-zinc-300">
                  <span className="font-medium">Subtotal</span>
                  <span className="font-bold text-slate-900 dark:text-white font-mono">
                    ৳ {cartSubtotal.toLocaleString()}
                  </span>
                </div>

                <div className="flex items-center justify-between text-slate-600 dark:text-zinc-300">
                  <span className="font-medium">Discount</span>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold text-[#11382C] dark:text-emerald-400">৳</span>
                    <input
                      type="number"
                      min={0}
                      value={discount}
                      onChange={(e) => setDiscount(Number(e.target.value))}
                      className="w-24 bg-white dark:bg-zinc-900 border border-emerald-200 dark:border-emerald-800 rounded-xl px-2.5 py-1 text-sm font-extrabold text-[#11382C] dark:text-emerald-400 text-right font-mono focus:outline-none focus:border-[#11382C]"
                    />
                  </div>
                </div>

                {/* Loyalty Reward Tiers if enabled */}
                {loyaltySettings.enabled && eligibleLoyaltyTiers.length > 0 && (
                  <div className="pt-1 space-y-1.5">
                    <div className="flex items-center justify-between text-xs text-slate-600 dark:text-zinc-400">
                      <span className="flex items-center gap-1 font-semibold">
                        <Award className="w-3.5 h-3.5 text-[#11382C]" />
                        Loyalty Reward ({customerHistory.loyaltyPoints} pts)
                      </span>
                      {loyaltyRedemption.loyaltyDiscountAmount > 0 && (
                        <span className="font-mono font-bold text-[#11382C]">
                          − ৳ {loyaltyRedemption.loyaltyDiscountAmount.toLocaleString()}
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      <button
                        type="button"
                        onClick={() => setSelectedLoyaltyTierId(null)}
                        className={`px-2.5 py-1 rounded-full text-[11px] font-bold border cursor-pointer transition ${
                          !selectedLoyaltyTierId
                            ? 'bg-[#11382C] text-white border-[#11382C]'
                            : 'bg-white text-slate-600 border-slate-200'
                        }`}
                      >
                        No Reward
                      </button>
                      {eligibleLoyaltyTiers.map((tier) => (
                        <button
                          key={tier.id}
                          type="button"
                          onClick={() =>
                            setSelectedLoyaltyTierId(
                              selectedLoyaltyTierId === tier.id ? null : tier.id
                            )
                          }
                          className={`px-2.5 py-1 rounded-full text-[11px] font-bold border cursor-pointer transition ${
                            selectedLoyaltyTierId === tier.id
                              ? 'bg-[#11382C] text-white border-[#11382C]'
                              : 'bg-white text-[#11382C] border-emerald-300'
                          }`}
                        >
                          {tier.pointsRequired} pts ({tier.discountPercent}% off)
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div className="pt-2.5 border-t border-emerald-200/80 dark:border-emerald-800/60 flex items-center justify-between">
                  <span className="text-lg font-extrabold text-slate-900 dark:text-white">
                    Total
                  </span>
                  <span className="text-xl font-black text-slate-900 dark:text-white font-mono">
                    ৳ {finalTotal.toLocaleString()}
                  </span>
                </div>

                {paymentMode === 'partial' && (
                  <div className="pt-2 border-t border-emerald-200/60 dark:border-emerald-800/50 space-y-2 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-slate-700 dark:text-zinc-300">
                        Advance Paid (৳)
                      </span>
                      <input
                        type="number"
                        value={advancePaid}
                        onChange={(e) => setAdvancePaid(Number(e.target.value))}
                        className="w-28 bg-white dark:bg-zinc-900 border border-emerald-300 dark:border-emerald-800 rounded-xl px-2.5 py-1.5 text-xs font-extrabold text-slate-900 dark:text-white text-right font-mono focus:outline-none"
                      />
                    </div>
                    <div className="flex items-center justify-between font-bold text-rose-600">
                      <span>Balance Due</span>
                      <span className="font-mono">৳ {dueAmount.toLocaleString()}</span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Payment Method Card (Matches Reference Image 3) */}
            <div className="bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 rounded-3xl p-4 shadow-2xs space-y-3.5">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-full bg-[#E6F6EE] dark:bg-emerald-950/60 text-[#11382C] dark:text-emerald-400 flex items-center justify-center shrink-0">
                    <CreditCard className="w-4 h-4 stroke-[2.2]" />
                  </div>
                  <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                    Payment Method
                  </h3>
                </div>

                {/* Full Paid vs Partial Advance Compact Toggle */}
                <div className="inline-flex bg-slate-100 dark:bg-zinc-800 p-0.5 rounded-full text-[11px] font-bold">
                  <button
                    type="button"
                    onClick={() => setPaymentMode('paid')}
                    className={`px-2.5 py-1 rounded-full transition cursor-pointer ${
                      paymentMode === 'paid'
                        ? 'bg-[#11382C] text-white'
                        : 'text-slate-600 dark:text-zinc-400'
                    }`}
                  >
                    Full Paid
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaymentMode('partial')}
                    className={`px-2.5 py-1 rounded-full transition cursor-pointer ${
                      paymentMode === 'partial'
                        ? 'bg-[#11382C] text-white'
                        : 'text-slate-600 dark:text-zinc-400'
                    }`}
                  >
                    Advance
                  </button>
                </div>
              </div>

              {/* Payment Method Pills Row (Matches Reference Image 3) */}
              <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-0.5">
                {(
                  [
                    { key: 'cash', label: 'Cash' },
                    { key: 'merchantBkash', label: 'bKash' },
                    { key: 'personalBkash', label: 'bKash Pers.' },
                    { key: 'nagad', label: 'Nagad' },
                    { key: 'bank', label: 'Bank/Card' },
                    { key: 'split', label: 'Split Payment' },
                  ] as const
                ).map((ch) => {
                  const isSelected = paymentChannel === ch.key;
                  return (
                    <button
                      key={ch.key}
                      type="button"
                      onClick={() => {
                        setPaymentChannel(ch.key);
                        if (ch.key === 'split') setSplitModalOpen(true);
                      }}
                      className={`px-3.5 py-2.5 rounded-2xl text-xs font-extrabold flex items-center gap-2 shrink-0 border transition cursor-pointer ${
                        isSelected
                          ? 'bg-[#11382C] text-white border-[#11382C] shadow-xs'
                          : 'bg-white dark:bg-zinc-900 text-slate-700 dark:text-zinc-200 border-slate-200 dark:border-zinc-700 hover:border-slate-300'
                      }`}
                    >
                      {ch.key === 'cash' && <Wallet className="w-3.5 h-3.5" />}
                      {(ch.key === 'merchantBkash' || ch.key === 'personalBkash') && (
                        <span className="w-2 h-2 rounded-full bg-pink-500" />
                      )}
                      {ch.key === 'nagad' && (
                        <span className="w-2 h-2 rounded-full bg-orange-500" />
                      )}
                      {ch.key === 'bank' && <CreditCard className="w-3.5 h-3.5" />}
                      {ch.key === 'split' && <RefreshCw className="w-3.5 h-3.5" />}
                      <span>{ch.label}</span>
                      {isSelected && <CheckCircle className="w-3.5 h-3.5 text-white shrink-0" />}
                    </button>
                  );
                })}
              </div>

              {/* Split Payment Allocation Summary when Split is selected */}
              {paymentChannel === 'split' && (
                <div className="bg-[#F2FBF6] dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 rounded-2xl p-3 space-y-1.5 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-extrabold text-[#11382C] dark:text-emerald-300">
                      Split Payment Allocation
                    </span>
                    <button
                      type="button"
                      onClick={() => setSplitModalOpen(true)}
                      className="text-xs font-extrabold text-[#11382C] dark:text-emerald-400 underline cursor-pointer"
                    >
                      Edit Split
                    </button>
                  </div>
                  {(() => {
                    const activeEntries = getActiveSplitEntries(splitBreakdown);
                    const splitSum = calculateSplitTotal(splitBreakdown);
                    const isSplitMatched = splitSum === effectiveAdvance && effectiveAdvance > 0;
                    return activeEntries.length > 0 ? (
                      <div className="space-y-1 pt-1">
                        {activeEntries.map((entry) => (
                          <div
                            key={entry.key}
                            className="flex items-center justify-between text-slate-700 dark:text-zinc-200"
                          >
                            <span>• {entry.label}</span>
                            <span className="font-mono font-bold">
                              ৳ {entry.amount.toLocaleString()}
                            </span>
                          </div>
                        ))}
                        <div className="border-t border-emerald-200/70 pt-1.5 flex items-center justify-between font-extrabold">
                          <span>Allocated / Payable:</span>
                          <span
                            className={
                              isSplitMatched
                                ? 'text-[#11382C] font-mono'
                                : 'text-rose-600 font-mono'
                            }
                          >
                            ৳ {splitSum.toLocaleString()} / ৳ {effectiveAdvance.toLocaleString()}
                          </span>
                        </div>
                      </div>
                    ) : (
                      <div className="text-slate-500 flex items-center justify-between">
                        <span>No split amounts configured yet.</span>
                        <button
                          type="button"
                          onClick={() => setSplitModalOpen(true)}
                          className="px-2.5 py-1 rounded-xl bg-[#11382C] text-white font-bold cursor-pointer"
                        >
                          Configure Split
                        </button>
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>

            {/* Primary Proceed / Complete Sale Button (Matches Reference Image 3) */}
            <div className="space-y-2">
              <button
                type="button"
                onClick={() => handleCompleteSale(true)}
                className="w-full py-4 px-5 rounded-full bg-[#11382C] hover:bg-[#0D2B22] text-white font-extrabold text-sm flex items-center justify-between shadow-md transition cursor-pointer"
              >
                <span className="w-5" />
                <span className="flex items-center gap-2">
                  <CreditCard className="w-4 h-4" />
                  <span>Complete Sale & Cash Memo</span>
                </span>
                <ArrowRight className="w-4 h-4 stroke-[2.4]" />
              </button>

              <button
                type="button"
                onClick={() => handleCompleteSale(false)}
                className="w-full py-2.5 px-4 rounded-full bg-white dark:bg-zinc-900 hover:bg-slate-50 text-[#11382C] dark:text-emerald-400 border border-[#11382C]/30 font-bold text-xs flex items-center justify-center gap-1.5 transition cursor-pointer"
              >
                <Zap className="w-3.5 h-3.5" />
                <span>Quick Cash-In (Without Memo)</span>
              </button>
            </div>

            {/* Customer Details Card */}
            <div className="bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 rounded-3xl p-4 shadow-2xs space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-[#E6F6EE] dark:bg-emerald-950/60 text-[#11382C] dark:text-emerald-400 flex items-center justify-center">
                    <User className="w-4 h-4" />
                  </div>
                  <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">
                    Customer Info
                  </h3>
                </div>
                {customerHistory.existsInShop && (
                  <button
                    type="button"
                    onClick={() => setCustomerHistoryModalOpen(true)}
                    className="px-2.5 py-1 rounded-full bg-[#E6F6EE] text-[#11382C] text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                  >
                    <History className="w-3 h-3" />
                    <span>{customerHistory.loyaltyPoints} pts • History</span>
                  </button>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 dark:text-zinc-400 mb-1">
                    Customer Name
                  </label>
                  <input
                    type="text"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    className="w-full bg-slate-50/80 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl px-3 py-2 text-xs font-semibold text-slate-900 dark:text-white focus:outline-none focus:border-[#11382C]"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 dark:text-zinc-400 mb-1">
                    Phone Number
                  </label>
                  <input
                    type="text"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    placeholder="01XXXXXXXXX"
                    className="w-full bg-slate-50/80 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl px-3 py-2 text-xs font-semibold text-slate-900 dark:text-white focus:outline-none focus:border-[#11382C]"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Right Side: Desktop Counter Register (Cart & Checkout) */}
        <div
          ref={counterRegisterRef}
          id="pos-counter-register"
          className="hidden lg:flex lg:col-span-5 bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 rounded-3xl p-4 sm:p-5 flex-col justify-between space-y-4 shadow-2xs scroll-mt-16"
        >
          <div className="space-y-3.5">
            {/* Header */}
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-9 h-9 rounded-2xl bg-[#E6F6EE] dark:bg-emerald-950/60 flex items-center justify-center text-[#11382C] dark:text-emerald-400 shrink-0">
                  <ShoppingCart className="w-4 h-4 stroke-[2]" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-white leading-tight truncate">
                    Counter Register
                  </h3>
                  <div className="text-[11px] text-slate-500 font-medium truncate">
                    {inventoryTrackingEnabled ? 'Stock Tracked' : 'Fast Billing'}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() =>
                    topProductsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                  }
                  className="lg:hidden px-2.5 py-1 rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                >
                  <ArrowUp className="w-3 h-3" />
                  <span>Products</span>
                </button>
                <span className="text-xs bg-[#E6F6EE] dark:bg-emerald-950/60 text-[#11382C] dark:text-emerald-300 px-3 py-1 rounded-full font-bold">
                  {totalCartUnits} items
                </span>
              </div>
            </div>

            {/* Customer Inputs */}
            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="block text-[11px] font-semibold text-slate-500 dark:text-zinc-400 mb-1">
                  Customer name
                </label>
                <input
                  type="text"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  className="w-full bg-slate-50/70 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl px-3 py-2 text-xs sm:text-sm font-medium text-slate-900 dark:text-white focus:outline-none focus:border-[#11382C]"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-500 dark:text-zinc-400 mb-1">
                  WhatsApp phone
                </label>
                <input
                  type="text"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  placeholder="01XXXXXXXXX"
                  className="w-full bg-slate-50/70 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl px-3 py-2 text-xs sm:text-sm font-medium text-slate-900 dark:text-white focus:outline-none focus:border-[#11382C]"
                />
              </div>
            </div>

            {/* Shop-Scoped Customer Purchase & Loyalty Preview */}
            {customerPhone.replace(/[^0-9]/g, '').length >= 6 && (
              <div className="bg-slate-50/80 dark:bg-zinc-800/60 border border-slate-200/80 dark:border-zinc-800 rounded-2xl p-2.5 space-y-2 text-xs">
                {customerHistory.existsInShop ? (
                  <>
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="w-7 h-7 rounded-xl bg-[#E6F6EE] text-[#11382C] flex items-center justify-center font-extrabold shrink-0">
                          <User className="w-3.5 h-3.5" />
                        </div>
                        <div className="truncate">
                          <div className="font-bold text-slate-900 dark:text-white truncate">
                            {customerHistory.customerName || customerName}
                          </div>
                          <div className="text-[10px] text-slate-500">
                            Orders: <strong>{customerHistory.invoiceCount}</strong>
                            {customerHistory.lastPurchaseDate && (
                              <span>
                                {' '}
                                • Last:{' '}
                                {new Date(customerHistory.lastPurchaseDate).toLocaleDateString('en-GB')}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => setCustomerHistoryModalOpen(true)}
                        className="px-2.5 py-1 rounded-xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 text-[#11382C] dark:text-emerald-400 font-bold text-[11px] flex items-center gap-1 shrink-0 hover:border-[#11382C] cursor-pointer"
                      >
                        <History className="w-3 h-3" />
                        <span>History</span>
                      </button>
                    </div>

                    <div className="grid grid-cols-3 gap-1.5 pt-1 border-t border-slate-200/60 dark:border-zinc-700/60 text-[11px]">
                      <div className="bg-white dark:bg-zinc-900 rounded-xl px-2 py-1 border border-slate-200/60 dark:border-zinc-800">
                        <div className="text-[10px] text-slate-400">Spent</div>
                        <div className="font-extrabold text-slate-900 dark:text-white font-mono">
                          ৳{customerHistory.totalSpent.toLocaleString()}
                        </div>
                      </div>
                      <div className="bg-white dark:bg-zinc-900 rounded-xl px-2 py-1 border border-slate-200/60 dark:border-zinc-800">
                        <div className="text-[10px] text-slate-400">Due</div>
                        <div
                          className={`font-extrabold font-mono ${
                            customerHistory.totalDue > 0 ? 'text-rose-600' : 'text-emerald-700'
                          }`}
                        >
                          ৳{customerHistory.totalDue.toLocaleString()}
                        </div>
                      </div>
                      <div className="bg-[#E6F6EE]/70 dark:bg-emerald-950/50 rounded-xl px-2 py-1 border border-emerald-200/70 dark:border-emerald-800/60">
                        <div className="text-[10px] text-[#11382C] dark:text-emerald-300 font-semibold">
                          Points
                        </div>
                        <div className="font-extrabold text-[#11382C] dark:text-emerald-400 font-mono">
                          {customerHistory.loyaltyPoints} pts
                        </div>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="flex items-center justify-between text-[11px] text-slate-500">
                    <span className="flex items-center gap-1.5 truncate">
                      <User className="w-3.5 h-3.5 text-[#11382C] shrink-0" />
                      <span className="truncate">New Customer</span>
                    </span>
                    <span className="font-bold text-[#11382C] shrink-0">0 Loyalty Pts</span>
                  </div>
                )}
              </div>
            )}

            {/* Matched Reseller Alert */}
            {matchedReseller && (
              <div className="bg-[#E6F6EE] dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 p-2.5 rounded-2xl flex items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-xl bg-[#11382C] text-white flex items-center justify-center shrink-0">
                    <Truck className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <div className="text-slate-900 dark:text-white font-bold">
                      Reseller: {matchedReseller.name}
                    </div>
                    <div className="text-[11px] text-slate-600 dark:text-zinc-400">
                      Due:{' '}
                      <strong className="text-rose-600 font-mono">
                        ৳{matchedReseller.currentDueBalance.toLocaleString()}
                      </strong>
                    </div>
                  </div>
                </div>

                {onNavigateToReseller && (
                  <button
                    type="button"
                    onClick={onNavigateToReseller}
                    className="text-xs font-bold text-white bg-[#11382C] px-3 py-1.5 rounded-xl shrink-0 cursor-pointer"
                  >
                    Reseller Counter
                  </button>
                )}
              </div>
            )}

            {/* Line items list with quantity adjusters & clean variant tags */}
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {cartItems.length === 0 ? (
                <div className="py-6 px-4 flex flex-col items-center justify-center text-center border border-dashed border-slate-200 dark:border-zinc-800 rounded-2xl">
                  <div className="w-10 h-10 rounded-full bg-[#E6F6EE] dark:bg-emerald-950/60 text-[#11382C] dark:text-emerald-400 flex items-center justify-center mb-1.5">
                    <ShoppingCart className="w-4 h-4" />
                  </div>
                  <div className="text-xs font-bold text-slate-900 dark:text-white">
                    Cart is empty
                  </div>
                  <p className="text-[11px] text-slate-400 dark:text-zinc-500 mt-0.5">
                    {inventoryTrackingEnabled
                      ? 'Tap a product above to select size and add.'
                      : 'Add items using the order builder above.'}
                  </p>
                </div>
              ) : (
                cartItems.map((item) => (
                  <div
                    key={item.id}
                    className="bg-slate-50/80 dark:bg-zinc-800/50 border border-slate-200/70 dark:border-zinc-800 rounded-2xl p-2.5 space-y-2"
                  >
                    <div className="flex justify-between items-start gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-bold text-slate-900 dark:text-white leading-tight truncate">
                          {item.title}
                        </div>
                        <div className="text-[10px] text-slate-500 dark:text-zinc-400 mt-0.5 flex flex-wrap items-center gap-1">
                          {item.color && (
                            <span className="px-1.5 py-0.2 rounded bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 font-medium">
                              {item.color}
                            </span>
                          )}
                          <span className="px-1.5 py-0.2 rounded bg-[#E6F6EE] dark:bg-emerald-950 text-[#11382C] dark:text-emerald-300 font-bold">
                            {item.size}
                          </span>
                          {item.isManualInventoryEntry && (
                            <span className="px-1 py-0.2 rounded bg-amber-100 text-amber-800 text-[9px] font-bold">
                              Non-Stock
                            </span>
                          )}
                        </div>
                      </div>
                      <button
                        onClick={() => handleRemoveCartItem(item.id)}
                        className="text-slate-400 hover:text-rose-500 p-1 cursor-pointer shrink-0"
                        aria-label="Remove item"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className="flex items-center justify-between text-xs pt-1.5 border-t border-slate-200/60 dark:border-zinc-700/60">
                      {/* Quantity Controller in Cart */}
                      <div className="flex items-center bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-xl px-1.5 py-0.5">
                        <button
                          type="button"
                          onClick={() => handleUpdateCartItemQuantity(item.id, item.quantity - 1)}
                          className="w-5 h-5 rounded text-slate-500 hover:bg-slate-100 flex items-center justify-center font-bold text-xs cursor-pointer"
                        >
                          −
                        </button>
                        <span className="w-7 text-center font-mono font-bold text-xs text-slate-900 dark:text-white">
                          {item.quantity}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleUpdateCartItemQuantity(item.id, item.quantity + 1)}
                          className="w-5 h-5 rounded text-slate-500 hover:bg-slate-100 flex items-center justify-center font-bold text-xs cursor-pointer"
                        >
                          +
                        </button>
                      </div>

                      {/* Rate Controller */}
                      <div className="flex items-center gap-1">
                        <span className="text-[11px] text-slate-400">৳</span>
                        <input
                          type="number"
                          value={item.rate}
                          onChange={(e) => handleUpdateItemRate(item.id, Number(e.target.value))}
                          className="w-16 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-lg px-1.5 py-0.5 text-xs font-bold text-slate-900 dark:text-white text-center focus:outline-none"
                        />
                      </div>

                      {/* Subtotal */}
                      <div className="font-mono font-bold text-[#11382C] dark:text-emerald-400 text-xs sm:text-sm shrink-0">
                        ৳{item.subtotal.toLocaleString()}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Payment type & Method */}
            <div className="space-y-2.5 pt-0.5">
              <div>
                <label className="block text-[11px] font-semibold text-slate-500 dark:text-zinc-400 mb-1">
                  Payment type
                </label>
                <div className="grid grid-cols-2 gap-1 bg-slate-100 dark:bg-zinc-800 p-1 rounded-2xl">
                  <button
                    type="button"
                    onClick={() => setPaymentMode('paid')}
                    className={`py-1.5 text-xs font-bold rounded-xl transition cursor-pointer ${
                      paymentMode === 'paid'
                        ? 'bg-white dark:bg-zinc-900 text-[#11382C] dark:text-emerald-400 shadow-2xs'
                        : 'text-slate-500 dark:text-zinc-400'
                    }`}
                  >
                    Full paid
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaymentMode('partial')}
                    className={`py-1.5 text-xs font-bold rounded-xl transition cursor-pointer ${
                      paymentMode === 'partial'
                        ? 'bg-white dark:bg-zinc-900 text-[#11382C] dark:text-emerald-400 shadow-2xs'
                        : 'text-slate-500 dark:text-zinc-400'
                    }`}
                  >
                    Partial advance
                  </button>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-[11px] font-semibold text-slate-500 dark:text-zinc-400">
                    Method
                  </label>
                  {paymentChannel === 'split' && (
                    <button
                      type="button"
                      onClick={() => setSplitModalOpen(true)}
                      className="text-[11px] font-bold text-[#11382C] dark:text-emerald-400 underline cursor-pointer"
                    >
                      Configure Split
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-3 gap-1 bg-slate-100 dark:bg-zinc-800 p-1 rounded-2xl text-center">
                  {(
                    [
                      { key: 'cash', label: 'Cash' },
                      { key: 'merchantBkash', label: 'bKash Merch.' },
                      { key: 'personalBkash', label: 'bKash Pers.' },
                      { key: 'nagad', label: 'Nagad' },
                      { key: 'bank', label: 'Bank/Card' },
                      { key: 'split', label: 'Split' },
                    ] as const
                  ).map((ch) => (
                    <button
                      key={ch.key}
                      type="button"
                      onClick={() => {
                        setPaymentChannel(ch.key);
                        if (ch.key === 'split') setSplitModalOpen(true);
                      }}
                      className={`py-1.5 px-1 rounded-xl text-[11px] font-bold transition cursor-pointer ${
                        paymentChannel === ch.key
                          ? 'bg-white dark:bg-zinc-900 text-[#11382C] dark:text-emerald-400 shadow-2xs'
                          : 'text-slate-500 dark:text-zinc-400 hover:text-slate-800'
                      }`}
                    >
                      {ch.label}
                    </button>
                  ))}
                </div>
              </div>

              {paymentMode === 'partial' && (
                <div className="flex items-center justify-between pt-0.5">
                  <span className="text-xs text-slate-600 dark:text-zinc-300 font-medium">
                    Advance (৳)
                  </span>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="number"
                      value={advancePaid}
                      onChange={(e) => setAdvancePaid(Number(e.target.value))}
                      className="w-24 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-xl px-2.5 py-1.5 text-xs font-bold text-slate-900 dark:text-white text-right focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setPaymentChannel('split');
                        setSplitModalOpen(true);
                      }}
                      className="px-2.5 py-1.5 rounded-xl bg-[#E6F6EE] dark:bg-emerald-950/60 text-[#11382C] dark:text-emerald-400 text-[11px] font-bold border border-emerald-300/60 dark:border-emerald-800 cursor-pointer shrink-0"
                    >
                      Split
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Subtotal, Manual Discount & Compact Loyalty Rewards */}
            <div className="space-y-2 pt-0.5">
              <div className="flex justify-between items-center text-xs sm:text-sm text-slate-600 dark:text-zinc-400">
                <span>Subtotal</span>
                <span className="font-bold text-slate-900 dark:text-white font-mono">
                  ৳{cartSubtotal.toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between items-center text-xs sm:text-sm text-slate-600 dark:text-zinc-400">
                <span>Discount (৳)</span>
                <input
                  type="number"
                  value={discount}
                  onChange={(e) => setDiscount(Number(e.target.value))}
                  className="w-24 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl px-2.5 py-1 text-xs sm:text-sm font-semibold text-slate-900 dark:text-white text-right focus:outline-none"
                />
              </div>

              {/* Compact Loyalty Reward Tiers & Earning Preview */}
              {loyaltySettings.enabled && (
                <div className="bg-slate-50/80 dark:bg-zinc-800/60 border border-slate-200/80 dark:border-zinc-800 rounded-2xl p-2.5 space-y-1.5 text-xs">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <Award className="w-3.5 h-3.5 text-[#11382C] dark:text-emerald-400" />
                      <span className="font-bold text-slate-700 dark:text-zinc-200">
                        Loyalty ({customerHistory.loyaltyPoints} pts)
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          setActiveInfoPopover((prev) => (prev === 'loyalty' ? null : 'loyalty'))
                        }
                        className="w-4 h-4 rounded-full text-slate-400 hover:text-slate-700 flex items-center justify-center cursor-pointer"
                        title="Loyalty Reward Rules"
                      >
                        <Info className="w-3 h-3" />
                      </button>
                    </div>
                    {previewEarnedPoints > 0 && (
                      <span className="px-2 py-0.5 rounded-full bg-[#E6F6EE] text-[#11382C] font-bold text-[10px]">
                        +{previewEarnedPoints} pts
                      </span>
                    )}
                  </div>

                  {activeInfoPopover === 'loyalty' && (
                    <div className="text-[11px] text-slate-500 dark:text-zinc-400 bg-white dark:bg-zinc-900 p-2 rounded-xl">
                      রিওয়ার্ড ছাড় পেতে ন্যূনতম{' '}
                      {Math.min(
                        ...(loyaltySettings.rewardTiers || [{ pointsRequired: 50 }]).map(
                          (t) => t.pointsRequired
                        )
                      )}{' '}
                      পয়েন্ট প্রয়োজন। প্রতি কেনাকাটায় স্বয়ংক্রিয়ভাবে পয়েন্ট জমা হবে।
                    </div>
                  )}

                  {eligibleLoyaltyTiers.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-0.5">
                      <button
                        type="button"
                        onClick={() => setSelectedLoyaltyTierId(null)}
                        className={`px-2 py-1 rounded-xl text-[10px] font-bold border cursor-pointer transition ${
                          !selectedLoyaltyTierId
                            ? 'bg-[#11382C] text-white border-[#11382C]'
                            : 'bg-white text-slate-600 border-slate-200'
                        }`}
                      >
                        None
                      </button>
                      {eligibleLoyaltyTiers.map((tier) => (
                        <button
                          key={tier.id}
                          type="button"
                          onClick={() =>
                            setSelectedLoyaltyTierId(
                              selectedLoyaltyTierId === tier.id ? null : tier.id
                            )
                          }
                          className={`px-2 py-1 rounded-xl text-[10px] font-bold border cursor-pointer transition ${
                            selectedLoyaltyTierId === tier.id
                              ? 'bg-[#11382C] text-white border-[#11382C]'
                              : 'bg-white text-[#11382C] border-emerald-300 hover:bg-[#E6F6EE]'
                          }`}
                        >
                          {tier.pointsRequired} pts → {tier.discountPercent}% off
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Dark Green Net Total Bill Card */}
            <div className="bg-[#11382C] text-white rounded-2xl p-3.5 space-y-2.5 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-xs text-emerald-100/90 font-medium">Net total bill</span>
                <span className="text-xl font-black tracking-tight font-mono">
                  ৳{finalTotal.toLocaleString()}
                </span>
              </div>

              <div className="bg-[#184B3C] rounded-xl p-2.5 grid grid-cols-3 gap-2 text-xs">
                <div>
                  <div className="text-emerald-100/70 text-[10px]">Bill</div>
                  <div className="font-bold text-white font-mono mt-0.5">
                    ৳{cartSubtotal.toLocaleString()}
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-emerald-100/70 text-[10px]">Paid</div>
                  <div className="font-bold text-white font-mono mt-0.5">
                    ৳{effectiveAdvance.toLocaleString()}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-emerald-100/70 text-[10px]">Due</div>
                  <div className="font-bold text-white font-mono mt-0.5">
                    ৳{dueAmount.toLocaleString()}
                  </div>
                </div>
              </div>

              {/* Payment Method & Split Payment Summary */}
              <div className="bg-[#184B3C]/90 rounded-xl px-3 py-2 space-y-1 text-xs border border-emerald-400/15">
                {paymentChannel === 'split' ? (
                  (() => {
                    const activeEntries = getActiveSplitEntries(splitBreakdown);
                    const splitSum = calculateSplitTotal(splitBreakdown);
                    const isSplitMatched = splitSum === effectiveAdvance && effectiveAdvance > 0;
                    return activeEntries.length > 0 ? (
                      <div className="space-y-1">
                        {activeEntries.map((entry) => (
                          <div
                            key={entry.key}
                            className="flex items-center justify-between text-[11px] text-white"
                          >
                            <span>• {entry.label}</span>
                            <span className="font-mono font-bold">
                              ৳{entry.amount.toLocaleString()}
                            </span>
                          </div>
                        ))}
                        <div className="border-t border-emerald-400/20 pt-1 flex items-center justify-between font-bold text-[11px]">
                          <span>Split Total:</span>
                          <span
                            className={
                              isSplitMatched
                                ? 'text-emerald-300 font-mono'
                                : 'text-amber-300 font-mono'
                            }
                          >
                            ৳{splitSum.toLocaleString()} / ৳{effectiveAdvance.toLocaleString()}
                          </span>
                        </div>
                      </div>
                    ) : (
                      <div className="text-[11px] text-amber-200 flex items-center justify-between">
                        <span>Split payment not configured</span>
                        <button
                          type="button"
                          onClick={() => setSplitModalOpen(true)}
                          className="underline font-bold cursor-pointer"
                        >
                          Configure
                        </button>
                      </div>
                    );
                  })()
                ) : (
                  <div className="flex items-center justify-between text-xs text-white font-bold">
                    <span className="text-emerald-100/90 font-medium">
                      {paymentChannel === 'cash'
                        ? 'Cash'
                        : paymentChannel === 'merchantBkash' || paymentChannel === 'bkash'
                        ? 'bKash Merchant'
                        : paymentChannel === 'personalBkash'
                        ? 'bKash Personal'
                        : paymentChannel === 'nagad'
                        ? 'Nagad'
                        : 'Bank/Card'}
                    </span>
                    <span className="font-mono">৳{effectiveAdvance.toLocaleString()}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Dual Checkout Action Buttons */}
          <div className="grid grid-cols-2 gap-2.5 pt-1">
            <button
              type="button"
              onClick={() => handleCompleteSale(false)}
              className="py-3 px-3 rounded-2xl bg-white dark:bg-zinc-900 hover:bg-slate-50 text-[#11382C] dark:text-emerald-400 border-2 border-[#11382C]/80 font-bold text-xs sm:text-sm flex items-center justify-center gap-1.5 transition cursor-pointer"
            >
              <Zap className="w-4 h-4" />
              <span>কুইক ক্যাশ ইন</span>
            </button>

            <button
              type="button"
              onClick={() => handleCompleteSale(true)}
              className="py-3 px-3 rounded-2xl bg-[#11382C] hover:bg-[#0D2B22] text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-1.5 transition shadow-xs cursor-pointer"
            >
              <Receipt className="w-4 h-4" />
              <span>ক্যাশ মেমো</span>
            </button>
          </div>
        </div>
      </div>

      {/* Sticky Mobile Cart Summary Bar (Matches Reference Image 1 — Shown on Product Selection Page) */}
      {mobilePosStep === 'products' && (
        <div className="lg:hidden fixed bottom-[62px] left-3 right-3 z-30 pointer-events-none">
          <div className="max-w-md mx-auto bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md border border-slate-200/90 dark:border-zinc-800 rounded-full p-2 pl-2.5 shadow-[0_8px_30px_rgb(0,0,0,0.12)] flex items-center justify-between gap-3 pointer-events-auto">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-10 h-10 rounded-full bg-[#E6F6EE] dark:bg-emerald-950/80 text-[#11382C] dark:text-emerald-300 flex items-center justify-center shrink-0">
                <ShoppingCart className="w-4 h-4" strokeWidth={2.2} />
              </div>
              <div className="min-w-0">
                <div className="text-xs font-extrabold text-slate-900 dark:text-white leading-tight">
                  {totalCartUnits} {totalCartUnits === 1 ? 'item' : 'items'}
                </div>
                <div className="text-[11px] font-bold text-slate-500 dark:text-zinc-400 font-mono leading-tight mt-0.5">
                  ৳ {finalTotal.toLocaleString()}
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                setMobilePosStep('cart');
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              className="px-4 py-2.5 rounded-full bg-[#11382C] hover:bg-[#0D2B22] active:scale-[0.98] text-white text-xs font-bold flex items-center gap-1.5 shadow-xs transition cursor-pointer shrink-0"
            >
              <span>View Cart</span>
              <ArrowRight className="w-3.5 h-3.5" strokeWidth={2.2} />
            </button>
          </div>
        </div>
      )}

      {/* Customization Modal */}
      {customizingRowId && (
        <CustomizationModal
          isOpen={!!customizingRowId}
          onClose={() => setCustomizingRowId(null)}
          onSave={(cust) => {
            if (customizingRowId === '__mode_a_inventory__') {
              setModeACustomization(cust);
            } else {
              handleUpdateJerseyRow(customizingRowId, 'customization', cust);
            }
            setCustomizingRowId(null);
          }}
          initialData={
            customizingRowId === '__mode_a_inventory__'
              ? modeACustomization
              : jerseyRows.find((r) => r.id === customizingRowId)?.customization
          }
        />
      )}



      {/* Receipt & WhatsApp Digital Slip Modal */}
      {activeReceipt && (
        <ReceiptModal
          isOpen={!!activeReceipt}
          onClose={() => setActiveReceipt(null)}
          invoice={activeReceipt}
        />
      )}

      {/* Bottom Price Lock Modal */}
      {bottomPriceLockedItem && (
        <BottomPriceLockModal
          isOpen={!!bottomPriceLockedItem}
          onClose={() => {
            setBottomPriceLockedItem(null);
            setPendingCheckoutOpenMemo(null);
          }}
          itemName={bottomPriceLockedItem.item.title}
          attemptedPrice={bottomPriceLockedItem.item.rate}
          bottomPrice={bottomPriceLockedItem.bottomPrice}
          productId={bottomPriceLockedItem.item.productId}
          quantity={bottomPriceLockedItem.item.quantity}
          onAuthorized={(token?: string) => {
            // Authorize this specific item/rate with single-use server token and resume checkout
            const lockedItem = bottomPriceLockedItem.item;
            const nextOverrides = authorizeBottomPriceOverride(approvedFloorOverrides, lockedItem);
            setApprovedFloorOverrides(nextOverrides);
            const nextTokens = {
              ...floorOverrideTokens,
              ...(token ? { [lockedItem.id]: token, [lockedItem.productId || '']: token } : {}),
            };
            setFloorOverrideTokens(nextTokens);
            const resumeOpenMemo = pendingCheckoutOpenMemo ?? true;
            setBottomPriceLockedItem(null);
            setPendingCheckoutOpenMemo(null);
            showToast('Owner PIN verified. Completing authorized sale...', 'success');
            void handleCompleteSale(resumeOpenMemo, nextOverrides, nextTokens);
          }}
        />
      )}

      {/* Split Payment Modal */}
      {splitModalOpen && (
        <SplitPaymentModal
          isOpen={splitModalOpen}
          onClose={() => setSplitModalOpen(false)}
          totalAmount={paymentMode === 'partial' ? effectiveAdvance : finalTotal}
          initialBreakdown={splitBreakdown}
          isPartialAdvance={paymentMode === 'partial'}
          maxBillTotal={finalTotal}
          onConfirm={(breakdown, confirmedTargetAmount) => {
            setSplitBreakdown(breakdown);
            if (paymentMode === 'partial') {
              setAdvancePaid(confirmedTargetAmount);
            }
            showToast(`Split Payment সেট হয়েছে: ${formatSplitSummaryText(breakdown)}`, 'info');
          }}
        />
      )}

      {/* Universal Multi-Variant Product & Stock Form Modal (Supports BOTH Clothing & Sportswear) */}
      {productModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-3xl max-w-2xl w-full p-5 sm:p-6 shadow-2xl space-y-4 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-zinc-800">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-[#e6f4ea] text-[#164e3f] flex items-center justify-center">
                  <Package className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-white">
                    {editingProduct
                      ? 'পণ্য, ভ্যারিয়েন্ট ও স্টক এডিট করুন (Edit Product & Variants)'
                      : 'নতুন পণ্য ও ভ্যারিয়েন্ট যোগ করুন (Add Multi-Variant Product)'}
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-zinc-400">
                    কালার, সাইজ, বারকোড/SKU এবং স্টক পরিমাণ নির্ধারণ করুন ({currentTenant.name})
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setProductModalOpen(false)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveClothingProduct} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 dark:text-zinc-300 mb-1">
                    {isClothingStore ? "Men's Clothing Category *" : 'Sportswear / Kit Category *'}
                  </label>
                  <select
                    value={prodCategory}
                    onChange={(e) => handleProdCategoryChange(e.target.value as MenClothingCategory)}
                    className="w-full bg-slate-50 dark:bg-zinc-950 border border-slate-300 dark:border-zinc-800 rounded-xl px-3 py-2.5 text-slate-900 dark:text-white font-semibold focus:outline-none focus:border-[#164e3f]"
                  >
                    {isClothingStore
                      ? clothingCategories.map((cat) => (
                          <option key={cat.id} value={cat.name}>
                            {cat.name} {cat.nameBn ? `(${cat.nameBn})` : ''}
                          </option>
                        ))
                      : kitCategories.map((kc) => (
                          <option key={kc.id} value={kc.name}>
                            {kc.name}
                          </option>
                        ))}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 dark:text-zinc-300 mb-1">
                    {isClothingStore ? 'Sub-Category / Brand' : 'Club / Country / Edition'}
                  </label>
                  <input
                    type="text"
                    value={prodSubCategory}
                    onChange={(e) => setProdSubCategory(e.target.value)}
                    placeholder={isClothingStore ? 'যেমন: Formal Shirt / Chino' : 'যেমন: Argentina / Real Madrid'}
                    className="w-full bg-slate-50 dark:bg-zinc-950 border border-slate-300 dark:border-zinc-800 rounded-xl px-3 py-2.5 text-slate-900 dark:text-white focus:outline-none focus:border-[#164e3f]"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 dark:text-zinc-300 mb-1">
                    Primary Color / রঙ
                  </label>
                  <input
                    type="text"
                    value={prodColor}
                    onChange={(e) => setProdColor(e.target.value)}
                    placeholder="যেমন: Black / White / Navy"
                    className="w-full bg-slate-50 dark:bg-zinc-950 border border-slate-300 dark:border-zinc-800 rounded-xl px-3 py-2.5 text-slate-900 dark:text-white focus:outline-none focus:border-[#164e3f]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="block font-bold text-slate-700 dark:text-zinc-300 mb-1">
                    Product Name (পণ্যের নাম) *
                  </label>
                  <input
                    type="text"
                    required
                    value={prodName}
                    onChange={(e) => setProdName(e.target.value)}
                    placeholder={
                      isClothingStore
                        ? 'যেমন: Men Formal Cotton Shirt (White)'
                        : 'যেমন: Real Madrid Home Player Issue 24/25'
                    }
                    className="w-full bg-slate-50 dark:bg-zinc-950 border border-slate-300 dark:border-zinc-800 rounded-xl px-3 py-2.5 text-slate-900 dark:text-white font-semibold focus:outline-none focus:border-[#164e3f]"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 dark:text-zinc-300 mb-1">
                    SKU / Barcode *
                  </label>
                  <input
                    type="text"
                    required
                    value={prodSku}
                    onChange={(e) => setProdSku(e.target.value)}
                    placeholder="SKU-101"
                    className="w-full bg-slate-50 dark:bg-zinc-950 border border-slate-300 dark:border-zinc-800 rounded-xl px-3 py-2.5 font-mono text-slate-900 dark:text-white focus:outline-none focus:border-[#164e3f]"
                  />
                </div>
              </div>

              <div className={`grid ${showBuyingPrice ? 'grid-cols-3' : 'grid-cols-2'} gap-3`}>
                {showBuyingPrice && (
                  <div>
                    <label className="block font-bold text-slate-700 dark:text-zinc-300 mb-1">
                      Buying Cost (ক্রয়মূল্য ৳) *
                    </label>
                    <input
                      type="number"
                      min={0}
                      required
                      value={prodCost}
                      onChange={(e) => setProdCost(Number(e.target.value))}
                      className="w-full bg-slate-50 dark:bg-zinc-950 border border-slate-300 dark:border-zinc-800 rounded-xl px-3 py-2 font-mono font-bold text-slate-900 dark:text-white"
                    />
                  </div>
                )}

                <div>
                  <label className="block font-bold text-slate-700 dark:text-zinc-300 mb-1">
                    Selling MRP (বিক্রয়মূল্য ৳) *
                  </label>
                  <input
                    type="number"
                    min={0}
                    required
                    value={prodMrp}
                    onChange={(e) => setProdMrp(Number(e.target.value))}
                    className="w-full bg-slate-50 dark:bg-zinc-950 border border-slate-300 dark:border-zinc-800 rounded-xl px-3 py-2 font-mono font-bold text-[#164e3f] dark:text-emerald-400"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 dark:text-zinc-300 mb-1">
                    Bottom Price (সর্বনিম্ন দর ৳) *
                  </label>
                  <input
                    type="number"
                    min={0}
                    required
                    value={prodBottom}
                    onChange={(e) => setProdBottom(Number(e.target.value))}
                    className="w-full bg-slate-50 dark:bg-zinc-950 border border-slate-300 dark:border-zinc-800 rounded-xl px-3 py-2 font-mono font-bold text-amber-600"
                  />
                </div>
              </div>

              {/* Optional Compressed Product Image Upload (Phase 7) */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-2xl bg-[#f4f7f5] dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800">
                <div className="flex items-center gap-2.5">
                  {prodImageUrl ? (
                    <img
                      src={prodImageUrl}
                      alt="Preview"
                      className="w-11 h-11 rounded-xl object-cover border border-slate-300"
                    />
                  ) : (
                    <div className="w-11 h-11 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-slate-400">
                      <ImageIcon className="w-5 h-5" />
                    </div>
                  )}
                  <div>
                    <div className="font-bold text-slate-800 dark:text-zinc-200">
                      Product Thumbnail Image (অপ্টিমাইজড থাম্বনেইল ছবি - ঐচ্ছিক)
                    </div>
                    <div className="text-[11px] text-slate-500">
                      JPG/PNG/WebP (স্বয়ংক্রিয়ভাবে WebP থাম্বনেইলে কম্প্রেস হবে)
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <label className="px-3 py-1.5 rounded-xl bg-white border border-slate-300 text-slate-700 font-bold cursor-pointer hover:border-[#164e3f]">
                    <span>ছবি নির্বাচন</span>
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      onChange={handleProdImageUpload}
                      className="hidden"
                    />
                  </label>
                  {prodImageUrl && (
                    <button
                      type="button"
                      onClick={() => setProdImageUrl('')}
                      className="text-rose-600 font-bold underline cursor-pointer"
                    >
                      মুছুন
                    </button>
                  )}
                </div>
              </div>

              {/* Multi-Variant Color + Size Matrix & Stock Quantities */}
              <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-800 dark:text-zinc-200">
                    Per-Variant Stock & Color/Size Matrix (ভ্যারিয়েন্টভিত্তিক স্টক)
                  </span>
                  <span className="text-[11px] font-bold text-[#164e3f]">
                    মোট সক্রিয় স্টক:{' '}
                    {prodVariants
                      .filter((v) => v.isActive !== false)
                      .reduce((s, v) => s + (Number(v.stock) || 0), 0)}{' '}
                    pcs
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {prodVariants.map((variant, idx) => (
                    <div
                      key={`${variant.size}_${variant.color || ''}_${idx}`}
                      className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl p-2.5 space-y-1.5"
                    >
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-[11px] font-extrabold text-slate-800 dark:text-zinc-200">
                          {variant.size}
                        </span>
                        <input
                          type="text"
                          value={variant.color ?? prodColor}
                          onChange={(e) => {
                            const nextColor = e.target.value;
                            setProdVariants((prev) =>
                              prev.map((v, i) => (i === idx ? { ...v, color: nextColor } : v))
                            );
                          }}
                          placeholder="Color"
                          className="w-20 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-700 rounded-lg px-1.5 py-0.5 text-[10px] text-slate-700 dark:text-zinc-300"
                        />
                      </div>
                      <div className="flex items-center justify-between gap-1.5">
                        <span className="text-[10px] text-slate-400">Stock:</span>
                        <input
                          type="number"
                          min={0}
                          value={variant.stock}
                          onChange={(e) => {
                            const val = Math.max(0, Number(e.target.value) || 0);
                            setProdVariants((prev) =>
                              prev.map((v, i) => (i === idx ? { ...v, stock: val } : v))
                            );
                          }}
                          className="w-20 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-700 rounded-lg py-1 px-2 text-center font-mono font-bold text-slate-900 dark:text-white"
                        />
                      </div>
                    </div>
                  ))}
                </div>

                {/* Add Extra Color/Size Variant Row */}
                <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-200/70">
                  <input
                    type="text"
                    value={customVariantColor}
                    onChange={(e) => setCustomVariantColor(e.target.value)}
                    placeholder="নতুন কালার (যেমন: Navy)"
                    className="bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs"
                  />
                  <input
                    type="text"
                    value={customVariantSize}
                    onChange={(e) => setCustomVariantSize(e.target.value)}
                    placeholder="নতুন সাইজ (যেমন: 3XL / 40)"
                    className="bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs"
                  />
                  <button
                    type="button"
                    onClick={handleAddCustomVariantToModal}
                    className="px-3 py-1.5 rounded-xl bg-[#e6f4ea] text-[#164e3f] font-bold text-xs cursor-pointer"
                  >
                    + ভ্যারিয়েন্ট যোগ করুন
                  </button>
                </div>

                {editingProduct && (
                  <div className="pt-2">
                    <label className="block font-bold text-slate-700 dark:text-zinc-300 mb-1">
                      স্টক পরিবর্তনের কারণ (Stock Adjustment Audit Reason) *
                    </label>
                    <input
                      type="text"
                      value={prodEditReason}
                      onChange={(e) => setProdEditReason(e.target.value)}
                      placeholder="যেমন: ভুলবশত ৪০টি এন্ট্রি হয়েছিল, প্রকৃত স্টক ৩০টি"
                      className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-slate-900"
                    />
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setProductModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl border border-slate-300 dark:border-zinc-700 text-slate-700 dark:text-zinc-300 font-semibold cursor-pointer"
                >
                  বাতিল (Cancel)
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-[#164e3f] hover:bg-[#113f32] text-white font-bold cursor-pointer shadow-xs"
                >
                  {editingProduct ? 'আপডেট সংরক্ষণ করুন' : 'ইনভেন্টরিতে সেভ করুন'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* PHASE 2: PHYSICAL STOCK CORRECTION & AUDIT LEDGER MODAL */}
      {stockLedgerModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-3xl max-w-3xl w-full p-5 sm:p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-zinc-800">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-[#e6f4ea] text-[#164e3f] flex items-center justify-center">
                  <Sliders className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-white">
                    স্টক সংশোধন ও অডিট লেজার (Physical Stock Correction & Ledger)
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    ভুল স্টক এন্ট্রি সংশোধন করুন (যেমন: ৪০টির জায়গায় ৩০টি) — পূর্বের ও নতুন স্টকের পূর্ণ অডিট রেকর্ড থাকবে
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setStockLedgerModalOpen(false)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form
              onSubmit={handleSubmitStockCorrection}
              className="bg-[#f4f7f5] dark:bg-zinc-800/50 border border-slate-200 dark:border-zinc-800 rounded-2xl p-4 space-y-3 text-xs"
            >
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 dark:text-zinc-300 mb-1">
                    পণ্য নির্বাচন করুন (Select Product) *
                  </label>
                  <select
                    value={stockTargetProductId}
                    onChange={(e) => {
                      const pid = e.target.value;
                      setStockTargetProductId(pid);
                      const found = catalog.find((p) => p.id === pid);
                      const fv = found?.variants?.[0];
                      if (fv) {
                        setStockTargetVariantKey(`${fv.size}::${fv.color || ''}`);
                        setStockNewQty(fv.stock);
                      }
                    }}
                    className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 font-semibold text-slate-900"
                  >
                    {catalog.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.sku})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 dark:text-zinc-300 mb-1">
                    ভ্যারিয়েন্ট (Size / Color) *
                  </label>
                  <select
                    value={stockTargetVariantKey}
                    onChange={(e) => {
                      const vk = e.target.value;
                      setStockTargetVariantKey(vk);
                      const found = catalog.find((p) => p.id === stockTargetProductId);
                      const [sz, clr] = vk.split('::');
                      const mv = found?.variants?.find(
                        (v) => v.size === sz && (v.color || '') === (clr || '')
                      );
                      if (mv) setStockNewQty(mv.stock);
                    }}
                    className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 font-semibold text-slate-900"
                  >
                    {(catalog.find((p) => p.id === stockTargetProductId)?.variants || []).map(
                      (v, i) => (
                        <option key={`${v.size}_${v.color || i}`} value={`${v.size}::${v.color || ''}`}>
                          {v.size} {v.color ? `(${v.color})` : ''} — বর্তমান স্টক: {v.stock} pcs
                        </option>
                      )
                    )}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 dark:text-zinc-300 mb-1">
                    প্রকৃত স্টক সংখ্যা (Actual Physical Stock) *
                  </label>
                  <input
                    type="number"
                    min={0}
                    required
                    value={stockNewQty}
                    onChange={(e) => setStockNewQty(Math.max(0, Number(e.target.value) || 0))}
                    className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 font-mono font-bold text-slate-900"
                  />
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-3 items-end">
                <div className="flex-1 w-full">
                  <label className="block font-bold text-slate-700 dark:text-zinc-300 mb-1">
                    সংশোধনের কারণ (Reason for Correction) *
                  </label>
                  <input
                    type="text"
                    required
                    value={stockCorrectionReason}
                    onChange={(e) => setStockCorrectionReason(e.target.value)}
                    placeholder="যেমন: স্টকে ৪০টি ভুল এন্ট্রি হয়েছিল, গণনায় ৩০টি পাওয়া গেছে"
                    className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-slate-900"
                  />
                </div>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-[#164e3f] hover:bg-[#113f32] text-white font-bold shrink-0 cursor-pointer"
                >
                  স্টক সংশোধন নিশ্চিত করুন
                </button>
              </div>
            </form>

            {/* Stock Adjustment Audit History Table */}
            <div className="space-y-2">
              <div className="text-xs font-extrabold text-slate-800 dark:text-zinc-200 flex items-center justify-between">
                <span>সাম্প্রতিক স্টক মুভমেন্ট ও সংশোধন ইতিহাস ({stockAdjustments.length})</span>
                <span className="text-[11px] text-slate-400">Shop ID: {currentTenant.id}</span>
              </div>

              <div className="max-h-64 overflow-y-auto border border-slate-200 dark:border-zinc-800 rounded-2xl">
                {stockAdjustments.length === 0 ? (
                  <div className="p-6 text-center text-xs text-slate-400">
                    এখনো কোনো স্টক সংশোধন বা মুভমেন্ট রেকর্ড হয়নি।
                  </div>
                ) : (
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 dark:bg-zinc-800 text-slate-500 border-b border-slate-200">
                      <tr>
                        <th className="py-2 px-3">সময়</th>
                        <th className="py-2 px-3">পণ্য ও ভ্যারিয়েন্ট</th>
                        <th className="py-2 px-3">ধরন</th>
                        <th className="py-2 px-3 text-right">পূর্বের → নতুন</th>
                        <th className="py-2 px-3">কারণ ও ইউজার</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
                      {stockAdjustments.slice(0, 30).map((adj) => (
                        <tr key={adj.id} className="hover:bg-slate-50/70">
                          <td className="py-2 px-3 text-[11px] text-slate-500 whitespace-nowrap">
                            {new Date(adj.timestamp).toLocaleString('en-GB', {
                              day: '2-digit',
                              month: 'short',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </td>
                          <td className="py-2 px-3 font-semibold text-slate-900 dark:text-white">
                            {adj.productName}{' '}
                            <span className="text-[11px] text-[#164e3f] font-bold">
                              ({adj.color ? `${adj.color}/` : ''}
                              {adj.size})
                            </span>
                          </td>
                          <td className="py-2 px-3">
                            <span
                              className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                                adj.movementType === 'manual_correction'
                                  ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                  : adj.movementType === 'return'
                                  ? 'bg-sky-50 text-sky-700 border border-sky-200'
                                  : 'bg-[#e6f4ea] text-[#164e3f]'
                              }`}
                            >
                              {adj.movementType}
                            </span>
                          </td>
                          <td className="py-2 px-3 text-right font-mono font-bold">
                            {adj.previousQty} → {adj.newQty}{' '}
                            <span
                              className={
                                adj.difference >= 0 ? 'text-emerald-600' : 'text-rose-600'
                              }
                            >
                              ({adj.difference >= 0 ? `+${adj.difference}` : adj.difference})
                            </span>
                          </td>
                          <td className="py-2 px-3 text-[11px] text-slate-600">
                            <div>{adj.reason}</div>
                            <div className="text-[10px] text-slate-400">By: {adj.responsibleUser}</div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* PHASE 3: FULL SHOP-SCOPED CUSTOMER HISTORY & LOYALTY MODAL */}
      {customerHistoryModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-3xl max-w-2xl w-full p-5 sm:p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-zinc-800">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-[#e6f4ea] text-[#164e3f] flex items-center justify-center font-extrabold">
                  <History className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                    {customerHistory.customerName || customerName} ({customerHistory.phone})
                  </h3>
                  <p className="text-xs text-slate-500">
                    শুধুমাত্র {currentTenant.name}-এর ক্রয় ও লয়্যালটি ইতিহাস (Strictly Isolated)
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setCustomerHistoryModalOpen(false)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
              <div className="p-3 rounded-2xl bg-[#f4f7f5] border border-slate-200/70">
                <div className="text-slate-500">মোট ইনভয়েস</div>
                <div className="text-base font-extrabold text-slate-900 mt-0.5">
                  {customerHistory.invoiceCount} টি
                </div>
              </div>
              <div className="p-3 rounded-2xl bg-[#f4f7f5] border border-slate-200/70">
                <div className="text-slate-500">মোট ক্রয়</div>
                <div className="text-base font-extrabold text-[#164e3f] font-mono mt-0.5">
                  ৳{customerHistory.totalSpent.toLocaleString()}
                </div>
              </div>
              <div className="p-3 rounded-2xl bg-[#f4f7f5] border border-slate-200/70">
                <div className="text-slate-500">বর্তমান বকেয়া</div>
                <div className="text-base font-extrabold text-rose-600 font-mono mt-0.5">
                  ৳{customerHistory.totalDue.toLocaleString()}
                </div>
              </div>
              <div className="p-3 rounded-2xl bg-[#e6f4ea] border border-emerald-200">
                <div className="text-[#164e3f] font-semibold">লয়্যালটি পয়েন্ট</div>
                <div className="text-base font-extrabold text-[#164e3f] font-mono mt-0.5">
                  {customerHistory.loyaltyPoints} pts
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <h4 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider">
                পূর্ববর্তী ইনভয়েস ও ক্রয়কৃত পণ্য ({customerHistory.invoices.length})
              </h4>
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {customerHistory.invoices.map((inv) => (
                  <div
                    key={inv.id}
                    className="p-3 rounded-2xl bg-[#f4f7f5] border border-slate-200/70 flex items-center justify-between gap-2 text-xs"
                  >
                    <div>
                      <div className="font-bold text-slate-900">
                        #{inv.invoiceNo} •{' '}
                        {new Date(inv.createdAt).toLocaleDateString('en-GB', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5">
                        {(inv.items || [])
                          .map((it) => `${it.title} (${it.size}) ×${it.quantity}`)
                          .join(', ')}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="font-mono font-extrabold text-[#164e3f]">৳{inv.total}</div>
                      {inv.dueAmount > 0 && (
                        <div className="text-[10px] font-bold text-rose-600">
                          বকেয়া: ৳{inv.dueAmount}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {customerHistory.loyaltyHistory.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider">
                  লয়্যালটি পয়েন্ট লেনদেন ({customerHistory.loyaltyHistory.length})
                </h4>
                <div className="space-y-1.5 max-h-40 overflow-y-auto">
                  {customerHistory.loyaltyHistory.map((ltx) => (
                    <div
                      key={ltx.id}
                      className="px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between text-xs"
                    >
                      <div>
                        <span className="font-bold text-slate-800">{ltx.note}</span>
                        <span className="text-[10px] text-slate-400 ml-2">
                          ({new Date(ltx.timestamp).toLocaleDateString('en-GB')})
                        </span>
                      </div>
                      <span
                        className={`font-mono font-bold ${
                          ltx.type === 'earn' ? 'text-emerald-700' : 'text-rose-600'
                        }`}
                      >
                        {ltx.type === 'earn' ? `+${ltx.points}` : `-${ltx.points}`} pts (Bal:{' '}
                        {ltx.balanceAfter})
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
