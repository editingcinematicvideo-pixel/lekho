import React, { useState, useEffect } from 'react';
import { Wallet, X, Check, Sparkles, AlertCircle, RotateCcw } from 'lucide-react';
import {
  SplitPaymentBreakdown,
  SPLIT_PAYMENT_METHODS,
  createEmptySplitBreakdown,
  calculateSplitTotal,
  validateSplitPayment,
  autoFillSplitMethod,
} from '../../utils/posOperations';

interface SplitPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  totalAmount: number;
  initialBreakdown?: SplitPaymentBreakdown | null;
  isPartialAdvance?: boolean;
  maxBillTotal?: number;
  onConfirm: (breakdown: SplitPaymentBreakdown, confirmedTargetAmount: number) => void;
}

export const SplitPaymentModal: React.FC<SplitPaymentModalProps> = ({
  isOpen,
  onClose,
  totalAmount,
  initialBreakdown,
  isPartialAdvance = false,
  maxBillTotal,
  onConfirm,
}) => {
  const [targetAmount, setTargetAmount] = useState<number>(totalAmount);
  const [breakdown, setBreakdown] = useState<SplitPaymentBreakdown>(() =>
    initialBreakdown || createEmptySplitBreakdown()
  );

  useEffect(() => {
    if (isOpen) {
      setTargetAmount(totalAmount);
      if (initialBreakdown && calculateSplitTotal(initialBreakdown) > 0) {
        setBreakdown(initialBreakdown);
      } else {
        setBreakdown(createEmptySplitBreakdown());
      }
    }
  }, [isOpen, totalAmount, initialBreakdown]);

  if (!isOpen) return null;

  const currentSplitSum = calculateSplitTotal(breakdown);
  const validation = validateSplitPayment(breakdown, targetAmount);

  const handleMethodAmountChange = (key: keyof SplitPaymentBreakdown, rawVal: string) => {
    const val = Math.max(0, Math.round(Number(rawVal) || 0));
    setBreakdown((prev) => ({
      ...prev,
      [key]: val,
    }));
  };

  const handleAutoFillRemaining = (key: keyof SplitPaymentBreakdown) => {
    setBreakdown((prev) => autoFillSplitMethod(prev, key, targetAmount));
  };

  const handleReset = () => {
    setBreakdown(createEmptySplitBreakdown());
  };

  const handleSyncTargetWithSum = () => {
    if (isPartialAdvance && currentSplitSum > 0) {
      const clamped = maxBillTotal ? Math.min(currentSplitSum, maxBillTotal) : currentSplitSum;
      setTargetAmount(clamped);
    }
  };

  const handleConfirm = () => {
    // In Partial Advance mode, if the user entered split amounts that sum to a valid advance > 0
    // and haven't manually locked a different targetAmount, allow syncing if targetAmount was 0
    let finalTarget = targetAmount;
    if (isPartialAdvance && targetAmount === 0 && currentSplitSum > 0) {
      finalTarget = maxBillTotal ? Math.min(currentSplitSum, maxBillTotal) : currentSplitSum;
    }

    const check = validateSplitPayment(breakdown, finalTarget);
    if (!check.valid) return;

    onConfirm(breakdown, finalTarget);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/65 dark:bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
      <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl sm:rounded-3xl max-w-md w-full max-h-[90dvh] flex flex-col overflow-hidden p-4 sm:p-5 text-slate-900 dark:text-zinc-100 shadow-2xl">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-zinc-800 shrink-0">
          <div className="min-w-0 pr-2">
            <h3 className="lekho-modal-title text-slate-900 dark:text-white flex items-center gap-2">
              <Wallet className="w-4 h-4 text-[#1f8a5b] dark:text-emerald-400 shrink-0" />
              <span className="truncate">Split Payment (একাধিক মাধ্যমে পেমেন্ট)</span>
            </h3>
            <p className="text-[11px] text-slate-500 dark:text-zinc-400 mt-0.5">
              {isPartialAdvance
                ? 'Partial Advance-এর টাকা একাধিক মাধ্যমে ভাগ করে নিন'
                : 'মোট বিলের টাকা একাধিক Payment Method-এ ভাগ করে নিন'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-white cursor-pointer shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="mt-3 space-y-3 overflow-y-auto flex-1 pr-0.5">
          {/* Target Amount Summary Box */}
          <div className="bg-[#f4f7f5] dark:bg-zinc-950 p-3 rounded-2xl border border-slate-200/80 dark:border-zinc-800 flex items-center justify-between gap-3">
            <div>
              <span className="text-[11px] text-slate-500 dark:text-zinc-400 font-semibold block">
                {isPartialAdvance ? 'অগ্রিম পরিশোধযোগ্য টাকা (Advance Target)' : 'মোট পরিশোধযোগ্য বিল (Total Payable)'}
              </span>
              {isPartialAdvance ? (
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-sm font-bold text-slate-500">৳</span>
                  <input
                    type="number"
                    min={0}
                    max={maxBillTotal}
                    value={targetAmount || ''}
                    onChange={(e) => {
                      const v = Math.max(0, Number(e.target.value) || 0);
                      setTargetAmount(maxBillTotal ? Math.min(v, maxBillTotal) : v);
                    }}
                    placeholder="অগ্রিম টাকার পরিমাণ"
                    className="w-28 sm:w-32 bg-white dark:bg-zinc-900 border border-slate-300 dark:border-zinc-700 rounded-xl px-2.5 py-1 text-sm sm:text-base font-black text-[#164e3f] dark:text-emerald-400 focus:outline-none"
                  />
                  {currentSplitSum > 0 && currentSplitSum !== targetAmount && (
                    <button
                      type="button"
                      onClick={handleSyncTargetWithSum}
                      className="text-[10px] font-bold px-2 py-1 rounded-lg bg-[#e6f4ea] text-[#164e3f] dark:bg-emerald-950 dark:text-emerald-300 cursor-pointer"
                    >
                      যোগফলের সমান করুন (৳{currentSplitSum})
                    </button>
                  )}
                </div>
              ) : (
                <div className="text-lg sm:text-xl font-black text-slate-900 dark:text-white font-mono">
                  ৳{targetAmount.toLocaleString()}
                </div>
              )}
            </div>

            <div className="text-right">
              <span className="text-[11px] text-slate-500 dark:text-zinc-400 font-semibold block">
                স্প্লিট যোগফল (Entered)
              </span>
              <div
                className={`text-base sm:text-lg font-black font-mono ${
                  validation.valid
                    ? 'text-[#1f8a5b] dark:text-emerald-400'
                    : 'text-amber-600 dark:text-amber-400'
                }`}
              >
                ৳{currentSplitSum.toLocaleString()}
              </div>
            </div>
          </div>

          {/* 5 Payment Method Inputs */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-700 dark:text-zinc-300">
                Payment Method অনুযায়ী টাকার পরিমাণ লিখুন:
              </span>
              <button
                type="button"
                onClick={handleReset}
                className="text-[11px] font-semibold text-slate-500 hover:text-rose-600 flex items-center gap-1 cursor-pointer"
              >
                <RotateCcw className="w-3 h-3" />
                <span>রিসেট</span>
              </button>
            </div>

            {SPLIT_PAYMENT_METHODS.map((method) => {
              const val = breakdown[method.key] || 0;
              const otherSum = currentSplitSum - val;
              const canAutoFill = targetAmount > otherSum && val !== targetAmount - otherSum;

              return (
                <div
                  key={method.key}
                  className={`flex items-center justify-between gap-2 p-2.5 rounded-2xl border transition ${
                    val > 0
                      ? 'bg-[#e6f4ea]/60 dark:bg-emerald-950/30 border-[#1f8a5b]/50 dark:border-emerald-700/60'
                      : 'bg-[#f8faf9] dark:bg-zinc-950/70 border-slate-200/80 dark:border-zinc-800'
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white truncate">
                      {method.label}
                    </div>
                    <div className="text-[10px] text-slate-500 dark:text-zinc-400 truncate">
                      {method.bnLabel}
                    </div>
                  </div>

                  {canAutoFill && (
                    <button
                      type="button"
                      onClick={() => handleAutoFillRemaining(method.key)}
                      className="px-2 py-1 rounded-lg bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-[10px] font-bold text-[#164e3f] dark:text-emerald-400 hover:bg-emerald-50 transition shrink-0 cursor-pointer flex items-center gap-1"
                      title="বাকি টাকা এই মাধ্যমে বসিয়ে দিন"
                    >
                      <Sparkles className="w-2.5 h-2.5" />
                      <span>বাকি ৳{targetAmount - otherSum}</span>
                    </button>
                  )}

                  <div className="relative w-28 sm:w-32 shrink-0">
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                      ৳
                    </span>
                    <input
                      type="number"
                      min={0}
                      value={val === 0 ? '' : val}
                      onChange={(e) => handleMethodAmountChange(method.key, e.target.value)}
                      placeholder="0"
                      aria-label={method.label}
                      className="w-full bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-xl pl-6 pr-2.5 py-1.5 text-sm font-extrabold font-mono text-right text-slate-900 dark:text-white focus:outline-none focus:border-[#1f8a5b]"
                    />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Live Validation Status Banner */}
          <div
            className={`p-2.5 rounded-2xl border text-xs flex items-center justify-between gap-2 ${
              validation.valid
                ? 'bg-[#e6f4ea] dark:bg-emerald-950/50 border-emerald-300 dark:border-emerald-800 text-[#164e3f] dark:text-emerald-300'
                : 'bg-amber-50 dark:bg-amber-950/40 border-amber-300 dark:border-amber-800 text-amber-800 dark:text-amber-300'
            }`}
          >
            <div className="flex items-center gap-2">
              {validation.valid ? (
                <Check className="w-4 h-4 text-[#1f8a5b] dark:text-emerald-400 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
              )}
              <span className="font-semibold">
                {validation.valid
                  ? `মোট পরিশোধযোগ্য ৳${targetAmount.toLocaleString()} সম্পূর্ণ মিলেছে!`
                  : validation.errorBn}
              </span>
            </div>

            {!validation.valid && targetAmount > 0 && (
              <span className="font-mono font-bold shrink-0">
                {validation.remaining > 0
                  ? `বাকি: ৳${validation.remaining}`
                  : `বেশি: +৳${Math.abs(validation.remaining)}`}
              </span>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2.5 pt-3 mt-2 border-t border-slate-100 dark:border-zinc-800 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-zinc-700 text-xs font-bold text-slate-600 dark:text-zinc-400 hover:bg-slate-50 dark:hover:bg-zinc-800 cursor-pointer"
          >
            বাতিল (Cancel)
          </button>
          <button
            type="button"
            disabled={!validation.valid && !(isPartialAdvance && targetAmount === 0 && currentSplitSum > 0)}
            onClick={handleConfirm}
            className={`flex-1 py-2.5 rounded-xl text-white text-xs font-bold transition shadow flex items-center justify-center gap-1.5 ${
              validation.valid || (isPartialAdvance && targetAmount === 0 && currentSplitSum > 0)
                ? 'bg-[#164e3f] hover:bg-[#113f32] cursor-pointer'
                : 'bg-slate-300 dark:bg-zinc-800 text-slate-500 cursor-not-allowed'
            }`}
          >
            <Check className="w-4 h-4" />
            <span>স্প্লিট কনফার্ম করুন</span>
          </button>
        </div>
      </div>
    </div>
  );
};
