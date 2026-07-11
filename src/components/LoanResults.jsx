import React, { useState, useMemo, useCallback } from 'react';
import { formatNumber } from '../lib/format';
import { formatSideLabel, getPartsA, getPartsB } from '../lib/engine';
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  HelpCircle,
  Search,
  Download,
  Filter,
  FileSpreadsheet
} from 'lucide-react';

const STATUS_META = {
  match: {
    label: 'Match',
    badge: 'badge-success',
    icon: CheckCircle2,
    desc: 'Diff (A − B) matches Accounting Sum (or Diff = 0)'
  },
  mismatch: {
    label: 'Mismatch',
    badge: 'badge-error',
    icon: XCircle,
    desc: 'Diff (A − B) does not match Accounting Sum'
  },
  'missing-in-a': {
    label: 'Missing in File A',
    badge: 'badge-warning',
    icon: AlertTriangle,
    desc: 'Loan exists in File B but missing in File A'
  },
  'missing-in-b': {
    label: 'Missing in File B',
    badge: 'badge-warning',
    icon: AlertTriangle,
    desc: 'Loan exists in File A but missing in File B'
  },
  'accounting-only': {
    label: 'Accounting Only',
    badge: 'badge-ghost',
    icon: HelpCircle,
    desc: 'Loan found only in Accounting File'
  }
};

function StatusBadge({ status }) {
  const meta = STATUS_META[status] ?? {
    label: status,
    badge: 'badge-ghost',
    icon: HelpCircle,
    desc: '?'
  };
  const Icon = meta.icon;
  return (
    <span
      className={`badge ${meta.badge} badge-outline gap-1 text-xs whitespace-nowrap font-medium py-2.5 px-2.5`}
      title={meta.desc}
    >
      <Icon className="w-3.5 h-3.5" />
      <span>{meta.label}</span>
    </span>
  );
}

export function LoanResults({ loanRows, pairs, hasAccounting, onDownload }) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 50;

  const counts = useMemo(() => {
    const c = {};
    loanRows.forEach((r) => {
      c[r.status] = (c[r.status] || 0) + 1;
    });
    return c;
  }, [loanRows]);

  const filtered = useMemo(() => {
    let rows = loanRows;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      rows = rows.filter((r) => r.loanNo.toLowerCase().includes(q));
    }
    if (statusFilter !== 'all') {
      rows = rows.filter((r) => r.status === statusFilter);
    }
    return rows;
  }, [loanRows, search, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paged = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const handleSearch = useCallback((e) => {
    setSearch(e.target.value);
    setPage(1);
  }, []);

  const handleFilter = useCallback((e) => {
    setStatusFilter(e.target.value);
    setPage(1);
  }, []);

  return (
    <section className="rounded-2xl bg-base-100 border border-base-content/10 shadow-xl overflow-hidden">
      <div className="p-5 sm:p-6 flex flex-col gap-5">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold font-display tracking-tight text-base-content">
                Reconciliation Results by Loan Key
              </h2>
              <span className="badge badge-neutral font-mono text-xs">
                {loanRows.length.toLocaleString()} Loans
              </span>
            </div>
            <p className="text-xs sm:text-sm text-base-content/60 mt-0.5">
              Interactive per-loan breakdown comparing File A, File B, and Accounting sums.
            </p>
          </div>
          <button
            type="button"
            className="btn btn-primary btn-sm gap-2 shadow-md shadow-primary/20"
            onClick={onDownload}
          >
            <Download className="w-4 h-4" /> Download CSV Report
          </button>
        </div>

        {/* Status Filter Badges */}
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => {
              setStatusFilter('all');
              setPage(1);
            }}
            className={`badge badge-lg gap-2 cursor-pointer py-4 px-3.5 transition-all ${
              statusFilter === 'all'
                ? 'badge-neutral font-bold shadow-sm'
                : 'badge-outline opacity-70 hover:opacity-100'
            }`}
          >
            <span>All Statuses</span>
            <span className="font-mono text-xs">{loanRows.length.toLocaleString()}</span>
          </button>

          {Object.entries(STATUS_META).map(([key, meta]) => {
            const count = counts[key] || 0;
            if (count === 0) return null;
            const Icon = meta.icon;
            return (
              <button
                key={key}
                type="button"
                onClick={() => {
                  setStatusFilter(statusFilter === key ? 'all' : key);
                  setPage(1);
                }}
                className={`badge badge-lg ${meta.badge} ${
                  statusFilter === key ? 'font-bold shadow-sm' : 'badge-outline opacity-75 hover:opacity-100'
                } gap-2 cursor-pointer py-4 px-3.5 transition-all`}
              >
                <Icon className="w-4 h-4" />
                <span>{meta.label}</span>
                <span className="font-mono text-xs">{count.toLocaleString()}</span>
              </button>
            );
          })}
        </div>

        {/* Search & Filter Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 bg-base-200/50 p-3 rounded-xl border border-base-content/5">
          <div className="flex flex-wrap items-center gap-3 flex-1">
            <div className="relative w-full sm:w-72">
              <Search className="w-4 h-4 text-base-content/40 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                className="input input-bordered input-sm pl-9 w-full font-mono text-xs"
                placeholder="Search Loan Key / Account No…"
                value={search}
                onChange={handleSearch}
              />
            </div>
            <div className="flex items-center gap-1.5">
              <Filter className="w-4 h-4 text-base-content/50" />
              <select
                className="select select-bordered select-sm text-xs"
                value={statusFilter}
                onChange={handleFilter}
              >
                <option value="all">All Statuses ({loanRows.length.toLocaleString()})</option>
                {Object.entries(STATUS_META).map(([key, meta]) => {
                  const count = counts[key] || 0;
                  if (count === 0) return null;
                  return (
                    <option key={key} value={key}>
                      {meta.label} ({count.toLocaleString()})
                    </option>
                  );
                })}
              </select>
            </div>
          </div>

          <span className="text-xs font-mono text-base-content/60 px-2">
            Showing <span className="font-bold text-base-content">{filtered.length.toLocaleString()}</span> loans
          </span>
        </div>

        {/* Table */}
        <div className="overflow-x-auto rounded-xl border border-base-content/10 shadow-sm max-h-[600px]">
          <table className="table table-xs table-pin-rows table-pin-cols">
            <thead className="bg-base-200 text-base-content">
              <tr>
                <th className="sticky left-0 bg-base-200 z-20 min-w-[180px] py-3 shadow-r">
                  Loan Key / ID
                </th>
                <th className="py-3">Status</th>
                <th className="text-right py-3">Rows A</th>
                <th className="text-right py-3">Rows B</th>
                {pairs.map((p) => {
                  const labelA = formatSideLabel(getPartsA(p), p.colA);
                  const labelB = formatSideLabel(getPartsB(p), p.colB);
                  return (
                    <React.Fragment key={`${p.colA}::${p.colB}`}>
                      <th className="text-right border-l border-base-content/10 py-3 text-[11px] bg-primary/5">
                        <div className="text-primary font-bold">Σ File A</div>
                        <div className="text-base-content/60 font-medium truncate max-w-[150px]" title={labelA}>
                          {labelA}
                        </div>
                      </th>
                      <th className="text-right py-3 text-[11px] bg-secondary/5">
                        <div className="text-secondary font-bold">Σ File B</div>
                        <div className="text-base-content/60 font-medium truncate max-w-[150px]" title={labelB}>
                          {labelB}
                        </div>
                      </th>
                      <th className="text-right py-3 text-[11px]">
                        <div className="font-bold">Diff</div>
                        <div className="text-base-content/50">A − B</div>
                      </th>
                      {hasAccounting && (
                        <>
                          <th className="text-right py-3 text-[11px] bg-accent/5">
                            <div className="text-accent font-bold">Accounting Sum</div>
                            <div className="text-base-content/50">Rule Formula</div>
                          </th>
                          <th className="text-right py-3 text-[11px]">
                            <div className="font-bold">Delta</div>
                            <div className="text-base-content/50">Diff − Acct</div>
                          </th>
                        </>
                      )}
                    </React.Fragment>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {paged.map((row) => (
                <tr key={row.loanNo} className="hover transition-colors">
                  <td className="sticky left-0 bg-base-100 z-10 font-mono text-xs font-bold whitespace-nowrap shadow-r">
                    {row.loanNo}
                  </td>
                  <td className="whitespace-nowrap">
                    <StatusBadge status={row.status} />
                  </td>
                  <td className="text-right tabular-nums font-mono text-xs text-base-content/70">
                    {row.rowCountA || '—'}
                  </td>
                  <td className="text-right tabular-nums font-mono text-xs text-base-content/70">
                    {row.rowCountB || '—'}
                  </td>
                  {row.pairDiffs.map((pd) => {
                    const diffCls =
                      Math.abs(pd.diff) < 0.005
                        ? 'text-base-content/50'
                        : pd.diff > 0
                        ? 'text-success font-bold'
                        : 'text-error font-bold';
                    const deltaCls =
                      pd.delta === null
                        ? ''
                        : Math.abs(pd.delta) < 0.005
                        ? 'text-success font-medium'
                        : 'text-error font-bold';
                    return (
                      <React.Fragment key={`${pd.colA}::${pd.colB}`}>
                        <td className="text-right tabular-nums font-mono text-xs whitespace-nowrap border-l border-base-content/10 bg-primary/[0.02]">
                          {formatNumber(pd.sumA)}
                        </td>
                        <td className="text-right tabular-nums font-mono text-xs whitespace-nowrap bg-secondary/[0.02]">
                          {formatNumber(pd.sumB)}
                        </td>
                        <td className={`text-right tabular-nums font-mono text-xs whitespace-nowrap ${diffCls}`}>
                          {formatNumber(pd.diff)}
                        </td>
                        {hasAccounting && (
                          <>
                            <td className="text-right tabular-nums font-mono text-xs whitespace-nowrap bg-accent/[0.02]">
                              {pd.acctSum === null ? '—' : formatNumber(pd.acctSum)}
                            </td>
                            <td className={`text-right tabular-nums font-mono text-xs whitespace-nowrap ${deltaCls}`}>
                              {pd.delta === null ? '—' : formatNumber(pd.delta)}
                            </td>
                          </>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tr>
              ))}
              {paged.length === 0 && (
                <tr>
                  <td colSpan={99} className="text-center text-base-content/50 py-12">
                    No loans match your search or status filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between flex-wrap gap-4 pt-2 border-t border-base-content/5">
            <span className="text-xs text-base-content/60">
              Page <span className="font-bold text-base-content">{safePage}</span> of{' '}
              <span className="font-bold text-base-content">{totalPages}</span>
            </span>
            <div className="join">
              <button
                type="button"
                className="btn btn-xs join-item"
                disabled={safePage <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                ← Previous
              </button>
              <button
                type="button"
                className="btn btn-xs join-item"
                disabled={safePage >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              >
                Next →
              </button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
