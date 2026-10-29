import { cx } from '@/lib/utils';

/** The Pinboard pin icon on the brand gradient. */
export function BrandMark({ size = 36, className }: { size?: number; className?: string }) {
  return (
    <span
      className={cx('inline-flex shrink-0 items-center justify-center rounded-lg text-white', className)}
      style={{
        width: size,
        height: size,
        background: 'linear-gradient(135deg, var(--accent) 0%, var(--accent-strong) 100%)',
      }}
      aria-hidden
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width={Math.round(size * 0.52)}
        height={Math.round(size * 0.52)}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <line x1="12" y1="17" x2="12" y2="22" />
        <path d="M5 17h14V7l-7-4-7 4v10z" />
        <circle cx="12" cy="11" r="2" />
      </svg>
    </span>
  );
}
