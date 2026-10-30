import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { AlterationOrder } from '../../types';
import { dbService } from '../../services/db';
import { BottomSheet } from '../ui/BottomSheet';
import {
  Scissors,
  CheckCircle,
  Clock,
  MessageSquare,
  Plus,
  Truck,
  X,
  ChevronRight,
} from 'lucide-react';

export const AlterationTracker: React.FC = () => {
  const { currentTenant, showToast } = useApp();
  const [alterations, setAlterations] = useState<AlterationOrder[]>(() =>
    dbService.getAlterations(currentTenant.id)
  );
  const [selectedAlteration, setSelectedAlteration] = useState<AlterationOrder | null>(null);

  // New alteration modal
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [itemName, setItemName] = useState('Premium Denim Pants');
  const [size, setSize] = useState('32');
  const [tailorInstruction, setTailorInstruction] = useState('Bottom length -2 inches rope hem');
  const [tailorFee, setTailorFee] = useState<number>(60);
  const [deliveryDate, setDeliveryDate] = useState(
    new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  );

  const reload = () => {
    setAlterations(dbService.getAlterations(currentTenant.id));
  };

  const handleCreateAlteration = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerName || !customerPhone) {
      showToast('Customer name and phone required', 'error');
      return;
    }

    const newAlt: AlterationOrder = {
      id: `alt_${Date.now()}`,
      shopId: currentTenant.id,
      invoiceId: `INV-${Date.now().toString().slice(-4)}`,
      customerName: customerName.trim(),
      customerPhone: customerPhone.trim(),
      itemName: itemName.trim(),
      size: size.trim(),
      tailorInstruction: tailorInstruction.trim(),
      tailorFee: Number(tailorFee) || 0,
      deliveryDate,
      status: 'sent_to_tailor',
      createdAt: new Date().toISOString(),
    };

    dbService.addAlteration(currentTenant.id, newAlt);
    reload();
    setIsNewModalOpen(false);
    setCustomerName('');
    setCustomerPhone('');
    showToast(
      `Alteration logged for ${customerName}! Tailor fee (৳${tailorFee}) recorded in expenses.`,
      'success'
    );
  };

  const handleUpdateStatus = (altId: string, status: AlterationOrder['status']) => {
    dbService.updateAlterationStatus(currentTenant.id, altId, status);
    reload();
    showToast(`Status updated to ${status.replace('_', ' ').toUpperCase()}`, 'info');
  };

  const sendWhatsAppNotification = (alt: AlterationOrder) => {
    const phone = alt.customerPhone.replace(/[^0-9]/g, '');
    const cleanPhone = phone.startsWith('88') ? phone : `88${phone}`;

    const text = encodeURIComponent(
      `Assalamu Alaikum ${alt.customerName},\n\nYour altered garment [${alt.itemName} • Size ${alt.size}] is now READY FOR PICKUP at ${currentTenant.name}!\n\nLocation: ${currentTenant.marketMallName}, ${currentTenant.shopNo}.\nPhone: ${currentTenant.ownerPhone}\n\nThank you for choosing ${currentTenant.name}!`
    );

    window.open(`https://wa.me/${cleanPhone}?text=${text}`, '_blank');
  };

  const statusCols: {
    key: AlterationOrder['status'];
    label: string;
    labelBn: string;
    icon: any;
    badgeClass: string;
    countClass: string;
  }[] = [
    {
      key: 'sent_to_tailor',
      label: '1. At Tailor',
      labelBn: 'দর্জির কাছে প্রক্রিয়াধীন',
      icon: Clock,
      badgeClass:
        'text-amber-700 bg-amber-50 border-amber-200 dark:text-amber-300 dark:bg-amber-950/50 dark:border-amber-800',
      countClass:
        'bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800',
    },
    {
      key: 'ready_for_pickup',
      label: '2. Ready for Pickup',
      labelBn: 'ডেলিভারির জন্য প্রস্তুত',
      icon: CheckCircle,
      badgeClass:
        'text-[#1f8a5b] bg-[#e6f4ea] border-emerald-200 dark:text-emerald-300 dark:bg-emerald-950/50 dark:border-emerald-800',
      countClass:
        'bg-[#e6f4ea] text-[#1f8a5b] border border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800',
    },
    {
      key: 'handed_over',
      label: '3. Handed Over to Client',
      labelBn: 'কাস্টমারকে হস্তান্তর সম্পন্ন',
      icon: Truck,
      badgeClass:
        'text-slate-600 bg-slate-100 border-slate-200 dark:text-zinc-300 dark:bg-zinc-800 dark:border-zinc-700',
      countClass:
        'bg-slate-100 text-slate-700 border border-slate-200 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700',
    },
  ];

  return (
    <div className="space-y-5">
      {/* Header Card (Matches LEKHO Light Design System) */}
      <div className="bg-white dark:bg-zinc-900 border border-slate-200/90 dark:border-zinc-800 rounded-2xl p-3.5 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-white leading-tight">
            Alteration & Tailoring Tracker
          </h2>
          <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-[#e6f4ea] text-[#1f8a5b] border border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800">
            {alterations.length}
          </span>
        </div>

        <button
          onClick={() => setIsNewModalOpen(true)}
          className="flex items-center justify-center gap-1.5 bg-[#164e3f] hover:bg-[#123e32] text-white px-3.5 py-2 rounded-xl text-xs font-bold transition shadow-xs cursor-pointer shrink-0"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>New Alteration Ticket</span>
        </button>
      </div>

      {/* 3-Column Pipeline (Responsive: 3 columns on desktop, stacked on mobile/tablet) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-5">
        {statusCols.map((col) => {
          const colItems = alterations.filter((a) => a.status === col.key);
          const Icon = col.icon;

          return (
            <div
              key={col.key}
              className="bg-white dark:bg-zinc-900 border border-slate-200/90 dark:border-zinc-800 rounded-3xl p-4 sm:p-5 flex flex-col min-h-[380px] shadow-2xs"
            >
              <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-100 dark:border-zinc-800">
                <div className="flex items-center gap-2">
                  <div className={`p-1.5 rounded-lg border ${col.badgeClass}`}>
                    <Icon className="w-3.5 h-3.5" />
                  </div>
                  <h3 className="text-xs font-extrabold text-slate-900 dark:text-white uppercase tracking-wider">
                    {col.label}
                  </h3>
                </div>
                <span className={`text-xs font-mono font-bold px-2.5 py-0.5 rounded-full ${col.countClass}`}>
                  {colItems.length}
                </span>
              </div>

              <div className="space-y-3 flex-1 overflow-y-auto">
                {colItems.length === 0 ? (
                  <div className="h-36 flex flex-col items-center justify-center text-xs text-slate-400 dark:text-zinc-500 border border-dashed border-slate-200 dark:border-zinc-800 rounded-2xl bg-[#f4f7f5]/50 dark:bg-zinc-950/50 p-4 text-center">
                    <span>No items in this stage</span>
                  </div>
                ) : (
                  colItems.map((alt) => (
                    <div
                      key={alt.id}
                      onClick={() => setSelectedAlteration(alt)}
                      className="bg-[#f4f7f5] dark:bg-zinc-950 border border-slate-200/80 dark:border-zinc-800 rounded-2xl p-3 space-y-2 hover:border-emerald-300 dark:hover:border-emerald-800/60 transition cursor-pointer"
                    >
                      <div className="flex justify-between items-start gap-2">
                        <div className="min-w-0">
                          <div className="text-xs font-bold text-slate-900 dark:text-white truncate">
                            {alt.customerName}
                          </div>
                          <div className="text-[11px] text-slate-500 dark:text-zinc-400 truncate mt-0.5">
                            {alt.itemName} ({alt.size}) • Due {alt.deliveryDate}
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <span className="text-[10px] font-mono font-bold text-slate-700 dark:text-zinc-300">
                            ৳{alt.tailorFee}
                          </span>
                          <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                        </div>
                      </div>

                      {/* Quick Action buttons */}
                      <div
                        className="flex items-center justify-between pt-1.5 border-t border-slate-200/60 dark:border-zinc-800 gap-2"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <span className="text-[10px] text-slate-500 truncate italic">
                          {alt.tailorInstruction}
                        </span>

                        {col.key === 'sent_to_tailor' && (
                          <button
                            onClick={() => handleUpdateStatus(alt.id, 'ready_for_pickup')}
                            className="shrink-0 px-2.5 py-1 bg-[#164e3f] hover:bg-[#123e32] text-white rounded-xl text-[10px] font-bold transition cursor-pointer"
                          >
                            Mark Ready
                          </button>
                        )}

                        {col.key === 'ready_for_pickup' && (
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              onClick={() => sendWhatsAppNotification(alt)}
                              className="p-1.5 bg-[#e6f4ea] text-[#1f8a5b] rounded-lg cursor-pointer"
                              title="WhatsApp Alert"
                            >
                              <MessageSquare className="w-3 h-3" />
                            </button>
                            <button
                              onClick={() => handleUpdateStatus(alt.id, 'handed_over')}
                              className="px-2.5 py-1 bg-white dark:bg-zinc-800 text-slate-700 dark:text-zinc-200 border border-slate-200 dark:border-zinc-700 rounded-xl text-[10px] font-bold transition cursor-pointer"
                            >
                              Hand Over
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* New Alteration Modal (Matches LEKHO Light Design System) */}
      {isNewModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 dark:bg-black/75 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
          <form
            onSubmit={handleCreateAlteration}
            className="bg-white dark:bg-zinc-900 border border-slate-200/90 dark:border-zinc-800 rounded-3xl max-w-md w-full p-5 sm:p-6 text-slate-900 dark:text-zinc-100 shadow-2xl space-y-4"
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-zinc-800">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-[#e6f4ea] dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800/60 flex items-center justify-center text-[#1f8a5b] dark:text-emerald-400">
                  <Scissors className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
                    New Trial Room Alteration Ticket
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-zinc-400">
                    ফিটিং, লেন্থ অল্টার ও দর্জি চার্জ এন্ট্রি করুন
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsNewModalOpen(false)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-zinc-800 transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-zinc-300 mb-1">
                  Customer Name *
                </label>
                <input
                  type="text"
                  required
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="e.g. Asif Mahmud"
                  className="w-full bg-[#f4f7f5] dark:bg-zinc-950 border border-slate-200/80 dark:border-zinc-800 rounded-2xl px-3.5 py-2 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-[#164e3f]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-zinc-300 mb-1">
                  WhatsApp Phone *
                </label>
                <input
                  type="text"
                  required
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  placeholder="017..."
                  className="w-full bg-[#f4f7f5] dark:bg-zinc-950 border border-slate-200/80 dark:border-zinc-800 rounded-2xl px-3.5 py-2 text-xs font-mono text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-[#164e3f]"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2">
                <label className="block text-xs font-semibold text-slate-600 dark:text-zinc-300 mb-1">
                  Garment Item *
                </label>
                <input
                  type="text"
                  required
                  value={itemName}
                  onChange={(e) => setItemName(e.target.value)}
                  className="w-full bg-[#f4f7f5] dark:bg-zinc-950 border border-slate-200/80 dark:border-zinc-800 rounded-2xl px-3.5 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-[#164e3f]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-zinc-300 mb-1">
                  Size
                </label>
                <input
                  type="text"
                  value={size}
                  onChange={(e) => setSize(e.target.value)}
                  className="w-full bg-[#f4f7f5] dark:bg-zinc-950 border border-slate-200/80 dark:border-zinc-800 rounded-2xl px-3 py-2 text-xs font-mono font-bold text-slate-900 dark:text-white text-center focus:outline-none focus:border-[#164e3f]"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-zinc-300 mb-1">
                Tailor Fitting Instruction *
              </label>
              <textarea
                required
                rows={2}
                value={tailorInstruction}
                onChange={(e) => setTailorInstruction(e.target.value)}
                placeholder="e.g. Length -2.5 inches, keep original roping hem stitch"
                className="w-full bg-[#f4f7f5] dark:bg-zinc-950 border border-slate-200/80 dark:border-zinc-800 rounded-2xl p-3 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-[#164e3f] resize-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-zinc-300 mb-1">
                  Tailor Fee (৳)
                </label>
                <input
                  type="number"
                  value={tailorFee}
                  onChange={(e) => setTailorFee(Number(e.target.value))}
                  className="w-full bg-[#f4f7f5] dark:bg-zinc-950 border border-slate-200/80 dark:border-zinc-800 rounded-2xl px-3.5 py-2 text-xs font-mono font-bold text-[#1f8a5b] dark:text-emerald-400 focus:outline-none focus:border-[#164e3f]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-zinc-300 mb-1">
                  Delivery Date
                </label>
                <input
                  type="date"
                  value={deliveryDate}
                  onChange={(e) => setDeliveryDate(e.target.value)}
                  className="w-full bg-[#f4f7f5] dark:bg-zinc-950 border border-slate-200/80 dark:border-zinc-800 rounded-2xl px-3.5 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-[#164e3f]"
                />
              </div>
            </div>

            <div className="flex gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setIsNewModalOpen(false)}
                className="flex-1 py-2.5 rounded-2xl border border-slate-200/90 dark:border-zinc-700 text-xs font-semibold text-slate-600 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-800 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="flex-1 py-2.5 rounded-2xl bg-[#164e3f] hover:bg-[#123e32] text-white text-xs font-bold transition shadow-xs cursor-pointer"
              >
                Save Ticket
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Compact Bottom Sheet for Alteration Ticket Details */}
      <BottomSheet
        isOpen={Boolean(selectedAlteration)}
        onClose={() => setSelectedAlteration(null)}
        title={selectedAlteration ? `${selectedAlteration.customerName} — ${selectedAlteration.itemName}` : 'Alteration Ticket'}
        subtitle={selectedAlteration ? `Ticket #${selectedAlteration.invoiceId} • Size ${selectedAlteration.size}` : undefined}
        maxHeightClass="max-h-[45dvh]"
        footer={
          selectedAlteration ? (
            <div className="flex items-center gap-2">
              {selectedAlteration.status === 'sent_to_tailor' && (
                <button
                  type="button"
                  onClick={() => {
                    handleUpdateStatus(selectedAlteration.id, 'ready_for_pickup');
                    setSelectedAlteration(null);
                  }}
                  className="flex-1 py-2 px-3 rounded-xl bg-[#164e3f] text-white font-bold text-xs cursor-pointer"
                >
                  Mark Ready for Pickup
                </button>
              )}
              {selectedAlteration.status === 'ready_for_pickup' && (
                <>
                  <button
                    type="button"
                    onClick={() => sendWhatsAppNotification(selectedAlteration)}
                    className="flex-1 py-2 px-3 rounded-xl bg-emerald-50 text-[#1f8a5b] font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                    <span>WhatsApp Ready Alert</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      handleUpdateStatus(selectedAlteration.id, 'handed_over');
                      setSelectedAlteration(null);
                    }}
                    className="flex-1 py-2 px-3 rounded-xl bg-[#164e3f] text-white font-bold text-xs cursor-pointer"
                  >
                    Mark Handed Over
                  </button>
                </>
              )}
            </div>
          ) : undefined
        }
      >
        {selectedAlteration && (
          <div className="space-y-2.5">
            <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-zinc-800/60">
              <div className="text-[10px] text-slate-400">Tailor Instruction</div>
              <div className="font-bold text-slate-900 dark:text-white mt-0.5">
                {selectedAlteration.tailorInstruction}
              </div>
            </div>
            <div className="space-y-1.5">
              <div className="flex justify-between">
                <span className="text-slate-500">Customer Phone</span>
                <span className="font-mono font-bold text-slate-900 dark:text-white">
                  {selectedAlteration.customerPhone}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Delivery Date</span>
                <span className="font-mono font-semibold text-slate-800 dark:text-zinc-200">
                  {selectedAlteration.deliveryDate}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Tailor Fee</span>
                <span className="font-mono font-bold text-[#1f8a5b]">
                  ৳{selectedAlteration.tailorFee}
                </span>
              </div>
            </div>
          </div>
        )}
      </BottomSheet>
    </div>
  );
};
