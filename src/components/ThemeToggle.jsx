export function ThemeToggle({ theme, onToggle }) {
  const isDark = theme === 'dark';
  return (
    <label className="swap swap-rotate" aria-label="Toggle theme">
      <input type="checkbox" checked={isDark} onChange={onToggle} />
      <span className="swap-on text-lg">🌙</span>
      <span className="swap-off text-lg">☀️</span>
    </label>
  );
}
