import { ThemeToggle } from './ThemeToggle';

export function Header({ theme, onToggleTheme }) {
  return (
    <header className="navbar bg-base-100 border-b border-base-300 px-4">
      <div className="flex-1">
        <span className="text-lg font-semibold">CSV Compare</span>
        <span className="ml-2 text-sm text-base-content/60 hidden sm:inline">
          Match two files on a key, show numeric differences.
        </span>
      </div>
      <div className="flex-none">
        <ThemeToggle theme={theme} onToggle={onToggleTheme} />
      </div>
    </header>
  );
}
