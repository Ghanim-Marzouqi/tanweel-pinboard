import { forwardRef } from 'react';
import { ChevronDown } from 'lucide-react';
import { cx } from '@/lib/utils';

export const Select = forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(
  function Select({ className, children, ...rest }, ref) {
    return (
      <div className="relative">
        <select
          ref={ref}
          className={cx(
            'h-11 w-full rounded-lg border border-[color:var(--border)]',
            'bg-[color:var(--surface)] px-3 pe-9 text-sm text-[color:var(--text)]',
            'transition-colors duration-150',
            'focus-visible:outline-none focus-visible:border-[color:var(--accent)] focus-visible:ring-2 focus-visible:ring-[color:var(--accent-ring)]',
            'disabled:cursor-not-allowed disabled:opacity-60',
            'appearance-none',
            className,
          )}
          {...rest}
        >
          {children}
        </select>
        <ChevronDown
          aria-hidden
          size={16}
          className="pointer-events-none absolute top-1/2 -translate-y-1/2 text-[color:var(--text-faint)] end-3"
        />
      </div>
    );
  },
);
