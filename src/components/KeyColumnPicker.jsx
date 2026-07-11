import React from 'react';
import { SearchableSelect } from './SearchableSelect';
import { Key, FileSpreadsheet, Check } from 'lucide-react';

export function KeyColumnPicker({
  headersA,
  headersB,
  headersAccounting,
  keyColA,
  keyColB,
  keyColAcct,
  onChange,
  disabled
}) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2 text-xs sm:text-sm text-base-content/70 bg-base-200/60 p-3.5 rounded-xl border border-base-content/5">
        <Key className="w-4 h-4 text-primary shrink-0" />
        <span>
          Select the unique identifier column (Loan Account Number / ID) in each file. The engine matches and aggregates records across all files using this key.
        </span>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {/* File A Key */}
        <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-primary flex items-center gap-1.5">
              <FileSpreadsheet className="w-3.5 h-3.5" /> File A Key
            </span>
            {keyColA && <span className="text-success text-xs font-semibold flex items-center gap-1"><Check className="w-3.5 h-3.5" /> Selected</span>}
          </div>
          <SearchableSelect
            value={keyColA || ''}
            options={headersA}
            onChange={(val) => onChange('keyColA', val)}
            placeholder={
              headersA.length === 0 ? 'Upload File A first…' : 'Search File A key column…'
            }
            disabled={disabled || headersA.length === 0}
          />
        </div>

        {/* File B Key */}
        <div className="rounded-xl border border-secondary/20 bg-secondary/5 p-4 flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-secondary flex items-center gap-1.5">
              <FileSpreadsheet className="w-3.5 h-3.5" /> File B Key
            </span>
            {keyColB && <span className="text-success text-xs font-semibold flex items-center gap-1"><Check className="w-3.5 h-3.5" /> Selected</span>}
          </div>
          <SearchableSelect
            value={keyColB || ''}
            options={headersB}
            onChange={(val) => onChange('keyColB', val)}
            placeholder={
              headersB.length === 0 ? 'Upload File B first…' : 'Search File B key column…'
            }
            disabled={disabled || headersB.length === 0}
          />
        </div>

        {/* Accounting File Key */}
        <div className="rounded-xl border border-accent/20 bg-accent/5 p-4 flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-accent flex items-center gap-1.5">
              <FileSpreadsheet className="w-3.5 h-3.5" /> Accounting Key
            </span>
            {keyColAcct && <span className="text-success text-xs font-semibold flex items-center gap-1"><Check className="w-3.5 h-3.5" /> Selected</span>}
          </div>
          <SearchableSelect
            value={keyColAcct || ''}
            options={headersAccounting}
            onChange={(val) => onChange('keyColAcct', val)}
            placeholder={
              headersAccounting.length === 0
                ? 'Upload Accounting file to enable…'
                : 'Search Accounting key column…'
            }
            disabled={disabled || headersAccounting.length === 0}
          />
          {headersAccounting.length === 0 && (
            <span className="text-[11px] text-base-content/50 mt-1">
              Upload Accounting CSV above to enable
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
