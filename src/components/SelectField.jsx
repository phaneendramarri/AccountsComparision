export function SelectField({ label, value, options, onChange, disabled = false, hint = '' }) {
  return (
    <div className="form-control w-full">
      <label className="label">
        <span className="label-text font-medium">{label}</span>
      </label>
      <select
        className="select select-bordered w-full"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled || options.length === 0}
      >
        <option value="">Select a column</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
      {hint ? (
        <label className="label">
          <span className="label-text-alt text-base-content/60">{hint}</span>
        </label>
      ) : null}
    </div>
  );
}
