import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Header } from './components/Header';
import { FileUpload } from './components/FileUpload';
import { PairBuilder } from './components/PairBuilder';
import { SavedSetupsPanel } from './components/SavedSetupsPanel';
import { ResultsSummary } from './components/ResultsSummary';
import { AccountingReconcileConfig } from './components/AccountingReconcile';
import { ProgressBar } from './components/ProgressBar';
import { Collapsible } from './components/Collapsible';
import { useTheme } from './hooks/useTheme';
import { useSavedSetups } from './hooks/useSavedSetups';
import { peekCsvHeaders } from './lib/csv';
import {
  buildPairResults,
  buildSummaryCsv,
  computeFileSums,
  computeFilteredSums,
  downloadCsv
} from './lib/compare';
import {
  dehydrateRule,
  emptyRule,
  formatRulePreview,
  hydrateRule,
  isRuleActive,
  ruleToPairSpec
} from './lib/rules';
import { formatNumber } from './lib/format';

const emptySlot = { file: null, name: '', size: 0, headers: [] };
const MATCH_EPSILON = 0.005;

function pairKey(pair) {
  return `${pair.colA}::${pair.colB}`;
}

export default function App() {
  const { theme, toggle } = useTheme();
  const {
    setups,
    saveSetup,
    renameSetup,
    removeSetup,
    clearAll,
    loadDefaults,
    importSetups,
    exportSetupJson,
    exportAllJson
  } = useSavedSetups();

  const [fileA, setFileA] = useState(emptySlot);
  const [fileB, setFileB] = useState(emptySlot);
  const [accountingFile, setAccountingFile] = useState(emptySlot);
  const [peekingA, setPeekingA] = useState(false);
  const [peekingB, setPeekingB] = useState(false);
  const [peekingAccounting, setPeekingAccounting] = useState(false);

  const [comparisons, setComparisons] = useState([]);
  const [accountingRules, setAccountingRules] = useState({});

  const [running, setRunning] = useState(false);
  const [progressA, setProgressA] = useState(0);
  const [progressB, setProgressB] = useState(0);
  const [progressAccounting, setProgressAccounting] = useState(0);
  const [results, setResults] = useState(null);
  const [reconciliation, setReconciliation] = useState(null);
  const [error, setError] = useState('');
  const abortRef = useRef(null);

  const bothFilesReady = Boolean(fileA.file) && Boolean(fileB.file);
  const hasAccounting = Boolean(accountingFile.file);
  const canRun = bothFilesReady && comparisons.length > 0 && !running;

  const columnsA = useMemo(
    () => Array.from(new Set(comparisons.map((pair) => pair.colA))),
    [comparisons]
  );
  const columnsB = useMemo(
    () => Array.from(new Set(comparisons.map((pair) => pair.colB))),
    [comparisons]
  );

  const commonColumns = useMemo(() => {
    if (!bothFilesReady) return [];
    const setB = new Set(fileB.headers);
    return fileA.headers.filter((header) => setB.has(header));
  }, [bothFilesReady, fileA.headers, fileB.headers]);

  const activeRuleCount = useMemo(
    () =>
      comparisons.reduce((total, pair) => {
        const rule = accountingRules[pairKey(pair)];
        return total + (isRuleActive(rule) ? 1 : 0);
      }, 0),
    [comparisons, accountingRules]
  );

  const activeRulePartsCount = useMemo(
    () =>
      comparisons.reduce((total, pair) => {
        const rule = accountingRules[pairKey(pair)];
        if (!isRuleActive(rule)) return total;
        return total + rule.parts.filter((part) => part.column).length;
      }, 0),
    [comparisons, accountingRules]
  );

  // Whenever the list of pairs changes, ensure every pair has a rule entry
  // (fresh empty rule) and drop rules that no longer belong to any pair.
  useEffect(() => {
    setAccountingRules((current) => {
      const next = {};
      let changed = false;
      comparisons.forEach((pair) => {
        const key = pairKey(pair);
        if (current[key]) {
          next[key] = current[key];
        } else {
          next[key] = emptyRule();
          changed = true;
        }
      });
      // detect removed keys
      Object.keys(current).forEach((key) => {
        if (!(key in next)) changed = true;
      });
      return changed ? next : current;
    });
  }, [comparisons]);

  const handleFileChange = useCallback(async (slot, event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const [setPeek, setSlot] =
      slot === 'fileA'
        ? [setPeekingA, setFileA]
        : slot === 'fileB'
          ? [setPeekingB, setFileB]
          : [setPeekingAccounting, setAccountingFile];

    setError('');
    setResults(null);
    setReconciliation(null);
    setPeek(true);
    try {
      const headers = await peekCsvHeaders(file);
      if (headers.length === 0) {
        throw new Error('No headers were found in the first row.');
      }
      setSlot({ file, name: file.name, size: file.size, headers });
    } catch (readError) {
      setSlot(emptySlot);
      setError(readError.message || 'Could not read the file.');
    } finally {
      setPeek(false);
    }
  }, []);

  const handleAddPair = useCallback((pair) => {
    if (!pair?.colA || !pair?.colB) return;
    setComparisons((current) => {
      const exists = current.some(
        (existing) => existing.colA === pair.colA && existing.colB === pair.colB
      );
      return exists ? current : [...current, { colA: pair.colA, colB: pair.colB }];
    });
  }, []);

  const handleAddPairs = useCallback((incoming) => {
    if (!incoming?.length) return;
    setComparisons((current) => {
      const seen = new Set(current.map((pair) => `${pair.colA}::${pair.colB}`));
      const additions = [];
      incoming.forEach((pair) => {
        const key = `${pair.colA}::${pair.colB}`;
        if (!seen.has(key)) {
          additions.push({ colA: pair.colA, colB: pair.colB });
          seen.add(key);
        }
      });
      return additions.length ? [...current, ...additions] : current;
    });
  }, []);

  const handleRemovePair = useCallback((index) => {
    setComparisons((current) => current.filter((_, position) => position !== index));
  }, []);

  const handleClearPairs = useCallback(() => {
    setComparisons([]);
    setResults(null);
    setReconciliation(null);
  }, []);

  const handleRulesChange = useCallback((nextMap) => {
    setAccountingRules(nextMap);
    setReconciliation(null);
  }, []);

  const handleSaveSetup = useCallback(
    (label) => {
      if (comparisons.length === 0) return;
      const dehydrated = {};
      comparisons.forEach((pair) => {
        const key = pairKey(pair);
        const rule = accountingRules[key];
        if (rule) dehydrated[key] = dehydrateRule(rule);
      });
      saveSetup({
        label,
        pairs: comparisons,
        accountingRules: dehydrated
      });
    },
    [comparisons, accountingRules, saveSetup]
  );

  const handleApplySetup = useCallback((setup) => {
    setComparisons(setup.pairs.map((pair) => ({ ...pair })));
    const rehydrated = {};
    Object.entries(setup.accountingRules ?? {}).forEach(([key, rule]) => {
      rehydrated[key] = hydrateRule(rule);
    });
    setAccountingRules(rehydrated);
    setResults(null);
    setReconciliation(null);
  }, []);

  const handleReset = useCallback(() => {
    if (running) abortRef.current?.abort();
    setFileA(emptySlot);
    setFileB(emptySlot);
    setAccountingFile(emptySlot);
    setComparisons([]);
    setAccountingRules({});
    setResults(null);
    setReconciliation(null);
    setError('');
    setProgressA(0);
    setProgressB(0);
    setProgressAccounting(0);
  }, [running]);

  const handleCancel = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const handleRun = useCallback(async () => {
    if (!canRun) return;
    setResults(null);
    setReconciliation(null);
    setError('');
    setProgressA(0);
    setProgressB(0);
    setProgressAccounting(0);
    setRunning(true);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const resultA = await computeFileSums(fileA.file, columnsA, {
        signal: controller.signal,
        onProgress: (bytes) => {
          setProgressA(fileA.size ? (bytes / fileA.size) * 100 : 0);
        }
      });
      const resultB = await computeFileSums(fileB.file, columnsB, {
        signal: controller.signal,
        onProgress: (bytes) => {
          setProgressB(fileB.size ? (bytes / fileB.size) * 100 : 0);
        }
      });

      setProgressA(100);
      setProgressB(100);
      const pairs = buildPairResults({ comparisons, resultA, resultB });
      setResults({
        rowCountA: resultA.rowCount,
        rowCountB: resultB.rowCount,
        pairs
      });

      // Optional reconciliation pass if the user uploaded an accounting file
      // AND at least one pair has an active rule configured.
      const activeSpecs = pairs
        .map((pair) => {
          const rule = accountingRules[pairKey(pair)];
          if (!isRuleActive(rule)) return null;
          const spec = ruleToPairSpec(rule);
          if (spec.parts.length === 0) return null;
          return { key: pairKey(pair), pair, rule, ...spec };
        })
        .filter(Boolean);

      if (accountingFile.file && activeSpecs.length > 0) {
        const streamResult = await computeFilteredSums(
          accountingFile.file,
          activeSpecs.map((entry) => ({ key: entry.key, parts: entry.parts })),
          {
            signal: controller.signal,
            onProgress: (bytes) => {
              setProgressAccounting(
                accountingFile.size ? (bytes / accountingFile.size) * 100 : 0
              );
            }
          }
        );
        setProgressAccounting(100);

        const configuredKeys = new Set(activeSpecs.map((entry) => entry.key));
        const reconRows = pairs.map((pair) => {
          const key = pairKey(pair);
          const rule = accountingRules[key];
          if (!configuredKeys.has(key)) {
            return {
              colA: pair.colA,
              colB: pair.colB,
              diff: pair.diff,
              expression: rule ? formatRulePreview(rule) : '',
              accountingSum: null,
              matchedRows: 0,
              delta: null,
              status: 'unmapped',
              note: rule && isRuleActive(rule)
                ? ''
                : 'No accounting rule configured for this pair.'
            };
          }
          const info = streamResult.byPair[key];
          const sum = info.totalSum;
          const delta = pair.diff - sum;
          let status = Math.abs(delta) < MATCH_EPSILON ? 'match' : 'mismatch';
          let note = '';
          if (info.missingColumns.length > 0) {
            status = 'error';
            const unique = Array.from(new Set(info.missingColumns));
            note = `Missing column${unique.length === 1 ? '' : 's'} in accounting file: ${unique.join(', ')}`;
          }
          return {
            colA: pair.colA,
            colB: pair.colB,
            diff: pair.diff,
            expression: formatRulePreview(rule),
            accountingSum: sum,
            matchedRows: info.matchedRows,
            nonNumericSkipped: info.nonNumericSkipped,
            delta,
            status,
            note
          };
        });

        setReconciliation({
          fileName: accountingFile.name,
          rowCount: streamResult.rowCount,
          rows: reconRows
        });
      }
    } catch (runError) {
      if (runError?.name !== 'AbortError') {
        setError(runError.message || 'Something went wrong while streaming the files.');
      }
    } finally {
      setRunning(false);
      abortRef.current = null;
    }
  }, [
    accountingFile,
    accountingRules,
    canRun,
    columnsA,
    columnsB,
    comparisons,
    fileA,
    fileB
  ]);

  const handleDownload = useCallback(() => {
    if (!results) return;
    const csv = buildSummaryCsv({
      metadata: {
        generatedAt: new Date(),
        fileA: { name: fileA.name, rows: results.rowCountA },
        fileB: { name: fileB.name, rows: results.rowCountB },
        accounting: reconciliation
          ? { name: reconciliation.fileName, rowsScanned: reconciliation.rowCount }
          : undefined
      },
      results: results.pairs,
      reconciliation: reconciliation
        ? { rowCount: reconciliation.rowCount, rows: reconciliation.rows }
        : null
    });
    const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    downloadCsv(`accounts-comparison-summary-${stamp}.csv`, csv);
  }, [fileA.name, fileB.name, reconciliation, results]);

  return (
    <div className="min-h-full bg-base-200 text-base-content">
      <Header theme={theme} onToggleTheme={toggle} />

      <main className="max-w-6xl mx-auto p-4 sm:p-6 flex flex-col gap-4">
        {error ? (
          <div role="alert" className="alert alert-error">
            <span>{error}</span>
          </div>
        ) : null}

        <Collapsible
          title="1. Upload CSV files"
          subtitle="Only headers are read on upload; the full files are streamed later."
          defaultOpen
        >
          <div className="grid gap-4 md:grid-cols-3">
            <FileUpload
              label="File A"
              file={fileA}
              loading={peekingA}
              onChange={(event) => handleFileChange('fileA', event)}
            />
            <FileUpload
              label="File B"
              file={fileB}
              loading={peekingB}
              onChange={(event) => handleFileChange('fileB', event)}
            />
            <FileUpload
              label="Accounting file (optional)"
              file={accountingFile}
              loading={peekingAccounting}
              onChange={(event) => handleFileChange('accounting', event)}
            />
          </div>
          <p className="text-xs text-base-content/60">
            Provide the accounting CSV now to configure reconciliation rules alongside your
            pairs, then run everything in one shot.
          </p>
        </Collapsible>

        <Collapsible
          title="Saved setups (local settings)"
          subtitle={
            setups.length > 0
              ? `${setups.length} configuration${setups.length === 1 ? '' : 's'} in your browser. Includes pairs and reconciliation rules.`
              : 'Import a JSON, load samples, or save a configuration below.'
          }
          defaultOpen={setups.length === 0}
        >
          <SavedSetupsPanel
            setups={setups}
            headersA={fileA.headers}
            headersB={fileB.headers}
            onApply={handleApplySetup}
            onRename={renameSetup}
            onRemove={removeSetup}
            onClearAll={clearAll}
            onLoadDefaults={loadDefaults}
            onImport={importSetups}
            onSaveCurrent={handleSaveSetup}
            currentPairsCount={comparisons.length}
            currentActiveRulesCount={activeRuleCount}
            currentRulePartsCount={activeRulePartsCount}
            exportSetupJson={exportSetupJson}
            exportAllJson={exportAllJson}
            disabled={running}
          />
        </Collapsible>

        {bothFilesReady ? (
          <Collapsible
            title="2. Configure column pairs"
            subtitle={
              comparisons.length > 0
                ? `${comparisons.length} pair${comparisons.length === 1 ? '' : 's'} selected.`
                : 'Pick which numeric columns get summed and compared between File A and File B.'
            }
            defaultOpen
          >
            <PairBuilder
              headersA={fileA.headers}
              headersB={fileB.headers}
              commonColumns={commonColumns}
              comparisons={comparisons}
              onAddPair={handleAddPair}
              onAddPairs={handleAddPairs}
              onRemoveComparison={handleRemovePair}
              onClearAll={handleClearPairs}
              onSave={handleSaveSetup}
              canSave={comparisons.length > 0}
            />
          </Collapsible>
        ) : null}

        {bothFilesReady && comparisons.length > 0 ? (
          <Collapsible
            title="3. Accounting reconciliation rules"
            subtitle={
              hasAccounting
                ? `${activeRuleCount} of ${comparisons.length} pair${comparisons.length === 1 ? '' : 's'} have a rule. Rules are streamed together with the comparison.`
                : 'Optional. Upload the accounting file in step 1 to enable column pickers.'
            }
            defaultOpen={hasAccounting}
            actions={
              <button
                type="button"
                className="btn btn-xs btn-outline"
                onClick={() => handleSaveSetup('')}
                disabled={running || comparisons.length === 0}
                title="Save current pairs and rules to local settings (open Saved setups to rename)"
              >
                Save setup
              </button>
            }
          >
            <AccountingReconcileConfig
              pairs={comparisons.map((pair) => ({ ...pair }))}
              accountingHeaders={accountingFile.headers}
              rules={accountingRules}
              onRulesChange={handleRulesChange}
              disabled={running}
            />
          </Collapsible>
        ) : null}

        {bothFilesReady && comparisons.length > 0 ? (
          <section className="card bg-base-100 border border-base-300 shadow-sm">
            <div className="card-body gap-4">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                  <h2 className="card-title text-base">4. Run</h2>
                  <p className="text-sm text-base-content/60">
                    {hasAccounting && activeRuleCount > 0
                      ? 'Streams all three files: computes the diff and the accounting reconciliation in one pass.'
                      : 'Streams File A and File B and computes the diff for each pair.'}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={handleReset}
                    disabled={running}
                  >
                    Reset
                  </button>
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
                    >
                      Compare {hasAccounting && activeRuleCount > 0 ? '& reconcile' : ''}
                    </button>
                  )}
                </div>
              </div>

              {running || progressA > 0 || progressB > 0 || progressAccounting > 0 ? (
                <div className="flex flex-col gap-3">
                  <ProgressBar
                    label={`File A · ${fileA.name}`}
                    percent={progressA}
                    subtitle={running ? 'Streaming rows, memory stays constant.' : null}
                  />
                  <ProgressBar
                    label={`File B · ${fileB.name}`}
                    percent={progressB}
                    subtitle={running ? 'Only running sums are kept in memory.' : null}
                  />
                  {hasAccounting && activeRuleCount > 0 ? (
                    <ProgressBar
                      label={`Accounting · ${accountingFile.name}`}
                      percent={progressAccounting}
                      subtitle={running ? 'Streaming the accounting file once for all rules.' : null}
                    />
                  ) : null}
                </div>
              ) : null}
            </div>
          </section>
        ) : null}

        {results ? (
          <>
            <ResultsSummary
              rowCountA={results.rowCountA}
              rowCountB={results.rowCountB}
              pairs={results.pairs}
            />
            {reconciliation ? <ReconciliationResults data={reconciliation} /> : null}
            <div className="flex flex-wrap justify-end gap-2">
              <button type="button" className="btn btn-primary" onClick={handleDownload}>
                Download summary CSV
              </button>
            </div>
          </>
        ) : null}
      </main>
    </div>
  );
}

function ReconciliationResults({ data }) {
  return (
    <section className="card bg-base-100 border border-base-300 shadow-sm">
      <div className="card-body gap-3">
        <div>
          <h2 className="card-title text-base">Reconciliation</h2>
          <p className="text-sm text-base-content/60">
            {data.fileName} · {data.rowCount.toLocaleString()} rows scanned.
          </p>
        </div>
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
              {data.rows.map((row) => (
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
    </section>
  );
}
