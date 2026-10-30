import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { TenantShop, ShopProfile, SubscriptionPlan } from '../../types';
import { dbService } from '../../services/db';
import {
  Store,
  CheckCircle,
  Copy,
  Check,
  CreditCard,
  ArrowRight,
  ShieldCheck,
  Sparkles,
  Shirt,
  ShoppingBag,
  Building2,
  X,
  Smartphone,
} from 'lucide-react';

interface StoreOnboardingModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const StoreOnboardingModal: React.FC<StoreOnboardingModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { switchTenant, reloadShopData, showToast, pickText } = useApp();
  const [step, setStep] = useState<1 | 2 | 3>(1);

  // Step 1: Store details
  const [shopName, setShopName] = useState('');
  const [bengaliName, setBengaliName] = useState('');
  const [category, setCategory] = useState<ShopProfile>('jersey');
  const [ownerName, setOwnerName] = useState('');
  const [ownerPhone, setOwnerPhone] = useState('');
  const [ownerPin, setOwnerPin] = useState('1234');
  const [marketMallName, setMarketMallName] = useState('Jamuna Future Park');
  const [shopNo, setShopNo] = useState('Shop #204');

  // Step 2: Subscription Plan
  const [plan, setPlan] = useState<SubscriptionPlan>('pro');

  // Step 3: Payment
  const [paymentMethod, setPaymentMethod] = useState<'bkash' | 'nagad'>('bkash');
  const [senderPhone, setSenderPhone] = useState('');
  const [trxId, setTrxId] = useState('');
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const recipientNumbers = {
    bkash: '01711-223399 (bKash Merchant / Personal)',
    nagad: '01822-445588 (Nagad Merchant)',
  };

  const handleCopyNumber = () => {
    navigator.clipboard.writeText(recipientNumbers[paymentMethod]);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCompleteOnboarding = (e: React.FormEvent) => {
    e.preventDefault();
    if (!trxId || !senderPhone) {
      showToast('Enter valid Sender Phone and TrxID', 'error');
      return;
    }

    const cleanTrx = trxId.trim().toUpperCase();
    if (cleanTrx.length < 6) {
      showToast('Invalid TrxID format. Must be at least 6 characters.', 'error');
      return;
    }

    const planAmount = plan === 'starter' ? 499 : 999;
    const tenantId = `shop_${shopName.toLowerCase().replace(/[^a-z0-9]/g, '_')}_${Date.now().toString().slice(-4)}`;

    const newShop: TenantShop = {
      id: tenantId,
      name: shopName.trim(),
      bengaliName: bengaliName.trim() || undefined,
      slug: shopName.toLowerCase().replace(/[^a-z0-9]/g, '-'),
      ownerName: ownerName.trim() || 'Store Admin',
      ownerPhone: ownerPhone.trim(),
      ownerPin: ownerPin.trim() || '1234',
      category,
      marketMallName: marketMallName.trim(),
      shopNo: shopNo.trim(),
      returnPolicy: '3-day fresh stock exchange with memo and original price tags. No cash refunds.',
      createdAt: new Date().toISOString(),
      subscription: {
        plan,
        status: 'grace', // Immediate 24h grace access!
        amount: planAmount,
        trxId: cleanTrx,
        senderPhone: senderPhone.trim(),
        paymentMethod,
        submittedAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        graceEndsAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      },
      featureFlags: {
        jerseyCustomization: category === 'jersey' || category === 'hybrid',
        alterationTracker: category === 'clothing' || category === 'hybrid',
        teamBulkOrders: category === 'jersey' || category === 'hybrid',
        staffPins: true,
        multiDrawer: true,
        resellerCounter: category === 'jersey' || category === 'hybrid',
      },
      stats: {
        totalSales: 0,
        totalOrders: 0,
        totalDueRecovered: 0,
        gmv: 0,
      },
    };

    dbService.addTenant(newShop);
    reloadShopData();
    switchTenant(tenantId);
    showToast(
      `Instant Verification Active! "${newShop.name}" granted 24-Hour Grace Access. TrxID queued for Central Audit.`,
      'success'
    );
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 dark:bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
      <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-750 rounded-2xl sm:rounded-3xl max-w-lg w-full max-h-[90dvh] flex flex-col overflow-hidden p-4 sm:p-5 text-slate-900 dark:text-zinc-100 shadow-2xl relative">
        <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-zinc-800 shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-[#e6f4ea] dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30 flex items-center justify-center text-[#164e3f] dark:text-emerald-400 font-bold shrink-0">
              {step}
            </div>
            <div className="min-w-0">
              <h3 className="lekho-modal-title text-slate-900 dark:text-white truncate">Store Registration & bKash/Nagad Checkout</h3>
              <p className="text-[11px] text-slate-500 dark:text-zinc-400 truncate">Step {step} of 3 • Instant 24h Grace Activation</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-700 dark:text-zinc-400 dark:hover:text-white shrink-0">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 pr-0.5">
        {/* STEP 1: STORE DETAILS */}
        {step === 1 && (
          <div className="mt-4 space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                Store / Shop Name (English)
              </label>
              <input
                type="text"
                required
                value={shopName}
                onChange={(e) => setShopName(e.target.value)}
                placeholder="e.g. Dhaka Kits Arena"
                className="w-full bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-750 rounded-xl px-3.5 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-emerald-600"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                  {pickText('বাংলা নাম', 'Bengali Name')}
                </label>
                <input
                  type="text"
                  value={bengaliName}
                  onChange={(e) => setBengaliName(e.target.value)}
                  placeholder="e.g. ঢাকা কিটস অ্যারেনা"
                  className="w-full bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-750 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white font-bengali focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                  Owner Phone Number
                </label>
                <input
                  type="text"
                  required
                  value={ownerPhone}
                  onChange={(e) => setOwnerPhone(e.target.value)}
                  placeholder="017..."
                  className="w-full bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-750 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white font-mono focus:outline-none"
                />
              </div>
            </div>

            {/* Store Profile Category Selector */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-2">
                Store Profile & Specialized Workflow
              </label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setCategory('jersey')}
                  className={`p-3 rounded-xl border text-center transition cursor-pointer ${
                    category === 'jersey'
                      ? 'bg-[#e6f4ea] dark:bg-emerald-950/40 border-[#164e3f] dark:border-emerald-500 text-slate-900 dark:text-white shadow-2xs'
                      : 'bg-slate-50 dark:bg-zinc-950 border-slate-200 dark:border-zinc-800 text-slate-500 dark:text-zinc-400'
                  }`}
                >
                  <Shirt className="w-5 h-5 mx-auto mb-1 text-[#164e3f] dark:text-emerald-400" />
                  <div className="text-xs font-bold">Jersey Store</div>
                  <div className="text-[9px] text-slate-500 dark:text-zinc-400">Custom print, clubs</div>
                </button>

                <button
                  type="button"
                  onClick={() => setCategory('clothing')}
                  className={`p-3 rounded-xl border text-center transition cursor-pointer ${
                    category === 'clothing'
                      ? 'bg-[#e6f4ea] dark:bg-emerald-950/40 border-[#164e3f] dark:border-emerald-500 text-slate-900 dark:text-white shadow-2xs'
                      : 'bg-slate-50 dark:bg-zinc-950 border-slate-200 dark:border-zinc-800 text-slate-500 dark:text-zinc-400'
                  }`}
                >
                  <ShoppingBag className="w-5 h-5 mx-auto mb-1 text-[#164e3f] dark:text-emerald-400" />
                  <div className="text-xs font-bold">Apparel Store</div>
                  <div className="text-[9px] text-slate-500 dark:text-zinc-400">Pants, Panjabi, tailor</div>
                </button>

                <button
                  type="button"
                  onClick={() => setCategory('hybrid')}
                  className={`p-3 rounded-xl border text-center transition cursor-pointer ${
                    category === 'hybrid'
                      ? 'bg-[#e6f4ea] dark:bg-emerald-950/40 border-[#164e3f] dark:border-emerald-500 text-slate-900 dark:text-white shadow-2xs'
                      : 'bg-slate-50 dark:bg-zinc-950 border-slate-200 dark:border-zinc-800 text-slate-500 dark:text-zinc-400'
                  }`}
                >
                  <Building2 className="w-5 h-5 mx-auto mb-1 text-[#164e3f] dark:text-emerald-400" />
                  <div className="text-xs font-bold">Hybrid Store</div>
                  <div className="text-[9px] text-slate-500 dark:text-zinc-400">Both workflows</div>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                  Shopping Mall / Market Name
                </label>
                <input
                  type="text"
                  value={marketMallName}
                  onChange={(e) => setMarketMallName(e.target.value)}
                  placeholder="e.g. Bashundhara City, Level 3"
                  className="w-full bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-750 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                  Shop No. / Block
                </label>
                <input
                  type="text"
                  value={shopNo}
                  onChange={(e) => setShopNo(e.target.value)}
                  placeholder="Shop #34, Block B"
                  className="w-full bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-750 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-none"
                />
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                if (!shopName || !ownerPhone) {
                  showToast('Shop Name and Owner Phone are required', 'error');
                  return;
                }
                setSenderPhone(ownerPhone);
                setStep(2);
              }}
              className="w-full py-3 rounded-xl bg-[#164e3f] hover:bg-[#1f8a5b] text-white text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-sm cursor-pointer"
            >
              Continue to Subscription Tier <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* STEP 2: SELECT PLAN */}
        {step === 2 && (
          <div className="mt-4 space-y-4">
            <div className="text-xs text-slate-500 dark:text-zinc-400">
              Select monthly subscription package for <strong className="text-slate-900 dark:text-white">{shopName}</strong>:
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Starter Plan */}
              <div
                onClick={() => setPlan('starter')}
                className={`p-4 rounded-2xl border transition cursor-pointer space-y-2 ${
                  plan === 'starter'
                    ? 'bg-[#e6f4ea] dark:bg-emerald-500/10 border-[#164e3f] dark:border-emerald-500 text-slate-900 dark:text-white shadow-sm'
                    : 'bg-slate-50 dark:bg-zinc-950 border-slate-200 dark:border-zinc-800 text-slate-500 dark:text-zinc-400 hover:border-slate-300 dark:hover:border-zinc-700'
                }`}
              >
                <div className="flex justify-between items-center">
                  <span className="font-bold text-xs uppercase tracking-wider">Starter Retail</span>
                  <span className="text-lg font-black text-[#164e3f] dark:text-emerald-400 font-mono">৳499/mo</span>
                </div>
                <ul className="text-[11px] text-slate-600 dark:text-zinc-400 space-y-1">
                  <li>• Up to 2 Staff PINs</li>
                  <li>• POS Billing & WhatsApp Slips</li>
                  <li>• Multi-Scale Size Matrix</li>
                  <li>• Offline IndexedDB Resilience</li>
                </ul>
              </div>

              {/* Pro Plan */}
              <div
                onClick={() => setPlan('pro')}
                className={`p-4 rounded-2xl border transition cursor-pointer space-y-2 ${
                  plan === 'pro'
                    ? 'bg-[#e6f4ea] dark:bg-emerald-500/10 border-[#164e3f] dark:border-emerald-500 text-slate-900 dark:text-white shadow-sm'
                    : 'bg-slate-50 dark:bg-zinc-950 border-slate-200 dark:border-zinc-800 text-slate-500 dark:text-zinc-400 hover:border-slate-300 dark:hover:border-zinc-700'
                }`}
              >
                <div className="flex justify-between items-center">
                  <span className="font-bold text-xs uppercase tracking-wider text-amber-700 dark:text-amber-300">
                    Pro Unlimited
                  </span>
                  <span className="text-lg font-black text-amber-600 dark:text-amber-400 font-mono">৳999/mo</span>
                </div>
                <ul className="text-[11px] text-slate-600 dark:text-zinc-400 space-y-1">
                  <li>• Unlimited Staff & Multi-Drawers</li>
                  <li>• Jersey Customization Heat-Press</li>
                  <li>• Team Bulk Order Matrix</li>
                  <li>• Reseller Baki Khata Ledger</li>
                </ul>
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-zinc-750 text-xs font-semibold text-slate-600 dark:text-zinc-400 cursor-pointer"
              >
                Back
              </button>
              <button
                type="button"
                onClick={() => setStep(3)}
                className="flex-1 py-2.5 rounded-xl bg-[#164e3f] hover:bg-[#1f8a5b] text-white text-xs font-bold transition shadow-sm cursor-pointer"
              >
                Proceed to Payment <ArrowRight className="w-3.5 h-3.5 inline ml-1" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 3: bKASH / NAGAD TrxID CHECKOUT */}
        {step === 3 && (
          <form onSubmit={handleCompleteOnboarding} className="mt-4 space-y-4">
            {/* Payment Method Switcher */}
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setPaymentMethod('bkash')}
                className={`py-2 rounded-xl text-xs font-bold border transition cursor-pointer ${
                  paymentMethod === 'bkash'
                    ? 'bg-pink-600 text-white border-pink-500 shadow-sm'
                    : 'bg-slate-50 dark:bg-zinc-950 border-slate-200 dark:border-zinc-800 text-slate-600 dark:text-zinc-400'
                }`}
              >
                bKash Payment
              </button>
              <button
                type="button"
                onClick={() => setPaymentMethod('nagad')}
                className={`py-2 rounded-xl text-xs font-bold border transition cursor-pointer ${
                  paymentMethod === 'nagad'
                    ? 'bg-orange-600 text-white border-orange-500 shadow-sm'
                    : 'bg-slate-50 dark:bg-zinc-950 border-slate-200 dark:border-zinc-800 text-slate-600 dark:text-zinc-400'
                }`}
              >
                Nagad Payment
              </button>
            </div>

            {/* Recipient instructions */}
            <div className="bg-slate-50 dark:bg-zinc-950 p-3.5 rounded-xl border border-slate-200 dark:border-zinc-800 space-y-2 text-xs">
              <div className="flex justify-between items-center text-slate-600 dark:text-zinc-400">
                <span>Send Money / Merchant Payment:</span>
                <span className="font-bold text-slate-900 dark:text-white text-sm">
                  ৳{plan === 'starter' ? '499' : '999'}
                </span>
              </div>

              <div className="bg-white dark:bg-zinc-900 p-2.5 rounded-lg border border-slate-200 dark:border-zinc-750 flex items-center justify-between">
                <span className="font-mono text-xs font-bold text-[#164e3f] dark:text-amber-300">
                  {recipientNumbers[paymentMethod]}
                </span>
                <button
                  type="button"
                  onClick={handleCopyNumber}
                  className="text-[11px] text-slate-500 hover:text-slate-900 dark:text-zinc-400 dark:hover:text-white flex items-center gap-1 cursor-pointer"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? 'Copied' : 'Copy'}</span>
                </button>
              </div>

              <p className="text-[10px] text-slate-500 dark:text-zinc-500 leading-tight">
                Send ৳{plan === 'starter' ? '499' : '999'} to the recipient number via {paymentMethod.toUpperCase()}, then paste the 8-10 digit Transaction ID (TrxID) below.
              </p>
            </div>

            {/* 2 Input fields: Sender Phone & TrxID */}
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                  1. {pickText('প্ররণকারীর ফোন নাম্বার', 'Sender Phone Number')}
                </label>
                <input
                  type="text"
                  required
                  value={senderPhone}
                  onChange={(e) => setSenderPhone(e.target.value)}
                  placeholder="017..."
                  className="w-full bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-750 rounded-xl px-3.5 py-2 text-xs text-slate-900 dark:text-white font-mono focus:outline-none focus:border-emerald-600"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                  2. Transaction ID (TrxID)
                </label>
                <input
                  type="text"
                  required
                  value={trxId}
                  onChange={(e) => setTrxId(e.target.value.toUpperCase())}
                  placeholder="e.g. BK90X8849L"
                  className="w-full bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-750 rounded-xl px-3.5 py-2 text-sm font-bold text-[#164e3f] dark:text-amber-400 font-mono uppercase tracking-widest focus:outline-none focus:border-emerald-600"
                />
              </div>
            </div>

            {/* Instant Grace Engine Banner */}
            <div className="bg-[#e6f4ea] dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30 p-3 rounded-xl flex items-center gap-2 text-xs text-[#164e3f] dark:text-emerald-300">
              <ShieldCheck className="w-4 h-4 shrink-0 text-[#164e3f] dark:text-emerald-400" />
              <span>
                <strong>Instant 24-Hour Grace Engine:</strong> Validating your TrxID grants immediate store activation while central admin verifies the payment.
              </span>
            </div>

            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={() => setStep(2)}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-zinc-750 text-xs font-semibold text-slate-600 dark:text-zinc-400 cursor-pointer"
              >
                Back
              </button>
              <button
                type="submit"
                className="flex-1 py-2.5 rounded-xl bg-[#164e3f] hover:bg-[#1f8a5b] text-white text-xs font-bold transition shadow-sm cursor-pointer"
              >
                Submit TrxID & Activate Store
              </button>
            </div>
          </form>
        )}
        </div>
      </div>
    </div>
  );
};
