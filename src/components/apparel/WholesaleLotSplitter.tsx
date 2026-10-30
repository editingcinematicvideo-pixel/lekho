import React, { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { InventoryItem, ApparelScaleType, MenClothingCategory } from '../../types';
import { dbService } from '../../services/db';
import { canViewBuyingPrice } from '../../utils/securityPolicy';
import { InfoTooltip } from '../ui/InfoTooltip';
import {
  Calculator,
  PackagePlus,
  ArrowRight,
  Check,
  Sparkles,
  AlertTriangle,
  Tag,
  DollarSign,
  TrendingUp,
  Percent,
  ArrowLeft,
  Lock,
} from 'lucide-react';

interface WholesaleLotSplitterProps {
  onBack?: () => void;
}

export const WholesaleLotSplitter: React.FC<WholesaleLotSplitterProps> = ({ onBack }) => {
  const { currentTenant, role, showToast } = useApp();
  const isOwnerAuthorized = canViewBuyingPrice(role);
  const clothingCategories = useMemo(
    () => dbService.getClothingCategories(currentTenant.id, role),
    [currentTenant.id, role]
  );
  const [selectedClothingCat, setSelectedClothingCat] = useState<MenClothingCategory>('Shirt');
  const [bundleCost, setBundleCost] = useState<number>(4800);
  const [totalPcs, setTotalPcs] = useState<number>(12);
  const [scaleType, setScaleType] = useState<ApparelScaleType>('shirts_tops');
  const [productTitle, setProductTitle] = useState('New Wholesale Linen Lot');
  const [targetMarginPercent, setTargetMarginPercent] = useState<number>(60);

  // Calculated per piece landing cost
  const landingCostPerPiece = totalPcs > 0 ? Math.round(bundleCost / totalPcs) : 0;
  const recommendedMrp = Math.round(landingCostPerPiece * (1 + targetMarginPercent / 100));
  const recommendedBottomPrice = Math.round(landingCostPerPiece * 1.25);

  // Default size ratios based on scale type
  const [ratioMap, setRatioMap] = useState<Record<string, number>>({
    S: 2,
    M: 4,
    L: 4,
    XL: 2,
  });

  const handleScaleChange = (scale: ApparelScaleType) => {
    setScaleType(scale);
    if (scale === 'shirts_tops') {
      setRatioMap({ S: 2, M: 4, L: 4, XL: 2 });
    } else if (scale === 'denim_pants') {
      setRatioMap({
        '28-Reg': 1,
        '30-Reg': 3,
        '32-Reg': 4,
        '34-Reg': 3,
        '36-Reg': 1,
      });
    } else if (scale === 'panjabi') {
      setRatioMap({
        '38': 2,
        '40': 4,
        '42': 4,
        '44': 2,
      });
    }
  };

  const handleClothingCatChange = (catName: MenClothingCategory) => {
    setSelectedClothingCat(catName);
    const matched = clothingCategories.find((c) => c.name === catName);
    if (matched) {
      handleScaleChange(matched.apparelScale);
    }
  };

  const handleRatioChange = (size: string, qty: number) => {
    const updated = { ...ratioMap, [size]: Math.max(0, qty) };
    setRatioMap(updated);
    const sum = Object.values(updated).reduce((a, b) => a + b, 0);
    setTotalPcs(sum);
  };

  const handleSaveToInventory = () => {
    if (!isOwnerAuthorized) {
      showToast('হোলসেল লট ও কেনা দাম শুধুমাত্র দোকানের মালিক (Shop Owner) পরিচালনা করতে পারবেন।', 'error');
      return;
    }

    const variants = Object.entries(ratioMap).map(([size, stock]) => ({
      size,
      stock,
      daysInStock: 0,
      costPrice: landingCostPerPiece,
      mrp: recommendedMrp,
      bottomPrice: recommendedBottomPrice,
    }));

    const newItem: InventoryItem = {
      id: `prod_lot_${Date.now()}`,
      shopId: currentTenant.id,
      name: productTitle.trim(),
      categoryType: 'apparel',
      clothingCategory: selectedClothingCat,
      apparelScale: scaleType,
      lotCostLandingPrice: landingCostPerPiece,
      mrp: recommendedMrp,
      bottomPrice: recommendedBottomPrice,
      totalStock: totalPcs,
      sku: `LOT-${Date.now().toString().slice(-6)}`,
      variants,
    };

    dbService.addInventoryItem(currentTenant.id, newItem, role);
    showToast(`Added "${newItem.name}" (${selectedClothingCat} • ${totalPcs} pcs @ ৳${landingCostPerPiece}/pc landing cost)!`, 'success');
  };

  if (!isOwnerAuthorized) {
    return (
      <div className="max-w-3xl mx-auto p-6 sm:p-10 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-3xl text-center space-y-4 shadow-xs">
        <div className="w-12 h-12 rounded-2xl bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 flex items-center justify-center mx-auto">
          <Lock className="w-6 h-6" />
        </div>
        <h2 className="text-lg font-extrabold text-slate-900 dark:text-white">
          শুধুমাত্র দোকানের মালিকের জন্য সংরক্ষিত (Owner Only)
        </h2>
        <p className="text-xs sm:text-sm text-slate-500 dark:text-zinc-400 max-w-md mx-auto">
          পাইকারি লট ক্যালকুলেটর এবং পণ্যের কেনা দাম (Wholesale Landing Cost) শুধুমাত্র স্টোর মালিক দেখতে ও পরিবর্তন করতে পারবেন।
        </p>
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-bold cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>ফিরে যান</span>
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4 max-w-5xl mx-auto pb-24 lg:pb-8">
      {/* Top Header */}
      <div className="bg-white dark:bg-zinc-900 border border-slate-200/90 dark:border-zinc-800 rounded-3xl p-4 sm:p-6 shadow-2xs space-y-4 text-slate-900 dark:text-zinc-100">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-100 dark:border-zinc-800 gap-3">
          <div className="flex items-center gap-2.5">
            {onBack && (
              <button
                type="button"
                onClick={onBack}
                className="w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-750 text-slate-800 dark:text-zinc-200 flex items-center justify-center transition cursor-pointer active:scale-95 shrink-0"
                title="Back to Home"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
            )}
            <h1 className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-white tracking-tight">
              Wholesale & Retail Pricing (প্রাইসিং ক্যালকুলেটর)
            </h1>
            <InfoTooltip text="Divides total bundle cost by total pieces to calculate per-piece landing cost and suggested retail MRP." />
          </div>
        </div>

        {/* Dual Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 pt-1">
          {/* Left: Input controls */}
          <div className="lg:col-span-6 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-zinc-400 mb-1">
                  Men's Clothing Category
                </label>
                <select
                  value={selectedClothingCat}
                  onChange={(e) => handleClothingCatChange(e.target.value as MenClothingCategory)}
                  className="w-full bg-[#f4f7f5] dark:bg-zinc-800 border border-slate-200/80 dark:border-zinc-700 rounded-2xl px-3 py-2.5 text-xs font-semibold text-slate-900 dark:text-white focus:outline-none focus:border-[#164e3f]"
                >
                  {clothingCategories.map((c) => (
                    <option key={c.id} value={c.name}>
                      {c.name} {c.nameBn ? `(${c.nameBn})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-zinc-400 mb-1">
                  Article Name / Lot Title
                </label>
                <input
                  type="text"
                  value={productTitle}
                  onChange={(e) => setProductTitle(e.target.value)}
                  className="w-full bg-[#f4f7f5] dark:bg-zinc-800 border border-slate-200/80 dark:border-zinc-700 rounded-2xl px-4 py-2.5 text-xs sm:text-sm text-slate-900 dark:text-white focus:outline-none focus:border-[#164e3f]"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-zinc-400 mb-1">
                  Wholesale Bundle Total Cost (৳)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-slate-400">৳</span>
                  <input
                    type="number"
                    min={0}
                    value={bundleCost}
                    onChange={(e) => setBundleCost(Number(e.target.value))}
                    className="w-full bg-[#f4f7f5] dark:bg-zinc-800 border border-slate-200/80 dark:border-zinc-700 rounded-2xl pl-8 pr-3 py-2.5 text-sm font-bold text-slate-900 dark:text-white focus:outline-none focus:border-[#164e3f]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-zinc-400 mb-1">
                  Apparel Size Scale
                </label>
                <select
                  value={scaleType}
                  onChange={(e) => handleScaleChange(e.target.value as ApparelScaleType)}
                  className="w-full bg-[#f4f7f5] dark:bg-zinc-800 border border-slate-200/80 dark:border-zinc-700 rounded-2xl px-3 py-2.5 text-xs font-semibold text-slate-900 dark:text-white focus:outline-none focus:border-[#164e3f]"
                >
                  <option value="shirts_tops">Shirts / Polos (S - XXL)</option>
                  <option value="denim_pants">Denim & Pants (Waist 28 - 36)</option>
                  <option value="panjabi">Panjabi & Traditional (38 - 44)</option>
                </select>
              </div>
            </div>

            {/* Size breakdown distribution inputs */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-zinc-400 mb-2">
                Bundle Size Breakdown ({totalPcs} total pcs)
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {Object.entries(ratioMap).map(([size, count]) => (
                  <div key={size} className="bg-[#f4f7f5] dark:bg-zinc-800/60 border border-slate-200/80 dark:border-zinc-700 rounded-2xl p-2.5 text-center">
                    <span className="text-[11px] font-bold text-slate-600 dark:text-zinc-400 uppercase">{size}</span>
                    <div className="flex items-center justify-center gap-1.5 mt-1">
                      <input
                        type="number"
                        min={0}
                        value={count}
                        onChange={(e) => handleRatioChange(size, Number(e.target.value))}
                        className="w-14 bg-white dark:bg-zinc-900 border border-slate-300 dark:border-zinc-700 text-center font-bold text-xs text-slate-900 dark:text-white rounded-xl py-1 focus:outline-none focus:border-[#164e3f]"
                      />
                      <span className="text-[10px] text-slate-400">pcs</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Target Markup slider */}
            <div className="bg-[#f4f7f5] dark:bg-zinc-800/60 p-3.5 rounded-2xl border border-slate-200/80 dark:border-zinc-700 space-y-2">
              <div className="flex justify-between items-center text-xs font-semibold">
                <span className="text-slate-700 dark:text-zinc-300">Target Retail Markup (লাভের মার্জিন):</span>
                <span className="text-[#164e3f] dark:text-emerald-400 font-extrabold text-sm">{targetMarginPercent}%</span>
              </div>
              <input
                type="range"
                min={20}
                max={150}
                step={5}
                value={targetMarginPercent}
                onChange={(e) => setTargetMarginPercent(Number(e.target.value))}
                className="w-full accent-[#164e3f] cursor-pointer"
              />
            </div>
          </div>

          {/* Right: Calculated Landing Matrix & Action */}
          <div className="lg:col-span-6 bg-[#f4f7f5] dark:bg-zinc-800/40 border border-slate-200/80 dark:border-zinc-700 rounded-3xl p-5 flex flex-col justify-between space-y-4">
            <div className="space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-200/70 dark:border-zinc-700">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-zinc-400">
                  Pricing Split Result
                </span>
                <span className="text-[11px] font-mono bg-[#e6f4ea] text-[#1f8a5b] dark:bg-emerald-950/60 dark:text-emerald-300 px-2.5 py-0.5 rounded-lg font-bold">
                  ৳{bundleCost} ÷ {totalPcs} pcs
                </span>
              </div>

              <div className="grid grid-cols-3 gap-2.5 text-center">
                <div className="bg-white dark:bg-zinc-900 p-3 rounded-2xl border border-slate-200/80 dark:border-zinc-700 shadow-2xs">
                  <span className="text-[10px] text-slate-500 dark:text-zinc-400 uppercase font-semibold">Landing Cost</span>
                  <div className="text-lg sm:text-xl font-black text-[#1f8a5b] dark:text-emerald-400 mt-1">
                    ৳{landingCostPerPiece}
                    <span className="text-[10px] text-slate-400 font-normal">/pc</span>
                  </div>
                </div>

                <div className="bg-white dark:bg-zinc-900 p-3 rounded-2xl border border-slate-200/80 dark:border-zinc-700 shadow-2xs">
                  <span className="text-[10px] text-slate-500 dark:text-zinc-400 uppercase font-semibold">Suggested MRP</span>
                  <div className="text-lg sm:text-xl font-black text-slate-900 dark:text-white mt-1">
                    ৳{recommendedMrp}
                  </div>
                </div>

                <div className="bg-white dark:bg-zinc-900 p-3 rounded-2xl border border-slate-200/80 dark:border-zinc-700 shadow-2xs">
                  <span className="text-[10px] text-slate-500 dark:text-zinc-400 uppercase font-semibold">Floor Price</span>
                  <div className="text-lg sm:text-xl font-black text-amber-600 dark:text-amber-400 mt-1">
                    ৳{recommendedBottomPrice}
                  </div>
                </div>
              </div>

              <div className="text-xs text-slate-600 dark:text-zinc-300 bg-white dark:bg-zinc-900 p-3.5 rounded-2xl border border-slate-200/80 dark:border-zinc-700 space-y-1.5">
                <div className="flex justify-between">
                  <span>Gross Expected Revenue:</span>
                  <strong className="text-slate-900 dark:text-white">৳{(recommendedMrp * totalPcs).toLocaleString()}</strong>
                </div>
                <div className="flex justify-between">
                  <span>Wholesale Investment:</span>
                  <strong className="text-rose-600 dark:text-rose-400">৳{bundleCost.toLocaleString()}</strong>
                </div>
                <div className="flex justify-between text-[#1f8a5b] dark:text-emerald-400 font-bold border-t border-slate-100 dark:border-zinc-800 pt-1.5">
                  <span>Projected Gross Margin:</span>
                  <span>৳{(recommendedMrp * totalPcs - bundleCost).toLocaleString()}</span>
                </div>
              </div>
            </div>

            <button
              onClick={handleSaveToInventory}
              disabled={role === 'salesman' || totalPcs === 0}
              className="w-full py-3.5 rounded-2xl bg-[#164e3f] hover:bg-[#123e32] disabled:opacity-50 text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition shadow-md cursor-pointer"
            >
              <PackagePlus className="w-4 h-4" />
              <span>Apply Pricing & Push to Active Inventory</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
