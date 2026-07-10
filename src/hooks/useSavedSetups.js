import { useCallback, useEffect, useMemo, useState } from 'react';
import { readJson, writeJson } from '../lib/storage';

const STORAGE_KEY = 'accounts-compare:saved-setups';
const DEFAULTS_LOADED_KEY = 'accounts-compare:defaults-seeded';

// A "setup" bundles the columns to compare AND their per-pair accounting
// reconciliation rules, so a whole reconciliation configuration can be saved
// and re-applied in one shot.
//
// Persisted shape (no client-side ids):
//   {
//     id, label, savedAt, isDefault?,
//     pairs: [{ colA, colB }],
//     accountingRules: {
//       [`${colA}::${colB}`]: {
//         parts: [{
//           sign: 1 | -1,
//           column: string,
//           filters: [{ column: string, valuesText: string }]
//         }]
//       }
//     }
//   }

// Shipped example configurations. Seeded on first run so the user has
// something to look at / clone. Also available any time via
// "Load sample setups" in the panel.
export const DEFAULT_SETUPS = [
  {
    id: 'default-overdue-final',
    label: 'Overdue principal & interest (LYCAmount by GLCode)',
    savedAt: '2026-07-10T06:47:25.725Z',
    isDefault: true,
    pairs: [
      { colA: 'OVERDUE PRINCIPAL AMOUNT', colB: 'OVERDUE PRINCIPAL AMOUNT' },
      { colA: 'OVERDUE INTEREST AMOUNT', colB: 'OVERDUE INTEREST AMOUNT' }
    ],
    accountingRules: {
      'OVERDUE PRINCIPAL AMOUNT::OVERDUE PRINCIPAL AMOUNT': {
        parts: [
          {
            sign: 1,
            column: 'LYCAmount',
            filters: [
              {
                column: 'GLCode',
                valuesText:
                  'A03201, A03122, A03114, A03124, A03116, A03126, A03118, A03128, A03203, A03120, A03203'
              },
              { column: 'TransactionTypeId', valuesText: '1' }
            ]
          }
        ]
      },
      'OVERDUE INTEREST AMOUNT::OVERDUE INTEREST AMOUNT': {
        parts: [
          {
            sign: 1,
            column: 'LYCAmount',
            filters: [
              {
                column: 'GLCode',
                valuesText:
                  'A03202, A03123, A03115, A03125, A03117, A03127, A03119, A03129, A03121, A03204'
              },
              { column: 'TransactionTypeId', valuesText: '1' }
            ]
          }
        ]
      }
    }
  },
  {
    id: 'default-principal-outstanding',
    label: 'Sample · Principal Outstanding reconciliation',
    savedAt: '2024-01-01T00:00:00.000Z',
    isDefault: true,
    pairs: [{ colA: 'Principal Outstanding', colB: 'Principal Outstanding' }],
    accountingRules: {
      'Principal Outstanding::Principal Outstanding': {
        parts: [
          {
            sign: 1,
            column: 'amount',
            filters: [
              { column: 'glcode', valuesText: '2134, 235' },
              { column: 'transactiontype', valuesText: '1, 0' }
            ]
          }
        ]
      }
    }
  },
  {
    id: 'default-interest-accrued',
    label: 'Sample · Interest accrued (add debits, subtract credits)',
    savedAt: '2024-01-01T00:00:00.000Z',
    isDefault: true,
    pairs: [{ colA: 'Interest Accrued', colB: 'Interest Accrued' }],
    accountingRules: {
      'Interest Accrued::Interest Accrued': {
        parts: [
          {
            sign: 1,
            column: 'amount',
            filters: [
              { column: 'glcode', valuesText: '4001' },
              { column: 'transactiontype', valuesText: '1' }
            ]
          },
          {
            sign: -1,
            column: 'amount',
            filters: [
              { column: 'glcode', valuesText: '4001' },
              { column: 'transactiontype', valuesText: '0' }
            ]
          }
        ]
      }
    }
  }
];

function newId(prefix = 'setup') {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function buildDefaultLabel(pairs) {
  const preview = pairs
    .slice(0, 2)
    .map((pair) => `${pair.colA}↔${pair.colB}`)
    .join(', ');
  const suffix = pairs.length > 2 ? ` +${pairs.length - 2}` : '';
  return `${preview}${suffix}` || 'Untitled setup';
}

function normaliseSetup(raw, { fallbackIdPrefix = 'setup' } = {}) {
  if (!raw || !Array.isArray(raw.pairs) || raw.pairs.length === 0) return null;
  const pairs = raw.pairs
    .map((pair) => ({
      colA: String(pair.colA ?? '').trim(),
      colB: String(pair.colB ?? '').trim()
    }))
    .filter((pair) => pair.colA && pair.colB);
  if (pairs.length === 0) return null;
  const accountingRules =
    raw.accountingRules && typeof raw.accountingRules === 'object' ? raw.accountingRules : {};
  return {
    id: raw.id || newId(fallbackIdPrefix),
    label: (raw.label || '').trim() || buildDefaultLabel(pairs),
    savedAt: raw.savedAt || new Date().toISOString(),
    isDefault: Boolean(raw.isDefault),
    pairs,
    accountingRules
  };
}

export function useSavedSetups() {
  const [setups, setSetups] = useState(() => {
    const stored = readJson(STORAGE_KEY, null);
    if (Array.isArray(stored)) {
      // Merge in any shipped defaults that are missing so newly-added presets
      // become visible after an app update without requiring a click.
      const existingIds = new Set(stored.map((setup) => setup.id));
      const missingDefaults = DEFAULT_SETUPS.filter(
        (setup) => !existingIds.has(setup.id)
      ).map((setup) => ({ ...setup }));
      return missingDefaults.length > 0 ? [...missingDefaults, ...stored] : stored;
    }
    // First run – seed with the shipped defaults.
    return DEFAULT_SETUPS.map((setup) => ({ ...setup }));
  });

  useEffect(() => {
    writeJson(STORAGE_KEY, setups);
  }, [setups]);

  // Marker so we can tell first-visit vs a user who cleared everything.
  useEffect(() => {
    if (readJson(DEFAULTS_LOADED_KEY, false) !== true) {
      writeJson(DEFAULTS_LOADED_KEY, true);
    }
  }, []);

  const saveSetup = useCallback((payload) => {
    const normalised = normaliseSetup(
      {
        id: newId(),
        savedAt: new Date().toISOString(),
        label: payload?.label,
        pairs: payload?.pairs,
        accountingRules: payload?.accountingRules
      },
      { fallbackIdPrefix: 'setup' }
    );
    if (!normalised) return null;
    setSetups((current) => {
      const withoutDuplicate = current.filter((item) => item.id !== normalised.id);
      return [normalised, ...withoutDuplicate];
    });
    return normalised;
  }, []);

  const renameSetup = useCallback((id, label) => {
    const trimmed = (label || '').trim();
    setSetups((current) =>
      current.map((item) =>
        item.id === id
          ? { ...item, label: trimmed || buildDefaultLabel(item.pairs) }
          : item
      )
    );
  }, []);

  const removeSetup = useCallback((id) => {
    setSetups((current) => current.filter((item) => item.id !== id));
  }, []);

  const clearAll = useCallback(() => setSetups([]), []);

  const loadDefaults = useCallback(() => {
    setSetups((current) => {
      const existingIds = new Set(current.map((setup) => setup.id));
      const additions = DEFAULT_SETUPS.filter((setup) => !existingIds.has(setup.id)).map(
        (setup) => ({ ...setup })
      );
      return [...additions, ...current];
    });
  }, []);

  const importSetups = useCallback((raw) => {
    let list = null;
    if (Array.isArray(raw)) list = raw;
    else if (raw && Array.isArray(raw.setups)) list = raw.setups;
    else if (raw && Array.isArray(raw.pairs)) list = [raw];

    if (!list) {
      return { added: 0, errors: ['Unrecognised JSON shape. Expected an array of setups or a single setup object.'] };
    }

    const errors = [];
    const cleaned = list
      .map((entry, index) => {
        const normalised = normaliseSetup(
          { ...entry, id: entry?.id || newId(`imported-${index}`), isDefault: false },
          { fallbackIdPrefix: `imported-${index}` }
        );
        if (!normalised) {
          errors.push(`Entry ${index + 1}: no valid pairs.`);
          return null;
        }
        return normalised;
      })
      .filter(Boolean);

    setSetups((current) => {
      const existingIds = new Set(current.map((setup) => setup.id));
      const additions = cleaned.filter((setup) => !existingIds.has(setup.id));
      return [...additions, ...current];
    });

    return { added: cleaned.length, errors };
  }, []);

  // Convenience for the "Export" button in the panel.
  const exportSetupJson = useCallback(
    (id) => {
      const found = setups.find((setup) => setup.id === id);
      if (!found) return null;
      const { id: _dropId, isDefault: _dropDefault, savedAt: _dropSavedAt, ...rest } = found;
      return JSON.stringify(
        {
          version: 1,
          exportedAt: new Date().toISOString(),
          setups: [{ ...rest }]
        },
        null,
        2
      );
    },
    [setups]
  );

  const exportAllJson = useMemo(
    () =>
      JSON.stringify(
        {
          version: 1,
          exportedAt: new Date().toISOString(),
          setups: setups.map(({ id: _id, isDefault: _isDefault, ...rest }) => rest)
        },
        null,
        2
      ),
    [setups]
  );

  return {
    setups,
    saveSetup,
    renameSetup,
    removeSetup,
    clearAll,
    loadDefaults,
    importSetups,
    exportSetupJson,
    exportAllJson
  };
}
