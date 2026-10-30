import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { dbService } from '../../services/db';
import { resolveAuthorizedSettingsTab } from '../../utils/securityPolicy';
import {
  User,
  Shield,
  Phone,
  Clock,
  TrendingUp,
  Receipt,
  Lock,
  ArrowRightLeft,
  X,
  Store,
  CheckCircle,
  FileSpreadsheet,
  Settings,
  CreditCard,
  KeyRound,
  Sparkles,
} from 'lucide-react';

interface UserProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigateToSettings?: (subtab?: string) => void;
  onNavigateToInvoices?: () => void;
  onOpenPinModal?: () => void;
  onOpenZReport?: () => void;
}

export const UserProfileModal: React.FC<UserProfileModalProps> = ({
  isOpen,
  onClose,
  onNavigateToSettings,
  onNavigateToInvoices,
  onOpenPinModal,
  onOpenZReport,
}) => {
  const {
    currentTenant,
    role,
    activeStaff,
    switchStaff,
    verifyOwnerPin,
    showToast,
  } = useApp();

  const [isChangingPin, setIsChangingPin] = useState(false);
  const [currentPinInput, setCurrentPinInput] = useState('');
  const [newPinInput, setNewPinInput] = useState('');
  const [confirmPinInput, setConfirmPinInput] = useState('');
  const [pinError, setPinError] = useState('');

  // Operator Handover state
  const [isHandoverOpen, setIsHandoverOpen] = useState(false);
  const [selectedStaffId, setSelectedStaffId] = useState('');
  const [staffPinInput, setStaffPinInput] = useState('');
  const [handoverError, setHandoverError] = useState('');

  if (!isOpen) return null;

  const staffList = dbService.getShopStaff(currentTenant.id);
  const invoices = dbService.getInvoices(currentTenant.id);

  // Calculate current operator today's performance
  const todayInvoices = invoices.filter((inv) => {
    const isToday = new Date(inv.createdAt).toDateString() === new Date().toDateString();
    if (!isToday) return false;
    if (activeStaff) {
      return inv.salesmanName === activeStaff.name;
    }
    return true;
  });

  const todayOperatorSales = todayInvoices.reduce((sum, inv) => sum + (inv.paidAmount ?? inv.total), 0);
  const todayPiecesSold = todayInvoices.reduce(
    (sum, inv) => sum + inv.items.reduce((acc, it) => acc + (it.quantity || 1), 0),
    0
  );
  const estimatedCommission = activeStaff
    ? todayPiecesSold * (activeStaff.commissionPerPiece || 0)
    : 0;

  const handleUpdatePin = (e: React.FormEvent) => {
    e.preventDefault();
    setPinError('');

    if (newPinInput.length !== 4 || !/^\d{4}$/.test(newPinInput)) {
      setPinError('নতুন পিন অবশ্যই ৪ সংখ্যার ডিজিট হতে হবে');
      return;
    }

    if (newPinInput !== confirmPinInput) {
      setPinError('নতুন পিন এবং নিশ্চিতকরণ পিন মিলছে না');
      return;
    }

    if (role === 'shop_owner') {
      if (!verifyOwnerPin(currentPinInput)) {
        setPinError('বর্তমান ওনার পিন সঠিক নয়');
        return;
      }
      dbService.updateTenant(currentTenant.id, { ownerPin: newPinInput });
      showToast('ওনার পিন সফলভাবে পরিবর্তন করা হয়েছে!', 'success');
    } else if (activeStaff) {
      if (!dbService.verifyStaffCounterPin(currentTenant.id, activeStaff.id, currentPinInput)) {
        setPinError('বর্তমান স্টাফ পিন সঠিক নয়');
        return;
      }
      dbService.updateStaffPin(currentTenant.id, activeStaff.id, newPinInput);
      showToast('স্টাফ পিন সফলভাবে পরিবর্তন করা হয়েছে!', 'success');
    }

    setIsChangingPin(false);
    setCurrentPinInput('');
    setNewPinInput('');
    setConfirmPinInput('');
  };

  const handleFastHandover = (e: React.FormEvent) => {
    e.preventDefault();
    setHandoverError('');

    const target = staffList.find((s) => s.id === selectedStaffId);
    if (!target) {
      setHandoverError('অনুগ্রহ করে একজন অপারেটর সিলেক্ট করুন');
      return;
    }

    if (!dbService.verifyStaffCounterPin(currentTenant.id, target.id, staffPinInput.trim())) {
      setHandoverError('ভুল ৪-ডিজিট পিন কোড! পুনরায় চেষ্টা করুন।');
      return;
    }

    switchStaff(target);
    showToast(`কাউন্টার অপারেটর পরিবর্তন: ${target.name} সক্রিয় হয়েছে`, 'success');
    setIsHandoverOpen(false);
    setSelectedStaffId('');
    setStaffPinInput('');
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/65 dark:bg-black/75 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-150">
      <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl sm:rounded-3xl max-w-lg w-full max-h-[90dvh] flex flex-col overflow-hidden p-4 sm:p-5 shadow-2xl text-slate-900 dark:text-zinc-100 relative">
        {/* Modal Header */}
        <div className="flex items-start justify-between pb-3.5 border-b border-slate-200 dark:border-zinc-800 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-11 h-11 rounded-2xl bg-[#164e3f] text-white flex items-center justify-center font-black text-lg shadow-xs shrink-0">
              {currentTenant.name.charAt(0)}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="lekho-modal-title text-slate-900 dark:text-white truncate">
                  {currentTenant.name}
                </h3>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#e6f4ea] dark:bg-emerald-950/50 text-[#164e3f] dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
                  {role === 'shop_owner' ? 'Merchant Owner' : 'Operator'}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-zinc-400 truncate">
                {currentTenant.marketMallName} • {currentTenant.shopNo}
              </p>
              <p className="text-[11px] font-mono text-slate-400 dark:text-zinc-500">
                Merchant ID: {currentTenant.merchantId || '190832'}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-zinc-800 transition cursor-pointer shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="overflow-y-auto flex-1 pr-0.5 pt-3.5 space-y-4">
          {/* Current Active User / Operator Card */}
          <div className="bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800/80 rounded-2xl p-3.5 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-slate-200 dark:bg-zinc-800 flex items-center justify-center text-slate-700 dark:text-zinc-300 font-bold shrink-0">
                  <User className="w-4 h-4" strokeWidth={2} />
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-bold text-slate-900 dark:text-white truncate">
                    {activeStaff ? activeStaff.name : currentTenant.ownerName}
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-zinc-400 flex items-center gap-2 truncate">
                    <span>@{activeStaff?.username || 'admin'}</span>
                    <span>•</span>
                    <span>{activeStaff?.phone || currentTenant.ownerPhone}</span>
                  </div>
                </div>
              </div>

              <span className="flex items-center gap-1.5 text-[11px] font-semibold text-[#164e3f] dark:text-emerald-400 bg-[#e6f4ea] dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 px-2 py-0.5 rounded-full shrink-0">
                <span className="w-1.5 h-1.5 rounded-full bg-[#1f8a5b] animate-pulse" />
                Counter Active
              </span>
            </div>

            {/* Today's Shift Performance Metrics */}
            <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-200/80 dark:border-zinc-800 text-center">
              <div className="p-2 rounded-xl bg-white dark:bg-zinc-900 border border-slate-200/60 dark:border-zinc-800">
                <div className="text-[10px] text-slate-500 dark:text-zinc-400 font-medium">আজকের মেমো</div>
                <div className="text-sm sm:text-base font-black font-mono text-slate-900 dark:text-white mt-0.5">
                  {todayInvoices.length}
                </div>
              </div>

              <div className="p-2 rounded-xl bg-white dark:bg-zinc-900 border border-slate-200/60 dark:border-zinc-800">
                <div className="text-[10px] text-slate-500 dark:text-zinc-400 font-medium">সংগৃহীত ক্যাশ/পেমেন্ট</div>
                <div className="text-sm sm:text-base font-black font-mono text-[#1f8a5b] dark:text-emerald-400 mt-0.5">
                  ৳{todayOperatorSales.toLocaleString()}
                </div>
              </div>

              <div className="p-2 rounded-xl bg-white dark:bg-zinc-900 border border-slate-200/60 dark:border-zinc-800">
                <div className="text-[10px] text-slate-500 dark:text-zinc-400 font-medium">বিক্রিত পিস</div>
                <div className="text-sm sm:text-base font-black font-mono text-slate-900 dark:text-white mt-0.5">
                  {todayPiecesSold} pcs
                </div>
              </div>
            </div>
          </div>

          {/* Action: Fast Operator Handover (Shift Change) */}
          {!isHandoverOpen ? (
            <div className="flex items-center justify-between gap-2 p-3 rounded-2xl bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="p-2 rounded-xl bg-[#e6f4ea] dark:bg-emerald-950/60 text-[#164e3f] dark:text-emerald-400 shrink-0">
                  <ArrowRightLeft className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-bold text-slate-900 dark:text-white">কাউন্টার অপারেটর শিফট চেঞ্জ</div>
                  <div className="text-[11px] text-slate-500 dark:text-zinc-400">অন্য স্টাফ বা ক্যাশিয়ারকে দায়িত্ব হস্তান্তর করুন</div>
                </div>
              </div>
              <button
                onClick={() => setIsHandoverOpen(true)}
                className="px-3 py-1.5 rounded-xl bg-[#164e3f] hover:bg-[#1f8a5b] text-white text-xs font-bold transition cursor-pointer shadow-2xs shrink-0"
              >
                হস্তান্তর করুন
              </button>
            </div>
          ) : (
            <form onSubmit={handleFastHandover} className="p-3.5 rounded-2xl bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                  <ArrowRightLeft className="w-3.5 h-3.5 text-[#1f8a5b]" />
                  নতুন অপারেটর নির্বাচন ও ৪-ডিজিট পিন
                </h4>
                <button
                  type="button"
                  onClick={() => setIsHandoverOpen(false)}
                  className="text-xs text-slate-400 hover:text-slate-700 dark:hover:text-white"
                >
                  বাতিল
                </button>
              </div>

              {handoverError && (
                <div className="p-2 rounded-xl bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 text-xs">
                  {handoverError}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 dark:text-zinc-400 mb-1">
                    অপারেটর নির্বাচন
                  </label>
                  <select
                    value={selectedStaffId}
                    onChange={(e) => setSelectedStaffId(e.target.value)}
                    className="w-full bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl px-2.5 py-1.5 text-xs text-slate-900 dark:text-white"
                  >
                    <option value="">-- স্টাফ নির্বাচন করুন --</option>
                    {staffList.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.role === 'owner' ? 'Admin' : 'Salesman'})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 dark:text-zinc-400 mb-1">
                    স্টাফের ৪-ডিজিট পিন কোড
                  </label>
                  <input
                    type="password"
                    maxLength={4}
                    value={staffPinInput}
                    onChange={(e) => setStaffPinInput(e.target.value)}
                    placeholder="••••"
                    className="w-full bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl px-2.5 py-1.5 text-xs font-mono text-center text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-2 rounded-xl bg-[#164e3f] hover:bg-[#1f8a5b] text-white text-xs font-bold transition cursor-pointer"
              >
                শিফট হ্যান্ডওভার সম্পন্ন করুন
              </button>
            </form>
          )}

          {/* Change PIN Accordion */}
          {!isChangingPin ? (
            <div className="flex items-center justify-between gap-2 p-3 rounded-2xl bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="p-2 rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 shrink-0">
                  <Lock className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-bold text-slate-900 dark:text-white">৪-ডিজিট সিক্রেট পিন পরিবর্তন</div>
                  <div className="text-[11px] text-slate-500 dark:text-zinc-400">লগইন ও ড্রয়ার অ্যাক্সেস পিন কোড আপডেট করুন</div>
                </div>
              </div>
              <button
                onClick={() => setIsChangingPin(true)}
                className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-zinc-700 text-slate-700 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800 text-xs font-semibold transition cursor-pointer shrink-0"
              >
                পিন পরিবর্তন
              </button>
            </div>
          ) : (
            <form onSubmit={handleUpdatePin} className="p-3.5 rounded-2xl bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                  <KeyRound className="w-3.5 h-3.5 text-amber-500" />
                  নতুন পিন নির্ধারণ
                </h4>
                <button
                  type="button"
                  onClick={() => setIsChangingPin(false)}
                  className="text-xs text-slate-400 hover:text-slate-700 dark:hover:text-white"
                >
                  বাতিল
                </button>
              </div>

              {pinError && (
                <div className="p-2 rounded-xl bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 text-xs">
                  {pinError}
                </div>
              )}

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-[10px] font-semibold text-slate-600 dark:text-zinc-400 mb-1">
                    বর্তমান পিন
                  </label>
                  <input
                    type="password"
                    maxLength={4}
                    required
                    value={currentPinInput}
                    onChange={(e) => setCurrentPinInput(e.target.value)}
                    placeholder="••••"
                    className="w-full bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl px-2 py-1.5 text-xs font-mono text-center text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-semibold text-slate-600 dark:text-zinc-400 mb-1">
                    নতুন পিন
                  </label>
                  <input
                    type="password"
                    maxLength={4}
                    required
                    value={newPinInput}
                    onChange={(e) => setNewPinInput(e.target.value)}
                    placeholder="••••"
                    className="w-full bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl px-2 py-1.5 text-xs font-mono text-center text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-semibold text-slate-600 dark:text-zinc-400 mb-1">
                    নিশ্চিত করুন
                  </label>
                  <input
                    type="password"
                    maxLength={4}
                    required
                    value={confirmPinInput}
                    onChange={(e) => setConfirmPinInput(e.target.value)}
                    placeholder="••••"
                    className="w-full bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl px-2 py-1.5 text-xs font-mono text-center text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold transition cursor-pointer"
              >
                পিন সংরক্ষণ করুন
              </button>
            </form>
          )}
        </div>

        {/* Quick Nav Shortcut Buttons */}
        <div className="pt-3 mt-2 border-t border-slate-200 dark:border-zinc-800 grid grid-cols-2 sm:grid-cols-4 gap-2 shrink-0">
          <button
            onClick={() => {
              onClose();
              if (onNavigateToSettings) onNavigateToSettings(resolveAuthorizedSettingsTab(role, 'profile'));
            }}
            className="p-2.5 rounded-xl border border-slate-200 dark:border-zinc-800 hover:bg-slate-100 dark:hover:bg-zinc-850 flex flex-col items-center justify-center gap-1 text-slate-700 dark:text-zinc-300 transition cursor-pointer text-center"
          >
            <Settings className="w-4 h-4 text-[#164e3f] dark:text-emerald-400" />
            <span className="text-[11px] font-semibold">Store Settings</span>
          </button>

          <button
            onClick={() => {
              onClose();
              if (onNavigateToSettings) onNavigateToSettings('invoices');
            }}
            className="p-2.5 rounded-xl border border-slate-200 dark:border-zinc-800 hover:bg-slate-100 dark:hover:bg-zinc-850 flex flex-col items-center justify-center gap-1 text-slate-700 dark:text-zinc-300 transition cursor-pointer text-center"
          >
            <Receipt className="w-4 h-4 text-[#1f8a5b] dark:text-emerald-400" />
            <span className="text-[11px] font-semibold">Invoice Design</span>
          </button>

          <button
            onClick={() => {
              onClose();
              if (onNavigateToInvoices) onNavigateToInvoices();
            }}
            className="p-2.5 rounded-xl border border-slate-200 dark:border-zinc-800 hover:bg-slate-100 dark:hover:bg-zinc-850 flex flex-col items-center justify-center gap-1 text-slate-700 dark:text-zinc-300 transition cursor-pointer text-center"
          >
            <Receipt className="w-4 h-4 text-[#164e3f] dark:text-emerald-400" />
            <span className="text-[11px] font-semibold">All Invoices</span>
          </button>

          <button
            onClick={() => {
              onClose();
              if (onOpenZReport) onOpenZReport();
            }}
            className="p-2.5 rounded-xl border border-slate-200 dark:border-zinc-800 hover:bg-slate-100 dark:hover:bg-zinc-850 flex flex-col items-center justify-center gap-1 text-slate-700 dark:text-zinc-300 transition cursor-pointer text-center"
          >
            <FileSpreadsheet className="w-4 h-4 text-[#1f8a5b] dark:text-emerald-400" />
            <span className="text-[11px] font-semibold">Z-Report Shift</span>
          </button>
        </div>
      </div>
    </div>
  );
};
