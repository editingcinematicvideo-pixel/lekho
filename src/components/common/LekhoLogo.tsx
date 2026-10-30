import React from 'react';

interface LekhoLogoProps {
  variant?: 'sidebar' | 'header' | 'compact' | 'light';
  size?: 'sm' | 'md' | 'lg';
  subtitle?: string;
  subtitleText?: string;
  showSubtitle?: boolean;
  onClick?: () => void;
  className?: string;
}

/**
 * Official LEKHO Brand Logo Component
 * Renders the signature LEKHO dual-leaf emblem and wordmark matching the official brand identity.
 */
export const LekhoLogo: React.FC<LekhoLogoProps> = ({
  variant = 'header',
  size = 'md',
  subtitle,
  subtitleText,
  showSubtitle = false,
  onClick,
  className = '',
}) => {
  const isLightText = variant === 'sidebar' || variant === 'light';
  const effectiveSubtitle = subtitleText ?? subtitle ?? '';

  return (
    <div
      onClick={onClick}
      className={`inline-flex items-center gap-2.5 select-none ${onClick ? 'cursor-pointer group' : ''} ${className}`}
    >
      {/* Official LEKHO Dual-Leaf Emblem Badge */}
      <div
        className={`relative flex items-center justify-center shrink-0 overflow-hidden transition-transform ${
          onClick ? 'group-hover:scale-105' : ''
        } ${
          variant === 'compact' || size === 'sm'
            ? 'w-9 h-9 rounded-xl'
            : 'w-10 h-10 rounded-xl'
        } ${
          isLightText
            ? 'bg-white/95 shadow-md ring-1 ring-white/20'
            : 'bg-[#0e382d] shadow-sm ring-1 ring-emerald-900/15'
        }`}
      >
        <svg
          viewBox="0 0 48 48"
          className={`w-6 h-6 ${isLightText ? 'text-[#164e3f]' : 'text-[#7fdba8]'}`}
          fill="currentColor"
          aria-hidden="true"
        >
          {/* Left Leaf */}
          <path d="M23.2 38.5C15.5 34.2 10 25.4 12.2 14.5C19.8 15.8 24.4 22.1 24.2 31.8C21.5 26.2 18.2 22.4 15.6 20.4C17.8 24.5 20.6 29.8 23.2 38.5Z" />
          {/* Right Leaf */}
          <path d="M24.8 38.5C25.2 26.8 29.8 16.5 38.5 11.2C39.6 22.8 34.2 32.8 24.8 38.5ZM27.4 31.2C30.6 26.5 33.4 21.2 35.1 16.8C32.1 20.4 29.2 25.4 27.4 31.2Z" />
        </svg>
      </div>

      {variant !== 'compact' && (
        <div className="flex flex-col min-w-0">
          <div className="flex items-center gap-1.5">
            <span
              className={`font-black tracking-tight leading-none ${
                size === 'sm' ? 'text-base sm:text-lg' : 'text-lg sm:text-xl'
              } ${
                isLightText
                  ? 'text-white'
                  : 'text-[#0e382d] dark:text-emerald-400'
              }`}
            >
              LEKHO
            </span>
            <span
              className={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider leading-none ${
                isLightText
                  ? 'bg-emerald-400/20 text-emerald-200 border border-emerald-300/20'
                  : 'bg-emerald-50 text-[#164e3f] border border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800'
              }`}
            >
              POS
            </span>
          </div>
          {showSubtitle && effectiveSubtitle && (
            <span
              className={`text-[10px] font-semibold tracking-wide truncate mt-0.5 ${
                isLightText
                  ? 'text-emerald-100/80'
                  : 'text-slate-500 dark:text-zinc-400'
              }`}
            >
              {effectiveSubtitle}
            </span>
          )}
        </div>
      )}
    </div>
  );
};
