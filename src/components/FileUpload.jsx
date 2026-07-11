import React, { useRef } from 'react';
import { UploadCloud, FileSpreadsheet, CheckCircle2, Loader2 } from 'lucide-react';

function formatBytes(size) {
  if (!size) return '';
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  if (size < 1024 * 1024 * 1024) return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  return `${(size / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export function FileUpload({ label, file, loading, onChange }) {
  const inputRef = useRef(null);
  const hasFile = Boolean(file?.file);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold uppercase tracking-wider text-base-content/80">
          {label}
        </span>
        {hasFile && (
          <span className="badge badge-success badge-sm gap-1 text-[11px] font-semibold">
            <CheckCircle2 className="w-3 h-3" /> Ready
          </span>
        )}
      </div>

      <div
        onClick={() => !loading && inputRef.current?.click()}
        className={`group relative flex flex-col items-center justify-center rounded-2xl border-2 border-dashed p-5 text-center transition-all duration-300 cursor-pointer ${
          hasFile
            ? 'border-success/40 bg-success/5 hover:border-success/60 hover:bg-success/10'
            : 'border-base-content/15 bg-base-200/50 hover:border-primary/50 hover:bg-primary/5'
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".csv,text/csv"
          onChange={onChange}
          className="hidden"
          disabled={loading}
        />

        {loading ? (
          <div className="flex flex-col items-center gap-2 py-3">
            <Loader2 className="w-8 h-8 text-primary animate-spin" />
            <span className="text-xs font-medium text-base-content/70">
              Inspecting CSV Headers…
            </span>
          </div>
        ) : hasFile ? (
          <div className="flex flex-col items-center gap-2 py-1 w-full">
            <div className="w-10 h-10 rounded-xl bg-success/15 text-success flex items-center justify-center shadow-sm">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div className="max-w-full truncate px-2 text-sm font-semibold text-base-content">
              {file.name}
            </div>
            <div className="flex flex-wrap items-center justify-center gap-1.5 text-xs text-base-content/60">
              <span className="badge badge-sm badge-neutral font-mono">
                {formatBytes(file.size)}
              </span>
              <span className="badge badge-sm badge-outline">
                {file.headers.length} Columns
              </span>
            </div>
            <span className="text-[11px] text-primary group-hover:underline mt-1">
              Click to replace file
            </span>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2 py-3">
            <div className="w-10 h-10 rounded-xl bg-base-300/80 text-base-content/60 group-hover:bg-primary/10 group-hover:text-primary flex items-center justify-center transition-all duration-300">
              <UploadCloud className="w-5 h-5" />
            </div>
            <div className="text-sm font-medium text-base-content/80 group-hover:text-primary transition-colors">
              Click to upload CSV
            </div>
            <span className="text-xs text-base-content/50">
              Large files (1GB+) supported
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
