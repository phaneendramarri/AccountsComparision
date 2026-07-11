import React, { useState } from 'react';
import { ChevronDown } from 'lucide-react';

export function Collapsible({
  title,
  subtitle,
  defaultOpen = true,
  actions = null,
  badge = null,
  children
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <section className="rounded-2xl bg-base-100 border border-base-content/10 shadow-md hover:shadow-lg transition-all duration-300 overflow-hidden">
      <div className="p-5 sm:p-6 flex flex-col gap-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <button
            type="button"
            className="flex items-center gap-3 text-left min-w-0 flex-1 group"
            onClick={() => setOpen((current) => !current)}
            aria-expanded={open}
          >
            <div
              className={`w-8 h-8 rounded-lg bg-base-200 flex items-center justify-center text-base-content/70 group-hover:bg-primary/10 group-hover:text-primary transition-all duration-300 ${
                open ? 'rotate-180 bg-primary/10 text-primary' : ''
              }`}
            >
              <ChevronDown className="w-4 h-4 transition-transform duration-300" />
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold font-display tracking-tight text-base-content group-hover:text-primary transition-colors">
                  {title}
                </h2>
                {badge && <div>{badge}</div>}
              </div>
              {subtitle ? (
                <p className="text-xs sm:text-sm text-base-content/60 mt-0.5">{subtitle}</p>
              ) : null}
            </div>
          </button>

          {actions ? (
            <div
              onClick={(e) => e.stopPropagation()}
              className="flex items-center gap-2"
            >
              {actions}
            </div>
          ) : null}
        </div>

        <div
          className={[
            'grid transition-[grid-template-rows,opacity] duration-300 ease-out',
            open ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
          ].join(' ')}
        >
          <div className="overflow-hidden">
            <div className="pt-2 border-t border-base-content/5 mt-1">{children}</div>
          </div>
        </div>
      </div>
    </section>
  );
}
