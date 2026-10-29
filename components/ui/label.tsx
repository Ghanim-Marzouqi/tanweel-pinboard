import { cx } from '@/lib/utils';

export function Label({ className, ...rest }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label
      className={cx(
        'mb-1.5 block text-sm font-medium text-[color:var(--text)]',
        className,
      )}
      {...rest}
    />
  );
}
