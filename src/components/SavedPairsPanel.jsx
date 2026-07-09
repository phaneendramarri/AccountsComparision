import { useState } from 'react';

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
  onRename,
  onClearAll,
  disabled
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [renamingId, setRenamingId] = useState(null);
  const [renameDraft, setRenameDraft] = useState('');

  function beginRename(setup) {
    setRenamingId(setup.id);
    setRenameDraft(setup.label ?? '');
  }

  function commitRename() {
    if (renamingId != null && onRename) {
      onRename(renamingId, renameDraft);
    }
    setRenamingId(null);
    setRenameDraft('');
  }

  function cancelRename() {
    setRenamingId(null);
    setRenameDraft('');
  }

  const hasItems = savedPairs.length > 0;

  return (
    <section className="card bg-base-100 border border-base-300 shadow-sm">
      <div className="card-body gap-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <button
            type="button"
            className="flex items-center gap-2 text-left"
            onClick={() => setCollapsed((current) => !current)}
            aria-expanded={!collapsed}
          >
            <span
              aria-hidden="true"
              className={[
                'inline-block transition-transform text-base-content/60',
                collapsed ? '' : 'rotate-90'
              ].join(' ')}
            >
              ▶
            </span>
            <span>
              <span className="block card-title text-base">Saved pairs (local settings)</span>
              <span className="block text-xs text-base-content/60">
                {hasItems
                  ? `${savedPairs.length} setup${savedPairs.length === 1 ? '' : 's'} stored in your browser.`
                  : 'Nothing saved yet. Use “Save to local settings” below.'}
              </span>
            </span>
          </button>
          <div className="flex items-center gap-2">
            {hasItems ? (
              <button
                type="button"
                className="btn btn-ghost btn-xs"
                onClick={onClearAll}
                disabled={disabled}
              >
                Clear all
              </button>
            ) : null}
            <button
              type="button"
              className="btn btn-ghost btn-xs"
              onClick={() => setCollapsed((current) => !current)}
            >
              {collapsed ? 'Show' : 'Hide'}
            </button>
          </div>
        </div>

        {!collapsed ? (
          hasItems ? (
            <ul className="flex flex-col gap-2">
              {savedPairs.map((setup) => {
                const missing = findMissing(setup, headersA, headersB);
                const canApply =
                  !disabled &&
                  missing.length === 0 &&
                  headersA.length > 0 &&
                  headersB.length > 0;
                const isRenaming = renamingId === setup.id;

                return (
                  <li
                    key={setup.id}
                    className="rounded-lg border border-base-300 p-3 flex flex-col gap-2 md:flex-row md:items-center md:justify-between"
                  >
                    <div className="min-w-0 flex-1">
                      {isRenaming ? (
                        <input
                          type="text"
                          className="input input-bordered input-sm w-full max-w-md"
                          value={renameDraft}
                          onChange={(event) => setRenameDraft(event.target.value)}
                          autoFocus
                          onKeyDown={(event) => {
                            if (event.key === 'Enter') commitRename();
                            if (event.key === 'Escape') cancelRename();
                          }}
                          placeholder="New name for this setup"
                        />
                      ) : (
                        <div className="font-medium truncate">{setup.label}</div>
                      )}
                      <div className="text-xs text-base-content/60">
                        {setup.comparisons.length} pair
                        {setup.comparisons.length === 1 ? '' : 's'} · saved{' '}
                        {formatSavedTime(setup.savedAt)}
                      </div>
                      {missing.length > 0 ? (
                        <div className="text-xs text-warning mt-1">
                          Missing in current files: {missing.join(', ')}
                        </div>
                      ) : null}
                    </div>

                    <div className="flex gap-2 shrink-0">
                      {isRenaming ? (
                        <>
                          <button
                            type="button"
                            className="btn btn-sm btn-primary"
                            onClick={commitRename}
                          >
                            Save name
                          </button>
                          <button
                            type="button"
                            className="btn btn-sm btn-ghost"
                            onClick={cancelRename}
                          >
                            Cancel
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            type="button"
                            className="btn btn-sm btn-primary"
                            onClick={() => onApply(setup)}
                            disabled={!canApply}
                          >
                            Apply
                          </button>
                          {onRename ? (
                            <button
                              type="button"
                              className="btn btn-sm btn-ghost"
                              onClick={() => beginRename(setup)}
                              disabled={disabled}
                            >
                              Rename
                            </button>
                          ) : null}
                          <button
                            type="button"
                            className="btn btn-sm btn-ghost"
                            onClick={() => onRemove(setup.id)}
                            disabled={disabled}
                          >
                            Remove
                          </button>
                        </>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="text-sm text-base-content/60">
              Nothing saved yet. Add pairs and press <b>Save to local settings</b> to reuse them later.
            </p>
          )
        ) : null}
      </div>
    </section>
  );
}
