import { useRef, useState } from 'react';

function formatSavedTime(iso) {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return '';
  }
}

function findMissingPairColumns(setup, headersA, headersB) {
  const missing = [];
  setup.pairs.forEach((pair) => {
    if (headersA.length > 0 && !headersA.includes(pair.colA)) missing.push(`A: ${pair.colA}`);
    if (headersB.length > 0 && !headersB.includes(pair.colB)) missing.push(`B: ${pair.colB}`);
  });
  return missing;
}

function countRules(setup) {
  const rules = setup.accountingRules ?? {};
  const keys = Object.keys(rules);
  let parts = 0;
  keys.forEach((key) => {
    parts += (rules[key]?.parts ?? []).length;
  });
  return { withRules: keys.length, parts };
}

function triggerDownload(filename, text) {
  const blob = new Blob([text], { type: 'application/json;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function SavedSetupsPanel({
  setups,
  headersA,
  headersB,
  onApply,
  onRename,
  onRemove,
  onClearAll,
  onLoadDefaults,
  onImport,
  onSaveCurrent,
  currentPairsCount = 0,
  currentActiveRulesCount = 0,
  currentRulePartsCount = 0,
  exportSetupJson,
  exportAllJson,
  disabled
}) {
  const [renamingId, setRenamingId] = useState(null);
  const [renameDraft, setRenameDraft] = useState('');
  const [importStatus, setImportStatus] = useState(null);
  const [saveDraft, setSaveDraft] = useState('');
  const [saveFeedback, setSaveFeedback] = useState(null);
  const fileInputRef = useRef(null);

  const hasSetups = setups.length > 0;
  const canSaveCurrent = currentPairsCount > 0 && Boolean(onSaveCurrent);

  function beginRename(setup) {
    setRenamingId(setup.id);
    setRenameDraft(setup.label ?? '');
  }

  function commitRename() {
    if (renamingId != null) onRename(renamingId, renameDraft);
    setRenamingId(null);
    setRenameDraft('');
  }

  function cancelRename() {
    setRenamingId(null);
    setRenameDraft('');
  }

  function handleExportOne(setup) {
    const json = exportSetupJson(setup.id);
    if (!json) return;
    const safeName = (setup.label || 'setup').replace(/[^a-z0-9-_]+/gi, '-').slice(0, 60);
    triggerDownload(`accounts-setup-${safeName}.json`, json);
  }

  function handleExportAll() {
    triggerDownload('accounts-setups.json', exportAllJson);
  }

  function handleImportClick() {
    fileInputRef.current?.click();
  }

  async function handleImportFile(event) {
    const file = event.target.files?.[0];
    // Always reset the input so the same file can be re-imported.
    event.target.value = '';
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const result = onImport(parsed);
      setImportStatus({ added: result.added, errors: result.errors });
    } catch (err) {
      setImportStatus({ added: 0, errors: [err.message || 'Failed to read the file.'] });
    }
  }

  function handleSaveCurrent() {
    if (!canSaveCurrent) return;
    onSaveCurrent(saveDraft);
    setSaveFeedback({
      pairs: currentPairsCount,
      rules: currentActiveRulesCount,
      parts: currentRulePartsCount,
      label: saveDraft.trim()
    });
    setSaveDraft('');
  }

  return (
    <div className="flex flex-col gap-3">
      {onSaveCurrent ? (
        <div className="rounded-xl border border-primary/40 bg-primary/5 p-3 flex flex-col gap-2">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="text-sm font-semibold">Save current setup</div>
            <div className="text-xs text-base-content/60">
              {currentPairsCount > 0 ? (
                <>
                  {currentPairsCount} pair{currentPairsCount === 1 ? '' : 's'} ·{' '}
                  {currentActiveRulesCount} with accounting rule{currentActiveRulesCount === 1 ? '' : 's'} ({currentRulePartsCount} part{currentRulePartsCount === 1 ? '' : 's'})
                </>
              ) : (
                'Add at least one pair before saving.'
              )}
            </div>
          </div>
          <div className="grid gap-2 md:grid-cols-[1fr_auto] md:items-stretch">
            <input
              type="text"
              className="input input-bordered input-sm min-h-11"
              placeholder="Give this setup a name (optional)…"
              value={saveDraft}
              onChange={(event) => setSaveDraft(event.target.value)}
              disabled={disabled || !canSaveCurrent}
              onKeyDown={(event) => {
                if (event.key === 'Enter') handleSaveCurrent();
              }}
            />
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={handleSaveCurrent}
              disabled={disabled || !canSaveCurrent}
              title="Store current pairs and accounting rules in this browser (single JSON)"
            >
              Save to local
            </button>
          </div>
          {saveFeedback ? (
            <div className="text-xs text-success flex items-center justify-between gap-2">
              <span>
                Saved{saveFeedback.label ? ` as “${saveFeedback.label}”` : ''}: {saveFeedback.pairs} pair{saveFeedback.pairs === 1 ? '' : 's'}, {saveFeedback.rules} with rules ({saveFeedback.parts} part{saveFeedback.parts === 1 ? '' : 's'}).
              </span>
              <button
                type="button"
                className="btn btn-ghost btn-xs"
                onClick={() => setSaveFeedback(null)}
              >
                Dismiss
              </button>
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="text-sm text-base-content/70">
          {hasSetups
            ? `${setups.length} saved setup${setups.length === 1 ? '' : 's'} in this browser.`
            : 'No saved setups yet. Import a JSON, load defaults, or configure and save one below.'}
        </div>
        <div className="flex flex-wrap gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={handleImportFile}
          />
          <button
            type="button"
            className="btn btn-xs btn-outline"
            onClick={handleImportClick}
            disabled={disabled}
          >
            Import JSON…
          </button>
          <button
            type="button"
            className="btn btn-xs btn-ghost"
            onClick={onLoadDefaults}
            disabled={disabled}
          >
            Load sample setups
          </button>
          {hasSetups ? (
            <button
              type="button"
              className="btn btn-xs btn-ghost"
              onClick={handleExportAll}
              disabled={disabled}
            >
              Export all
            </button>
          ) : null}
          {hasSetups ? (
            <button
              type="button"
              className="btn btn-xs btn-ghost text-error"
              onClick={onClearAll}
              disabled={disabled}
            >
              Clear all
            </button>
          ) : null}
        </div>
      </div>

      {importStatus ? (
        <div
          className={[
            'alert alert-sm',
            importStatus.errors && importStatus.errors.length > 0
              ? 'alert-warning'
              : 'alert-success'
          ].join(' ')}
        >
          <div className="text-sm">
            {importStatus.added > 0
              ? `Imported ${importStatus.added} setup${importStatus.added === 1 ? '' : 's'}.`
              : 'No setups imported.'}
            {importStatus.errors && importStatus.errors.length > 0 ? (
              <ul className="list-disc ml-4 mt-1">
                {importStatus.errors.map((err, index) => (
                  <li key={index}>{err}</li>
                ))}
              </ul>
            ) : null}
          </div>
          <button
            type="button"
            className="btn btn-ghost btn-xs"
            onClick={() => setImportStatus(null)}
          >
            Dismiss
          </button>
        </div>
      ) : null}

      {hasSetups ? (
        <ul className="flex flex-col gap-2">
          {setups.map((setup) => {
            const missing = findMissingPairColumns(setup, headersA, headersB);
            const { withRules, parts } = countRules(setup);
            const canApply = !disabled && setup.pairs.length > 0;
            const isRenaming = renamingId === setup.id;

            return (
              <li
                key={setup.id}
                className="rounded-lg border border-base-300 p-3 flex flex-col gap-2 md:flex-row md:items-start md:justify-between"
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
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium truncate">{setup.label}</span>
                      {setup.isDefault ? (
                        <span className="badge badge-ghost badge-sm">sample</span>
                      ) : null}
                    </div>
                  )}
                  <div className="text-xs text-base-content/60">
                    {setup.pairs.length} pair{setup.pairs.length === 1 ? '' : 's'} ·{' '}
                    {withRules} with rules ({parts} part{parts === 1 ? '' : 's'}) · saved{' '}
                    {formatSavedTime(setup.savedAt)}
                  </div>
                  {missing.length > 0 ? (
                    <div className="text-xs text-warning mt-1">
                      Missing in current files: {missing.join(', ')}
                    </div>
                  ) : null}
                </div>

                <div className="flex gap-2 shrink-0 flex-wrap">
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
                        title={
                          missing.length > 0
                            ? 'Some referenced columns are missing in the current files. Applying will still fill in the pairs and rules – columns that do not exist will simply be flagged when you run.'
                            : 'Load this setup into the pair builder and reconciliation rules.'
                        }
                      >
                        Apply
                      </button>
                      <button
                        type="button"
                        className="btn btn-sm btn-ghost"
                        onClick={() => handleExportOne(setup)}
                        disabled={disabled}
                      >
                        Export
                      </button>
                      <button
                        type="button"
                        className="btn btn-sm btn-ghost"
                        onClick={() => beginRename(setup)}
                        disabled={disabled}
                      >
                        Rename
                      </button>
                      <button
                        type="button"
                        className="btn btn-sm btn-ghost text-error"
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
      ) : null}
    </div>
  );
}
