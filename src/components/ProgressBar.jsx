export function ProgressBar({ label, percent, subtitle }) {
  const clamped = Math.max(0, Math.min(100, Math.round(percent || 0)));
  return (
    <div className="w-full">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium">{label}</span>
        <span className="text-base-content/60">{clamped}%</span>
      </div>
      <progress className="progress progress-primary w-full" value={clamped} max="100" />
      {subtitle ? <div className="text-xs text-base-content/60 mt-1">{subtitle}</div> : null}
    </div>
  );
}
