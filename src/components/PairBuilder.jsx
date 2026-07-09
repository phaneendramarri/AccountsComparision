import { SelectField } from './SelectField';

export function PairBuilder({
  headersA,
  headersB,
  pendingColA,
  pendingColB,
  onChangePendingA,
  onChangePendingB,
  onAdd,
  onSave,
  comparisons,
  onRemoveComparison,
  canSave
}) {
  const canAdd = Boolean(pendingColA && pendingColB);

  return (
    <section className="card bg-base-100 border border-base-300 shadow-sm">
      <div className="card-body gap-4">
        <div className="flex items-center justify-between">
          <h2 className="card-title text-base">Pick numeric columns to sum</h2>
          <button
            type="button"
            className="btn btn-sm btn-outline"
            onClick={onSave}
            disabled={!canSave}
            title="Remember these pairs so you can apply them to future uploads"
          >
            Save pairs
          </button>
        </div>

        <div className="grid gap-3 md:grid-cols-[1fr_1fr_auto] md:items-end">
          <SelectField
            label="Column in File A"
            value={pendingColA}
            options={headersA}
            onChange={onChangePendingA}
          />
          <SelectField
            label="Column in File B"
            value={pendingColB}
            options={headersB}
            onChange={onChangePendingB}
          />
          <button type="button" className="btn btn-primary" onClick={onAdd} disabled={!canAdd}>
            Add pair
          </button>
        </div>

        {comparisons.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {comparisons.map((pair, index) => (
              <div
                key={`${pair.colA}::${pair.colB}`}
                className="badge badge-lg badge-outline gap-2 py-3"
              >
                <span className="font-medium">{pair.colA}</span>
                <span className="opacity-60">−</span>
                <span className="font-medium">{pair.colB}</span>
                <button
                  type="button"
                  className="btn btn-ghost btn-xs btn-circle"
                  onClick={() => onRemoveComparison(index)}
                  aria-label={`Remove ${pair.colA} vs ${pair.colB}`}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-base-content/60">
            Add at least one A / B column pair. Sums are computed only for these columns, so
            large files stay fast.
          </p>
        )}
      </div>
    </section>
  );
}
