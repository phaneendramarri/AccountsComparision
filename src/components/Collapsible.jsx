import { useState } from 'react';

// Card-style collapsible section with a smooth open/close animation using the
// CSS grid-rows [1fr]/[0fr] trick so we don't have to measure heights.
//
// Props:
//   title       – required, string or node shown in the header
//   subtitle    – optional, small caption below the title
//   defaultOpen – whether the section starts expanded (default true)
//   actions     – optional node rendered on the right side of the header
//   children    – section content
export function Collapsible({
  title,
  subtitle,
  defaultOpen = true,
  actions = null,
  children
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <section className="card bg-base-100 border border-base-300 shadow-sm">
      <div className="card-body gap-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <button
            type="button"
            className="flex items-center gap-2 text-left min-w-0 flex-1 hover:opacity-80 transition-opacity"
            onClick={() => setOpen((current) => !current)}
            aria-expanded={open}
          >
            <span
              aria-hidden="true"
              className={[
                'inline-block transition-transform duration-300 ease-out text-base-content/60',
                open ? 'rotate-90' : ''
              ].join(' ')}
            >
              ▶
            </span>
            <span className="min-w-0">
              <span className="block card-title text-base">{title}</span>
              {subtitle ? (
                <span className="block text-sm text-base-content/60 font-normal">{subtitle}</span>
              ) : null}
            </span>
          </button>
          <div className="flex items-center gap-2">
            {actions}
            <button
              type="button"
              className="btn btn-ghost btn-xs"
              onClick={() => setOpen((current) => !current)}
              aria-label={open ? 'Collapse section' : 'Expand section'}
            >
              {open ? 'Hide' : 'Show'}
            </button>
          </div>
        </div>

        <div
          className={[
            'grid transition-all duration-300 ease-in-out',
            open ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
          ].join(' ')}
        >
          <div className="overflow-hidden">
            <div className="flex flex-col gap-4">{children}</div>
          </div>
        </div>
      </div>
    </section>
  );
}
