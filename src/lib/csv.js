// Streaming CSV utilities. We never load a whole large file into memory:
// - `peekCsvHeaders` reads only the first slice of the file (default 128 KB) to
//   grab the header row.
// - `streamCsv` streams the file through a ReadableStream reader, decoding it
//   in chunks and emitting each parsed row via a callback. The parser is a
//   quote-aware state machine so it works across chunk boundaries.

const HEADER_PEEK_BYTES = 128 * 1024;

export async function peekCsvHeaders(file) {
  const slice = file.slice(0, HEADER_PEEK_BYTES);
  const text = (await slice.text()).replace(/^\uFEFF/, '');
  const newlineIndex = text.search(/\r?\n/);
  const line = newlineIndex >= 0 ? text.slice(0, newlineIndex) : text;
  return parseSingleLine(line)
    .map((header) => header.trim())
    .filter(Boolean);
}

function parseSingleLine(line) {
  const cells = [];
  let cell = '';
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    if (inQuotes) {
      if (character === '"') {
        if (line[index + 1] === '"') {
          cell += '"';
          index += 1;
        } else {
          inQuotes = false;
        }
      } else {
        cell += character;
      }
      continue;
    }
    if (character === '"') {
      inQuotes = true;
      continue;
    }
    if (character === ',') {
      cells.push(cell);
      cell = '';
      continue;
    }
    cell += character;
  }
  cells.push(cell);
  return cells;
}

// Streams the whole file and invokes `onRow(fields)` for every row it reads,
// including the header row. Memory usage stays flat because rows are handed
// off one at a time and never accumulated.
export async function streamCsv(file, onRow, { onProgress, signal } = {}) {
  const stream = file.stream();
  const reader = stream.getReader();
  const decoder = new TextDecoder('utf-8');

  let row = [];
  let cell = '';
  let inQuotes = false;
  let bytesRead = 0;
  let bomStripped = false;

  function processChunk(chunk) {
    if (!bomStripped) {
      if (chunk.charCodeAt(0) === 0xfeff) {
        chunk = chunk.slice(1);
      }
      bomStripped = true;
    }

    for (let index = 0; index < chunk.length; index += 1) {
      const character = chunk[index];
      if (inQuotes) {
        if (character === '"') {
          if (chunk[index + 1] === '"') {
            cell += '"';
            index += 1;
          } else {
            inQuotes = false;
          }
        } else {
          cell += character;
        }
        continue;
      }
      if (character === '"') {
        inQuotes = true;
        continue;
      }
      if (character === ',') {
        row.push(cell);
        cell = '';
        continue;
      }
      if (character === '\n') {
        row.push(cell);
        onRow(row);
        row = [];
        cell = '';
        continue;
      }
      if (character === '\r') {
        continue;
      }
      cell += character;
    }
  }

  try {
    // eslint-disable-next-line no-constant-condition
    while (true) {
      if (signal?.aborted) {
        throw new DOMException('Cancelled', 'AbortError');
      }
      const { done, value } = await reader.read();
      if (done) break;
      bytesRead += value.byteLength;
      processChunk(decoder.decode(value, { stream: true }));
      if (onProgress) onProgress(bytesRead);
    }
    processChunk(decoder.decode());

    if (cell.length > 0 || row.length > 0) {
      row.push(cell);
      onRow(row);
    }
    if (onProgress) onProgress(bytesRead);
  } finally {
    try {
      reader.releaseLock();
    } catch {
      /* ignore */
    }
  }

  return { bytesRead };
}

export function escapeCsv(value) {
  const string = String(value ?? '');
  if (/[",\r\n]/.test(string)) {
    return `"${string.replace(/"/g, '""')}"`;
  }
  return string;
}
