import { formatNumber } from '../lib/format';

function Stat({ title, value, description }) {
  return (
    <div className="stat bg-base-100 border border-base-300 rounded-box">
      <div className="stat-title">{title}</div>
      <div className="stat-value text-2xl">{value}</div>
      {description ? <div className="stat-desc">{description}</div> : null}
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
  return <span className={cls}>{formatNumber(value)}</span>;
}

export function ResultsSummary({ rowCountA, rowCountB, pairs }) {
  return (
    <section className="card bg-base-100 border border-base-300 shadow-sm">
      <div className="card-body gap-4">
        <h2 className="card-title text-base">Totals</h2>

        <div className="grid gap-3 sm:grid-cols-2">
          <Stat title="Rows in File A" value={rowCountA.toLocaleString()} />
          <Stat title="Rows in File B" value={rowCountB.toLocaleString()} />
        </div>

        <h3 className="text-sm font-semibold uppercase tracking-wide text-base-content/60 mt-2">
          Column diff (A − B)
        </h3>

        <div className="overflow-x-auto rounded-lg border border-base-300">
          <table className="table table-sm">
            <thead>
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
                <tr key={`${row.colA}::${row.colB}`}>
                  <td className="font-medium">{row.colA}</td>
                  <td className="font-medium">{row.colB}</td>
                  <td className="text-right">{formatNumber(row.sumA)}</td>
                  <td className="text-right">{formatNumber(row.sumB)}</td>
                  <td className="text-right font-semibold">
                    <DiffValue value={row.diff} />
                  </td>
                  <td className="text-right text-base-content/70">
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
    </section>
  );
}
