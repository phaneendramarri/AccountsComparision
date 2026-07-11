import React, { useState } from 'react';
import { SearchableSelect } from './SearchableSelect';
import { formatSideLabel, getPartsA, getPartsB } from '../lib/engine';
import { GitCompare, PlusCircle, Trash2, ArrowLeftRight, Layers } from 'lucide-react';

export function PairBuilder({
  headersA,
  headersB,
  commonColumns,
  comparisons,
  onAddPair,
  onRemovePair,
  onClearAll,
  disabled
}) {
  const [colA, setColA] = useState('');
  const [colB, setColB] = useState('');

  const [mode, setMode] = useState('simple'); // 'simple' | 'composite'
  const [compositePartsA, setCompositePartsA] = useState([{ col: '', sign: 1 }]);
  const [compositePartsB, setCompositePartsB] = useState([{ col: '', sign: 1 }]);

  function handleAddSimple() {
    if (!colA || !colB) return;
    onAddPair({ colA, colB, partsA: [{ col: colA, sign: 1 }], partsB: [{ col: colB, sign: 1 }] });
    setColA('');
    setColB('');
  }

  function handleAddCommon(colName) {
    onAddPair({
      colA: colName,
      colB: colName,
      partsA: [{ col: colName, sign: 1 }],
      partsB: [{ col: colName, sign: 1 }]
    });
  }

  function handleAddComposite() {
    const validPartsA = compositePartsA.filter((p) => p.col);
    const validPartsB = compositePartsB.filter((p) => p.col);
    if (validPartsA.length === 0 || validPartsB.length === 0) return;

    const mainColA = validPartsA[0].col;
    const mainColB = validPartsB[0].col;

    onAddPair({
      colA: mainColA,
      colB: mainColB,
      partsA: validPartsA,
      partsB: validPartsB
    });

    setCompositePartsA([{ col: '', sign: 1 }]);
    setCompositePartsB([{ col: '', sign: 1 }]);
  }

  const existingPairsSet = new Set(comparisons.map((p) => `${p.colA}::${p.colB}`));

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2 text-xs sm:text-sm text-base-content/70">
          <GitCompare className="w-4 h-4 text-primary shrink-0" />
          <span>
            Choose columns to sum and compare between File A and File B.
          </span>
        </div>
        <div className="join bg-base-200 p-1 rounded-xl border border-base-content/10">
          <button
            type="button"
            className={`btn btn-xs join-item rounded-lg gap-1.5 ${
              mode === 'simple' ? 'btn-primary shadow-sm' : 'btn-ghost'
            }`}
            onClick={() => setMode('simple')}
          >
            <ArrowLeftRight className="w-3.5 h-3.5" /> 1-to-1 Pair
          </button>
          <button
            type="button"
            className={`btn btn-xs join-item rounded-lg gap-1.5 ${
              mode === 'composite' ? 'btn-primary shadow-sm' : 'btn-ghost'
            }`}
            onClick={() => setMode('composite')}
          >
            <Layers className="w-3.5 h-3.5" /> Composite Formula (+/−)
          </button>
        </div>
      </div>

      {mode === 'simple' ? (
        <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] items-end bg-base-200/50 p-4 rounded-2xl border border-base-content/10 shadow-sm">
          <div className="form-control w-full">
            <label className="label py-1">
              <span className="label-text text-xs font-bold uppercase tracking-wider text-primary">
                File A Numeric Column
              </span>
            </label>
            <SearchableSelect
              value={colA}
              options={headersA}
              onChange={setColA}
              placeholder="Search File A numeric column…"
              disabled={disabled}
            />
          </div>

          <div className="form-control w-full">
            <label className="label py-1">
              <span className="label-text text-xs font-bold uppercase tracking-wider text-secondary">
                File B Numeric Column
              </span>
            </label>
            <SearchableSelect
              value={colB}
              options={headersB}
              onChange={setColB}
              placeholder="Search File B numeric column…"
              disabled={disabled}
            />
          </div>

          <button
            type="button"
            className="btn btn-primary min-w-[130px] gap-2 shadow-md shadow-primary/20"
            onClick={handleAddSimple}
            disabled={!colA || !colB || disabled}
          >
            <PlusCircle className="w-4 h-4" /> Add Pair
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-4 bg-base-200/50 p-5 rounded-2xl border border-base-content/10 shadow-sm">
          <div className="grid gap-6 md:grid-cols-2">
            {/* Side A formula */}
            <div className="flex flex-col gap-3 p-4 rounded-xl bg-base-100 border border-primary/20">
              <div className="text-xs font-bold uppercase tracking-wider text-primary flex items-center gap-1.5">
                File A Formula (+/− Columns)
              </div>
              {compositePartsA.map((part, idx) => (
                <div key={idx} className="grid grid-cols-[85px_minmax(0,1fr)_auto] gap-2 items-center">
                  <select
                    className="select select-bordered select-sm"
                    value={part.sign === -1 ? '-1' : '1'}
                    onChange={(e) => {
                      const sign = e.target.value === '-1' ? -1 : 1;
                      setCompositePartsA((curr) =>
                        curr.map((p, i) => (i === idx ? { ...p, sign } : p))
                      );
                    }}
                  >
                    <option value="1">+ Add</option>
                    <option value="-1">− Sub</option>
                  </select>
                  <SearchableSelect
                    value={part.col}
                    options={headersA}
                    onChange={(val) =>
                      setCompositePartsA((curr) =>
                        curr.map((p, i) => (i === idx ? { ...p, col: val } : p))
                      )
                    }
                    placeholder="Search File A column…"
                  />
                  <button
                    type="button"
                    className="btn btn-ghost btn-xs text-base-content/60 hover:text-error"
                    onClick={() =>
                      setCompositePartsA((curr) =>
                        curr.length <= 1 ? [{ col: '', sign: 1 }] : curr.filter((_, i) => i !== idx)
                      )
                    }
                  >
                    ✕
                  </button>
                </div>
              ))}
              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  className="btn btn-xs btn-outline btn-primary"
                  onClick={() => setCompositePartsA((curr) => [...curr, { col: '', sign: 1 }])}
                >
                  + Add (+) Column
                </button>
                <button
                  type="button"
                  className="btn btn-xs btn-outline btn-error"
                  onClick={() => setCompositePartsA((curr) => [...curr, { col: '', sign: -1 }])}
                >
                  − Add (−) Column
                </button>
              </div>
            </div>

            {/* Side B formula */}
            <div className="flex flex-col gap-3 p-4 rounded-xl bg-base-100 border border-secondary/20">
              <div className="text-xs font-bold uppercase tracking-wider text-secondary flex items-center gap-1.5">
                File B Formula (+/− Columns)
              </div>
              {compositePartsB.map((part, idx) => (
                <div key={idx} className="grid grid-cols-[85px_minmax(0,1fr)_auto] gap-2 items-center">
                  <select
                    className="select select-bordered select-sm"
                    value={part.sign === -1 ? '-1' : '1'}
                    onChange={(e) => {
                      const sign = e.target.value === '-1' ? -1 : 1;
                      setCompositePartsB((curr) =>
                        curr.map((p, i) => (i === idx ? { ...p, sign } : p))
                      );
                    }}
                  >
                    <option value="1">+ Add</option>
                    <option value="-1">− Sub</option>
                  </select>
                  <SearchableSelect
                    value={part.col}
                    options={headersB}
                    onChange={(val) =>
                      setCompositePartsB((curr) =>
                        curr.map((p, i) => (i === idx ? { ...p, col: val } : p))
                      )
                    }
                    placeholder="Search File B column…"
                  />
                  <button
                    type="button"
                    className="btn btn-ghost btn-xs text-base-content/60 hover:text-error"
                    onClick={() =>
                      setCompositePartsB((curr) =>
                        curr.length <= 1 ? [{ col: '', sign: 1 }] : curr.filter((_, i) => i !== idx)
                      )
                    }
                  >
                    ✕
                  </button>
                </div>
              ))}
              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  className="btn btn-xs btn-outline btn-secondary"
                  onClick={() => setCompositePartsB((curr) => [...curr, { col: '', sign: 1 }])}
                >
                  + Add (+) Column
                </button>
                <button
                  type="button"
                  className="btn btn-xs btn-outline btn-error"
                  onClick={() => setCompositePartsB((curr) => [...curr, { col: '', sign: -1 }])}
                >
                  − Add (−) Column
                </button>
              </div>
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="button"
              className="btn btn-primary gap-2 shadow-md shadow-primary/20"
              onClick={handleAddComposite}
              disabled={disabled}
            >
              <PlusCircle className="w-4 h-4" /> Add Composite Formula Pair
            </button>
          </div>
        </div>
      )}

      {/* Common Columns Quick Add */}
      {commonColumns.length > 0 && (
        <div className="flex flex-col gap-2">
          <div className="text-xs font-bold uppercase tracking-wider text-base-content/60">
            Quick Add Matching Columns
          </div>
          <div className="flex flex-wrap gap-2">
            {commonColumns.map((col) => {
              const alreadyAdded = existingPairsSet.has(`${col}::${col}`);
              return (
                <button
                  key={col}
                  type="button"
                  className={`btn btn-xs rounded-full px-3 transition-all ${
                    alreadyAdded
                      ? 'btn-disabled opacity-40'
                      : 'btn-outline border-base-content/20 hover:border-primary hover:text-primary'
                  }`}
                  onClick={() => handleAddCommon(col)}
                  disabled={alreadyAdded || disabled}
                >
                  + {col}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Selected Pairs List */}
      {comparisons.length > 0 ? (
        <div className="flex flex-col gap-3 pt-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-base-content/70">
              Selected Comparison Pairs ({comparisons.length})
            </span>
            <button
              type="button"
              className="btn btn-xs btn-ghost text-error gap-1 hover:bg-error/10"
              onClick={onClearAll}
              disabled={disabled}
            >
              <Trash2 className="w-3.5 h-3.5" /> Clear All
            </button>
          </div>

          <div className="flex flex-wrap gap-2.5">
            {comparisons.map((pair, idx) => {
              const labelA = formatSideLabel(getPartsA(pair), pair.colA);
              const labelB = formatSideLabel(getPartsB(pair), pair.colB);
              return (
                <div
                  key={`${pair.colA}::${pair.colB}::${idx}`}
                  className="group flex items-center gap-2.5 px-3.5 py-2 rounded-xl bg-base-100 border border-base-content/10 shadow-sm hover:border-primary/40 transition-all duration-200"
                >
                  <span className="text-primary font-semibold text-xs sm:text-sm">{labelA}</span>
                  <ArrowLeftRight className="w-3.5 h-3.5 text-base-content/40" />
                  <span className="text-secondary font-semibold text-xs sm:text-sm">{labelB}</span>
                  <button
                    type="button"
                    className="w-5 h-5 rounded-full flex items-center justify-center text-base-content/50 hover:bg-error/20 hover:text-error transition-colors ml-1"
                    onClick={() => onRemovePair(idx)}
                    disabled={disabled}
                    title="Remove pair"
                  >
                    ✕
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}
