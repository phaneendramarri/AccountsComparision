function formatBytes(size) {
  if (!size) return '';
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

export function FileUpload({ label, file, loading, onChange }) {
  return (
    <div className="form-control w-full">
      <label className="label">
        <span className="label-text font-medium">{label}</span>
        {loading ? <span className="loading loading-spinner loading-xs" /> : null}
      </label>
      <input
        type="file"
        accept=".csv,text/csv"
        onChange={onChange}
        className="file-input file-input-bordered w-full"
        disabled={loading}
      />
      <label className="label">
        <span className="label-text-alt text-base-content/60">
          {file?.name
            ? `${file.name} · ${formatBytes(file.size)} · ${file.headers.length} columns detected`
            : 'Pick a CSV file (large files are streamed).'}
        </span>
      </label>
    </div>
  );
}
