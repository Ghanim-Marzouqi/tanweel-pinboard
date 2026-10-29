import { forwardRef } from 'react';
import { cx } from '@/lib/utils';

export const Input = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, type = 'text', ...rest }, ref) {
    return (
      <input
        ref={ref}
        type={type}
        className={cx(
          'h-11 w-full rounded-lg border border-[color:var(--border)]',
          'bg-[color:var(--surface)] px-3 text-sm sm:text-sm text-[color:var(--text)]',
          'placeholder:text-[color:var(--text-faint)]',
          'transition-colors duration-150',
          'focus-visible:outline-none focus-visible:border-[color:var(--accent)] focus-visible:ring-2 focus-visible:ring-[color:var(--accent-ring)]',
          'disabled:cursor-not-allowed disabled:opacity-60',
          className,
        )}
        {...rest}
      />
    );
  },
);
