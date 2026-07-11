// Frontend-only helpers for the accounting rule shape used by
// AccountingReconcile. Parts and filters get client-side ids while they're
// being edited (needed as React keys). Ids are stripped before persisting to
// JSON / localStorage, and re-assigned when loading a stored setup back in.

let idCounter = 0;
const nextId = (prefix) => {
  idCounter += 1;
  return `${prefix}_${idCounter}`;
};

export function emptyFilter() {
  return { id: nextId('f'), column: '', valuesText: '' };
}

export function emptyPart(sign = 1) {
  return { id: nextId('p'), sign: sign === -1 ? -1 : 1, column: '', filters: [emptyFilter()] };
}

export function emptyRule() {
  return { parts: [emptyPart(1)] };
}

// Turn a persisted rule (no ids) into an editable rule (with ids). Falls back
// to an empty rule if the input is missing or malformed.
export function hydrateRule(raw) {
  if (!raw || !Array.isArray(raw.parts) || raw.parts.length === 0) {
    return emptyRule();
  }
  return {
    parts: raw.parts.map((part) => ({
      id: nextId('p'),
      sign: part.sign === -1 ? -1 : 1,
      column: part.column || '',
      filters:
        Array.isArray(part.filters) && part.filters.length > 0
          ? part.filters.map((filter) => ({
              id: nextId('f'),
              column: filter.column || '',
              valuesText: filter.valuesText || ''
            }))
          : [emptyFilter()]
    }))
  };
}

// Strip ids and normalise before saving to localStorage or exporting to JSON.
export function dehydrateRule(rule) {
  if (!rule || !Array.isArray(rule.parts)) return { parts: [] };
  return {
    parts: rule.parts.map((part) => ({
      sign: part.sign === -1 ? -1 : 1,
      column: part.column || '',
      filters: (part.filters || []).map((filter) => ({
        column: filter.column || '',
        valuesText: filter.valuesText || ''
      }))
    }))
  };
}

// A rule counts as "active" for streaming purposes only when at least one
// part has a value column selected.
export function isRuleActive(rule) {
  if (!rule || !Array.isArray(rule.parts)) return false;
  return rule.parts.some((part) => part.column);
}

// Parse the raw comma-separated user text into a normalised Set that is safe
// to compare against trimmed / lower-cased CSV cells at stream time.
export function parseFilterValues(raw) {
  return new Set(
    (raw || '')
      .split(',')
      .map((token) => token.trim().toLowerCase())
      .filter(Boolean)
  );
}

function formatPartExpression(part, { leading = false } = {}) {
  if (!part.column) return '';
  const filters = (part.filters || [])
    .map((filter) => ({
      column: filter.column,
      values: parseFilterValues(filter.valuesText)
    }))
    .filter((filter) => filter.column && filter.values.size > 0);
  const filterStr =
    filters.length > 0
      ? ' where ' +
        filters
          .map((filter) => `${filter.column} ∈ {${Array.from(filter.values).join(', ')}}`)
          .join(' AND ')
      : '';
  const body = `Σ(${part.column}${filterStr})`;
  if (leading) return part.sign === -1 ? `− ${body}` : body;
  return part.sign === -1 ? `− ${body}` : `+ ${body}`;
}

// Human-readable formula string for the whole rule, e.g.
//   `+ Σ(amount where glcode ∈ {2134}) − Σ(refund where txntype ∈ {1})`
export function formatRulePreview(rule) {
  if (!rule || !Array.isArray(rule.parts)) return '';
  const active = rule.parts.filter((part) => part.column);
  if (active.length === 0) return '';
  return active
    .map((part, index) => formatPartExpression(part, { leading: index === 0 }))
    .filter(Boolean)
    .join(' ');
}

// Turn a rule into the pair spec shape the streamer expects.
export function ruleToPairSpec(rule) {
  const parts = (rule.parts || [])
    .filter((part) => part.column)
    .map((part) => ({
      sign: part.sign === -1 ? -1 : 1,
      column: part.column,
      filters: (part.filters || [])
        .map((filter) => ({
          column: filter.column,
          values: parseFilterValues(filter.valuesText)
        }))
        .filter((filter) => filter.column && filter.values.size > 0)
    }));
  return { parts };
}
