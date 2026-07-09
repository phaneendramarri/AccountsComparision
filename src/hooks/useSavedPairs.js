import { useCallback, useEffect, useState } from 'react';
import { readJson, writeJson } from '../lib/storage';

const STORAGE_KEY = 'accounts-compare:saved-pairs';

// A saved entry now stores just the column pairs so we can reuse them across
// different CSVs. Shape: { id, label, comparisons: [{ colA, colB }, ...], savedAt }
export function useSavedPairs() {
  const [savedPairs, setSavedPairs] = useState(() => readJson(STORAGE_KEY, []));

  useEffect(() => {
    writeJson(STORAGE_KEY, savedPairs);
  }, [savedPairs]);

  const savePair = useCallback((comparisons, label = '') => {
    if (!comparisons?.length) return;
    setSavedPairs((current) => {
      const withoutDuplicates = current.filter((item) => !isSameSet(item.comparisons, comparisons));
      const entry = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        label: label.trim() || buildDefaultLabel(comparisons),
        comparisons: comparisons.map((pair) => ({ ...pair })),
        savedAt: new Date().toISOString()
      };
      return [entry, ...withoutDuplicates];
    });
  }, []);

  const removePair = useCallback((id) => {
    setSavedPairs((current) => current.filter((item) => item.id !== id));
  }, []);

  const renamePair = useCallback((id, label) => {
    const trimmed = (label || '').trim();
    setSavedPairs((current) =>
      current.map((item) =>
        item.id === id
          ? { ...item, label: trimmed || buildDefaultLabel(item.comparisons) }
          : item
      )
    );
  }, []);

  const clearAll = useCallback(() => setSavedPairs([]), []);

  return { savedPairs, savePair, renamePair, removePair, clearAll };
}

function buildDefaultLabel(comparisons) {
  const preview = comparisons
    .slice(0, 2)
    .map((pair) => `${pair.colA}↔${pair.colB}`)
    .join(', ');
  const suffix = comparisons.length > 2 ? ` +${comparisons.length - 2}` : '';
  return `${preview}${suffix}`;
}

function isSameSet(a, b) {
  if (a.length !== b.length) return false;
  const key = (pair) => `${pair.colA}::${pair.colB}`;
  const aSet = new Set(a.map(key));
  return b.every((pair) => aSet.has(key(pair)));
}
