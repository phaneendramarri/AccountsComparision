import { useCallback, useMemo, useRef, useState } from 'react';
import { Header } from './components/Header';
import { FileUpload } from './components/FileUpload';
import { PairBuilder } from './components/PairBuilder';
import { SavedPairsPanel } from './components/SavedPairsPanel';
import { ResultsSummary } from './components/ResultsSummary';
import { AccountingReconcile } from './components/AccountingReconcile';
import { ProgressBar } from './components/ProgressBar';
import { useTheme } from './hooks/useTheme';
import { useSavedPairs } from './hooks/useSavedPairs';
import { peekCsvHeaders } from './lib/csv';
import {
  buildPairResults,
  buildSummaryCsv,
  computeFileSums,
  downloadCsv
} from './lib/compare';

const emptySlot = { file: null, name: '', size: 0, headers: [] };

export default function App() {
  const { theme, toggle } = useTheme();
  const { savedPairs, savePair, renamePair, removePair, clearAll } = useSavedPairs();

  const [fileA, setFileA] = useState(emptySlot);
  const [fileB, setFileB] = useState(emptySlot);
  const [peekingA, setPeekingA] = useState(false);
  const [peekingB, setPeekingB] = useState(false);

  const [comparisons, setComparisons] = useState([]);

  const [running, setRunning] = useState(false);
  const [progressA, setProgressA] = useState(0);
  const [progressB, setProgressB] = useState(0);
  const [results, setResults] = useState(null);
  const [reconciliation, setReconciliation] = useState(null);
  const [error, setError] = useState('');
  const abortRef = useRef(null);

  const bothFilesReady = Boolean(fileA.file) && Boolean(fileB.file);
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

  const handleFileChange = useCallback(async (slot, event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const setPeek = slot === 'fileA' ? setPeekingA : setPeekingB;
    const setSlot = slot === 'fileA' ? setFileA : setFileB;

    setError('');
    setResults(null);
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
  }, []);

  const handleSavePairs = useCallback((label) => {
    if (comparisons.length === 0) return;
    savePair(comparisons, label);
  }, [comparisons, savePair]);

  const handleApplySaved = useCallback((setup) => {
    setComparisons(setup.comparisons.map((pair) => ({ ...pair })));
    setResults(null);
  }, []);

  const handleReset = useCallback(() => {
    if (running) abortRef.current?.abort();
    setFileA(emptySlot);
    setFileB(emptySlot);
    setComparisons([]);
    setResults(null);
    setReconciliation(null);
    setError('');
    setProgressA(0);
    setProgressB(0);
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
      setResults({
        rowCountA: resultA.rowCount,
        rowCountB: resultB.rowCount,
        pairs: buildPairResults({ comparisons, resultA, resultB })
      });
    } catch (runError) {
      if (runError?.name !== 'AbortError') {
        setError(runError.message || 'Something went wrong while streaming the files.');
      }
    } finally {
      setRunning(false);
      abortRef.current = null;
    }
  }, [canRun, columnsA, columnsB, comparisons, fileA, fileB]);

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

        <section className="card bg-base-100 border border-base-300 shadow-sm">
          <div className="card-body gap-4">
            <h2 className="card-title text-base">1. Upload CSV files</h2>
            <p className="text-sm text-base-content/60">
              Only the header row is read on upload. The full files are streamed later, so 400 MB+
              CSVs stay well under memory limits.
            </p>
            <div className="grid gap-4 md:grid-cols-2">
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
            </div>
          </div>
        </section>

        {bothFilesReady ? (
          <SavedPairsPanel
            savedPairs={savedPairs}
            headersA={fileA.headers}
            headersB={fileB.headers}
            onApply={handleApplySaved}
            onRemove={removePair}
            onRename={renamePair}
            onClearAll={clearAll}
            disabled={running}
          />
        ) : null}

        {bothFilesReady ? (
          <PairBuilder
            headersA={fileA.headers}
            headersB={fileB.headers}
            commonColumns={commonColumns}
            comparisons={comparisons}
            onAddPair={handleAddPair}
            onAddPairs={handleAddPairs}
            onRemoveComparison={handleRemovePair}
            onClearAll={handleClearPairs}
            onSave={handleSavePairs}
            canSave={comparisons.length > 0}
          />
        ) : null}

        {bothFilesReady && comparisons.length > 0 ? (
          <section className="card bg-base-100 border border-base-300 shadow-sm">
            <div className="card-body gap-4">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <h2 className="card-title text-base">2. Compute sums</h2>
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
                    <button type="button" className="btn btn-error btn-outline" onClick={handleCancel}>
                      Cancel
                    </button>
                  ) : (
                    <button type="button" className="btn btn-primary" onClick={handleRun}>
                      Compare
                    </button>
                  )}
                </div>
              </div>

              {running || progressA > 0 || progressB > 0 ? (
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
            <AccountingReconcile
              pairs={results.pairs}
              onResultsChange={setReconciliation}
            />
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
