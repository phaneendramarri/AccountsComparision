// ============================================================================
// APP.JSX — MAIN APPLICATION CONTROLLER
// ============================================================================
//
// WHAT DOES THIS FILE DO?
// This is the "brain" of our React application. It coordinates the 5 steps:
//
//   Step 1: Uploading File A, File B, and Accounting CSV files.
//   Step 2: Selecting the Key Column (Loan Account Number / ID) in each file.
//   Step 3: Selecting which numeric columns to pair and compare between File A and B.
//   Step 4: Defining Accounting sum formulas and filters per pair.
//   Step 5: Running the streaming comparison in parallel and showing results.
//
// It also allows saving and loading your entire configuration as a JSON file!
// ============================================================================

import React, { useCallback, useMemo, useRef, useState } from 'react';
import { Header } from './components/Header';
import { FileUpload } from './components/FileUpload';
import { KeyColumnPicker } from './components/KeyColumnPicker';
import { PairBuilder } from './components/PairBuilder';
import { RuleEditor } from './components/RuleEditor';
import { LoanResults } from './components/LoanResults';
import { ProgressBar } from './components/ProgressBar';
import { Collapsible } from './components/Collapsible';
import { useTheme } from './hooks/useTheme';
import { peekCsvHeaders } from './lib/csv';
import {
  streamGroupedSums,
  streamGroupedFilteredSums,
  mergeLoanResults,
  buildLoanCsv,
  downloadCsv,
  getPartsA,
  getPartsB
} from './lib/engine';
import { dehydrateRule, emptyRule, hydrateRule, isRuleActive, ruleToPairSpec } from './lib/rules';
import {
  Upload,
  Download,
  Play,
  RotateCcw,
  X,
  AlertCircle,
  FileJson,
  Sparkles
} from 'lucide-react';

const emptySlot = { file: null, name: '', size: 0, headers: [] };

function pairKey(pair) {
  return `${pair.colA}::${pair.colB}`;
}

export default function App() {
  const { theme, toggle } = useTheme();

  // ==========================================================================
  // STATE MANAGEMENT
  // ==========================================================================
  const [fileA, setFileA] = useState(emptySlot);
  const [fileB, setFileB] = useState(emptySlot);
  const [accountingFile, setAccountingFile] = useState(emptySlot);
  const [peekingA, setPeekingA] = useState(false);
  const [peekingB, setPeekingB] = useState(false);
  const [peekingAccounting, setPeekingAccounting] = useState(false);

  const [keyColA, setKeyColA] = useState('');
  const [keyColB, setKeyColB] = useState('');
  const [keyColAcct, setKeyColAcct] = useState('');

  const [comparisons, setComparisons] = useState([]);
  const [accountingRules, setAccountingRules] = useState({});

  const [running, setRunning] = useState(false);
  const [progressA, setProgressA] = useState(0);
  const [progressB, setProgressB] = useState(0);
  const [progressAccounting, setProgressAccounting] = useState(0);
  const [error, setError] = useState('');
  const [results, setResults] = useState(null);

  const abortRef = useRef(null);
  const fileInputRef = useRef(null);

  const bothFilesReady = Boolean(fileA.file) && Boolean(fileB.file);
  const keysReady = Boolean(keyColA) && Boolean(keyColB);
  const canRun = bothFilesReady && keysReady && comparisons.length > 0 && !running;

  const commonColumns = useMemo(() => {
    if (!bothFilesReady) return [];
    const setB = new Set(fileB.headers);
    return fileA.headers.filter((h) => setB.has(h));
  }, [bothFilesReady, fileA.headers, fileB.headers]);

  // ==========================================================================
  // HANDLERS — STEP 1: READING CSV HEADERS INSTANTLY ON UPLOAD
  // ==========================================================================
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
    setPeek(true);
    try {
      const headers = await peekCsvHeaders(file);
      if (headers.length === 0) {
        throw new Error('No headers found in the first row.');
      }
      setSlot({ file, name: file.name, size: file.size, headers });
    } catch (err) {
      setSlot(emptySlot);
      setError(err.message || 'Could not read file headers.');
    } finally {
      setPeek(false);
    }
  }, []);

  // ==========================================================================
  // HANDLERS — STEP 2 & 3: UPDATING KEYS AND PAIRS
  // ==========================================================================
  const handleKeyChange = useCallback((field, value) => {
    if (field === 'keyColA') setKeyColA(value);
    else if (field === 'keyColB') setKeyColB(value);
    else if (field === 'keyColAcct') setKeyColAcct(value);
    setResults(null);
  }, []);

  const handleAddPair = useCallback((pair) => {
    if (!pair?.colA || !pair?.colB) return;
    setComparisons((curr) => {
      const exists = curr.some((p) => p.colA === pair.colA && p.colB === pair.colB);
      return exists ? curr : [...curr, pair];
    });
    setResults(null);
  }, []);

  const handleRemovePair = useCallback((idx) => {
    setComparisons((curr) => curr.filter((_, i) => i !== idx));
    setResults(null);
  }, []);

  const handleClearPairs = useCallback(() => {
    setComparisons([]);
    setResults(null);
  }, []);

  const handleReset = useCallback(() => {
    if (running) abortRef.current?.abort();
    setFileA(emptySlot);
    setFileB(emptySlot);
    setAccountingFile(emptySlot);
    setKeyColA('');
    setKeyColB('');
    setKeyColAcct('');
    setComparisons([]);
    setAccountingRules({});
    setResults(null);
    setError('');
    setProgressA(0);
    setProgressB(0);
    setProgressAccounting(0);
  }, [running]);

  const handleCancel = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  // ==========================================================================
  // SETUP JSON EXPORT & IMPORT
  // ==========================================================================
  const handleExportJson = useCallback(() => {
    const dehydratedRules = {};
    Object.entries(accountingRules).forEach(([k, rule]) => {
      dehydratedRules[k] = dehydrateRule(rule);
    });

    const setup = {
      version: 2,
      keyColA,
      keyColB,
      keyColAcct,
      comparisons,
      accountingRules: dehydratedRules,
      exportedAt: new Date().toISOString()
    };

    const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const jsonString = JSON.stringify(setup, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `reconciliation-setup-${stamp}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, [keyColA, keyColB, keyColAcct, comparisons, accountingRules]);

  const handleImportJsonFile = useCallback((event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target.result);
        if (data.keyColA !== undefined) setKeyColA(data.keyColA || '');
        if (data.keyColB !== undefined) setKeyColB(data.keyColB || '');
        if (data.keyColAcct !== undefined) setKeyColAcct(data.keyColAcct || '');
        if (Array.isArray(data.comparisons)) {
          setComparisons(data.comparisons);
        } else if (Array.isArray(data.pairs)) {
          setComparisons(data.pairs);
        }
        if (data.accountingRules && typeof data.accountingRules === 'object') {
          const rehydrated = {};
          Object.entries(data.accountingRules).forEach(([k, rule]) => {
            rehydrated[k] = hydrateRule(rule);
          });
          setAccountingRules(rehydrated);
        }
        setResults(null);
        setError('');
      } catch (err) {
        setError('Invalid setup JSON file.');
      }
    };
    reader.readAsText(file);
    event.target.value = '';
  }, []);

  // ==========================================================================
  // HANDLERS — STEP 5: RUNNING CONCURRENT STREAMING IN PARALLEL
  // ==========================================================================
  const handleRun = useCallback(async () => {
    if (!canRun) return;

    setResults(null);
    setError('');
    setProgressA(0);
    setProgressB(0);
    setProgressAccounting(0);
    setRunning(true);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const sumColsA = new Set();
      const sumColsB = new Set();
      comparisons.forEach((p) => {
        getPartsA(p).forEach((part) => sumColsA.add(part.col));
        getPartsB(p).forEach((part) => sumColsB.add(part.col));
      });

      const activeSpecs = comparisons
        .map((pair) => {
          const rule = accountingRules[pairKey(pair)];
          if (!isRuleActive(rule)) return null;
          const spec = ruleToPairSpec(rule);
          if (spec.parts.length === 0) return null;
          return { key: pairKey(pair), ...spec };
        })
        .filter(Boolean);

      const streamTaskA = streamGroupedSums(fileA.file, keyColA, Array.from(sumColsA), {
        signal: controller.signal,
        onProgress: (bytes) => {
          setProgressA(fileA.size ? (bytes / fileA.size) * 100 : 0);
        }
      });

      const streamTaskB = streamGroupedSums(fileB.file, keyColB, Array.from(sumColsB), {
        signal: controller.signal,
        onProgress: (bytes) => {
          setProgressB(fileB.size ? (bytes / fileB.size) * 100 : 0);
        }
      });

      const streamTaskAcct =
        accountingFile.file && keyColAcct && activeSpecs.length > 0
          ? streamGroupedFilteredSums(accountingFile.file, keyColAcct, activeSpecs, {
              signal: controller.signal,
              onProgress: (bytes) => {
                setProgressAccounting(
                  accountingFile.size ? (bytes / accountingFile.size) * 100 : 0
                );
              }
            })
          : Promise.resolve(null);

      const [resA, resB, acctResult] = await Promise.all([
        streamTaskA,
        streamTaskB,
        streamTaskAcct
      ]);

      setProgressA(100);
      setProgressB(100);
      if (acctResult) setProgressAccounting(100);

      const loanRows = mergeLoanResults({
        groupsA: resA.groups,
        groupsB: resB.groups,
        acctByPairByKey: acctResult ? acctResult.byPairByKey : null,
        pairs: comparisons
      });

      const warnings = [
        ...resA.missingColumns.map((c) => `File A: missing column "${c}"`),
        ...resB.missingColumns.map((c) => `File B: missing column "${c}"`),
        ...(acctResult ? acctResult.missingColumns.map((c) => `Accounting: missing column "${c}"`) : [])
      ];

      setResults({
        loanRows,
        hasAccounting: Boolean(acctResult),
        warnings
      });
    } catch (err) {
      if (err?.name !== 'AbortError') {
        setError(err.message || 'Something went wrong while streaming the files.');
      }
    } finally {
      setRunning(false);
      abortRef.current = null;
    }
  }, [
    accountingFile,
    accountingRules,
    canRun,
    comparisons,
    fileA,
    fileB,
    keyColA,
    keyColAcct,
    keyColB
  ]);

  const handleDownloadCsv = useCallback(() => {
    if (!results) return;
    const csv = buildLoanCsv(results.loanRows, comparisons, results.hasAccounting);
    const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    downloadCsv(`reconciliation-by-key-${stamp}.csv`, csv);
  }, [comparisons, results]);

  return (
    <div className="min-h-screen bg-base-200 text-base-content pb-20">
      <Header theme={theme} onToggleTheme={toggle} />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 flex flex-col gap-6">
        {error ? (
          <div role="alert" className="alert alert-error shadow-lg rounded-2xl">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <span>{error}</span>
          </div>
        ) : null}

        {/* Global Action Bar: Save / Load Settings JSON */}
        <div className="flex items-center justify-between flex-wrap gap-4 bg-base-100 p-4 rounded-2xl border border-base-content/10 shadow-md">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
              <FileJson className="w-5 h-5" />
            </div>
            <div>
              <div className="text-sm font-bold font-display text-base-content">
                Configuration Presets
              </div>
              <div className="text-xs text-base-content/60">
                Save or load Key Columns, Comparison Pairs, and Accounting Rules as a JSON file
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="file"
              accept=".json"
              ref={fileInputRef}
              onChange={handleImportJsonFile}
              className="hidden"
            />
            <button
              type="button"
              className="btn btn-sm btn-outline gap-1.5 rounded-xl border-base-content/20 hover:border-primary"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="w-3.5 h-3.5" /> Load Setup JSON
            </button>
            <button
              type="button"
              className="btn btn-sm btn-outline gap-1.5 rounded-xl border-base-content/20 hover:border-primary"
              onClick={handleExportJson}
              disabled={comparisons.length === 0 && !keyColA && !keyColB}
            >
              <Download className="w-3.5 h-3.5" /> Save Setup JSON
            </button>
          </div>
        </div>

        {/* Step 1: Upload Files */}
        <Collapsible
          title="1. Upload CSV Files"
          subtitle="File A, File B, and optional Accounting CSV. Large files are streamed in parallel."
          defaultOpen
          badge={<span className="badge badge-primary badge-sm font-mono text-[10px]">Step 1</span>}
        >
          <div className="grid gap-5 md:grid-cols-3">
            <FileUpload
              label="File A (Sales / Loan Book)"
              file={fileA}
              loading={peekingA}
              onChange={(e) => handleFileChange('fileA', e)}
            />
            <FileUpload
              label="File B (Core Banking / System)"
              file={fileB}
              loading={peekingB}
              onChange={(e) => handleFileChange('fileB', e)}
            />
            <FileUpload
              label="Accounting File (Optional Ledger)"
              file={accountingFile}
              loading={peekingAccounting}
              onChange={(e) => handleFileChange('accounting', e)}
            />
          </div>
        </Collapsible>

        {/* Step 2: Select Key Columns */}
        {bothFilesReady ? (
          <Collapsible
            title="2. Select Key Column (Search & Match by Loan ID)"
            subtitle="Pick the unique identifier column in each file to match records per loan."
            defaultOpen
            badge={<span className="badge badge-primary badge-sm font-mono text-[10px]">Step 2</span>}
          >
            <KeyColumnPicker
              headersA={fileA.headers}
              headersB={fileB.headers}
              headersAccounting={accountingFile.headers}
              keyColA={keyColA}
              keyColB={keyColB}
              keyColAcct={keyColAcct}
              onChange={handleKeyChange}
              disabled={running}
            />
          </Collapsible>
        ) : null}

        {/* Step 3: Select Column Pairs */}
        {bothFilesReady ? (
          <Collapsible
            title="3. Select Column Pairs to Compare"
            subtitle="Choose simple 1-to-1 pairs OR composite multi-column formulas (+/−) between File A and File B."
            defaultOpen
            badge={<span className="badge badge-primary badge-sm font-mono text-[10px]">Step 3</span>}
          >
            <PairBuilder
              headersA={fileA.headers}
              headersB={fileB.headers}
              commonColumns={commonColumns}
              comparisons={comparisons}
              onAddPair={handleAddPair}
              onRemovePair={handleRemovePair}
              onClearAll={handleClearPairs}
              disabled={running}
            />
          </Collapsible>
        ) : null}

        {/* Step 4: Accounting Rules & Filters */}
        {bothFilesReady && comparisons.length > 0 ? (
          <Collapsible
            title="4. Accounting Rules & Filters (Optional)"
            subtitle="Configure Accounting columns to Add (+) or Subtract (−) along with filter conditions per pair."
            defaultOpen={Boolean(accountingFile.file)}
            badge={<span className="badge badge-primary badge-sm font-mono text-[10px]">Step 4</span>}
          >
            <RuleEditor
              pairs={comparisons}
              accountingHeaders={accountingFile.headers}
              rules={accountingRules}
              onRulesChange={setAccountingRules}
              disabled={running}
            />
          </Collapsible>
        ) : null}

        {/* Step 5: Run Execution */}
        {bothFilesReady && comparisons.length > 0 ? (
          <section className="rounded-2xl bg-base-100 border border-base-content/10 shadow-xl overflow-hidden">
            <div className="p-6 flex flex-col gap-5">
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-bold font-display text-base-content">
                      5. Run Reconciliation
                    </h2>
                    <span className="badge badge-primary badge-sm font-mono text-[10px]">
                      Step 5
                    </span>
                  </div>
                  <p className="text-xs sm:text-sm text-base-content/60 mt-0.5">
                    Streams all files concurrently in parallel grouped by Loan Key and verifies if <code className="font-mono">Diff</code> matches the Accounting rules per loan.
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm gap-1.5"
                    onClick={handleReset}
                    disabled={running}
                  >
                    <RotateCcw className="w-3.5 h-3.5" /> Reset All
                  </button>
                  {running ? (
                    <button
                      type="button"
                      className="btn btn-error btn-sm gap-1.5"
                      onClick={handleCancel}
                    >
                      <X className="w-4 h-4" /> Cancel Streaming
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="btn btn-primary btn-sm sm:btn-md gap-2 shadow-lg shadow-primary/25 font-bold px-6"
                      onClick={handleRun}
                      disabled={!canRun}
                    >
                      <Play className="w-4 h-4 fill-current" /> Compare & Reconcile by Key
                    </button>
                  )}
                </div>
              </div>

              {(running || progressA > 0 || progressB > 0 || progressAccounting > 0) && (
                <div className="flex flex-col gap-3 pt-2 border-t border-base-content/5">
                  <ProgressBar
                    label={`File A (${fileA.name})`}
                    percent={progressA}
                    subtitle={running ? 'Parallel O(1) streaming & grouping…' : null}
                  />
                  <ProgressBar
                    label={`File B (${fileB.name})`}
                    percent={progressB}
                    subtitle={running ? 'Parallel O(1) streaming & grouping…' : null}
                  />
                  {accountingFile.file && keyColAcct && (
                    <ProgressBar
                      label={`Accounting (${accountingFile.name})`}
                      percent={progressAccounting}
                      subtitle={running ? 'Parallel O(1) streaming & rule filtering…' : null}
                    />
                  )}
                </div>
              )}
            </div>
          </section>
        ) : null}

        {/* Warnings Alert */}
        {results?.warnings?.length > 0 ? (
          <div role="alert" className="alert alert-warning shadow-lg rounded-2xl">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <div>
              <div className="font-bold text-sm">Columns Note</div>
              <ul className="text-xs list-disc pl-4 mt-1">
                {results.warnings.map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            </div>
          </div>
        ) : null}

        {/* Results Table */}
        {results ? (
          <LoanResults
            loanRows={results.loanRows}
            pairs={comparisons}
            hasAccounting={results.hasAccounting}
            onDownload={handleDownloadCsv}
          />
        ) : null}
      </main>
    </div>
  );
}
