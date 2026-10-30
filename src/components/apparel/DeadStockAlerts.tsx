import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { InventoryItem } from '../../types';
import { dbService } from '../../services/db';
import { BottomSheet } from '../ui/BottomSheet';
import { InfoTooltip } from '../ui/InfoTooltip';
import { AlertTriangle, Clock, Check, ChevronRight } from 'lucide-react';

export const DeadStockAlerts: React.FC = () => {
  const { currentTenant, role, showToast } = useApp();
  const [inventory, setInventory] = useState<InventoryItem[]>(() =>
    dbService.getInventory(currentTenant.id, role)
  );
  const [minDaysFilter, setMinDaysFilter] = useState<number>(45);
  const [selectedDeadStock, setSelectedDeadStock] = useState<{
    item: InventoryItem;
    size: string;
    stock: number;
    days: number;
    mrp: number;
    isClearance?: boolean;
  } | null>(null);

  const reload = () => {
    setInventory(dbService.getInventory(currentTenant.id, role));
  };

  // Find all broken sizes sitting in rack for > minDaysFilter
  const deadStockItems: Array<{
    item: InventoryItem;
    size: string;
    stock: number;
    days: number;
    mrp: number;
    isClearance?: boolean;
  }> = [];

  inventory.forEach((item) => {
    item.variants?.forEach((v) => {
      const days = v.daysInStock || 0;
      if (v.stock > 0 && days >= minDaysFilter) {
        deadStockItems.push({
          item,
          size: v.size,
          stock: v.stock,
          days,
          mrp: v.mrp,
          isClearance: v.isClearance,
        });
      }
    });
  });

  const handleApplyClearance = (itemId: string, size: string, discountPercent: number) => {
    const targetItem = inventory.find((i) => i.id === itemId);
    if (!targetItem) return;

    const updatedVariants = targetItem.variants.map((v) => {
      if (v.size === size) {
        const discountedMrp = Math.round(v.mrp * (1 - discountPercent / 100));
        const safeFloor = v.bottomPrice || targetItem.bottomPrice || Math.round(v.mrp * 0.65);
        return {
          ...v,
          mrp: Math.max(discountedMrp, safeFloor),
          isClearance: true,
        };
      }
      return v;
    });

    dbService.updateInventoryItem(currentTenant.id, itemId, { variants: updatedVariants }, role);
    reload();
    showToast(`Marked ${size} for clearance with ${discountPercent}% discount!`, 'success');
  };

  return (
    <div className="bg-white dark:bg-zinc-900 border border-slate-200/90 dark:border-zinc-800 rounded-3xl p-5 sm:p-6 space-y-5 shadow-2xs">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-100 dark:border-zinc-800 gap-3">
        <div className="flex items-center gap-1.5">
          <h2 className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-white">
            Broken Size & Aging Stock
          </h2>
          <InfoTooltip text="Shows variant sizes sitting unsold in stock longer than the selected day threshold." />
        </div>

        {/* Days filter pill */}
        <div className="flex items-center gap-1.5 bg-[#f4f7f5] dark:bg-zinc-950 p-1 rounded-2xl border border-slate-200/80 dark:border-zinc-800 text-xs self-start sm:self-auto">
          <span className="text-[11px] font-semibold text-slate-500 dark:text-zinc-400 px-2">
            Aging:
          </span>
          {[30, 45, 60].map((d) => (
            <button
              key={d}
              onClick={() => setMinDaysFilter(d)}
              className={`px-3 py-1.5 rounded-xl font-bold transition cursor-pointer ${
                minDaysFilter === d
                  ? 'bg-[#164e3f] text-white shadow-2xs'
                  : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              &gt;{d} Days
            </button>
          ))}
        </div>
      </div>

      {/* Dead-stock items table */}
      {deadStockItems.length === 0 ? (
        <div className="p-12 text-center text-slate-500 dark:text-zinc-400 text-xs border border-dashed border-slate-200 dark:border-zinc-800 rounded-2xl bg-[#f4f7f5]/50 dark:bg-zinc-950/50">
          <Check className="w-8 h-8 text-[#1f8a5b] dark:text-emerald-400 mx-auto mb-2" />
          No broken size dead-stock found sitting beyond {minDaysFilter} days. Healthy inventory turnaround!
        </div>
      ) : (
        <div className="border border-slate-200/90 dark:border-zinc-800 rounded-2xl overflow-hidden bg-white dark:bg-zinc-950">
          {/* Mobile Compact Summary List (< 768px) */}
          <div className="md:hidden divide-y divide-slate-100 dark:divide-zinc-850">
            {deadStockItems.map((ds, idx) => (
              <button
                key={`m_${ds.item.id}_${ds.size}_${idx}`}
                type="button"
                onClick={() => setSelectedDeadStock(ds)}
                className="w-full px-3.5 py-2.5 text-left flex items-center justify-between gap-2.5 hover:bg-slate-50 dark:hover:bg-zinc-900/60 transition cursor-pointer"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-xs text-slate-900 dark:text-white truncate">
                      {ds.item.name}
                    </span>
                    <span className="px-1.5 py-0.2 rounded bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 font-mono font-bold text-[10px] shrink-0">
                      {ds.size}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-400 mt-0.5">
                    {ds.stock} pcs • {ds.days} days on rack
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <div className="text-right">
                    <div className="font-mono font-bold text-xs text-slate-900 dark:text-white">
                      ৳{ds.mrp}
                    </div>
                    {ds.isClearance && (
                      <div className="text-[10px] font-bold text-[#1f8a5b] dark:text-emerald-400">
                        Clearance
                      </div>
                    )}
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
                </div>
              </button>
            ))}
          </div>

          {/* Desktop Table (>= 768px) */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700 dark:text-zinc-300">
              <thead className="bg-[#f4f7f5] dark:bg-zinc-900 border-b border-slate-200/80 dark:border-zinc-800 text-[11px] uppercase font-bold text-slate-500 dark:text-zinc-400">
                <tr>
                  <th className="p-3.5">Product Name & Category</th>
                  <th className="p-3.5 text-center">Broken Size</th>
                  <th className="p-3.5 text-center">In Stock</th>
                  <th className="p-3.5 text-center">Rack Age</th>
                  <th className="p-3.5 text-right">Current Price</th>
                  <th className="p-3.5 text-center">1-Click Clearance Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-zinc-850">
                {deadStockItems.map((ds, idx) => (
                  <tr
                    key={`${ds.item.id}_${ds.size}_${idx}`}
                    onClick={() => setSelectedDeadStock(ds)}
                    className="hover:bg-slate-50 dark:hover:bg-zinc-900/60 transition cursor-pointer"
                  >
                    <td className="p-3.5">
                      <div className="font-bold text-slate-900 dark:text-white">{ds.item.name}</div>
                      <div className="text-[10px] font-mono text-slate-400 dark:text-zinc-500">
                        {ds.item.sku}
                      </div>
                    </td>
                    <td className="p-3.5 text-center">
                      <span className="bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800 px-2.5 py-1 rounded-lg font-mono font-bold text-xs">
                        {ds.size}
                      </span>
                    </td>
                    <td className="p-3.5 text-center font-bold text-slate-800 dark:text-zinc-200">
                      {ds.stock} pcs
                    </td>
                    <td className="p-3.5 text-center">
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800">
                        <Clock className="w-3 h-3" />
                        {ds.days} days
                      </span>
                    </td>
                    <td className="p-3.5 text-right font-mono font-bold text-slate-900 dark:text-white">
                      ৳{ds.mrp}
                    </td>
                    <td className="p-3.5 text-center" onClick={(e) => e.stopPropagation()}>
                      {ds.isClearance ? (
                        <span className="text-[10px] bg-[#e6f4ea] dark:bg-emerald-950/50 text-[#1f8a5b] dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 px-2.5 py-1 rounded-xl font-bold">
                          Clearance Active
                        </span>
                      ) : (
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => handleApplyClearance(ds.item.id, ds.size, 20)}
                            className="px-2.5 py-1 bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/40 dark:hover:bg-amber-900/50 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800 rounded-xl text-[10px] font-bold transition cursor-pointer"
                          >
                            -20% Off
                          </button>
                          <button
                            onClick={() => handleApplyClearance(ds.item.id, ds.size, 35)}
                            className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-900/50 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800 rounded-xl text-[10px] font-bold transition cursor-pointer"
                          >
                            -35% Clearance
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Compact Bottom Sheet for Dead-Stock Clearance */}
      <BottomSheet
        isOpen={Boolean(selectedDeadStock)}
        onClose={() => setSelectedDeadStock(null)}
        title={selectedDeadStock ? `${selectedDeadStock.item.name} (${selectedDeadStock.size})` : 'Dead-Stock Details'}
        subtitle={selectedDeadStock ? `SKU: ${selectedDeadStock.item.sku}` : undefined}
        maxHeightClass="max-h-[45dvh]"
        footer={
          selectedDeadStock && !selectedDeadStock.isClearance ? (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  handleApplyClearance(selectedDeadStock.item.id, selectedDeadStock.size, 20);
                  setSelectedDeadStock(null);
                }}
                className="flex-1 py-2 px-3 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs cursor-pointer"
              >
                Apply -20% Off
              </button>
              <button
                type="button"
                onClick={() => {
                  handleApplyClearance(selectedDeadStock.item.id, selectedDeadStock.size, 35);
                  setSelectedDeadStock(null);
                }}
                className="flex-1 py-2 px-3 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs cursor-pointer"
              >
                -35% Clearance
              </button>
            </div>
          ) : undefined
        }
      >
        {selectedDeadStock && (
          <div className="space-y-2.5">
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-zinc-800/60">
                <div className="text-[10px] text-slate-400">In Stock</div>
                <div className="font-mono font-bold text-slate-900 dark:text-white mt-0.5">
                  {selectedDeadStock.stock} pcs
                </div>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-zinc-800/60">
                <div className="text-[10px] text-slate-400">Rack Age</div>
                <div className="font-mono font-bold text-rose-600 mt-0.5">
                  {selectedDeadStock.days} days
                </div>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-zinc-800/60">
                <div className="text-[10px] text-slate-400">Selling Price</div>
                <div className="font-mono font-bold text-slate-900 dark:text-white mt-0.5">
                  ৳{selectedDeadStock.mrp}
                </div>
              </div>
            </div>
          </div>
        )}
      </BottomSheet>
    </div>
  );
};
