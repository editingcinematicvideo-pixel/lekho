import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { dbService } from '../../services/db';
import { ShieldAlert, KeyRound, Loader2, AlertTriangle } from 'lucide-react';

interface BottomPriceLockModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAuthorized: (overrideToken?: string) => void;
  itemName: string;
  attemptedPrice: number;
  bottomPrice: number;
  productId?: string;
  quantity?: number;
}

export const BottomPriceLockModal: React.FC<BottomPriceLockModalProps> = ({
  isOpen,
  onClose,
  onAuthorized,
  itemName,
  attemptedPrice,
  bottomPrice,
  productId,
  quantity = 1,
}) => {
  const { currentTenant, showToast, isOffline } = useApp();
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLockedOut, setIsLockedOut] = useState(false);
  const [remainingLockSeconds, setRemainingLockSeconds] = useState(0);
  const [remainingAttempts, setRemainingAttempts] = useState(5);
  const [isPinConfigured, setIsPinConfigured] = useState(true);

  // Poll / fetch server lockout and pin status when modal opens
  useEffect(() => {
    if (!isOpen) {
      setPin('');
      setError('');
      return;
    }

    let isMounted = true;
    dbService.getOwnerPinStatus(currentTenant.id).then((status) => {
      if (!isMounted) return;
      setIsPinConfigured(status.isConfigured);
      if (!status.isConfigured) {
        setError('দোকানের Owner PIN কনফিগার করা হয়নি। Settings থেকে ওনার পিন সেট না করা পর্যন্ত ফ্লোর প্রাইসের নিচে বিক্রয় অনুমোদিত নয়।');
      }
      if (status.isLockedOut) {
        setIsLockedOut(true);
        setRemainingLockSeconds(status.remainingLockSeconds || 60);
      } else {
        setIsLockedOut(false);
        setRemainingAttempts(status.remainingAttempts ?? 5);
      }
    });

    return () => {
      isMounted = false;
    };
  }, [isOpen, currentTenant.id]);

  // Lockout countdown timer
  useEffect(() => {
    if (!isLockedOut || remainingLockSeconds <= 0) return;
    const timer = setInterval(() => {
      setRemainingLockSeconds((prev) => {
        if (prev <= 1) {
          setIsLockedOut(false);
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [isLockedOut, remainingLockSeconds]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLockedOut) {
      setError(`অতিরিক্ত ভুল পিন দেওয়ার কারণে লকআউট সক্রিয় রয়েছে। আর ${remainingLockSeconds}s পর চেষ্টা করুন।`);
      return;
    }

    if (isOffline) {
      setError('Offline Security Lock: অফলাইনে বটম-প্রাইসের নিচে বিক্রির অনুমোদন সম্ভব নয়। অনুগ্রহ করে ইন্টারনেট সংযোগ দিন অথবা পণ্যটি ফ্লোর প্রাইসে বিক্রি করুন।');
      return;
    }

    if (pin.length !== 4) {
      setError('৪-ডিজিটের ওনার পিন দিন।');
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      const res = await dbService.authorizeFloorOverride(currentTenant.id, {
        pin,
        productId: productId || 'adhoc_item',
        productName: itemName,
        attemptedRate: attemptedPrice,
        quantity,
        bottomPrice,
      });

      if (res.success && res.overrideToken) {
        showToast('Store Owner অনুমোদন নিশ্চিত হয়েছে। এককালীন ডিসকাউন্ট টোকেন ইস্যু করা হলো।', 'success');
        setPin('');
        setError('');
        onAuthorized(res.overrideToken);
      } else {
        if (res.isLocked) {
          setIsLockedOut(true);
          setRemainingLockSeconds(res.remainingLockSeconds || 60);
        }
        if (res.remainingAttempts !== undefined) {
          setRemainingAttempts(res.remainingAttempts);
        }
        setError(res.message || 'ভুল ওনার পিন। বিক্রয় প্রত্যাখ্যান করা হলো।');
        setPin('');
      }
    } catch (err: any) {
      setError(err?.message || 'সার্ভার সংযোগে ত্রুটি ঘটেছে।');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 dark:bg-black/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-150">
      <div className="bg-white dark:bg-zinc-900 border border-rose-200 dark:border-rose-500/50 rounded-2xl sm:rounded-3xl max-w-sm w-full max-h-[90dvh] overflow-y-auto p-4 sm:p-5 text-slate-900 dark:text-zinc-100 shadow-2xl relative">
        <div className="w-10 h-10 rounded-2xl bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30 flex items-center justify-center text-rose-600 dark:text-rose-400 mx-auto mb-2.5">
          <ShieldAlert className="w-5 h-5 animate-pulse" />
        </div>

        <h3 className="lekho-modal-title text-center text-slate-900 dark:text-white">
          Bottom-Price Security Lock
        </h3>
        <p className="text-xs text-slate-500 dark:text-zinc-400 text-center mt-1 mb-3.5">
          ফ্লোর প্রাইসের (Protected Bottom Price) নিচে ডিসকাউন্ট দিতে Store Owner-এর অনুমোদিত ৪-ডিজিট পিন আবশ্যক
        </p>

        <div className="bg-[#f4f7f5] dark:bg-zinc-950 p-3 rounded-2xl border border-slate-200/80 dark:border-zinc-800 text-xs space-y-1.5 mb-4">
          <div className="text-slate-900 dark:text-zinc-200 font-bold truncate">{itemName}</div>
          <div className="flex justify-between">
            <span className="text-slate-500 dark:text-zinc-400">Attempted Price (বিক্রয় মূল্য):</span>
            <span className="font-bold text-rose-600 dark:text-rose-400 font-mono">৳{attemptedPrice}</span>
          </div>
          <div className="flex justify-between border-t border-slate-200/80 dark:border-zinc-850 pt-1">
            <span className="text-slate-500 dark:text-zinc-400">Protected Floor (সর্বনিম্ন মূল্য):</span>
            <span className="font-bold text-[#1f8a5b] dark:text-amber-400 font-mono">৳{bottomPrice}</span>
          </div>
        </div>

        {!isPinConfigured && (
          <div className="mb-4 p-3 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 rounded-2xl text-amber-800 dark:text-amber-300 text-xs flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>দোকানের Owner PIN কনফিগার করা নেই। Settings থেকে মালিককে পিন সেট করতে বলুন।</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1">
              Store Owner 4-Digit PIN
            </label>
            <input
              type="password"
              inputMode="numeric"
              autoComplete="off"
              maxLength={4}
              required
              autoFocus
              disabled={isLockedOut || isSubmitting || !isPinConfigured}
              value={pin}
              onChange={(e) => {
                setPin(e.target.value.replace(/[^0-9]/g, ''));
                setError('');
              }}
              placeholder="••••"
              className="w-full bg-[#f4f7f5] dark:bg-zinc-950 border border-slate-200/80 dark:border-zinc-750 rounded-2xl px-3.5 py-2.5 text-center text-lg font-mono tracking-widest text-slate-900 dark:text-white focus:outline-none focus:border-[#164e3f] disabled:opacity-50"
            />
            {error && (
              <p className="text-[11px] text-rose-600 dark:text-rose-400 mt-1.5 text-center leading-snug font-semibold">
                {error}
              </p>
            )}
            {isLockedOut && (
              <p className="text-[11px] text-amber-600 dark:text-amber-400 mt-1 text-center font-mono font-bold animate-pulse">
                লকআউট সক্রিয়: {remainingLockSeconds}s
              </p>
            )}
          </div>

          <div className="text-[10px] text-slate-500 dark:text-zinc-500 text-center flex items-center justify-center gap-1">
            <KeyRound className="w-3 h-3 text-slate-400" />
            <span>সার্ভার থেকে এককালীন ক্রিপ্টোগ্রাফিক সিঙ্গেল-ইউজ টোকেন ইস্যু হবে</span>
          </div>

          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="flex-1 py-2.5 rounded-2xl border border-slate-200/90 dark:border-zinc-750 text-xs font-semibold text-slate-600 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-800 cursor-pointer disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLockedOut || pin.length < 4 || isSubmitting || !isPinConfigured}
              className="flex-1 py-2.5 rounded-2xl bg-[#164e3f] hover:bg-[#123e32] disabled:opacity-50 text-white text-xs font-bold transition shadow-xs cursor-pointer flex items-center justify-center gap-1.5"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>যাচাই হচ্ছে...</span>
                </>
              ) : (
                <span>Authorize Sale</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
