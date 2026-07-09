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

export function buildSummaryCsv({ comparisons, results }) {
  const headers = ['File A column', 'File B column', 'Sum A', 'Sum B', 'A - B', 'Numeric A', 'Numeric B'];
  const lines = [headers.map(escapeCsv).join(',')];
  results.forEach((row) => {
    lines.push(
      [
        row.colA,
        row.colB,
        row.sumA,
        row.sumB,
        row.diff,
        row.countA,
        row.countB
      ]
        .map(escapeCsv)
        .join(',')
    );
  });
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
