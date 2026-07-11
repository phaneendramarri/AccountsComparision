import React from 'react';
import { SearchableSelect } from './SearchableSelect';
import { emptyFilter, emptyPart, emptyRule, formatRulePreview } from '../lib/rules';
import { formatSideLabel, getPartsA, getPartsB } from '../lib/engine';
import { Calculator, Plus, Minus, Filter, RotateCcw, Trash2 } from 'lucide-react';

function pairKey(pair) {
  return `${pair.colA}::${pair.colB}`;
}

export function RuleEditor({
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

  if (pairs.length === 0) {
    return (
      <p className="text-sm text-base-content/60">
        First add column pairs in Step 3 to configure accounting rules for them.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2 text-xs sm:text-sm text-base-content/70 bg-base-200/60 p-3.5 rounded-xl border border-base-content/5">
        <Calculator className="w-4 h-4 text-accent shrink-0" />
        <span>
          {hasHeaders
            ? 'Configure which Accounting columns to Add (+) or Subtract (−) along with filter conditions (e.g. TransactionType = Billing). You can add two columns and subtract one column easily.'
            : 'Upload an Accounting CSV in Step 1 to select columns and apply filter rules.'}
        </span>
      </div>

      {pairs.map((pair) => {
        const key = pairKey(pair);
        const rule = rules[key] ?? emptyRule();
        const preview = formatRulePreview(rule);
        const labelA = formatSideLabel(getPartsA(pair), pair.colA);
        const labelB = formatSideLabel(getPartsB(pair), pair.colB);

        return (
          <div
            key={key}
            className="rounded-2xl border border-base-content/10 bg-base-100 p-5 shadow-sm flex flex-col gap-4 transition-all duration-200 hover:border-accent/40"
          >
            <div className="flex items-center justify-between flex-wrap gap-2 pb-2 border-b border-base-content/5">
              <div className="flex items-center gap-2 text-sm font-bold">
                <span className="text-primary">{labelA}</span>
                <span className="text-base-content/40">↔</span>
                <span className="text-secondary">{labelB}</span>
              </div>
              <button
                type="button"
                className="btn btn-xs btn-ghost text-error gap-1 hover:bg-error/10"
                onClick={() => updateRule(key, () => emptyRule())}
                disabled={disabled}
              >
                <RotateCcw className="w-3 h-3" /> Reset Rule
              </button>
            </div>

            <div className="flex flex-col gap-3">
              {rule.parts.map((part) => (
                <div
                  key={part.id}
                  className="rounded-xl border border-base-content/10 bg-base-200/40 p-4 flex flex-col gap-3"
                >
                  <div className="grid gap-3 md:grid-cols-[130px_minmax(0,1fr)_auto] md:items-end">
                    <label className="form-control w-full">
                      <span className="label label-text-alt font-bold uppercase tracking-wider text-base-content/70 pb-1">
                        Sign
                      </span>
                      <select
                        className={`select select-bordered select-sm font-semibold ${
                          part.sign === -1 ? 'text-error border-error/40' : 'text-success border-success/40'
                        }`}
                        value={part.sign === -1 ? '-1' : '1'}
                        onChange={(e) =>
                          updatePart(key, part.id, (p) => ({
                            ...p,
                            sign: e.target.value === '-1' ? -1 : 1
                          }))
                        }
                        disabled={disabled}
                      >
                        <option value="1">+ Add Column</option>
                        <option value="-1">− Sub Column</option>
                      </select>
                    </label>

                    <div>
                      <span className="label label-text-alt font-bold uppercase tracking-wider text-base-content/70 pb-1">
                        Accounting Column to Sum
                      </span>
                      <SearchableSelect
                        value={part.column}
                        options={accountingHeaders}
                        onChange={(val) =>
                          updatePart(key, part.id, (p) => ({ ...p, column: val }))
                        }
                        placeholder={
                          hasHeaders
                            ? 'Search Accounting column (e.g. CreditAmount)…'
                            : 'Upload Accounting file first…'
                        }
                        disabled={disabled || !hasHeaders}
                      />
                    </div>

                    <button
                      type="button"
                      className="btn btn-ghost btn-sm text-base-content/60 hover:text-error"
                      onClick={() =>
                        updateRule(key, (curr) => ({
                          ...curr,
                          parts:
                            curr.parts.length <= 1
                              ? [emptyPart(1)]
                              : curr.parts.filter((p) => p.id !== part.id)
                        }))
                      }
                      disabled={disabled}
                    >
                      Remove
                    </button>
                  </div>

                  {/* Filters */}
                  <div className="pl-3 border-l-2 border-accent/40 flex flex-col gap-2.5 pt-1">
                    <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-accent">
                      <Filter className="w-3 h-3" /> Filter Conditions (All must match)
                    </div>
                    {part.filters.map((filter) => (
                      <div
                        key={filter.id}
                        className="grid gap-2 md:grid-cols-[minmax(0,1fr)_minmax(0,2fr)_auto] md:items-center"
                      >
                        <SearchableSelect
                          value={filter.column}
                          options={accountingHeaders}
                          onChange={(val) =>
                            updatePart(key, part.id, (p) => ({
                              ...p,
                              filters: p.filters.map((f) =>
                                f.id === filter.id ? { ...f, column: val } : f
                              )
                            }))
                          }
                          placeholder="Filter Column (e.g. TransactionType)…"
                          disabled={disabled || !hasHeaders}
                        />
                        <input
                          type="text"
                          className="input input-bordered input-sm w-full font-mono text-xs"
                          value={filter.valuesText}
                          onChange={(e) =>
                            updatePart(key, part.id, (p) => ({
                              ...p,
                              filters: p.filters.map((f) =>
                                f.id === filter.id ? { ...f, valuesText: e.target.value } : f
                              )
                            }))
                          }
                          placeholder="Allowed values comma-separated (e.g. Billing, Receipt)"
                          disabled={disabled}
                        />
                        <button
                          type="button"
                          className="btn btn-ghost btn-xs text-base-content/50 hover:text-error"
                          onClick={() =>
                            updatePart(key, part.id, (p) => ({
                              ...p,
                              filters:
                                p.filters.length <= 1
                                  ? [emptyFilter()]
                                  : p.filters.filter((f) => f.id !== filter.id)
                            }))
                          }
                          disabled={disabled}
                        >
                          ✕
                        </button>
                      </div>
                    ))}

                    <div>
                      <button
                        type="button"
                        className="btn btn-xs btn-outline border-base-content/20 hover:border-accent hover:text-accent gap-1"
                        onClick={() =>
                          updatePart(key, part.id, (p) => ({
                            ...p,
                            filters: [...p.filters, emptyFilter()]
                          }))
                        }
                        disabled={disabled}
                      >
                        + Add Filter Condition
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between flex-wrap gap-3 pt-2">
              <div className="flex gap-2">
                <button
                  type="button"
                  className="btn btn-xs btn-success gap-1"
                  onClick={() =>
                    updateRule(key, (curr) => ({
                      ...curr,
                      parts: [...curr.parts, emptyPart(1)]
                    }))
                  }
                  disabled={disabled}
                >
                  <Plus className="w-3 h-3" /> Add (+) Column
                </button>
                <button
                  type="button"
                  className="btn btn-xs btn-error gap-1"
                  onClick={() =>
                    updateRule(key, (curr) => ({
                      ...curr,
                      parts: [...curr.parts, emptyPart(-1)]
                    }))
                  }
                  disabled={disabled}
                >
                  <Minus className="w-3 h-3" /> Add (−) Column
                </button>
              </div>

              {preview ? (
                <div className="text-xs font-mono bg-base-200 px-3 py-1.5 rounded-lg text-base-content/80 border border-base-content/5">
                  Formula: <span className="font-semibold text-accent">{preview}</span>
                </div>
              ) : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}
