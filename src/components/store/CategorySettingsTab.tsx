import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { dbService } from '../../services/db';
import {
  KitCategorySetting,
  OtherProductCategorySetting,
  ClothingCategorySetting,
  ExpenseCategorySetting,
  ApparelScaleType,
} from '../../types';
import { isClothingShop, canViewBuyingPrice } from '../../utils/securityPolicy';
import {
  Tag,
  PlusCircle,
  Trash2,
  ShoppingBag,
  ShieldCheck,
  Edit2,
  Check,
  X,
  Receipt,
  Shirt,
  Ruler,
  Type,
  Award,
} from 'lucide-react';
import { ProductVariantCatalogManager } from '../inventory/ProductVariantCatalogManager';

export const CategorySettingsTab: React.FC = () => {
  const { currentTenant, role, reloadShopData, showToast, pickText } = useApp();
  const isClothingStore = isClothingShop(currentTenant);
  const showBuyingPrice = canViewBuyingPrice(role);

  const [kitCategories, setKitCategories] = useState<KitCategorySetting[]>(() =>
    dbService.getKitCategories(currentTenant.id)
  );
  const [otherCategories, setOtherCategories] = useState<OtherProductCategorySetting[]>(() =>
    dbService.getOtherCategories(currentTenant.id)
  );
  const [clothingCategories, setClothingCategories] = useState<ClothingCategorySetting[]>(() =>
    dbService.getClothingCategories(currentTenant.id)
  );
  const [expenseCategories, setExpenseCategories] = useState<ExpenseCategorySetting[]>(() =>
    dbService.getExpenseCategories(currentTenant.id)
  );

  // Store-level Custom Attributes (Clubs/Brands, Sizes, Font Styles, Patches)
  const initialConfig = dbService.getStoreConfig(currentTenant.id);
  const [customClubs, setCustomClubs] = useState<string[]>(initialConfig.customClubs || []);
  const [customSizes, setCustomSizes] = useState<string[]>(initialConfig.availableSizes || []);
  const [customFonts, setCustomFonts] = useState<string[]>(initialConfig.fontStyles || []);
  const [customPatches, setCustomPatches] = useState<string[]>(initialConfig.availablePatches || []);

  useEffect(() => {
    setKitCategories(dbService.getKitCategories(currentTenant.id));
    setOtherCategories(dbService.getOtherCategories(currentTenant.id));
    setClothingCategories(dbService.getClothingCategories(currentTenant.id));
    setExpenseCategories(dbService.getExpenseCategories(currentTenant.id));
    const cfg = dbService.getStoreConfig(currentTenant.id);
    setCustomClubs(cfg.customClubs || []);
    setCustomSizes(cfg.availableSizes || []);
    setCustomFonts(cfg.fontStyles || []);
    setCustomPatches(cfg.availablePatches || []);
    setNewFontPrice(cfg.defaultCustomNameNumberPrice || 250);
    setNewPatchPrice(cfg.defaultPatchPrice || 120);
  }, [currentTenant.id]);

  // New Kit Category Form (Sportswear)
  const [newKitName, setNewKitName] = useState('');
  const [newKitMrp, setNewKitMrp] = useState<number>(1200);
  const [newKitCostPrice, setNewKitCostPrice] = useState<number>(650);
  const [newKitBottomPrice, setNewKitBottomPrice] = useState<number>(1000);

  // Inline Edit Kit Category State
  const [editingKitId, setEditingKitId] = useState<string | null>(null);
  const [editKitDraft, setEditKitDraft] = useState<KitCategorySetting | null>(null);

  // New Other Category Form (Sportswear)
  const [newOtherName, setNewOtherName] = useState('');
  const [newOtherMrp, setNewOtherMrp] = useState<number>(250);
  const [newOtherCostPrice, setNewOtherCostPrice] = useState<number>(120);

  // Inline Edit Other Category State
  const [editingOtherId, setEditingOtherId] = useState<string | null>(null);
  const [editOtherDraft, setEditOtherDraft] = useState<OtherProductCategorySetting | null>(null);

  // New Men's Clothing Category Form (Clothing Sector)
  const [newClothingName, setNewClothingName] = useState('');
  const [newClothingBengali, setNewClothingBengali] = useState('');
  const [newClothingScale, setNewClothingScale] = useState<ApparelScaleType>('shirts_tops');
  const [newClothingMrp, setNewClothingMrp] = useState<number>(1150);
  const [newClothingCost, setNewClothingCost] = useState<number>(500);
  const [newClothingBottom, setNewClothingBottom] = useState<number>(900);

  // Inline Edit Clothing Category State
  const [editingClothingId, setEditingClothingId] = useState<string | null>(null);
  const [editClothingDraft, setEditClothingDraft] = useState<ClothingCategorySetting | null>(null);

  // New Expense Category Form
  const [newExpName, setNewExpName] = useState('');
  const [newExpBengali, setNewExpBengali] = useState('');
  const [editingExpId, setEditingExpId] = useState<string | null>(null);
  const [editExpDraft, setEditExpDraft] = useState<ExpenseCategorySetting | null>(null);

  // Custom Attributes Forms
  const [newClubInput, setNewClubInput] = useState('');
  const [newSizeInput, setNewSizeInput] = useState('');
  const [newFontName, setNewFontName] = useState('');
  const [newFontPrice, setNewFontPrice] = useState<number>(
    initialConfig.defaultCustomNameNumberPrice || 250
  );
  const [newPatchName, setNewPatchName] = useState('');
  const [newPatchPrice, setNewPatchPrice] = useState<number>(
    initialConfig.defaultPatchPrice || 120
  );

  // 1A. CLOTHING CATEGORY HANDLERS (Men's Clothing Store)
  const handleAddClothingCategory = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = newClothingName.trim();
    if (!cleanName) {
      showToast('ক্যাটাগরির নাম লিখুন', 'warning');
      return;
    }
    if (clothingCategories.some((c) => c.name.trim().toLowerCase() === cleanName.toLowerCase())) {
      showToast(`"${cleanName}" ক্যাটাগরি ইতিমধ্যে বিদ্যমান`, 'error');
      return;
    }

    const defaultSizes =
      newClothingScale === 'denim_pants'
        ? ['28-Reg', '30-Reg', '32-Reg', '34-Reg', '36-Reg', '38-Reg']
        : newClothingScale === 'panjabi'
        ? ['38', '40', '42', '44', '46']
        : ['S', 'M', 'L', 'XL', 'XXL'];

    const newCat: ClothingCategorySetting = {
      id: `cloth_cat_${Date.now()}`,
      name: cleanName,
      bengaliName: newClothingBengali.trim() || cleanName,
      apparelScale: newClothingScale,
      defaultMrp: Number(newClothingMrp) || 0,
      defaultCostPrice: Number(newClothingCost) || 0,
      defaultBottomPrice: Number(newClothingBottom) || Number(newClothingMrp) || 0,
      defaultSizes,
      isDefault: false,
    };

    const updated = [...clothingCategories, newCat];
    setClothingCategories(updated);
    dbService.saveClothingCategories(currentTenant.id, updated);
    reloadShopData();
    showToast(`নতুন Men's Clothing ক্যাটাগরি যুক্ত হয়েছে: ${newCat.name}`, 'success');

    setNewClothingName('');
    setNewClothingBengali('');
    setNewClothingMrp(1150);
    setNewClothingCost(500);
    setNewClothingBottom(900);
  };

  const handleSaveClothingEdit = () => {
    if (!editClothingDraft || !editClothingDraft.name.trim()) return;
    const cleanName = editClothingDraft.name.trim();
    const duplicate = clothingCategories.some(
      (c) => c.id !== editClothingDraft.id && c.name.trim().toLowerCase() === cleanName.toLowerCase()
    );
    if (duplicate) {
      showToast(`"${cleanName}" নামের ক্যাটাগরি ইতিমধ্যে বিদ্যমান`, 'error');
      return;
    }

    const updated = clothingCategories.map((c) =>
      c.id === editClothingDraft.id
        ? {
            ...editClothingDraft,
            name: cleanName,
            bengaliName: editClothingDraft.bengaliName?.trim() || cleanName,
            defaultMrp: Number(editClothingDraft.defaultMrp) || 0,
            defaultCostPrice: Number(editClothingDraft.defaultCostPrice) || 0,
            defaultBottomPrice: Number(editClothingDraft.defaultBottomPrice) || 0,
          }
        : c
    );
    setClothingCategories(updated);
    dbService.saveClothingCategories(currentTenant.id, updated);
    setEditingClothingId(null);
    setEditClothingDraft(null);
    reloadShopData();
    showToast('পোশাকের ক্যাটাগরি ও মূল্য সফলভাবে আপডেট হয়েছে!', 'success');
  };

  const handleDeleteClothingCategory = (id: string, name: string) => {
    const check = dbService.canDeleteClothingCategory(currentTenant.id, name);
    if (!check.canDelete) {
      showToast(check.reason || 'এই ক্যাটাগরিটি বর্তমানে ব্যবহৃত হচ্ছে, তাই মুছে ফেলা যাবে না।', 'error');
      return;
    }
    const updated = clothingCategories.filter((c) => c.id !== id);
    setClothingCategories(updated);
    dbService.saveClothingCategories(currentTenant.id, updated);
    reloadShopData();
    showToast(`ক্যাটাগরি "${name}" মুছে ফেলা হয়েছে`, 'info');
  };

  // 1B. KIT CATEGORY HANDLERS (Sportswear)
  const handleAddKitCategory = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = newKitName.trim();
    if (!cleanName) {
      showToast('ক্যাটাগরির নাম লিখুন', 'warning');
      return;
    }
    if (kitCategories.some((c) => c.name.toLowerCase() === cleanName.toLowerCase())) {
      showToast(`"${cleanName}" ক্যাটাগরি ইতিমধ্যে বিদ্যমান`, 'error');
      return;
    }

    const newCat: KitCategorySetting = {
      id: `kit_cat_${Date.now()}`,
      name: cleanName,
      defaultMrp: Number(newKitMrp) || 0,
      defaultCostPrice: Number(newKitCostPrice) || 0,
      defaultBottomPrice: Number(newKitBottomPrice) || Number(newKitMrp) || 0,
    };

    const updated = [...kitCategories, newCat];
    setKitCategories(updated);
    dbService.saveKitCategories(currentTenant.id, updated);
    reloadShopData();
    showToast(`নতুন জার্সি কিট ক্যাটাগরি যুক্ত হয়েছে: ${newCat.name}`, 'success');

    setNewKitName('');
    setNewKitMrp(1200);
    setNewKitCostPrice(650);
    setNewKitBottomPrice(1000);
  };

  const handleSaveKitEdit = () => {
    if (!editKitDraft || !editKitDraft.name.trim()) return;
    const updated = kitCategories.map((c) =>
      c.id === editKitDraft.id
        ? {
            ...editKitDraft,
            name: editKitDraft.name.trim(),
            defaultMrp: Number(editKitDraft.defaultMrp) || 0,
            defaultCostPrice: Number(editKitDraft.defaultCostPrice) || 0,
            defaultBottomPrice: Number(editKitDraft.defaultBottomPrice) || 0,
          }
        : c
    );
    setKitCategories(updated);
    dbService.saveKitCategories(currentTenant.id, updated);
    setEditingKitId(null);
    setEditKitDraft(null);
    reloadShopData();
    showToast('জার্সি ক্যাটাগরি সফলভাবে আপডেট হয়েছে!', 'success');
  };

  const handleDeleteKitCategory = (id: string, name: string) => {
    const check = dbService.canDeleteKitCategory(currentTenant.id, name);
    if (!check.canDelete) {
      showToast(check.reason || 'এই ক্যাটাগরিটি বর্তমানে ব্যবহৃত হচ্ছে, তাই মুছে ফেলা যাবে না।', 'error');
      return;
    }
    const updated = kitCategories.filter((c) => c.id !== id);
    setKitCategories(updated);
    dbService.saveKitCategories(currentTenant.id, updated);
    reloadShopData();
    showToast(`ক্যাটাগরি "${name}" মুছে ফেলা হয়েছে`, 'info');
  };

  // 2. OTHER PRODUCT CATEGORY HANDLERS
  const handleAddOtherCategory = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = newOtherName.trim();
    if (!cleanName) {
      showToast('পণ্যের ক্যাটাগরির নাম লিখুন', 'warning');
      return;
    }
    if (otherCategories.some((c) => c.name.toLowerCase() === cleanName.toLowerCase())) {
      showToast(`"${cleanName}" ক্যাটাগরি ইতিমধ্যে বিদ্যমান`, 'error');
      return;
    }

    const newCat: OtherProductCategorySetting = {
      id: `oth_cat_${Date.now()}`,
      name: cleanName,
      defaultMrp: Number(newOtherMrp) || 0,
      defaultCostPrice: Number(newOtherCostPrice) || 0,
    };

    const updated = [...otherCategories, newCat];
    setOtherCategories(updated);
    dbService.saveOtherCategories(currentTenant.id, updated);
    reloadShopData();
    showToast(`অন্যান্য ক্যাটাগরি যুক্ত হয়েছে: ${newCat.name}`, 'success');

    setNewOtherName('');
    setNewOtherMrp(250);
    setNewOtherCostPrice(120);
  };

  const handleSaveOtherEdit = () => {
    if (!editOtherDraft || !editOtherDraft.name.trim()) return;
    const updated = otherCategories.map((c) =>
      c.id === editOtherDraft.id
        ? {
            ...editOtherDraft,
            name: editOtherDraft.name.trim(),
            defaultMrp: Number(editOtherDraft.defaultMrp) || 0,
            defaultCostPrice: Number(editOtherDraft.defaultCostPrice) || 0,
          }
        : c
    );
    setOtherCategories(updated);
    dbService.saveOtherCategories(currentTenant.id, updated);
    setEditingOtherId(null);
    setEditOtherDraft(null);
    reloadShopData();
    showToast('অন্যান্য পণ্যের ক্যাটাগরি আপডেট হয়েছে!', 'success');
  };

  const handleDeleteOtherCategory = (id: string, name: string) => {
    const check = dbService.canDeleteOtherCategory(currentTenant.id, name);
    if (!check.canDelete) {
      showToast(check.reason || 'এই ক্যাটাগরিটি বর্তমানে ব্যবহৃত হচ্ছে, তাই মুছে ফেলা যাবে না।', 'error');
      return;
    }
    const updated = otherCategories.filter((c) => c.id !== id);
    setOtherCategories(updated);
    dbService.saveOtherCategories(currentTenant.id, updated);
    reloadShopData();
    showToast(`ক্যাটাগরি "${name}" মুছে ফেলা হয়েছে`, 'info');
  };

  // 3. EXPENSE CATEGORY HANDLERS
  const handleAddExpenseCategory = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = newExpName.trim();
    if (!cleanName) {
      showToast('খরচের খাতের নাম লিখুন', 'warning');
      return;
    }
    const slugId = cleanName.toLowerCase().replace(/[^a-z0-9]+/g, '_') || `exp_cat_${Date.now()}`;
    if (
      expenseCategories.some(
        (c) => c.id === slugId || c.label.toLowerCase() === cleanName.toLowerCase()
      )
    ) {
      showToast(`"${cleanName}" খরচের খাত ইতিমধ্যে বিদ্যমান`, 'error');
      return;
    }

    const newCat: ExpenseCategorySetting = {
      id: slugId,
      name: slugId,
      label: cleanName,
      bnLabel: newExpBengali.trim() || cleanName,
      color: 'emerald',
    };

    const updated = [...expenseCategories, newCat];
    setExpenseCategories(updated);
    dbService.saveExpenseCategories(currentTenant.id, updated);
    reloadShopData();
    showToast(`নতুন খরচের খাত যুক্ত হয়েছে: ${newCat.bnLabel || newCat.label}`, 'success');
    setNewExpName('');
    setNewExpBengali('');
  };

  const handleSaveExpEdit = () => {
    if (!editExpDraft || !editExpDraft.label.trim()) return;
    const updated = expenseCategories.map((c) =>
      c.id === editExpDraft.id
        ? {
            ...editExpDraft,
            label: editExpDraft.label.trim(),
            bnLabel: editExpDraft.bnLabel?.trim() || editExpDraft.label.trim(),
          }
        : c
    );
    setExpenseCategories(updated);
    dbService.saveExpenseCategories(currentTenant.id, updated);
    setEditingExpId(null);
    setEditExpDraft(null);
    reloadShopData();
    showToast('খরচের খাত আপডেট হয়েছে!', 'success');
  };

  const handleDeleteExpenseCategory = (id: string, name: string) => {
    const check = dbService.canDeleteExpenseCategory(currentTenant.id, id);
    if (!check.canDelete) {
      showToast(check.reason || 'এই খরচের খাতে ইতিমধ্যে লেনদেন রয়েছে, তাই মুছে ফেলা যাবে না।', 'error');
      return;
    }
    const updated = expenseCategories.filter((c) => c.id !== id);
    setExpenseCategories(updated);
    dbService.saveExpenseCategories(currentTenant.id, updated);
    reloadShopData();
    showToast(`খরচের খাত "${name}" মুছে ফেলা হয়েছে`, 'info');
  };

  // 4. STORE ATTRIBUTE HANDLERS (Clubs/Brands, Sizes, Fonts, Patches)
  const handleAddClub = (e: React.FormEvent) => {
    e.preventDefault();
    const val = newClubInput.trim();
    if (!val || customClubs.includes(val)) return;
    const updated = [...customClubs, val];
    setCustomClubs(updated);
    dbService.saveStoreConfig(currentTenant.id, { customClubs: updated });
    setNewClubInput('');
    reloadShopData();
    showToast(
      isClothingStore ? `নতুন ব্র্যান্ড যুক্ত হয়েছে: ${val}` : `নতুন ক্লাব/টিম যুক্ত হয়েছে: ${val}`,
      'success'
    );
  };

  const handleRemoveClub = (club: string) => {
    const updated = customClubs.filter((c) => c !== club);
    setCustomClubs(updated);
    dbService.saveStoreConfig(currentTenant.id, { customClubs: updated });
    reloadShopData();
  };

  const handleAddSize = (e: React.FormEvent) => {
    e.preventDefault();
    const val = newSizeInput.trim();
    if (!val || customSizes.includes(val)) return;
    const updated = [...customSizes, val];
    setCustomSizes(updated);
    dbService.saveStoreConfig(currentTenant.id, { availableSizes: updated });
    setNewSizeInput('');
    reloadShopData();
    showToast(`নতুন সাইজ যুক্ত হয়েছে: ${val}`, 'success');
  };

  const handleRemoveSize = (size: string) => {
    const updated = customSizes.filter((s) => s !== size);
    setCustomSizes(updated);
    dbService.saveStoreConfig(currentTenant.id, { availableSizes: updated });
    reloadShopData();
  };

  const handleAddFont = (e: React.FormEvent) => {
    e.preventDefault();
    const val = newFontName.trim();
    if (!val || customFonts.includes(val)) return;
    const updated = [...customFonts, val];
    setCustomFonts(updated);
    dbService.saveStoreConfig(currentTenant.id, {
      fontStyles: updated,
      defaultCustomNameNumberPrice: Number(newFontPrice) || 250,
    });
    setNewFontName('');
    setNewFontPrice(250);
    reloadShopData();
    showToast(`নতুন ফন্ট স্টাইল যুক্ত হয়েছে: ${val}`, 'success');
  };

  const handleRemoveFont = (name: string) => {
    const updated = customFonts.filter((f) => f !== name);
    setCustomFonts(updated);
    dbService.saveStoreConfig(currentTenant.id, { fontStyles: updated });
    reloadShopData();
  };

  const handleAddPatch = (e: React.FormEvent) => {
    e.preventDefault();
    const val = newPatchName.trim();
    if (!val || customPatches.includes(val)) return;
    const updated = [...customPatches, val];
    setCustomPatches(updated);
    dbService.saveStoreConfig(currentTenant.id, {
      availablePatches: updated,
      defaultPatchPrice: Number(newPatchPrice) || 120,
    });
    setNewPatchName('');
    setNewPatchPrice(120);
    reloadShopData();
    showToast(`নতুন শোল্ডার প্যাচ যুক্ত হয়েছে: ${val}`, 'success');
  };

  const handleRemovePatch = (name: string) => {
    const updated = customPatches.filter((p) => p !== name);
    setCustomPatches(updated);
    dbService.saveStoreConfig(currentTenant.id, { availablePatches: updated });
    reloadShopData();
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-150">
      {/* ========================================================================= */}
      {/* UNIFIED PRODUCT & MULTI-VARIANT INVENTORY CATALOG                         */}
      {/* Shared across Categories & Price, Inventory Page, and POS Counter         */}
      {/* ========================================================================= */}
      <ProductVariantCatalogManager mode="categories_settings" />

      {isClothingStore ? (
        /* ========================================================================= */
        /* CLOTHING SECTOR: MEN'S CLOTHING CATEGORIES & PRICING                      */
        /* ========================================================================= */
        <div className="bg-transparent border-0 p-1 sm:p-2 space-y-5 shadow-none">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 dark:border-zinc-800 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                <ShoppingBag className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  {pickText('পুরুষদের পোশাকের ক্যাটাগরি ও মূল্য', "Men's Clothing Categories & Pricing")}
                </h3>
              </div>
            </div>
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300">
              {clothingCategories.length} {pickText('টি ক্যাটাগরি সক্রিয়', 'Categories Active')}
            </span>
          </div>

          {/* Clothing Categories Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-zinc-950 text-slate-500 dark:text-zinc-400 border-b border-slate-200 dark:border-zinc-800 font-semibold select-none">
                <tr>
                  <th className="py-2.5 px-3">{pickText('ক্যাটাগরির নাম', 'Category')}</th>
                  <th className="py-2.5 px-4 min-w-[145px] sm:min-w-[165px] whitespace-nowrap">
                    {pickText('সাইজ স্কেল', 'Size Scale')}
                  </th>
                  <th className="py-2.5 px-3 text-right">{pickText('বিক্রয়মূল্য (৳)', 'Selling Price (MRP ৳)')}</th>
                  {showBuyingPrice && (
                    <th className="py-2.5 px-3 text-right text-emerald-600 dark:text-emerald-400">
                      {pickText('ক্রয়মূল্য (৳)', 'Buying Price (৳)')}
                    </th>
                  )}
                  <th className="py-2.5 px-3 text-right text-amber-600 dark:text-amber-400">
                    {pickText('বটম প্রাইস (৳)', 'Floor Price (৳)')}
                  </th>
                  {showBuyingPrice && <th className="py-2.5 px-3 text-right">{pickText('প্রাক্কলিত প্রফিট', 'Est. Profit')}</th>}
                  <th className="py-2.5 px-3 text-center">{pickText('অ্যাকশন', 'Action')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-zinc-800 font-mono">
                {clothingCategories.map((cat) => {
                  const isEditing = editingClothingId === cat.id && editClothingDraft;
                  const profit = cat.defaultMrp - cat.defaultCostPrice;
                  const scaleLabel =
                    cat.apparelScale === 'denim_pants'
                      ? pickText('ওয়েস্ট (২৮ - ৩৮)', 'Waist (28 - 38)')
                      : cat.apparelScale === 'panjabi'
                      ? pickText('পাঞ্জাবি (৩৮ - ৪৬)', 'Panjabi (38 - 46)')
                      : pickText('টপস (S - XXL)', 'Tops (S - XXL)');
                  return (
                    <tr key={cat.id} className="hover:bg-slate-50/70 dark:hover:bg-zinc-850/50 transition">
                      <td className="py-2.5 px-3 font-sans">
                        {isEditing ? (
                          <div className="space-y-1">
                            <input
                              type="text"
                              value={editClothingDraft.name}
                              onChange={(e) =>
                                setEditClothingDraft({ ...editClothingDraft, name: e.target.value })
                              }
                              className="w-full bg-white dark:bg-zinc-800 border border-emerald-500 rounded-lg px-2 py-1 text-xs font-bold"
                            />
                            <input
                              type="text"
                              value={editClothingDraft.bengaliName || ''}
                              onChange={(e) =>
                                setEditClothingDraft({
                                  ...editClothingDraft,
                                  bengaliName: e.target.value,
                                })
                              }
                              placeholder={pickText('বাংলা নাম', 'Bengali Name')}
                              className="w-full bg-white dark:bg-zinc-800 border border-slate-300 dark:border-zinc-700 rounded-lg px-2 py-1 text-[11px]"
                            />
                          </div>
                        ) : (
                          <div>
                            <div className="font-bold text-slate-900 dark:text-white">
                              {pickText(cat.bengaliName || cat.name, cat.name)}
                            </div>
                          </div>
                        )}
                      </td>
                      <td className="py-2.5 px-4 min-w-[145px] sm:min-w-[165px] whitespace-nowrap font-sans text-xs text-slate-600 dark:text-zinc-300">
                        {isEditing ? (
                          <select
                            value={editClothingDraft.apparelScale}
                            onChange={(e) =>
                              setEditClothingDraft({
                                ...editClothingDraft,
                                apparelScale: e.target.value as ApparelScaleType,
                              })
                            }
                            className="w-full bg-white dark:bg-zinc-800 border border-emerald-500 rounded-lg px-2 py-1 text-xs"
                          >
                            <option value="shirts_tops">{pickText('টপস (S - XXL)', 'Tops (S - XXL)')}</option>
                            <option value="denim_pants">{pickText('ওয়েস্ট (২৮ - ৩৮)', 'Waist (28 - 38)')}</option>
                            <option value="panjabi">{pickText('পাঞ্জাবি (৩৮ - ৪৬)', 'Panjabi (38 - 46)')}</option>
                          </select>
                        ) : (
                          <span className="inline-block whitespace-nowrap px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-zinc-800 text-[11px] font-semibold">
                            {scaleLabel}
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-right font-bold text-slate-800 dark:text-zinc-200">
                        {isEditing ? (
                          <input
                            type="number"
                            value={editClothingDraft.defaultMrp}
                            onChange={(e) =>
                              setEditClothingDraft({
                                ...editClothingDraft,
                                defaultMrp: Number(e.target.value),
                              })
                            }
                            className="w-20 bg-white dark:bg-zinc-800 border border-emerald-500 rounded-lg px-2 py-1 text-right text-xs"
                          />
                        ) : (
                          `৳${cat.defaultMrp.toLocaleString()}`
                        )}
                      </td>
                      {showBuyingPrice && (
                        <td className="py-2.5 px-3 text-right font-bold text-emerald-600 dark:text-emerald-400">
                          {isEditing ? (
                            <input
                              type="number"
                              value={editClothingDraft.defaultCostPrice}
                              onChange={(e) =>
                                setEditClothingDraft({
                                  ...editClothingDraft,
                                  defaultCostPrice: Number(e.target.value),
                                })
                              }
                              className="w-20 bg-white dark:bg-zinc-800 border border-emerald-500 rounded-lg px-2 py-1 text-right text-xs"
                            />
                          ) : (
                            `৳${cat.defaultCostPrice.toLocaleString()}`
                          )}
                        </td>
                      )}
                      <td className="py-2.5 px-3 text-right text-amber-600 dark:text-amber-400">
                        {isEditing ? (
                          <input
                            type="number"
                            value={editClothingDraft.defaultBottomPrice}
                            onChange={(e) =>
                              setEditClothingDraft({
                                ...editClothingDraft,
                                defaultBottomPrice: Number(e.target.value),
                              })
                            }
                            className="w-20 bg-white dark:bg-zinc-800 border border-emerald-500 rounded-lg px-2 py-1 text-right text-xs"
                          />
                        ) : (
                          `৳${cat.defaultBottomPrice.toLocaleString()}`
                        )}
                      </td>
                      {showBuyingPrice && (
                        <td className="py-2.5 px-3 text-right text-emerald-700 dark:text-emerald-300 font-semibold">
                          ৳{profit.toLocaleString()}
                        </td>
                      )}
                      <td className="py-2.5 px-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          {isEditing ? (
                            <>
                              <button
                                type="button"
                                onClick={handleSaveClothingEdit}
                                className="p-1.5 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 transition cursor-pointer"
                                title={pickText('সংরক্ষণ করুন', 'Save')}
                              >
                                <Check className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingClothingId(null);
                                  setEditClothingDraft(null);
                                }}
                                className="p-1.5 rounded-lg bg-slate-200 dark:bg-zinc-800 text-slate-600 dark:text-zinc-300 cursor-pointer"
                                title={pickText('বাতিল করুন', 'Cancel')}
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingClothingId(cat.id);
                                  setEditClothingDraft({ ...cat });
                                }}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 transition cursor-pointer"
                                title={pickText('সম্পাদনা করুন', 'Edit')}
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteClothingCategory(cat.id, cat.name)}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition cursor-pointer"
                                title={pickText('ক্যাটাগরি মুছে ফেলুন', 'Delete Category')}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Add New Men's Clothing Category Form */}
          <form
            onSubmit={handleAddClothingCategory}
            className="p-4 rounded-2xl bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 space-y-3"
          >
            <div className="font-bold text-xs text-slate-900 dark:text-white flex items-center gap-1.5">
              <PlusCircle className="w-4 h-4 text-emerald-600" />
              <span>
                {pickText(
                  'নতুন পোশাকের ক্যাটাগরি ও ডিফল্ট রেট যুক্ত করুন:',
                  "Add New Men's Clothing Category & Default Rates:"
                )}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-center text-xs">
              <div className={showBuyingPrice ? 'sm:col-span-3' : 'sm:col-span-4'}>
                <label className="block text-[11px] font-semibold text-slate-600 dark:text-zinc-400 mb-1">
                  {pickText('ক্যাটাগরির নাম (ইংরেজি) *', 'Category Name (English) *')}
                </label>
                <input
                  type="text"
                  value={newClothingName}
                  onChange={(e) => setNewClothingName(e.target.value)}
                  placeholder={pickText('যেমন: Blazer / Waistcoat / Cargo', 'e.g. Blazer / Waistcoat / Cargo')}
                  className="w-full bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-750 rounded-xl px-3 py-2 text-xs font-medium text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
                  required
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-[11px] font-semibold text-slate-600 dark:text-zinc-400 mb-1">
                  {pickText('বাংলা নাম (ঐচ্ছিক)', 'Bengali Name (Optional)')}
                </label>
                <input
                  type="text"
                  value={newClothingBengali}
                  onChange={(e) => setNewClothingBengali(e.target.value)}
                  placeholder={pickText('যেমন: ব্লেজার / কটি', 'e.g. Bengali name')}
                  className="w-full bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-750 rounded-xl px-3 py-2 text-xs font-medium text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-[11px] font-semibold text-slate-600 dark:text-zinc-400 mb-1">
                  {pickText('সাইজ স্কেল', 'Size Scale')}
                </label>
                <select
                  value={newClothingScale}
                  onChange={(e) => setNewClothingScale(e.target.value as ApparelScaleType)}
                  className="w-full bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-750 rounded-xl px-2.5 py-2 text-xs font-semibold text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
                >
                  <option value="shirts_tops">{pickText('টপস (S - XXL)', 'Tops (S - XXL)')}</option>
                  <option value="denim_pants">{pickText('ওয়েস্ট (২৮ - ৩৮)', 'Waist (28 - 38)')}</option>
                  <option value="panjabi">{pickText('পাঞ্জাবি (৩৮ - ৪৬)', 'Panjabi (38 - 46)')}</option>
                </select>
              </div>

              <div className="sm:col-span-2">
                <label className="block text-[11px] font-semibold text-slate-600 dark:text-zinc-400 mb-1">
                  {pickText('বিক্রয়মূল্য (৳)', 'Selling Price (MRP ৳)')}
                </label>
                <input
                  type="number"
                  value={newClothingMrp || ''}
                  onChange={(e) => setNewClothingMrp(Number(e.target.value))}
                  placeholder="৳1150"
                  className="w-full bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-750 rounded-xl px-3 py-2 text-xs font-mono font-bold text-slate-900 dark:text-white text-right focus:outline-none focus:border-emerald-500"
                  required
                />
              </div>

              {showBuyingPrice && (
                <div className="sm:col-span-1">
                  <label className="block text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 mb-1">
                    {pickText('ক্রয় ৳ *', 'Buying ৳ *')}
                  </label>
                  <input
                    type="number"
                    value={newClothingCost || ''}
                    onChange={(e) => setNewClothingCost(Number(e.target.value))}
                    placeholder="৳500"
                    className="w-full bg-white dark:bg-zinc-900 border border-emerald-500 rounded-xl px-2 py-2 text-xs font-mono font-bold text-emerald-600 dark:text-emerald-400 text-right focus:outline-none"
                    required
                  />
                </div>
              )}

              <div className="sm:col-span-1">
                <label className="block text-[11px] font-semibold text-amber-600 dark:text-amber-400 mb-1">
                  {pickText('বটম ৳', 'Floor ৳')}
                </label>
                <input
                  type="number"
                  value={newClothingBottom || ''}
                  onChange={(e) => setNewClothingBottom(Number(e.target.value))}
                  placeholder="৳900"
                  className="w-full bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-750 rounded-xl px-2 py-2 text-xs font-mono font-bold text-amber-600 text-right focus:outline-none"
                  required
                />
              </div>

              <div className="sm:col-span-1 pt-5">
                <button
                  type="submit"
                  className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs transition cursor-pointer shadow-xs flex items-center justify-center"
                  title={pickText('যুক্ত করুন', 'Add')}
                >
                  {pickText('+ যুক্ত', '+ Add')}
                </button>
              </div>
            </div>
          </form>
        </div>
      ) : (
        <>
          {/* ========================================================================= */}
          {/* 1. KIT CATEGORIES (জার্সি কিট ক্যাটাগরি ও বিক্রয়মূল্য)                       */}
          {/* ========================================================================= */}
          <div className="bg-transparent border-0 p-1 sm:p-2 space-y-5 shadow-none">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 dark:border-zinc-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                  <Tag className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    {showBuyingPrice
                      ? pickText('জার্সি ক্যাটাগরি ও ক্রয়মূল্য', 'Kit Categories & Cost')
                      : pickText('জার্সি ক্যাটাগরি ও বিক্রয়মূল্য', 'Kit Categories & Selling Rates')}
                  </h3>
                </div>
              </div>
              <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300">
                {kitCategories.length} {pickText('টি ক্যাটাগরি সক্রিয়', 'Categories Active')}
              </span>
            </div>

            {/* Existing Kit Categories Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-zinc-950 text-slate-500 dark:text-zinc-400 border-b border-slate-200 dark:border-zinc-800 font-semibold select-none">
                  <tr>
                    <th className="py-2.5 px-3">{pickText('ক্যাটাগরির নাম', 'Category Name')}</th>
                    <th className="py-2.5 px-3 text-right">{pickText('বিক্রয়মূল্য', 'Selling Rate (MRP)')}</th>
                    {showBuyingPrice && (
                      <th className="py-2.5 px-3 text-right text-emerald-600 dark:text-emerald-400">
                        {pickText('ক্রয়মূল্য (৳)', 'Cost Price (৳)')}
                      </th>
                    )}
                    <th className="py-2.5 px-3 text-right text-amber-600 dark:text-amber-400">
                      {pickText('সর্বনিম্ন বিক্রয়মূল্য', 'Bottom Floor Price')}
                    </th>
                    {showBuyingPrice && <th className="py-2.5 px-3 text-right">{pickText('প্রাক্কলিত প্রফিট', 'Est. Profit')}</th>}
                    <th className="py-2.5 px-3 text-center">{pickText('অ্যাকশন', 'Action')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-zinc-800 font-mono">
                  {kitCategories.map((cat) => {
                    const isEditing = editingKitId === cat.id && editKitDraft;
                    const profit = cat.defaultMrp - cat.defaultCostPrice;
                    return (
                      <tr key={cat.id} className="hover:bg-slate-50/70 dark:hover:bg-zinc-850/50 transition">
                        <td className="py-2.5 px-3 font-sans font-bold text-slate-900 dark:text-white">
                          {isEditing ? (
                            <input
                              type="text"
                              value={editKitDraft.name}
                              onChange={(e) => setEditKitDraft({ ...editKitDraft, name: e.target.value })}
                              className="w-full bg-white dark:bg-zinc-800 border border-emerald-500 rounded-lg px-2 py-1 text-xs"
                            />
                          ) : (
                            cat.name
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-right font-bold text-slate-800 dark:text-zinc-200">
                          {isEditing ? (
                            <input
                              type="number"
                              value={editKitDraft.defaultMrp}
                              onChange={(e) =>
                                setEditKitDraft({ ...editKitDraft, defaultMrp: Number(e.target.value) })
                              }
                              className="w-20 bg-white dark:bg-zinc-800 border border-emerald-500 rounded-lg px-2 py-1 text-right text-xs"
                            />
                          ) : (
                            `৳${cat.defaultMrp.toLocaleString()}`
                          )}
                        </td>
                        {showBuyingPrice && (
                          <td className="py-2.5 px-3 text-right font-bold text-emerald-600 dark:text-emerald-400">
                            {isEditing ? (
                              <input
                                type="number"
                                value={editKitDraft.defaultCostPrice}
                                onChange={(e) =>
                                  setEditKitDraft({
                                    ...editKitDraft,
                                    defaultCostPrice: Number(e.target.value),
                                  })
                                }
                                className="w-20 bg-white dark:bg-zinc-800 border border-emerald-500 rounded-lg px-2 py-1 text-right text-xs"
                              />
                            ) : (
                              `৳${cat.defaultCostPrice.toLocaleString()}`
                            )}
                          </td>
                        )}
                        <td className="py-2.5 px-3 text-right text-amber-600 dark:text-amber-400">
                          {isEditing ? (
                            <input
                              type="number"
                              value={editKitDraft.defaultBottomPrice}
                              onChange={(e) =>
                                setEditKitDraft({
                                  ...editKitDraft,
                                  defaultBottomPrice: Number(e.target.value),
                                })
                              }
                              className="w-20 bg-white dark:bg-zinc-800 border border-emerald-500 rounded-lg px-2 py-1 text-right text-xs"
                            />
                          ) : (
                            `৳${cat.defaultBottomPrice.toLocaleString()}`
                          )}
                        </td>
                        {showBuyingPrice && (
                          <td className="py-2.5 px-3 text-right text-emerald-700 dark:text-emerald-300 font-semibold">
                            ৳{profit.toLocaleString()}
                          </td>
                        )}
                        <td className="py-2.5 px-3 text-center">
                          <div className="flex items-center justify-center gap-1">
                            {isEditing ? (
                              <>
                                <button
                                  type="button"
                                  onClick={handleSaveKitEdit}
                                  className="p-1.5 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 transition cursor-pointer"
                                  title={pickText('সংরক্ষণ করুন', 'Save')}
                                >
                                  <Check className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingKitId(null);
                                    setEditKitDraft(null);
                                  }}
                                  className="p-1.5 rounded-lg bg-slate-200 dark:bg-zinc-800 text-slate-600 dark:text-zinc-300 cursor-pointer"
                                  title={pickText('বাতিল করুন', 'Cancel')}
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              </>
                            ) : (
                              <>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingKitId(cat.id);
                                    setEditKitDraft({ ...cat });
                                  }}
                                  className="p-1.5 rounded-lg text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 transition cursor-pointer"
                                  title={pickText('সম্পাদনা করুন', 'Edit')}
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteKitCategory(cat.id, cat.name)}
                                  className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition cursor-pointer"
                                  title={pickText('ক্যাটাগরি মুছে ফেলুন', 'Delete Category')}
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Add New Kit Category Form */}
            <form
              onSubmit={handleAddKitCategory}
              className="p-4 rounded-2xl bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 space-y-3"
            >
              <div className="font-bold text-xs text-slate-900 dark:text-white flex items-center gap-1.5">
                <PlusCircle className="w-4 h-4 text-emerald-600" />
                <span>{pickText('নতুন জার্সি কিট ক্যাটাগরি ও রেট যুক্ত করুন:', 'Add New Kit Category & Rates:')}</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-center text-xs">
                <div className={showBuyingPrice ? 'sm:col-span-5' : 'sm:col-span-7'}>
                  <label className="block text-[11px] font-semibold text-slate-600 dark:text-zinc-400 mb-1">
                    {pickText('ক্যাটাগরির নাম *', 'Category Name *')}
                  </label>
                  <input
                    type="text"
                    value={newKitName}
                    onChange={(e) => setNewKitName(e.target.value)}
                    placeholder={pickText('যেমন: Master Copy / Retro 1998 / Special Edition', 'e.g. Master Copy / Retro 1998 / Special Edition')}
                    className="w-full bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-750 rounded-xl px-3 py-2 text-xs font-medium text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
                    required
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-[11px] font-semibold text-slate-600 dark:text-zinc-400 mb-1">
                    {pickText('বিক্রয়মূল্য (৳)', 'Selling Price (MRP ৳)')}
                  </label>
                  <input
                    type="number"
                    value={newKitMrp || ''}
                    onChange={(e) => setNewKitMrp(Number(e.target.value))}
                    placeholder="৳1200"
                    className="w-full bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-750 rounded-xl px-3 py-2 text-xs font-mono font-bold text-slate-900 dark:text-white text-right focus:outline-none focus:border-emerald-500"
                    required
                  />
                </div>

                {showBuyingPrice && (
                  <div className="sm:col-span-2">
                    <label className="block text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 mb-1">
                      {pickText('ক্রয়মূল্য (৳) *', 'Buying Price (৳) *')}
                    </label>
                    <input
                      type="number"
                      value={newKitCostPrice || ''}
                      onChange={(e) => setNewKitCostPrice(Number(e.target.value))}
                      placeholder="৳650"
                      className="w-full bg-white dark:bg-zinc-900 border border-emerald-500 rounded-xl px-3 py-2 text-xs font-mono font-bold text-emerald-600 dark:text-emerald-400 text-right focus:outline-none"
                      required
                    />
                  </div>
                )}

                <div className="sm:col-span-2">
                  <label className="block text-[11px] font-semibold text-amber-600 dark:text-amber-400 mb-1">
                    {pickText('বটম প্রাইস (৳)', 'Bottom Price (৳)')}
                  </label>
                  <input
                    type="number"
                    value={newKitBottomPrice || ''}
                    onChange={(e) => setNewKitBottomPrice(Number(e.target.value))}
                    placeholder="৳1000"
                    className="w-full bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-750 rounded-xl px-3 py-2 text-xs font-mono font-bold text-amber-600 text-right focus:outline-none"
                    required
                  />
                </div>

                <div className="sm:col-span-1 pt-5">
                  <button
                    type="submit"
                    className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs transition cursor-pointer shadow-xs flex items-center justify-center"
                    title={pickText('যুক্ত করুন', 'Add')}
                  >
                    {pickText('+ যুক্ত', '+ Add')}
                  </button>
                </div>
              </div>
            </form>
          </div>

          {/* ========================================================================= */}
          {/* 2. OTHERS PRODUCT CATEGORIES (অন্যান্য পণ্যের ক্যাটাগরি ও রেট)            */}
          {/* ========================================================================= */}
          <div className="bg-transparent border-0 p-1 sm:p-2 space-y-6 shadow-none">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 dark:border-zinc-800 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400">
                  <ShoppingBag className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    {pickText('অন্যান্য পণ্যের ক্যাটাগরি ও রেট', 'Others Categories & Prices')}
                  </h3>
                </div>
              </div>
              <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300">
                {otherCategories.length} {pickText('টি ক্যাটাগরি', 'Categories')}
              </span>
            </div>

            {/* Existing Others Categories Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-zinc-950 text-slate-500 dark:text-zinc-400 border-b border-slate-200 dark:border-zinc-800 font-semibold select-none">
                  <tr>
                    <th className="py-2.5 px-3">{pickText('পণ্যের ধরণ / ক্যাটাগরি', 'Product Type / Category')}</th>
                    <th className="py-2.5 px-3 text-right">{pickText('স্ট্যান্ডার্ড বিক্রয়মূল্য', 'Standard Selling Price')}</th>
                    {showBuyingPrice && (
                      <th className="py-2.5 px-3 text-right text-emerald-600 dark:text-emerald-400">
                        {pickText('ক্রয়মূল্য (৳)', 'Cost Price (৳)')}
                      </th>
                    )}
                    {showBuyingPrice && <th className="py-2.5 px-3 text-right">{pickText('প্রাক্কলিত মার্জিন', 'Est. Margin')}</th>}
                    <th className="py-2.5 px-3 text-center">{pickText('অ্যাকশন', 'Action')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-zinc-800 font-mono">
                  {otherCategories.map((cat) => {
                    const isEditing = editingOtherId === cat.id && editOtherDraft;
                    const profit = cat.defaultMrp - cat.defaultCostPrice;
                    return (
                      <tr key={cat.id} className="hover:bg-slate-50/70 dark:hover:bg-zinc-850/50 transition">
                        <td className="py-2.5 px-3 font-sans font-bold text-slate-900 dark:text-white">
                          {isEditing ? (
                            <input
                              type="text"
                              value={editOtherDraft.name}
                              onChange={(e) =>
                                setEditOtherDraft({ ...editOtherDraft, name: e.target.value })
                              }
                              className="w-full bg-white dark:bg-zinc-800 border border-purple-500 rounded-lg px-2 py-1 text-xs"
                            />
                          ) : (
                            cat.name
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-right font-bold text-slate-800 dark:text-zinc-200">
                          {isEditing ? (
                            <input
                              type="number"
                              value={editOtherDraft.defaultMrp}
                              onChange={(e) =>
                                setEditOtherDraft({
                                  ...editOtherDraft,
                                  defaultMrp: Number(e.target.value),
                                })
                              }
                              className="w-20 bg-white dark:bg-zinc-800 border border-purple-500 rounded-lg px-2 py-1 text-right text-xs"
                            />
                          ) : (
                            `৳${cat.defaultMrp.toLocaleString()}`
                          )}
                        </td>
                        {showBuyingPrice && (
                          <td className="py-2.5 px-3 text-right font-bold text-emerald-600 dark:text-emerald-400">
                            {isEditing ? (
                              <input
                                type="number"
                                value={editOtherDraft.defaultCostPrice}
                                onChange={(e) =>
                                  setEditOtherDraft({
                                    ...editOtherDraft,
                                    defaultCostPrice: Number(e.target.value),
                                  })
                                }
                                className="w-20 bg-white dark:bg-zinc-800 border border-purple-500 rounded-lg px-2 py-1 text-right text-xs"
                              />
                            ) : (
                              `৳${cat.defaultCostPrice.toLocaleString()}`
                            )}
                          </td>
                        )}
                        {showBuyingPrice && (
                          <td className="py-2.5 px-3 text-right text-purple-700 dark:text-purple-300 font-semibold">
                            ৳{profit.toLocaleString()}
                          </td>
                        )}
                        <td className="py-2.5 px-3 text-center">
                          <div className="flex items-center justify-center gap-1">
                            {isEditing ? (
                              <>
                                <button
                                  type="button"
                                  onClick={handleSaveOtherEdit}
                                  className="p-1.5 rounded-lg bg-purple-600 text-white hover:bg-purple-700 transition cursor-pointer"
                                  title={pickText('সংরক্ষণ করুন', 'Save')}
                                >
                                  <Check className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingOtherId(null);
                                    setEditOtherDraft(null);
                                  }}
                                  className="p-1.5 rounded-lg bg-slate-200 dark:bg-zinc-800 text-slate-600 dark:text-zinc-300 cursor-pointer"
                                  title={pickText('বাতিল করুন', 'Cancel')}
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              </>
                            ) : (
                              <>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingOtherId(cat.id);
                                    setEditOtherDraft({ ...cat });
                                  }}
                                  className="p-1.5 rounded-lg text-slate-400 hover:text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-950/40 transition cursor-pointer"
                                  title={pickText('সম্পাদনা করুন', 'Edit')}
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteOtherCategory(cat.id, cat.name)}
                                  className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition cursor-pointer"
                                  title={pickText('ক্যাটাগরি মুছে ফেলুন', 'Delete Category')}
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Add New Other Category Form */}
            <form
              onSubmit={handleAddOtherCategory}
              className="p-4 rounded-2xl bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 space-y-3"
            >
              <div className="font-bold text-xs text-slate-900 dark:text-white flex items-center gap-1.5">
                <PlusCircle className="w-4 h-4 text-purple-600" />
                <span>
                  {showBuyingPrice
                    ? pickText(
                        'নতুন অন্যান্য পণ্যের ক্যাটাগরি ও ক্রয়মূল্য যুক্ত করুন:',
                        'Add New Other Category & Buying Price:'
                      )
                    : pickText(
                        'নতুন অন্যান্য পণ্যের ক্যাটাগরি ও বিক্রয়মূল্য যুক্ত করুন:',
                        'Add New Other Category & Selling Price:'
                      )}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-center text-xs">
                <div className={showBuyingPrice ? 'sm:col-span-6' : 'sm:col-span-8'}>
                  <label className="block text-[11px] font-semibold text-slate-600 dark:text-zinc-400 mb-1">
                    {pickText('পণ্যের নাম / ক্যাটাগরি *', 'Product Name / Category *')}
                  </label>
                  <input
                    type="text"
                    value={newOtherName}
                    onChange={(e) => setNewOtherName(e.target.value)}
                    placeholder={pickText(
                      'যেমন: ফুটবল বুট / শিন গার্ড / স্মারক মগ / ট্রফি...',
                      'e.g. Football Boots / Shin Guards / Mug / Trophy...'
                    )}
                    className="w-full bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-750 rounded-xl px-3 py-2 text-xs font-medium text-slate-900 dark:text-white focus:outline-none focus:border-purple-500"
                    required
                  />
                </div>

                <div className="sm:col-span-3">
                  <label className="block text-[11px] font-semibold text-slate-600 dark:text-zinc-400 mb-1">
                    {pickText('বিক্রয়মূল্য (৳)', 'Selling Price (৳)')}
                  </label>
                  <input
                    type="number"
                    value={newOtherMrp || ''}
                    onChange={(e) => setNewOtherMrp(Number(e.target.value))}
                    placeholder="৳250"
                    className="w-full bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-750 rounded-xl px-3 py-2 text-xs font-mono font-bold text-slate-900 dark:text-white text-right focus:outline-none focus:border-purple-500"
                    required
                  />
                </div>

                {showBuyingPrice && (
                  <div className="sm:col-span-2">
                    <label className="block text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 mb-1">
                      {pickText('ক্রয়মূল্য (৳) *', 'Buying Price (৳) *')}
                    </label>
                    <input
                      type="number"
                      value={newOtherCostPrice || ''}
                      onChange={(e) => setNewOtherCostPrice(Number(e.target.value))}
                      placeholder="৳120"
                      className="w-full bg-white dark:bg-zinc-900 border border-emerald-500 rounded-xl px-3 py-2 text-xs font-mono font-bold text-emerald-600 dark:text-emerald-400 text-right focus:outline-none"
                      required
                    />
                  </div>
                )}

                <div className="sm:col-span-1 pt-5">
                  <button
                    type="submit"
                    className="w-full py-2 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-xl text-xs transition cursor-pointer shadow-xs flex items-center justify-center"
                    title={pickText('যুক্ত করুন', 'Add')}
                  >
                    {pickText('+ যুক্ত', '+ Add')}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </>
      )}

      {/* ========================================================================= */}
      {/* 3. EXPENSE CATEGORIES (খরচের খাত ও ক্যাটাগরি কাস্টমাইজেশন)               */}
      {/* ========================================================================= */}
      <div className="bg-transparent border-0 p-1 sm:p-2 space-y-5 shadow-none">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 dark:border-zinc-800 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400">
              <Receipt className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                {pickText('দৈনিক খরচের খাতসমূহ', 'Expense Categories')}
              </h3>
            </div>
          </div>
          <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300">
            {expenseCategories.length} {pickText('টি খাত সক্রিয়', 'Categories Active')}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {expenseCategories.map((cat) => {
            const isEditing = editingExpId === cat.id && editExpDraft;
            return (
              <div
                key={cat.id}
                className="p-3.5 rounded-2xl bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 flex items-center justify-between gap-2"
              >
                {isEditing ? (
                  <div className="flex-1 space-y-1.5">
                    <input
                      type="text"
                      value={editExpDraft.label}
                      onChange={(e) => setEditExpDraft({ ...editExpDraft, label: e.target.value })}
                      placeholder={pickText('ইংরেজি নাম', 'English Name')}
                      className="w-full bg-white dark:bg-zinc-900 border border-emerald-500 rounded-lg px-2.5 py-1 text-xs"
                    />
                    <input
                      type="text"
                      value={editExpDraft.bnLabel || ''}
                      onChange={(e) =>
                        setEditExpDraft({ ...editExpDraft, bnLabel: e.target.value })
                      }
                      placeholder={pickText('বাংলা লেবেল', 'Bengali Label')}
                      className="w-full bg-white dark:bg-zinc-900 border border-emerald-500 rounded-lg px-2.5 py-1 text-xs"
                    />
                  </div>
                ) : (
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-slate-900 dark:text-white truncate">
                      {pickText(cat.bnLabel || cat.label || cat.name, cat.label || cat.name)}
                    </div>
                  </div>
                )}

                <div className="flex items-center gap-1 shrink-0">
                  {isEditing ? (
                    <>
                      <button
                        type="button"
                        onClick={handleSaveExpEdit}
                        className="p-1.5 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 cursor-pointer"
                      >
                        <Check className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setEditingExpId(null);
                          setEditExpDraft(null);
                        }}
                        className="p-1.5 rounded-lg bg-slate-200 dark:bg-zinc-800 text-slate-600 dark:text-zinc-300 cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => {
                          setEditingExpId(cat.id);
                          setEditExpDraft({ ...cat });
                        }}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 cursor-pointer"
                        title={pickText('সম্পাদনা করুন', 'Edit')}
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          handleDeleteExpenseCategory(cat.id, cat.bnLabel || cat.label || cat.name)
                        }
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer"
                        title={pickText('মুছে ফেলুন', 'Delete')}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Add New Expense Category Form */}
        <form
          onSubmit={handleAddExpenseCategory}
          className="p-4 rounded-2xl bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 space-y-3"
        >
          <div className="font-bold text-xs text-slate-900 dark:text-white flex items-center gap-1.5">
            <PlusCircle className="w-4 h-4 text-rose-600" />
            <span>{pickText('নতুন খরচের খাত যুক্ত করুন:', 'Add Custom Expense Category:')}</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-center text-xs">
            <div className="sm:col-span-5">
              <label className="block text-[11px] font-semibold text-slate-600 dark:text-zinc-400 mb-1">
                {pickText('খাতের নাম (ইংরেজি) *', 'Expense Category Title (English) *')}
              </label>
              <input
                type="text"
                value={newExpName}
                onChange={(e) => setNewExpName(e.target.value)}
                placeholder={pickText('যেমন: Internet & WiFi / Generator Fuel', 'e.g. Internet & WiFi / Generator Fuel')}
                className="w-full bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-750 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-rose-500"
                required
              />
            </div>

            <div className="sm:col-span-5">
              <label className="block text-[11px] font-semibold text-slate-600 dark:text-zinc-400 mb-1">
                {pickText('বাংলা নাম', 'Bengali Label')}
              </label>
              <input
                type="text"
                value={newExpBengali}
                onChange={(e) => setNewExpBengali(e.target.value)}
                placeholder={pickText('যেমন: ইন্টারনেট ও ওয়াইফাই বিল', 'e.g. Bengali label')}
                className="w-full bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-750 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-rose-500"
              />
            </div>

            <div className="sm:col-span-2 pt-5">
              <button
                type="submit"
                className="w-full py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl text-xs transition cursor-pointer shadow-xs"
              >
                {pickText('+ খাত যুক্ত করুন', '+ Add Category')}
              </button>
            </div>
          </div>
        </form>
      </div>

      {/* ========================================================================= */}
      {/* 4. STORE ATTRIBUTES: BRANDS/CLUBS, SIZES, & (SPORTSWEAR ONLY) FONTS/PATCHES */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Custom Brands (Clothing) or Clubs & Teams (Sportswear) */}
        <div className="bg-transparent border-0 p-1 sm:p-2 space-y-4 shadow-none">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-zinc-800 pb-3">
            <div className="flex items-center gap-2">
              <Shirt className="w-4 h-4 text-emerald-600" />
              <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                {isClothingStore
                  ? pickText('ব্র্যান্ড ও সাপ্লায়ার তালিকা', 'Clothing Brands & Suppliers')
                  : pickText('ক্লাব ও ব্র্যান্ড তালিকা', 'Clubs & Brands')}
              </h4>
            </div>
            <span className="text-[11px] text-slate-500">{customClubs.length} {pickText('টি', 'items')}</span>
          </div>

          <div className="flex flex-wrap gap-1.5 max-h-40 overflow-y-auto">
            {customClubs.map((club) => (
              <span
                key={club}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-slate-100 dark:bg-zinc-800 text-xs font-medium text-slate-800 dark:text-zinc-200"
              >
                <span>{club}</span>
                <button
                  type="button"
                  onClick={() => handleRemoveClub(club)}
                  className="text-slate-400 hover:text-rose-500 cursor-pointer"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
          </div>

          <form onSubmit={handleAddClub} className="flex gap-2">
            <input
              type="text"
              value={newClubInput}
              onChange={(e) => setNewClubInput(e.target.value)}
              placeholder={
                isClothingStore
                  ? pickText('নতুন ব্র্যান্ড বা সাপ্লায়ার নাম...', 'New brand or supplier name...')
                  : pickText('নতুন ক্লাব বা ব্র্যান্ড নাম...', 'New club or brand name...')
              }
              className="flex-1 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white"
            />
            <button
              type="submit"
              className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold cursor-pointer"
            >
              {pickText('+ যুক্ত করুন', '+ Add')}
            </button>
          </form>
        </div>

        {/* Custom Sizes */}
        <div className="bg-transparent border-0 p-1 sm:p-2 space-y-4 shadow-none">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-zinc-800 pb-3">
            <div className="flex items-center gap-2">
              <Ruler className="w-4 h-4 text-blue-600" />
              <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                {isClothingStore
                  ? pickText('পুরুষদের পোশাকের সাইজসমূহ', "Men's Clothing Sizes")
                  : pickText('সাইজ ও ভ্যারিয়েন্টসমূহ', 'Sizes & Variants')}
              </h4>
            </div>
            <span className="text-[11px] text-slate-500">{customSizes.length} {pickText('টি', 'sizes')}</span>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {customSizes.map((size) => (
              <span
                key={size}
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-slate-100 dark:bg-zinc-800 text-xs font-mono font-bold text-slate-800 dark:text-zinc-200"
              >
                <span>{size}</span>
                <button
                  type="button"
                  onClick={() => handleRemoveSize(size)}
                  className="text-slate-400 hover:text-rose-500 cursor-pointer"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
          </div>

          <form onSubmit={handleAddSize} className="flex gap-2">
            <input
              type="text"
              value={newSizeInput}
              onChange={(e) => setNewSizeInput(e.target.value)}
              placeholder={
                isClothingStore
                  ? pickText('যেমন: 3XL / 30-Reg / 44...', 'e.g. 3XL / 30-Reg / 44...')
                  : pickText('যেমন: 3XL / 4XL / KIDS-28...', 'e.g. 3XL / 4XL / KIDS-28...')
              }
              className="flex-1 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white"
            />
            <button
              type="submit"
              className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold cursor-pointer"
            >
              {pickText('+ যুক্ত করুন', '+ Add')}
            </button>
          </form>
        </div>

        {/* Custom Font Styles & Custom Patches — EXCLUSIVE TO SPORTSWEAR */}
        {!isClothingStore && (
          <>
            <div className="bg-transparent border-0 p-1 sm:p-2 space-y-4 shadow-none">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-zinc-800 pb-3">
                <div className="flex items-center gap-2">
                  <Type className="w-4 h-4 text-amber-600" />
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                    {pickText('প্রিন্ট ফন্ট রেট', 'DTF Font Styles & Rates')}
                  </h4>
                </div>
                <span className="text-[11px] text-slate-500">{customFonts.length} {pickText('টি', 'fonts')}</span>
              </div>

              <div className="space-y-1.5 max-h-40 overflow-y-auto">
                {customFonts.map((f) => (
                  <div
                    key={f}
                    className="flex items-center justify-between px-3 py-1.5 rounded-xl bg-slate-50 dark:bg-zinc-950 border border-slate-200/80 dark:border-zinc-800 text-xs"
                  >
                    <span className="font-semibold text-slate-800 dark:text-zinc-200">{f}</span>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-emerald-600">৳{newFontPrice}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveFont(f)}
                        className="text-slate-400 hover:text-rose-500 cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <form onSubmit={handleAddFont} className="grid grid-cols-12 gap-2">
                <input
                  type="text"
                  value={newFontName}
                  onChange={(e) => setNewFontName(e.target.value)}
                  placeholder={pickText('ফন্টের নাম (যেমন: Serie A 3D)', 'Font name (e.g. Serie A 3D)')}
                  className="col-span-7 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white"
                />
                <input
                  type="number"
                  value={newFontPrice || ''}
                  onChange={(e) => setNewFontPrice(Number(e.target.value))}
                  placeholder="৳250"
                  className="col-span-3 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl px-2.5 py-2 text-xs font-mono text-right text-slate-900 dark:text-white"
                />
                <button
                  type="submit"
                  className="col-span-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold cursor-pointer"
                >
                  {pickText('+ যুক্ত', '+ Add')}
                </button>
              </form>
            </div>

            <div className="bg-transparent border-0 p-1 sm:p-2 space-y-4 shadow-none">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-zinc-800 pb-3">
                <div className="flex items-center gap-2">
                  <Award className="w-4 h-4 text-purple-600" />
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                    {pickText('প্যাচ ও ব্যাজ রেট', 'Sleeve Badges & Patches')}
                  </h4>
                </div>
                <span className="text-[11px] text-slate-500">{customPatches.length} {pickText('টি', 'patches')}</span>
              </div>

              <div className="space-y-1.5 max-h-40 overflow-y-auto">
                {customPatches.map((p) => (
                  <div
                    key={p}
                    className="flex items-center justify-between px-3 py-1.5 rounded-xl bg-slate-50 dark:bg-zinc-950 border border-slate-200/80 dark:border-zinc-800 text-xs"
                  >
                    <span className="font-semibold text-slate-800 dark:text-zinc-200">{p}</span>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-emerald-600">৳{newPatchPrice}</span>
                      <button
                        type="button"
                        onClick={() => handleRemovePatch(p)}
                        className="text-slate-400 hover:text-rose-500 cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <form onSubmit={handleAddPatch} className="grid grid-cols-12 gap-2">
                <input
                  type="text"
                  value={newPatchName}
                  onChange={(e) => setNewPatchName(e.target.value)}
                  placeholder={pickText('ব্যাজের নাম (যেমন: Copa America)', 'Badge name (e.g. Copa America)')}
                  className="col-span-7 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white"
                />
                <input
                  type="number"
                  value={newPatchPrice || ''}
                  onChange={(e) => setNewPatchPrice(Number(e.target.value))}
                  placeholder="৳120"
                  className="col-span-3 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl px-2.5 py-2 text-xs font-mono text-right text-slate-900 dark:text-white"
                />
                <button
                  type="submit"
                  className="col-span-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold cursor-pointer"
                >
                  {pickText('+ যুক্ত', '+ Add')}
                </button>
              </form>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

