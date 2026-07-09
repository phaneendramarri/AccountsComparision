function formatSavedTime(iso) {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return '';
  }
}

// A saved entry can only be applied if every referenced column exists in the
// currently loaded files.
function findMissing(setup, headersA, headersB) {
  const missing = [];
  setup.comparisons.forEach((pair) => {
    if (!headersA.includes(pair.colA)) missing.push(`A: ${pair.colA}`);
    if (!headersB.includes(pair.colB)) missing.push(`B: ${pair.colB}`);
  });
  return missing;
}

export function SavedPairsPanel({
  savedPairs,
  headersA,
  headersB,
  onApply,
  onRemove,
  onClearAll,
  disabled
}) {
  if (savedPairs.length === 0) {
    return (
      <section className="card bg-base-100 border border-base-300 shadow-sm">
        <div className="card-body">
          <h2 className="card-title text-base">Saved pairs</h2>
          <p className="text-sm text-base-content/60">
            Nothing saved yet. Add pairs and press <b>Save pairs</b> to reuse them later.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="card bg-base-100 border border-base-300 shadow-sm">
      <div className="card-body gap-3">
        <div className="flex items-center justify-between">
          <h2 className="card-title text-base">Saved pairs</h2>
          <button type="button" className="btn btn-ghost btn-xs" onClick={onClearAll}>
            Clear all
          </button>
        </div>

        <ul className="flex flex-col gap-2">
          {savedPairs.map((setup) => {
            const missing = findMissing(setup, headersA, headersB);
            const canApply = !disabled && missing.length === 0 && headersA.length > 0 && headersB.length > 0;

            return (
              <li
                key={setup.id}
                className="rounded-lg border border-base-300 p-3 flex flex-col gap-2 md:flex-row md:items-center md:justify-between"
              >
                <div className="min-w-0">
                  <div className="font-medium truncate">{setup.label}</div>
                  <div className="text-xs text-base-content/60">
                    {setup.comparisons.length} pair{setup.comparisons.length === 1 ? '' : 's'} ·
                    saved {formatSavedTime(setup.savedAt)}
                  </div>
                  {missing.length > 0 ? (
                    <div className="text-xs text-warning mt-1">
                      Missing in current files: {missing.join(', ')}
                    </div>
                  ) : null}
                </div>

                <div className="flex gap-2 shrink-0">
                  <button
                    type="button"
                    className="btn btn-sm btn-primary"
                    onClick={() => onApply(setup)}
                    disabled={!canApply}
                  >
                    Apply
                  </button>
                  <button
                    type="button"
                    className="btn btn-sm btn-ghost"
                    onClick={() => onRemove(setup.id)}
                  >
                    Remove
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
