export function Loader({ message = 'Loading...' }) {
  return (
    <div className="flex items-center gap-3 text-base-content/70">
      <span className="loading loading-spinner loading-sm" />
      <span>{message}</span>
    </div>
  );
}
