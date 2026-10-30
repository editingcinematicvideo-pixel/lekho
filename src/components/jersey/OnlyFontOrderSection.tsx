import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { dbService } from '../../services/db';
import { StandaloneFontOrder } from '../../types';
import {
  Sparkles,
  PlusCircle,
  Copy,
  Check,
  Trash2,
  Search,
  MessageSquare,
  Clock,
  CheckCircle,
  Tag,
  Flame,
  FileText,
  Calendar,
  Layers,
} from 'lucide-react';

export const OnlyFontOrderSection: React.FC = () => {
  const { currentTenant, showToast } = useApp();
  const [orders, setOrders] = useState<StandaloneFontOrder[]>(() =>
    dbService.getFontOrders(currentTenant.id)
  );

  // Form states
  const [teamOrKit, setTeamOrKit] = useState('Brasil Home 2026');
  const [colorOrVersion, setColorOrVersion] = useState('Green');
  const [customName, setCustomName] = useState('NEYMAR JR');
  const [customNumber, setCustomNumber] = useState('10');
  const [fontStyle, setFontStyle] = useState('Official Cut Vinyl');
  const [badgeOrPatch, setBadgeOrPatch] = useState('None');
  const [quantity, setQuantity] = useState<number>(5);
  const [unitPrice, setUnitPrice] = useState<number>(200);
  const [unitCostPrice, setUnitCostPrice] = useState<number>(80);
  const [customerName, setCustomerName] = useState('দোকানের কাউন্টার স্টক');
  const [notes, setNotes] = useState('');
  const [copiedOrderId, setCopiedOrderId] = useState<string | null>(null);

  // Search & filter
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'printed'>('all');

  const reload = () => {
    setOrders(dbService.getFontOrders(currentTenant.id));
  };

  // Formatted Preview string (Exact format: "brasil home 2026 green neymar jr 10")
  const formatFontLine = (ord: {
    teamOrKit: string;
    colorOrVersion: string;
    customName: string;
    customNumber: string;
    quantity: number;
    badgeOrPatch?: string;
  }) => {
    let line = `${ord.teamOrKit} ${ord.colorOrVersion} ${ord.customName} ${ord.customNumber}`
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .trim();

    line += ` [Qty: ${ord.quantity}]`;
    if (ord.badgeOrPatch && ord.badgeOrPatch !== 'None') {
      line += ` [patch: ${ord.badgeOrPatch}]`;
    }
    return line;
  };

  const currentPreviewLine = formatFontLine({
    teamOrKit,
    colorOrVersion,
    customName,
    customNumber,
    quantity,
    badgeOrPatch,
  });

  const handleAddFontOrder = (e: React.FormEvent) => {
    e.preventDefault();

    if (!teamOrKit.trim() || !customName.trim() || !customNumber.trim()) {
      showToast('টিম, নাম এবং নাম্বার সঠিকভাবে পূরণ করুন', 'warning');
      return;
    }

    if (quantity <= 0) {
      showToast('পরিমাণ (Quantity) কমপক্ষে ১ হতে হবে', 'warning');
      return;
    }

    const newOrder: StandaloneFontOrder = {
      id: `font_ord_${Date.now()}`,
      shopId: currentTenant.id,
      teamOrKit: teamOrKit.trim(),
      colorOrVersion: colorOrVersion.trim(),
      customName: customName.toUpperCase().trim(),
      customNumber: customNumber.trim(),
      fontStyle,
      badgeOrPatch,
      quantity,
      unitPrice,
      unitCostPrice,
      notes,
      status: 'pending',
      customerName: customerName || 'Shop Counter Stock',
      createdAt: new Date().toISOString(),
    };

    dbService.addFontOrder(currentTenant.id, newOrder);
    reload();
    showToast(`ফন্ট অর্ডার যুক্ত হয়েছে: ${currentPreviewLine}`, 'success');
    setNotes('');
  };

  const handleCopyOrderText = async (order: StandaloneFontOrder) => {
    const text = formatFontLine(order);
    try {
      await navigator.clipboard.writeText(text);
      setCopiedOrderId(order.id);
      showToast(`কপি হয়েছে: "${text}"`, 'success');
      setTimeout(() => setCopiedOrderId(null), 2000);
    } catch {
      showToast('Clipboard error', 'error');
    }
  };

  const handleToggleStatus = (order: StandaloneFontOrder) => {
    const nextStatus = order.status === 'pending' ? 'printed' : 'pending';
    dbService.updateFontOrderStatus(currentTenant.id, order.id, nextStatus);
    reload();
    showToast(`স্ট্যাটাস পরিবর্তন: ${nextStatus.toUpperCase()}`, 'info');
  };

  const handleDelete = (id: string) => {
    if (confirm('আপনি কি এই ফন্ট অর্ডার মুছে ফেলতে চান?')) {
      dbService.deleteFontOrder(currentTenant.id, id);
      reload();
      showToast('ফন্ট অর্ডার মুছে ফেলা হয়েছে', 'info');
    }
  };

  const handleSendWhatsAppManifest = () => {
    const pending = orders.filter((o) => o.status === 'pending');
    if (pending.length === 0) {
      showToast('কোনো পেন্ডিং ফন্ট অর্ডার পাওয়া যায়নি', 'warning');
      return;
    }

    const lines = pending.map((o) => formatFontLine(o)).join('\n');
    const msg = `*${currentTenant.name} - DTF Font Order Manifest*\nতারিখ: ${new Date().toLocaleDateString('en-GB')}\nমোট: ${pending.length} টি ফন্ট\n\n${lines}\n\nদ্রুত প্রিন্ট ও কাটিং করে কাউন্টারে ডেলিভারি দেওয়ার অনুরোধ রইল। ধন্যবাদ!`;

    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
  };

  const filteredOrders = orders.filter((o) => {
    if (statusFilter !== 'all' && o.status !== statusFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const match =
        o.teamOrKit.toLowerCase().includes(q) ||
        o.customName.toLowerCase().includes(q) ||
        o.customNumber.includes(q) ||
        o.fontStyle.toLowerCase().includes(q);
      if (!match) return false;
    }
    return true;
  });

  return (
    <div className="space-y-4 animate-in fade-in duration-150">
      {/* Top Banner (Unified Emerald Theme) */}
      <div className="bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/60 p-4 sm:p-5 rounded-3xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-black text-sm shadow-xs">
              Aa
            </span>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              শুধু ফন্ট অর্ডার (Standalone Name & Number Orders)
            </h3>
          </div>
          <p className="text-xs text-slate-600 dark:text-zinc-400 mt-1">
            জার্সি ছাড়া শুধুমাত্র কাস্টম নাম, নম্বর ও ব্যাজ ফন্ট প্রিন্ট/প্লটার অর্ডার এন্ট্রি ও পরিমাণ (Quantity) ট্র্যাকিং
          </p>
        </div>

        <button
          onClick={handleSendWhatsAppManifest}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs transition cursor-pointer self-start sm:self-auto"
        >
          <MessageSquare className="w-4 h-4" />
          <span>পেন্ডিং ফন্ট WhatsApp-এ পাঠান</span>
        </button>
      </div>

      {/* Entry Form (Matches Demo Image 2) */}
      <form onSubmit={handleAddFontOrder} className="bg-white dark:bg-zinc-900 border border-slate-200/90 dark:border-zinc-800 rounded-3xl p-4 sm:p-6 space-y-4 shadow-2xs">
        {/* Team / kit */}
        <div>
          <label className="block text-xs font-semibold text-slate-600 dark:text-zinc-400 mb-1.5">
            Team / kit
          </label>
          <input
            type="text"
            value={teamOrKit}
            onChange={(e) => setTeamOrKit(e.target.value)}
            placeholder="Brasil Home 2026"
            className="w-full bg-[#f4f7f5] dark:bg-zinc-800/80 border border-slate-200/80 dark:border-zinc-700 rounded-2xl px-4 py-3 text-sm font-semibold text-slate-900 dark:text-white focus:outline-none focus:border-[#284f3e]"
            required
          />
        </div>

        {/* Color and Quantity */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-600 dark:text-zinc-400 mb-1.5">
              Color
            </label>
            <input
              type="text"
              value={colorOrVersion}
              onChange={(e) => setColorOrVersion(e.target.value)}
              placeholder="Green"
              className="w-full bg-[#f4f7f5] dark:bg-zinc-800/80 border border-slate-200/80 dark:border-zinc-700 rounded-2xl px-4 py-3 text-sm font-semibold text-slate-900 dark:text-white focus:outline-none focus:border-[#284f3e]"
              required
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 dark:text-zinc-400 mb-1.5">
              Quantity
            </label>
            <input
              type="number"
              min={1}
              value={quantity}
              onChange={(e) => setQuantity(Number(e.target.value))}
              placeholder="5"
              className="w-full bg-[#f4f7f5] dark:bg-zinc-800/80 border border-slate-200/80 dark:border-zinc-700 rounded-2xl px-4 py-3 text-sm font-semibold text-slate-900 dark:text-white focus:outline-none focus:border-[#284f3e]"
              required
            />
          </div>
        </div>

        {/* Name and Number */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-600 dark:text-zinc-400 mb-1.5">
              Name
            </label>
            <input
              type="text"
              value={customName}
              onChange={(e) => setCustomName(e.target.value)}
              placeholder="NEYMAR JR"
              className="w-full bg-[#f4f7f5] dark:bg-zinc-800/80 border border-slate-200/80 dark:border-zinc-700 rounded-2xl px-4 py-3 text-sm font-bold uppercase text-slate-900 dark:text-white focus:outline-none focus:border-[#284f3e]"
              required
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 dark:text-zinc-400 mb-1.5">
              Number
            </label>
            <input
              type="text"
              value={customNumber}
              onChange={(e) => setCustomNumber(e.target.value)}
              placeholder="10"
              className="w-full bg-[#f4f7f5] dark:bg-zinc-800/80 border border-slate-200/80 dark:border-zinc-700 rounded-2xl px-4 py-3 text-sm font-bold text-slate-900 dark:text-white focus:outline-none focus:border-[#284f3e]"
              required
            />
          </div>
        </div>

        {/* Font style and Badge / patch */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-600 dark:text-zinc-400 mb-1.5">
              Font style
            </label>
            <select
              value={fontStyle}
              onChange={(e) => setFontStyle(e.target.value)}
              className="w-full bg-[#f4f7f5] dark:bg-zinc-800/80 border border-slate-200/80 dark:border-zinc-700 rounded-2xl px-4 py-3 text-xs sm:text-sm font-semibold text-slate-900 dark:text-white focus:outline-none focus:border-[#284f3e] cursor-pointer"
            >
              <option value="Official Cut Vinyl">Official Cut Vinyl</option>
              <option value="La Liga Official Cut">La Liga Official Cut</option>
              <option value="Premier League Font">Premier League Font</option>
              <option value="UCL Official Font">UCL Official Font</option>
              <option value="Retro Classic Block">Retro Classic Block</option>
              <option value="DTF Multi-Color Plotter">DTF Multi-Color Plotter</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 dark:text-zinc-400 mb-1.5">
              Badge / patch
            </label>
            <select
              value={badgeOrPatch}
              onChange={(e) => setBadgeOrPatch(e.target.value)}
              className="w-full bg-[#f4f7f5] dark:bg-zinc-800/80 border border-slate-200/80 dark:border-zinc-700 rounded-2xl px-4 py-3 text-xs sm:text-sm font-semibold text-slate-900 dark:text-white focus:outline-none focus:border-[#284f3e] cursor-pointer"
            >
              <option value="None">None</option>
              <option value="World Cup Champions">World Cup Champions</option>
              <option value="UCL 15 Badges">UCL 15 Badges</option>
              <option value="Premier League Gold">Premier League Gold</option>
              <option value="La Liga Champions">La Liga Champions</option>
              <option value="Serie A Scudetto">Serie A Scudetto</option>
            </select>
          </div>
        </div>

        {/* Live formatted string note */}
        <div className="text-[11px] text-slate-500 dark:text-zinc-400 font-mono pt-1">
          অর্ডার ফরম্যাট: <span className="font-bold text-[#284f3e] dark:text-emerald-400">{currentPreviewLine}</span>
        </div>

        {/* Submit Button (Deep Pine Green) */}
        <button
          type="submit"
          className="w-full bg-[#284f3e] hover:bg-[#1f3f31] text-white py-3.5 rounded-2xl font-bold text-sm shadow-md transition cursor-pointer flex items-center justify-center gap-2"
        >
          <MessageSquare className="w-4 h-4" />
          <span>Send on WhatsApp</span>
        </button>
      </form>

      {/* Filter and Table List */}
      <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-3xl p-4 sm:p-5 space-y-3 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <h4 className="text-sm font-bold text-slate-900 dark:text-white">ফন্ট অর্ডার তালিকা ({filteredOrders.length})</h4>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="সার্চ করুন..."
                className="bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl pl-8 pr-3 py-1.5 text-xs text-slate-900 dark:text-white focus:outline-none w-44"
              />
            </div>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl px-2.5 py-1.5 text-xs text-slate-700 dark:text-zinc-300 focus:outline-none"
            >
              <option value="all">সকল স্ট্যাটাস</option>
              <option value="pending">অপেক্ষমান (Pending)</option>
              <option value="printed">প্রিন্ট সম্পন্ন (Printed)</option>
            </select>
          </div>
        </div>

        {/* Orders Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-zinc-950 text-slate-600 dark:text-zinc-400 border-b border-slate-200 dark:border-zinc-800 font-semibold select-none">
              <tr>
                <th className="py-2.5 px-3">ফন্ট প্রিভিউ স্ট্রিং</th>
                <th className="py-2.5 px-3">টিম ও কালার</th>
                <th className="py-2.5 px-3">নাম ও নম্বর</th>
                <th className="py-2.5 px-3 text-center">পরিমাণ (Qty)</th>
                <th className="py-2.5 px-3">ফন্ট স্টাইল</th>
                <th className="py-2.5 px-3 text-right">মোট দাম</th>
                <th className="py-2.5 px-3 text-center">স্ট্যাটাস</th>
                <th className="py-2.5 px-3 text-center">অ্যাকশন</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-zinc-800/60 font-mono">
              {filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-400 dark:text-zinc-500 font-sans">
                    কোনো ফন্ট অর্ডার পাওয়া যায়নি।
                  </td>
                </tr>
              ) : (
                filteredOrders.map((ord) => {
                  const lineStr = formatFontLine(ord);
                  return (
                    <tr key={ord.id} className="hover:bg-slate-50/70 dark:hover:bg-zinc-850/40 transition">
                      <td className="py-3 px-3 font-mono text-emerald-700 dark:text-emerald-400 font-bold max-w-xs truncate">
                        {lineStr}
                      </td>
                      <td className="py-3 px-3 font-sans text-slate-800 dark:text-zinc-300">
                        <div>{ord.teamOrKit}</div>
                        <span className="text-[10px] text-slate-400 dark:text-zinc-500">{ord.colorOrVersion}</span>
                      </td>
                      <td className="py-3 px-3">
                        <span className="font-bold text-slate-900 dark:text-white font-sans">{ord.customName}</span>{' '}
                        <strong className="text-emerald-700 dark:text-emerald-400">#{ord.customNumber}</strong>
                      </td>
                      <td className="py-3 px-3 text-center">
                        <span className="px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 font-bold text-xs">
                          {ord.quantity} pcs
                        </span>
                      </td>
                      <td className="py-3 px-3 font-sans text-slate-500 dark:text-zinc-400 text-[11px]">
                        {ord.fontStyle}
                      </td>
                      <td className="py-3 px-3 text-right font-bold text-slate-900 dark:text-zinc-200">
                        ৳{(ord.quantity * ord.unitPrice).toLocaleString()}
                      </td>
                      <td className="py-3 px-3 text-center font-sans">
                        <button
                          type="button"
                          onClick={() => handleToggleStatus(ord)}
                          className={`px-2.5 py-1 rounded-full text-[10px] font-bold cursor-pointer transition ${
                            ord.status === 'printed'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-300 dark:bg-emerald-950 dark:text-emerald-400 dark:border-emerald-800'
                              : 'bg-amber-50 text-amber-700 border border-amber-300 dark:bg-amber-950 dark:text-amber-400 dark:border-amber-800'
                          }`}
                        >
                          {ord.status === 'printed' ? '✓ Printed' : 'Pending'}
                        </button>
                      </td>
                      <td className="py-3 px-3">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleCopyOrderText(ord)}
                            className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-300 transition cursor-pointer"
                            title="ক্লিপবোর্ডে কপি করুন"
                          >
                            {copiedOrderId === ord.id ? (
                              <Check className="w-3.5 h-3.5 text-emerald-600" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>

                          <button
                            type="button"
                            onClick={() => handleDelete(ord.id)}
                            className="p-1.5 rounded-lg bg-slate-100 hover:bg-rose-50 dark:bg-zinc-800 dark:hover:bg-rose-950 text-slate-400 hover:text-rose-600 transition cursor-pointer"
                            title="মুছে ফেলুন"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
