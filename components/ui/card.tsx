import { cx } from '@/lib/utils';

export function Card({ className, ...rest }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cx(
        'rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)]',
        'shadow-[var(--shadow-sm)]',
        className,
      )}
      {...rest}
    />
  );
}
