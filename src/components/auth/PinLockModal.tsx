import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Lock, Delete, Check, ShieldCheck, UserCheck, AlertCircle, KeyRound } from 'lucide-react';

interface PinLockModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  requiredRole?: 'owner' | 'any';
  onSuccess?: () => void;
}

export const PinLockModal: React.FC<PinLockModalProps> = ({
  isOpen,
  onClose,
  title = 'Fast Cashier / Staff PIN Switch',
  description = 'Enter your 4-digit secret security PIN to switch active counter session',
  requiredRole = 'any',
  onSuccess,
}) => {
  const { currentTenant, loginWithPin, verifyOwnerPin, showToast } = useApp();
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleKeyPress = (num: string) => {
    if (pin.length < 4) {
      const nextPin = pin + num;
      setPin(nextPin);
      setError('');
      if (nextPin.length === 4) {
        validatePin(nextPin);
      }
    }
  };

  const handleBackspace = () => {
    setPin((prev) => prev.slice(0, -1));
    setError('');
  };

  const handleClear = () => {
    setPin('');
    setError('');
  };

  const validatePin = (inputPin: string) => {
    if (requiredRole === 'owner') {
      const valid = verifyOwnerPin(inputPin);
      if (valid) {
        showToast('Owner PIN verified successfully', 'success');
        if (onSuccess) onSuccess();
        onClose();
        setPin('');
      } else {
        setError('Incorrect Store Owner PIN');
        setPin('');
      }
      return;
    }

    const res = loginWithPin(inputPin);
    if (res.success) {
      showToast(`Welcome! Logged in as ${res.staff ? res.staff.name : 'Authorized User'}`, 'success');
      if (onSuccess) onSuccess();
      onClose();
      setPin('');
    } else {
      setError(res.message || 'Invalid PIN code');
      setPin('');
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 dark:bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
      <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl sm:rounded-3xl max-w-sm w-full max-h-[90dvh] overflow-y-auto p-4 sm:p-5 shadow-2xl text-slate-900 dark:text-zinc-100 flex flex-col items-center">
        <h3 className="lekho-modal-title text-center text-slate-900 dark:text-white mb-4">{title}</h3>

        {/* PIN Indicators */}
        <div className="flex gap-3 mb-4">
          {[0, 1, 2, 3].map((idx) => (
            <div
              key={idx}
              className={`w-3.5 h-3.5 rounded-full border-2 transition-all duration-200 ${
                pin.length > idx
                  ? 'bg-[#164e3f] dark:bg-emerald-400 border-[#164e3f] dark:border-emerald-400 scale-110 shadow-md shadow-emerald-600/30'
                  : 'bg-slate-100 dark:bg-zinc-800 border-slate-300 dark:border-zinc-700'
              }`}
            />
          ))}
        </div>

        {error && (
          <div className="flex items-center gap-1.5 text-xs text-rose-700 dark:text-rose-400 bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30 px-3 py-1.5 rounded-lg mb-3">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Keypad */}
        <div className="grid grid-cols-3 gap-2.5 w-full max-w-[250px] mb-4">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
            <button
              key={digit}
              onClick={() => handleKeyPress(digit)}
              className="h-11 sm:h-12 rounded-2xl bg-slate-50 hover:bg-slate-100 active:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-750 dark:active:bg-zinc-700 active:scale-95 border border-slate-200 dark:border-zinc-700/60 font-bold text-lg text-slate-900 dark:text-zinc-100 transition shadow-2xs cursor-pointer flex items-center justify-center"
            >
              {digit}
            </button>
          ))}
          <button
            onClick={handleClear}
            className="h-11 sm:h-12 rounded-2xl bg-slate-100/80 hover:bg-slate-200/70 dark:bg-zinc-800/60 dark:hover:bg-zinc-800 active:scale-95 text-[11px] font-semibold text-slate-600 dark:text-zinc-400 border border-slate-200 dark:border-zinc-800 cursor-pointer flex items-center justify-center"
          >
            CLEAR
          </button>
          <button
            onClick={() => handleKeyPress('0')}
            className="h-11 sm:h-12 rounded-2xl bg-slate-50 hover:bg-slate-100 active:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-750 dark:active:bg-zinc-700 active:scale-95 border border-slate-200 dark:border-zinc-700/60 font-bold text-lg text-slate-900 dark:text-zinc-100 transition shadow-2xs cursor-pointer flex items-center justify-center"
          >
            0
          </button>
          <button
            onClick={handleBackspace}
            className="h-11 sm:h-12 rounded-2xl bg-slate-100/80 hover:bg-slate-200/70 dark:bg-zinc-800/60 dark:hover:bg-zinc-800 active:scale-95 text-slate-700 dark:text-zinc-300 border border-slate-200 dark:border-zinc-800 cursor-pointer flex items-center justify-center"
          >
            <Delete className="w-4 h-4" />
          </button>
        </div>

        {/* Cancel Button */}
        <button
          onClick={() => {
            setPin('');
            setError('');
            onClose();
          }}
          className="w-full py-2.5 rounded-xl border border-slate-200 dark:border-zinc-750 text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-zinc-800 text-xs font-semibold transition cursor-pointer shrink-0"
        >
          Cancel
        </button>
      </div>
    </div>
  );
};
