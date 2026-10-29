import { forwardRef } from 'react';
import { cx } from '@/lib/utils';

export const Textarea = forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(function Textarea({ className, rows = 4, ...rest }, ref) {
  return (
    <textarea
      ref={ref}
      rows={rows}
      className={cx(
        'w-full rounded-lg border border-[color:var(--border)]',
        'bg-[color:var(--surface)] px-3 py-2.5 text-sm text-[color:var(--text)]',
        'placeholder:text-[color:var(--text-faint)]',
        'transition-colors duration-150',
        'focus-visible:outline-none focus-visible:border-[color:var(--accent)] focus-visible:ring-2 focus-visible:ring-[color:var(--accent-ring)]',
        'resize-y min-h-24',
        'disabled:cursor-not-allowed disabled:opacity-60',
        className,
      )}
      {...rest}
    />
  );
});
