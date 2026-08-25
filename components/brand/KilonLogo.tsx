import React from 'react';

// Typographic wordmark matching kilon-consulting.com: "GILAD" in a thin outline
// weight, "KILON." in heavy bold, with a small slate/blue dot accent after it.
export const KilonLogo: React.FC<{ className?: string; subtitle?: string }> = ({ className = '', subtitle }) => (
  <div className={`inline-flex flex-col items-center ${className}`}>
    <div className="flex items-baseline gap-1.5" dir="ltr">
      <span className="text-2xl font-extralight tracking-wide text-kilon-ink">GILAD</span>
      <span className="text-2xl font-extrabold tracking-tight text-kilon-ink">KILON.</span>
      <span className="w-2 h-2 rounded-full bg-kilon-slate mb-1" />
    </div>
    {subtitle && (
      <span className="text-[10px] tracking-[0.2em] text-kilon-inkSoft uppercase mt-1">{subtitle}</span>
    )}
  </div>
);
