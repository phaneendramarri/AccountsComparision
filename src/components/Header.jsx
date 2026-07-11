import React from 'react';
import { Sparkles, Moon, Sun, Layers, HelpCircle } from 'lucide-react';

export function Header({ theme, onToggleTheme }) {
  return (
    <header className="glass-header shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand Logo & Title */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center shadow-lg shadow-primary/25 text-primary-content transition-transform duration-300 hover:scale-105">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-extrabold font-display tracking-tight bg-gradient-to-r from-base-content via-base-content/90 to-base-content/60 bg-clip-text">
                Reconcile<span className="text-primary">AI</span>
              </h1>
              <span className="badge badge-primary badge-xs py-2 px-2 font-semibold tracking-wide uppercase text-[10px]">
                v2.0 Engine
              </span>
            </div>
            <p className="text-xs text-base-content/60 font-medium hidden sm:block">
              Per-Key Streaming Reconciliation for 1GB+ Financial CSVs
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-3">
          <div className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-base-200/80 border border-base-content/10 text-xs font-medium text-base-content/80">
            <Sparkles className="w-3.5 h-3.5 text-warning animate-pulse" />
            <span>O(1) Memory Stream</span>
          </div>

          {/* Theme Toggle Button */}
          <button
            type="button"
            onClick={onToggleTheme}
            className="btn btn-ghost btn-sm btn-circle hover:bg-base-200 transition-all duration-200"
            title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
          >
            {theme === 'dark' ? (
              <Sun className="w-4 h-4 text-warning transition-transform duration-300 hover:rotate-45" />
            ) : (
              <Moon className="w-4 h-4 text-primary transition-transform duration-300 hover:-rotate-12" />
            )}
          </button>
        </div>
      </div>
    </header>
  );
}
