import { forwardRef } from 'react';
import { cx } from '@/lib/utils';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';

const VARIANTS: Record<Variant, string> = {
  primary: cx(
    'bg-[color:var(--accent)] text-white shadow-[var(--shadow-sm)]',
    'hover:bg-[color:var(--accent-strong)] active:bg-[color:var(--accent-strong)]',
    'disabled:bg-[color:var(--surface-muted)] disabled:text-[color:var(--text-muted)] disabled:shadow-none',
  ),
  secondary: cx(
    'bg-[color:var(--surface)] border border-[color:var(--border)] text-[color:var(--text)]',
    'hover:bg-[color:var(--surface-muted)] active:bg-[color:var(--surface-muted)]',
    'disabled:bg-[color:var(--surface-muted)] disabled:text-[color:var(--text-muted)]',
  ),
  ghost: cx(
    'bg-transparent text-[color:var(--text)]',
    'hover:bg-[color:var(--surface-muted)] active:bg-[color:var(--surface-muted)]',
    'disabled:text-[color:var(--text-muted)]',
  ),
  danger: cx(
    'bg-[color:var(--danger)] text-white',
    'hover:opacity-90 active:opacity-90',
    'disabled:bg-[color:var(--surface-muted)] disabled:text-[color:var(--text-muted)]',
  ),
};

const SIZES: Record<Size, string> = {
  sm: 'h-9 px-3 text-sm',
  md: 'h-10 px-4 text-sm',
  lg: 'h-11 px-5 text-base',
};

export function buttonClass(opts: { variant?: Variant; size?: Size; className?: string } = {}) {
  const { variant = 'primary', size = 'md', className } = opts;
  return cx(
    'inline-flex items-center justify-center gap-2 rounded-lg font-medium select-none',
    'transition-colors duration-150',
    'disabled:cursor-not-allowed',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--surface)]',
    VARIANTS[variant],
    SIZES[size],
    className,
  );
}

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant = 'primary', size = 'md', type = 'button', ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={buttonClass({ variant, size, className })}
      {...rest}
    />
  );
});
