import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { ZReport } from '../../types';
import { dbService } from '../../services/db';
import {
  formatDailyClosingWhatsAppMemo,
  buildWhatsAppUrl,
} from '../../utils/posOperations';
import { InfoTooltip } from '../ui/InfoTooltip';
import {
  FileSpreadsheet,
  CheckCircle,
  Lock,
  Printer,
  Wallet,
  Building2,
  ArrowLeft,
  CreditCard,
  Smartphone,
  MessageSquare,
  Copy,
} from 'lucide-react';

interface DailyClosingPageProps {
  onBack?: () => void;
}

export const DailyClosingPage: React.FC<DailyClosingPageProps> = ({ onBack }) => {
  const { currentTenant, activeStaff, showToast, pickText } = useApp();

  // Manual physical counts entered by owner/cashier
  const [countedCash, setCountedCash] = useState<number>(0);
  const [countedBkashPersonal, setCountedBkashPersonal] = useState<number>(0);
  const [countedBkashMerchant, setCountedBkashMerchant] = useState<number>(0);
  const [countedNagad, setCountedNagad] = useState<number>(0);
  const [countedBank, setCountedBank] = useState<number>(0);

  const [ownerWhatsAppPhone, setOwnerWhatsAppPhone] = useState<string>(
    currentTenant.ownerPhone || '01711000000'
  );
  const [notes, setNotes] = useState('End of day closing & register audit');
  const [submittedReport, setSubmittedReport] = useState<ZReport | null>(null);

  const invoices = dbService.getInvoices(currentTenant.id);
  const expenses = dbService.getExpenses(currentTenant.id);

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

  // 2. Incoming money by wallet calculated from POS transactions (including 5-way splitBreakdown)
  let expectedCash = 0;
  let expectedBkashPersonal = 0;
  let expectedBkashMerchant = 0;
  let expectedNagad = 0;
  let expectedBank = 0;

  todayInvoices.forEach((inv) => {
    const received = inv.advancePaid ?? inv.total;
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

  // Deduct today's recorded store expenses
  let expensesCash = 0;
  let expensesBkashPersonal = 0;
  let expensesBkashMerchant = 0;
  let expensesNagad = 0;
  let expensesBank = 0;

  todayExpenses.forEach((exp) => {
    if (exp.paymentDrawer === 'cash') expensesCash += exp.amount;
    else if (exp.paymentDrawer === 'personalBkash') expensesBkashPersonal += exp.amount;
    else if (exp.paymentDrawer === 'merchantBkash') expensesBkashMerchant += exp.amount;
    else if (exp.paymentDrawer === 'nagad') expensesNagad += exp.amount;
    else if (exp.paymentDrawer === 'bank') expensesBank += exp.amount;
  });

  const netExpectedCash = Math.max(0, expectedCash - expensesCash);
  const netExpectedBkashPersonal = Math.max(0, expectedBkashPersonal - expensesBkashPersonal);
  const netExpectedBkashMerchant = Math.max(0, expectedBkashMerchant - expensesBkashMerchant);
  const netExpectedNagad = Math.max(0, expectedNagad - expensesNagad);
  const netExpectedBank = Math.max(0, expectedBank - expensesBank);

  const totalExpenseAmount = todayExpenses.reduce((a, b) => a + b.amount, 0);
  const totalDueGiven = todayInvoices.reduce((sum, inv) => sum + (inv.dueAmount || 0), 0);

  // Total Expected Net Inflow across all 5 wallets
  const expectedTotal =
    netExpectedCash +
    netExpectedBkashPersonal +
    netExpectedBkashMerchant +
    netExpectedNagad +
    netExpectedBank;

  // Total Actual Counted across all 5 wallets
  const actualTotal =
    (Number(countedCash) || 0) +
    (Number(countedBkashPersonal) || 0) +
    (Number(countedBkashMerchant) || 0) +
    (Number(countedNagad) || 0) +
    (Number(countedBank) || 0);

  const discrepancy = actualTotal - expectedTotal;
  const isShort = discrepancy < 0;
  const isBalanced = discrepancy === 0;

  const operatorName = activeStaff ? activeStaff.name : currentTenant.ownerName || 'Shop Admin';

  const buildWhatsAppMemoString = () => {
    return formatDailyClosingWhatsAppMemo({
      shopName: currentTenant.name,
      marketAndShopNo: `${currentTenant.marketMallName}, ${currentTenant.shopNo}`,
      date: todayStr,
      operatorName,
      totalSales: totalSalesVolume,
      totalInvoices: todayInvoices.length,
      retailSales: retailSalesVolume,
      retailCount: retailInvoices.length,
      resellerSales: resellerSalesVolume,
      resellerCount: resellerInvoices.length,
      totalExpenses: totalExpenseAmount,
      creditGiven: totalDueGiven,
      expectedCash: netExpectedCash,
      countedCash: Number(countedCash) || 0,
      expectedBkashPersonal: netExpectedBkashPersonal,
      countedBkashPersonal: Number(countedBkashPersonal) || 0,
      expectedBkashMerchant: netExpectedBkashMerchant,
      countedBkashMerchant: Number(countedBkashMerchant) || 0,
      expectedNagad: netExpectedNagad,
      countedNagad: Number(countedNagad) || 0,
      expectedBank: netExpectedBank,
      countedBank: Number(countedBank) || 0,
      totalDiscrepancy: discrepancy,
      notes: notes.trim(),
    });
  };

  const handleSendWhatsApp = () => {
    const memoText = buildWhatsAppMemoString();
    const url = buildWhatsAppUrl(ownerWhatsAppPhone || currentTenant.ownerPhone, memoText);

    // Open WhatsApp Web / App with formatted text memo
    const link = document.createElement('a');
    link.href = url;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    showToast(
      pickText(
        'WhatsApp-এ দৈনিক ক্লোজিং টেক্সট মেমো ওপেন করা হয়েছে!',
        'Daily closing text memo opened in WhatsApp!'
      ),
      'success'
    );
  };

  const handleCopyWhatsAppMemo = async () => {
    try {
      await navigator.clipboard.writeText(buildWhatsAppMemoString());
      showToast(
        pickText(
          'দৈনিক ক্লোজিং মেমো ক্লিপবোর্ডে কপি হয়েছে!',
          'Daily closing memo copied to clipboard!'
        ),
        'success'
      );
    } catch {
      showToast(pickText('কপি করা যায়নি', 'Failed to copy'), 'error');
    }
  };

  const handlePrint = () => {
    showToast(
      pickText('Z-Report প্রিন্ট প্রস্তুত করা হচ্ছে...', 'Preparing Z-Report print...'),
      'info'
    );
    setTimeout(() => {
      window.print();
    }, 50);
  };

  const handleSubmitClosing = (e: React.FormEvent) => {
    e.preventDefault();

    const report: ZReport = {
      id: `zrep_${Date.now()}`,
      shopId: currentTenant.id,
      date: todayStr,
      timestamp: new Date().toISOString(),
      closedBy: operatorName,
      totalSales: totalSalesVolume,
      totalInvoices: todayInvoices.length,
      cashSales: expectedCash,
      digitalSales: expectedBkashPersonal + expectedBkashMerchant + expectedNagad + expectedBank,
      creditGiven: totalDueGiven,
      expensesDeducted: totalExpenseAmount,
      expectedCashBalance: netExpectedCash,
      actualCashCounted: countedCash,
      discrepancy,
      status: isBalanced ? 'balanced' : isShort ? 'short' : 'over',
      retailVsResellerRatio: {
        retailCount: retailInvoices.length,
        retailVolume: retailSalesVolume,
        resellerCount: resellerInvoices.length,
        resellerVolume: resellerSalesVolume,
      },
      auditSnapshots: {
        bkashPersonal: {
          expected: netExpectedBkashPersonal,
          actual: countedBkashPersonal,
        },
        bkashMerchant: {
          expected: netExpectedBkashMerchant,
          actual: countedBkashMerchant,
        },
        nagad: {
          expected: netExpectedNagad,
          actual: countedNagad,
        },
        bank: {
          expected: netExpectedBank,
          actual: countedBank,
        },
      },
      notes: notes.trim(),
    };

    dbService.addZReport(currentTenant.id, report);
    setSubmittedReport(report);
    showToast(
      pickText(
        'দৈনিক ক্লোজিং ও Z-Report সফলভাবে জমা হয়েছে!',
        'Daily Closing & Z-Report successfully submitted!'
      ),
      'success'
    );
  };

  return (
    <div className="space-y-5 max-w-5xl mx-auto pb-24 lg:pb-8">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 bg-white dark:bg-zinc-900 border border-slate-200/90 dark:border-zinc-800 rounded-2xl p-3 sm:p-4 shadow-2xs">
        <div className="flex items-center gap-2">
          <h1 className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-white tracking-tight">
            {pickText('দৈনিক ক্লোজিং (Z-Report)', 'Daily Closing (Z-Report)')}
          </h1>
          <span className="text-xs font-mono font-semibold text-slate-500 dark:text-zinc-400">
            {todayStr}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 dark:border-zinc-700 text-xs font-semibold text-slate-700 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800 transition cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>{pickText('ফিরে যান', 'Back')}</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleSendWhatsApp}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#1f8a5b] hover:bg-[#164e3f] text-white text-xs font-bold transition shadow-xs cursor-pointer"
          >
            <MessageSquare className="w-4 h-4" />
            <span>{pickText('WhatsApp মেমো পাঠান', 'Send WhatsApp')}</span>
          </button>

          <button
            type="button"
            onClick={handlePrint}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#164e3f] hover:bg-[#123e32] text-white text-xs font-bold transition shadow-xs cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            <span>{pickText('Z-Report প্রিন্ট', 'Print Z-Report')}</span>
          </button>
        </div>
      </div>

      {/* KPI Metric Summary Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3">
        <div className="bg-white dark:bg-zinc-900 border border-slate-200/90 dark:border-zinc-800 rounded-2xl p-3.5 shadow-2xs">
          <span className="text-[11px] font-semibold text-slate-500 dark:text-zinc-400 uppercase block">
            {pickText('মোট বিক্রি', 'Total Sales')}
          </span>
          <div className="text-lg sm:text-xl font-black text-slate-900 dark:text-white mt-0.5">
            ৳{totalSalesVolume.toLocaleString()}
          </div>
        </div>

        <div className="bg-white dark:bg-zinc-900 border border-slate-200/90 dark:border-zinc-800 rounded-2xl p-3.5 shadow-2xs">
          <span className="text-[11px] font-semibold text-slate-500 dark:text-zinc-400 uppercase flex items-center gap-1">
            <span>{pickText('হাতে নিট ক্যাশ', 'Net Cash in Hand')}</span>
            <InfoTooltip
              text={pickText(
                'আজকের নগদ বিক্রি থেকে আজকের নগদ খরচ বাদ দিয়ে হিসাব করা হয়েছে।',
                "Calculated from today's cash sales minus today's cash expenses."
              )}
            />
          </span>
          <div className="text-lg sm:text-xl font-black text-[#1f8a5b] dark:text-emerald-400 mt-0.5">
            ৳{netExpectedCash.toLocaleString()}
          </div>
        </div>

        <div className="bg-white dark:bg-zinc-900 border border-slate-200/90 dark:border-zinc-800 rounded-2xl p-3.5 shadow-2xs">
          <span className="text-[11px] font-semibold text-slate-500 dark:text-zinc-400 uppercase block">
            {pickText('ডিজিটাল কালেকশন', 'Digital Collections')}
          </span>
          <div className="text-lg sm:text-xl font-black text-blue-600 dark:text-blue-400 mt-0.5">
            ৳{(expectedBkashPersonal + expectedBkashMerchant + expectedNagad + expectedBank).toLocaleString()}
          </div>
        </div>

        <div className="bg-white dark:bg-zinc-900 border border-slate-200/90 dark:border-zinc-800 rounded-2xl p-3.5 shadow-2xs">
          <span className="text-[11px] font-semibold text-slate-500 dark:text-zinc-400 uppercase block">
            {pickText('দৈনিক খরচ', 'Expenses')}
          </span>
          <div className="text-lg sm:text-xl font-black text-rose-600 dark:text-rose-400 mt-0.5">
            ৳{totalExpenseAmount.toLocaleString()}
          </div>
        </div>
      </div>

      {submittedReport ? (
        /* SUBMITTED SUCCESS SLIP */
        <div className="bg-white dark:bg-zinc-900 border border-slate-200/90 dark:border-zinc-800 rounded-3xl p-6 shadow-2xs space-y-4">
          <div className="flex items-center gap-3 pb-3 border-b border-slate-100 dark:border-zinc-800">
            <div className="w-12 h-12 rounded-2xl bg-[#e6f4ea] text-[#1f8a5b] dark:bg-emerald-950/60 dark:text-emerald-400 flex items-center justify-center">
              <CheckCircle className="w-7 h-7" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                {pickText(
                  'দৈনিক ক্লোজিং সফলভাবে সম্পন্ন হয়েছে!',
                  'Daily Closing Completed Successfully!'
                )}
              </h2>
              <p className="text-xs text-slate-500 dark:text-zinc-400">
                {pickText(
                  `${submittedReport.closedBy || 'Admin'} দ্বারা ক্লোজ করা হয়েছে • ${new Date(submittedReport.timestamp || Date.now()).toLocaleString()}`,
                  `Closed by ${submittedReport.closedBy || 'Admin'} on ${new Date(submittedReport.timestamp || Date.now()).toLocaleString()}`
                )}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div className="bg-[#f4f7f5] dark:bg-zinc-800/60 p-4 rounded-2xl space-y-2">
              <div className="font-bold text-slate-700 dark:text-zinc-200">
                {pickText('বিক্রির সারসংক্ষেপ:', 'Sales Summary:')}
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">{pickText('মোট বিক্রি:', 'Total Sales:')}</span>
                <span className="font-bold text-slate-900 dark:text-white">৳{(submittedReport.totalSales || 0).toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">{pickText('খুচরা বিক্রি:', 'Retail Sales:')}</span>
                <span>
                  ৳{(submittedReport.retailVsResellerRatio?.retailVolume || 0).toLocaleString()} ({submittedReport.retailVsResellerRatio?.retailCount || 0} {pickText('টি অর্ডার', 'orders')})
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">{pickText('পাইকারি / রিসেলার:', 'Wholesale / Reseller:')}</span>
                <span>
                  ৳{(submittedReport.retailVsResellerRatio?.resellerVolume || 0).toLocaleString()} ({submittedReport.retailVsResellerRatio?.resellerCount || 0} {pickText('টি অর্ডার', 'orders')})
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">{pickText('বাকি দেওয়া হয়েছে:', 'Dues Given:')}</span>
                <span className="text-rose-600 font-semibold">৳{(submittedReport.creditGiven || 0).toLocaleString()}</span>
              </div>
            </div>

            <div className="bg-[#f4f7f5] dark:bg-zinc-800/60 p-4 rounded-2xl space-y-2">
              <div className="font-bold text-slate-700 dark:text-zinc-200">
                {pickText('ক্যাশ মিলকরণ:', 'Reconciliation:')}
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">{pickText('প্রত্যাশিত ক্যাশ:', 'Expected Cash:')}</span>
                <span className="font-bold">৳{submittedReport.expectedCashBalance}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">{pickText('গণনাকৃত ক্যাশ:', 'Counted Cash:')}</span>
                <span className="font-bold">৳{submittedReport.actualCashCounted}</span>
              </div>
              <div className="flex justify-between pt-1 border-t border-slate-200 dark:border-zinc-700">
                <span className="text-slate-500">{pickText('পার্থক্য:', 'Discrepancy:')}</span>
                <span className={`font-black ${submittedReport.discrepancy === 0 ? 'text-[#1f8a5b]' : submittedReport.discrepancy < 0 ? 'text-rose-600' : 'text-blue-600'}`}>
                  {submittedReport.discrepancy === 0
                    ? pickText('সঠিক মিলেছে (৳0)', 'Balanced (৳0)')
                    : `${submittedReport.discrepancy > 0 ? '+' : ''}৳${submittedReport.discrepancy}`}
                </span>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-2.5 pt-2">
            <button
              type="button"
              onClick={() => setSubmittedReport(null)}
              className="px-4 py-2.5 rounded-2xl border border-slate-200 dark:border-zinc-700 text-xs font-semibold text-slate-700 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800 transition cursor-pointer"
            >
              {pickText('পুনরায় গণনা করুন', 'Recount / Reopen')}
            </button>
            <button
              type="button"
              onClick={handleSendWhatsApp}
              className="flex-1 py-2.5 px-4 rounded-2xl bg-[#1f8a5b] hover:bg-[#164e3f] text-white text-xs font-bold transition shadow-xs flex items-center justify-center gap-2 cursor-pointer"
            >
              <MessageSquare className="w-4 h-4" />
              <span>{pickText('মালিককে WhatsApp পাঠান', 'Send WhatsApp to Owner')}</span>
            </button>
            <button
              type="button"
              onClick={handlePrint}
              className="flex-1 py-2.5 px-4 rounded-2xl bg-[#164e3f] hover:bg-[#123e32] text-white text-xs font-bold transition shadow-xs flex items-center justify-center gap-2 cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>{pickText('Z-Report স্লিপ প্রিন্ট করুন', 'Print Z-Report Slip')}</span>
            </button>
          </div>
        </div>
      ) : (
        /* CLOSING ENTRY FORM */
        <form onSubmit={handleSubmitClosing} className="space-y-4">
          {/* Main Reconciliation Card */}
          <div className="bg-white dark:bg-zinc-900 border border-slate-200/90 dark:border-zinc-800 rounded-3xl p-4 sm:p-6 shadow-2xs space-y-4">
            <div className="border-b border-slate-100 dark:border-zinc-800 pb-2.5">
              <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
                {pickText('কাউন্টারের ড্রয়ার ও ওয়ালেট হিসাব', 'Physical Cash & Wallet Count')}
              </h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* Cash Drawer */}
              <div className="bg-[#f4f7f5] dark:bg-zinc-800/60 p-4 rounded-2xl border border-slate-200/80 dark:border-zinc-750 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Wallet className="w-4 h-4 text-[#164e3f] dark:text-emerald-400" />
                    <span className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white">
                      {pickText('নগদ ক্যাশ', 'Physical Cash')}
                    </span>
                  </div>
                  <span className="text-[11px] text-slate-500 dark:text-zinc-400 font-mono">
                    {pickText('প্রত্যাশিত:', 'Exp:')} ৳{netExpectedCash}
                  </span>
                </div>

                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-bold text-slate-400">
                    ৳
                  </span>
                  <input
                    type="number"
                    min={0}
                    value={countedCash || ''}
                    onChange={(e) => setCountedCash(Number(e.target.value))}
                    placeholder="0"
                    className="w-full bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-xl pl-8 pr-3 py-2.5 text-base font-black text-slate-900 dark:text-white focus:outline-none focus:border-[#164e3f]"
                  />
                </div>
              </div>

              {/* bKash Merchant */}
              <div className="bg-[#f4f7f5] dark:bg-zinc-800/60 p-4 rounded-2xl border border-slate-200/80 dark:border-zinc-750 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CreditCard className="w-4 h-4 text-pink-600" />
                    <span className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white">
                      {pickText('বিকাশ মার্চেন্ট', 'bKash Merchant')}
                    </span>
                  </div>
                  <span className="text-[11px] text-slate-500 dark:text-zinc-400 font-mono">
                    {pickText('প্রত্যাশিত:', 'Exp:')} ৳{netExpectedBkashMerchant}
                  </span>
                </div>

                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-bold text-slate-400">
                    ৳
                  </span>
                  <input
                    type="number"
                    min={0}
                    value={countedBkashMerchant || ''}
                    onChange={(e) => setCountedBkashMerchant(Number(e.target.value))}
                    placeholder="0"
                    className="w-full bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-xl pl-8 pr-3 py-2.5 text-base font-black text-slate-900 dark:text-white focus:outline-none focus:border-[#164e3f]"
                  />
                </div>
              </div>

              {/* bKash Personal */}
              <div className="bg-[#f4f7f5] dark:bg-zinc-800/60 p-4 rounded-2xl border border-slate-200/80 dark:border-zinc-750 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Smartphone className="w-4 h-4 text-pink-600" />
                    <span className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white">
                      {pickText('বিকাশ পার্সোনাল', 'bKash Personal')}
                    </span>
                  </div>
                  <span className="text-[11px] text-slate-500 dark:text-zinc-400 font-mono">
                    {pickText('প্রত্যাশিত:', 'Exp:')} ৳{netExpectedBkashPersonal}
                  </span>
                </div>

                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-bold text-slate-400">
                    ৳
                  </span>
                  <input
                    type="number"
                    min={0}
                    value={countedBkashPersonal || ''}
                    onChange={(e) => setCountedBkashPersonal(Number(e.target.value))}
                    placeholder="0"
                    className="w-full bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-xl pl-8 pr-3 py-2.5 text-base font-black text-slate-900 dark:text-white focus:outline-none focus:border-[#164e3f]"
                  />
                </div>
              </div>

              {/* Nagad */}
              <div className="bg-[#f4f7f5] dark:bg-zinc-800/60 p-4 rounded-2xl border border-slate-200/80 dark:border-zinc-750 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Smartphone className="w-4 h-4 text-orange-500" />
                    <span className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white">
                      {pickText('নগদ', 'Nagad')}
                    </span>
                  </div>
                  <span className="text-[11px] text-slate-500 dark:text-zinc-400 font-mono">
                    {pickText('প্রত্যাশিত:', 'Exp:')} ৳{netExpectedNagad}
                  </span>
                </div>

                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-bold text-slate-400">
                    ৳
                  </span>
                  <input
                    type="number"
                    min={0}
                    value={countedNagad || ''}
                    onChange={(e) => setCountedNagad(Number(e.target.value))}
                    placeholder="0"
                    className="w-full bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-xl pl-8 pr-3 py-2.5 text-base font-black text-slate-900 dark:text-white focus:outline-none focus:border-[#164e3f]"
                  />
                </div>
              </div>

              {/* Bank Account */}
              <div className="bg-[#f4f7f5] dark:bg-zinc-800/60 p-4 rounded-2xl border border-slate-200/80 dark:border-zinc-750 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-emerald-600" />
                    <span className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white">
                      {pickText('ব্যাংক / কার্ড', 'Bank / Card')}
                    </span>
                  </div>
                  <span className="text-[11px] text-slate-500 dark:text-zinc-400 font-mono">
                    {pickText('প্রত্যাশিত:', 'Exp:')} ৳{netExpectedBank}
                  </span>
                </div>

                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-bold text-slate-400">
                    ৳
                  </span>
                  <input
                    type="number"
                    min={0}
                    value={countedBank || ''}
                    onChange={(e) => setCountedBank(Number(e.target.value))}
                    placeholder="0"
                    className="w-full bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-xl pl-8 pr-3 py-2.5 text-base font-black text-slate-900 dark:text-white focus:outline-none focus:border-[#164e3f]"
                  />
                </div>
              </div>
            </div>

            {/* Reconciliation Difference Banner */}
            <div className={`p-4 rounded-2xl border flex items-center justify-between ${
              isBalanced
                ? 'bg-[#e6f4ea] text-[#1f8a5b] border-emerald-300 dark:bg-emerald-950/40 dark:border-emerald-800'
                : isShort
                ? 'bg-rose-50 text-rose-700 border-rose-300 dark:bg-rose-950/40 dark:border-rose-800'
                : 'bg-blue-50 text-blue-700 border-blue-300 dark:bg-blue-950/40 dark:border-blue-800'
            }`}>
              <div>
                <span className="text-xs font-semibold block">
                  {pickText('অডিট পার্থক্য স্ট্যাটাস:', 'Audit Discrepancy Status:')}
                </span>
                <span className="text-base font-bold">
                  {isBalanced
                    ? pickText('১০০% সঠিক মিলেছে (Perfect Match)', '100% Balanced (Perfect Match)')
                    : isShort
                    ? pickText(
                        `ঘাটতি: -৳${Math.abs(discrepancy).toLocaleString()}`,
                        `Short by -৳${Math.abs(discrepancy).toLocaleString()}`
                      )
                    : pickText(
                        `অতিরিক্ত: +৳${discrepancy.toLocaleString()}`,
                        `Over by +৳${discrepancy.toLocaleString()}`
                      )}
                </span>
              </div>
              <div className="text-right font-mono text-sm">
                <div>
                  {pickText('গণনাকৃত:', 'Counted:')} ৳{actualTotal.toLocaleString()}
                </div>
                <div className="text-xs opacity-75">
                  {pickText('প্রত্যাশিত:', 'Expected:')} ৳{expectedTotal.toLocaleString()}
                </div>
              </div>
            </div>

            {/* Note & Owner WhatsApp Number */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-zinc-400 mb-1">
                  {pickText('ক্লোজিং নোট / মন্তব্য', 'Closing Note / Remarks')}
                </label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder={pickText('দিনের ক্লোজিং নোট লিখুন...', 'Day closing notes...')}
                  className="w-full bg-[#f4f7f5] dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-2xl px-4 py-2.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-[#164e3f]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-zinc-400 mb-1">
                  {pickText('মালিকের WhatsApp নম্বর (রিপোর্ট পাঠানোর নম্বর)', 'Owner WhatsApp Number')}
                </label>
                <input
                  type="text"
                  value={ownerWhatsAppPhone}
                  onChange={(e) => setOwnerWhatsAppPhone(e.target.value)}
                  placeholder="01711000000"
                  className="w-full bg-[#f4f7f5] dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-2xl px-4 py-2.5 text-xs font-mono text-slate-900 dark:text-white focus:outline-none focus:border-[#164e3f]"
                />
              </div>
            </div>

            {/* Action Buttons: Print Z-Report, Send WhatsApp, Copy Memo, Submit */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-2">
              <button
                type="button"
                onClick={handlePrint}
                className="py-3 px-4 rounded-2xl border-2 border-[#164e3f] text-[#164e3f] dark:text-emerald-400 dark:border-emerald-500 font-bold text-xs sm:text-sm flex items-center justify-center gap-2 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 transition cursor-pointer"
              >
                <Printer className="w-4 h-4" />
                <span>{pickText('Z-Report প্রিন্ট করুন', 'Print Z-Report')}</span>
              </button>

              <div className="flex gap-1.5">
                <button
                  type="button"
                  onClick={handleSendWhatsApp}
                  className="flex-1 py-3 px-3 rounded-2xl bg-[#1f8a5b] hover:bg-[#164e3f] text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-1.5 transition shadow-xs cursor-pointer"
                >
                  <MessageSquare className="w-4 h-4" />
                  <span>{pickText('WhatsApp পাঠান', 'Send WhatsApp')}</span>
                </button>
                <button
                  type="button"
                  onClick={handleCopyWhatsAppMemo}
                  title={pickText('টেক্সট মেমো কপি করুন', 'Copy Text Memo')}
                  className="px-3 py-3 rounded-2xl border border-slate-200 dark:border-zinc-700 text-slate-600 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800 transition cursor-pointer flex items-center justify-center"
                >
                  <Copy className="w-4 h-4" />
                </button>
              </div>

              <button
                type="submit"
                className="py-3 px-4 rounded-2xl bg-[#164e3f] hover:bg-[#123e32] text-white font-bold text-xs sm:text-sm transition shadow-md flex items-center justify-center gap-2 cursor-pointer"
              >
                <Lock className="w-4 h-4" />
                <span>{pickText('জমা দিন ও দিন শেষ করুন', 'Submit & Close Day')}</span>
              </button>
            </div>
          </div>
        </form>
      )}

      {/* Printable Z-Report Slip (#printable-z-report) - Visible on screen as preview card & printed by window.print() */}
      <div className="bg-white dark:bg-zinc-900 border border-slate-200/90 dark:border-zinc-800 rounded-3xl p-4 sm:p-6 shadow-2xs">
        <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-100 dark:border-zinc-800 no-print">
          <div>
            <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">
              {pickText(
                'অফিসিয়াল Z-Report স্লিপ প্রিভিউ (প্রিন্ট ও WhatsApp প্রিভিউ)',
                'Official Z-Report Slip Preview'
              )}
            </h3>
            <p className="text-[11px] text-slate-500 dark:text-zinc-400">
              {pickText(
                '"Z-Report প্রিন্ট" বাটনে ক্লিক করলে নিচের স্লিপটি সরাসরি প্রিন্ট হবে',
                'Click "Print Z-Report" to print the slip below directly'
              )}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleSendWhatsApp}
              className="px-3 py-1.5 rounded-xl bg-[#e6f4ea] text-[#164e3f] dark:bg-emerald-950/60 dark:text-emerald-300 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span>{pickText('WhatsApp মেমো পাঠান', 'Send WhatsApp Memo')}</span>
            </button>
            <button
              type="button"
              onClick={handlePrint}
              className="px-3 py-1.5 rounded-xl bg-[#164e3f] text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>{pickText('প্রিন্ট করুন', 'Print Slip')}</span>
            </button>
          </div>
        </div>

        <div className="flex justify-center">
          <div
            id="printable-z-report"
            className="bg-white text-zinc-900 p-4 rounded-2xl border border-zinc-300 font-mono text-xs w-full max-w-sm space-y-2.5 shadow-2xs"
          >
            <div className="text-center border-b-2 border-dashed border-zinc-400 pb-2 space-y-0.5">
              <h2 className="text-sm font-black uppercase">{currentTenant.name}</h2>
              <p className="text-[10px] text-zinc-600">
                {currentTenant.marketMallName} • {currentTenant.shopNo}
              </p>
              <div className="text-[11px] font-bold uppercase tracking-wider pt-0.5">
                {pickText('দৈনিক Z-REPORT / শিফট ক্লোজিং', 'DAILY Z-REPORT / SHIFT CLOSING')}
              </div>
              <p className="text-[10px] text-zinc-500">
                {pickText('তারিখ:', 'Date:')} {todayStr} • {pickText('অপারেটর:', 'By:')} {operatorName}
              </p>
            </div>

            <div className="space-y-1 border-b border-dashed border-zinc-400 pb-2 text-[11px]">
              <div className="font-bold text-zinc-800 uppercase text-[10px]">
                {pickText('বিক্রির সারসংক্ষেপ:', 'Sales Summary:')}
              </div>
              <div className="flex justify-between">
                <span>
                  {pickText('মোট বিক্রি', 'Total Gross Sales')} ({todayInvoices.length}):
                </span>
                <span className="font-bold">৳{totalSalesVolume.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-zinc-600">
                <span>
                  • {pickText('খুচরা বিক্রি', 'Retail Sales')} ({retailInvoices.length}):
                </span>
                <span>৳{retailSalesVolume.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-zinc-600">
                <span>
                  • {pickText('রিসেলার বিক্রি', 'Reseller Sales')} ({resellerInvoices.length}):
                </span>
                <span>৳{resellerSalesVolume.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-rose-700">
                <span>• {pickText('বাকি দেওয়া হয়েছে:', 'Credit / Due Given:')}</span>
                <span>৳{totalDueGiven.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-rose-700">
                <span>
                  • {pickText('দোকানের খরচ', 'Store Expenses')} ({todayExpenses.length}):
                </span>
                <span>-৳{totalExpenseAmount.toLocaleString()}</span>
              </div>
            </div>

            <div className="space-y-1 border-b border-dashed border-zinc-400 pb-2 text-[11px]">
              <div className="font-bold text-zinc-800 uppercase text-[10px]">
                {pickText('ওয়ালেট অডিট (প্রত্যাশিত বনাম গণনাকৃত):', 'Wallet Audit (Expected vs Counted):')}
              </div>
              <div className="flex justify-between">
                <span>{pickText('ক্যাশ ড্রয়ার:', 'Cash Drawer:')}</span>
                <span>
                  ৳{netExpectedCash} / <strong>৳{countedCash || 0}</strong>
                </span>
              </div>
              <div className="flex justify-between">
                <span>{pickText('বিকাশ মার্চেন্ট:', 'bKash Merchant:')}</span>
                <span>
                  ৳{netExpectedBkashMerchant} / <strong>৳{countedBkashMerchant || 0}</strong>
                </span>
              </div>
              <div className="flex justify-between">
                <span>{pickText('বিকাশ পার্সোনাল:', 'bKash Personal:')}</span>
                <span>
                  ৳{netExpectedBkashPersonal} / <strong>৳{countedBkashPersonal || 0}</strong>
                </span>
              </div>
              <div className="flex justify-between">
                <span>{pickText('নগদ:', 'Nagad:')}</span>
                <span>
                  ৳{netExpectedNagad} / <strong>৳{countedNagad || 0}</strong>
                </span>
              </div>
              <div className="flex justify-between">
                <span>{pickText('ব্যাংক / কার্ড:', 'Bank / Card:')}</span>
                <span>
                  ৳{netExpectedBank} / <strong>৳{countedBank || 0}</strong>
                </span>
              </div>
            </div>

            <div className="space-y-1 text-[11px]">
              <div className="flex justify-between font-bold">
                <span>{pickText('মোট প্রত্যাশিত:', 'Total Expected:')}</span>
                <span>৳{expectedTotal.toLocaleString()}</span>
              </div>
              <div className="flex justify-between font-bold">
                <span>{pickText('মোট গণনাকৃত:', 'Total Counted:')}</span>
                <span>৳{actualTotal.toLocaleString()}</span>
              </div>
              <div className="flex justify-between font-black text-xs border-t border-zinc-400 pt-1">
                <span>{pickText('পার্থক্য:', 'DISCREPANCY:')}</span>
                <span>
                  {discrepancy === 0
                    ? pickText('সঠিক মিলেছে (৳0)', 'BALANCED (৳0)')
                    : discrepancy < 0
                    ? `${pickText('ঘাটতি', 'SHORT')} -৳${Math.abs(discrepancy).toLocaleString()}`
                    : `${pickText('অতিরিক্ত', 'OVER')} +৳${discrepancy.toLocaleString()}`}
                </span>
              </div>
              {notes && (
                <div className="text-[10px] text-zinc-600 pt-1 italic">
                  {pickText('নোট:', 'Note:')} {notes}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
