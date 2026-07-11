import { SearchableSelect } from './SearchableSelect';
import { emptyFilter, emptyPart, emptyRule, formatRulePreview } from '../lib/rules';
import { formatNumber } from '../lib/format';

function pairKey(pair) {
  return `${pair.colA}::${pair.colB}`;
}

// Renders the rule editor UI. The parent owns `rules` (map from pairKey to
// hydrated rule) and reacts to `onRulesChange`. If `accountingHeaders` is
// empty we render a placeholder telling the user to upload the file first.
//
// Props:
//   pairs            – Array<{ colA, colB, diff? }> – rows to render, one per pair
//   accountingHeaders – string[] – columns available in the accounting CSV
//   rules            – Record<pairKey, HydratedRule>
//   onRulesChange    – (nextMap) => void
//   disabled         – true while a comparison/reconciliation run is in flight
export function AccountingReconcileConfig({
  pairs,
  accountingHeaders,
  rules,
  onRulesChange,
  disabled = false
}) {
  const hasHeaders = accountingHeaders.length > 0;

  function updateRule(key, updater) {
    const existing = rules[key] ?? emptyRule();
    const next = updater(existing);
    onRulesChange({ ...rules, [key]: next });
  }

  function updatePart(key, partId, updater) {
    updateRule(key, (rule) => ({
      ...rule,
      parts: rule.parts.map((part) => (part.id === partId ? updater(part) : part))
    }));
  }

  const configuredCount = pairs.reduce((total, pair) => {
    const rule = rules[pairKey(pair)];
    return total + (rule && rule.parts.some((part) => part.column) ? 1 : 0);
  }, 0);

  if (pairs.length === 0) {
    return (
      <p className="text-sm text-base-content/60">
        Add at least one column pair above to configure accounting rules.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="text-xs text-base-content/60">
        {hasHeaders
          ? `${configuredCount} of ${pairs.length} pair${pairs.length === 1 ? '' : 's'} have an active rule. Pairs without any column are skipped when reconciling.`
          : 'Upload the accounting CSV in step 1 to unlock column pickers. You can still edit the raw filter values.'}
      </div>

      {pairs.map((pair) => {
        const key = pairKey(pair);
        const rule = rules[key] ?? emptyRule();
        return (
          <PairRuleCard
            key={key}
            pair={pair}
            rule={rule}
            headers={accountingHeaders}
            disabled={disabled}
            onSignChange={(partId, sign) =>
              updatePart(key, partId, (part) => ({ ...part, sign: sign === -1 ? -1 : 1 }))
            }
            onColumnChange={(partId, column) =>
              updatePart(key, partId, (part) => ({ ...part, column }))
            }
            onAddPart={(sign) =>
              updateRule(key, (current) => ({
                ...current,
                parts: [...current.parts, emptyPart(sign)]
              }))
            }
            onRemovePart={(partId) =>
              updateRule(key, (current) => ({
                ...current,
                parts:
                  current.parts.length <= 1
                    ? [emptyPart(1)]
                    : current.parts.filter((part) => part.id !== partId)
              }))
            }
            onAddFilter={(partId) =>
              updatePart(key, partId, (part) => ({
                ...part,
                filters: [...part.filters, emptyFilter()]
              }))
            }
            onRemoveFilter={(partId, filterId) =>
              updatePart(key, partId, (part) => ({
                ...part,
                filters:
                  part.filters.length <= 1
                    ? [emptyFilter()]
                    : part.filters.filter((filter) => filter.id !== filterId)
              }))
            }
            onFilterColumnChange={(partId, filterId, column) =>
              updatePart(key, partId, (part) => ({
                ...part,
                filters: part.filters.map((filter) =>
                  filter.id === filterId ? { ...filter, column } : filter
                )
              }))
            }
            onFilterValuesChange={(partId, filterId, valuesText) =>
              updatePart(key, partId, (part) => ({
                ...part,
                filters: part.filters.map((filter) =>
                  filter.id === filterId ? { ...filter, valuesText } : filter
                )
              }))
            }
            onClearRule={() => updateRule(key, () => emptyRule())}
          />
        );
      })}
    </div>
  );
}

function PairRuleCard({
  pair,
  rule,
  headers,
  disabled,
  onSignChange,
  onColumnChange,
  onAddPart,
  onRemovePart,
  onAddFilter,
  onRemoveFilter,
  onFilterColumnChange,
  onFilterValuesChange,
  onClearRule
}) {
  const preview = formatRulePreview(rule);

  return (
    <div className="rounded-xl border border-base-300 bg-base-200/40 p-4">
      <div className="flex items-start justify-between flex-wrap gap-2 mb-3">
        <div className="min-w-0">
          <div className="text-sm font-semibold truncate">
            {pair.colA} <span className="opacity-60">↔</span> {pair.colB}
          </div>
          {typeof pair.diff === 'number' ? (
            <div className="text-xs text-base-content/60">
              Diff (A − B): <span className="font-medium">{formatNumber(pair.diff)}</span>
            </div>
          ) : null}
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
            onSignChange={(sign) => onSignChange(part.id, sign)}
            onColumnChange={(column) => onColumnChange(part.id, column)}
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
          <span className="label label-text-alt text-base-content/70 pb-1">Operation</span>
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
            <span className="label-text-alt text-base-content/70">Column to sum</span>
          </div>
          <SearchableSelect
            value={part.column}
            options={headers}
            onChange={onColumnChange}
            placeholder={
              headers.length === 0
                ? 'Upload accounting CSV to pick a column…'
                : index === 0
                  ? 'Pick the value column (e.g. amount)…'
                  : 'Column…'
            }
            disabled={disabled || headers.length === 0}
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
                placeholder={headers.length === 0 ? 'Filter column (upload file)…' : 'Filter column…'}
                disabled={disabled || headers.length === 0}
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
