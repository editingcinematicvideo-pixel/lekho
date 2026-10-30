import React from 'react';
import { useApp } from '../../context/AppContext';
import { ShieldAlert, ArrowLeft, Store } from 'lucide-react';

export const ImpersonationBanner: React.FC = () => {
  const { isImpersonating, currentTenant, exitImpersonation } = useApp();

  if (!isImpersonating) return null;

  return (
    <div className="bg-amber-600 text-white px-4 py-2.5 shadow-md flex items-center justify-between z-50 sticky top-0 text-sm">
      <div className="flex items-center gap-2">
        <ShieldAlert className="w-5 h-5 text-amber-200 animate-pulse shrink-0" />
        <div>
          <span className="font-semibold uppercase tracking-wider text-xs bg-amber-800 px-2 py-0.5 rounded mr-2">
            Shadow Impersonation Mode
          </span>
          <span>
            You are logged into <strong className="underline">{currentTenant.name}</strong> as Platform Super Admin. All changes affect live ledger.
          </span>
        </div>
      </div>
      <button
        onClick={exitImpersonation}
        className="flex items-center gap-1.5 bg-white text-amber-900 hover:bg-amber-100 px-3 py-1.5 rounded-lg text-xs font-bold transition shadow-sm cursor-pointer shrink-0"
      >
        <ArrowLeft className="w-4 h-4" />
        Return to Super Admin Hub
      </button>
    </div>
  );
};
