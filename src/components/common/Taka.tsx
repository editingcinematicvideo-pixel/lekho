import React from 'react';

interface TakaProps {
  amount?: number | string;
  className?: string;
  showPrefix?: boolean;
}

export const Taka: React.FC<TakaProps> = ({ amount, className = '', showPrefix = true }) => {
  return (
    <span className={`inline-flex items-center gap-0.5 ${className}`}>
      {showPrefix && (
        <span className="font-bengali font-bold select-none text-[1.05em] leading-none">
          ৳
        </span>
      )}
      {amount !== undefined && <span>{amount}</span>}
    </span>
  );
};
