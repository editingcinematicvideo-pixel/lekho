import React, { useState, useEffect, useCallback } from 'react';
import { useApp } from '../../context/AppContext';
import { dbService } from '../../services/db';
import { SecurityAuditLog } from '../../types';
import { InfoTooltip } from '../ui/InfoTooltip';
import {
  ShieldCheck,
  ShieldAlert,
  KeyRound,
  Lock,
  RefreshCw,
  CheckCircle,
  AlertTriangle,
  History,
  Check,
  X,
  Loader2,
  Eye,
  EyeOff,
} from 'lucide-react';

export const OwnerSecuritySettingsCard: React.FC = () => {
  const { currentTenant, role, showToast, pickText } = useApp();

  // Role Gate: Only Shop Owner & Super Admin can access PIN management
  if (role !== 'shop_owner' && role !== 'super_admin') {
    return null;
  }

  const [loading, setLoading] = useState(true);
  const [isConfigured, setIsConfigured] = useState(false);
  const [protectionEnabled, setProtectionEnabled] = useState(true);
  const [isLockedOut, setIsLockedOut] = useState(false);
  const [remainingLockSeconds, setRemainingLockSeconds] = useState(0);

  // Modals state
  const [isSetupOpen, setIsSetupOpen] = useState(false);
  const [isChangeOpen, setIsChangeOpen] = useState(false);
  const [isResetOpen, setIsResetOpen] = useState(false);
  const [isConfirmDisableOpen, setIsConfirmDisableOpen] = useState(false);

  // Forms state
  const [setupPin, setSetupPin] = useState('');
  const [setupConfirm, setSetupConfirm] = useState('');
  const [setupError, setSetupError] = useState('');
  const [setupSubmitting, setSetupSubmitting] = useState(false);

  const [currentPin, setCurrentPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [newConfirm, setNewConfirm] = useState('');
  const [changeError, setChangeError] = useState('');
  const [changeSubmitting, setChangeSubmitting] = useState(false);

  const [ownerPassword, setOwnerPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [resetNewPin, setResetNewPin] = useState('');
  const [resetConfirmPin, setResetConfirmPin] = useState('');
  const [resetError, setResetError] = useState('');
  const [resetSubmitting, setResetSubmitting] = useState(false);

  const [toggleSubmitting, setToggleSubmitting] = useState(false);

  // Audit Logs state
  const [auditLogs, setAuditLogs] = useState<SecurityAuditLog[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);

  const refreshStatus = useCallback(async () => {
    try {
      setLoading(true);
      const res = await dbService.getOwnerPinStatus(currentTenant.id);
      setIsConfigured(res.isConfigured);
      setProtectionEnabled(res.protectionEnabled !== false);
      setIsLockedOut(res.isLockedOut);
      setRemainingLockSeconds(res.remainingLockSeconds || 0);
    } catch {
      // Fallback
    } finally {
      setLoading(false);
    }
  }, [currentTenant.id]);

  const loadAuditLogs = useCallback(async () => {
    try {
      setLoadingLogs(true);
      const res = await dbService.getSecurityAuditLogs(currentTenant.id);
      if (res.success && Array.isArray(res.logs)) {
        setAuditLogs(res.logs);
      }
    } catch {
      // Ignore
    } finally {
      setLoadingLogs(false);
    }
  }, [currentTenant.id]);

  useEffect(() => {
    void refreshStatus();
    void loadAuditLogs();
  }, [refreshStatus, loadAuditLogs]);

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

  const WEAK_PINS = ['0000', '1111', '2222', '3333', '4444', '5555', '6666', '7777', '8888', '9999', '1234', '4321'];

  // Handle PIN Setup
  const handleSetupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^\d{4}$/.test(setupPin)) {
      setSetupError('PIN অবশ্যই ৪ সংখ্যার (4-digit numeric) হতে হবে।');
      return;
    }
    if (WEAK_PINS.includes(setupPin)) {
      setSetupError('এই পিনটি খুবই দুর্বল ও অনুমানযোগ্য (যেমন: 1234 বা 0000)। অনুগ্রহ করে শক্তিশালী ও নিরাপদ ৪-সংখ্যার পিন নির্বাচন করুন।');
      return;
    }
    if (setupPin !== setupConfirm) {
      setSetupError('উভয় ঘরে প্রদত্ত পিন নম্বর একই হতে হবে।');
      return;
    }

    setSetupSubmitting(true);
    setSetupError('');
    try {
      const res = await dbService.setupOwnerPin(currentTenant.id, setupPin, setupConfirm, currentTenant);
      if (res.success) {
        showToast(res.message || 'Owner PIN সফলভাবে কনফিগার করা হয়েছে।', 'success');
        setIsSetupOpen(false);
        setSetupPin('');
        setSetupConfirm('');
        await refreshStatus();
        await loadAuditLogs();
      } else {
        setSetupError(res.message || (res as any).error || 'পিন সেট করতে সমস্যা হয়েছে।');
      }
    } catch (err: any) {
      setSetupError(err.message || 'সার্ভার সংযোগ ত্রুটি।');
    } finally {
      setSetupSubmitting(false);
    }
  };

  // Handle PIN Change
  const handleChangeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (currentPin.length !== 4) {
      setChangeError('বর্তমান ৪-ডিজিট পিন প্রদান করুন।');
      return;
    }
    if (!/^\d{4}$/.test(newPin)) {
      setChangeError('নতুন PIN অবশ্যই ৪ সংখ্যার হতে হবে।');
      return;
    }
    if (WEAK_PINS.includes(newPin)) {
      setChangeError('নতুন পিনটি খুবই দুর্বল ও অনুমানযোগ্য (যেমন: 1234 বা 0000)। অনুগ্রহ করে শক্তিশালী ৪-সংখ্যার পিন দিন।');
      return;
    }
    if (newPin !== newConfirm) {
      setChangeError('নতুন পিন ও কনফার্ম পিন মিলছে না।');
      return;
    }

    setChangeSubmitting(true);
    setChangeError('');
    try {
      const res = await dbService.changeOwnerPin(currentTenant.id, currentPin, newPin, newConfirm, currentTenant);
      if (res.success) {
        showToast(res.message || 'Owner PIN সফলভাবে পরিবর্তিত হয়েছে।', 'success');
        setIsChangeOpen(false);
        setCurrentPin('');
        setNewPin('');
        setNewConfirm('');
        await refreshStatus();
        await loadAuditLogs();
      } else {
        if (res.isLocked) {
          setIsLockedOut(true);
          setRemainingLockSeconds(res.remainingLockSeconds || 60);
        }
        setChangeError(res.message || (res as any).error || 'পিন পরিবর্তন করতে সমস্যা হয়েছে।');
      }
    } catch (err: any) {
      setChangeError(err.message || 'সার্ভার সংযোগ ত্রুটি।');
    } finally {
      setChangeSubmitting(false);
    }
  };

  // Handle PIN Reset
  const handleResetSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^\d{4}$/.test(resetNewPin)) {
      setResetError('নতুন PIN অবশ্যই ৪ সংখ্যার হতে হবে।');
      return;
    }
    if (WEAK_PINS.includes(resetNewPin)) {
      setResetError('নতুন পিনটি খুবই দুর্বল ও অনুমানযোগ্য (যেমন: 1234 বা 0000)। অনুগ্রহ করে শক্তিশালী ৪-সংখ্যার পিন দিন।');
      return;
    }
    if (resetNewPin !== resetConfirmPin) {
      setResetError('নতুন পিন ও কনফার্ম পিন মিলছে না।');
      return;
    }

    setResetSubmitting(true);
    setResetError('');
    try {
      const res = await dbService.resetOwnerPin(
        currentTenant.id,
        resetNewPin,
        resetConfirmPin,
        ownerPassword.trim() || undefined,
        currentTenant
      );
      if (res.success) {
        showToast(res.message || 'Owner PIN সফলভাবে রিসেট হয়েছে।', 'success');
        setIsResetOpen(false);
        setOwnerPassword('');
        setResetNewPin('');
        setResetConfirmPin('');
        await refreshStatus();
        await loadAuditLogs();
      } else {
        setResetError(res.message || (res as any).error || 'পিন রিসেট ব্যর্থ হয়েছে।');
      }
    } catch (err: any) {
      setResetError(err.message || 'সার্ভার সংযোগ ত্রুটি।');
    } finally {
      setResetSubmitting(false);
    }
  };

  // Handle Toggle Protection
  const handleToggleProtection = async (targetEnabled: boolean) => {
    if (!targetEnabled) {
      // Opening confirmation dialog before turning OFF
      setIsConfirmDisableOpen(true);
      return;
    }

    setToggleSubmitting(true);
    try {
      const res = await dbService.toggleBottomPriceProtection(currentTenant.id, true, currentTenant);
      if (res.success) {
        setProtectionEnabled(true);
        showToast(res.message || 'Bottom Price PIN Protection চালু করা হয়েছে।', 'success');
        await refreshStatus();
        await loadAuditLogs();
      } else {
        showToast(res.message || (res as any).error || 'প্রোটেকশন আপডেট করতে সমস্যা হয়েছে।', 'error');
      }
    } finally {
      setToggleSubmitting(false);
    }
  };

  const handleConfirmDisable = async () => {
    setToggleSubmitting(true);
    try {
      const res = await dbService.toggleBottomPriceProtection(currentTenant.id, false, currentTenant);
      if (res.success) {
        setProtectionEnabled(false);
        setIsConfirmDisableOpen(false);
        showToast('Bottom Price PIN Protection নিষ্ক্রিয় করা হয়েছে।', 'warning');
        await refreshStatus();
        await loadAuditLogs();
      } else {
        showToast(res.message || (res as any).error || 'প্রোটেকশন আপডেট করতে সমস্যা হয়েছে।', 'error');
      }
    } finally {
      setToggleSubmitting(false);
    }
  };

  return (
    <div className="bg-transparent border-0 p-1 sm:p-2 space-y-5 shadow-none">
      {/* Card Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-3 border-b border-slate-200 dark:border-zinc-800">
        <h3 className="text-base font-bold text-slate-900 dark:text-white">
          {pickText('ওনার সিকিউরিটি পিন ও ফ্লোর প্রাইস লক', 'Owner Security PIN & Bottom-Price Policy')}
        </h3>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          {loading ? (
            <span className="text-xs text-slate-400 flex items-center gap-1.5">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              <span>{pickText('লোডিং...', 'Loading...')}</span>
            </span>
          ) : isConfigured ? (
            <span className="px-3 py-1 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 text-xs font-bold flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>{pickText('সিকিউরিটি পিন সচল', 'PIN Configured')}</span>
            </span>
          ) : (
            <span className="px-3 py-1 rounded-xl bg-amber-50 dark:bg-amber-950/60 border border-amber-300 dark:border-amber-800 text-amber-800 dark:text-amber-300 text-xs font-bold flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4 text-amber-600" />
              <span>{pickText('পিন সেট করা হয়নি', 'PIN Not Configured')}</span>
            </span>
          )}

          <button
            type="button"
            onClick={() => {
              void refreshStatus();
              void loadAuditLogs();
            }}
            className="p-1.5 rounded-xl border border-slate-200 dark:border-zinc-700 hover:bg-slate-100 dark:hover:bg-zinc-800 text-slate-600 dark:text-zinc-400 transition cursor-pointer"
            title="Refresh Security Status"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main Grid: PIN Controls & Protection Toggle */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Box 1: Owner PIN Actions */}
        <div className="p-4 rounded-2xl bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 flex flex-col justify-between space-y-4">
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                <KeyRound className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <span>{pickText('মালিকের ৪-ডিজিট সিকিউরিটি পিন', 'Owner 4-Digit Security PIN')}</span>
              </span>
              <span className="text-[10px] text-slate-500 font-mono">
                {isConfigured ? '••••' : 'UNSET'}
              </span>
            </div>
            <p className="text-xs text-slate-600 dark:text-zinc-400 leading-relaxed">
              {isConfigured
                ? pickText(
                    'আপনার দোকানের ৪-ডিজিট পিন নিরাপদভাবে ক্রিপ্টোগ্রাফিক হ্যাশ আকারে সার্ভারে সংরক্ষিত রয়েছে।',
                    'Your shop 4-digit PIN is stored securely using cryptographic hashing.'
                  )
                : pickText(
                    'দোকানের ওনার পিন এখনও সেট করা হয়নি। ফ্লোর প্রাইসের নিচের বিক্রয় সুরক্ষা চালু করতে পিন সেট করুন।',
                    'Owner PIN is not configured yet. Set a PIN to enable floor price discount security.'
                  )}
            </p>
          </div>

          <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-200 dark:border-zinc-850">
            {!isConfigured ? (
              <button
                type="button"
                onClick={() => setIsSetupOpen(true)}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition shadow-xs flex items-center gap-1.5 cursor-pointer"
              >
                <KeyRound className="w-3.5 h-3.5" />
                <span>{pickText('পিন সেট করুন', 'Setup Owner PIN')}</span>
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => {
                    setChangeError('');
                    setIsChangeOpen(true);
                  }}
                  className="px-3.5 py-2 rounded-xl bg-slate-200 dark:bg-zinc-800 hover:bg-slate-300 dark:hover:bg-zinc-750 text-slate-900 dark:text-white text-xs font-semibold transition cursor-pointer flex items-center gap-1.5"
                >
                  <KeyRound className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  <span>{pickText('পরিবর্তন', 'Change PIN')}</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setResetError('');
                    setIsResetOpen(true);
                  }}
                  className="px-3.5 py-2 rounded-xl border border-slate-300 dark:border-zinc-700 hover:bg-slate-100 dark:hover:bg-zinc-800 text-slate-700 dark:text-zinc-300 text-xs font-semibold transition cursor-pointer flex items-center gap-1.5"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>{pickText('রিসেট', 'Reset PIN')}</span>
                </button>
              </>
            )}
          </div>
        </div>

        {/* Box 2: Bottom Price PIN Protection Toggle */}
        <div className="p-4 rounded-2xl bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 flex flex-col justify-between space-y-4">
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                <ShieldAlert className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <span>{pickText('বটম প্রাইস পিন প্রোটেকশন', 'Bottom Price PIN Protection')}</span>
                <InfoTooltip
                  text={pickText(
                    'চালু থাকলে পণ্যের ফ্লোর প্রাইসের নিচে ডিসকাউন্ট দিতে ৪-ডিজিট ওনার পিন প্রয়োজন হবে।',
                    "When ON, cashiers must enter the 4-digit Owner PIN to apply discounts below a product's floor price."
                  )}
                />
              </span>

              {/* Visual Toggle Switch */}
              <button
                type="button"
                disabled={toggleSubmitting}
                onClick={() => handleToggleProtection(!protectionEnabled)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer ${
                  protectionEnabled ? 'bg-emerald-600' : 'bg-slate-300 dark:bg-zinc-700'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    protectionEnabled ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
          </div>

          <div className="pt-2 border-t border-slate-200 dark:border-zinc-850 flex items-center justify-between">
            <span className="text-[11px] text-slate-500">
              {pickText('বর্তমান স্ট্যাটাস:', 'Current Status:')}{' '}
              <strong className={protectionEnabled ? 'text-emerald-600' : 'text-rose-600'}>
                {protectionEnabled
                  ? pickText('সুরক্ষিত (ON)', 'Protected (ON)')
                  : pickText('নিষ্ক্রিয় (OFF)', 'Disabled (OFF)')}
              </strong>
            </span>
            <button
              type="button"
              disabled={toggleSubmitting}
              onClick={() => handleToggleProtection(!protectionEnabled)}
              className="text-xs font-bold underline text-slate-700 dark:text-zinc-300 hover:text-emerald-600 cursor-pointer"
            >
              {protectionEnabled ? pickText('বন্ধ করুন', 'Turn OFF') : pickText('চালু করুন', 'Turn ON')}
            </button>
          </div>
        </div>
      </div>

      {/* Security Audit Log History (Pathao & POS Audit Style) */}
      <div className="pt-2">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
            <History className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            <span>{pickText('নিরাপত্তা ও ডিসকাউন্ট হিস্টোরি', 'Security Audit Log')}</span>
          </h4>
          <span className="text-[11px] text-slate-400">
            {pickText(`সর্বশেষ ${auditLogs.length} টি ইভেন্ট`, `Latest ${auditLogs.length} events`)}
          </span>
        </div>

        <div className="border border-slate-200 dark:border-zinc-800 rounded-2xl overflow-hidden bg-white dark:bg-zinc-950">
          {loadingLogs ? (
            <div className="p-6 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-emerald-600" />
              <span>{pickText('অডিট হিস্টোরি লোড হচ্ছে...', 'Loading audit history...')}</span>
            </div>
          ) : auditLogs.length === 0 ? (
            <div className="p-6 text-center text-xs text-slate-400">
              {pickText('কোনো সিকিউরিটি ইভেন্ট রেকর্ড পাওয়া যায়নি।', 'No security audit events recorded yet.')}
            </div>
          ) : (
            <div className="overflow-x-auto no-scrollbar max-h-60 overflow-y-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 dark:bg-zinc-900/80 border-b border-slate-200 dark:border-zinc-800 text-slate-500 dark:text-zinc-400 font-semibold sticky top-0">
                    <th className="py-2.5 px-3">{pickText('তারিখ/সময়', 'Date/Time')}</th>
                    <th className="py-2.5 px-3">{pickText('অ্যাকশন', 'Action')}</th>
                    <th className="py-2.5 px-3">{pickText('অনুমোদনকারী / রোল', 'Authorizer / Role')}</th>
                    <th className="py-2.5 px-3">{pickText('বিবরণ', 'Details')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-zinc-850 text-slate-800 dark:text-zinc-200">
                  {auditLogs.map((log) => {
                    const dateFormatted = new Date(log.timestamp).toLocaleString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                      hour12: true,
                    });

                    let actionBadge = (
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300">
                        {log.action}
                      </span>
                    );

                    if (log.action === 'pin_setup') {
                      actionBadge = (
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400 border border-emerald-200">
                          {pickText('পিন সেটআপ', 'PIN Setup')}
                        </span>
                      );
                    } else if (log.action === 'pin_change') {
                      actionBadge = (
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-400 border border-blue-200">
                          {pickText('পিন পরিবর্তন', 'PIN Change')}
                        </span>
                      );
                    } else if (log.action === 'pin_reset') {
                      actionBadge = (
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-purple-50 text-purple-700 dark:bg-purple-950 dark:text-purple-400 border border-purple-200">
                          {pickText('পিন রিসেট', 'PIN Reset')}
                        </span>
                      );
                    } else if (log.action === 'override_approved') {
                      actionBadge = (
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400 border border-emerald-200">
                          {pickText('ওভাররাইড অনুমোদিত', 'Override Approved')}
                        </span>
                      );
                    } else if (log.action === 'protection_toggle') {
                      actionBadge = (
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-400 border border-amber-200">
                          {pickText('প্রোটেকশন পরিবর্তন', 'Protection Toggled')}
                        </span>
                      );
                    } else if (log.action === 'below_floor_sale') {
                      actionBadge = (
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-rose-50 text-rose-700 dark:bg-rose-950 dark:text-rose-400 border border-rose-200">
                          {pickText('ফ্লোর প্রাইসের নিচে বিক্রয়', 'Below Floor Sale')}
                        </span>
                      );
                    } else if (log.action === 'pin_attempt_lockout') {
                      actionBadge = (
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-rose-50 text-rose-700 dark:bg-rose-950 dark:text-rose-400 border border-rose-200">
                          {pickText('লকআউট সক্রিয়', 'Lockout Triggered')}
                        </span>
                      );
                    }

                    return (
                      <tr key={log.id} className="hover:bg-slate-50/50 dark:hover:bg-zinc-900/50">
                        <td className="py-2.5 px-3 font-mono text-[11px] text-slate-500 whitespace-nowrap">
                          {dateFormatted}
                        </td>
                        <td className="py-2.5 px-3 whitespace-nowrap">{actionBadge}</td>
                        <td className="py-2.5 px-3 text-[11px] whitespace-nowrap">
                          <span className="font-semibold">{log.actorRole}</span>
                          <span className="text-slate-400 font-mono ml-1 text-[10px]">
                            ({(log.actorUid || '').slice(-6)})
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-[11px] text-slate-600 dark:text-zinc-400">
                          {log.details.productName && (
                            <span className="font-medium text-slate-900 dark:text-white mr-1">
                              {log.details.productName}
                            </span>
                          )}
                          {log.details.attemptedRate !== undefined && (
                            <span className="font-mono text-rose-600 mr-1">
                              ৳{log.details.attemptedRate} (Floor: ৳{log.details.bottomPrice})
                            </span>
                          )}
                          {log.details.note && <span>{log.details.note}</span>}
                          {log.details.newStatus !== undefined && (
                            <span>
                              Protection set to <strong>{log.details.newStatus ? 'ON' : 'OFF'}</strong>
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* MODAL 1: FIRST-TIME PIN SETUP                                            */}
      {/* ========================================================================= */}
      {isSetupOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-3xl max-w-sm w-full p-6 text-slate-900 dark:text-zinc-100 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-zinc-800">
              <h3 className="text-sm font-bold flex items-center gap-2">
                <KeyRound className="w-4 h-4 text-emerald-600" />
                <span>{pickText('ওনার সিকিউরিটি পিন সেট করুন', 'Setup Owner Security PIN')}</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsSetupOpen(false)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-500 dark:text-zinc-400">
              {pickText(
                'কাউন্টার বিলিংয়ে ফ্লোর প্রাইসের নিচের ডিসকাউন্ট অনুমোদনের জন্য আপনার ৪-সংখ্যার ব্যক্তিগত পিন তৈরি করুন।',
                'Create your 4-digit personal PIN to authorize discounts below floor price at the POS counter.'
              )}
            </p>

            <form onSubmit={handleSetupSubmit} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold mb-1">
                  {pickText('৪-ডিজিট সিকিউরিটি পিন *', '4-Digit Security PIN *')}
                </label>
                <input
                  type="password"
                  inputMode="numeric"
                  maxLength={4}
                  required
                  autoFocus
                  value={setupPin}
                  onChange={(e) => {
                    setSetupPin(e.target.value.replace(/[^0-9]/g, ''));
                    setSetupError('');
                  }}
                  placeholder="••••"
                  className="w-full bg-slate-50 dark:bg-zinc-950 border border-slate-300 dark:border-zinc-750 rounded-xl px-3 py-2 text-center text-lg font-mono tracking-widest focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block font-semibold mb-1">
                  {pickText('পিন কনফার্ম করুন *', 'Confirm PIN *')}
                </label>
                <input
                  type="password"
                  inputMode="numeric"
                  maxLength={4}
                  required
                  value={setupConfirm}
                  onChange={(e) => {
                    setSetupConfirm(e.target.value.replace(/[^0-9]/g, ''));
                    setSetupError('');
                  }}
                  placeholder="••••"
                  className="w-full bg-slate-50 dark:bg-zinc-950 border border-slate-300 dark:border-zinc-750 rounded-xl px-3 py-2 text-center text-lg font-mono tracking-widest focus:outline-none focus:border-emerald-500"
                />
              </div>

              {setupError && (
                <p className="text-[11px] text-rose-500 font-medium text-center">{setupError}</p>
              )}

              <div className="pt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => setIsSetupOpen(false)}
                  disabled={setupSubmitting}
                  className="flex-1 py-2.5 rounded-xl border border-slate-300 dark:border-zinc-700 font-semibold cursor-pointer"
                >
                  {pickText('বাতিল', 'Cancel')}
                </button>
                <button
                  type="submit"
                  disabled={setupSubmitting || setupPin.length < 4 || setupConfirm.length < 4}
                  className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold cursor-pointer flex items-center justify-center gap-1.5 shadow-xs"
                >
                  {setupSubmitting ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <span>{pickText('পিন সংরক্ষণ করুন', 'Save PIN')}</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: CHANGE PIN                                                      */}
      {/* ========================================================================= */}
      {isChangeOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-3xl max-w-sm w-full p-6 text-slate-900 dark:text-zinc-100 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-zinc-800">
              <h3 className="text-sm font-bold flex items-center gap-2">
                <KeyRound className="w-4 h-4 text-emerald-600" />
                <span>{pickText('ওনার পিন পরিবর্তন করুন', 'Change Owner PIN')}</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsChangeOpen(false)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleChangeSubmit} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold mb-1">
                  {pickText('বর্তমান পিন *', 'Current PIN *')}
                </label>
                <input
                  type="password"
                  inputMode="numeric"
                  maxLength={4}
                  required
                  autoFocus
                  disabled={isLockedOut}
                  value={currentPin}
                  onChange={(e) => {
                    setCurrentPin(e.target.value.replace(/[^0-9]/g, ''));
                    setChangeError('');
                  }}
                  placeholder="••••"
                  className="w-full bg-slate-50 dark:bg-zinc-950 border border-slate-300 dark:border-zinc-750 rounded-xl px-3 py-2 text-center text-lg font-mono tracking-widest focus:outline-none focus:border-emerald-500 disabled:opacity-50"
                />
              </div>

              <div>
                <label className="block font-semibold mb-1">
                  {pickText('নতুন পিন *', 'New PIN *')}
                </label>
                <input
                  type="password"
                  inputMode="numeric"
                  maxLength={4}
                  required
                  disabled={isLockedOut}
                  value={newPin}
                  onChange={(e) => {
                    setNewPin(e.target.value.replace(/[^0-9]/g, ''));
                    setChangeError('');
                  }}
                  placeholder="••••"
                  className="w-full bg-slate-50 dark:bg-zinc-950 border border-slate-300 dark:border-zinc-750 rounded-xl px-3 py-2 text-center text-lg font-mono tracking-widest focus:outline-none focus:border-emerald-500 disabled:opacity-50"
                />
              </div>

              <div>
                <label className="block font-semibold mb-1">
                  {pickText('নতুন পিন নিশ্চিত করুন *', 'Confirm New PIN *')}
                </label>
                <input
                  type="password"
                  inputMode="numeric"
                  maxLength={4}
                  required
                  disabled={isLockedOut}
                  value={newConfirm}
                  onChange={(e) => {
                    setNewConfirm(e.target.value.replace(/[^0-9]/g, ''));
                    setChangeError('');
                  }}
                  placeholder="••••"
                  className="w-full bg-slate-50 dark:bg-zinc-950 border border-slate-300 dark:border-zinc-750 rounded-xl px-3 py-2 text-center text-lg font-mono tracking-widest focus:outline-none focus:border-emerald-500 disabled:opacity-50"
                />
              </div>

              {changeError && (
                <p className="text-[11px] text-rose-500 font-medium text-center">{changeError}</p>
              )}

              {isLockedOut && (
                <p className="text-[11px] text-amber-500 font-bold text-center">
                  {pickText(
                    `লকআউট সক্রিয়: ${remainingLockSeconds}s পর পুনরায় চেষ্টা করুন।`,
                    `Lockout active: Try again in ${remainingLockSeconds}s.`
                  )}
                </p>
              )}

              <div className="pt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => setIsChangeOpen(false)}
                  disabled={changeSubmitting}
                  className="flex-1 py-2.5 rounded-xl border border-slate-300 dark:border-zinc-700 font-semibold cursor-pointer"
                >
                  {pickText('বাতিল', 'Cancel')}
                </button>
                <button
                  type="submit"
                  disabled={isLockedOut || changeSubmitting || currentPin.length < 4 || newPin.length < 4}
                  className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold cursor-pointer flex items-center justify-center gap-1.5 shadow-xs"
                >
                  {changeSubmitting ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <span>{pickText('পরিবর্তন করুন', 'Update PIN')}</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 3: FORGOT / RESET PIN VIA IDENTITY VERIFICATION                     */}
      {/* ========================================================================= */}
      {isResetOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-3xl max-w-sm w-full p-6 text-slate-900 dark:text-zinc-100 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-zinc-800">
              <h3 className="text-sm font-bold flex items-center gap-2">
                <RefreshCw className="w-4 h-4 text-emerald-600" />
                <span>{pickText('মালিকের পিন রিসেট', 'Reset Owner PIN')}</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsResetOpen(false)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-500 dark:text-zinc-400">
              {pickText(
                'পুরোনো পিন ভুলে গিয়ে থাকলে একাউন্টের পাসওয়ার্ড দিয়ে যাচাই সম্পন্ন করে নতুন ৪-ডিজিট পিন নির্ধারণ করুন।',
                'If you forgot your PIN, verify with your account password and set a new 4-digit PIN.'
              )}
            </p>

            <form onSubmit={handleResetSubmit} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold mb-1">
                  {pickText('একাউন্টের লগইন পাসওয়ার্ড *', 'Account Login Password *')}
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    autoFocus
                    value={ownerPassword}
                    onChange={(e) => {
                      setOwnerPassword(e.target.value);
                      setResetError('');
                    }}
                    placeholder={pickText('পাসওয়ার্ড লিখুন', 'Enter password')}
                    className="w-full bg-slate-50 dark:bg-zinc-950 border border-slate-300 dark:border-zinc-750 rounded-xl px-3 py-2 pr-9 focus:outline-none focus:border-emerald-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block font-semibold mb-1">
                  {pickText('নতুন ৪-ডিজিট পিন *', 'New 4-Digit PIN *')}
                </label>
                <input
                  type="password"
                  inputMode="numeric"
                  maxLength={4}
                  required
                  value={resetNewPin}
                  onChange={(e) => {
                    setResetNewPin(e.target.value.replace(/[^0-9]/g, ''));
                    setResetError('');
                  }}
                  placeholder="••••"
                  className="w-full bg-slate-50 dark:bg-zinc-950 border border-slate-300 dark:border-zinc-750 rounded-xl px-3 py-2 text-center text-lg font-mono tracking-widest focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block font-semibold mb-1">
                  {pickText('নতুন পিন কনফার্ম করুন *', 'Confirm New PIN *')}
                </label>
                <input
                  type="password"
                  inputMode="numeric"
                  maxLength={4}
                  required
                  value={resetConfirmPin}
                  onChange={(e) => {
                    setResetConfirmPin(e.target.value.replace(/[^0-9]/g, ''));
                    setResetError('');
                  }}
                  placeholder="••••"
                  className="w-full bg-slate-50 dark:bg-zinc-950 border border-slate-300 dark:border-zinc-750 rounded-xl px-3 py-2 text-center text-lg font-mono tracking-widest focus:outline-none focus:border-emerald-500"
                />
              </div>

              {resetError && (
                <p className="text-[11px] text-rose-500 font-medium text-center">{resetError}</p>
              )}

              <div className="pt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => setIsResetOpen(false)}
                  disabled={resetSubmitting}
                  className="flex-1 py-2.5 rounded-xl border border-slate-300 dark:border-zinc-700 font-semibold cursor-pointer"
                >
                  {pickText('বাতিল', 'Cancel')}
                </button>
                <button
                  type="submit"
                  disabled={resetSubmitting || resetNewPin.length < 4 || resetConfirmPin.length < 4}
                  className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold cursor-pointer flex items-center justify-center gap-1.5 shadow-xs"
                >
                  {resetSubmitting ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <span>{pickText('পিন রিসেট করুন', 'Reset PIN')}</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 4: CONFIRM DISABLE BOTTOM-PRICE PROTECTION                          */}
      {/* ========================================================================= */}
      {isConfirmDisableOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white dark:bg-zinc-900 border border-rose-300 dark:border-rose-900/60 rounded-3xl max-w-sm w-full p-6 text-slate-900 dark:text-zinc-100 shadow-2xl space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-500 mx-auto">
              <ShieldAlert className="w-6 h-6 animate-pulse" />
            </div>

            <h3 className="text-sm font-bold text-center text-slate-900 dark:text-white">
              {pickText('বটম প্রাইস প্রোটেকশন বন্ধ করতে চান?', 'Disable Bottom Price Protection?')}
            </h3>

            <div className="bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/40 rounded-xl p-3 text-xs text-rose-900 dark:text-rose-200 space-y-1.5 leading-relaxed">
              <p>
                {pickText(
                  'সতর্কতা: এটি বন্ধ করলে যেকোনো বিক্রয়কর্মী বা ক্যাশিয়ার Owner PIN ইনপুট ছাড়াই আপনার নির্ধারিত সর্বনিম্ন ক্রয়মূল্য বা বটম প্রাইসের চেয়ে কম মূল্যে মেমো বা বিক্রি সম্পন্ন করতে পারবে।',
                  'Warning: Disabling this allows cashiers or sales staff to complete sales below floor price without entering the Owner PIN.'
                )}
              </p>
              <p className="text-[11px] text-slate-500 dark:text-zinc-400">
                {pickText(
                  '(অনুমোদনহীন সকল বিক্রয় অডিট লগে রেকর্ড রাখা হবে এবং পূর্বের সকল সেশন বাতিল করা হবে।)',
                  '(All below-floor sales will still be recorded in the audit log.)'
                )}
              </p>
            </div>

            <div className="pt-2 flex gap-2 text-xs">
              <button
                type="button"
                onClick={() => setIsConfirmDisableOpen(false)}
                disabled={toggleSubmitting}
                className="flex-1 py-2.5 rounded-xl border border-slate-300 dark:border-zinc-700 font-semibold cursor-pointer"
              >
                {pickText('না, চালু রাখুন', 'No, Keep Active')}
              </button>
              <button
                type="button"
                onClick={handleConfirmDisable}
                disabled={toggleSubmitting}
                className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white font-bold cursor-pointer flex items-center justify-center gap-1.5 shadow-xs"
              >
                {toggleSubmitting ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <span>{pickText('হ্যাঁ, বন্ধ করুন', 'Yes, Disable')}</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
