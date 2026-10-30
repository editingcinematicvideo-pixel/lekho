import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { ExpenseRecord, DrawerType, ExpenseCategorySetting } from '../../types';
import { dbService } from '../../services/db';
import { BottomSheet } from '../ui/BottomSheet';
import {
  Receipt,
  Plus,
  Coffee,
  Car,
  Home,
  Zap,
  Users,
  Scissors,
  Package,
  X,
  ChevronRight,
} from 'lucide-react';

export const ExpenseLedger: React.FC = () => {
  const { currentTenant, showToast, activeStaff, pickText } = useApp();
  const [expenses, setExpenses] = useState<ExpenseRecord[]>(() =>
    dbService.getExpenses(currentTenant.id)
  );
  const [expenseCategories, setExpenseCategories] = useState<ExpenseCategorySetting[]>(() =>
    dbService.getExpenseCategories(currentTenant.id)
  );

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedExpense, setSelectedExpense] = useState<ExpenseRecord | null>(null);
  const [category, setCategory] = useState<string>('food');
  const [amount, setAmount] = useState<number>(250);
  const [paymentDrawer, setPaymentDrawer] = useState<DrawerType>('cash');
  const [note, setNote] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);

  const reload = () => {
    setExpenses(dbService.getExpenses(currentTenant.id));
    setExpenseCategories(dbService.getExpenseCategories(currentTenant.id));
  };

  useEffect(() => {
    reload();
  }, [currentTenant.id]);

  const getCategoryLabel = (catId: string): string => {
    const found = expenseCategories.find((c) => c.id === catId || c.name === catId);
    if (found) {
      return pickText(
        found.bengaliLabel || (found as any).bnLabel || found.label || found.name,
        found.label || found.name
      );
    }
    const fallbackLabelsBn: Record<string, string> = {
      food: 'নাস্তা ও চা',
      transport: 'যাতায়াত',
      rent: 'দোকান ভাড়া',
      utility: 'বিদ্যুৎ বিল',
      salary: 'কর্মচারী বেতন',
      tailoring: 'অলটারেশন',
      packaging: 'প্যাকেজিং',
      other: 'অন্যান্য খরচ',
    };
    const fallbackLabelsEn: Record<string, string> = {
      food: 'Food & Tea',
      transport: 'Transport',
      rent: 'Shop Rent',
      utility: 'Utility Bills',
      salary: 'Staff Salary',
      tailoring: 'Tailoring & Alteration',
      packaging: 'Packaging',
      other: 'Other Expense',
    };
    return pickText(fallbackLabelsBn[catId] || catId, fallbackLabelsEn[catId] || catId);
  };

  const categoryIcons: Record<string, any> = {
    food: Coffee,
    transport: Car,
    rent: Home,
    utility: Zap,
    salary: Users,
    tailoring: Scissors,
    packaging: Package,
    other: Receipt,
  };

  const getDrawerLabel = (dKey: DrawerType): string => {
    switch (dKey) {
      case 'cash':
        return pickText('ক্যাশ ড্রয়ার (Drawer)', 'Cash Drawer');
      case 'merchantBkash':
        return pickText('বিকাশ মার্চেন্ট', 'bKash Merchant');
      case 'personalBkash':
        return pickText('পার্সোনাল বিকাশ', 'Personal bKash');
      case 'nagad':
        return pickText('নগদ একাউন্ট', 'Nagad Account');
      case 'bank':
        return pickText('ব্যাংক একাউন্ট', 'Bank Account');
      default:
        return dKey;
    }
  };

  const totalExpenses = expenses.reduce((a, b) => a + b.amount, 0);

  const handleCreateExpense = (e: React.FormEvent) => {
    e.preventDefault();
    if (amount <= 0) {
      showToast(pickText('টাকার পরিমাণ সঠিকভাবে লিখুন', 'Please enter a valid amount'), 'error');
      return;
    }

    const label = getCategoryLabel(category);
    const newExp: ExpenseRecord = {
      id: `exp_${Date.now()}`,
      shopId: currentTenant.id,
      category: category as ExpenseRecord['category'],
      amount: Number(amount),
      paymentDrawer,
      note: note.trim() || label,
      date,
      createdAt: new Date().toISOString(),
      createdBy: activeStaff ? activeStaff.name : currentTenant.ownerName || 'Store Owner',
    };

    dbService.addExpense(currentTenant.id, newExp);
    reload();
    setIsModalOpen(false);
    showToast(
      pickText(
        `৳${amount.toLocaleString()} খরচ হিসাবভুক্ত করা হয়েছে (${label})`,
        `Recorded expense of ৳${amount.toLocaleString()} (${label})`
      ),
      'success'
    );
  };

  return (
    <div className="space-y-4 max-w-4xl mx-auto pb-20 lg:pb-6">
      {/* Top Header (Unified Theme) */}
      <div className="flex items-center justify-end gap-3">
        <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
          <div className="bg-[#f4f7f5] dark:bg-zinc-800/70 border border-slate-200/80 dark:border-zinc-700 px-3.5 py-2 rounded-2xl text-right">
            <span className="text-[10px] text-slate-500 dark:text-zinc-400 block font-medium">
              {pickText('মোট খরচ', 'Total Expense')}
            </span>
            <span className="text-sm sm:text-base font-extrabold text-rose-600 dark:text-rose-400">
              ৳{totalExpenses.toLocaleString()}
            </span>
          </div>

          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-1.5 bg-[#164e3f] hover:bg-[#123e32] text-white px-4 py-2.5 rounded-2xl text-xs sm:text-sm font-bold transition shadow-xs cursor-pointer shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>{pickText('খরচ এন্ট্রি', 'Add Expense')}</span>
          </button>
        </div>
      </div>

      {/* Expenses Table Card */}
      <div className="bg-white dark:bg-zinc-900 border border-slate-200/90 dark:border-zinc-800 rounded-3xl p-4 sm:p-5 shadow-2xs space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">
            {pickText(`খরচের বিবরণী (${expenses.length} টি)`, `Expense Statement (${expenses.length})`)}
          </h3>
          <span className="text-xs text-slate-400">
            {pickText('আজকের তারিখ:', "Today's Date:")} {date}
          </span>
        </div>

        {expenses.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-400 dark:text-zinc-500 border border-slate-100 dark:border-zinc-800 rounded-2xl">
            {pickText(
              'এখনো কোনো খরচ হিসাবভুক্ত করা হয়নি। উপরের "+ খরচ এন্ট্রি" বাটনে চাপ দিন।',
              'No expenses recorded yet. Click "+ Add Expense" above.'
            )}
          </div>
        ) : (
          <div className="border border-slate-100 dark:border-zinc-800 rounded-2xl overflow-hidden">
            {/* Mobile Compact Summary List (< 768px) */}
            <div className="md:hidden divide-y divide-slate-100 dark:divide-zinc-800">
              {expenses.map((exp) => {
                const Icon = categoryIcons[exp.category] || Receipt;
                return (
                  <button
                    key={exp.id}
                    type="button"
                    onClick={() => setSelectedExpense(exp)}
                    className="w-full px-3.5 py-2.5 text-left flex items-center justify-between gap-2.5 hover:bg-slate-50/70 dark:hover:bg-zinc-800/40 transition cursor-pointer"
                  >
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      <div className="p-1.5 bg-[#e6f4ea] dark:bg-emerald-950/50 rounded-xl text-[#1f8a5b] dark:text-emerald-400 shrink-0">
                        <Icon className="w-3.5 h-3.5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="font-bold text-xs text-slate-900 dark:text-white truncate">
                          {getCategoryLabel(exp.category)}
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-zinc-400 truncate">
                          {exp.note}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <div className="text-right">
                        <div className="font-mono font-black text-xs text-rose-600 dark:text-rose-400">
                          -৳{exp.amount.toLocaleString()}
                        </div>
                        <div className="text-[10px] text-slate-400">{exp.date}</div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Desktop Table (>= 768px) */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-700 dark:text-zinc-300">
                <thead className="bg-[#f4f7f5] dark:bg-zinc-800/80 border-b border-slate-200/80 dark:border-zinc-700 text-[11px] font-bold text-slate-600 dark:text-zinc-400">
                  <tr>
                    <th className="p-3">{pickText('খাত / ক্যাটাগরি', 'Category')}</th>
                    <th className="p-3">{pickText('বিবরণ', 'Description')}</th>
                    <th className="p-3">{pickText('ড্রয়ার / মাধ্যম', 'Drawer / Method')}</th>
                    <th className="p-3">{pickText('তারিখ ও স্টাফ', 'Date & Staff')}</th>
                    <th className="p-3 text-right">{pickText('পরিমাণ', 'Amount')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
                  {expenses.map((exp) => {
                    const Icon = categoryIcons[exp.category] || Receipt;
                    return (
                      <tr
                        key={exp.id}
                        onClick={() => setSelectedExpense(exp)}
                        className="hover:bg-slate-50/70 dark:hover:bg-zinc-800/40 transition cursor-pointer"
                      >
                        <td className="p-3">
                          <div className="flex items-center gap-2">
                            <div className="p-1.5 bg-[#e6f4ea] dark:bg-emerald-950/50 rounded-xl text-[#1f8a5b] dark:text-emerald-400">
                              <Icon className="w-3.5 h-3.5" />
                            </div>
                            <span className="font-bold text-slate-900 dark:text-white">
                              {getCategoryLabel(exp.category)}
                            </span>
                          </div>
                        </td>
                        <td className="p-3 font-medium text-slate-700 dark:text-zinc-200">{exp.note}</td>
                        <td className="p-3">
                          <span className="text-[11px] font-semibold text-slate-600 dark:text-zinc-300 bg-[#f4f7f5] dark:bg-zinc-800 px-2.5 py-1 rounded-lg border border-slate-200/70 dark:border-zinc-700">
                            {getDrawerLabel(exp.paymentDrawer)}
                          </span>
                        </td>
                        <td className="p-3 text-slate-500 dark:text-zinc-400">
                          <div>{exp.date}</div>
                          <div className="text-[10px] text-slate-400">{exp.createdBy}</div>
                        </td>
                        <td className="p-3 text-right font-black text-rose-600 dark:text-rose-400 text-sm">
                          -৳{exp.amount.toLocaleString()}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Compact Bottom Sheet for Expense Details */}
      <BottomSheet
        isOpen={Boolean(selectedExpense)}
        onClose={() => setSelectedExpense(null)}
        title={selectedExpense ? getCategoryLabel(selectedExpense.category) : pickText('খরচের বিবরণ', 'Expense Details')}
        subtitle={selectedExpense ? `${pickText('তারিখ:', 'Date:')} ${selectedExpense.date}` : undefined}
        maxHeightClass="max-h-[45dvh]"
      >
        {selectedExpense && (
          <div className="space-y-2.5">
            <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 dark:bg-zinc-800/60">
              <span className="text-slate-500">{pickText('পরিমাণ', 'Amount')}</span>
              <span className="font-mono font-black text-sm text-rose-600 dark:text-rose-400">
                -৳{selectedExpense.amount.toLocaleString()}
              </span>
            </div>
            <div className="space-y-1.5">
              <div className="flex justify-between">
                <span className="text-slate-500">{pickText('পেমেন্ট ড্রয়ার', 'Payment Drawer')}</span>
                <span className="font-bold text-slate-900 dark:text-white">
                  {getDrawerLabel(selectedExpense.paymentDrawer)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">{pickText('রেকর্ড করেছেন', 'Recorded By')}</span>
                <span className="font-semibold text-slate-800 dark:text-zinc-200">
                  {selectedExpense.createdBy || pickText('স্টাফ', 'Store Staff')}
                </span>
              </div>
              <div className="pt-1.5 border-t border-slate-100 dark:border-zinc-800">
                <div className="text-[10px] text-slate-400 mb-0.5">{pickText('বিবরণ / নোট', 'Description / Note')}</div>
                <div className="font-medium text-slate-800 dark:text-zinc-200">
                  {selectedExpense.note}
                </div>
              </div>
            </div>
          </div>
        )}
      </BottomSheet>

      {/* ======================================================================= */}
      {/* RECORD EXPENSE MODAL                                                    */}
      {/* ======================================================================= */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-in fade-in duration-150">
          <form
            onSubmit={handleCreateExpense}
            className="bg-white dark:bg-zinc-900 border border-slate-200/90 dark:border-zinc-800 rounded-3xl max-w-md w-full p-5 sm:p-6 text-slate-900 dark:text-zinc-100 shadow-2xl space-y-4 relative my-4"
          >
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-zinc-800">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-[#164e3f] flex items-center justify-center text-white shadow-xs shrink-0">
                  <Receipt className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white leading-tight">
                    {pickText('দৈনিক খরচ এন্ট্রি', 'Record Daily Expense')}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
                    {pickText(
                      'দোকানের সকল প্রকার খরচ দ্রুত হিসাবভুক্ত করুন',
                      'Quickly record and manage all store expenses'
                    )}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-white rounded-xl hover:bg-slate-100 dark:hover:bg-zinc-800 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* 1. Dynamic Store Expense Category Selector */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-zinc-400 mb-2">
                {pickText('খরচের খাত (Category)', 'Expense Category')}
              </label>
              <div className="flex flex-wrap gap-1.5">
                {expenseCategories.map((catObj) => {
                  const isSelected = category === catObj.id;
                  return (
                    <button
                      key={catObj.id}
                      type="button"
                      onClick={() => setCategory(catObj.id)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer ${
                        isSelected
                          ? 'bg-[#164e3f] text-white shadow-xs font-bold'
                          : 'bg-[#f4f7f5] dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 border border-slate-200/80 dark:border-zinc-700 hover:border-[#164e3f]'
                      }`}
                    >
                      {pickText(
                        catObj.bengaliLabel || (catObj as any).bnLabel || catObj.name,
                        catObj.label || catObj.name
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 2. Description */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-zinc-400 mb-1.5">
                {pickText('খরচের বিবরণ (Description)', 'Expense Description')}
              </label>
              <input
                type="text"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder={pickText('যেমন: দুপুরের চা ও বিস্কুট', 'e.g. Afternoon tea & snacks')}
                className="w-full bg-[#f4f7f5] dark:bg-zinc-800 border border-slate-200/80 dark:border-zinc-700 rounded-2xl px-4 py-2.5 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-[#164e3f]"
              />
            </div>

            {/* 3. Amount with ৳ Symbol */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-zinc-400 mb-1.5">
                {pickText('টাকার পরিমাণ (Amount)', 'Expense Amount')}
              </label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-base font-extrabold text-slate-400 dark:text-zinc-500">
                  ৳
                </span>
                <input
                  type="number"
                  min={1}
                  required
                  value={amount || ''}
                  onChange={(e) => setAmount(Number(e.target.value))}
                  placeholder="0"
                  className="w-full bg-[#f4f7f5] dark:bg-zinc-800 border border-slate-200/80 dark:border-zinc-700 rounded-2xl pl-9 pr-4 py-3 text-lg font-black text-slate-900 dark:text-white focus:outline-none focus:border-[#164e3f]"
                />
              </div>
            </div>

            {/* 4. Payment Drawer Pills */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-zinc-400 mb-2">
                {pickText('পরিশোধের মাধ্যম (Payment Source)', 'Payment Source')}
              </label>
              <div className="flex flex-wrap gap-1.5">
                {(
                  [
                    'cash',
                    'merchantBkash',
                    'personalBkash',
                    'bank',
                    'nagad',
                  ] as DrawerType[]
                ).map((dKey) => {
                  const isSelected = paymentDrawer === dKey;
                  return (
                    <button
                      key={dKey}
                      type="button"
                      onClick={() => setPaymentDrawer(dKey)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer ${
                        isSelected
                          ? 'bg-[#164e3f] text-white shadow-xs font-bold'
                          : 'bg-[#f4f7f5] dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 border border-slate-200/80 dark:border-zinc-700 hover:border-[#164e3f]'
                      }`}
                    >
                      {getDrawerLabel(dKey)}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Submit Button (Deep Pine Green) */}
            <div className="pt-2">
              <button
                type="submit"
                className="w-full bg-[#164e3f] hover:bg-[#123e32] text-white py-3.5 rounded-2xl font-bold text-sm shadow-md transition cursor-pointer flex items-center justify-center gap-2"
              >
                <span>{pickText('খরচ সংরক্ষণ করুন (Save Expense)', 'Save Expense')}</span>
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
