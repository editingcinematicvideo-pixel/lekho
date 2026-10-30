import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { ZReport, DrawerType } from '../../types';
import { dbService } from '../../services/db';
import {
  FileSpreadsheet,
  CheckCircle,
  AlertCircle,
  Lock,
  DollarSign,
  TrendingDown,
  TrendingUp,
  X,
  Printer,
  PlusCircle,
  MessageSquare,
  Wallet,
  Building2,
  Users,
  Calendar,
  AlertTriangle,
} from 'lucide-react';

interface ZReportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ZReportModal: React.FC<ZReportModalProps> = ({ isOpen, onClose }) => {
  const { currentTenant, activeStaff, lockRegister, showToast } = useApp();

  // Manual physical counts entered by owner/cashier
  const [countedCash, setCountedCash] = useState<number>(0);
  const [countedBkashPersonal, setCountedBkashPersonal] = useState<number>(0);
  const [countedBkashMerchant, setCountedBkashMerchant] = useState<number>(0);
  const [countedNagad, setCountedNagad] = useState<number>(0);
  const [countedBank, setCountedBank] = useState<number>(0);

  // Active entry boxes toggled
  const [enabledWallets, setEnabledWallets] = useState<Record<string, boolean>>({
    cash: true,
    personalBkash: true,
    merchantBkash: false,
    nagad: false,
    bank: false,
  });

  const [notes, setNotes] = useState('End of day evening shift closing & audit');
  const [submittedReport, setSubmittedReport] = useState<ZReport | null>(null);

  if (!isOpen) return null;

  const invoices = dbService.getInvoices(currentTenant.id);
  const expenses = dbService.getExpenses(currentTenant.id);
  const drawers = dbService.getShopDrawers(currentTenant.id);

  // Calculate today's metrics
  const todayStr = new Date().toISOString().split('T')[0];
  const todayInvoices = invoices.filter(
    (inv) => inv.createdAt.startsWith(todayStr) && !inv.isSoftDeleted
  );
  const todayExpenses = expenses.filter((exp) => exp.date === todayStr);

  // 1. Sales breakdown: Retail vs Reseller
  const retailInvoices = todayInvoices.filter((inv) => inv.partyType !== 'Reseller');
  const resellerInvoices = todayInvoices.filter((inv) => inv.partyType === 'Reseller');

  const totalSalesVolume = todayInvoices.reduce((a, b) => a + b.total, 0);
  const retailSalesVolume = retailInvoices.reduce((a, b) => a + b.total, 0);
  const resellerSalesVolume = resellerInvoices.reduce((a, b) => a + b.total, 0);

  // 2. Incoming money by wallet calculated from POS transactions
  let expectedCash = 0;
  let expectedBkashPersonal = 0;
  let expectedBkashMerchant = 0;
  let expectedNagad = 0;
  let expectedBank = 0;

  todayInvoices.forEach((inv) => {
    const received = inv.advancePaid || inv.total;
    const pChannel = inv.paymentChannel as string;
    if (pChannel === 'split' && inv.splitBreakdown) {
      expectedCash += Number(inv.splitBreakdown.cash) || 0;
      expectedBkashMerchant += Number(inv.splitBreakdown.merchantBkash) || 0;
      expectedBkashPersonal += Number(inv.splitBreakdown.personalBkash) || 0;
      expectedNagad += Number(inv.splitBreakdown.nagad) || 0;
      expectedBank += Number(inv.splitBreakdown.bank) || 0;
    } else if (pChannel === 'split' && inv.splitDetails) {
      expectedCash += inv.splitDetails.cashAmount || 0;
      if (inv.splitDetails.digitalChannel === 'bkash') {
        expectedBkashPersonal += inv.splitDetails.digitalAmount || 0;
      } else if (inv.splitDetails.digitalChannel === 'nagad') {
        expectedNagad += inv.splitDetails.digitalAmount || 0;
      } else if (inv.splitDetails.digitalChannel === 'bank') {
        expectedBank += inv.splitDetails.digitalAmount || 0;
      }
    } else if (pChannel === 'cash') {
      expectedCash += received;
    } else if (pChannel === 'personalBkash') {
      expectedBkashPersonal += received;
    } else if (pChannel === 'bkash' || pChannel === 'merchantBkash') {
      expectedBkashMerchant += received;
    } else if (pChannel === 'nagad') {
      expectedNagad += received;
    } else if (pChannel === 'bank') {
      expectedBank += received;
    }
  });

  // Factor in today's expenses paid from drawers
  const todayCashExpense = todayExpenses
    .filter((e) => e.paymentDrawer === 'cash')
    .reduce((s, e) => s + e.amount, 0);
  const todayDigitalExpense = todayExpenses
    .filter((e) => e.paymentDrawer !== 'cash')
    .reduce((s, e) => s + e.amount, 0);

  // Net expected in drawers for shift
  const netExpectedCash = Math.max(0, expectedCash - todayCashExpense);

  // Calculate discrepancies
  const cashDiscrepancy = countedCash - netExpectedCash;
  const bkashPDiscrepancy = countedBkashPersonal - expectedBkashPersonal;
  const bkashMDiscrepancy = countedBkashMerchant - expectedBkashMerchant;
  const nagadDiscrepancy = countedNagad - expectedNagad;
  const bankDiscrepancy = countedBank - expectedBank;

  const totalDiscrepancy =
    (enabledWallets.cash ? cashDiscrepancy : 0) +
    (enabledWallets.personalBkash ? bkashPDiscrepancy : 0) +
    (enabledWallets.merchantBkash ? bkashMDiscrepancy : 0) +
    (enabledWallets.nagad ? nagadDiscrepancy : 0) +
    (enabledWallets.bank ? bankDiscrepancy : 0);

  const handleSubmitZReport = (e: React.FormEvent) => {
    e.preventDefault();

    const report: ZReport = {
      id: `zrep_${Date.now()}`,
      shopId: currentTenant.id,
      date: todayStr,
      salesmanId: activeStaff ? activeStaff.id : 'owner',
      salesmanName: activeStaff ? activeStaff.name : currentTenant.ownerName,
      expectedCash: netExpectedCash,
      countedCash,
      discrepancy: totalDiscrepancy,
      totalSalesVolume,
      totalTransactionsCount: todayInvoices.length,
      totalDigitalVolume: expectedBkashPersonal + expectedBkashMerchant + expectedNagad + expectedBank,
      totalExpensesPaid: todayCashExpense + todayDigitalExpense,
      notes,
      submittedAt: new Date().toISOString(),
    };

    dbService.addZReport(currentTenant.id, report);
    setSubmittedReport(report);
    showToast(`দৈনিক ক্লোজিং রিপোর্ট সফলভাবে সেভ হয়েছে!`, 'success');
  };

  const handleFinishAndLock = () => {
    onClose();
    lockRegister();
  };

  // WhatsApp Report Generator
  const handleSendReportWhatsApp = () => {
    const operator = activeStaff ? activeStaff.name : currentTenant.ownerName;
    const dateFormatted = new Date().toLocaleDateString('en-GB');

    const formatDiff = (diff: number) => {
      if (diff === 0) return '✅ Exact Match (মিলেছে)';
      if (diff < 0) return `⚠️ শর্টেজ (-৳${Math.abs(diff).toLocaleString()})`;
      return `💡 সারপ্লাস (+৳${diff.toLocaleString()})`;
    };

    const text = `📊 *【${currentTenant.name} - দৈনিক শিফট ক্লোজিং ও হিসাব রিপোর্ট】*
তারিখ: ${dateFormatted}
শিফট অপারেটর: *${operator}*
দোকান: ${currentTenant.marketMallName}
------------------------------------------
💰 *বিক্রি ও লেনদেন সারসংক্ষেপ:*
মোট বিক্রয় (Gross Sales): *৳${totalSalesVolume.toLocaleString()}*
• সাধারণ রিটেইল বিক্রয়: ৳${retailSalesVolume.toLocaleString()} (${retailInvoices.length} টি)
• পাইকারি / রিসেলার বিক্রয়: ৳${resellerSalesVolume.toLocaleString()} (${resellerInvoices.length} টি)
মোট ইনভয়েস সংখ্যা: ${todayInvoices.length} টি
আজকের মোট খরচ: ৳${(todayCashExpense + todayDigitalExpense).toLocaleString()}

------------------------------------------
🏦 *ওয়ালেট অডিট ও হিসাব মিলানো (System vs Physical):*

• ক্যাশ (Cash Drawer):
  - ইনভেন্টরি হিসাব: ৳${netExpectedCash.toLocaleString()}
  - ক্যাশ ড্রয়ার গুনে পাওয়া: ৳${countedCash.toLocaleString()}
  - মিল/অমিল: *${formatDiff(cashDiscrepancy)}*

• বিকাশ পার্সোনাল:
  - ইনভেন্টরি হিসাব: ৳${expectedBkashPersonal.toLocaleString()}
  - ফোনে গুনে পাওয়া: ৳${countedBkashPersonal.toLocaleString()}
  - মিল/অমিল: *${formatDiff(bkashPDiscrepancy)}*
${
  enabledWallets.merchantBkash
    ? `
• বিকাশ মার্চেন্ট:
  - ইনভেন্টরি: ৳${expectedBkashMerchant.toLocaleString()} | ফোনে: ৳${countedBkashMerchant.toLocaleString()}
  - মিল/অমিল: *${formatDiff(bkashMDiscrepancy)}*`
    : ''
}
${
  enabledWallets.nagad
    ? `
• নগদ (Nagad):
  - ইনভেন্টরি: ৳${expectedNagad.toLocaleString()} | ফোনে: ৳${countedNagad.toLocaleString()}
  - মিল/অমিল: *${formatDiff(nagadDiscrepancy)}*`
    : ''
}
------------------------------------------
*সর্বমোট অমিল (Net Discrepancy):* ${formatDiff(totalDiscrepancy)}
শিফট মন্তব্য: ${notes}
------------------------------------------
LEKHO POS Smart Audit System`;

    const cleanPhone = currentTenant.ownerPhone.replace(/\D/g, '');
    const intlPhone = cleanPhone.startsWith('88') ? cleanPhone : `88${cleanPhone}`;
    window.open(`https://wa.me/${intlPhone}?text=${encodeURIComponent(text)}`, '_blank');
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 dark:bg-black/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-150">
      <div className="bg-white dark:bg-zinc-900 border border-slate-200/90 dark:border-zinc-800 rounded-2xl sm:rounded-3xl max-w-xl w-full max-h-[90dvh] flex flex-col overflow-hidden p-4 sm:p-5 text-slate-900 dark:text-zinc-100 shadow-2xl relative">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-zinc-800 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="p-2 rounded-2xl bg-[#e6f4ea] dark:bg-emerald-950/60 text-[#1f8a5b] dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 shrink-0">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h3 className="lekho-modal-title text-slate-900 dark:text-white truncate">
                দৈনিক ক্লোজিং ও ক্যাশ অডিট (Daily Closing)
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-zinc-400 truncate">
                আজকের সেলস, রিসেলার হিসাব ও ক্যাশ/বিকাশ/নগদ মিলিয়ে ক্লোজ করুন
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-zinc-800 cursor-pointer shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 pr-0.5 pt-3">
        {submittedReport ? (
          /* =================================================================== */
          /* SUCCESS VIEW: CLOSING SLIP & WHATSAPP ACTION                        */
          /* =================================================================== */
          <div className="space-y-4">
            <div className="bg-[#e6f4ea] dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 p-4 rounded-2xl text-center space-y-1">
              <CheckCircle className="w-8 h-8 text-[#1f8a5b] dark:text-emerald-400 mx-auto" />
              <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                দৈনিক শিফট সফলভাবে ক্লোজ হয়েছে!
              </h4>
              <p className="text-xs text-slate-600 dark:text-zinc-400">
                অফিসিয়াল দৈনিক রিপোর্ট রেজিস্টারে রেকর্ড করা হয়েছে।
              </p>
            </div>

            {/* Generated Official Slip */}
            <div
              id="printable-z-report"
              className="bg-[#f4f7f5] dark:bg-zinc-950 p-4 rounded-2xl border border-slate-200/80 dark:border-zinc-800 font-mono text-xs space-y-2"
            >
              <div className="flex justify-between border-b border-slate-200 dark:border-zinc-800 pb-1.5 font-bold text-slate-900 dark:text-white">
                <span>দোকান: {currentTenant.name}</span>
                <span>{todayStr}</span>
              </div>

              <div className="flex justify-between text-slate-500 dark:text-zinc-400 text-[11px]">
                <span>শিফট অপারেটর:</span>
                <span className="text-slate-800 dark:text-zinc-200 font-bold">
                  {submittedReport.salesmanName}
                </span>
              </div>

              <div className="flex justify-between text-slate-700 dark:text-zinc-300">
                <span>মোট সেলস ভলিউম:</span>
                <span className="font-bold text-[#1f8a5b] dark:text-emerald-400">
                  ৳{totalSalesVolume.toLocaleString()}
                </span>
              </div>

              <div className="flex justify-between text-slate-500 dark:text-zinc-400 text-[11px]">
                <span>• রিটেইল সেলস:</span>
                <span>৳{retailSalesVolume.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-slate-500 dark:text-zinc-400 text-[11px]">
                <span>• রিসেলার/হোলসেল:</span>
                <span>৳{resellerSalesVolume.toLocaleString()}</span>
              </div>

              <div className="border-t border-slate-200 dark:border-zinc-800 pt-1.5 flex justify-between">
                <span>সর্বমোট অমিল (Discrepancy):</span>
                <span
                  className={`font-bold ${
                    submittedReport.discrepancy === 0
                      ? 'text-[#1f8a5b] dark:text-emerald-400'
                      : submittedReport.discrepancy < 0
                      ? 'text-rose-600 dark:text-rose-400'
                      : 'text-amber-600 dark:text-amber-400'
                  }`}
                >
                  {submittedReport.discrepancy === 0
                    ? '✅ হিসাব হুবহু মিলেছে'
                    : submittedReport.discrepancy < 0
                    ? `-৳${Math.abs(submittedReport.discrepancy).toLocaleString()} কম`
                    : `+৳${submittedReport.discrepancy.toLocaleString()} বেশি`}
                </span>
              </div>
            </div>

            {/* Actions: Print, Send WhatsApp & Lock */}
            <div className="flex flex-col gap-2 pt-2">
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="flex items-center justify-center gap-2 py-3 rounded-2xl bg-[#f4f7f5] hover:bg-slate-200/70 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-800 dark:text-zinc-100 border border-slate-200/80 dark:border-zinc-700 font-bold text-xs transition cursor-pointer"
                >
                  <Printer className="w-4 h-4" />
                  <span>Print Z-Report</span>
                </button>
                <button
                  type="button"
                  onClick={handleSendReportWhatsApp}
                  className="flex items-center justify-center gap-2 py-3 rounded-2xl bg-[#164e3f] hover:bg-[#123e32] text-white font-bold text-xs transition cursor-pointer shadow-xs"
                >
                  <MessageSquare className="w-4 h-4" />
                  <span>Send WhatsApp</span>
                </button>
              </div>

              <button
                onClick={handleFinishAndLock}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-2xl bg-white hover:bg-slate-100 dark:bg-zinc-800 dark:hover:bg-zinc-750 text-slate-700 dark:text-zinc-300 font-semibold text-xs transition cursor-pointer border border-slate-200 dark:border-zinc-700"
              >
                <Lock className="w-4 h-4 text-amber-500" />
                <span>কাউন্টার রেজিস্টার লক করে শিফট শেষ করুন</span>
              </button>
            </div>
          </div>
        ) : (
          /* =================================================================== */
          /* FORM VIEW: BREAKDOWN & WALLET COUNTING ENTRY                        */
          /* =================================================================== */
          <form onSubmit={handleSubmitZReport} className="space-y-4">
            {/* Today's Sales Overview Cards */}
            <div className="grid grid-cols-3 gap-2.5 text-center text-xs">
              <div className="p-2.5 rounded-2xl bg-[#f4f7f5] dark:bg-zinc-950 border border-slate-200/80 dark:border-zinc-800">
                <span className="text-[10px] text-slate-500 dark:text-zinc-400 block">
                  মোট আজকের সেলস
                </span>
                <strong className="text-sm font-bold text-[#1f8a5b] dark:text-emerald-400 font-mono">
                  ৳{totalSalesVolume.toLocaleString()}
                </strong>
                <span className="text-[9px] text-slate-400 dark:text-zinc-500 block">
                  {todayInvoices.length} টি ইনভয়েস
                </span>
              </div>

              <div className="p-2.5 rounded-2xl bg-[#f4f7f5] dark:bg-zinc-950 border border-slate-200/80 dark:border-zinc-800">
                <span className="text-[10px] text-slate-500 dark:text-zinc-400 block">
                  রিটেইল সেলস
                </span>
                <strong className="text-sm font-bold text-slate-900 dark:text-white font-mono">
                  ৳{retailSalesVolume.toLocaleString()}
                </strong>
                <span className="text-[9px] text-slate-400 dark:text-zinc-500 block">
                  {retailInvoices.length} টি
                </span>
              </div>

              <div className="p-2.5 rounded-2xl bg-[#e6f4ea]/60 dark:bg-emerald-950/30 border border-emerald-200/80 dark:border-emerald-800/60">
                <span className="text-[10px] text-[#164e3f] dark:text-emerald-300 font-semibold block">
                  রিসেলার/হোলসেল
                </span>
                <strong className="text-sm font-bold text-[#164e3f] dark:text-emerald-300 font-mono">
                  ৳{resellerSalesVolume.toLocaleString()}
                </strong>
                <span className="text-[9px] text-slate-500 dark:text-zinc-400 block">
                  {resellerInvoices.length} টি
                </span>
              </div>
            </div>

            {/* Quick Add Wallet Buttons */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <label className="font-bold text-slate-800 dark:text-zinc-200">
                  দোকানের ওয়ালেট সিলেক্ট করুন (যেগুলো আজ চেক করবেন):
                </label>
              </div>

              <div className="flex flex-wrap gap-1.5">
                {[
                  { id: 'cash', label: '+ Cash' },
                  { id: 'personalBkash', label: '+ bKash Personal' },
                  { id: 'merchantBkash', label: '+ bKash Merchant' },
                  { id: 'nagad', label: '+ Nagad' },
                  { id: 'bank', label: '+ Bank' },
                ].map((w) => (
                  <button
                    key={w.id}
                    type="button"
                    onClick={() =>
                      setEnabledWallets((prev) => ({
                        ...prev,
                        [w.id]: !prev[w.id],
                      }))
                    }
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition cursor-pointer ${
                      enabledWallets[w.id]
                        ? 'bg-[#164e3f] border-[#164e3f] text-white'
                        : 'bg-[#f4f7f5] dark:bg-zinc-800 border-slate-200/80 dark:border-zinc-700 text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    {w.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Comparison & Physical Count Entries */}
            <div className="space-y-2.5 bg-[#f4f7f5] dark:bg-zinc-950 p-3.5 rounded-2xl border border-slate-200/80 dark:border-zinc-800">
              <div className="text-[11px] font-bold text-slate-500 dark:text-zinc-400 border-b border-slate-200/80 dark:border-zinc-800 pb-1.5 flex justify-between">
                <span>ওয়ালেট ও ইনভেন্টরি হিসাব</span>
                <span>দোকানে গুনে পাওয়া টাকা (Physical Count)</span>
              </div>

              {/* 1. Cash Drawer */}
              {enabledWallets.cash && (
                <div className="flex items-center justify-between gap-3 text-xs">
                  <div>
                    <strong className="text-slate-900 dark:text-white block">
                      ক্যাশ ড্রয়ার (Cash)
                    </strong>
                    <span className="text-[10px] text-slate-500 dark:text-zinc-400">
                      ইনভেন্টরি হিসাব: ৳{netExpectedCash.toLocaleString()}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      value={countedCash || ''}
                      onChange={(e) => setCountedCash(Number(e.target.value))}
                      placeholder="ক্যাশ গুনে লিখুন"
                      className="w-32 bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-700 rounded-xl px-2.5 py-1.5 text-xs text-right font-mono font-bold text-slate-900 dark:text-white focus:outline-none focus:border-[#164e3f]"
                    />
                    <span
                      className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded ${
                        cashDiscrepancy === 0
                          ? 'bg-[#e6f4ea] text-[#1f8a5b] dark:bg-emerald-950 dark:text-emerald-400'
                          : cashDiscrepancy < 0
                          ? 'bg-rose-50 text-rose-600 dark:bg-rose-950 dark:text-rose-400'
                          : 'bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-400'
                      }`}
                    >
                      {cashDiscrepancy === 0
                        ? 'মিল'
                        : cashDiscrepancy < 0
                        ? `-৳${Math.abs(cashDiscrepancy)}`
                        : `+৳${cashDiscrepancy}`}
                    </span>
                  </div>
                </div>
              )}

              {/* 2. bKash Personal */}
              {enabledWallets.personalBkash && (
                <div className="flex items-center justify-between gap-3 text-xs border-t border-slate-200/70 dark:border-zinc-850 pt-2">
                  <div>
                    <strong className="text-pink-600 dark:text-pink-400 block">
                      বিকাশ পার্সোনাল
                    </strong>
                    <span className="text-[10px] text-slate-500 dark:text-zinc-400">
                      ইনভেন্টরি হিসাব: ৳{expectedBkashPersonal.toLocaleString()}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      value={countedBkashPersonal || ''}
                      onChange={(e) => setCountedBkashPersonal(Number(e.target.value))}
                      placeholder="ফোনে পাওয়া টাকা"
                      className="w-32 bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-700 rounded-xl px-2.5 py-1.5 text-xs text-right font-mono font-bold text-slate-900 dark:text-white focus:outline-none focus:border-pink-500"
                    />
                    <span
                      className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded ${
                        bkashPDiscrepancy === 0
                          ? 'bg-[#e6f4ea] text-[#1f8a5b] dark:bg-emerald-950 dark:text-emerald-400'
                          : bkashPDiscrepancy < 0
                          ? 'bg-rose-50 text-rose-600 dark:bg-rose-950 dark:text-rose-400'
                          : 'bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-400'
                      }`}
                    >
                      {bkashPDiscrepancy === 0
                        ? 'মিল'
                        : bkashPDiscrepancy < 0
                        ? `-৳${Math.abs(bkashPDiscrepancy)}`
                        : `+৳${bkashPDiscrepancy}`}
                    </span>
                  </div>
                </div>
              )}

              {/* 3. bKash Merchant */}
              {enabledWallets.merchantBkash && (
                <div className="flex items-center justify-between gap-3 text-xs border-t border-slate-200/70 dark:border-zinc-850 pt-2">
                  <div>
                    <strong className="text-pink-600 dark:text-pink-300 block">
                      বিকাশ মার্চেন্ট
                    </strong>
                    <span className="text-[10px] text-slate-500 dark:text-zinc-400">
                      ইনভেন্টরি হিসাব: ৳{expectedBkashMerchant.toLocaleString()}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      value={countedBkashMerchant || ''}
                      onChange={(e) => setCountedBkashMerchant(Number(e.target.value))}
                      placeholder="মার্চেন্টে ইন টাকা"
                      className="w-32 bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-700 rounded-xl px-2.5 py-1.5 text-xs text-right font-mono font-bold text-slate-900 dark:text-white focus:outline-none focus:border-pink-500"
                    />
                    <span
                      className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded ${
                        bkashMDiscrepancy === 0
                          ? 'bg-[#e6f4ea] text-[#1f8a5b] dark:bg-emerald-950 dark:text-emerald-400'
                          : 'bg-rose-50 text-rose-600 dark:bg-rose-950 dark:text-rose-400'
                      }`}
                    >
                      {bkashMDiscrepancy === 0 ? 'মিল' : `৳${bkashMDiscrepancy}`}
                    </span>
                  </div>
                </div>
              )}

              {/* 4. Nagad */}
              {enabledWallets.nagad && (
                <div className="flex items-center justify-between gap-3 text-xs border-t border-slate-200/70 dark:border-zinc-850 pt-2">
                  <div>
                    <strong className="text-orange-600 dark:text-orange-400 block">
                      নগদ (Nagad)
                    </strong>
                    <span className="text-[10px] text-slate-500 dark:text-zinc-400">
                      ইনভেন্টরি হিসাব: ৳{expectedNagad.toLocaleString()}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      value={countedNagad || ''}
                      onChange={(e) => setCountedNagad(Number(e.target.value))}
                      placeholder="নগদে পাওয়া টাকা"
                      className="w-32 bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-700 rounded-xl px-2.5 py-1.5 text-xs text-right font-mono font-bold text-slate-900 dark:text-white focus:outline-none focus:border-orange-500"
                    />
                    <span
                      className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded ${
                        nagadDiscrepancy === 0
                          ? 'bg-[#e6f4ea] text-[#1f8a5b] dark:bg-emerald-950 dark:text-emerald-400'
                          : 'bg-rose-50 text-rose-600 dark:bg-rose-950 dark:text-rose-400'
                      }`}
                    >
                      {nagadDiscrepancy === 0 ? 'মিল' : `৳${nagadDiscrepancy}`}
                    </span>
                  </div>
                </div>
              )}

              {/* 5. Bank */}
              {enabledWallets.bank && (
                <div className="flex items-center justify-between gap-3 text-xs border-t border-slate-200/70 dark:border-zinc-850 pt-2">
                  <div>
                    <strong className="text-blue-600 dark:text-blue-400 block">
                      ব্যাংক ডিপোজিট
                    </strong>
                    <span className="text-[10px] text-slate-500 dark:text-zinc-400">
                      ইনভেন্টরি হিসাব: ৳{expectedBank.toLocaleString()}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      value={countedBank || ''}
                      onChange={(e) => setCountedBank(Number(e.target.value))}
                      placeholder="ব্যাংক স্টেটমেন্ট"
                      className="w-32 bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-700 rounded-xl px-2.5 py-1.5 text-xs text-right font-mono font-bold text-slate-900 dark:text-white focus:outline-none focus:border-blue-500"
                    />
                    <span
                      className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded ${
                        bankDiscrepancy === 0
                          ? 'bg-[#e6f4ea] text-[#1f8a5b] dark:bg-emerald-950 dark:text-emerald-400'
                          : 'bg-rose-50 text-rose-600 dark:bg-rose-950 dark:text-rose-400'
                      }`}
                    >
                      {bankDiscrepancy === 0 ? 'মিল' : `৳${bankDiscrepancy}`}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Total Discrepancy Alert */}
            <div
              className={`p-3 rounded-2xl border text-xs flex items-center justify-between ${
                totalDiscrepancy === 0
                  ? 'bg-[#e6f4ea] border-emerald-200 text-[#164e3f] dark:bg-emerald-950/40 dark:border-emerald-800 dark:text-emerald-300'
                  : totalDiscrepancy < 0
                  ? 'bg-rose-50 border-rose-200 text-rose-700 dark:bg-rose-950/40 dark:border-rose-800 dark:text-rose-300'
                  : 'bg-amber-50 border-amber-200 text-amber-800 dark:bg-amber-950/40 dark:border-amber-800 dark:text-amber-300'
              }`}
            >
              <div className="flex items-center gap-2">
                {totalDiscrepancy === 0 ? (
                  <CheckCircle className="w-4 h-4 text-[#1f8a5b] dark:text-emerald-400" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-amber-500" />
                )}
                <span>
                  সর্বমোট মিল/অমিল অবস্থা:{' '}
                  <strong>
                    {totalDiscrepancy === 0
                      ? 'সব টাকা হুবহু মিলেছে'
                      : totalDiscrepancy < 0
                      ? `৳${Math.abs(totalDiscrepancy).toLocaleString()} টাকা কম আছে!`
                      : `৳${totalDiscrepancy.toLocaleString()} টাকা অতিরিক্ত আছে!`}
                  </strong>
                </span>
              </div>
            </div>

            {/* Shift Notes */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 dark:text-zinc-400 mb-1">
                ক্লোজিং নোট বা মন্তব্য:
              </label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="যেমন: ইভনিং শিফট ক্যাশ হস্তান্তর সম্পন্ন..."
                className="w-full bg-[#f4f7f5] dark:bg-zinc-950 border border-slate-200/80 dark:border-zinc-800 rounded-2xl px-3.5 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-[#164e3f]"
              />
            </div>

            {/* Submit and WhatsApp Buttons */}
            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={handleSendReportWhatsApp}
                className="flex-1 py-2.5 rounded-2xl bg-[#e6f4ea] hover:bg-emerald-100 text-[#1f8a5b] border border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800 font-bold text-xs transition cursor-pointer flex items-center justify-center gap-1.5"
                title="সরাসরি WhatsApp-এ রিপোর্ট প্রিভিউ পাঠান"
              >
                <MessageSquare className="w-4 h-4" />
                <span>WhatsApp প্রিভিউ</span>
              </button>

              <button
                type="submit"
                className="flex-2 py-2.5 rounded-2xl bg-[#164e3f] hover:bg-[#123e32] text-white font-bold text-xs transition cursor-pointer shadow-xs flex items-center justify-center gap-1.5"
              >
                <FileSpreadsheet className="w-4 h-4" />
                <span>শিফট ক্লোজ করুন ও রসিদ তৈরি করুন</span>
              </button>
            </div>
          </form>
        )}
        </div>
      </div>
    </div>
  );
};
