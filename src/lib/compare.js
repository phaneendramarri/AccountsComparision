import { escapeCsv, streamCsv } from './csv';

// Convert a raw CSV value to a number when possible. Ignores commas.
export function parseNumber(raw) {
  if (raw === undefined || raw === null || raw === '') {
    return { ok: false, value: 0 };
  }
  const cleaned = String(raw).replace(/,/g, '').trim();
  if (!cleaned) {
    return { ok: false, value: 0 };
  }
  const value = Number(cleaned);
  if (Number.isNaN(value)) {
    return { ok: false, value: 0 };
  }
  return { ok: true, value };
}

// Streams a single file and computes running totals for the given columns.
// Memory footprint is O(#columns), not O(#rows).
export async function computeFileSums(file, columns, { onProgress, signal } = {}) {
  const sums = Object.fromEntries(columns.map((column) => [column, 0]));
  const numericCounts = Object.fromEntries(columns.map((column) => [column, 0]));
  const nonNumericCounts = Object.fromEntries(columns.map((column) => [column, 0]));

  let headerIndex = null;
  let rowCount = 0;

  await streamCsv(
    file,
    (fields) => {
      if (headerIndex === null) {
        const headers = fields.map((header) => header.trim());
        headerIndex = new Map();
        columns.forEach((column) => {
          headerIndex.set(column, headers.indexOf(column));
        });
        return;
      }

      rowCount += 1;

      for (const column of columns) {
        const columnIdx = headerIndex.get(column);
        if (columnIdx === undefined || columnIdx < 0) continue;
        const raw = fields[columnIdx];
        if (!raw) continue;
        const parsed = parseNumber(raw);
        if (parsed.ok) {
          sums[column] += parsed.value;
          numericCounts[column] += 1;
        } else {
          nonNumericCounts[column] += 1;
        }
      }
    },
    { onProgress, signal }
  );

  return {
    rowCount,
    sums,
    numericCounts,
    nonNumericCounts,
    bytes: file.size
  };
}

// Streams a single file once and computes, for each pair spec, the sum of the
// pair's `valueColumn` restricted to rows where every filter passes. A filter
// passes when the row's cell for `column` (trimmed, lower-cased) matches any
// entry in the pair's allowed-values set. Pairs with no valueColumn or no
// active filter columns are ignored (still take zero cost per row).
//
// pairSpecs: Array<{
//   key: string,
//   valueColumn: string,
//   filters: Array<{ column: string, values: Set<string> }>
// }>
export async function computeFilteredSums(file, pairSpecs, { onProgress, signal } = {}) {
  const byPair = {};
  pairSpecs.forEach((spec) => {
    byPair[spec.key] = {
      sum: 0,
      matchedRows: 0,
      nonNumericSkipped: 0,
      valueColumnMissing: false,
      missingFilterColumns: []
    };
  });

  const perPair = new Map();
  let headerIndex = null;
  let rowCount = 0;

  await streamCsv(
    file,
    (fields) => {
      if (headerIndex === null) {
        const headers = fields.map((header) => header.trim());
        headerIndex = new Map();
        headers.forEach((header, index) => {
          if (!headerIndex.has(header)) headerIndex.set(header, index);
        });

        pairSpecs.forEach((spec) => {
          const info = byPair[spec.key];
          const valueIdx = spec.valueColumn ? headerIndex.get(spec.valueColumn) : undefined;
          if (spec.valueColumn && (valueIdx === undefined || valueIdx < 0)) {
            info.valueColumnMissing = true;
          }

          const activeFilters = [];
          spec.filters.forEach((filter) => {
            if (!filter.column || filter.values.size === 0) return;
            const columnIdx = headerIndex.get(filter.column);
            if (columnIdx === undefined || columnIdx < 0) {
              info.missingFilterColumns.push(filter.column);
              return;
            }
            activeFilters.push({ columnIdx, values: filter.values });
          });

          perPair.set(spec.key, {
            valueIdx: valueIdx ?? -1,
            filters: activeFilters,
            info
          });
        });
        return;
      }

      rowCount += 1;

      for (const [, spec] of perPair) {
        if (spec.valueIdx < 0) continue;
        let pass = true;
        for (const filter of spec.filters) {
          const cell = (fields[filter.columnIdx] ?? '').trim().toLowerCase();
          if (!filter.values.has(cell)) {
            pass = false;
            break;
          }
        }
        if (!pass) continue;
        const raw = fields[spec.valueIdx];
        const parsed = parseNumber(raw);
        if (parsed.ok) {
          spec.info.sum += parsed.value;
          spec.info.matchedRows += 1;
        } else if (raw !== undefined && String(raw).trim() !== '') {
          spec.info.nonNumericSkipped += 1;
        }
      }
    },
    { onProgress, signal }
  );

  return { rowCount, byPair };
}

// Given per-file totals and the user-selected column pairs, build a small
// results object with the sum and the A − B difference for each pair.
export function buildPairResults({ comparisons, resultA, resultB }) {
  return comparisons.map((pair) => ({
    colA: pair.colA,
    colB: pair.colB,
    sumA: resultA.sums[pair.colA] ?? 0,
    sumB: resultB.sums[pair.colB] ?? 0,
    diff: (resultA.sums[pair.colA] ?? 0) - (resultB.sums[pair.colB] ?? 0),
    countA: resultA.numericCounts[pair.colA] ?? 0,
    countB: resultB.numericCounts[pair.colB] ?? 0,
    nonNumericA: resultA.nonNumericCounts[pair.colA] ?? 0,
    nonNumericB: resultB.nonNumericCounts[pair.colB] ?? 0
  }));
}

// Build a human-readable CSV summary that Excel/Sheets can open directly.
// Sections are separated by blank rows and each has its own header row so the
// file self-documents. When `reconciliation` is provided a second table is
// appended with the per-pair accounting check.
//
// Inputs:
//   metadata: {
//     generatedAt?: Date,
//     fileA: { name, rows },
//     fileB: { name, rows },
//     accounting?: { name, rowsScanned }
//   }
//   comparisons: unused (kept for backward compatibility)
//   results:  Array of buildPairResults rows
//   reconciliation?: {
//     rowCount: number,
//     rows: Array<{
//       colA, colB, diff, valueColumn, filterSummary,
//       accountingSum, matchedRows, delta, status, note
//     }>
//   }
export function buildSummaryCsv({ metadata, results, reconciliation } = {}) {
  const lines = [];
  const pushRow = (cells) => lines.push(cells.map(escapeCsv).join(','));
  const pushBlank = () => lines.push('');

  const generatedAt = metadata?.generatedAt ?? new Date();

  // Report metadata
  pushRow(['Report']);
  pushRow(['Generated at', generatedAt.toISOString()]);
  if (metadata?.fileA) {
    pushRow(['File A name', metadata.fileA.name ?? '']);
    pushRow(['File A rows', metadata.fileA.rows ?? '']);
  }
  if (metadata?.fileB) {
    pushRow(['File B name', metadata.fileB.name ?? '']);
    pushRow(['File B rows', metadata.fileB.rows ?? '']);
  }
  if (metadata?.accounting) {
    pushRow(['Accounting file name', metadata.accounting.name ?? '']);
    pushRow(['Accounting rows scanned', metadata.accounting.rowsScanned ?? '']);
  }
  pushBlank();

  // Column comparison
  pushRow(['Column comparison (File A vs File B)']);
  pushRow([
    'Column in File A',
    'Column in File B',
    'Sum in File A',
    'Sum in File B',
    'Difference (File A - File B)',
    'Numeric rows summed in File A',
    'Numeric rows summed in File B',
    'Non-numeric rows skipped in File A',
    'Non-numeric rows skipped in File B',
    'Match status'
  ]);
  (results ?? []).forEach((row) => {
    const matches = Math.abs(row.diff) < 0.005;
    pushRow([
      row.colA,
      row.colB,
      row.sumA,
      row.sumB,
      row.diff,
      row.countA,
      row.countB,
      row.nonNumericA,
      row.nonNumericB,
      matches ? 'Match' : 'Difference'
    ]);
  });

  // Accounting reconciliation (optional)
  if (reconciliation && Array.isArray(reconciliation.rows) && reconciliation.rows.length > 0) {
    pushBlank();
    pushRow(['Accounting reconciliation']);
    pushRow([
      'Accounting rows scanned',
      reconciliation.rowCount ?? ''
    ]);
    pushBlank();
    pushRow([
      'Column in File A',
      'Column in File B',
      'Difference (File A - File B)',
      'Accounting value column summed',
      'Filters applied',
      'Sum from accounting file',
      'Rows matched in accounting file',
      'Remaining delta (Difference - Sum)',
      'Status',
      'Notes'
    ]);
    reconciliation.rows.forEach((row) => {
      const statusLabel =
        row.status === 'match'
          ? 'Match'
          : row.status === 'mismatch'
            ? 'Off by ' + row.delta
            : row.status === 'error'
              ? 'Rule error'
              : 'Skipped';
      pushRow([
        row.colA,
        row.colB,
        row.diff,
        row.valueColumn ?? '',
        row.filterSummary ?? '',
        row.accountingSum ?? '',
        row.accountingSum === null || row.accountingSum === undefined ? '' : row.matchedRows ?? 0,
        row.delta ?? '',
        statusLabel,
        row.note ?? ''
      ]);
    });
  }

  return lines.join('\r\n');
}

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
