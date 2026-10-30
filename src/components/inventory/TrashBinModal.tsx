import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { TrashItem } from '../../types';
import { dbService } from '../../services/db';
import { Trash2, RotateCcw, AlertCircle, X, Check } from 'lucide-react';

interface TrashBinModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRestored?: () => void;
}

export const TrashBinModal: React.FC<TrashBinModalProps> = ({
  isOpen,
  onClose,
  onRestored,
}) => {
  const { currentTenant, showToast, pickText } = useApp();
  const [trashItems, setTrashItems] = useState<TrashItem[]>(() =>
    dbService.getTrash(currentTenant.id)
  );

  if (!isOpen) return null;

  const handleRestore = (trashId: string) => {
    const success = dbService.restoreFromTrash(currentTenant.id, trashId);
    if (success) {
      setTrashItems(dbService.getTrash(currentTenant.id));
      showToast(
        pickText(
          'আইটেমটি রিসাইকেল বিন থেকে পুনরুদ্ধার করা হয়েছে',
          'Item restored from trash back to active records'
        ),
        'success'
      );
      if (onRestored) onRestored();
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-zinc-900 border border-zinc-750 rounded-3xl max-w-lg w-full p-6 text-zinc-100 shadow-2xl">
        <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
          <div className="flex items-center gap-2">
            <Trash2 className="w-5 h-5 text-rose-400" />
            <div>
              <h3 className="text-base font-bold text-white">
                {pickText('রিসাইকেল বিন (Trash Bin)', 'Soft-Delete Recycle Bin')}
              </h3>
              <p className="text-[11px] text-zinc-400">
                {pickText(
                  'ভুলবশত মুছে ফেলা রেকর্ড ৩০ দিনের মধ্যে পুনরুদ্ধার করুন',
                  '30-Day Safe Restore Window for accidental deletions'
                )}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 text-zinc-400 hover:text-white cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="mt-4 space-y-3 max-h-96 overflow-y-auto">
          {trashItems.length === 0 ? (
            <div className="p-8 text-center text-zinc-500 text-xs border border-dashed border-zinc-800 rounded-2xl">
              {pickText(
                'রিসাইকেল বিন খালি। গত ৩০ দিনে কোনো ইনভয়েস বা পণ্য মুছে ফেলা হয়নি।',
                'Recycle bin is clean. No soft-deleted invoices or products in the 30-day window.'
              )}
            </div>
          ) : (
            trashItems.map((item) => (
              <div
                key={item.id}
                className="bg-zinc-950 border border-zinc-800 rounded-xl p-3.5 flex items-center justify-between text-xs"
              >
                <div>
                  <span className="text-[10px] uppercase font-bold text-zinc-400 bg-zinc-900 px-1.5 py-0.5 rounded mr-1.5">
                    {item.itemType}
                  </span>
                  <span className="font-bold text-white">{item.title}</span>
                  <div className="text-[11px] text-zinc-400 mt-0.5">{item.summary}</div>
                  <div className="text-[10px] text-zinc-500 mt-1">
                    {pickText('মুছে ফেলা হয়েছে:', 'Deleted')}{' '}
                    {new Date(item.deletedAt).toLocaleDateString()} •{' '}
                    {pickText('৩০ দিনে স্বয়ংক্রিয়ভাবে মুছে যাবে', 'Auto-purges in 30 days')}
                  </div>
                </div>

                <button
                  onClick={() => handleRestore(item.id)}
                  className="flex items-center gap-1 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 border border-emerald-500/30 px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer shrink-0"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  {pickText('পুনরুদ্ধার', 'Restore')}
                </button>
              </div>
            ))
          )}
        </div>

        <div className="mt-5 pt-3 border-t border-zinc-800 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-zinc-800 text-zinc-300 hover:text-white text-xs font-semibold cursor-pointer"
          >
            {pickText('বন্ধ করুন', 'Close')}
          </button>
        </div>
      </div>
    </div>
  );
};
