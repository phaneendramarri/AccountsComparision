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
  const [matchedCollapsed, setMatchedCollapsed] = useState(false);
  const [savePromptOpen, setSavePromptOpen] = useState(false);
  const [saveLabel, setSaveLabel] = useState('');

  const canAdd = Boolean(pendingColA && pendingColB);

  const selectedMatchedSet = new Set(
    comparisons.filter((pair) => pair.colA === pair.colB).map((pair) => pair.colA)
  );

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

  function handleQuickAddMatched(name) {
    if (selectedMatchedSet.has(name)) return;
    onAddPair({ colA: name, colB: name });
  }

  function handleAddAllMatched() {
    const remaining = commonColumns.filter((name) => !selectedMatchedSet.has(name));
    if (remaining.length === 0) return;
    onAddPairs(remaining.map((name) => ({ colA: name, colB: name })));
  }

  function handleOpenSavePrompt() {
    setSaveLabel('');
    setSavePromptOpen(true);
  }

  function handleConfirmSave() {
    onSave(saveLabel.trim());
    setSaveLabel('');
    setSavePromptOpen(false);
  }

  function handleCancelSave() {
    setSaveLabel('');
    setSavePromptOpen(false);
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
              onClick={handleOpenSavePrompt}
              disabled={!canSave || savePromptOpen}
              title="Store these pairs in your browser so you can reuse them later"
            >
              Save to local settings
            </button>
          </div>
        </div>

        {savePromptOpen ? (
          <div className="rounded-xl border border-primary/40 bg-primary/5 p-4">
            <div className="text-sm font-semibold mb-2">Save current pairs</div>
            <div className="grid gap-2 md:grid-cols-[1fr_auto_auto] md:items-center">
              <input
                type="text"
                className="input input-bordered w-full min-h-12"
                placeholder="Give this setup a name (optional)…"
                value={saveLabel}
                onChange={(event) => setSaveLabel(event.target.value)}
                autoFocus
                onKeyDown={(event) => {
                  if (event.key === 'Enter') handleConfirmSave();
                  if (event.key === 'Escape') handleCancelSave();
                }}
              />
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleConfirmSave}
              >
                Save
              </button>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={handleCancelSave}
              >
                Cancel
              </button>
            </div>
            <p className="text-xs text-base-content/60 mt-2">
              Saved to your browser only. Nothing is sent anywhere. Leave the name empty to auto-generate one.
            </p>
          </div>
        ) : null}

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
          <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
            <button
              type="button"
              className="flex items-center gap-2 text-left min-w-0"
              onClick={() => setMatchedCollapsed((current) => !current)}
              aria-expanded={!matchedCollapsed}
            >
              <span
                aria-hidden="true"
                className={[
                  'inline-block transition-transform text-base-content/60',
                  matchedCollapsed ? '' : 'rotate-90'
                ].join(' ')}
              >
                ▶
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-semibold">Matched columns</span>
                <span className="block text-xs text-base-content/60">
                  {commonColumns.length > 0
                    ? `${commonColumns.length} column${commonColumns.length === 1 ? '' : 's'} share the same name in both files. Click to add as a pair.`
                    : 'No columns share the same name across the two files.'}
                </span>
              </span>
            </button>
            <div className="flex items-center gap-2">
              {commonColumns.length > 0 ? (
                <button
                  type="button"
                  className="btn btn-xs btn-outline"
                  onClick={handleAddAllMatched}
                  disabled={commonColumns.every((name) => selectedMatchedSet.has(name))}
                >
                  Add all
                </button>
              ) : null}
              {commonColumns.length > 0 ? (
                <button
                  type="button"
                  className="btn btn-xs btn-ghost"
                  onClick={() => setMatchedCollapsed((current) => !current)}
                >
                  {matchedCollapsed ? 'Show' : 'Hide'}
                </button>
              ) : null}
            </div>
          </div>
          {!matchedCollapsed && commonColumns.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {commonColumns.map((name) => {
                const isSelected = selectedMatchedSet.has(name);
                return (
                  <button
                    key={name}
                    type="button"
                    onClick={() => handleQuickAddMatched(name)}
                    disabled={isSelected}
                    className={[
                      'badge badge-lg gap-1 py-3 cursor-pointer transition',
                      isSelected
                        ? 'badge-primary badge-outline cursor-default opacity-70'
                        : 'badge-outline hover:badge-primary'
                    ].join(' ')}
                    title={isSelected ? `${name} is already added` : `Add ${name} as a pair`}
                  >
                    {isSelected ? <span aria-hidden="true">✓</span> : <span aria-hidden="true">+</span>}
                    <span className="font-medium">{name}</span>
                  </button>
                );
              })}
            </div>
          ) : null}
        </div>

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
