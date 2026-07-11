// ============================================================================
// ENGINE.JS — THE CORE STREAMING RECONCILIATION ENGINE
// ============================================================================
//
// WHAT DOES THIS FILE DO?
// Imagine you have three giant spreadsheet files (File A, File B, and Accounting),
// each containing millions of rows and over 1 Gigabyte in size.
//
// If we tried to open all those rows in computer RAM at once, the browser would crash!
// Instead, this engine reads each file line-by-line (called "Streaming").
//
// For every row it reads:
// 1. It checks the Key Column (for example: Loan Account Number).
// 2. It adds the numbers to a running total for that Loan Account Number.
// 3. It discards the raw row from memory immediately.
//
// By the end of reading the file, we only store a small table of totals per loan key!
// ============================================================================

import { streamCsv, escapeCsv } from './csv';

// ============================================================================
// SECTION 1: HELPER FUNCTIONS (NUMBERS & LABELS)
// ============================================================================

/**
 * parseNumber(raw)
 * ----------------
 * Converts text from a CSV cell (like "1,473.50" or " $250 ") into a clean JavaScript number.
 * If the cell is empty or invalid, it safely returns 0 so math doesn't break.
 */
export function parseNumber(raw) {
  if (raw === undefined || raw === null || raw === '') {
    return { ok: false, value: 0 };
  }
  let s = String(raw).trim();
  if (!s) {
    return { ok: false, value: 0 };
  }
  // Remove commas (e.g. "100,000" becomes "100000")
  if (s.indexOf(',') !== -1) {
    s = s.replace(/,/g, '');
  }
  const value = Number(s);
  if (Number.isNaN(value)) {
    return { ok: false, value: 0 };
  }
  return { ok: true, value };
}

/**
 * getPartsA(pair) & getPartsB(pair)
 * ---------------------------------
 * A comparison pair can be simple (1 column vs 1 column) OR composite
 * (multiple columns added together or subtracted, like Col1 + Col2 - Col3).
 * These helpers return the list of formula parts for Side A and Side B.
 */
export function getPartsA(pair) {
  if (pair.partsA && Array.isArray(pair.partsA) && pair.partsA.length > 0) {
    return pair.partsA;
  }
  return pair.colA ? [{ col: pair.colA, sign: 1 }] : [];
}

export function getPartsB(pair) {
  if (pair.partsB && Array.isArray(pair.partsB) && pair.partsB.length > 0) {
    return pair.partsB;
  }
  return pair.colB ? [{ col: pair.colB, sign: 1 }] : [];
}

/**
 * formatSideLabel(parts, fallback)
 * --------------------------------
 * Creates a human-readable formula string from parts array.
 * Example output: "DebitAmount + FeeAmount − Discount"
 */
export function formatSideLabel(parts, fallback = '—') {
  if (!parts || parts.length === 0) return fallback;
  return parts
    .map((p, i) => {
      const signStr = p.sign === -1 ? '− ' : i === 0 ? '' : '+ ';
      return `${signStr}${p.col}`;
    })
    .join(' ');
}

// ============================================================================
// SECTION 2: STREAMING FILE A & FILE B BY KEY COLUMN
// ============================================================================

/**
 * streamGroupedSums(file, keyColumn, sumColumns, options)
 * -------------------------------------------------------
 * Reads a CSV file chunk-by-chunk. Groups records by `keyColumn` (Loan ID)
 * and calculates the running sum for every numeric column listed in `sumColumns`.
 *
 * @returns {Promise<{
 *   groups: Map<string, { sums: Record<string, number>, rowCount: number }>,
 *   rowCount: number,
 *   missingColumns: string[]
 * }>}
 */
export async function streamGroupedSums(file, keyColumn, sumColumns, { onProgress, signal } = {}) {
  // We use a JavaScript Map to store running totals: Map<LoanKey, { sums, rowCount }>
  const groups = new Map();
  const missingColumns = [];
  let headerIndex = null;
  let keyIdx = -1;
  let colIndexes = [];
  let rowCount = 0;

  await streamCsv(
    file,
    (fields) => {
      // ----------------------------------------------------------------------
      // ROW 1: Parse CSV Header Row
      // ----------------------------------------------------------------------
      if (headerIndex === null) {
        const headers = fields.map((h) => h.trim());
        headerIndex = new Map();
        headers.forEach((h, i) => {
          if (!headerIndex.has(h)) headerIndex.set(h, i);
        });

        // Find which column number corresponds to our Key Column
        keyIdx = headerIndex.get(keyColumn) ?? -1;
        if (keyIdx < 0 && keyColumn) missingColumns.push(keyColumn);

        // Find column numbers for all numeric columns we need to sum
        colIndexes = sumColumns.map((col) => {
          const idx = headerIndex.get(col) ?? -1;
          if (idx < 0) missingColumns.push(col);
          return { col, idx };
        });
        return;
      }

      // ----------------------------------------------------------------------
      // SUBSEQUENT ROWS: Add values to the running sum for this Loan Key
      // ----------------------------------------------------------------------
      if (keyIdx < 0) return;
      rowCount += 1;

      const key = (fields[keyIdx] ?? '').trim();
      if (!key) return; // Skip rows that don't have a Loan Account Number

      // Look up existing totals for this loan key, or create new entry
      let entry = groups.get(key);
      if (!entry) {
        entry = {
          sums: Object.create(null),
          rowCount: 0
        };
        for (let i = 0; i < sumColumns.length; i++) {
          entry.sums[sumColumns[i]] = 0;
        }
        groups.set(key, entry);
      }
      entry.rowCount += 1;

      // Add each numeric column's cell value to the running total
      for (let i = 0; i < colIndexes.length; i++) {
        const { col, idx } = colIndexes[i];
        if (idx < 0) continue;
        const raw = fields[idx];
        if (raw === undefined || raw === null) continue;
        const parsed = parseNumber(raw);
        if (parsed.ok) {
          entry.sums[col] += parsed.value;
        }
      }
    },
    { onProgress, signal }
  );

  return { groups, rowCount, missingColumns };
}

// ============================================================================
// SECTION 3: STREAMING ACCOUNTING FILE WITH FILTER RULES
// ============================================================================

/**
 * streamGroupedFilteredSums(file, keyColumn, pairSpecs, options)
 * --------------------------------------------------------------
 * Reads the Accounting CSV file chunk-by-chunk.
 * For each row:
 * 1. Checks what Loan Key it belongs to.
 * 2. Checks if the row matches user-defined Filter Rules (e.g. TransactionType == "Billing").
 * 3. If it matches, adds (+) or subtracts (-) the configured Accounting column.
 */
export async function streamGroupedFilteredSums(file, keyColumn, pairSpecs, { onProgress, signal } = {}) {
  const byPairByKey = {};
  const missingColumns = [];
  for (let i = 0; i < pairSpecs.length; i++) {
    byPairByKey[pairSpecs[i].key] = new Map();
  }

  let headerIndex = null;
  let keyIdx = -1;
  let rowCount = 0;
  let fastSpecs = [];

  await streamCsv(
    file,
    (fields) => {
      // ----------------------------------------------------------------------
      // ROW 1: Header Row & Pre-compiling rule indexes for fast lookups
      // ----------------------------------------------------------------------
      if (headerIndex === null) {
        const headers = fields.map((h) => h.trim());
        headerIndex = new Map();
        headers.forEach((h, i) => {
          if (!headerIndex.has(h)) headerIndex.set(h, i);
        });

        keyIdx = headerIndex.get(keyColumn) ?? -1;
        if (keyIdx < 0 && keyColumn) missingColumns.push(keyColumn);

        fastSpecs = pairSpecs.map((spec) => {
          const activeParts = [];
          spec.parts.forEach((part) => {
            if (!part.column) return;
            const valIdx = headerIndex.get(part.column) ?? -1;
            if (valIdx < 0) {
              missingColumns.push(part.column);
              return;
            }
            const activeFilters = [];
            part.filters.forEach((filter) => {
              if (!filter.column || filter.values.size === 0) return;
              const colIdx = headerIndex.get(filter.column) ?? -1;
              if (colIdx < 0) {
                missingColumns.push(filter.column);
                return;
              }
              activeFilters.push({ colIdx, values: filter.values });
            });
            activeParts.push({
              sign: part.sign === -1 ? -1 : 1,
              valIdx,
              filters: activeFilters
            });
          });
          return {
            map: byPairByKey[spec.key],
            parts: activeParts
          };
        });
        return;
      }

      // ----------------------------------------------------------------------
      // SUBSEQUENT ROWS: Evaluate filters and add to matching loan totals
      // ----------------------------------------------------------------------
      if (keyIdx < 0) return;
      rowCount += 1;

      const loanKey = (fields[keyIdx] ?? '').trim();
      if (!loanKey) return;

      for (let s = 0; s < fastSpecs.length; s++) {
        const spec = fastSpecs[s];
        for (let p = 0; p < spec.parts.length; p++) {
          const part = spec.parts[p];

          // Check if all filter criteria pass for this row
          let pass = true;
          for (let f = 0; f < part.filters.length; f++) {
            const filter = part.filters[f];
            const cell = (fields[filter.colIdx] ?? '').trim().toLowerCase();
            if (!filter.values.has(cell)) {
              pass = false;
              break;
            }
          }
          if (!pass) continue;

          // Parse number and apply +1 or -1 sign
          const raw = fields[part.valIdx];
          if (raw === undefined || raw === null) continue;
          const parsed = parseNumber(raw);
          if (!parsed.ok) continue;

          let entry = spec.map.get(loanKey);
          if (!entry) {
            entry = { sum: 0, rowCount: 0 };
            spec.map.set(loanKey, entry);
          }
          entry.sum += part.sign * parsed.value;
          entry.rowCount += 1;
        }
      }
    },
    { onProgress, signal }
  );

  return { rowCount, byPairByKey, missingColumns };
}

// ============================================================================
// SECTION 4: MERGING RESULTS ACROSS ALL 3 FILES
// ============================================================================

/**
 * mergeLoanResults(params)
 * ------------------------
 * Combines the grouped totals from File A, File B, and Accounting File
 * for every unique Loan Key discovered across any file.
 *
 * For each loan:
 *   Diff = Sum(Side A Formula) − Sum(Side B Formula)
 *   Delta = Diff − AccountingRuleSum
 *   Status = "match" | "mismatch" | "missing-in-a" | "missing-in-b" | "accounting-only"
 */
export function mergeLoanResults({ groupsA, groupsB, acctByPairByKey, pairs }) {
  // Collect a master list of all Loan Keys found in any file
  const allKeys = new Set([...groupsA.keys(), ...groupsB.keys()]);
  if (acctByPairByKey) {
    Object.values(acctByPairByKey).forEach((map) => {
      for (const k of map.keys()) allKeys.add(k);
    });
  }

  const rows = [];
  const MATCH_EPSILON = 0.005; // Ignore floating-point rounding errors smaller than half a cent

  for (const loanNo of allKeys) {
    const entryA = groupsA.get(loanNo);
    const entryB = groupsB.get(loanNo);

    const inA = Boolean(entryA);
    const inB = Boolean(entryB);

    // Calculate diffs and accounting comparisons for each pair
    const pairDiffs = pairs.map((pair) => {
      const partsA = getPartsA(pair);
      const partsB = getPartsB(pair);

      let sumA = 0;
      for (let i = 0; i < partsA.length; i++) {
        const p = partsA[i];
        const val = entryA?.sums[p.col] ?? 0;
        sumA += p.sign * val;
      }

      let sumB = 0;
      for (let i = 0; i < partsB.length; i++) {
        const p = partsB[i];
        const val = entryB?.sums[p.col] ?? 0;
        sumB += p.sign * val;
      }

      const diff = sumA - sumB;

      // Look up Accounting sum for this pair and loan
      let acctSum = null;
      let acctRows = 0;
      const pKey = `${pair.colA}::${pair.colB}`;
      if (acctByPairByKey) {
        const acctMap = acctByPairByKey[pKey];
        if (acctMap) {
          const acctEntry = acctMap.get(loanNo);
          if (acctEntry) {
            acctSum = acctEntry.sum;
            acctRows = acctEntry.rowCount;
          } else {
            acctSum = 0;
          }
        }
      }

      const delta = acctSum !== null ? diff - acctSum : null;
      const labelA = formatSideLabel(partsA, pair.colA);
      const labelB = formatSideLabel(partsB, pair.colB);

      return {
        colA: pair.colA,
        colB: pair.colB,
        labelA,
        labelB,
        sumA,
        sumB,
        diff,
        acctSum,
        acctRows,
        delta
      };
    });

    // Check if there's any mismatch across pairs
    const totalAbsDiff = pairDiffs.reduce((acc, p) => acc + Math.abs(p.diff), 0);
    const hasAcctMismatch = pairDiffs.some(
      (p) => p.delta !== null && Math.abs(p.delta) >= MATCH_EPSILON
    );
    const inAcct = acctByPairByKey
      ? pairDiffs.some((p) => p.acctSum !== null && Math.abs(p.acctSum) >= MATCH_EPSILON)
      : false;

    // Determine Status Badge for this loan
    let status = 'match';
    if (!inA && !inB) {
      status = 'accounting-only';
    } else if (!inA) {
      status = 'missing-in-a';
    } else if (!inB) {
      status = 'missing-in-b';
    } else if (acctByPairByKey) {
      if (hasAcctMismatch) {
        status = 'mismatch';
      } else {
        status = 'match';
      }
    } else {
      if (totalAbsDiff >= MATCH_EPSILON) {
        status = 'mismatch';
      } else {
        status = 'match';
      }
    }

    rows.push({
      loanNo,
      inA,
      inB,
      inAcct,
      rowCountA: entryA?.rowCount ?? 0,
      rowCountB: entryB?.rowCount ?? 0,
      pairDiffs,
      totalAbsDiff,
      status
    });
  }

  // Sort rows so problem loans (mismatches, missing records) appear at the top
  const statusOrder = {
    mismatch: 0,
    'missing-in-a': 1,
    'missing-in-b': 2,
    'accounting-only': 3,
    match: 4
  };
  rows.sort((a, b) => {
    const oa = statusOrder[a.status] ?? 9;
    const ob = statusOrder[b.status] ?? 9;
    if (oa !== ob) return oa - ob;
    return b.totalAbsDiff - a.totalAbsDiff;
  });

  return rows;
}

// ============================================================================
// SECTION 5: CSV EXPORT UTILITIES
// ============================================================================

/**
 * buildLoanCsv(loanRows, pairs, hasAccounting)
 * --------------------------------------------
 * Formats the final loan results table into a downloadable CSV text string.
 */
export function buildLoanCsv(loanRows, pairs, hasAccounting) {
  const lines = [];
  const pushRow = (cells) => lines.push(cells.map(escapeCsv).join(','));

  // CSV Column Headers
  const header = ['Loan Key / Account No', 'Status', 'Rows in File A', 'Rows in File B'];
  pairs.forEach((p) => {
    const labelA = formatSideLabel(getPartsA(p), p.colA);
    const labelB = formatSideLabel(getPartsB(p), p.colB);
    header.push(`File A (${labelA})`);
    header.push(`File B (${labelB})`);
    header.push(`Diff (${labelA} − ${labelB})`);
    if (hasAccounting) {
      header.push(`Accounting Rule Sum (${labelA}↔${labelB})`);
      header.push(`Delta (Diff − Accounting)`);
    }
  });
  pushRow(header);

  // CSV Data Rows
  loanRows.forEach((row) => {
    const cells = [row.loanNo, row.status, row.rowCountA, row.rowCountB];
    row.pairDiffs.forEach((pd) => {
      cells.push(pd.sumA);
      cells.push(pd.sumB);
      cells.push(pd.diff);
      if (hasAccounting) {
        cells.push(pd.acctSum ?? 0);
        cells.push(pd.delta ?? 0);
      }
    });
    pushRow(cells);
  });

  return lines.join('\r\n');
}

/**
 * downloadCsv(filename, csvString)
 * --------------------------------
 * Triggers a browser download of the CSV string.
 */
export function downloadCsv(filename, csvString) {
  const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
