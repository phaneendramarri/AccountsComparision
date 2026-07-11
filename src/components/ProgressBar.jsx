import React from 'react';
import { Loader2, CheckCircle2 } from 'lucide-react';

export function ProgressBar({ label, percent, subtitle }) {
  const clamped = Math.max(0, Math.min(100, Math.round(percent || 0)));
  const isDone = clamped === 100;

  return (
    <div className="w-full bg-base-200/60 rounded-xl p-3.5 border border-base-content/5 flex flex-col gap-2">
      <div className="flex items-center justify-between text-xs sm:text-sm">
        <div className="flex items-center gap-2 font-bold text-base-content">
          {isDone ? (
            <CheckCircle2 className="w-4 h-4 text-success shrink-0" />
          ) : (
            <Loader2 className="w-4 h-4 text-primary animate-spin shrink-0" />
          )}
          <span>{label}</span>
        </div>
        <span className="font-mono text-xs font-semibold badge badge-sm badge-neutral">
          {clamped}%
        </span>
      </div>

      <div className="w-full bg-base-300 rounded-full h-2 overflow-hidden">
        <div
          className={`h-full transition-all duration-300 rounded-full ${
            isDone ? 'bg-success' : 'bg-gradient-to-r from-primary to-secondary'
          }`}
          style={{ width: `${clamped}%` }}
        />
      </div>

      {subtitle ? (
        <div className="text-[11px] text-base-content/60 font-medium">{subtitle}</div>
      ) : null}
    </div>
  );
}
