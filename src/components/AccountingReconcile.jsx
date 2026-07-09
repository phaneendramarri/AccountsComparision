import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FileUpload } from './FileUpload';
import { ProgressBar } from './ProgressBar';
import { SearchableSelect } from './SearchableSelect';
import { peekCsvHeaders } from '../lib/csv';
import { computeFilteredSums } from '../lib/compare';
import { formatNumber } from '../lib/format';

// Values within this delta are treated as matched (absorbs sub-cent rounding).
const MATCH_EPSILON = 0.005;

const emptyFile = { file: null, name: '', size: 0, headers: [] };

let filterIdCounter = 0;
const nextFilterId = () => {
  filterIdCounter += 1;
  return `f_${filterIdCounter}`;
};

function pairKey(pair) {
  return `${pair.colA}::${pair.colB}`;
}

// Split the user's comma-separated filter values into a Set of trimmed,
// lower-cased strings. Empty entries are dropped.
function parseFilterValues(raw) {
  return new Set(
    (raw || '')
      .split(',')
      .map((token) => token.trim().toLowerCase())
      .filter(Boolean)
  );
}

function emptyRule() {
  return { valueColumn: '', filters: [{ id: nextFilterId(), column: '', valuesText: '' }] };
}

export function AccountingReconcile({ pairs, onResultsChange }) {
  const [accounting, setAccounting] = useState(emptyFile);
  const [peeking, setPeeking] = useState(false);
  const [rules, setRules] = useState({});
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [reconResults, setReconResults] = useState(null);
  const [error, setError] = useState('');
  const abortRef = useRef(null);

  // Reset per-pair rules and any prior result whenever the parent pairs
  // change (a fresh comparison was just run).
  useEffect(() => {
    const fresh = {};
    pairs.forEach((pair) => {
      fresh[pairKey(pair)] = emptyRule();
    });
    setRules(fresh);
    setReconResults(null);
  }, [pairs]);

  // Notify the parent so it can include recon data in the downloadable summary.
  useEffect(() => {
    if (!onResultsChange) return;
    if (!reconResults) {
      onResultsChange(null);
      return;
    }
    onResultsChange({
      fileName: accounting.name,
      rowCount: reconResults.rowCount,
      rows: reconResults.rows
    });
  }, [reconResults, accounting.name, onResultsChange]);

  const pairSpecs = useMemo(
    () =>
      pairs
        .map((pair) => {
          const key = pairKey(pair);
          const rule = rules[key];
          if (!rule || !rule.valueColumn) return null;
          const filters = rule.filters
            .map((filter) => ({
              column: filter.column,
              values: parseFilterValues(filter.valuesText)
            }))
            .filter((filter) => filter.column && filter.values.size > 0);
          return { key, valueColumn: rule.valueColumn, filters };
        })
        .filter(Boolean),
    [pairs, rules]
  );

  const canRun = Boolean(accounting.file) && pairSpecs.length > 0 && !running;

  const handleFileChange = useCallback(async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setError('');
    setReconResults(null);
    setPeeking(true);
    try {
      const headers = await peekCsvHeaders(file);
      if (headers.length === 0) {
        throw new Error('No headers were found in the first row.');
      }
      setAccounting({ file, name: file.name, size: file.size, headers });
    } catch (readError) {
      setAccounting(emptyFile);
      setError(readError.message || 'Could not read the accounting file.');
    } finally {
      setPeeking(false);
    }
  }, []);

  const handleClearFile = useCallback(() => {
    if (running) abortRef.current?.abort();
    setAccounting(emptyFile);
    setReconResults(null);
    setError('');
    setProgress(0);
  }, [running]);

  const updateRule = useCallback((key, updater) => {
    setRules((current) => {
      const existing = current[key] ?? emptyRule();
      return { ...current, [key]: updater(existing) };
    });
    setReconResults(null);
  }, []);

  const handleValueColumnChange = useCallback(
    (key, column) => {
      updateRule(key, (rule) => ({ ...rule, valueColumn: column }));
    },
    [updateRule]
  );

  const handleFilterColumnChange = useCallback(
    (key, filterId, column) => {
      updateRule(key, (rule) => ({
        ...rule,
        filters: rule.filters.map((filter) =>
          filter.id === filterId ? { ...filter, column } : filter
        )
      }));
    },
    [updateRule]
  );

  const handleFilterValuesChange = useCallback(
    (key, filterId, valuesText) => {
      updateRule(key, (rule) => ({
        ...rule,
        filters: rule.filters.map((filter) =>
          filter.id === filterId ? { ...filter, valuesText } : filter
        )
      }));
    },
    [updateRule]
  );

  const handleAddFilter = useCallback(
    (key) => {
      updateRule(key, (rule) => ({
        ...rule,
        filters: [...rule.filters, { id: nextFilterId(), column: '', valuesText: '' }]
      }));
    },
    [updateRule]
  );

  const handleRemoveFilter = useCallback(
    (key, filterId) => {
      updateRule(key, (rule) => ({
        ...rule,
        filters:
          rule.filters.length <= 1
            ? [{ id: nextFilterId(), column: '', valuesText: '' }]
            : rule.filters.filter((filter) => filter.id !== filterId)
      }));
    },
    [updateRule]
  );

  const handleClearRule = useCallback(
    (key) => {
      updateRule(key, () => emptyRule());
    },
    [updateRule]
  );

  const handleCancel = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const handleRun = useCallback(async () => {
    if (!canRun) return;
    setError('');
    setReconResults(null);
    setProgress(0);
    setRunning(true);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const streamResult = await computeFilteredSums(accounting.file, pairSpecs, {
        signal: controller.signal,
        onProgress: (bytes) => {
          setProgress(accounting.size ? (bytes / accounting.size) * 100 : 0);
        }
      });
      setProgress(100);

      const configuredKeys = new Set(pairSpecs.map((spec) => spec.key));
      const rows = pairs.map((pair) => {
        const key = pairKey(pair);
        const rule = rules[key];
        if (!configuredKeys.has(key)) {
          return {
            colA: pair.colA,
            colB: pair.colB,
            diff: pair.diff,
            valueColumn: rule?.valueColumn || '',
            filterSummary: '',
            accountingSum: null,
            matchedRows: 0,
            delta: null,
            status: 'unmapped',
            note: rule?.valueColumn
              ? 'Add at least one filter with values.'
              : 'Pick a value column to include this pair.'
          };
        }
        const spec = pairSpecs.find((entry) => entry.key === key);
        const info = streamResult.byPair[key];
        const sum = info.sum;
        const delta = pair.diff - sum;
        let status = Math.abs(delta) < MATCH_EPSILON ? 'match' : 'mismatch';
        let note = '';
        if (info.valueColumnMissing) {
          status = 'error';
          note = `Value column "${spec.valueColumn}" was not found in the accounting file header.`;
        } else if (info.missingFilterColumns.length > 0) {
          status = 'error';
          note = `Missing filter column${info.missingFilterColumns.length === 1 ? '' : 's'}: ${info.missingFilterColumns.join(', ')}`;
        }
        return {
          colA: pair.colA,
          colB: pair.colB,
          diff: pair.diff,
          valueColumn: spec.valueColumn,
          filterSummary: spec.filters
            .map((filter) => `${filter.column} ∈ {${Array.from(filter.values).join(', ')}}`)
            .join(' AND '),
          accountingSum: sum,
          matchedRows: info.matchedRows,
          nonNumericSkipped: info.nonNumericSkipped,
          delta,
          status,
          note
        };
      });

      setReconResults({ rowCount: streamResult.rowCount, rows });
    } catch (runError) {
      if (runError?.name !== 'AbortError') {
        setError(runError.message || 'Something went wrong while streaming the accounting file.');
      }
    } finally {
      setRunning(false);
      abortRef.current = null;
    }
  }, [accounting, canRun, pairSpecs, pairs, rules]);

  const configuredCount = pairSpecs.length;

  return (
    <section className="card bg-base-100 border border-base-300 shadow-sm">
      <div className="card-body gap-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <h2 className="card-title text-base">3. Reconcile with accounting file</h2>
            <p className="text-sm text-base-content/60">
              Upload the accounting CSV, then for each column-diff row pick the value column to
              sum and add filters like{' '}
              <span className="font-mono">glcode ∈ {'{2134, 235}'}</span> AND{' '}
              <span className="font-mono">transactiontype ∈ {'{1, 0}'}</span>. We stream once and
              subtract the resulting sum from each diff.
            </p>
          </div>
          {accounting.file ? (
            <button
              type="button"
              className="btn btn-sm btn-ghost"
              onClick={handleClearFile}
              disabled={running}
            >
              Remove file
            </button>
          ) : null}
        </div>

        {error ? (
          <div role="alert" className="alert alert-error">
            <span>{error}</span>
          </div>
        ) : null}

        <FileUpload
          label="Accounting file"
          file={accounting}
          loading={peeking}
          onChange={handleFileChange}
        />

        {accounting.file && accounting.headers.length > 0 ? (
          <div className="flex flex-col gap-3">
            <div className="text-xs text-base-content/60">
              {configuredCount} of {pairs.length} pair{pairs.length === 1 ? '' : 's'} configured.
              Rules without a value column or with no active filters are skipped.
            </div>

            {pairs.map((pair) => {
              const key = pairKey(pair);
              const rule = rules[key] ?? emptyRule();
              return (
                <PairRuleCard
                  key={key}
                  pair={pair}
                  rule={rule}
                  headers={accounting.headers}
                  onValueColumnChange={(column) => handleValueColumnChange(key, column)}
                  onFilterColumnChange={(filterId, column) =>
                    handleFilterColumnChange(key, filterId, column)
                  }
                  onFilterValuesChange={(filterId, valuesText) =>
                    handleFilterValuesChange(key, filterId, valuesText)
                  }
                  onAddFilter={() => handleAddFilter(key)}
                  onRemoveFilter={(filterId) => handleRemoveFilter(key, filterId)}
                  onClearRule={() => handleClearRule(key)}
                  disabled={running}
                />
              );
            })}

            <div className="flex items-center justify-end gap-2">
              {running ? (
                <button
                  type="button"
                  className="btn btn-error btn-outline"
                  onClick={handleCancel}
                >
                  Cancel
                </button>
              ) : (
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={handleRun}
                  disabled={!canRun}
                  title={
                    configuredCount === 0
                      ? 'Configure at least one pair with a value column and filters.'
                      : 'Stream the accounting file and check the sums.'
                  }
                >
                  Reconcile
                </button>
              )}
            </div>

            {running || progress > 0 ? (
              <ProgressBar
                label={`Accounting · ${accounting.name}`}
                percent={progress}
                subtitle={running ? 'Streaming accounting rows, memory stays constant.' : null}
              />
            ) : null}
          </div>
        ) : null}

        {reconResults ? (
          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wide text-base-content/60 mb-2">
              Reconciliation ({reconResults.rowCount.toLocaleString()} rows scanned)
            </h3>
            <div className="overflow-x-auto rounded-xl border border-base-300">
              <table className="table table-sm">
                <thead className="bg-base-200/60">
                  <tr>
                    <th>Pair</th>
                    <th>Rule</th>
                    <th className="text-right">Diff (A − B)</th>
                    <th className="text-right">Σ accounting</th>
                    <th className="text-right">Matched rows</th>
                    <th className="text-right">Δ (diff − sum)</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {reconResults.rows.map((row) => (
                    <tr key={`${row.colA}::${row.colB}`} className="hover align-top">
                      <td>
                        <div className="font-medium">{row.colA}</div>
                        <div className="text-xs text-base-content/60">↔ {row.colB}</div>
                      </td>
                      <td className="text-xs">
                        {row.valueColumn ? (
                          <>
                            <div>
                              <span className="text-base-content/60">Σ </span>
                              <span className="font-mono font-medium">{row.valueColumn}</span>
                            </div>
                            {row.filterSummary ? (
                              <div className="text-base-content/70 font-mono">
                                where {row.filterSummary}
                              </div>
                            ) : null}
                          </>
                        ) : (
                          <span className="text-base-content/50">— not configured —</span>
                        )}
                        {row.note ? (
                          <div className="text-warning text-[11px] mt-1">{row.note}</div>
                        ) : null}
                      </td>
                      <td className="text-right tabular-nums whitespace-nowrap">
                        {formatNumber(row.diff)}
                      </td>
                      <td className="text-right tabular-nums whitespace-nowrap">
                        {row.accountingSum === null ? '—' : formatNumber(row.accountingSum)}
                      </td>
                      <td className="text-right tabular-nums whitespace-nowrap">
                        {row.accountingSum === null ? '—' : row.matchedRows.toLocaleString()}
                      </td>
                      <td className="text-right tabular-nums whitespace-nowrap">
                        {row.delta === null ? '—' : formatNumber(row.delta)}
                      </td>
                      <td>
                        {row.status === 'match' ? (
                          <span className="badge badge-success badge-outline gap-1">
                            <span aria-hidden="true">✓</span> Matches
                          </span>
                        ) : row.status === 'mismatch' ? (
                          <span className="badge badge-error badge-outline gap-1">
                            <span aria-hidden="true">✗</span> Off by {formatNumber(row.delta)}
                          </span>
                        ) : row.status === 'error' ? (
                          <span className="badge badge-warning badge-outline">Rule error</span>
                        ) : (
                          <span className="badge badge-ghost badge-outline">Skipped</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}

function PairRuleCard({
  pair,
  rule,
  headers,
  onValueColumnChange,
  onFilterColumnChange,
  onFilterValuesChange,
  onAddFilter,
  onRemoveFilter,
  onClearRule,
  disabled
}) {
  return (
    <div className="rounded-xl border border-base-300 bg-base-200/40 p-4">
      <div className="flex items-start justify-between flex-wrap gap-2 mb-3">
        <div className="min-w-0">
          <div className="text-sm font-semibold truncate">
            {pair.colA} <span className="opacity-60">↔</span> {pair.colB}
          </div>
          <div className="text-xs text-base-content/60">
            Diff (A − B): <span className="font-medium">{formatNumber(pair.diff)}</span>
          </div>
        </div>
        <button
          type="button"
          className="btn btn-xs btn-ghost"
          onClick={onClearRule}
          disabled={disabled}
        >
          Clear rule
        </button>
      </div>

      <div className="mb-3">
        <SearchableSelect
          label="Value column to sum"
          value={rule.valueColumn}
          options={headers}
          onChange={onValueColumnChange}
          disabled={disabled}
          placeholder="Pick the column that holds the amount…"
        />
      </div>

      <div className="text-xs font-medium text-base-content/70 mb-1">
        Filters (all must match)
      </div>
      <div className="flex flex-col gap-2">
        {rule.filters.map((filter, index) => (
          <div
            key={filter.id}
            className="grid gap-2 md:grid-cols-[minmax(0,1fr)_minmax(0,2fr)_auto] md:items-end"
          >
            <SearchableSelect
              value={filter.column}
              options={headers}
              onChange={(value) => onFilterColumnChange(filter.id, value)}
              placeholder="Column name…"
              disabled={disabled}
            />
            <input
              type="text"
              className="input input-bordered w-full text-sm min-h-12"
              value={filter.valuesText}
              onChange={(event) => onFilterValuesChange(filter.id, event.target.value)}
              placeholder="Allowed values, comma-separated (e.g. 2134, 235)"
              disabled={disabled}
            />
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => onRemoveFilter(filter.id)}
              disabled={disabled}
              aria-label={`Remove filter row ${index + 1}`}
            >
              Remove
            </button>
          </div>
        ))}
      </div>

      <div className="mt-2">
        <button
          type="button"
          className="btn btn-xs btn-outline"
          onClick={onAddFilter}
          disabled={disabled}
        >
          + Add filter
        </button>
      </div>
    </div>
  );
}
