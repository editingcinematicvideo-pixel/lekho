import React, { useState, useEffect, useMemo } from 'react';
import {
  Package,
  Plus,
  Search,
  Edit3,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  History,
  Save,
  X,
  Image as ImageIcon,
  Layers,
  Tag,
  SlidersHorizontal,
  ArrowRight,
  Power,
  ShieldCheck,
  RefreshCw,
  Eye,
  EyeOff,
  ChevronRight,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { BottomSheet } from '../ui/BottomSheet';
import { InfoTooltip } from '../ui/InfoTooltip';
import { dbService } from '../../services/db';
import {
  ApparelMatrixVariant,
  InventoryItem,
  JerseyCategory,
  MenClothingCategory,
  StockAdjustmentRecord,
} from '../../types';
import { canViewBuyingPrice, isClothingShop } from '../../utils/securityPolicy';
import {
  buildVariantId,
  generateBatchVariants,
  validateProductFormInput,
  buildProductEditStockAdjustments,
} from '../../utils/inventoryLoyaltyReportsEngine';
import { compressProductImageFile, validateProductImageFile } from '../../utils/imageOptimization';

interface ProductVariantCatalogManagerProps {
  mode: 'categories_settings' | 'inventory_page';
  onNavigate?: (tab: string, subtab?: string) => void;
}

const CLOTHING_SIZE_PRESETS = ['S', 'M', 'L', 'XL', 'XXL'];
const WAIST_SIZE_PRESETS = ['28-Reg', '30-Reg', '32-Reg', '34-Reg', '36-Reg', '38-Reg'];
const PANJABI_SIZE_PRESETS = ['38', '40', '42', '44', '46'];
const JERSEY_SIZE_PRESETS = ['S', 'M', 'L', 'XL', 'XXL', '3XL'];
const KIDS_JERSEY_SIZE_PRESETS = ['24', '26', '28', '30'];

const QUICK_COLOR_SUGGESTIONS_CLOTHING = ['Black', 'White', 'Navy', 'Olive', 'Maroon', 'Grey', 'Sky Blue', 'Beige'];
const QUICK_COLOR_SUGGESTIONS_SPORTS = ['Home', 'Away', 'Third Kit', 'Black', 'White', 'Red', 'Blue', 'Yellow'];

const STOCK_CORRECTION_REASONS = [
  'Physical Stock Count Correction (গণনায় ভুল সংশোধন)',
  'Initial Stock Entry Mistake (স্টক এন্ট্রি ভুল সংশোধন)',
  'Damaged / Defective Item (ত্রুটিপূর্ণ পণ্য বাদ)',
  'New Restock / Purchase Received (নতুন মাল আগমন)',
  'Supplier Return (মহাজনকে ফেরত)',
  'Sample / Display Piece (ডিসপ্লে পিস)',
];

export const ProductVariantCatalogManager: React.FC<ProductVariantCatalogManagerProps> = ({
  mode,
  onNavigate,
}) => {
  const { currentTenant, role, activeStaff, showToast, reloadShopData, pickText } = useApp();
  const isClothingStore = isClothingShop(currentTenant);
  const showBuyingCost = canViewBuyingPrice(role);

  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [stockAdjustments, setStockAdjustments] = useState<StockAdjustmentRecord[]>([]);
  const [inventoryTrackingEnabled, setInventoryTrackingEnabled] = useState<boolean>(true);
  const [lowStockThreshold, setLowStockThreshold] = useState<number>(5);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [stockStatusFilter, setStockStatusFilter] = useState<'ALL' | 'IN_STOCK' | 'LOW_STOCK' | 'OUT_OF_STOCK' | 'INACTIVE'>('ALL');
  const [ledgerFilter, setLedgerFilter] = useState<'ALL' | 'sale' | 'return' | 'manual_correction'>('ALL');
  const [isLedgerModalOpen, setIsLedgerModalOpen] = useState(false);
  const [mobileVariantSheetProduct, setMobileVariantSheetProduct] = useState<InventoryItem | null>(null);

  // Product Add/Edit Full-Screen Workspace State
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<InventoryItem | null>(null);
  const [prodName, setProdName] = useState('');
  const [prodCategory, setProdCategory] = useState('');
  const [prodSubCategory, setProdSubCategory] = useState('');
  const [prodDescription, setProdDescription] = useState('');
  const [prodSku, setProdSku] = useState('');
  const [prodColor, setProdColor] = useState('Black');
  const [prodImageUrl, setProdImageUrl] = useState('');
  const [prodIsActive, setProdIsActive] = useState(true);
  const [prodBaseCost, setProdBaseCost] = useState<number>(250);
  const [prodBaseMrp, setProdBaseMrp] = useState<number>(400);
  const [prodBaseFloor, setProdBaseFloor] = useState<number>(350);
  const [prodVariants, setProdVariants] = useState<ApparelMatrixVariant[]>([]);
  const [quickBatchStock, setQuickBatchStock] = useState<number>(20);
  const [customSizesInput, setCustomSizesInput] = useState<string>('');
  const [editStockReason, setEditStockReason] = useState<string>(STOCK_CORRECTION_REASONS[0]);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [imageErrorMsg, setImageErrorMsg] = useState<string>('');
  const [isSavingProduct, setIsSavingProduct] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [showUnsavedCloseConfirm, setShowUnsavedCloseConfirm] = useState(false);
  const [showValidationErrors, setShowValidationErrors] = useState(false);
  const [pendingVariantRemovalIdx, setPendingVariantRemovalIdx] = useState<number | null>(null);
  const [pendingBatchApplyConfirm, setPendingBatchApplyConfirm] = useState(false);

  // Stock Correction Modal State
  const [correctionTarget, setCorrectionTarget] = useState<{
    product: InventoryItem;
    variant: ApparelMatrixVariant;
  } | null>(null);
  const [correctionNewQty, setCorrectionNewQty] = useState<number>(0);
  const [correctionReasonPreset, setCorrectionReasonPreset] = useState<string>(STOCK_CORRECTION_REASONS[0]);
  const [correctionCustomReason, setCorrectionCustomReason] = useState<string>('');

  const loadData = () => {
    if (!currentTenant) return;
    const items = dbService.getInventory(currentTenant.id, role);
    setInventory(items);
    setStockAdjustments(dbService.getStockAdjustments(currentTenant.id));
    const cfg = dbService.getStoreConfig(currentTenant.id);
    setInventoryTrackingEnabled(
      cfg.inventoryTrackingEnabled !== false && cfg.autoDeductStockOnConfirm !== false
    );
    setLowStockThreshold(cfg.lowStockThreshold || 5);
  };

  useEffect(() => {
    loadData();
    const handleStorageUpdate = () => loadData();
    window.addEventListener('lekho-storage-updated', handleStorageUpdate);
    return () => window.removeEventListener('lekho-storage-updated', handleStorageUpdate);
  }, [currentTenant?.id, role]);

  // Available categories from existing Categories & Price settings
  const availableCategories = useMemo(() => {
    if (!currentTenant) return [];
    if (isClothingStore) {
      const cats = dbService.getClothingCategories(currentTenant.id, role);
      return cats.map((c) => c.name);
    } else {
      const kitCats = dbService.getKitCategories(currentTenant.id, role).map((c) => c.name);
      const otherCats = dbService.getOtherCategories(currentTenant.id, role).map((c) => c.name);
      return Array.from(new Set([...kitCats, ...otherCats]));
    }
  }, [currentTenant?.id, isClothingStore, role]);

  const getRecommendedSizePresetForCategory = (catName: string): string[] => {
    const lower = (catName || '').toLowerCase();
    if (isClothingStore) {
      if (
        lower.includes('pant') ||
        lower.includes('jeans') ||
        lower.includes('denim') ||
        lower.includes('trouser') ||
        lower.includes('cargo') ||
        lower.includes('chino') ||
        lower.includes('gabardine')
      ) {
        return WAIST_SIZE_PRESETS;
      }
      if (lower.includes('panjabi') || lower.includes('sherwani') || lower.includes('kabli')) {
        return PANJABI_SIZE_PRESETS;
      }
      return CLOTHING_SIZE_PRESETS;
    }
    return JERSEY_SIZE_PRESETS;
  };

  const handleToggleInventoryTracking = (nextState: boolean) => {
    if (!currentTenant) return;
    if (!showBuyingCost) {
      showToast('শুধুমাত্র শপ ওনার ইনভেন্টরি ট্র্যাকিং চালু বা বন্ধ করতে পারবেন।', 'warning');
      return;
    }
    try {
      dbService.setInventoryTrackingEnabled(currentTenant.id, nextState, role);
      setInventoryTrackingEnabled(nextState);
      reloadShopData();
      showToast(
        nextState
          ? 'Inventory Tracking চালু করা হয়েছে — POS বিক্রয়ে অটো স্টক বিয়োগ হবে।'
          : 'Inventory Tracking বন্ধ করা হয়েছে — POS এ স্টক ছাড়া দ্রুত বিলিং করা যাবে।',
        'success'
      );
    } catch (err: any) {
      showToast(err?.message || 'সেটিংস সংরক্ষণ করা যায়নি', 'error');
    }
  };

  const openAddProductModal = () => {
    const defaultCat =
      availableCategories[0] || (isClothingStore ? 'T-Shirt' : 'Player Issue');
    const defaultColor = isClothingStore ? 'Black' : 'Home';
    const defaultCost = isClothingStore ? 250 : 620;
    const defaultMrp = isClothingStore ? 400 : 1150;
    const defaultFloor = isClothingStore ? 350 : 950;
    const defaultBatchStock = 20;
    const generatedSku = `${isClothingStore ? 'CLT' : 'SPT'}-${Math.floor(1000 + Math.random() * 9000)}`;
    const initialSizes = ['M', 'L', 'XL'];

    const batchResult = generateBatchVariants({
      existingVariants: [],
      sizes: initialSizes,
      color: defaultColor,
      baseSku: generatedSku,
      batchStock: defaultBatchStock,
      costPrice: defaultCost,
      mrp: defaultMrp,
      bottomPrice: defaultFloor,
      productId: 'new',
    });

    setEditingProduct(null);
    setProdName('');
    setProdCategory(defaultCat);
    setProdSubCategory(isClothingStore ? 'In-House Brand' : '2024/25');
    setProdDescription('');
    setProdSku(generatedSku);
    setProdColor(defaultColor);
    setProdImageUrl('');
    setProdIsActive(true);
    setProdBaseCost(defaultCost);
    setProdBaseMrp(defaultMrp);
    setProdBaseFloor(defaultFloor);
    setQuickBatchStock(defaultBatchStock);
    setCustomSizesInput('');
    setEditStockReason(STOCK_CORRECTION_REASONS[0]);
    setImageErrorMsg('');
    setIsSavingProduct(false);
    setHasUnsavedChanges(false);
    setShowUnsavedCloseConfirm(false);
    setShowValidationErrors(false);
    setPendingVariantRemovalIdx(null);
    setPendingBatchApplyConfirm(false);
    setProdVariants(batchResult.nextVariants);
    setIsProductModalOpen(true);
  };

  const openEditProductModal = (item: InventoryItem) => {
    const prodCat = isClothingStore
      ? item.clothingCategory || 'T-Shirt'
      : item.jerseyCategory || item.subCategory || 'Player Issue';

    setEditingProduct(item);
    setProdName(item.name);
    setProdCategory(prodCat);
    setProdSubCategory(
      isClothingStore
        ? item.subCategory || 'In-House Brand'
        : item.clubOrCountry || item.season || '2024/25'
    );
    setProdDescription(item.description || '');
    setProdSku(item.sku || '');
    setProdColor(item.color || item.variants?.[0]?.color || 'Black');
    setProdImageUrl(item.imageUrl || '');
    setProdIsActive(item.isActive !== false);
    setProdBaseCost(item.lotCostLandingPrice || item.variants?.[0]?.costPrice || 0);
    setProdBaseMrp(item.mrp || item.variants?.[0]?.mrp || 0);
    setProdBaseFloor(item.bottomPrice || item.variants?.[0]?.bottomPrice || 0);
    // Do NOT overwrite existing variant stocks with quickBatchStock when opening edit modal
    setQuickBatchStock(20);
    setCustomSizesInput('');
    setEditStockReason(STOCK_CORRECTION_REASONS[0]);
    setImageErrorMsg('');
    setIsSavingProduct(false);
    setHasUnsavedChanges(false);
    setShowUnsavedCloseConfirm(false);
    setShowValidationErrors(false);
    setPendingVariantRemovalIdx(null);
    setPendingBatchApplyConfirm(false);
    setProdVariants(
      (item.variants || []).map((v) => ({
        ...v,
        color: v.color || item.color || 'Default',
        sku: v.sku || `${item.sku}-${v.size}`,
        isActive: v.isActive !== false,
      }))
    );
    setIsProductModalOpen(true);
  };

  const handleRequestCloseProductModal = () => {
    if (hasUnsavedChanges) {
      setShowUnsavedCloseConfirm(true);
      return;
    }
    setIsProductModalOpen(false);
    setShowUnsavedCloseConfirm(false);
  };

  const handleAddSingleVariantRow = () => {
    const nextColor = prodColor.trim() || 'Black';
    const candidateSizes = ['M', 'L', 'XL', 'XXL', 'S', '3XL', 'Free Size'];
    const existingForColor = new Set(
      prodVariants
        .filter((v) => (v.color || '').trim().toLowerCase() === nextColor.toLowerCase())
        .map((v) => v.size.trim().toUpperCase())
    );
    const chosenSize =
      candidateSizes.find((s) => !existingForColor.has(s.toUpperCase())) ||
      `SZ-${prodVariants.length + 1}`;
    const cleanSku = prodSku.trim().toUpperCase() || 'PRD';
    const colorCode =
      nextColor
        .replace(/[^a-zA-Z0-9]/g, '')
        .slice(0, 3)
        .toUpperCase() || 'CLR';

    setHasUnsavedChanges(true);
    setProdVariants((prev) => [
      ...prev,
      {
        id: `var_${Date.now()}_${prev.length + 1}`,
        color: nextColor,
        size: chosenSize,
        sku: `${cleanSku}-${colorCode}-${chosenSize}-${prev.length + 1}`,
        stock: Math.max(0, Math.floor(Number(quickBatchStock) || 0)),
        costPrice: prodBaseCost,
        mrp: prodBaseMrp,
        bottomPrice: prodBaseFloor,
        isActive: true,
      },
    ]);
  };

  const handleAddColorSizeBatch = (sizes: string[], batchColor?: string) => {
    const targetColor = (batchColor || prodColor || 'Black').trim() || 'Black';
    const cleanSku = prodSku.trim() || 'PRD';
    const perVariantStock = Math.max(0, Math.floor(Number(quickBatchStock) || 0));

    const result = generateBatchVariants({
      existingVariants: prodVariants,
      sizes,
      color: targetColor,
      baseSku: cleanSku,
      batchStock: perVariantStock,
      costPrice: prodBaseCost,
      mrp: prodBaseMrp,
      bottomPrice: prodBaseFloor,
      productId: editingProduct?.id || 'new',
    });

    if (result.addedCount === 0 && result.skippedExistingCount > 0) {
      showToast(
        `"${targetColor}" কালারের এই সাইজগুলো ইতিমধ্যে তালিকায় আছে — আগের স্টক পরিবর্তন করা হয়নি।`,
        'info'
      );
      return;
    }

    setHasUnsavedChanges(true);
    setProdVariants(result.nextVariants);
    if (result.addedCount > 0) {
      showToast(
        `"${targetColor}" কালারের ${result.addedCount}টি নতুন ভ্যারিয়েন্টে প্রতিটিতে ${perVariantStock} পিস করে (মোট +${result.addedCount * perVariantStock} পিস) যোগ হয়েছে।`,
        'success'
      );
    }
  };

  const handleAddCustomSizesBatch = () => {
    const parsedSizes = customSizesInput
      .split(/[,/]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (parsedSizes.length === 0) {
      showToast('কাস্টম সাইজ লিখুন (যেমন: 3XL, 4XL বা 48)', 'warning');
      return;
    }
    handleAddColorSizeBatch(parsedSizes, prodColor);
    setCustomSizesInput('');
  };

  const handleConfirmApplyDefaultsToAllVariants = () => {
    const perVariantStock = Math.max(0, Math.floor(Number(quickBatchStock) || 0));
    setHasUnsavedChanges(true);
    setProdVariants((prev) =>
      prev.map((v) => ({
        ...v,
        costPrice: showBuyingCost ? prodBaseCost : v.costPrice,
        mrp: prodBaseMrp,
        bottomPrice: prodBaseFloor,
        stock: perVariantStock,
      }))
    );
    setPendingBatchApplyConfirm(false);
    showToast(
      `সকল ভ্যারিয়েন্টে ডিফল্ট মূল্য ও প্রতিটিতে ${perVariantStock} পিস স্টক প্রয়োগ করা হয়েছে।`,
      'info'
    );
  };

  const handleUpdateVariantField = (
    idx: number,
    field: keyof ApparelMatrixVariant,
    value: string | number | boolean
  ) => {
    setHasUnsavedChanges(true);
    setProdVariants((prev) =>
      prev.map((v, i) => (i === idx ? { ...v, [field]: value } : v))
    );
  };

  const handleRemoveVariantRow = (idx: number) => {
    if (prodVariants.length <= 1) {
      showToast('প্রোডাক্টে কমপক্ষে ১টি ভ্যারিয়েন্ট থাকা আবশ্যক।', 'warning');
      return;
    }
    const targetVar = prodVariants[idx];
    const isExistingSavedVariant =
      editingProduct &&
      editingProduct.variants.some(
        (ev) =>
          (ev.id && targetVar.id && ev.id === targetVar.id) ||
          (ev.size === targetVar.size && (ev.color || '') === (targetVar.color || ''))
      );

    if (isExistingSavedVariant && pendingVariantRemovalIdx !== idx) {
      setPendingVariantRemovalIdx(idx);
      return;
    }

    setHasUnsavedChanges(true);
    setPendingVariantRemovalIdx(null);
    setProdVariants((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleDeactivateVariantInsteadOfRemove = (idx: number) => {
    setHasUnsavedChanges(true);
    setPendingVariantRemovalIdx(null);
    setProdVariants((prev) =>
      prev.map((v, i) => (i === idx ? { ...v, isActive: false } : v))
    );
    showToast('ভ্যারিয়েন্টটি ডিলিট না করে নিষ্ক্রিয় (Inactive) করা হয়েছে।', 'info');
  };

  const handleProductImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageErrorMsg('');
    const check = validateProductImageFile(file);
    if (!check.valid) {
      setImageErrorMsg(check.error || 'অবৈধ ছবি ফাইল');
      showToast(check.error || 'অবৈধ ছবি ফাইল', 'error');
      e.target.value = '';
      return;
    }
    setIsUploadingImage(true);
    try {
      const compressedDataUrl = await compressProductImageFile(file);
      setProdImageUrl(compressedDataUrl);
      setHasUnsavedChanges(true);
      showToast('প্রোডাক্টের ছবি কমপ্রেস ও যুক্ত করা হয়েছে', 'success');
    } catch (err: any) {
      const msg = err?.message || 'ছবি আপলোড করা যায়নি। আপনি ছবি ছাড়াও প্রোডাক্ট সেভ করতে পারবেন।';
      setImageErrorMsg(msg);
      showToast(msg, 'error');
    } finally {
      setIsUploadingImage(false);
      e.target.value = '';
    }
  };

  // Live validation & summary memos for the product workspace
  const formValidation = useMemo(() => {
    return validateProductFormInput({
      name: prodName,
      category: prodCategory,
      variants: prodVariants,
      showBuyingCost,
    });
  }, [prodName, prodCategory, prodVariants, showBuyingCost]);

  const workspaceVariantSummary = useMemo(() => {
    const activeVars = prodVariants.filter((v) => v.isActive !== false);
    const totalStock = activeVars.reduce(
      (sum, v) => sum + Math.max(0, Math.floor(Number(v.stock) || 0)),
      0
    );
    const uniqueColors = Array.from(
      new Set(prodVariants.map((v) => (v.color || '').trim()).filter(Boolean))
    );
    return {
      totalVariants: prodVariants.length,
      activeVariants: activeVars.length,
      totalStock,
      uniqueColors,
    };
  }, [prodVariants]);

  const pendingEditStockChanges = useMemo(() => {
    if (!editingProduct) return [];
    return buildProductEditStockAdjustments({
      shopId: currentTenant?.id || '',
      existingProduct: editingProduct,
      updatedProductName: prodName.trim() || editingProduct.name,
      updatedBaseSku: prodSku.trim() || editingProduct.sku,
      updatedVariants: prodVariants,
      reason: editStockReason,
      responsibleUser: activeStaff?.name || 'Shop Owner',
      userRole: role,
    });
  }, [editingProduct, currentTenant?.id, prodName, prodSku, prodVariants, editStockReason, activeStaff?.name, role]);

  const handleSaveProduct = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!currentTenant || isSavingProduct) return;

    setShowValidationErrors(true);
    if (!formValidation.isValid) {
      showToast(formValidation.errors[0] || 'অনুগ্রহ করে ফর্মের ত্রুটিগুলো সংশোধন করুন।', 'warning');
      return;
    }

    setIsSavingProduct(true);
    const cleanName = prodName.trim();
    const productId = editingProduct?.id || `inv_${Date.now()}`;
    const cleanBaseSku =
      prodSku.trim().toUpperCase() ||
      `${isClothingStore ? 'CLT' : 'SPT'}-${Date.now().toString().slice(-4)}`;

    const normalizedVariants: ApparelMatrixVariant[] = prodVariants.map((v, idx) => {
      const vColor = (v.color || prodColor || 'Default').trim();
      const vSize = (v.size || `V${idx + 1}`).trim();
      const vId = v.id || buildVariantId(productId, vSize, vColor);
      const vSku =
        (v.sku || '').trim() ||
        `${cleanBaseSku}-${vColor.slice(0, 3).toUpperCase()}-${vSize}`;
      return {
        ...v,
        id: vId,
        color: vColor,
        size: vSize,
        sku: vSku,
        stock: Math.max(0, Math.floor(Number(v.stock) || 0)),
        costPrice: showBuyingCost
          ? Math.max(0, Number(v.costPrice) || 0)
          : v.costPrice || 0,
        mrp: Math.max(0, Number(v.mrp) || 0),
        bottomPrice: Math.max(0, Number(v.bottomPrice ?? v.mrp) || 0),
        isActive: v.isActive !== false,
      };
    });

    const totalStock = normalizedVariants
      .filter((v) => v.isActive !== false)
      .reduce((sum, v) => sum + v.stock, 0);

    if (editingProduct) {
      const adjustmentsToAppend = buildProductEditStockAdjustments({
        shopId: currentTenant.id,
        existingProduct: editingProduct,
        updatedProductName: cleanName,
        updatedBaseSku: cleanBaseSku,
        updatedVariants: normalizedVariants,
        reason: editStockReason,
        responsibleUser: activeStaff?.name || 'Shop Owner',
        userRole: role,
      });
      if (adjustmentsToAppend.length > 0) {
        dbService.appendStockAdjustments(currentTenant.id, adjustmentsToAppend);
      }
    }

    const itemToSave: InventoryItem = {
      id: productId,
      shopId: currentTenant.id,
      name: cleanName,
      description: prodDescription.trim() || undefined,
      color: prodColor.trim() || normalizedVariants[0]?.color || 'Default',
      categoryType: isClothingStore ? 'apparel' : 'jersey',
      clothingCategory: isClothingStore ? (prodCategory as MenClothingCategory) : undefined,
      subCategory: prodSubCategory.trim() || undefined,
      jerseyCategory: !isClothingStore ? (prodCategory as JerseyCategory) : undefined,
      clubOrCountry: !isClothingStore ? prodSubCategory.trim() || cleanName : undefined,
      season: !isClothingStore ? editingProduct?.season || '2024/25' : undefined,
      variants: normalizedVariants,
      lotCostLandingPrice: showBuyingCost
        ? Math.max(0, Number(prodBaseCost) || normalizedVariants[0]?.costPrice || 0)
        : editingProduct?.lotCostLandingPrice || 0,
      mrp: Math.max(0, Number(prodBaseMrp) || normalizedVariants[0]?.mrp || 0),
      bottomPrice: Math.max(0, Number(prodBaseFloor) || normalizedVariants[0]?.bottomPrice || 0),
      totalStock,
      sku: cleanBaseSku,
      imageUrl: prodImageUrl.trim() || undefined,
      isActive: prodIsActive,
    };

    try {
      dbService.saveInventoryItem(currentTenant.id, itemToSave, role);
      loadData();
      reloadShopData();
      setHasUnsavedChanges(false);
      setIsSavingProduct(false);
      setIsProductModalOpen(false);
      showToast(
        editingProduct
          ? `"${cleanName}" প্রোডাক্ট ও ভ্যারিয়েন্ট সফলভাবে আপডেট হয়েছে`
          : `"${cleanName}" প্রোডাক্ট (${normalizedVariants.length}টি ভ্যারিয়েন্ট, মোট ${totalStock} পিস স্টক) ইনভেন্টরিতে যুক্ত হয়েছে`,
        'success'
      );
    } catch (err: any) {
      setIsSavingProduct(false);
      showToast(err?.message || 'প্রোডাক্ট সংরক্ষণ করা যায়নি', 'error');
    }
  };

  const handleOpenStockCorrection = (product: InventoryItem, variant: ApparelMatrixVariant) => {
    setCorrectionTarget({ product, variant });
    setCorrectionNewQty(variant.stock);
    setCorrectionReasonPreset(STOCK_CORRECTION_REASONS[0]);
    setCorrectionCustomReason('');
  };

  const handleConfirmStockCorrection = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentTenant || !correctionTarget) return;
    const finalReason =
      correctionCustomReason.trim() || correctionReasonPreset || 'Physical Stock Count Correction';
    try {
      dbService.correctVariantStock({
        shopId: currentTenant.id,
        productId: correctionTarget.product.id,
        variantId: correctionTarget.variant.id,
        size: correctionTarget.variant.size,
        color: correctionTarget.variant.color || correctionTarget.product.color,
        newQty: correctionNewQty,
        reason: finalReason,
        responsibleUser: activeStaff?.name || 'Shop Owner',
        userRole: role,
      });
      loadData();
      setCorrectionTarget(null);
      showToast(
        `স্টক সংশোধন সম্পন্ন: ${correctionTarget.product.name} (${correctionTarget.variant.color ? `${correctionTarget.variant.color} • ` : ''}${correctionTarget.variant.size}) → ${correctionNewQty} পিস`,
        'success'
      );
    } catch (err: any) {
      showToast(err?.message || 'স্টক সংশোধন করা যায়নি', 'error');
    }
  };

  const handleToggleProductActive = (item: InventoryItem) => {
    if (!currentTenant) return;
    const updated: InventoryItem = {
      ...item,
      isActive: item.isActive === false ? true : false,
    };
    dbService.saveInventoryItem(currentTenant.id, updated, role);
    loadData();
    showToast(
      updated.isActive
        ? `"${item.name}" সক্রিয় (Active) করা হয়েছে`
        : `"${item.name}" নিষ্ক্রিয় (Inactive) করা হয়েছে`,
      'info'
    );
  };

  const handleDeleteProduct = (item: InventoryItem) => {
    if (!currentTenant) return;
    dbService.softDeleteInventoryItem(currentTenant.id, item.id);
    loadData();
    showToast(`"${item.name}" রিসাইকেল বিনে সরানো হয়েছে`, 'info');
  };

  // Filtered products
  const filteredProducts = useMemo(() => {
    return inventory.filter((item) => {
      const cat = isClothingStore
        ? item.clothingCategory || 'T-Shirt'
        : item.jerseyCategory || item.subCategory || 'Player Issue';

      if (categoryFilter !== 'ALL' && cat !== categoryFilter) {
        return false;
      }

      if (stockStatusFilter === 'INACTIVE' && item.isActive !== false) return false;
      if (stockStatusFilter === 'OUT_OF_STOCK' && item.totalStock > 0) return false;
      if (
        stockStatusFilter === 'LOW_STOCK' &&
        (item.totalStock <= 0 || item.totalStock > lowStockThreshold)
      ) {
        return false;
      }
      if (stockStatusFilter === 'IN_STOCK' && item.totalStock <= 0) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        const matchesMain =
          item.name.toLowerCase().includes(q) ||
          (item.sku || '').toLowerCase().includes(q) ||
          (item.color || '').toLowerCase().includes(q) ||
          cat.toLowerCase().includes(q) ||
          (item.subCategory || '').toLowerCase().includes(q);
        const matchesVariant = (item.variants || []).some(
          (v) =>
            (v.color || '').toLowerCase().includes(q) ||
            (v.size || '').toLowerCase().includes(q) ||
            (v.sku || '').toLowerCase().includes(q)
        );
        if (!matchesMain && !matchesVariant) return false;
      }

      return true;
    });
  }, [inventory, categoryFilter, stockStatusFilter, searchQuery, isClothingStore, lowStockThreshold]);

  // Summary metrics
  const metrics = useMemo(() => {
    let totalProducts = inventory.length;
    let totalVariants = 0;
    let totalPieces = 0;
    let lowStockVariants = 0;
    let outOfStockVariants = 0;
    let totalSellingValue = 0;
    let totalCostValue = 0;

    inventory.forEach((item) => {
      if (item.isActive === false) return;
      (item.variants || []).forEach((v) => {
        if (v.isActive === false) return;
        totalVariants += 1;
        const qty = Math.max(0, Number(v.stock) || 0);
        totalPieces += qty;
        if (qty === 0) outOfStockVariants += 1;
        else if (qty <= lowStockThreshold) lowStockVariants += 1;
        totalSellingValue += qty * (Number(v.mrp || item.mrp) || 0);
        totalCostValue += qty * (Number(v.costPrice || item.lotCostLandingPrice) || 0);
      });
    });

    return {
      totalProducts,
      totalVariants,
      totalPieces,
      lowStockVariants,
      outOfStockVariants,
      totalSellingValue,
      totalCostValue,
    };
  }, [inventory, lowStockThreshold]);

  const filteredLedger = useMemo(() => {
    if (ledgerFilter === 'ALL') return stockAdjustments;
    return stockAdjustments.filter((r) => r.movementType === ledgerFilter);
  }, [stockAdjustments, ledgerFilter]);

  return (
    <div className="space-y-4">
      {/* ===================================================================== */}
      {/* HEADER & OWNER INVENTORY TRACKING ON/OFF CONTROL BANNER               */}
      {/* ===================================================================== */}
      <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-3.5 sm:p-4 shadow-xs space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2.5">
          {/* Owner Inventory Tracking ON/OFF Toggle */}
          <div
            className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-bold transition ${
              inventoryTrackingEnabled
                ? 'bg-emerald-50/90 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200'
                : 'bg-amber-50/90 dark:bg-amber-950/40 border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-200'
            }`}
          >
            <Power
              className={`w-3.5 h-3.5 shrink-0 ${
                inventoryTrackingEnabled ? 'text-emerald-600' : 'text-amber-600'
              }`}
            />
            <span className="text-xs">
              {pickText('ইনভেন্টরি ট্র্যাকিং:', 'Inventory Tracking:')}{' '}
              <strong>{inventoryTrackingEnabled ? pickText('চালু', 'ON') : pickText('বন্ধ', 'OFF')}</strong>
            </span>
            <InfoTooltip
              text={pickText(
                'চালু থাকলে পিওএস বিক্রয়ে স্বয়ংক্রিয়ভাবে ভ্যারিয়েন্ট স্টক কমবে; বন্ধ থাকলে স্টক না কমিয়েই বিল করা যাবে।',
                'When ON, POS sales automatically deduct variant stock; when OFF, POS bills without deducting stock.'
              )}
            />
            {showBuyingCost && (
              <button
                type="button"
                onClick={() => handleToggleInventoryTracking(!inventoryTrackingEnabled)}
                className={`ml-1 px-2.5 py-1 rounded-lg text-[10px] font-extrabold cursor-pointer transition ${
                  inventoryTrackingEnabled
                    ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                    : 'bg-amber-600 text-white hover:bg-amber-700'
                }`}
              >
                {inventoryTrackingEnabled ? pickText('বন্ধ করুন', 'Turn OFF') : pickText('চালু করুন', 'Turn ON')}
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setIsLedgerModalOpen(true)}
              className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-200 font-bold text-xs flex items-center gap-1.5 cursor-pointer transition"
            >
              <History className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
              <span>
                {pickText('অডিট লগ', 'Audit Log')} ({stockAdjustments.length})
              </span>
            </button>

            <button
              type="button"
              onClick={openAddProductModal}
              className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-xs cursor-pointer transition"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{pickText('প্রোডাক্ট যোগ করুন', 'Add Product')}</span>
            </button>
          </div>
        </div>

        {/* KPI Summary Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-0 sm:gap-2.5 pt-1">
          <div className="p-3 rounded-tl-2xl sm:rounded-2xl bg-transparent sm:bg-slate-50 dark:bg-transparent sm:dark:bg-zinc-950 border border-slate-200/80 dark:border-zinc-800">
            <span className="text-[10px] font-bold text-slate-400 uppercase block">
              {pickText('মোট প্রোডাক্ট', 'Total Products')}
            </span>
            <strong className="text-base font-extrabold font-mono text-slate-900 dark:text-white">
              {metrics.totalProducts} {pickText('টি', 'items')}
            </strong>
          </div>
          <div className="p-3 rounded-tr-2xl sm:rounded-2xl bg-transparent sm:bg-slate-50 dark:bg-transparent sm:dark:bg-zinc-950 border border-slate-200/80 dark:border-zinc-800">
            <span className="text-[10px] font-bold text-slate-400 uppercase block">
              {pickText('সক্রিয় ভ্যারিয়েন্ট', 'Active Variants')}
            </span>
            <strong className="text-base font-extrabold font-mono text-indigo-600 dark:text-indigo-400">
              {metrics.totalVariants} {pickText('টি', 'items')}
            </strong>
          </div>
          <div className="p-3 rounded-none sm:rounded-2xl bg-emerald-50/60 dark:bg-emerald-950/30 border border-slate-200/80 dark:border-zinc-800 sm:border-emerald-200/80 sm:dark:border-emerald-900/50">
            <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400 uppercase block">
              {pickText('মজুদ স্টক', 'Available Stock')}
            </span>
            <strong className="text-base font-extrabold font-mono text-emerald-700 dark:text-emerald-300">
              {metrics.totalPieces.toLocaleString()} {pickText('পিস', 'pcs')}
            </strong>
          </div>
          <div className="p-3 rounded-none sm:rounded-2xl bg-amber-50/60 dark:bg-amber-950/30 border border-slate-200/80 dark:border-zinc-800 sm:border-amber-200/80 sm:dark:border-amber-900/50">
            <span className="text-[10px] font-bold text-amber-700 dark:text-amber-400 uppercase block">
              {pickText('লো / স্টক আউট', 'Low / Out of Stock')}
            </span>
            <strong className="text-base font-extrabold font-mono text-amber-700 dark:text-amber-300">
              {metrics.lowStockVariants} {pickText('লো', 'Low')} • {metrics.outOfStockVariants}{' '}
              {pickText('আউট', 'Out')}
            </strong>
          </div>
          <div className="col-span-2 sm:col-span-1 p-3 rounded-none sm:rounded-2xl bg-transparent sm:bg-slate-50 dark:bg-transparent sm:dark:bg-zinc-950 border border-slate-200/80 dark:border-zinc-800">
            <span className="text-[10px] font-bold text-slate-400 uppercase block">
              {pickText('বিক্রয়মূল্যে স্টক ভ্যালু', 'Retail Stock Value')}
            </span>
            <strong className="text-base font-extrabold font-mono text-slate-900 dark:text-white">
              ৳{metrics.totalSellingValue.toLocaleString()}
            </strong>
          </div>
          {showBuyingCost ? (
            <div className="col-span-2 sm:col-span-1 p-3 rounded-b-2xl sm:rounded-2xl bg-transparent sm:bg-purple-50/60 dark:bg-transparent sm:dark:bg-purple-950/30 border border-slate-200/80 dark:border-zinc-800 sm:border-purple-200/80 sm:dark:border-purple-900/50">
              <span className="text-[10px] font-bold text-purple-700 dark:text-purple-400 uppercase flex items-center gap-1">
                <span>{pickText('ক্রয়মূল্যে স্টক ভ্যালু', 'Buying Cost Value')}</span>
                <InfoTooltip
                  text={pickText(
                    'মজুদ স্টকের মোট ক্রয়মূল্য (শুধুমাত্র দোকানের মালিকের জন্য দৃশ্যমান)।',
                    'Total landing cost value of available stock (visible only to Owner).'
                  )}
                />
              </span>
              <strong className="text-base font-extrabold font-mono text-purple-700 dark:text-purple-300">
                ৳{metrics.totalCostValue.toLocaleString()}
              </strong>
            </div>
          ) : (
            <div className="col-span-2 sm:col-span-1 p-3 rounded-b-2xl sm:rounded-2xl bg-transparent sm:bg-slate-50 dark:bg-transparent sm:dark:bg-zinc-950 border border-slate-200/80 dark:border-zinc-800">
              <span className="text-[10px] font-bold text-slate-400 uppercase flex items-center gap-1">
                <span>{pickText('ক্রয়মূল্য গোপনীয়তা', 'Cost Visibility')}</span>
                <InfoTooltip
                  text={pickText(
                    'ক্রয়মূল্য শুধুমাত্র দোকানের মালিক দেখতে পারবেন।',
                    'Buying cost is restricted to the Store Owner account.'
                  )}
                />
              </span>
              <strong className="text-xs font-bold text-slate-500">
                {pickText('ওনার সংরক্ষিত 🔒', 'Owner Protected 🔒')}
              </strong>
            </div>
          )}
        </div>

        {/* Search & Filters */}
        <div className="flex flex-col sm:flex-row gap-2.5 pt-1">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={
                isClothingStore
                  ? pickText(
                      'প্রোডাক্ট নাম, কালার, সাইজ বা SKU খুঁজুন (যেমন: T-Shirt, Black, M, Polo)...',
                      'Search product name, color, size or SKU (e.g. T-Shirt, Black, M, Polo)...'
                    )
                  : pickText(
                      'জার্সি/প্রোডাক্ট নাম, ক্লাব, কালার, সাইজ বা SKU খুঁজুন (যেমন: Real Madrid, L)...',
                      'Search jersey/product name, club, color, size or SKU (e.g. Real Madrid, L)...'
                    )
              }
              className="w-full pl-9 pr-4 py-2.5 rounded-2xl bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
            />
          </div>

          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="px-3.5 py-2.5 rounded-2xl bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 text-xs font-semibold text-slate-800 dark:text-zinc-200"
          >
            <option value="ALL">
              {pickText('সকল ক্যাটাগরি', 'All Categories')} ({inventory.length})
            </option>
            {availableCategories.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>

          <select
            value={stockStatusFilter}
            onChange={(e) => setStockStatusFilter(e.target.value as any)}
            className="px-3.5 py-2.5 rounded-2xl bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 text-xs font-semibold text-slate-800 dark:text-zinc-200"
          >
            <option value="ALL">{pickText('সকল স্টক স্ট্যাটাস', 'All Stock Status')}</option>
            <option value="IN_STOCK">{pickText('শুধুমাত্র ইন-স্টক', 'In Stock Only')}</option>
            <option value="LOW_STOCK">
              {pickText(`লো স্টক (≤ ${lowStockThreshold} পিস)`, `Low Stock (≤ ${lowStockThreshold} pcs)`)}
            </option>
            <option value="OUT_OF_STOCK">{pickText('স্টক আউট (০ পিস)', 'Out of Stock (0 pcs)')}</option>
            <option value="INACTIVE">{pickText('নিষ্ক্রিয় প্রোডাক্ট', 'Inactive Products')}</option>
          </select>

          {mode === 'inventory_page' && onNavigate && (
            <button
              type="button"
              onClick={() => onNavigate('settings', 'categories')}
              className="px-3.5 py-2.5 rounded-2xl bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 text-slate-700 dark:text-zinc-200 text-xs font-bold flex items-center gap-1.5 cursor-pointer shrink-0"
            >
              <SlidersHorizontal className="w-3.5 h-3.5 text-emerald-600" />
              <span>{pickText('ক্যাটাগরি ও প্রাইস সেটিংস', 'Categories & Price Settings')}</span>
            </button>
          )}
        </div>
      </div>

      {/* ===================================================================== */}
      {/* PRODUCT & MULTI-VARIANT TABLE                                         */}
      {/* ===================================================================== */}
      <div className="space-y-3">
        {filteredProducts.length === 0 ? (
          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-3xl p-8 text-center space-y-3">
            <Package className="w-10 h-10 text-slate-400 mx-auto" />
            <div className="text-sm font-bold text-slate-800 dark:text-zinc-200">
              {pickText('কোনো প্রোডাক্ট বা ভ্যারিয়েন্ট পাওয়া যায়নি', 'No products or variants found')}
            </div>
            <button
              type="button"
              onClick={openAddProductModal}
              className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>{pickText('প্রথম প্রোডাক্ট ও ভ্যারিয়েন্ট যোগ করুন', 'Add First Product & Variants')}</span>
            </button>
          </div>
        ) : (
          filteredProducts.map((product) => {
            const prodCat = isClothingStore
              ? product.clothingCategory || 'T-Shirt'
              : product.jerseyCategory || product.subCategory || 'Player Issue';

            return (
              <div
                key={product.id}
                className={`bg-white dark:bg-zinc-900 border rounded-3xl p-4 sm:p-5 shadow-2xs transition ${
                  product.isActive === false
                    ? 'border-slate-200/60 dark:border-zinc-800/60 opacity-70'
                    : 'border-slate-200 dark:border-zinc-800'
                }`}
              >
                {/* Product Top Bar */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-zinc-800">
                  <div className="flex items-center gap-3">
                    {product.imageUrl ? (
                      <img
                        src={product.imageUrl}
                        alt={product.name}
                        loading="lazy"
                        className="w-12 h-12 rounded-2xl object-cover border border-slate-200 dark:border-zinc-700 shrink-0"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800/60 flex items-center justify-center text-emerald-700 dark:text-emerald-300 font-black text-sm shrink-0">
                        {product.name.slice(0, 2).toUpperCase()}
                      </div>
                    )}

                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-white">
                          {product.name}
                        </h4>
                        {product.description && <InfoTooltip text={product.description} />}
                        <span className="px-2 py-0.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 text-[10px] font-bold">
                          {prodCat}
                        </span>
                        <span className="px-2 py-0.5 rounded-lg bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-300 font-mono text-[10px] font-semibold">
                          SKU: {product.sku}
                        </span>
                        {product.isActive === false && (
                          <span className="px-2 py-0.5 rounded-lg bg-rose-50 text-rose-600 border border-rose-200 text-[10px] font-bold">
                            {pickText('নিষ্ক্রিয়', 'Inactive')}
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5 flex items-center gap-3 flex-wrap">
                        <span>
                          {pickText('মোট স্টক:', 'Total Stock:')}{' '}
                          <strong
                            className={`font-mono ${
                              product.totalStock <= 0
                                ? 'text-rose-600'
                                : product.totalStock <= lowStockThreshold
                                ? 'text-amber-600'
                                : 'text-emerald-600 dark:text-emerald-400'
                            }`}
                          >
                            {product.totalStock} {pickText('পিস', 'pcs')}
                          </strong>{' '}
                          ({(product.variants || []).length} {pickText('টি ভ্যারিয়েন্ট', 'variants')})
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Product Actions */}
                  <div className="flex items-center gap-2 self-end sm:self-center">
                    <button
                      type="button"
                      onClick={() => setMobileVariantSheetProduct(product)}
                      className="md:hidden px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 text-slate-800 dark:text-zinc-200 text-xs font-bold flex items-center gap-1 cursor-pointer transition"
                    >
                      <span>
                        {pickText('ভ্যারিয়েন্ট', 'Variants')} ({(product.variants || []).length})
                      </span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>

                    <button
                      type="button"
                      onClick={() => openEditProductModal(product)}
                      className="px-3 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/60 dark:hover:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 text-xs font-bold flex items-center gap-1.5 cursor-pointer transition"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      <span>{pickText('সম্পাদনা', 'Edit')}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleToggleProductActive(product)}
                      className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 text-slate-600 dark:text-zinc-300 cursor-pointer transition"
                      title={
                        product.isActive === false
                          ? pickText('প্রোডাক্ট সক্রিয় করুন', 'Activate Product')
                          : pickText('প্রোডাক্ট নিষ্ক্রিয় করুন', 'Deactivate Product')
                      }
                    >
                      {product.isActive === false ? (
                        <Eye className="w-4 h-4 text-emerald-600" />
                      ) : (
                        <EyeOff className="w-4 h-4 text-slate-500" />
                      )}
                    </button>

                    {showBuyingCost && (
                      <button
                        type="button"
                        onClick={() => handleDeleteProduct(product)}
                        className="p-2 rounded-xl bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 cursor-pointer transition"
                        title={pickText('রিসাইকেল বিনে সরান', 'Move to Recycle Bin')}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Desktop Variants Matrix Table (Hidden on Mobile to prevent horizontal scrolling bloat) */}
                <div className="hidden md:block mt-3 overflow-x-auto no-scrollbar">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-50 dark:bg-zinc-950 text-slate-500 dark:text-zinc-400 border-b border-slate-200 dark:border-zinc-800 font-semibold">
                        <th className="py-2 px-3 rounded-tl-xl">{pickText('কালার', 'Color')}</th>
                        <th className="py-2 px-3">{pickText('সাইজ', 'Size')}</th>
                        <th className="py-2 px-3">{pickText('এসকেইউ / কোড', 'SKU / Code')}</th>
                        {showBuyingCost && (
                          <th className="py-2 px-3 text-right text-purple-600 dark:text-purple-400">
                            {pickText('কেনা দাম', 'Buying Price')}
                          </th>
                        )}
                        <th className="py-2 px-3 text-right">{pickText('বিক্রয় দাম', 'Selling Price')}</th>
                        <th className="py-2 px-3 text-right">{pickText('সর্বনিম্ন দাম', 'Min Floor')}</th>
                        <th className="py-2 px-3 text-center">{pickText('স্টক', 'Stock')}</th>
                        <th className="py-2 px-3 text-right rounded-tr-xl">
                          {pickText('স্টক সংশোধন', 'Quick Stock Fix')}
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-zinc-800/70">
                      {(product.variants || []).map((v, vIdx) => {
                        const vColor = v.color || product.color || 'Default';
                        const vStock = Math.max(0, Number(v.stock) || 0);
                        const isOut = vStock === 0;
                        const isLow = vStock > 0 && vStock <= lowStockThreshold;

                        return (
                          <tr
                            key={v.id || `${product.id}_${vIdx}`}
                            className="hover:bg-slate-50/80 dark:hover:bg-zinc-800/40 transition"
                          >
                            <td className="py-2.5 px-3 font-semibold text-slate-800 dark:text-zinc-200">
                              <span className="inline-flex items-center gap-1.5">
                                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/70 inline-block" />
                                {vColor}
                              </span>
                            </td>
                            <td className="py-2.5 px-3">
                              <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-zinc-800 font-mono font-bold text-slate-900 dark:text-white">
                                {v.size}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 font-mono text-[11px] text-slate-500 dark:text-zinc-400">
                              {v.sku || `${product.sku}-${v.size}`}
                            </td>
                            {showBuyingCost && (
                              <td className="py-2.5 px-3 text-right font-mono font-bold text-purple-700 dark:text-purple-300">
                                ৳{(v.costPrice || product.lotCostLandingPrice || 0).toLocaleString()}
                              </td>
                            )}
                            <td className="py-2.5 px-3 text-right font-mono font-bold text-emerald-700 dark:text-emerald-400">
                              ৳{(v.mrp || product.mrp || 0).toLocaleString()}
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono text-slate-600 dark:text-zinc-400">
                              ৳{(v.bottomPrice || product.bottomPrice || 0).toLocaleString()}
                            </td>
                            <td className="py-2.5 px-3 text-center">
                              <span
                                className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full font-mono font-bold text-xs ${
                                  isOut
                                    ? 'bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-950/60 dark:text-rose-300'
                                    : isLow
                                    ? 'bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/60 dark:text-amber-300'
                                    : 'bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300'
                                }`}
                              >
                                {vStock} {pickText('পিস', 'pcs')}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 text-right">
                              <button
                                type="button"
                                onClick={() => handleOpenStockCorrection(product, v)}
                                className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-emerald-600 hover:text-white dark:bg-zinc-800 dark:hover:bg-emerald-600 text-slate-700 dark:text-zinc-200 font-bold text-[11px] cursor-pointer transition inline-flex items-center gap-1"
                              >
                                <Edit3 className="w-3 h-3" />
                                <span>{pickText('স্টক ঠিক করুন', 'Correct Stock')}</span>
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Mobile Variants Detail Bottom Sheet */}
      <BottomSheet
        isOpen={Boolean(mobileVariantSheetProduct)}
        onClose={() => setMobileVariantSheetProduct(null)}
        title={mobileVariantSheetProduct ? mobileVariantSheetProduct.name : 'Product Variants'}
        subtitle={
          mobileVariantSheetProduct
            ? `SKU: ${mobileVariantSheetProduct.sku} • Total Stock: ${mobileVariantSheetProduct.totalStock} pcs`
            : undefined
        }
        footer={
          mobileVariantSheetProduct ? (
            <button
              type="button"
              onClick={() => {
                const prod = mobileVariantSheetProduct;
                setMobileVariantSheetProduct(null);
                openEditProductModal(prod);
              }}
              className="w-full py-2 px-3 rounded-xl bg-[#164e3f] hover:bg-[#123e32] text-white font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span>Edit Product & All Variants</span>
            </button>
          ) : undefined
        }
      >
        {mobileVariantSheetProduct && (
          <div className="divide-y divide-slate-100 dark:divide-zinc-800 border border-slate-100 dark:border-zinc-800 rounded-xl overflow-hidden">
            {(mobileVariantSheetProduct.variants || []).map((v, vIdx) => {
              const vColor = v.color || mobileVariantSheetProduct.color || 'Default';
              const vStock = Math.max(0, Number(v.stock) || 0);
              return (
                <div
                  key={v.id || `m_v_${vIdx}`}
                  className="px-3 py-2 flex items-center justify-between gap-2"
                >
                  <div className="min-w-0">
                    <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                      <span>{vColor}</span>
                      <span>•</span>
                      <span className="font-mono px-1.5 py-0.2 rounded bg-slate-100 dark:bg-zinc-800">
                        {v.size}
                      </span>
                    </div>
                    <div className="text-[11px] font-mono text-slate-500 mt-0.5">
                      Sell: ৳{(v.mrp || mobileVariantSheetProduct.mrp || 0).toLocaleString()} • Min: ৳
                      {(v.bottomPrice || mobileVariantSheetProduct.bottomPrice || 0).toLocaleString()}
                      {showBuyingCost && ` • Cost: ৳${(v.costPrice || mobileVariantSheetProduct.lotCostLandingPrice || 0).toLocaleString()}`}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span
                      className={`font-mono font-bold text-xs px-2 py-0.5 rounded-full ${
                        vStock <= 0
                          ? 'bg-rose-50 text-rose-700'
                          : 'bg-emerald-50 text-emerald-700'
                      }`}
                    >
                      {vStock}p
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        const prod = mobileVariantSheetProduct;
                        setMobileVariantSheetProduct(null);
                        handleOpenStockCorrection(prod, v);
                      }}
                      className="px-2 py-1 rounded-lg bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-200 font-bold text-[11px] cursor-pointer"
                    >
                      Fix
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </BottomSheet>

      {/* ===================================================================== */}
      {/* FULL-SCREEN WORKSPACE: ADD / EDIT PRODUCT & MULTI-VARIANTS            */}
      {/* ===================================================================== */}
      {isProductModalOpen && (
        <div
          data-testid="fullscreen-product-workspace"
          className="fixed inset-0 z-50 w-screen h-screen bg-[#f4f7f5] dark:bg-zinc-950 text-slate-900 dark:text-zinc-100 flex flex-col overflow-hidden animate-in fade-in duration-150"
        >
          {/* 1. FIXED TOP HEADER */}
          <header className="shrink-0 bg-white dark:bg-zinc-900 border-b border-slate-200 dark:border-zinc-800 px-4 sm:px-6 lg:px-8 py-3.5 shadow-2xs">
            <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2 min-w-0">
                <h2 className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-white truncate">
                  {editingProduct
                    ? `Edit Product: ${editingProduct.name}`
                    : 'Add Product & Variants'}
                </h2>
                {editingProduct && (
                  <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-300">
                    ID: {editingProduct.sku}
                  </span>
                )}
              </div>

              {/* Header Live Summary & Status Controls */}
              <div className="flex items-center gap-2.5 sm:gap-3 flex-wrap">
                <div className="hidden md:flex items-center gap-3 px-3.5 py-1.5 rounded-xl bg-emerald-50/80 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/80 text-xs">
                  <div>
                    <span className="text-slate-500 dark:text-zinc-400">সক্রিয় ভ্যারিয়েন্ট: </span>
                    <strong className="font-mono font-extrabold text-emerald-700 dark:text-emerald-300">
                      {workspaceVariantSummary.activeVariants} টি
                    </strong>
                  </div>
                  <span className="text-slate-300 dark:text-zinc-700">•</span>
                  <div>
                    <span className="text-slate-500 dark:text-zinc-400">মোট স্টক: </span>
                    <strong className="font-mono font-extrabold text-emerald-700 dark:text-emerald-300">
                      {workspaceVariantSummary.totalStock} pcs
                    </strong>
                  </div>
                </div>

                <label className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 cursor-pointer text-xs font-bold">
                  <input
                    type="checkbox"
                    checked={prodIsActive}
                    onChange={(e) => {
                      setProdIsActive(e.target.checked);
                      setHasUnsavedChanges(true);
                    }}
                    className="rounded accent-emerald-600"
                  />
                  <span>{prodIsActive ? pickText('চালু', 'Active') : pickText('বন্ধ', 'Inactive')}</span>
                </label>

                <button
                  type="button"
                  onClick={handleRequestCloseProductModal}
                  className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-200 font-bold text-xs inline-flex items-center gap-1.5 cursor-pointer transition"
                  title="Close Workspace"
                >
                  <X className="w-4 h-4" />
                  <span className="hidden sm:inline">Close</span>
                </button>
              </div>
            </div>
          </header>

          {/* 2. SCROLLABLE CENTRAL WORKSPACE (ONLY THIS AREA SCROLLS) */}
          <div className="flex-1 overflow-y-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-6">
            <form
              id="lekho-product-workspace-form"
              onSubmit={handleSaveProduct}
              className="max-w-7xl mx-auto space-y-5 pb-10 text-xs"
            >
              {/* Inline Validation Banner if user tried to save with errors */}
              {showValidationErrors && !formValidation.isValid && (
                <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/50 border border-rose-300 dark:border-rose-800 text-rose-800 dark:text-rose-200 space-y-1.5">
                  <div className="font-extrabold flex items-center gap-2 text-xs sm:text-sm">
                    <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                    <span>প্রোডাক্ট সেভ করার আগে নিচের তথ্যগুলো সংশোধন করুন:</span>
                  </div>
                  <ul className="list-disc list-inside text-[11px] space-y-0.5 pl-1">
                    {formValidation.errors.slice(0, 6).map((err, idx) => (
                      <li key={idx}>{err}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* ================================================================= */}
              {/* STEP 1: BASIC PRODUCT INFORMATION                                 */}
              {/* ================================================================= */}
              <section className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-4 sm:p-5 shadow-2xs space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-100 dark:border-zinc-800">
                  <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">
                    1. Basic Product Information
                  </h3>
                  <span className="text-[11px] text-slate-400 font-semibold">
                    <strong className="text-rose-500">*</strong> Required
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                  {/* Left 8 Cols: Core Text Inputs */}
                  <div className="md:col-span-8 space-y-3.5">
                    <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                      <div className="sm:col-span-6">
                        <label className="block font-bold text-slate-700 dark:text-zinc-200 mb-1">
                          {pickText('প্রোডাক্টের নাম', 'Product Name')} <span className="text-rose-500">*</span>
                        </label>
                        <input
                          type="text"
                          required
                          value={prodName}
                          onChange={(e) => {
                            setProdName(e.target.value);
                            setHasUnsavedChanges(true);
                          }}
                          placeholder={
                            isClothingStore
                              ? 'যেমন: T-Shirt, Premium Cotton Polo, Slim Fit Jeans'
                              : 'যেমন: Real Madrid Home 24/25, Argentina Retro 1994'
                          }
                          className={`w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-zinc-950 border font-semibold text-slate-900 dark:text-white focus:outline-none ${
                            showValidationErrors && !prodName.trim()
                              ? 'border-rose-500 ring-2 ring-rose-500/20'
                              : 'border-slate-300 dark:border-zinc-700 focus:border-emerald-600'
                          }`}
                        />
                      </div>

                      <div className="sm:col-span-3">
                        <label className="block font-bold text-slate-700 dark:text-zinc-200 mb-1">
                          {pickText('ক্যাটাগরি', 'Category')} <span className="text-rose-500">*</span>
                        </label>
                        <select
                          value={prodCategory}
                          onChange={(e) => {
                            setProdCategory(e.target.value);
                            setHasUnsavedChanges(true);
                          }}
                          className="w-full px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-zinc-950 border border-slate-300 dark:border-zinc-700 text-slate-900 dark:text-white font-semibold focus:outline-none focus:border-emerald-600"
                        >
                          {availableCategories.map((c) => (
                            <option key={c} value={c}>
                              {c}
                            </option>
                          ))}
                          {!availableCategories.includes(prodCategory) && prodCategory && (
                            <option value={prodCategory}>{prodCategory}</option>
                          )}
                        </select>
                      </div>

                      <div className="sm:col-span-3">
                        <label className="block font-bold text-slate-700 dark:text-zinc-200 mb-1">
                          Base SKU / Code <span className="text-[10px] font-normal text-slate-400">{pickText('(ঐচ্ছিক)', '(Optional)')}</span>
                        </label>
                        <input
                          type="text"
                          value={prodSku}
                          onChange={(e) => {
                            setProdSku(e.target.value);
                            setHasUnsavedChanges(true);
                          }}
                          placeholder="TSH-001"
                          className="w-full px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-zinc-950 border border-slate-300 dark:border-zinc-700 font-mono text-slate-900 dark:text-white focus:outline-none focus:border-emerald-600"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block font-bold text-slate-700 dark:text-zinc-200 mb-1">
                          {isClothingStore ? 'Brand / Sub-Category' : 'Club / Country / Edition'}{' '}
                          <span className="text-[10px] font-normal text-slate-400">{pickText('(ঐচ্ছিক)', '(Optional)')}</span>
                        </label>
                        <input
                          type="text"
                          value={prodSubCategory}
                          onChange={(e) => {
                            setProdSubCategory(e.target.value);
                            setHasUnsavedChanges(true);
                          }}
                          placeholder={isClothingStore ? 'Richman / Export Surplus' : 'Real Madrid / Brazil'}
                          className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-zinc-950 border border-slate-300 dark:border-zinc-700 text-slate-900 dark:text-white focus:outline-none focus:border-emerald-600"
                        />
                      </div>

                      <div>
                        <label className="block font-bold text-slate-700 dark:text-zinc-200 mb-1">
                          {pickText('সংক্ষিপ্ত বিবরণ', 'Optional Description')}{' '}
                          <span className="text-[10px] font-normal text-slate-400">{pickText('(ঐচ্ছিক)', '(Optional)')}</span>
                        </label>
                        <input
                          type="text"
                          value={prodDescription}
                          onChange={(e) => {
                            setProdDescription(e.target.value);
                            setHasUnsavedChanges(true);
                          }}
                          placeholder="100% Combed Cotton, GSM 190"
                          className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-zinc-950 border border-slate-300 dark:border-zinc-700 text-slate-900 dark:text-white focus:outline-none focus:border-emerald-600"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Right 4 Cols: Optional Product Image with Preview, Replace & Remove */}
                  <div className="md:col-span-4">
                    <label className="block font-bold text-slate-700 dark:text-zinc-200 mb-1">
                      Product Image (প্রোডাক্টের ছবি — ঐচ্ছিক)
                    </label>
                    <div className="p-3 rounded-xl bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 flex items-center gap-3">
                      {prodImageUrl ? (
                        <img
                          src={prodImageUrl}
                          alt={prodName || 'Product preview'}
                          className="w-16 h-16 rounded-xl object-cover border border-emerald-300 dark:border-emerald-800 shrink-0"
                        />
                      ) : (
                        <div className="w-16 h-16 rounded-xl bg-emerald-500/10 border border-dashed border-emerald-500/40 flex flex-col items-center justify-center text-emerald-700 dark:text-emerald-300 shrink-0">
                          <ImageIcon className="w-5 h-5" />
                          <span className="text-[9px] font-bold mt-0.5">No Image</span>
                        </div>
                      )}

                      <div className="flex-1 min-w-0 space-y-1.5">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <label className="px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] cursor-pointer inline-flex items-center gap-1 transition">
                            <ImageIcon className="w-3.5 h-3.5" />
                            <span>
                              {isUploadingImage
                                ? 'কমপ্রেস হচ্ছে...'
                                : prodImageUrl
                                ? 'Replace Image'
                                : 'Upload Image'}
                            </span>
                            <input
                              type="file"
                              accept="image/jpeg,image/png,image/webp"
                              onChange={handleProductImageUpload}
                              className="hidden"
                            />
                          </label>

                          {prodImageUrl && (
                            <button
                              type="button"
                              onClick={() => {
                                setProdImageUrl('');
                                setImageErrorMsg('');
                                setHasUnsavedChanges(true);
                              }}
                              className="px-2.5 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/50 text-rose-600 dark:text-rose-300 font-bold text-[11px] cursor-pointer transition"
                            >
                              Remove
                            </button>
                          )}
                        </div>

                        <input
                          type="text"
                          value={prodImageUrl}
                          onChange={(e) => {
                            setProdImageUrl(e.target.value);
                            setImageErrorMsg('');
                            setHasUnsavedChanges(true);
                          }}
                          placeholder="অথবা ছবির URL পেস্ট করুন (ঐচ্ছিক)..."
                          className="w-full px-2.5 py-1 rounded-lg bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 text-[10px]"
                        />

                        {imageErrorMsg ? (
                          <p className="text-[10px] font-semibold text-rose-600 dark:text-rose-400">
                            {imageErrorMsg}
                          </p>
                        ) : (
                          <p className="text-[10px] text-slate-500 dark:text-zinc-400 leading-tight">
                            ছবি ছাড়াও প্রোডাক্ট সেভ করা যাবে। ফাইল দিলে অটো কমপ্রেস হবে (&lt;60KB)।
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </section>

              {/* ================================================================= */}
              {/* STEP 2 & 3: DEFAULT VARIANT PRICING, BATCH STOCK & SMART PRESETS  */}
              {/* ================================================================= */}
              <section className="bg-white dark:bg-zinc-900 border border-emerald-200/90 dark:border-zinc-800 rounded-2xl p-4 sm:p-5 shadow-2xs space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-100 dark:border-zinc-800">
                  <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">
                    2. Default Pricing & Batch Stock
                  </h3>

                  {/* Live Summary Badge for Variants & Total Stock */}
                  <div
                    data-testid="batch-stock-live-summary"
                    className="flex items-center gap-3 px-3.5 py-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-800"
                  >
                    <div>
                      <span className="text-[10px] font-bold text-slate-500 dark:text-zinc-400 block">
                        মোট ভ্যারিয়েন্ট (Variants)
                      </span>
                      <strong className="text-sm font-mono font-extrabold text-slate-900 dark:text-white">
                        {workspaceVariantSummary.activeVariants} টি
                      </strong>
                    </div>
                    <div className="h-6 w-px bg-emerald-200 dark:bg-emerald-800" />
                    <div>
                      <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400 block">
                        মোট স্টক (Total Stock)
                      </span>
                      <strong className="text-sm font-mono font-extrabold text-emerald-700 dark:text-emerald-300">
                        {workspaceVariantSummary.totalStock} পিস
                      </strong>
                    </div>
                  </div>
                </div>

                {/* Default Variant Fields Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 dark:text-zinc-300 mb-1">
                      {pickText('ডিফল্ট কালার', 'Default Color')} <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={prodColor}
                      onChange={(e) => {
                        setProdColor(e.target.value);
                        setHasUnsavedChanges(true);
                      }}
                      placeholder="Black / White / Navy"
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-zinc-950 border border-slate-300 dark:border-zinc-700 font-bold text-slate-900 dark:text-white focus:outline-none focus:border-emerald-600"
                    />
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {(isClothingStore
                        ? QUICK_COLOR_SUGGESTIONS_CLOTHING
                        : QUICK_COLOR_SUGGESTIONS_SPORTS
                      ).map((clr) => (
                        <button
                          key={clr}
                          type="button"
                          onClick={() => setProdColor(clr)}
                          className={`px-2 py-0.5 rounded-md text-[10px] font-bold cursor-pointer transition ${
                            prodColor.trim().toLowerCase() === clr.toLowerCase()
                              ? 'bg-emerald-600 text-white'
                              : 'bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 text-slate-600 dark:text-zinc-300'
                          }`}
                        >
                          {clr}
                        </button>
                      ))}
                    </div>
                  </div>

                  {showBuyingCost && (
                    <div>
                      <label className="block text-[11px] font-bold text-purple-700 dark:text-purple-300 mb-1">
                        {pickText('কেনা দাম (৳)', 'Buying Price (৳)')} <span className="text-[10px] font-normal">(Owner)</span>
                      </label>
                      <input
                        type="number"
                        min={0}
                        value={prodBaseCost}
                        onChange={(e) => {
                          setProdBaseCost(Math.max(0, Number(e.target.value) || 0));
                          setHasUnsavedChanges(true);
                        }}
                        className="w-full px-3 py-2 rounded-xl bg-purple-50/40 dark:bg-purple-950/30 border border-purple-300 dark:border-purple-800 font-mono font-bold text-purple-700 dark:text-purple-300 focus:outline-none"
                      />
                      <span className="text-[10px] text-slate-400 block mt-1">
                        {pickText('নতুন ভ্যারিয়েন্টের ডিফল্ট কেনা মূল্য', 'Default buying price for new variants')}
                      </span>
                    </div>
                  )}

                  <div>
                    <label className="block text-[11px] font-bold text-emerald-700 dark:text-emerald-300 mb-1">
                      {pickText('বিক্রয় দাম (৳)', 'Selling Price (৳)')} <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={prodBaseMrp}
                      onChange={(e) => {
                        setProdBaseMrp(Math.max(0, Number(e.target.value) || 0));
                        setHasUnsavedChanges(true);
                      }}
                      className="w-full px-3 py-2 rounded-xl bg-emerald-50/40 dark:bg-emerald-950/30 border border-emerald-300 dark:border-emerald-800 font-mono font-bold text-emerald-700 dark:text-emerald-300 focus:outline-none"
                    />
                    <span className="text-[10px] text-slate-400 block mt-1">
                      {pickText('নতুন ভ্যারিয়েন্টের ডিফল্ট বিক্রয় মূল্য', 'Default selling price for new variants')}
                    </span>
                  </div>

                  <div>
                    <label className="flex items-center gap-1 text-[11px] font-bold text-slate-700 dark:text-zinc-300 mb-1">
                      <span>{pickText('সর্বনিম্ন বিক্রয় মূল্য (৳)', 'Floor / Bottom Price (৳)')}</span>
                      <InfoTooltip text="Minimum selling price allowed at the counter without Owner PIN approval." />
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={prodBaseFloor}
                      onChange={(e) => {
                        setProdBaseFloor(Math.max(0, Number(e.target.value) || 0));
                        setHasUnsavedChanges(true);
                      }}
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-zinc-950 border border-slate-300 dark:border-zinc-700 font-mono font-bold text-slate-900 dark:text-white focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-extrabold text-emerald-800 dark:text-emerald-300 mb-1">
                      {pickText('প্রতি ভ্যারিয়েন্টের স্টক', 'Batch Stock')}
                    </label>
                    <input
                      type="number"
                      min={0}
                      data-testid="batch-stock-input"
                      value={quickBatchStock}
                      onChange={(e) =>
                        setQuickBatchStock(Math.max(0, Math.floor(Number(e.target.value) || 0)))
                      }
                      className="w-full px-3 py-2 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/40 border-2 border-emerald-500/70 font-mono font-extrabold text-emerald-900 dark:text-emerald-200 focus:outline-none"
                    />
                    <p
                      data-testid="batch-stock-helper-text"
                      className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400 mt-1 leading-snug"
                    >
                      প্রতিটি নতুন সাইজ/ভ্যারিয়েন্টে এই পরিমাণ স্টক যোগ হবে।
                    </p>
                  </div>
                </div>

                {/* Smart Quick Variant Generation Controls */}
                <div className="p-3.5 rounded-xl bg-emerald-50/60 dark:bg-zinc-950 border border-emerald-200/80 dark:border-zinc-800 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="text-xs font-extrabold text-emerald-950 dark:text-emerald-200">
                      এক ক্লিকে <span className="underline decoration-emerald-500">"{prodColor || 'Black'}"</span> কালারের সাইজ জেনারেট করুন (প্রতি সাইজে {quickBatchStock} পিস করে স্টক যুক্ত হবে):
                    </div>
                    {workspaceVariantSummary.uniqueColors.length > 0 && (
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-[10px] text-slate-500">যুক্ত কালারসমূহ:</span>
                        {workspaceVariantSummary.uniqueColors.map((c) => (
                          <span
                            key={c}
                            className="px-2 py-0.5 rounded-md bg-white dark:bg-zinc-900 border border-emerald-200 dark:border-zinc-700 text-[10px] font-bold text-emerald-800 dark:text-emerald-300"
                          >
                            {c}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {/* Recommended Preset for Current Category */}
                    <button
                      type="button"
                      onClick={() =>
                        handleAddColorSizeBatch(
                          getRecommendedSizePresetForCategory(prodCategory),
                          prodColor
                        )
                      }
                      className="px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs cursor-pointer inline-flex items-center gap-1.5 shadow-2xs transition"
                    >
                      <Layers className="w-3.5 h-3.5" />
                      <span>
                        + {prodCategory || 'Category'} Preset (
                        {getRecommendedSizePresetForCategory(prodCategory).join(', ')})
                      </span>
                    </button>

                    <button
                      type="button"
                      data-testid="preset-btn-clothing-sizes"
                      onClick={() => handleAddColorSizeBatch(CLOTHING_SIZE_PRESETS, prodColor)}
                      className="px-3 py-2 rounded-xl bg-white dark:bg-zinc-900 border border-slate-300 dark:border-zinc-700 hover:border-emerald-500 font-bold text-xs cursor-pointer transition"
                    >
                      + S, M, L, XL, XXL
                    </button>

                    {isClothingStore ? (
                      <>
                        <button
                          type="button"
                          data-testid="preset-btn-waist-sizes"
                          onClick={() => handleAddColorSizeBatch(WAIST_SIZE_PRESETS, prodColor)}
                          className="px-3 py-2 rounded-xl bg-white dark:bg-zinc-900 border border-slate-300 dark:border-zinc-700 hover:border-emerald-500 font-bold text-xs cursor-pointer transition"
                        >
                          + Waist 28–38 (Pant/Jeans)
                        </button>
                        <button
                          type="button"
                          data-testid="preset-btn-panjabi-sizes"
                          onClick={() => handleAddColorSizeBatch(PANJABI_SIZE_PRESETS, prodColor)}
                          className="px-3 py-2 rounded-xl bg-white dark:bg-zinc-900 border border-slate-300 dark:border-zinc-700 hover:border-emerald-500 font-bold text-xs cursor-pointer transition"
                        >
                          + Panjabi 38–46
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          type="button"
                          data-testid="preset-btn-jersey-sizes"
                          onClick={() => handleAddColorSizeBatch(JERSEY_SIZE_PRESETS, prodColor)}
                          className="px-3 py-2 rounded-xl bg-white dark:bg-zinc-900 border border-slate-300 dark:border-zinc-700 hover:border-emerald-500 font-bold text-xs cursor-pointer transition"
                        >
                          + Jersey S, M, L, XL, XXL, 3XL
                        </button>
                        <button
                          type="button"
                          onClick={() => handleAddColorSizeBatch(KIDS_JERSEY_SIZE_PRESETS, prodColor)}
                          className="px-3 py-2 rounded-xl bg-white dark:bg-zinc-900 border border-slate-300 dark:border-zinc-700 hover:border-emerald-500 font-bold text-xs cursor-pointer transition"
                        >
                          + Kids 24, 26, 28, 30
                        </button>
                      </>
                    )}

                    <button
                      type="button"
                      data-testid="add-single-variant-row-btn"
                      onClick={handleAddSingleVariantRow}
                      className="px-3 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-white font-bold text-xs cursor-pointer inline-flex items-center gap-1 transition"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>+ Add Single Row</span>
                    </button>
                  </div>

                  {/* Custom Sizes & Optional Confirmed Batch Apply to Existing Rows */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pt-2 border-t border-emerald-200/60 dark:border-zinc-800">
                    <div className="flex items-center gap-2 flex-1 max-w-md">
                      <input
                        type="text"
                        value={customSizesInput}
                        onChange={(e) => setCustomSizesInput(e.target.value)}
                        placeholder="কাস্টম সাইজ লিখুন (যেমন: 3XL, 4XL, 48, Free Size)"
                        className="flex-1 px-3 py-1.5 rounded-xl bg-white dark:bg-zinc-900 border border-slate-300 dark:border-zinc-700 text-xs"
                      />
                      <button
                        type="button"
                        onClick={handleAddCustomSizesBatch}
                        className="px-3 py-1.5 rounded-xl bg-emerald-100 hover:bg-emerald-200 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 font-bold text-xs cursor-pointer shrink-0 transition"
                      >
                        + কাস্টম সাইজ যোগ
                      </button>
                    </div>

                    {prodVariants.length > 0 && (
                      <div className="flex items-center gap-2">
                        {pendingBatchApplyConfirm ? (
                          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-amber-50 dark:bg-amber-950/60 border border-amber-300 dark:border-amber-800 text-[11px]">
                            <span className="font-bold text-amber-800 dark:text-amber-200">
                              সব ({prodVariants.length}টি) ভ্যারিয়েন্টে ডিফল্ট দাম ও প্রতিটিতে {quickBatchStock} পিস স্টক সেট করবেন?
                            </span>
                            <button
                              type="button"
                              onClick={handleConfirmApplyDefaultsToAllVariants}
                              className="px-2 py-0.5 rounded-lg bg-amber-600 text-white font-bold cursor-pointer"
                            >
                              হ্যাঁ, নিশ্চিত
                            </button>
                            <button
                              type="button"
                              onClick={() => setPendingBatchApplyConfirm(false)}
                              className="px-2 py-0.5 rounded-lg bg-white dark:bg-zinc-800 text-slate-600 font-bold cursor-pointer"
                            >
                              না
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setPendingBatchApplyConfirm(true)}
                            className="text-[11px] font-bold text-slate-600 hover:text-emerald-700 dark:text-zinc-400 dark:hover:text-emerald-300 underline cursor-pointer"
                          >
                            বিদ্যমান সব সারিতে ডিফল্ট দাম/স্টক প্রয়োগ করুন
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </section>

              {/* ================================================================= */}
              {/* STEP 4: VARIANT TABLE & INDIVIDUAL EDITING                        */}
              {/* ================================================================= */}
              <section className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-4 sm:p-5 shadow-2xs space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-100 dark:border-zinc-800">
                  <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">
                    3. Variant Table ({prodVariants.length} rows)
                  </h3>

                  <div className="text-xs font-bold text-slate-700 dark:text-zinc-300">
                    সক্রিয় ভ্যারিয়েন্ট: <span className="font-mono text-emerald-600">{workspaceVariantSummary.activeVariants}</span> • মোট স্টক:{' '}
                    <span className="font-mono text-emerald-600">{workspaceVariantSummary.totalStock} pcs</span>
                  </div>
                </div>

                {/* Audit Reason Banner when editing an existing product and stock quantities were modified */}
                {editingProduct && pendingEditStockChanges.length > 0 && (
                  <div className="p-3.5 rounded-xl bg-amber-50/90 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="space-y-0.5">
                      <div className="text-xs font-extrabold text-amber-900 dark:text-amber-200 flex items-center gap-1.5">
                        <History className="w-4 h-4 text-amber-600 shrink-0" />
                        <span>
                          {pendingEditStockChanges.length}টি ভ্যারিয়েন্টের স্টক পরিবর্তন শনাক্ত হয়েছে (Stock Audit Trail)
                        </span>
                      </div>
                      <p className="text-[11px] text-amber-800 dark:text-amber-300">
                        সেভ করার সাথে সাথে স্টক হিস্ট্রি খাতায় পূর্বের স্টক, নতুন স্টক এবং পার্থক্য অটো রেকর্ড হবে।
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <label className="text-[11px] font-bold text-amber-900 dark:text-amber-200">
                        সংশোধনের কারণ:
                      </label>
                      <select
                        value={editStockReason}
                        onChange={(e) => setEditStockReason(e.target.value)}
                        className="px-3 py-1.5 rounded-xl bg-white dark:bg-zinc-900 border border-amber-300 dark:border-amber-700 text-xs font-bold text-slate-900 dark:text-white"
                      >
                        {STOCK_CORRECTION_REASONS.map((r) => (
                          <option key={r} value={r}>
                            {r}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}

                {/* Pending Variant Removal Safety Prompt */}
                {pendingVariantRemovalIdx !== null && prodVariants[pendingVariantRemovalIdx] && (
                  <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-300 dark:border-rose-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <div className="text-xs font-extrabold text-rose-800 dark:text-rose-200">
                        ভ্যারিয়েন্ট মুছে ফেলার নিশ্চিতকরণ: "{prodVariants[pendingVariantRemovalIdx].color} / {prodVariants[pendingVariantRemovalIdx].size}"
                      </div>
                      <p className="text-[11px] text-rose-700 dark:text-rose-300">
                        এটি পূর্বের সেভ করা ভ্যারিয়েন্ট। পুরনো ইনভয়েস ও রিপোর্ট অক্ষুণ্ণ রাখতে ডিলিট না করে নিষ্ক্রিয় (Inactive) করার পরামর্শ দেওয়া হচ্ছে।
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleDeactivateVariantInsteadOfRemove(pendingVariantRemovalIdx)}
                        className="px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs cursor-pointer"
                      >
                        নিষ্ক্রিয় (Inactive) করুন
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRemoveVariantRow(pendingVariantRemovalIdx)}
                        className="px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs cursor-pointer"
                      >
                        স্থায়ীভাবে মুছুন
                      </button>
                      <button
                        type="button"
                        onClick={() => setPendingVariantRemovalIdx(null)}
                        className="px-3 py-1.5 rounded-xl bg-white dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 font-bold text-xs cursor-pointer"
                      >
                        বাতিল
                      </button>
                    </div>
                  </div>
                )}

                {/* DESKTOP / TABLET TABLE VIEW */}
                <div className="hidden md:block border border-slate-200 dark:border-zinc-800 rounded-2xl overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="bg-slate-100 dark:bg-zinc-950 text-slate-600 dark:text-zinc-400 font-bold border-b border-slate-200 dark:border-zinc-800">
                          <th className="py-2.5 px-3">#</th>
                          <th className="py-2.5 px-3">{pickText('কালার *', 'Color *')}</th>
                          <th className="py-2.5 px-3">{pickText('সাইজ *', 'Size *')}</th>
                          <th className="py-2.5 px-3">SKU / Barcode</th>
                          {showBuyingCost && <th className="py-2.5 px-3">{pickText('কেনা দাম (৳)', 'Buying Price (৳)')}</th>}
                          <th className="py-2.5 px-3">{pickText('বিক্রয় দাম (৳) *', 'Selling Price (৳) *')}</th>
                          <th className="py-2.5 px-3">{pickText('সর্বনিম্ন দাম (৳)', 'Floor Price (৳)')}</th>
                          <th className="py-2.5 px-3 text-center">{pickText('মজুদ স্টক (পিস)', 'Available Stock (Pcs)')}</th>
                          <th className="py-2.5 px-3 text-center">Status</th>
                          <th className="py-2.5 px-3 text-center">Remove</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
                        {prodVariants.map((variant, idx) => {
                          const rowErrors = formValidation.variantRowErrors[idx] || [];
                          const isInactive = variant.isActive === false;
                          return (
                            <React.Fragment key={variant.id || idx}>
                              <tr
                                className={`${
                                  isInactive
                                    ? 'bg-slate-50/70 dark:bg-zinc-900/40 opacity-60'
                                    : rowErrors.length > 0 && showValidationErrors
                                    ? 'bg-rose-50/40 dark:bg-rose-950/20'
                                    : 'hover:bg-slate-50/70 dark:hover:bg-zinc-800/30'
                                }`}
                              >
                                <td className="p-2.5 font-mono text-[11px] text-slate-400">
                                  {idx + 1}
                                </td>
                                <td className="p-2">
                                  <input
                                    type="text"
                                    value={variant.color || ''}
                                    onChange={(e) =>
                                      handleUpdateVariantField(idx, 'color', e.target.value)
                                    }
                                    placeholder="Black"
                                    className="w-28 px-2.5 py-1.5 rounded-lg bg-slate-50 dark:bg-zinc-950 border border-slate-300 dark:border-zinc-700 font-semibold"
                                  />
                                </td>
                                <td className="p-2">
                                  <input
                                    type="text"
                                    value={variant.size}
                                    onChange={(e) =>
                                      handleUpdateVariantField(idx, 'size', e.target.value)
                                    }
                                    placeholder="M"
                                    className="w-20 px-2.5 py-1.5 rounded-lg bg-slate-50 dark:bg-zinc-950 border border-slate-300 dark:border-zinc-700 font-mono font-bold"
                                  />
                                </td>
                                <td className="p-2">
                                  <input
                                    type="text"
                                    value={variant.sku || ''}
                                    onChange={(e) =>
                                      handleUpdateVariantField(idx, 'sku', e.target.value)
                                    }
                                    placeholder="Auto SKU"
                                    className="w-36 px-2.5 py-1.5 rounded-lg bg-slate-50 dark:bg-zinc-950 border border-slate-300 dark:border-zinc-700 font-mono text-[11px]"
                                  />
                                </td>
                                {showBuyingCost && (
                                  <td className="p-2">
                                    <input
                                      type="number"
                                      min={0}
                                      value={variant.costPrice}
                                      onChange={(e) =>
                                        handleUpdateVariantField(
                                          idx,
                                          'costPrice',
                                          Math.max(0, Number(e.target.value) || 0)
                                        )
                                      }
                                      className="w-24 px-2.5 py-1.5 rounded-lg bg-purple-50/50 dark:bg-purple-950/30 border border-purple-300 dark:border-purple-800 font-mono font-bold text-purple-700 dark:text-purple-300"
                                    />
                                  </td>
                                )}
                                <td className="p-2">
                                  <input
                                    type="number"
                                    min={0}
                                    value={variant.mrp}
                                    onChange={(e) =>
                                      handleUpdateVariantField(
                                        idx,
                                        'mrp',
                                        Math.max(0, Number(e.target.value) || 0)
                                      )
                                    }
                                    className="w-24 px-2.5 py-1.5 rounded-lg bg-emerald-50/50 dark:bg-emerald-950/30 border border-emerald-300 dark:border-emerald-800 font-mono font-bold text-emerald-700 dark:text-emerald-300"
                                  />
                                </td>
                                <td className="p-2">
                                  <input
                                    type="number"
                                    min={0}
                                    value={variant.bottomPrice}
                                    onChange={(e) =>
                                      handleUpdateVariantField(
                                        idx,
                                        'bottomPrice',
                                        Math.max(0, Number(e.target.value) || 0)
                                      )
                                    }
                                    className="w-24 px-2.5 py-1.5 rounded-lg bg-slate-50 dark:bg-zinc-950 border border-slate-300 dark:border-zinc-700 font-mono"
                                  />
                                </td>
                                <td className="p-2">
                                  <div className="flex items-center justify-center gap-1">
                                    <button
                                      type="button"
                                      onClick={() =>
                                        handleUpdateVariantField(
                                          idx,
                                          'stock',
                                          Math.max(0, (Number(variant.stock) || 0) - 1)
                                        )
                                      }
                                      className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 font-mono font-bold text-slate-700 dark:text-zinc-200 cursor-pointer"
                                    >
                                      -
                                    </button>
                                    <input
                                      type="number"
                                      min={0}
                                      data-testid={`variant-stock-input-${idx}`}
                                      value={variant.stock}
                                      onChange={(e) =>
                                        handleUpdateVariantField(
                                          idx,
                                          'stock',
                                          Math.max(0, Math.floor(Number(e.target.value) || 0))
                                        )
                                      }
                                      className="w-20 px-2 py-1.5 rounded-lg bg-white dark:bg-zinc-900 border-2 border-emerald-500/60 font-mono font-extrabold text-center"
                                    />
                                    <button
                                      type="button"
                                      onClick={() =>
                                        handleUpdateVariantField(
                                          idx,
                                          'stock',
                                          (Number(variant.stock) || 0) + 1
                                        )
                                      }
                                      className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 font-mono font-bold text-slate-700 dark:text-zinc-200 cursor-pointer"
                                    >
                                      +
                                    </button>
                                  </div>
                                </td>
                                <td className="p-2 text-center">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleUpdateVariantField(
                                        idx,
                                        'isActive',
                                        variant.isActive === false ? true : false
                                      )
                                    }
                                    className={`px-2.5 py-1 rounded-lg text-[10px] font-bold cursor-pointer transition ${
                                      variant.isActive !== false
                                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300'
                                        : 'bg-slate-200 text-slate-600 dark:bg-zinc-800 dark:text-zinc-400'
                                    }`}
                                  >
                                    {variant.isActive !== false ? 'Active' : 'Inactive'}
                                  </button>
                                </td>
                                <td className="p-2 text-center">
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveVariantRow(idx)}
                                    className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer"
                                    title="Remove Variant"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </td>
                              </tr>
                              {rowErrors.length > 0 && (
                                <tr className="bg-rose-50/70 dark:bg-rose-950/30">
                                  <td
                                    colSpan={showBuyingCost ? 10 : 9}
                                    className="px-3 py-1.5 text-[11px] font-bold text-rose-600 dark:text-rose-300"
                                  >
                                    ⚠️ {rowErrors.join(' • ')}
                                  </td>
                                </tr>
                              )}
                            </React.Fragment>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* MOBILE STACKED VARIANT CARDS VIEW (< 768px) */}
                <div className="md:hidden space-y-2.5">
                  {prodVariants.map((variant, idx) => {
                    const rowErrors = formValidation.variantRowErrors[idx] || [];
                    return (
                      <div
                        key={variant.id || idx}
                        className="p-3 rounded-xl bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 space-y-2.5"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-mono font-bold text-[11px] text-emerald-700 dark:text-emerald-400">
                            Variant #{idx + 1} • {variant.color || 'Color'} / {variant.size || 'Size'}
                          </span>
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() =>
                                handleUpdateVariantField(
                                  idx,
                                  'isActive',
                                  variant.isActive === false ? true : false
                                )
                              }
                              className={`px-2 py-0.5 rounded-md text-[10px] font-bold cursor-pointer ${
                                variant.isActive !== false
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : 'bg-slate-200 text-slate-600'
                              }`}
                            >
                              {variant.isActive !== false ? 'Active' : 'Inactive'}
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRemoveVariantRow(idx)}
                              className="p-1 rounded-lg text-rose-500 hover:bg-rose-100 cursor-pointer"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="block text-[10px] font-bold text-slate-500 mb-0.5">
                              Color *
                            </label>
                            <input
                              type="text"
                              value={variant.color || ''}
                              onChange={(e) =>
                                handleUpdateVariantField(idx, 'color', e.target.value)
                              }
                              className="w-full px-2.5 py-1.5 rounded-lg bg-white dark:bg-zinc-900 border border-slate-300 dark:border-zinc-700 font-semibold"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold text-slate-500 mb-0.5">
                              Size *
                            </label>
                            <input
                              type="text"
                              value={variant.size}
                              onChange={(e) =>
                                handleUpdateVariantField(idx, 'size', e.target.value)
                              }
                              className="w-full px-2.5 py-1.5 rounded-lg bg-white dark:bg-zinc-900 border border-slate-300 dark:border-zinc-700 font-mono font-bold"
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="block text-[10px] font-bold text-slate-500 mb-0.5">
                              SKU / Barcode
                            </label>
                            <input
                              type="text"
                              value={variant.sku || ''}
                              onChange={(e) =>
                                handleUpdateVariantField(idx, 'sku', e.target.value)
                              }
                              className="w-full px-2.5 py-1.5 rounded-lg bg-white dark:bg-zinc-900 border border-slate-300 dark:border-zinc-700 font-mono text-[11px]"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold text-emerald-700 mb-0.5">
                              Stock (Pcs) *
                            </label>
                            <input
                              type="number"
                              min={0}
                              value={variant.stock}
                              onChange={(e) =>
                                handleUpdateVariantField(
                                  idx,
                                  'stock',
                                  Math.max(0, Math.floor(Number(e.target.value) || 0))
                                )
                              }
                              className="w-full px-2.5 py-1.5 rounded-lg bg-white dark:bg-zinc-900 border-2 border-emerald-500/70 font-mono font-extrabold"
                            />
                          </div>
                        </div>

                        <div className={`grid ${showBuyingCost ? 'grid-cols-3' : 'grid-cols-2'} gap-2`}>
                          {showBuyingCost && (
                            <div>
                              <label className="block text-[10px] font-bold text-purple-600 mb-0.5">
                                Buying (৳)
                              </label>
                              <input
                                type="number"
                                min={0}
                                value={variant.costPrice}
                                onChange={(e) =>
                                  handleUpdateVariantField(
                                    idx,
                                    'costPrice',
                                    Math.max(0, Number(e.target.value) || 0)
                                  )
                                }
                                className="w-full px-2 py-1.5 rounded-lg bg-white dark:bg-zinc-900 border border-purple-300 font-mono font-bold text-purple-700"
                              />
                            </div>
                          )}
                          <div>
                            <label className="block text-[10px] font-bold text-emerald-700 mb-0.5">
                              Selling (৳) *
                            </label>
                            <input
                              type="number"
                              min={0}
                              value={variant.mrp}
                              onChange={(e) =>
                                handleUpdateVariantField(
                                  idx,
                                  'mrp',
                                  Math.max(0, Number(e.target.value) || 0)
                                )
                              }
                              className="w-full px-2 py-1.5 rounded-lg bg-white dark:bg-zinc-900 border border-emerald-300 font-mono font-bold text-emerald-700"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold text-slate-500 mb-0.5">
                              Floor (৳)
                            </label>
                            <input
                              type="number"
                              min={0}
                              value={variant.bottomPrice}
                              onChange={(e) =>
                                handleUpdateVariantField(
                                  idx,
                                  'bottomPrice',
                                  Math.max(0, Number(e.target.value) || 0)
                                )
                              }
                              className="w-full px-2 py-1.5 rounded-lg bg-white dark:bg-zinc-900 border border-slate-300 font-mono"
                            />
                          </div>
                        </div>

                        {rowErrors.length > 0 && (
                          <div className="text-[10px] font-bold text-rose-600">
                            ⚠️ {rowErrors.join(' • ')}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </section>
            </form>
          </div>

          {/* 3. FIXED BOTTOM ACTION BAR (ALWAYS VISIBLE WITHOUT SCROLLING) */}
          <footer className="shrink-0 bg-white dark:bg-zinc-900 border-t border-slate-200 dark:border-zinc-800 px-4 sm:px-6 lg:px-8 py-3 shadow-lg">
            <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3 flex-wrap text-xs">
                <span className="font-bold text-slate-700 dark:text-zinc-300">
                  মোট ভ্যারিয়েন্ট:{' '}
                  <strong className="font-mono text-emerald-700 dark:text-emerald-400">
                    {workspaceVariantSummary.activeVariants} টি
                  </strong>
                </span>
                <span className="text-slate-300 dark:text-zinc-700">•</span>
                <span className="font-bold text-slate-700 dark:text-zinc-300">
                  মোট স্টক:{' '}
                  <strong className="font-mono text-emerald-700 dark:text-emerald-400">
                    {workspaceVariantSummary.totalStock} পিস
                  </strong>
                </span>
                {!formValidation.isValid && (
                  <span className="text-[11px] font-semibold text-amber-600 dark:text-amber-400">
                    ({formValidation.errors[0]})
                  </span>
                )}
              </div>

              <div className="flex items-center justify-end gap-2.5">
                {showUnsavedCloseConfirm ? (
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-300 dark:border-rose-800 text-xs">
                    <span className="font-bold text-rose-800 dark:text-rose-200">
                      আনসেভড পরিবর্তন বাতিল করে বের হবেন?
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setShowUnsavedCloseConfirm(false);
                        setHasUnsavedChanges(false);
                        setIsProductModalOpen(false);
                      }}
                      className="px-2.5 py-1 rounded-lg bg-rose-600 text-white font-bold cursor-pointer"
                    >
                      হ্যাঁ, বন্ধ করুন
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowUnsavedCloseConfirm(false)}
                      className="px-2.5 py-1 rounded-lg bg-white dark:bg-zinc-800 text-slate-700 dark:text-zinc-200 font-bold cursor-pointer"
                    >
                      ফিরে যান
                    </button>
                  </div>
                ) : (
                  <>
                    <button
                      type="button"
                      data-testid="cancel-product-workspace-btn"
                      onClick={handleRequestCloseProductModal}
                      className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-300 font-bold text-xs cursor-pointer transition"
                    >
                      {pickText('বাতিল', 'Cancel')}
                    </button>
                    <button
                      type="button"
                      data-testid="save-product-workspace-btn"
                      disabled={isSavingProduct}
                      onClick={() => handleSaveProduct()}
                      className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold text-xs flex items-center gap-2 shadow-sm cursor-pointer transition"
                    >
                      <Save className="w-4 h-4" />
                      <span>
                        {isSavingProduct
                          ? pickText('সেভ হচ্ছে...', 'Saving...')
                          : editingProduct
                          ? pickText('প্রোডাক্ট ও ভ্যারিয়েন্ট পরিবর্তন সেভ করুন', 'Save Product & Variant Changes')
                          : pickText('ইনভেন্টরিতে সেভ করুন', 'Save Product to Inventory')}
                      </span>
                    </button>
                  </>
                )}
              </div>
            </div>
          </footer>
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODAL 2: QUICK STOCK CORRECTION WITH MANDATORY AUDIT TRAIL            */}
      {/* ===================================================================== */}
      {correctionTarget && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-3xl max-w-md w-full p-5 sm:p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-zinc-800">
              <div>
                <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                  {pickText('স্টক পরিমাণ সংশোধন', 'Correct Variant Stock')}
                </h3>
                <p className="text-xs text-slate-500 dark:text-zinc-400">
                  {correctionTarget.product.name} •{' '}
                  {correctionTarget.variant.color || correctionTarget.product.color || 'Default'} •
                  Size: {correctionTarget.variant.size}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setCorrectionTarget(null)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleConfirmStockCorrection} className="space-y-4 text-xs">
              <div className="grid grid-cols-3 gap-2.5 text-center">
                <div className="p-3 rounded-2xl bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800">
                  <span className="text-[10px] text-slate-400 block">পূর্বের স্টক</span>
                  <strong className="text-base font-mono font-bold text-slate-700 dark:text-zinc-300">
                    {correctionTarget.variant.stock} pcs
                  </strong>
                </div>
                <div className="p-3 rounded-2xl bg-emerald-50/70 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800">
                  <span className="text-[10px] text-emerald-700 dark:text-emerald-300 block font-bold">
                    সঠিক স্টক লিখুন
                  </span>
                  <input
                    type="number"
                    min={0}
                    required
                    value={correctionNewQty}
                    onChange={(e) => setCorrectionNewQty(Math.max(0, Number(e.target.value) || 0))}
                    className="w-full text-center text-base font-mono font-extrabold bg-transparent text-emerald-700 dark:text-emerald-300 focus:outline-none"
                  />
                </div>
                <div className="p-3 rounded-2xl bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800">
                  <span className="text-[10px] text-slate-400 block">পার্থক্য (Diff)</span>
                  <strong
                    className={`text-base font-mono font-bold ${
                      correctionNewQty - correctionTarget.variant.stock >= 0
                        ? 'text-emerald-600'
                        : 'text-rose-600'
                    }`}
                  >
                    {correctionNewQty - correctionTarget.variant.stock >= 0
                      ? `+${correctionNewQty - correctionTarget.variant.stock}`
                      : correctionNewQty - correctionTarget.variant.stock}{' '}
                    pcs
                  </strong>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-zinc-300 mb-1">
                  সংশোধনের কারণ নির্বাচন করুন (Reason) *
                </label>
                <select
                  value={correctionReasonPreset}
                  onChange={(e) => setCorrectionReasonPreset(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-zinc-950 border border-slate-300 dark:border-zinc-800 font-semibold"
                >
                  {STOCK_CORRECTION_REASONS.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-zinc-300 mb-1">
                  অতিরিক্ত নোট (ঐচ্ছিক)
                </label>
                <input
                  type="text"
                  value={correctionCustomReason}
                  onChange={(e) => setCorrectionCustomReason(e.target.value)}
                  placeholder="যেমন: ভুলবশত ৪০ পিস এন্ট্রি হয়েছিল, আসলে ৩০ পিস আছে"
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-zinc-950 border border-slate-300 dark:border-zinc-800"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setCorrectionTarget(null)}
                  className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 font-bold cursor-pointer"
                >
                  বাতিল
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold cursor-pointer flex items-center gap-1.5"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Confirm Stock Correction</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODAL 3: STOCK MOVEMENT & ADJUSTMENT AUDIT LEDGER                     */}
      {/* ===================================================================== */}
      {isLedgerModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-in fade-in duration-150">
          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-3xl max-w-4xl w-full p-5 sm:p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200 dark:border-zinc-800">
              <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                Stock Audit Ledger
              </h3>

              <div className="flex items-center gap-2">
                <select
                  value={ledgerFilter}
                  onChange={(e) => setLedgerFilter(e.target.value as any)}
                  className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-zinc-800 text-xs font-bold"
                >
                  <option value="ALL">All Movements ({stockAdjustments.length})</option>
                  <option value="sale">POS Sales Only</option>
                  <option value="manual_correction">Manual Corrections Only</option>
                  <option value="return">Returns / Cancellations</option>
                </select>
                <button
                  type="button"
                  onClick={() => setIsLedgerModalOpen(false)}
                  className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {filteredLedger.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-500">
                এখনো কোনো স্টক মুভমেন্ট বা সংশোধন রেকর্ড করা হয়নি।
              </div>
            ) : (
              <>
                {/* Mobile Compact Audit Rows (< 768px) */}
                <div className="md:hidden divide-y divide-slate-100 dark:divide-zinc-800 border border-slate-100 dark:border-zinc-800 rounded-2xl overflow-hidden">
                  {filteredLedger.slice(0, 100).map((rec) => (
                    <div key={rec.id} className="px-3.5 py-2.5 flex items-center justify-between gap-2.5 text-xs">
                      <div className="min-w-0 flex-1">
                        <div className="font-bold text-slate-900 dark:text-white truncate">
                          {rec.productName} ({rec.size})
                        </div>
                        <div className="text-[11px] text-slate-500 truncate">
                          {rec.reason} • {rec.responsibleUser}
                        </div>
                      </div>
                      <div className="text-right shrink-0 font-mono">
                        <div className={`font-black ${rec.difference >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                          {rec.difference >= 0 ? `+${rec.difference}` : rec.difference} ({rec.previousQty}→{rec.newQty})
                        </div>
                        <div className="text-[10px] text-slate-400">
                          {new Date(rec.timestamp).toLocaleDateString('en-GB')}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Desktop Table (>= 768px) */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-50 dark:bg-zinc-950 text-slate-500 border-b border-slate-200 dark:border-zinc-800 font-bold">
                        <th className="py-2.5 px-3">সময় (Time)</th>
                        <th className="py-2.5 px-3">প্রোডাক্ট ও ভ্যারিয়েন্ট</th>
                        <th className="py-2.5 px-3">ধরণ (Type)</th>
                        <th className="py-2.5 px-3 text-center">পূর্বের → নতুন</th>
                        <th className="py-2.5 px-3 text-center">পরিবর্তন</th>
                        <th className="py-2.5 px-3">কারণ ও মেমো</th>
                        <th className="py-2.5 px-3">ইউজার</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
                      {filteredLedger.slice(0, 100).map((rec) => (
                        <tr key={rec.id}>
                          <td className="py-2.5 px-3 font-mono text-[11px] text-slate-500 whitespace-nowrap">
                            {new Date(rec.timestamp).toLocaleString('en-GB', {
                              day: '2-digit',
                              month: 'short',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </td>
                          <td className="py-2.5 px-3">
                            <div className="font-bold text-slate-900 dark:text-white">
                              {rec.productName}
                            </div>
                            <div className="text-[10px] text-slate-500">
                              {rec.color ? `${rec.color} • ` : ''}Size: {rec.size} • {rec.sku}
                            </div>
                          </td>
                          <td className="py-2.5 px-3">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                rec.movementType === 'sale'
                                  ? 'bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-950/60 dark:text-blue-300'
                                  : rec.movementType === 'return'
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300'
                                  : 'bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/60 dark:text-amber-300'
                              }`}
                            >
                              {rec.movementType === 'sale'
                                ? 'POS Sale'
                                : rec.movementType === 'return'
                                ? 'Return Restock'
                                : 'Manual Correction'}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-center font-mono">
                            {rec.previousQty} → <strong>{rec.newQty}</strong>
                          </td>
                          <td
                            className={`py-2.5 px-3 text-center font-mono font-bold ${
                              rec.difference >= 0 ? 'text-emerald-600' : 'text-rose-600'
                            }`}
                          >
                            {rec.difference >= 0 ? `+${rec.difference}` : rec.difference}
                          </td>
                          <td className="py-2.5 px-3 text-slate-600 dark:text-zinc-300">
                            {rec.reason}
                          </td>
                          <td className="py-2.5 px-3 font-semibold text-slate-700 dark:text-zinc-300">
                            {rec.responsibleUser}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
