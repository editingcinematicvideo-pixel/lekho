import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { Invoice } from '../../types';
import { dbService } from '../../services/db';
import { getActiveSplitEntries, formatSplitSummaryText } from '../../utils/posOperations';
import {
  Printer,
  MessageSquare,
  Clock,
  Edit3,
  Trash2,
  X,
  CheckCircle,
  QrCode,
  ShieldAlert,
  ArrowRight,
  Store,
} from 'lucide-react';

interface ReceiptModalProps {
  isOpen: boolean;
  onClose: () => void;
  invoice: Invoice | null;
  onInvoiceUpdated?: () => void;
}

export const ReceiptModal: React.FC<ReceiptModalProps> = ({
  isOpen,
  onClose,
  invoice,
  onInvoiceUpdated,
}) => {
  const { currentTenant, role, verifyOwnerPin, showToast } = useApp();
  const [isEditing, setIsEditing] = useState(false);
  const [editCustomerName, setEditCustomerName] = useState('');
  const [editCustomerPhone, setEditCustomerPhone] = useState('');
  const [editTotal, setEditTotal] = useState<number>(0);
  const [ownerPin, setOwnerPin] = useState('');
  const [requiresOwnerPin, setRequiresOwnerPin] = useState(false);
  const [minutesRemaining, setMinutesRemaining] = useState<number>(15);

  useEffect(() => {
    if (invoice) {
      setEditCustomerName(invoice.customerName);
      setEditCustomerPhone(invoice.customerPhone);
      setEditTotal(invoice.total);

      // Calculate 15-minute window
      const createdTime = new Date(invoice.createdAt).getTime();
      const elapsedMins = (Date.now() - createdTime) / (1000 * 60);
      const remaining = Math.max(0, Math.round(15 - elapsedMins));
      setMinutesRemaining(remaining);
      setRequiresOwnerPin(elapsedMins > 15);
    }
  }, [invoice]);

  if (!isOpen || !invoice) return null;

  const handleSendWhatsApp = () => {
    const phone = invoice.customerPhone.replace(/[^0-9]/g, '');
    const cleanPhone = phone.startsWith('88') ? phone : `88${phone}`;

    const itemsSummary = invoice.items
      .map((i) => `• ${i.title} (${i.size}) x${i.quantity} = ৳${i.subtotal}`)
      .join('\n');

    const splitLine =
      invoice.paymentChannel === 'split' && invoice.splitBreakdown
        ? `Split Breakdown: ${formatSplitSummaryText(invoice.splitBreakdown)}\n`
        : '';

    const text = encodeURIComponent(
      `*${currentTenant.name}*\n` +
      `Digital Sales Receipt\n` +
      `Invoice: #${invoice.invoiceNo}\n` +
      `Date: ${new Date(invoice.createdAt).toLocaleString()}\n` +
      `Market: ${currentTenant.marketMallName}, ${currentTenant.shopNo}\n\n` +
      `*Items:*\n${itemsSummary}\n\n` +
      `Total: ৳${invoice.total}\n` +
      `Paid: ৳${invoice.advancePaid} (${invoice.paymentChannel.toUpperCase()})\n` +
      splitLine +
      (invoice.dueAmount > 0 ? `*DUE BALANCE: ৳${invoice.dueAmount}*\n` : `Status: FULLY PAID\n`) +
      `Salesman: ${invoice.salesmanName}\n\n` +
      `Policy: ${currentTenant.returnPolicy}\n` +
      `Thank you for shopping with us!`
    );

    window.open(`https://wa.me/${cleanPhone}?text=${text}`, '_blank');
  };

  const handleSaveCorrection = (e: React.FormEvent) => {
    e.preventDefault();

    if (requiresOwnerPin && role !== 'shop_owner') {
      if (!verifyOwnerPin(ownerPin)) {
        showToast('Safe 15-min window expired. Valid Owner PIN is required to edit past invoices.', 'error');
        return;
      }
    }

    const updates: Partial<Invoice> = {
      customerName: editCustomerName.trim(),
      customerPhone: editCustomerPhone.trim(),
      total: Number(editTotal),
      subtotal: Number(editTotal) + invoice.discount,
      advancePaid: invoice.paymentMode === 'paid' ? Number(editTotal) : invoice.advancePaid,
      dueAmount: invoice.paymentMode === 'partial' ? Math.max(0, Number(editTotal) - invoice.advancePaid) : 0,
      notes: `Corrected at ${new Date().toLocaleTimeString()} by ${role === 'shop_owner' ? 'Owner' : 'Salesman'}`,
    };

    dbService.updateInvoice(currentTenant.id, invoice.id, updates);
    showToast('Invoice corrected successfully!', 'success');
    setIsEditing(false);
    if (onInvoiceUpdated) onInvoiceUpdated();
  };

  const handleSoftDelete = () => {
    if (requiresOwnerPin && role !== 'shop_owner') {
      if (!verifyOwnerPin(ownerPin)) {
        showToast('Owner PIN required to void invoice after 15 minutes', 'error');
        return;
      }
    }

    dbService.softDeleteInvoice(currentTenant.id, invoice.id);
    showToast('Invoice moved to 30-day Trash Bin', 'info');
    if (onInvoiceUpdated) onInvoiceUpdated();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 dark:bg-black/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-150">
      <div className="bg-white dark:bg-zinc-900 border border-slate-200/90 dark:border-zinc-800 rounded-2xl sm:rounded-3xl max-w-md w-full max-h-[90dvh] flex flex-col overflow-hidden p-4 sm:p-5 shadow-2xl text-slate-900 dark:text-zinc-100 relative">
        {/* Top Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-zinc-800 shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <CheckCircle className="w-5 h-5 text-[#1f8a5b] dark:text-emerald-400 shrink-0" />
            <h3 className="lekho-modal-title text-slate-900 dark:text-white truncate">
              Digital Memo & Thermal Slip
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-white rounded-xl hover:bg-slate-100 dark:hover:bg-zinc-800 cursor-pointer shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="overflow-y-auto flex-1 pr-0.5">
          {/* 15-Minute Safe Window Badge */}
          <div className="mt-3">
            {minutesRemaining > 0 ? (
              <div className="flex items-center justify-between bg-[#e6f4ea] dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 px-3 py-1.5 rounded-xl text-[11px] text-[#1f8a5b] dark:text-emerald-400 font-semibold">
                <span className="flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5" />
                  15-Min Safe Correction Window:
                </span>
                <strong className="font-mono">{minutesRemaining} min left</strong>
              </div>
            ) : (
              <div className="flex items-center justify-between bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 px-3 py-1.5 rounded-xl text-[11px] text-amber-700 dark:text-amber-400 font-semibold">
                <span className="flex items-center gap-1.5">
                  <ShieldAlert className="w-3.5 h-3.5" />
                  15-Min Safe Window Expired:
                </span>
                <span>Owner PIN needed for edit/void</span>
              </div>
            )}
          </div>

          {/* Edit Form or Printable Receipt */}
          {isEditing ? (
            <form onSubmit={handleSaveCorrection} className="mt-4 space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-zinc-300 mb-1">
                  Customer Name
                </label>
                <input
                  type="text"
                  value={editCustomerName}
                  onChange={(e) => setEditCustomerName(e.target.value)}
                  className="w-full bg-[#f4f7f5] dark:bg-zinc-950 border border-slate-200/80 dark:border-zinc-800 rounded-2xl px-3.5 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-[#164e3f]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-zinc-300 mb-1">
                  WhatsApp Phone
                </label>
                <input
                  type="text"
                  value={editCustomerPhone}
                  onChange={(e) => setEditCustomerPhone(e.target.value)}
                  className="w-full bg-[#f4f7f5] dark:bg-zinc-950 border border-slate-200/80 dark:border-zinc-800 rounded-2xl px-3.5 py-2 text-xs font-mono text-slate-900 dark:text-white focus:outline-none focus:border-[#164e3f]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-zinc-300 mb-1">
                  Total Amount (৳)
                </label>
                <input
                  type="number"
                  value={editTotal}
                  onChange={(e) => setEditTotal(Number(e.target.value))}
                  className="w-full bg-[#f4f7f5] dark:bg-zinc-950 border border-slate-200/80 dark:border-zinc-800 rounded-2xl px-3.5 py-2 text-sm font-mono font-bold text-[#1f8a5b] dark:text-emerald-400 focus:outline-none focus:border-[#164e3f]"
                />
              </div>

              {requiresOwnerPin && role !== 'shop_owner' && (
                <div>
                  <label className="block text-xs font-semibold text-amber-700 dark:text-amber-400 mb-1">
                    Owner PIN Authorization
                  </label>
                  <input
                    type="password"
                    maxLength={4}
                    required
                    value={ownerPin}
                    onChange={(e) => setOwnerPin(e.target.value)}
                    placeholder="••••"
                    className="w-full bg-[#f4f7f5] dark:bg-zinc-950 border border-slate-200/80 dark:border-zinc-800 rounded-2xl px-3.5 py-2 text-center font-mono text-slate-900 dark:text-white focus:outline-none focus:border-[#164e3f]"
                  />
                </div>
              )}

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="flex-1 py-2.5 rounded-2xl border border-slate-200/90 dark:border-zinc-750 text-xs font-semibold text-slate-600 dark:text-zinc-400 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-2xl bg-[#164e3f] hover:bg-[#123e32] text-white text-xs font-bold transition shadow-xs cursor-pointer"
                >
                  Save Correction
                </button>
              </div>
            </form>
          ) : (
            /* Thermal Slip & Digital Card */
            <div className="mt-3 flex justify-center">
              {(() => {
                const paperWidth = currentTenant.invoiceSettings?.paperWidth || currentTenant.paymentSettings?.paperWidth || '80mm';
                const customPaperWidth = currentTenant.invoiceSettings?.customPaperWidth || currentTenant.paymentSettings?.customPaperWidth || 76;
                const maxSlipWidth = paperWidth === '58mm' ? '280px' : paperWidth === 'custom' ? `${Math.max(220, Math.min(480, customPaperWidth * 3.8))}px` : '340px';

                return (
                  <div
                    id="printable-receipt"
                    style={{ maxWidth: maxSlipWidth }}
                    className="bg-white text-zinc-900 p-4 rounded-2xl shadow-2xs border border-slate-200 space-y-3 font-mono text-xs w-full transition-all"
                  >
                    {/* Shop Branding Header */}
                    <div className="text-center pb-2 border-b-2 border-dashed border-zinc-400 space-y-0.5">
                      <h2 className="text-sm font-black uppercase tracking-tight">{currentTenant.name}</h2>
                      {currentTenant.bengaliName && (
                        <p className="text-[11px] font-bengali font-bold text-zinc-700">{currentTenant.bengaliName}</p>
                      )}
                      <p className="text-[10px] text-zinc-600">{currentTenant.marketMallName} • {currentTenant.shopNo}</p>
                      <p className="text-[10px] text-zinc-600">Hotline: {currentTenant.ownerPhone}</p>
                    </div>

                    {/* Memo Info */}
                    <div className="flex justify-between text-[10px] text-zinc-600 pb-1 border-b border-zinc-300">
                      <div>MEMO: <strong>#{invoice.invoiceNo}</strong></div>
                      <div>{new Date(invoice.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                    </div>

                    {/* Customer */}
                    <div className="text-[11px]">
                      <div>Customer: <strong>{invoice.customerName}</strong></div>
                      <div>Phone: <strong>{invoice.customerPhone}</strong></div>
                      <div>Served by: <strong>{invoice.salesmanName}</strong></div>
                    </div>

                    {/* Line Items Table */}
                    <div className="border-t border-b border-zinc-400 py-1.5 space-y-1">
                      {invoice.items.map((item, idx) => (
                        <div key={idx} className="space-y-0.5">
                          <div className="flex justify-between font-bold">
                            <span className="truncate pr-2">{item.title}</span>
                            <span>৳{item.subtotal}</span>
                          </div>
                          <div className="text-[10px] text-zinc-500 flex justify-between">
                            <span>Size: {item.size} • Qty: {item.quantity}</span>
                            <span>@ ৳{item.rate}</span>
                          </div>
                          {item.customization && (
                            <div className="text-[10px] bg-zinc-100 p-1 rounded font-semibold text-zinc-700">
                              [PRINT: {item.customization.customName} #{item.customization.customNumber} • {item.customization.fontStyle.replace('Official ', '')}]
                            </div>
                          )}
                        </div>
                      ))}
                    </div>

                    {/* Totals */}
                    <div className="space-y-1 pt-1 text-right text-[11px]">
                      <div className="flex justify-between">
                        <span>Subtotal:</span>
                        <span>৳{invoice.subtotal}</span>
                      </div>
                      {invoice.discount > 0 && (
                        <div className="flex justify-between text-rose-600">
                          <span>Discount:</span>
                          <span>-৳{invoice.discount}</span>
                        </div>
                      )}
                      <div className="flex justify-between font-bold text-sm border-t border-zinc-400 pt-1">
                        <span>TOTAL:</span>
                        <span>৳{invoice.total}</span>
                      </div>
                      <div className="flex justify-between text-[11px]">
                        <span>Paid ({invoice.paymentChannel.toUpperCase()}):</span>
                        <span>৳{invoice.advancePaid}</span>
                      </div>
                      {invoice.paymentChannel === 'split' && invoice.splitBreakdown && (
                        <div className="bg-zinc-100 rounded p-1.5 text-[10px] text-zinc-700 space-y-0.5 text-left">
                          <div className="font-bold uppercase text-[9px] text-zinc-500">Split Payment Breakdown:</div>
                          {getActiveSplitEntries(invoice.splitBreakdown).map((entry) => (
                            <div key={entry.key} className="flex justify-between">
                              <span>• {entry.label}:</span>
                              <span className="font-bold">৳{entry.amount}</span>
                            </div>
                          ))}
                        </div>
                      )}
                      {invoice.dueAmount > 0 && (
                        <div className="flex justify-between font-bold text-rose-600 text-xs border-t border-dashed border-zinc-400 pt-1">
                          <span>DUE BALANCE:</span>
                          <span>৳{invoice.dueAmount}</span>
                        </div>
                      )}
                    </div>

                    {/* Return Policy & QR simulation */}
                    <div className="pt-2 border-t-2 border-dashed border-zinc-400 text-center space-y-1.5">
                      <div className="flex items-center justify-center gap-1.5 text-[10px] text-zinc-600">
                        <QrCode className="w-4 h-4 text-zinc-700" />
                        <span>Scan to verify digital warranty</span>
                      </div>
                      <p className="text-[9px] text-zinc-500 italic leading-tight">
                        "{currentTenant.returnPolicy}"
                      </p>
                      <div className="text-[8px] text-zinc-400 uppercase tracking-widest font-sans">
                        Powered by LEKHO POS BD
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>
          )}
        </div>

        {/* Buttons / Actions */}
        <div className="flex flex-wrap items-center justify-between gap-2 mt-3 pt-3 border-t border-slate-100 dark:border-zinc-800 shrink-0">
          <div className="flex gap-2">
            <button
              onClick={() => setIsEditing(!isEditing)}
              className="p-2 rounded-xl bg-[#f4f7f5] hover:bg-slate-200/70 dark:bg-zinc-800 dark:hover:bg-zinc-750 text-slate-700 dark:text-zinc-300 border border-slate-200/80 dark:border-zinc-700 text-xs font-semibold flex items-center gap-1 cursor-pointer"
              title="Edit Invoice within safe window"
            >
              <Edit3 className="w-3.5 h-3.5 text-[#1f8a5b] dark:text-emerald-400" />
              Edit
            </button>
            <button
              onClick={handleSoftDelete}
              className="p-2 rounded-xl bg-[#f4f7f5] hover:bg-rose-50 dark:bg-zinc-800 dark:hover:bg-rose-950/30 text-slate-500 hover:text-rose-600 dark:text-zinc-400 dark:hover:text-rose-400 border border-slate-200/80 dark:border-zinc-700 text-xs flex items-center gap-1 cursor-pointer"
              title="Soft Delete to 30-day Trash"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="flex gap-2">
            <button
              onClick={handleSendWhatsApp}
              className="px-3.5 py-2 rounded-2xl bg-[#164e3f] hover:bg-[#123e32] text-white font-bold text-xs flex items-center gap-1.5 shadow-xs cursor-pointer"
            >
              <MessageSquare className="w-3.5 h-3.5" />
              WhatsApp Slip
            </button>
            <button
              onClick={() => window.print()}
              className="px-3.5 py-2 rounded-2xl bg-[#e6f4ea] hover:bg-emerald-100 text-[#1f8a5b] border border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800 font-bold text-xs flex items-center gap-1.5 cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              Print (80mm)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
