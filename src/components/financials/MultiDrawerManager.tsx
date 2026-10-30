import React, { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { MultiDrawerBalance, DrawerType, DrawerTransaction, OwnerAccount, OwnerWithdrawDepositRecord } from '../../types';
import { dbService } from '../../services/db';
import { canManageDrawersAndAudits, canManagePartners } from '../../utils/securityPolicy';
import { BottomSheet } from '../ui/BottomSheet';
import {
  Wallet,
  ArrowRightLeft,
  EyeOff,
  TrendingUp,
  History,
  Building2,
  DollarSign,
  Smartphone,
  ShieldAlert,
  ArrowUpRight,
  ArrowDownLeft,
  Search,
  Calendar,
  Filter,
  X,
  Check,
  Lock,
  KeyRound,
  User,
  Share2,
  AlertCircle,
  PlusCircle,
  MinusCircle,
  CheckCircle2,
  Coins,
  Receipt,
  Download,
  Ticket,
  Sparkles,
  ShoppingBag,
  Sliders,
  ChevronRight,
} from 'lucide-react';

export const MultiDrawerManager: React.FC = () => {
  const { currentTenant, role, showToast, pickText } = useApp();
  const canViewVault = canManageDrawersAndAudits(role);
  const canViewPartners = canManagePartners(role);
  const [drawers, setDrawers] = useState<MultiDrawerBalance>(() =>
    dbService.getShopDrawers(currentTenant.id)
  );
  const [transactions, setTransactions] = useState<DrawerTransaction[]>(() =>
    dbService.getDrawerTransactions(currentTenant.id)
  );
  const [owners, setOwners] = useState<OwnerAccount[]>(() =>
    canViewPartners ? dbService.getShopOwners(currentTenant.id, role) : []
  );

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedDrawer, setSelectedDrawer] = useState<'all' | DrawerType>('all');
  const [selectedDirection, setSelectedDirection] = useState<'all' | 'in' | 'out'>('all');
  const [selectedType, setSelectedType] = useState<string>('all');
  const [detailTx, setDetailTx] = useState<DrawerTransaction | null>(null);

  // Transfer Modal state
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [fromDrawer, setFromDrawer] = useState<DrawerType>('cash');
  const [toDrawer, setToDrawer] = useState<DrawerType>('merchantBkash');
  const [transferAmount, setTransferAmount] = useState<number>(1000);
  const [transferNote, setTransferNote] = useState('');

  // Owner Withdraw & Add Money Modal State
  const [isOwnerModalOpen, setIsOwnerModalOpen] = useState(false);
  const [selectedOwnerId, setSelectedOwnerId] = useState<string>(() => (owners[0]?.id || ''));
  const [ownerPassword, setOwnerPassword] = useState('');
  const [ownerAction, setOwnerAction] = useState<'withdraw' | 'deposit'>('withdraw');
  const [ownerAmount, setOwnerAmount] = useState<number>(5000);
  const [ownerDrawer, setOwnerDrawer] = useState<DrawerType>('cash');
  const [ownerNote, setOwnerNote] = useState('');
  const [ownerFormError, setOwnerFormError] = useState('');
  const [completedOwnerTx, setCompletedOwnerTx] = useState<{
    record: OwnerWithdrawDepositRecord;
    tx: DrawerTransaction;
    owner: OwnerAccount;
  } | null>(null);

  const isSalesman = !canViewVault;

  const drawerCards = [
    {
      key: 'cash' as DrawerType,
      name: pickText('ক্যাশ ড্রয়ার (নগদ)', 'Physical Cash Drawer'),
      sub: pickText('সেলস কাউন্টার রেজিস্টার ক্যাশ', 'Sales counter register cash'),
      amount: drawers.cash,
      icon: Coins,
      color: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800/60 dark:bg-emerald-950/40 dark:text-emerald-400',
    },
    {
      key: 'merchantBkash' as DrawerType,
      name: pickText('মার্চেন্ট বিকাশ', 'Merchant bKash'),
      sub: pickText('অফিসিয়াল QR রিসিভার', 'Official QR receiver'),
      amount: drawers.merchantBkash,
      icon: Smartphone,
      color: 'border-pink-200 bg-pink-50 text-pink-700 dark:border-pink-800/60 dark:bg-pink-950/40 dark:text-pink-400',
    },
    {
      key: 'personalBkash' as DrawerType,
      name: pickText('ব্যক্তিগত বিকাশ', 'Personal bKash'),
      sub: pickText('মালিকের ব্যক্তিগত নম্বর', 'Owner personal number'),
      amount: drawers.personalBkash,
      icon: Smartphone,
      color: 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-800/60 dark:bg-rose-950/40 dark:text-rose-400',
    },
    {
      key: 'nagad' as DrawerType,
      name: pickText('নগদ একাউন্ট', 'Nagad Account'),
      sub: pickText('পার্সোনাল / উদ্যোক্তা ওয়ালেট', 'Personal / Uddokta wallet'),
      amount: drawers.nagad,
      icon: Smartphone,
      color: 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800/60 dark:bg-amber-950/40 dark:text-amber-400',
    },
    {
      key: 'bank' as DrawerType,
      name: pickText('ব্যাংক হিসাব', 'Bank Account'),
      sub: pickText('কারেন্ট / সিটি ব্যাংক / ইবিএল', 'Current / City Bank / EBL'),
      amount: drawers.bank,
      icon: Building2,
      color: 'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800/60 dark:bg-blue-950/40 dark:text-blue-400',
    },
  ];

  const totalVaultBalance = Object.values(drawers).reduce((a, b) => a + b, 0);

  // Quick Date Presets
  const handleSetPreset = (preset: 'all' | 'today' | 'oct_example' | '7days' | 'month') => {
    const today = new Date();
    const formatDate = (d: Date) => d.toISOString().split('T')[0];

    if (preset === 'all') {
      setStartDate('');
      setEndDate('');
    } else if (preset === 'today') {
      const todayStr = formatDate(today);
      setStartDate(todayStr);
      setEndDate(todayStr);
    } else if (preset === 'oct_example') {
      // 8 oct to 20 oct filter preset
      setStartDate('2026-10-08');
      setEndDate('2026-10-20');
    } else if (preset === '7days') {
      const past = new Date();
      past.setDate(today.getDate() - 7);
      setStartDate(formatDate(past));
      setEndDate(formatDate(today));
    } else if (preset === 'month') {
      const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
      const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0);
      setStartDate(formatDate(firstDay));
      setEndDate(formatDate(lastDay));
    }
  };

  // Filter Transactions
  const filteredTransactions = useMemo(() => {
    return transactions.filter((tx) => {
      // 1. Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchNote = tx.note?.toLowerCase().includes(q);
        const matchRef = tx.referenceId?.toLowerCase().includes(q);
        const matchId = tx.id?.toLowerCase().includes(q);
        const matchDrawer = tx.drawer?.toLowerCase().includes(q);
        const matchSalesman = tx.salesmanName?.toLowerCase().includes(q);
        const matchPerformed = tx.performedBy?.toLowerCase().includes(q);
        const matchAmount = tx.amount.toString().includes(q);
        if (!matchNote && !matchRef && !matchId && !matchDrawer && !matchSalesman && !matchPerformed && !matchAmount) {
          return false;
        }
      }

      // 2. Date Range
      if (startDate) {
        const txDate = tx.timestamp.split('T')[0];
        if (txDate < startDate) return false;
      }
      if (endDate) {
        const txDate = tx.timestamp.split('T')[0];
        if (txDate > endDate) return false;
      }

      // 3. Drawer
      if (selectedDrawer !== 'all' && tx.drawer !== selectedDrawer) {
        return false;
      }

      // 4. Direction
      if (selectedDirection !== 'all' && tx.direction !== selectedDirection) {
        return false;
      }

      // 5. Type
      if (selectedType !== 'all' && tx.type !== selectedType) {
        return false;
      }

      return true;
    });
  }, [transactions, searchQuery, startDate, endDate, selectedDrawer, selectedDirection, selectedType]);

  // Aggregate Stats on Filtered Records
  const filteredStats = useMemo(() => {
    let inflow = 0;
    let outflow = 0;
    const drawerBreakdown: Record<DrawerType, { in: number; out: number }> = {
      cash: { in: 0, out: 0 },
      personalBkash: { in: 0, out: 0 },
      merchantBkash: { in: 0, out: 0 },
      nagad: { in: 0, out: 0 },
      bank: { in: 0, out: 0 },
    };

    filteredTransactions.forEach((tx) => {
      if (tx.direction === 'in') {
        inflow += tx.amount;
        if (drawerBreakdown[tx.drawer]) {
          drawerBreakdown[tx.drawer].in += tx.amount;
        }
      } else {
        outflow += tx.amount;
        if (drawerBreakdown[tx.drawer]) {
          drawerBreakdown[tx.drawer].out += tx.amount;
        }
      }
    });

    return {
      inflow,
      outflow,
      net: inflow - outflow,
      drawerBreakdown,
    };
  }, [filteredTransactions]);

  const handleExecuteTransfer = (e: React.FormEvent) => {
    e.preventDefault();
    if (fromDrawer === toDrawer) {
      showToast(
        pickText(
          'উৎস এবং গন্তব্য ড্রয়ার একই হতে পারবে না',
          'Source and Destination drawer cannot be the same'
        ),
        'error'
      );
      return;
    }
    if (transferAmount <= 0) {
      showToast(pickText('অনুগ্রহ করে সঠিক পরিমাণ লিখুন', 'Please enter a valid amount'), 'error');
      return;
    }
    if (drawers[fromDrawer] < transferAmount) {
      showToast(
        pickText(
          `${fromDrawer}-এ পর্যাপ্ত ব্যালেন্স নেই। বর্তমান ব্যালেন্স: ৳${drawers[fromDrawer]}`,
          `Insufficient balance in ${fromDrawer}. Available: ৳${drawers[fromDrawer]}`
        ),
        'error'
      );
      return;
    }

    const note = transferNote.trim() || `Inter-drawer vault rebalance: ${fromDrawer} -> ${toDrawer}`;
    try {
      dbService.transferDrawerFunds(
        currentTenant.id,
        fromDrawer,
        toDrawer,
        transferAmount,
        note
      );
      setDrawers(dbService.getShopDrawers(currentTenant.id));
      setTransactions(dbService.getDrawerTransactions(currentTenant.id));
      setIsTransferModalOpen(false);
      setTransferAmount(1000);
      setTransferNote('');
      showToast(
        pickText(
          `সফলভাবে ৳${transferAmount.toLocaleString()} ${toDrawer}-এ ট্রান্সফার করা হয়েছে!`,
          `Successfully transferred ৳${transferAmount.toLocaleString()} to ${toDrawer}!`
        ),
        'success'
      );
    } catch (err: any) {
      showToast(
        err?.message || pickText('ট্রান্সফার ব্যর্থ হয়েছে। ব্যালেন্স চেক করুন।', 'Transfer failed. Please check balance.'),
        'error'
      );
    }
  };

  const handleExecuteOwnerTx = (e: React.FormEvent) => {
    e.preventDefault();
    setOwnerFormError('');

    if (ownerAmount <= 0) {
      setOwnerFormError(pickText('অনুগ্রহ করে সঠিক টাকার পরিমাণ দিন।', 'Please enter a valid amount.'));
      return;
    }

    const currentOwner = owners.find((o) => o.id === selectedOwnerId) || owners[0];
    if (!currentOwner) {
      setOwnerFormError(pickText('ওনার একাউন্ট নির্বাচন করুন।', 'Please select an owner account.'));
      return;
    }

    if (!ownerPassword.trim()) {
      setOwnerFormError(pickText('গোপন পাসওয়ার্ড প্রদান আবশ্যক!', 'Secret password is required!'));
      return;
    }

    if (ownerAction === 'withdraw' && drawers[ownerDrawer] < ownerAmount) {
      setOwnerFormError(
        pickText(
          `নির্বাচিত ড্রয়ারে পর্যাপ্ত ব্যালেন্স নেই! বর্তমান ব্যালেন্স: ৳${drawers[ownerDrawer].toLocaleString()}`,
          `Insufficient balance in selected drawer! Available: ৳${drawers[ownerDrawer].toLocaleString()}`
        )
      );
      return;
    }

    const note =
      ownerNote.trim() ||
      (ownerAction === 'withdraw'
        ? pickText(
            `ওনার উত্তোলন: ${currentOwner.name} (@${currentOwner.username})`,
            `Owner Withdraw: ${currentOwner.name} (@${currentOwner.username})`
          )
        : pickText(
            `ব্যবসায় মূলধন জমা: ${currentOwner.name} (@${currentOwner.username})`,
            `Business Capital Deposit: ${currentOwner.name} (@${currentOwner.username})`
          ));

    const res = dbService.recordOwnerWithdrawDeposit(currentTenant.id, {
      ownerId: currentOwner.id,
      password: ownerPassword,
      action: ownerAction,
      amount: ownerAmount,
      drawer: ownerDrawer,
      note,
    });

    if (!res.success || !res.record || !res.tx) {
      setOwnerFormError(
        res.message ||
          pickText(
            'উত্তোলন বা জমা ব্যর্থ হয়েছে। পাসওয়ার্ড যাচাই করুন।',
            'Transaction failed. Please verify your password.'
          )
      );
      return;
    }

    setDrawers(dbService.getShopDrawers(currentTenant.id));
    setTransactions(dbService.getDrawerTransactions(currentTenant.id));
    setOwners(dbService.getShopOwners(currentTenant.id));
    setIsOwnerModalOpen(false);
    setOwnerPassword('');
    setOwnerNote('');
    setOwnerAmount(5000);

    showToast(
      ownerAction === 'withdraw'
        ? pickText(
            `৳${ownerAmount.toLocaleString()} সফলভাবে উত্তোলন সম্পন্ন হয়েছে!`,
            `Successfully withdrawn ৳${ownerAmount.toLocaleString()}!`
          )
        : pickText(
            `৳${ownerAmount.toLocaleString()} ব্যবসায় মূলধন হিসেবে সফলভাবে জমা হয়েছে!`,
            `Successfully deposited ৳${ownerAmount.toLocaleString()} as business capital!`
          ),
      'success'
    );

    // Open completed transaction receipt modal
    setCompletedOwnerTx({
      record: res.record,
      tx: res.tx,
      owner: currentOwner,
    });
  };

  const handleShareOwnerSlipWhatsApp = (data: {
    record: OwnerWithdrawDepositRecord;
    owner: OwnerAccount;
  }) => {
    const text = `*LEKHO POS - OWNER TRANSACTION MEMO*
• Store: ${currentTenant.name}
• Partner/Owner: ${data.owner.name} (@${data.owner.username})
• Type: ${data.record.action === 'withdraw' ? 'OWNER WITHDRAW' : 'CAPITAL ADD'}
• Amount: ৳${data.record.amount.toLocaleString()}
• Drawer Account: ${data.record.drawer}
• Note / Purpose: ${data.record.note}
• Date & Time: ${new Date(data.record.timestamp).toLocaleString('en-GB')}
-----------------------------
• Cumulative Total Withdrawn: ৳${data.owner.totalWithdrawn.toLocaleString()}
• Cumulative Capital Invested: ৳${data.owner.totalAdded.toLocaleString()}
_Secure Partner Ledger verified with secret password._`;

    const encoded = encodeURIComponent(text);
    const targetPhone = data.owner.phone ? data.owner.phone.replace(/[^0-9]/g, '') : '';
    const link = document.createElement('a');
    link.href = `https://wa.me/${targetPhone}?text=${encoded}`;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.click();
  };

  return (
    <div className="space-y-4 pb-20 lg:pb-6">
      {/* Header & Total Reserve Deep Pine Green Card (Matches Demo Image 3) */}
      <div className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <h2 className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-white tracking-tight">
            {pickText('ভল্ট ও ড্রয়ারসমূহ', 'Vault & Drawers')}
          </h2>
        </div>

        {/* Salesman Blind Protection Warning OR Deep Pine Green Total Reserve Card */}
        {isSalesman ? (
          <div className="flex items-center gap-2 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 px-4 py-3.5 rounded-3xl text-xs text-amber-700 dark:text-amber-400 font-medium">
            <ShieldAlert className="w-4 h-4 shrink-0" strokeWidth={1.75} />
            <span>
              {pickText(
                'ব্লাইন্ড প্রোটেকশন চালু: ড্রয়ার রিজার্ভ এবং মালিকের উত্তোলন সেলসম্যানদের কাছে গোপন রাখা হয়েছে',
                'Blind Protection Active: Drawer reserves & owner withdrawals hidden from Salesman'
              )}
            </span>
          </div>
        ) : (
          <div className="bg-[#164e3f] text-white rounded-3xl p-4 sm:p-5 space-y-3.5 shadow-sm">
            <div>
              <span className="text-xs text-emerald-100/80 font-medium block">
                {pickText('মোট রিজার্ভ তহবিল', 'Total reserve')}
              </span>
              <div className="text-2xl sm:text-3xl font-extrabold tracking-tight mt-0.5">
                ৳{totalVaultBalance.toLocaleString()}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-1">
              <button
                type="button"
                onClick={() => {
                  setOwnerFormError('');
                  setIsOwnerModalOpen(true);
                }}
                className="py-2.5 px-4 rounded-2xl bg-white text-slate-900 hover:bg-emerald-50 font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition shadow-2xs cursor-pointer"
              >
                <KeyRound className="w-4 h-4 text-[#164e3f]" strokeWidth={2} />
                <span>{pickText('ওনার তহবিল', 'Owner funds')}</span>
              </button>

              <button
                type="button"
                onClick={() => setIsTransferModalOpen(true)}
                className="py-2.5 px-4 rounded-2xl bg-white/15 hover:bg-white/25 text-white border border-white/20 font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition cursor-pointer"
              >
                <ArrowRightLeft className="w-4 h-4" strokeWidth={2} />
                <span>{pickText('ট্রান্সফার', 'Transfer')}</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 5 Drawer Balance Cards (2 cols on mobile with 5th spanning full width, 5 cols on desktop) */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-2.5 sm:gap-3">
        {drawerCards.map((card, idx) => {
          const Icon = card.icon;
          const isLastOdd = idx === drawerCards.length - 1;
          return (
            <div
              key={card.key}
              className={`bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 rounded-2xl p-3.5 flex flex-col justify-between space-y-2.5 shadow-2xs transition ${
                isLastOdd ? 'col-span-2 lg:col-span-1' : ''
              }`}
            >
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-[#e6f4ea] dark:bg-emerald-950/60 text-[#1f8a5b] dark:text-emerald-400 flex items-center justify-center shrink-0">
                  <Icon className="w-4 h-4" strokeWidth={2} />
                </div>
                <div className="min-w-0">
                  <div className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white truncate">
                    {card.name}
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-zinc-400 truncate">
                    {card.sub}
                  </div>
                </div>
              </div>

              <div>
                {isSalesman ? (
                  <div className="flex items-center gap-1.5 text-slate-400 dark:text-zinc-500 font-mono text-sm">
                    <EyeOff className="w-4 h-4" strokeWidth={1.75} />
                    <span>••••••</span>
                  </div>
                ) : (
                  <div className="text-lg sm:text-xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                    ৳{card.amount.toLocaleString()}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Partners Card (Matches Demo Image 3) */}
      {!isSalesman && owners.length > 0 && (
        <div className="bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 shadow-2xs rounded-3xl p-4 sm:p-5 space-y-3.5">
          <div className="flex items-center gap-2">
            <User className="w-4 h-4 text-[#1f8a5b] dark:text-emerald-400" strokeWidth={2} />
            <span className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-white">
              {pickText('পার্টনারগণ', 'Partners')}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {owners.map((owner) => {
              const netContribution = (owner.totalAdded || 0) - (owner.totalWithdrawn || 0);
              return (
                <div
                  key={owner.id}
                  className="bg-[#f4f7f5] dark:bg-zinc-800/50 border border-slate-200/60 dark:border-zinc-800 rounded-2xl p-4 space-y-3 transition"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                        <span>{owner.name}</span>
                        <span className="text-xs text-[#1f8a5b] dark:text-emerald-400 font-semibold">
                          @{owner.username}
                        </span>
                      </div>
                      <div className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
                        <span className="underline text-blue-600 dark:text-blue-400">{owner.phone}</span> • {owner.sharePercentage || 50}% {pickText('শেয়ার', 'share')}
                      </div>
                    </div>
                    <span className="text-[11px] px-2.5 py-0.5 rounded-full font-bold bg-[#e6f4ea] text-[#1f8a5b] dark:bg-emerald-950/60 dark:text-emerald-400">
                      {pickText('পার্টনার', 'Partner')}
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-2 pt-2.5 border-t border-slate-200/70 dark:border-zinc-700/60 text-xs">
                    <div>
                      <span className="text-[11px] text-slate-500 dark:text-zinc-400 block">
                        {pickText('উত্তোলন', 'Withdrawn')}
                      </span>
                      <div className="font-extrabold text-rose-600 dark:text-rose-400 mt-0.5">
                        -৳{(owner.totalWithdrawn || 0).toLocaleString()}
                      </div>
                    </div>
                    <div>
                      <span className="text-[11px] text-slate-500 dark:text-zinc-400 block">
                        {pickText('জমা', 'Added')}
                      </span>
                      <div className="font-extrabold text-[#1f8a5b] dark:text-emerald-400 mt-0.5">
                        +৳{(owner.totalAdded || 0).toLocaleString()}
                      </div>
                    </div>
                    <div>
                      <span className="text-[11px] text-slate-500 dark:text-zinc-400 block">
                        {pickText('নিট', 'Net')}
                      </span>
                      <div
                        className={`font-extrabold mt-0.5 ${
                          netContribution >= 0
                            ? 'text-[#1f8a5b] dark:text-emerald-400'
                            : 'text-rose-600 dark:text-rose-400'
                        }`}
                      >
                        {netContribution >= 0 ? '+' : ''}৳{netContribution.toLocaleString()}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* FILTER & SEARCH CARD (Matches Demo Image 3) */}
      <div className="bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 shadow-2xs rounded-3xl p-4 sm:p-5 space-y-3.5">
        {/* Search Bar */}
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={pickText('মেমো, নোট, ফোন নম্বর খুঁজুন...', 'Search memo, note, phone...')}
            className="w-full bg-[#f4f7f5] dark:bg-zinc-800 border border-slate-200/70 dark:border-zinc-700 rounded-2xl pl-10 pr-8 py-2.5 text-xs sm:text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-[#1f8a5b] transition"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 dark:hover:text-white cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Quick Date Presets (All, Today, 7 days, Month) */}
        <div className="grid grid-cols-4 gap-2">
          <button
            type="button"
            onClick={() => handleSetPreset('all')}
            className={`py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
              !startDate && !endDate
                ? 'bg-[#1f8a5b] text-white shadow-2xs'
                : 'bg-[#f4f7f5] dark:bg-zinc-800 text-slate-600 dark:text-zinc-300'
            }`}
          >
            {pickText('সব', 'All')}
          </button>
          <button
            type="button"
            onClick={() => handleSetPreset('today')}
            className={`py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
              startDate && startDate === endDate
                ? 'bg-[#1f8a5b] text-white shadow-2xs'
                : 'bg-[#f4f7f5] dark:bg-zinc-800 text-slate-600 dark:text-zinc-300'
            }`}
          >
            {pickText('আজ', 'Today')}
          </button>
          <button
            type="button"
            onClick={() => handleSetPreset('7days')}
            className="py-2 rounded-xl text-xs font-bold bg-[#f4f7f5] dark:bg-zinc-800 text-slate-600 dark:text-zinc-300 hover:text-slate-900 dark:hover:text-white transition cursor-pointer"
          >
            {pickText('৭ দিন', '7 days')}
          </button>
          <button
            type="button"
            onClick={() => handleSetPreset('month')}
            className="py-2 rounded-xl text-xs font-bold bg-[#f4f7f5] dark:bg-zinc-800 text-slate-600 dark:text-zinc-300 hover:text-slate-900 dark:hover:text-white transition cursor-pointer"
          >
            {pickText('এই মাস', 'Month')}
          </button>
        </div>

        {/* Custom Date Range & Dropdowns */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          <select
            value={selectedDrawer}
            onChange={(e) => setSelectedDrawer(e.target.value as any)}
            className="w-full bg-[#f4f7f5] dark:bg-zinc-800 border border-slate-200/70 dark:border-zinc-700 rounded-xl px-3 py-2.5 text-xs font-semibold text-slate-900 dark:text-white focus:outline-none focus:border-[#1f8a5b]"
          >
            <option value="all">{pickText('সব ড্রয়ার', 'All drawers')}</option>
            <option value="cash">{pickText('ক্যাশ (নগদ)', 'Cash')}</option>
            <option value="merchantBkash">{pickText('মার্চেন্ট বিকাশ', 'bKash Merchant')}</option>
            <option value="personalBkash">{pickText('পার্সোনাল বিকাশ', 'bKash Personal')}</option>
            <option value="nagad">{pickText('নগদ একাউন্ট', 'Nagad')}</option>
            <option value="bank">{pickText('ব্যাংক হিসাব', 'Bank Account')}</option>
          </select>

          <select
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
            className="w-full bg-[#f4f7f5] dark:bg-zinc-800 border border-slate-200/70 dark:border-zinc-700 rounded-xl px-3 py-2.5 text-xs font-semibold text-slate-900 dark:text-white focus:outline-none focus:border-[#1f8a5b]"
          >
            <option value="all">{pickText('সব ধরন', 'All types')}</option>
            <option value="sale">{pickText('বিক্রয়', 'Sales')}</option>
            <option value="owner_withdraw">{pickText('মালিকের উত্তোলন', 'Owner Withdraw')}</option>
            <option value="owner_deposit">{pickText('মূলধন জমা', 'Capital Deposit')}</option>
            <option value="expense">{pickText('খরচ', 'Expense')}</option>
            <option value="transfer">{pickText('ট্রান্সফার', 'Transfer')}</option>
            <option value="due_recovery">{pickText('বাকি আদায়', 'Due Recovery')}</option>
            <option value="advance">{pickText('অগ্রিম', 'Advance')}</option>
          </select>

          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            title={pickText('শুরুর তারিখ', 'Start Date')}
            className="w-full bg-[#f4f7f5] dark:bg-zinc-800 border border-slate-200/70 dark:border-zinc-700 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-[#1f8a5b]"
          />

          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            title={pickText('শেষের তারিখ', 'End Date')}
            className="w-full bg-[#f4f7f5] dark:bg-zinc-800 border border-slate-200/70 dark:border-zinc-700 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-[#1f8a5b]"
          />
        </div>

        {/* 3 Summary Stat Boxes (Inflow, Outflow, Net) */}
        <div className="grid grid-cols-3 gap-2.5 pt-1">
          <div className="bg-[#e6f4ea]/70 dark:bg-emerald-950/30 rounded-2xl p-3">
            <span className="text-[11px] text-[#1f8a5b] dark:text-emerald-400 font-medium block">
              {pickText('জমা (Inflow)', 'Inflow')}
            </span>
            <strong className="text-[#1f8a5b] dark:text-emerald-400 font-extrabold text-sm sm:text-base mt-0.5 block">
              +৳{filteredStats.inflow.toLocaleString()}
            </strong>
          </div>

          <div className="bg-rose-50/80 dark:bg-rose-950/30 rounded-2xl p-3">
            <span className="text-[11px] text-rose-600 dark:text-rose-400 font-medium block">
              {pickText('খরচ/উত্তোলন (Outflow)', 'Outflow')}
            </span>
            <strong className="text-rose-600 dark:text-rose-400 font-extrabold text-sm sm:text-base mt-0.5 block">
              -৳{filteredStats.outflow.toLocaleString()}
            </strong>
          </div>

          <div className="bg-[#f4f7f5] dark:bg-zinc-800/70 rounded-2xl p-3">
            <span className="text-[11px] text-slate-500 dark:text-zinc-400 font-medium block">
              {pickText('নিট (Net)', 'Net')}
            </span>
            <strong
              className={`font-extrabold text-sm sm:text-base mt-0.5 block ${
                filteredStats.net >= 0
                  ? 'text-[#1f8a5b] dark:text-emerald-400'
                  : 'text-rose-600 dark:text-rose-400'
              }`}
            >
              {filteredStats.net >= 0 ? '+' : ''}৳{filteredStats.net.toLocaleString()}
            </strong>
          </div>
        </div>
      </div>

      {/* Audit Ledger (Matches Demo Image 3 Clean List) */}
      <div className="bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 shadow-2xs rounded-3xl p-4 sm:p-5 space-y-3">
        <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-zinc-800">
          <h3 className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
            <History className="w-4 h-4 text-[#1f8a5b] dark:text-emerald-400" strokeWidth={2} />
            <span>{pickText('অডিট লেজার', 'Audit ledger')}</span>
          </h3>
          <span className="text-xs text-slate-400 dark:text-zinc-500">
            {filteredTransactions.length} {pickText('টি রেকর্ড', 'records')}
          </span>
        </div>

        <div className="divide-y divide-slate-100 dark:divide-zinc-800/80">
          {filteredTransactions.length === 0 ? (
            <div className="py-10 text-center text-xs text-slate-400 dark:text-zinc-500">
              {pickText('কোন ট্রানজেকশন পাওয়া যায়নি', 'No matching transactions found')}
            </div>
          ) : (
            filteredTransactions.map((tx) => {
              const drawerLabel =
                tx.drawer === 'cash'
                  ? pickText('ক্যাশ', 'Cash')
                  : tx.drawer === 'merchantBkash'
                  ? pickText('মার্চেন্ট বিকাশ', 'Merchant bKash')
                  : tx.drawer === 'personalBkash'
                  ? pickText('পার্সোনাল বিকাশ', 'Personal bKash')
                  : tx.drawer === 'nagad'
                  ? pickText('নগদ', 'Nagad')
                  : pickText('ব্যাংক', 'Bank');

              const typeBadge =
                tx.type === 'owner_withdraw'
                  ? pickText('মালিকের উত্তোলন', 'owner withdraw')
                  : tx.type === 'owner_deposit'
                  ? pickText('মূলধন যোগ', 'capital add')
                  : tx.type === 'sale'
                  ? pickText('বিক্রয়', 'sale')
                  : tx.type === 'expense'
                  ? pickText('খরচ', 'expense')
                  : tx.type === 'transfer'
                  ? pickText('ট্রান্সফার', 'transfer')
                  : tx.type === 'due_recovery'
                  ? pickText('বাকি আদায়', 'due recovered')
                  : tx.type === 'advance'
                  ? pickText('অগ্রিম', 'advance')
                  : pickText('সমন্বয়', 'adjustment');

              return (
                <button
                  key={tx.id}
                  type="button"
                  onClick={() => setDetailTx(tx)}
                  className="w-full py-3 first:pt-1 last:pb-1 text-left flex items-center justify-between gap-3 hover:bg-slate-50/70 dark:hover:bg-zinc-800/40 rounded-xl px-1.5 -mx-1.5 transition cursor-pointer"
                >
                  <div className="min-w-0 flex-1">
                    <div className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white truncate">
                      {tx.note || pickText('কাউন্টার ট্রানজেকশন', 'Counter transaction')}
                    </div>
                    <div className="flex items-center gap-1.5 text-[11px] text-slate-400 dark:text-zinc-400 mt-0.5">
                      <span
                        className={`px-1.5 py-0.2 rounded font-bold text-[10px] ${
                          tx.direction === 'in'
                            ? 'bg-[#e6f4ea] text-[#1f8a5b] dark:bg-emerald-950/60 dark:text-emerald-400'
                            : 'bg-rose-50 text-rose-600 dark:bg-rose-950/60 dark:text-rose-400'
                        }`}
                      >
                        {typeBadge}
                      </span>
                      <span>{drawerLabel}</span>
                      <span>·</span>
                      <span>
                        {new Date(tx.timestamp).toLocaleDateString('en-GB', {
                          day: '2-digit',
                          month: 'short',
                        })}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <div className="text-right">
                      {isSalesman ? (
                        <span className="text-slate-400 dark:text-zinc-500 font-mono text-xs">••••</span>
                      ) : tx.direction === 'in' ? (
                        <span className="text-[#1f8a5b] dark:text-emerald-400 text-xs sm:text-sm font-extrabold font-mono">
                          +৳{tx.amount.toLocaleString()}
                        </span>
                      ) : (
                        <span className="text-rose-600 dark:text-rose-400 text-xs sm:text-sm font-extrabold font-mono">
                          -৳{tx.amount.toLocaleString()}
                        </span>
                      )}
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* OWNER WITHDRAW & BUSINESS ADD MONEY MODAL */}
      {isOwnerModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <form
            onSubmit={handleExecuteOwnerTx}
            className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl sm:rounded-3xl max-w-md w-full p-4 sm:p-5 text-slate-900 dark:text-zinc-100 shadow-2xl space-y-3.5 max-h-[90dvh] overflow-y-auto animate-in fade-in zoom-in-95"
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-zinc-800">
              <h3 className="lekho-modal-title text-slate-900 dark:text-white flex items-center gap-2">
                <KeyRound className="w-5 h-5 text-[#1f8a5b] dark:text-emerald-400 shrink-0" strokeWidth={1.75} />
                <span>
                  {pickText(
                    'মালিকের উত্তোলন ও ব্যবসায় মূলধন যোগ',
                    'Owner Withdraw & Business Add Money'
                  )}
                </span>
              </h3>
              <button
                type="button"
                onClick={() => setIsOwnerModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 dark:hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-500 dark:text-zinc-400">
              {pickText(
                'মালিকের ব্যক্তিগত উত্তোলন অথবা ব্যবসায় মূলধন যোগ করতে নিজের ইউজার ও নির্ধারিত গোপন পাসওয়ার্ড দিন।',
                'Select your owner account and enter your secret password to record an owner withdrawal or capital deposit.'
              )}
            </p>

            {/* Action Toggle */}
            <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 dark:bg-zinc-950 rounded-2xl border border-slate-200 dark:border-zinc-800">
              <button
                type="button"
                onClick={() => setOwnerAction('withdraw')}
                className={`py-2 text-xs font-bold rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer ${
                  ownerAction === 'withdraw'
                    ? 'bg-rose-600 text-white shadow-xs'
                    : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <MinusCircle className="w-4 h-4" />
                {pickText('মালিকের উত্তোলন', 'Owner Withdraw')}
              </button>

              <button
                type="button"
                onClick={() => setOwnerAction('deposit')}
                className={`py-2 text-xs font-bold rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer ${
                  ownerAction === 'deposit'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <PlusCircle className="w-4 h-4" />
                {pickText('ব্যবসায় মূলধন যোগ', 'Add Business Capital')}
              </button>
            </div>

            {/* Select Owner / Partner */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                {pickText('ওনার / পার্টনার নির্বাচন করুন', 'Select Owner / Partner Account')}
              </label>
              <select
                value={selectedOwnerId}
                onChange={(e) => setSelectedOwnerId(e.target.value)}
                className="w-full bg-slate-50 dark:bg-zinc-950 border border-slate-300 dark:border-zinc-800 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
              >
                {owners.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name} (@{o.username}) • {pickText('শেয়ার', 'Share')}: {o.sharePercentage || 50}%
                  </option>
                ))}
              </select>
            </div>

            {/* Secret Password Validation */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1 flex items-center justify-between">
                <span>{pickText('ওনার গোপন পাসওয়ার্ড / পিন', 'Owner Secret Password / PIN')}</span>
                <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-mono font-semibold">
                  {pickText('নিরাপত্তা যাচাই', 'Security Verification')}
                </span>
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 dark:text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="password"
                  required
                  value={ownerPassword}
                  onChange={(e) => setOwnerPassword(e.target.value)}
                  placeholder={pickText('আপনার ব্যক্তিগত পাসওয়ার্ড দিন', 'Enter your personal password')}
                  className="w-full bg-slate-50 dark:bg-zinc-950 border border-slate-300 dark:border-zinc-800 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-zinc-600 focus:outline-none focus:border-emerald-500"
                />
              </div>
              <span className="text-[10px] text-slate-500 dark:text-zinc-500 mt-0.5 block">
                {pickText(
                  'একজন পার্টনার যাতে অন্যজনের নামে টাকা এন্ট্রি না করতে পারে তার জন্য পাসওয়ার্ড বাধ্যতামূলক।',
                  'Password is required so one partner cannot record transactions under another partner’s name.'
                )}
              </span>
            </div>

            {/* Drawer Account */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                {ownerAction === 'withdraw'
                  ? pickText('যে ড্রয়ার থেকে টাকা নেওয়া হবে', 'Source Drawer to Withdraw From')
                  : pickText('যে ড্রয়ারে টাকা জমা হবে', 'Destination Drawer to Deposit Into')}
              </label>
              <select
                value={ownerDrawer}
                onChange={(e) => setOwnerDrawer(e.target.value as DrawerType)}
                className="w-full bg-slate-50 dark:bg-zinc-950 border border-slate-300 dark:border-zinc-800 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
              >
                <option value="cash">
                  {pickText('নগদ ক্যাশ', 'Physical Cash')} ({pickText('ব্যালেন্স', 'Balance')}: ৳{drawers.cash.toLocaleString()})
                </option>
                <option value="personalBkash">
                  {pickText('পার্সোনাল বিকাশ', 'Personal bKash')} ({pickText('ব্যালেন্স', 'Balance')}: ৳{drawers.personalBkash.toLocaleString()})
                </option>
                <option value="merchantBkash">
                  {pickText('মার্চেন্ট বিকাশ', 'Merchant bKash')} ({pickText('ব্যালেন্স', 'Balance')}: ৳{drawers.merchantBkash.toLocaleString()})
                </option>
                <option value="nagad">
                  {pickText('নগদ', 'Nagad')} ({pickText('ব্যালেন্স', 'Balance')}: ৳{drawers.nagad.toLocaleString()})
                </option>
                <option value="bank">
                  {pickText('ব্যাংক হিসাব', 'Bank Account')} ({pickText('ব্যালেন্স', 'Balance')}: ৳{drawers.bank.toLocaleString()})
                </option>
              </select>
            </div>

            {/* Amount */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                {pickText('টাকার পরিমাণ (৳)', 'Amount (৳)')}
              </label>
              <input
                type="number"
                required
                min={1}
                value={ownerAmount}
                onChange={(e) => setOwnerAmount(Number(e.target.value))}
                className="w-full bg-slate-50 dark:bg-zinc-950 border border-slate-300 dark:border-zinc-800 rounded-xl px-3.5 py-2.5 text-base font-bold text-slate-900 dark:text-white font-mono focus:outline-none focus:border-emerald-500"
              />
            </div>

            {/* Note / Purpose */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                {pickText('কারণ / নোট', 'Purpose / Memo')}
              </label>
              <input
                type="text"
                value={ownerNote}
                onChange={(e) => setOwnerNote(e.target.value)}
                placeholder={
                  ownerAction === 'withdraw'
                    ? pickText('যেমন: ব্যক্তিগত জরুরি প্রয়োজনে উত্তোলন', 'e.g. Personal withdrawal')
                    : pickText('যেমন: নতুন স্টক আমদানির জন্য মূলধন জমা', 'e.g. Capital investment for new stock')
                }
                className="w-full bg-slate-50 dark:bg-zinc-950 border border-slate-300 dark:border-zinc-800 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-zinc-600 focus:outline-none focus:border-emerald-500"
              />
            </div>

            {ownerFormError && (
              <div className="flex items-center gap-2 p-3 rounded-xl bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800 text-xs font-medium">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{ownerFormError}</span>
              </div>
            )}

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsOwnerModalOpen(false)}
                className="flex-1 py-2.5 rounded-xl border border-slate-300 dark:border-zinc-800 text-xs font-semibold text-slate-700 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-800 transition cursor-pointer"
              >
                {pickText('বাতিল', 'Cancel')}
              </button>
              <button
                type="submit"
                className={`flex-1 py-2.5 rounded-xl text-white text-xs font-bold transition shadow-xs cursor-pointer ${
                  ownerAction === 'withdraw'
                    ? 'bg-rose-600 hover:bg-rose-700'
                    : 'bg-emerald-600 hover:bg-emerald-700'
                }`}
              >
                {ownerAction === 'withdraw'
                  ? pickText('টাকা উত্তোলন কনফার্ম', 'Confirm Withdrawal')
                  : pickText('মূলধন জমা কনফার্ম', 'Confirm Capital Deposit')}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* COMPLETED OWNER TRANSACTION RECEIPT SLIP MODAL */}
      {completedOwnerTx && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl sm:rounded-3xl max-w-sm w-full max-h-[90dvh] overflow-y-auto p-4 sm:p-5 text-slate-900 dark:text-zinc-100 shadow-2xl space-y-4 animate-in fade-in zoom-in-95">
            <div className="text-center space-y-1">
              <div className="w-11 h-11 rounded-2xl bg-[#e6f4ea] text-[#164e3f] border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800 flex items-center justify-center mx-auto mb-2">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <h3 className="lekho-modal-title text-slate-900 dark:text-white">
                {completedOwnerTx.record.action === 'withdraw'
                  ? pickText('উত্তোলন সফল হয়েছে', 'Withdrawal Completed')
                  : pickText('মূলধন জমা সফল হয়েছে', 'Capital Deposit Completed')}
              </h3>
              <p className="text-xs text-slate-500 dark:text-zinc-400">
                {pickText(
                  'ক্যাশ ড্রয়ার এবং পার্টনার লেজারে সফলভাবে লিপিবদ্ধ করা হয়েছে',
                  'Successfully recorded in drawer balance and partner ledger'
                )}
              </p>
            </div>

            <div className="bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-2xl p-4 space-y-2.5 text-xs">
              <div className="flex justify-between text-slate-500 dark:text-zinc-400">
                <span>{pickText('পার্টনার নাম:', 'Partner Name:')}</span>
                <strong className="text-slate-900 dark:text-white">{completedOwnerTx.owner.name}</strong>
              </div>
              <div className="flex justify-between text-slate-500 dark:text-zinc-400">
                <span>{pickText('ইউজারনেম:', 'Username:')}</span>
                <span className="font-mono text-emerald-600 dark:text-emerald-400 font-semibold">@{completedOwnerTx.owner.username}</span>
              </div>
              <div className="flex justify-between text-slate-500 dark:text-zinc-400">
                <span>{pickText('ধরন:', 'Type:')}</span>
                <span className="font-bold uppercase text-slate-900 dark:text-white">
                  {completedOwnerTx.record.action === 'withdraw'
                    ? pickText('উত্তোলন', 'Withdraw')
                    : pickText('মূলধন জমা', 'Deposit')}
                </span>
              </div>
              <div className="flex justify-between text-slate-500 dark:text-zinc-400">
                <span>{pickText('ড্রয়ার:', 'Drawer:')}</span>
                <span className="font-mono text-slate-800 dark:text-zinc-200">{completedOwnerTx.record.drawer}</span>
              </div>
              <div className="flex justify-between text-slate-500 dark:text-zinc-400 border-t border-slate-200 dark:border-zinc-850 pt-2">
                <span>{pickText('টাকার পরিমাণ:', 'Amount:')}</span>
                <strong className="text-lg font-black text-emerald-600 dark:text-emerald-400 font-mono">
                  ৳{completedOwnerTx.record.amount.toLocaleString()}
                </strong>
              </div>
              <div className="flex justify-between text-slate-500 dark:text-zinc-400">
                <span>{pickText('নোট / কারণ:', 'Note / Reason:')}</span>
                <span className="text-slate-800 dark:text-zinc-200">{completedOwnerTx.record.note}</span>
              </div>
              <div className="flex justify-between text-slate-400 dark:text-zinc-500 text-[10px]">
                <span>{pickText('সময়:', 'Time:')}</span>
                <span>{new Date(completedOwnerTx.record.timestamp).toLocaleString('en-GB')}</span>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <button
                onClick={() => handleShareOwnerSlipWhatsApp(completedOwnerTx)}
                className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center justify-center gap-2 transition shadow-xs cursor-pointer"
              >
                <Share2 className="w-4 h-4" />
                {pickText('WhatsApp এ মেমো পাঠান', 'Send Memo via WhatsApp')}
              </button>

              <button
                onClick={() => setCompletedOwnerTx(null)}
                className="w-full py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-300 text-xs font-semibold cursor-pointer transition"
              >
                {pickText('বন্ধ করুন', 'Close')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Transfer Drawer Modal */}
      {isTransferModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <form
            onSubmit={handleExecuteTransfer}
            className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl sm:rounded-3xl max-w-sm w-full max-h-[90dvh] overflow-y-auto p-4 sm:p-5 text-slate-900 dark:text-zinc-100 shadow-2xl space-y-3.5 animate-in fade-in zoom-in-95"
          >
            <h3 className="lekho-modal-title text-slate-900 dark:text-white flex items-center gap-2">
              <ArrowRightLeft className="w-5 h-5 text-[#1f8a5b] dark:text-emerald-400 shrink-0" strokeWidth={1.75} />
              <span>{pickText('ড্রয়ার থেকে ড্রয়ারে ট্রান্সফার', 'Transfer Between Drawers')}</span>
            </h3>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                {pickText('উৎস ড্রয়ার (যেখান থেকে যাবে)', 'Source Drawer (From)')}
              </label>
              <select
                value={fromDrawer}
                onChange={(e) => setFromDrawer(e.target.value as DrawerType)}
                className="w-full bg-slate-50 dark:bg-zinc-950 border border-slate-300 dark:border-zinc-800 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
              >
                <option value="cash">
                  {pickText('ক্যাশ ড্রয়ার', 'Physical Cash Drawer')} (৳{drawers.cash.toLocaleString()})
                </option>
                <option value="merchantBkash">
                  {pickText('মার্চেন্ট বিকাশ', 'Merchant bKash')} (৳{drawers.merchantBkash.toLocaleString()})
                </option>
                <option value="personalBkash">
                  {pickText('পার্সোনাল বিকাশ', 'Personal bKash')} (৳{drawers.personalBkash.toLocaleString()})
                </option>
                <option value="nagad">
                  {pickText('নগদ', 'Nagad')} (৳{drawers.nagad.toLocaleString()})
                </option>
                <option value="bank">
                  {pickText('ব্যাংক হিসাব', 'Bank Account')} (৳{drawers.bank.toLocaleString()})
                </option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                {pickText('গন্তব্য ড্রয়ার (যেখানে জমা হবে)', 'Destination Drawer (To)')}
              </label>
              <select
                value={toDrawer}
                onChange={(e) => setToDrawer(e.target.value as DrawerType)}
                className="w-full bg-slate-50 dark:bg-zinc-950 border border-slate-300 dark:border-zinc-800 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
              >
                <option value="merchantBkash">{pickText('মার্চেন্ট বিকাশ', 'Merchant bKash')}</option>
                <option value="cash">{pickText('ক্যাশ ড্রয়ার', 'Physical Cash Drawer')}</option>
                <option value="personalBkash">{pickText('পার্সোনাল বিকাশ', 'Personal bKash')}</option>
                <option value="nagad">{pickText('নগদ', 'Nagad')}</option>
                <option value="bank">{pickText('ব্যাংক হিসাব', 'Bank Account')}</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                {pickText('ট্রান্সফারের পরিমাণ (৳)', 'Transfer Amount (৳)')}
              </label>
              <input
                type="number"
                required
                value={transferAmount}
                onChange={(e) => setTransferAmount(Number(e.target.value))}
                className="w-full bg-slate-50 dark:bg-zinc-950 border border-slate-300 dark:border-zinc-800 rounded-xl px-3.5 py-2 text-sm font-bold text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500 font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                {pickText('কারণ / নোট', 'Reason / Note')}
              </label>
              <input
                type="text"
                value={transferNote}
                onChange={(e) => setTransferNote(e.target.value)}
                placeholder={pickText('যেমন: ক্যাশ ব্যাংক অ্যাকাউন্টে জমা', 'e.g. Deposit cash to bank account')}
                className="w-full bg-slate-50 dark:bg-zinc-950 border border-slate-300 dark:border-zinc-800 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-zinc-600 focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsTransferModalOpen(false)}
                className="flex-1 py-2.5 rounded-xl border border-slate-300 dark:border-zinc-800 text-xs font-semibold text-slate-700 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-800 transition cursor-pointer"
              >
                {pickText('বাতিল', 'Cancel')}
              </button>
              <button
                type="submit"
                className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition shadow-xs cursor-pointer"
              >
                {pickText('ফান্ড ট্রান্সফার করুন', 'Transfer Funds')}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Compact Bottom Sheet for Drawer Transaction Details */}
      <BottomSheet
        isOpen={Boolean(detailTx)}
        onClose={() => setDetailTx(null)}
        title={
          detailTx
            ? detailTx.note || pickText('লেনদেনের বিস্তারিত', 'Transaction Details')
            : pickText('লেনদেনের বিস্তারিত', 'Transaction Details')
        }
        subtitle={detailTx ? new Date(detailTx.timestamp).toLocaleString('en-GB') : undefined}
        maxHeightClass="max-h-[45dvh]"
      >
        {detailTx && (
          <div className="space-y-2.5">
            <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 dark:bg-zinc-800/60">
              <span className="text-slate-500">{pickText('পরিমাণ', 'Amount')}</span>
              {isSalesman ? (
                <span className="font-mono text-slate-400">••••</span>
              ) : (
                <span
                  className={`font-mono font-black text-sm ${
                    detailTx.direction === 'in'
                      ? 'text-[#1f8a5b] dark:text-emerald-400'
                      : 'text-rose-600 dark:text-rose-400'
                  }`}
                >
                  {detailTx.direction === 'in' ? '+' : '-'}৳{detailTx.amount.toLocaleString()}
                </span>
              )}
            </div>
            <div className="space-y-1.5">
              <div className="flex justify-between">
                <span className="text-slate-500">{pickText('ড্রয়ার চ্যানেল', 'Drawer Channel')}</span>
                <span className="font-bold text-slate-900 dark:text-white uppercase">
                  {detailTx.drawer}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">{pickText('লেনদেনের ধরন', 'Transaction Type')}</span>
                <span className="font-semibold text-slate-800 dark:text-zinc-200 uppercase">
                  {detailTx.type.replace('_', ' ')}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">{pickText('সম্পন্নকারী', 'Performed By')}</span>
                <span className="font-semibold text-slate-800 dark:text-zinc-200">
                  {detailTx.performedBy || detailTx.salesmanName || pickText('কাউন্টার স্টাফ', 'Counter Staff')}
                </span>
              </div>
              {detailTx.referenceId && (
                <div className="flex justify-between">
                  <span className="text-slate-500">{pickText('রেফারেন্স আইডি', 'Reference ID')}</span>
                  <span className="font-mono text-slate-700 dark:text-zinc-300">
                    {detailTx.referenceId}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}
      </BottomSheet>
    </div>
  );
};
