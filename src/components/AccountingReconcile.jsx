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

let idCounter = 0;
const nextId = (prefix) => {
  idCounter += 1;
  return `${prefix}_${idCounter}`;
};

function pairKey(pair) {
  return `${pair.colA}::${pair.colB}`;
}

function parseFilterValues(raw) {
  return new Set(
    (raw || '')
      .split(',')
      .map((token) => token.trim().toLowerCase())
      .filter(Boolean)
  );
}

function emptyFilter() {
  return { id: nextId('f'), column: '', valuesText: '' };
}

function emptyPart(sign = 1) {
  return {
    id: nextId('p'),
    sign,
    column: '',
    filters: [emptyFilter()]
  };
}

function emptyRule() {
  return { parts: [emptyPart(1)] };
}

// Human-readable expression for the UI/CSV.
// Example: `+ Σ(amount where glcode ∈ {2134,235}) − Σ(refund where txntype ∈ {1})`
function formatPartExpression(part, { leading = false } = {}) {
  if (!part.column) return '';
  const filterStr =
    part.filters && part.filters.length > 0
      ? ' where ' +
        part.filters
          .map((filter) => `${filter.column} ∈ {${Array.from(filter.values).join(', ')}}`)
          .join(' AND ')
      : '';
  const body = `Σ(${part.column}${filterStr})`;
  if (leading) return part.sign === -1 ? `− ${body}` : body;
  return part.sign === -1 ? `− ${body}` : `+ ${body}`;
}

function formatRuleExpression(activeParts) {
  if (!activeParts || activeParts.length === 0) return '';
  return activeParts
    .map((part, index) => formatPartExpression(part, { leading: index === 0 }))
    .filter(Boolean)
    .join(' ');
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

  useEffect(() => {
    const fresh = {};
    pairs.forEach((pair) => {
      fresh[pairKey(pair)] = emptyRule();
    });
    setRules(fresh);
    setReconResults(null);
  }, [pairs]);

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
          if (!rule) return null;
          const parts = rule.parts
            .filter((part) => part.column)
            .map((part) => ({
              sign: part.sign === -1 ? -1 : 1,
              column: part.column,
              filters: part.filters
                .map((filter) => ({
                  column: filter.column,
                  values: parseFilterValues(filter.valuesText)
                }))
                .filter((filter) => filter.column && filter.values.size > 0)
            }));
          if (parts.length === 0) return null;
          return { key, parts };
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

  const updatePart = useCallback(
    (key, partId, updater) => {
      updateRule(key, (rule) => ({
        ...rule,
        parts: rule.parts.map((part) => (part.id === partId ? updater(part) : part))
      }));
    },
    [updateRule]
  );

  const handleAddPart = useCallback(
    (key, sign = 1) => {
      updateRule(key, (rule) => ({ ...rule, parts: [...rule.parts, emptyPart(sign)] }));
    },
    [updateRule]
  );

  const handleRemovePart = useCallback(
    (key, partId) => {
      updateRule(key, (rule) => ({
        ...rule,
        parts: rule.parts.length <= 1 ? [emptyPart(1)] : rule.parts.filter((p) => p.id !== partId)
      }));
    },
    [updateRule]
  );

  const handlePartSignChange = useCallback(
    (key, partId, sign) => {
      updatePart(key, partId, (part) => ({ ...part, sign: sign === -1 ? -1 : 1 }));
    },
    [updatePart]
  );

  const handlePartColumnChange = useCallback(
    (key, partId, column) => {
      updatePart(key, partId, (part) => ({ ...part, column }));
    },
    [updatePart]
  );

  const handleAddFilter = useCallback(
    (key, partId) => {
      updatePart(key, partId, (part) => ({
        ...part,
        filters: [...part.filters, emptyFilter()]
      }));
    },
    [updatePart]
  );

  const handleRemoveFilter = useCallback(
    (key, partId, filterId) => {
      updatePart(key, partId, (part) => ({
        ...part,
        filters:
          part.filters.length <= 1
            ? [emptyFilter()]
            : part.filters.filter((filter) => filter.id !== filterId)
      }));
    },
    [updatePart]
  );

  const handleFilterColumnChange = useCallback(
    (key, partId, filterId, column) => {
      updatePart(key, partId, (part) => ({
        ...part,
        filters: part.filters.map((filter) =>
          filter.id === filterId ? { ...filter, column } : filter
        )
      }));
    },
    [updatePart]
  );

  const handleFilterValuesChange = useCallback(
    (key, partId, filterId, valuesText) => {
      updatePart(key, partId, (part) => ({
        ...part,
        filters: part.filters.map((filter) =>
          filter.id === filterId ? { ...filter, valuesText } : filter
        )
      }));
    },
    [updatePart]
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
            expression: '',
            accountingSum: null,
            matchedRows: 0,
            delta: null,
            status: 'unmapped',
            note: 'Pick at least one column to include this pair.'
          };
        }
        const spec = pairSpecs.find((entry) => entry.key === key);
        const info = streamResult.byPair[key];
        const sum = info.totalSum;
        const delta = pair.diff - sum;
        const expression = formatRuleExpression(spec.parts);
        let status = Math.abs(delta) < MATCH_EPSILON ? 'match' : 'mismatch';
        let note = '';
        if (info.missingColumns.length > 0) {
          status = 'error';
          const uniqueMissing = Array.from(new Set(info.missingColumns));
          note = `Missing column${uniqueMissing.length === 1 ? '' : 's'} in accounting file: ${uniqueMissing.join(', ')}`;
        }
        return {
          colA: pair.colA,
          colB: pair.colB,
          diff: pair.diff,
          expression,
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
              Build a formula per pair from any number of add/subtract parts. Each part is its
              own filtered sum, e.g.{' '}
              <span className="font-mono">+ Σ(amount where glcode ∈ {'{2134}'})</span>{' '}
              <span className="font-mono">− Σ(refund where txntype ∈ {'{1}'})</span>. Filters are
              independent per part.
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
              Rules without any part column are skipped.
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
                  onPartSignChange={(partId, sign) => handlePartSignChange(key, partId, sign)}
                  onPartColumnChange={(partId, column) =>
                    handlePartColumnChange(key, partId, column)
                  }
                  onAddPart={(sign) => handleAddPart(key, sign)}
                  onRemovePart={(partId) => handleRemovePart(key, partId)}
                  onAddFilter={(partId) => handleAddFilter(key, partId)}
                  onRemoveFilter={(partId, filterId) =>
                    handleRemoveFilter(key, partId, filterId)
                  }
                  onFilterColumnChange={(partId, filterId, column) =>
                    handleFilterColumnChange(key, partId, filterId, column)
                  }
                  onFilterValuesChange={(partId, filterId, valuesText) =>
                    handleFilterValuesChange(key, partId, filterId, valuesText)
                  }
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
                      ? 'Give at least one pair a value column.'
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
                        {row.expression ? (
                          <div className="font-mono whitespace-pre-wrap break-words">
                            {row.expression}
                          </div>
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
  onPartSignChange,
  onPartColumnChange,
  onAddPart,
  onRemovePart,
  onAddFilter,
  onRemoveFilter,
  onFilterColumnChange,
  onFilterValuesChange,
  onClearRule,
  disabled
}) {
  const preview = formatRuleExpression(
    rule.parts
      .filter((part) => part.column)
      .map((part) => ({
        sign: part.sign,
        column: part.column,
        filters: part.filters
          .map((filter) => ({
            column: filter.column,
            values: parseFilterValues(filter.valuesText)
          }))
          .filter((filter) => filter.column && filter.values.size > 0)
      }))
  );

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

      <div className="flex flex-col gap-3">
        {rule.parts.map((part, index) => (
          <PartCard
            key={part.id}
            index={index}
            part={part}
            headers={headers}
            disabled={disabled}
            onSignChange={(sign) => onPartSignChange(part.id, sign)}
            onColumnChange={(column) => onPartColumnChange(part.id, column)}
            onRemovePart={() => onRemovePart(part.id)}
            onAddFilter={() => onAddFilter(part.id)}
            onRemoveFilter={(filterId) => onRemoveFilter(part.id, filterId)}
            onFilterColumnChange={(filterId, column) =>
              onFilterColumnChange(part.id, filterId, column)
            }
            onFilterValuesChange={(filterId, valuesText) =>
              onFilterValuesChange(part.id, filterId, valuesText)
            }
          />
        ))}
      </div>

      <div className="mt-3 flex items-center justify-between flex-wrap gap-2">
        <div className="flex gap-2">
          <button
            type="button"
            className="btn btn-xs btn-success btn-outline"
            onClick={() => onAddPart(1)}
            disabled={disabled}
          >
            + Add (sum a column)
          </button>
          <button
            type="button"
            className="btn btn-xs btn-error btn-outline"
            onClick={() => onAddPart(-1)}
            disabled={disabled}
          >
            − Subtract (subtract a column)
          </button>
        </div>
        {preview ? (
          <div className="text-xs text-base-content/60 font-mono truncate max-w-full">
            = {preview}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function PartCard({
  index,
  part,
  headers,
  disabled,
  onSignChange,
  onColumnChange,
  onRemovePart,
  onAddFilter,
  onRemoveFilter,
  onFilterColumnChange,
  onFilterValuesChange
}) {
  const signIsAdd = part.sign !== -1;
  const stripeClass = signIsAdd
    ? 'border-success/40 bg-success/5'
    : 'border-error/40 bg-error/5';

  return (
    <div className={`rounded-lg border ${stripeClass} p-3`}>
      <div className="grid gap-2 md:grid-cols-[auto_minmax(0,1fr)_auto] md:items-end">
        <label className="form-control w-full md:w-40">
          <span className="label label-text-alt text-base-content/70 pb-1">
            Operation
          </span>
          <select
            className="select select-bordered select-sm min-h-12"
            value={signIsAdd ? '1' : '-1'}
            onChange={(event) => onSignChange(event.target.value === '-1' ? -1 : 1)}
            disabled={disabled}
          >
            <option value="1">Add (+)</option>
            <option value="-1">Subtract (−)</option>
          </select>
        </label>
        <div>
          <div className="label pb-1">
            <span className="label-text-alt text-base-content/70">
              Column to sum
            </span>
          </div>
          <SearchableSelect
            value={part.column}
            options={headers}
            onChange={onColumnChange}
            placeholder={index === 0 ? 'Pick the value column (e.g. amount)…' : 'Column…'}
            disabled={disabled}
          />
        </div>
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={onRemovePart}
          disabled={disabled}
          aria-label={`Remove part ${index + 1}`}
        >
          Remove part
        </button>
      </div>

      <div className="mt-3">
        <div className="text-[11px] font-medium text-base-content/70 mb-1 uppercase tracking-wide">
          Filters for this part (all must match)
        </div>
        <div className="flex flex-col gap-2">
          {part.filters.map((filter, filterIndex) => (
            <div
              key={filter.id}
              className="grid gap-2 md:grid-cols-[minmax(0,1fr)_minmax(0,2fr)_auto] md:items-end"
            >
              <SearchableSelect
                value={filter.column}
                options={headers}
                onChange={(value) => onFilterColumnChange(filter.id, value)}
                placeholder="Filter column…"
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
                className="btn btn-ghost btn-xs"
                onClick={() => onRemoveFilter(filter.id)}
                disabled={disabled}
                aria-label={`Remove filter ${filterIndex + 1} in part ${index + 1}`}
              >
                Remove filter
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
            + Add filter to this part
          </button>
        </div>
      </div>
    </div>
  );
}
