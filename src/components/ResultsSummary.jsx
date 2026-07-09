import { formatNumber } from '../lib/format';

function TotalCard({ label, value, sublabel, tone = 'primary' }) {
  const toneClasses = {
    primary: 'bg-primary/10 text-primary border-primary/30',
    secondary: 'bg-secondary/10 text-secondary border-secondary/30'
  }[tone];

  return (
    <div className="rounded-2xl border border-base-300 bg-base-100 p-5 flex items-center gap-4">
      <div
        className={`w-14 h-14 rounded-xl border flex items-center justify-center ${toneClasses}`}
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" className="w-7 h-7">
          <path
            d="M4 6h16M4 12h10M4 18h16"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
        </svg>
      </div>
      <div className="min-w-0">
        <div className="text-xs uppercase tracking-wider text-base-content/60">{label}</div>
        <div className="text-3xl font-bold leading-tight truncate">{value}</div>
        {sublabel ? (
          <div className="text-xs text-base-content/60 mt-0.5">{sublabel}</div>
        ) : null}
      </div>
    </div>
  );
}

function DiffValue({ value }) {
  const cls =
    value === 0
      ? 'text-base-content/70'
      : value > 0
        ? 'text-success'
        : 'text-error';
  return <span className={`font-semibold ${cls}`}>{formatNumber(value)}</span>;
}

export function ResultsSummary({ rowCountA, rowCountB, pairs }) {
  const totalDiff = pairs.reduce((acc, pair) => acc + pair.diff, 0);

  return (
    <section className="card bg-base-100 border border-base-300 shadow-sm">
      <div className="card-body gap-5">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h2 className="card-title text-base">Totals</h2>
          <div className="text-xs text-base-content/60">
            {pairs.length} pair{pairs.length === 1 ? '' : 's'} · total diff{' '}
            <DiffValue value={totalDiff} />
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <TotalCard
            label="Rows in File A"
            value={rowCountA.toLocaleString()}
            sublabel="Streamed from source"
            tone="primary"
          />
          <TotalCard
            label="Rows in File B"
            value={rowCountB.toLocaleString()}
            sublabel="Streamed from lookup"
            tone="secondary"
          />
        </div>

        <div>
          <h3 className="text-sm font-semibold uppercase tracking-wide text-base-content/60 mb-2">
            Column diff (A − B)
          </h3>
          <div className="overflow-x-auto rounded-xl border border-base-300">
            <table className="table table-sm">
              <thead className="bg-base-200/60">
                <tr>
                  <th>File A column</th>
                  <th>File B column</th>
                  <th className="text-right">Σ A</th>
                  <th className="text-right">Σ B</th>
                  <th className="text-right">A − B</th>
                  <th className="text-right">Numeric A / B</th>
                </tr>
              </thead>
              <tbody>
                {pairs.map((row) => (
                  <tr key={`${row.colA}::${row.colB}`} className="hover">
                    <td className="font-medium">{row.colA}</td>
                    <td className="font-medium">{row.colB}</td>
                    <td className="text-right tabular-nums">{formatNumber(row.sumA)}</td>
                    <td className="text-right tabular-nums">{formatNumber(row.sumB)}</td>
                    <td className="text-right tabular-nums">
                      <DiffValue value={row.diff} />
                    </td>
                    <td className="text-right text-base-content/70 tabular-nums">
                      {row.countA.toLocaleString()} / {row.countB.toLocaleString()}
                      {row.nonNumericA + row.nonNumericB > 0 ? (
                        <span className="block text-[11px] text-warning">
                          skipped {row.nonNumericA + row.nonNumericB} non-numeric
                        </span>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </section>
  );
}
