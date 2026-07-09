import { useState } from 'react';
import { SearchableSelect } from './SearchableSelect';
import { MultiSelect } from './MultiSelect';

export function PairBuilder({
  headersA,
  headersB,
  commonColumns,
  comparisons,
  onAddPair,
  onAddPairs,
  onRemoveComparison,
  onClearAll,
  onSave,
  canSave
}) {
  const [pendingColA, setPendingColA] = useState('');
  const [pendingColB, setPendingColB] = useState('');
  const [bulkSelection, setBulkSelection] = useState([]);

  const canAdd = Boolean(pendingColA && pendingColB);

  function handleAddPair() {
    if (!canAdd) return;
    onAddPair({ colA: pendingColA, colB: pendingColB });
    setPendingColA('');
    setPendingColB('');
  }

  function handleBulkAdd() {
    if (bulkSelection.length === 0) return;
    onAddPairs(bulkSelection.map((name) => ({ colA: name, colB: name })));
    setBulkSelection([]);
  }

  return (
    <section className="card bg-base-100 border border-base-300 shadow-sm">
      <div className="card-body gap-5">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <h2 className="card-title text-base">Pick numeric columns to sum</h2>
            <p className="text-sm text-base-content/60">
              Only the columns you pick are streamed and summed.
            </p>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              className="btn btn-sm btn-ghost"
              onClick={onClearAll}
              disabled={comparisons.length === 0}
            >
              Clear pairs
            </button>
            <button
              type="button"
              className="btn btn-sm btn-outline"
              onClick={onSave}
              disabled={!canSave}
              title="Remember these pairs so you can apply them to future uploads"
            >
              Save pairs
            </button>
          </div>
        </div>

        {commonColumns.length > 0 ? (
          <div className="rounded-xl border border-base-300 bg-base-200/40 p-4">
            <div className="flex items-center justify-between flex-wrap gap-2 mb-2">
              <div>
                <div className="text-sm font-semibold">
                  Quick add · columns present in both files
                </div>
                <div className="text-xs text-base-content/60">
                  {commonColumns.length} column
                  {commonColumns.length === 1 ? '' : 's'} match by name.
                </div>
              </div>
            </div>
            <MultiSelect
              values={bulkSelection}
              options={commonColumns}
              onChange={setBulkSelection}
              placeholder="Search columns present in both files…"
              actionLabel={`Add ${bulkSelection.length || ''} as pairs`.trim()}
              onAction={handleBulkAdd}
              hint="Each selection becomes a pair like column ↔ same column in File B."
            />
          </div>
        ) : null}

        <div className="rounded-xl border border-base-300 bg-base-200/40 p-4">
          <div className="text-sm font-semibold mb-3">Custom pair</div>
          <div className="grid gap-3 md:grid-cols-[1fr_1fr_auto] md:items-end">
            <SearchableSelect
              label="Column in File A"
              value={pendingColA}
              options={headersA}
              onChange={setPendingColA}
            />
            <SearchableSelect
              label="Column in File B"
              value={pendingColB}
              options={headersB}
              onChange={setPendingColB}
            />
            <button
              type="button"
              className="btn btn-primary h-12 min-h-12"
              onClick={handleAddPair}
              disabled={!canAdd}
            >
              Add pair
            </button>
          </div>
          <p className="text-xs text-base-content/60 mt-2">
            Use this when the column names differ between File A and File B.
          </p>
        </div>

        <div>
          <div className="text-sm font-semibold mb-2">
            Selected pairs ({comparisons.length})
          </div>
          {comparisons.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {comparisons.map((pair, index) => (
                <div
                  key={`${pair.colA}::${pair.colB}::${index}`}
                  className="badge badge-lg badge-outline gap-2 py-3"
                >
                  <span className="font-medium">{pair.colA}</span>
                  <span className="opacity-60">−</span>
                  <span className="font-medium">{pair.colB}</span>
                  <button
                    type="button"
                    className="btn btn-ghost btn-xs btn-circle"
                    onClick={() => onRemoveComparison(index)}
                    aria-label={`Remove ${pair.colA} vs ${pair.colB}`}
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-base-content/60">
              No pairs yet. Use quick add or the custom pair form above.
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
